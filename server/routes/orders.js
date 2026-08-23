const express = require('express');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { sendOrderStatusEmail } = require('../mailer');

const router = express.Router();

// Fetches an order's line items joined with stock type names, e.g.
// [{ stock_type_id: 1, stock_type_name: 'Broilers', quantity: 5 }, ...]
function getOrderItems(orderId) {
  return db.prepare(`
    SELECT order_items.stock_type_id, stock_types.name AS stock_type_name, order_items.quantity
    FROM order_items
    JOIN stock_types ON stock_types.id = order_items.stock_type_id
    WHERE order_items.order_id = ?
  `).all(orderId);
}

function attachItems(order) {
  return { ...order, items: getOrderItems(order.id) };
}

// Customer: create a new order request with one or more stock type line items
router.post('/', authenticate, (req, res) => {
  const { items, note, delivery_date, delivery_location } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one chicken type and quantity is required' });
  }

  if (!delivery_location || !delivery_location.trim()) {
    return res.status(400).json({ error: 'A delivery location is required' });
  }

  for (const item of items) {
    if (!item.stock_type_id || !item.quantity || item.quantity <= 0) {
      return res.status(400).json({ error: 'Each item needs a chicken type and a positive quantity' });
    }
    const type = db.prepare('SELECT id FROM stock_types WHERE id = ?').get(item.stock_type_id);
    if (!type) {
      return res.status(400).json({ error: `Unknown chicken type (id ${item.stock_type_id})` });
    }
  }

  const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity), 0);

  let orderId;
  try {
    db.exec('BEGIN');
    const result = db.prepare(
      'INSERT INTO orders (customer_id, quantity, note, status, delivery_date, delivery_location) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      req.user.id,
      totalQuantity,
      note || null,
      'pending',
      delivery_date || null,
      delivery_location.trim()
    );
    orderId = result.lastInsertRowid;

    const insertItem = db.prepare(
      'INSERT INTO order_items (order_id, stock_type_id, quantity) VALUES (?, ?, ?)'
    );
    for (const item of items) {
      insertItem.run(orderId, item.stock_type_id, item.quantity);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    return res.status(500).json({ error: 'Failed to create order. Please try again.' });
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  res.status(201).json(attachItems(order));
});

// Customer: view their own orders
router.get('/mine', authenticate, (req, res) => {
  const orders = db.prepare(
    'SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC'
  ).all(req.user.id);
  res.json(orders.map(attachItems));
});

// Admin: view all orders, with customer name joined in
router.get('/', authenticate, requireAdmin, (req, res) => {
  const orders = db.prepare(`
    SELECT orders.*, users.name AS customer_name, users.email AS customer_email
    FROM orders
    JOIN users ON users.id = orders.customer_id
    ORDER BY orders.created_at DESC
  `).all();
  res.json(orders.map(attachItems));
});

// Admin: accept an order (only if enough stock is available for every line item;
// decrements each stock type accordingly)
router.post('/:id/accept', authenticate, requireAdmin, (req, res) => {
  const orderId = req.params.id;
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);

  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'pending') {
    return res.status(400).json({ error: `Order is already ${order.status}` });
  }

  const items = getOrderItems(orderId);

  // Check every line item has enough stock before changing anything
  const shortfalls = [];
  for (const item of items) {
    const type = db.prepare('SELECT quantity FROM stock_types WHERE id = ?').get(item.stock_type_id);
    if (!type || type.quantity < item.quantity) {
      shortfalls.push(
        `${item.stock_type_name}: available ${type ? type.quantity : 0}, requested ${item.quantity}`
      );
    }
  }
  if (shortfalls.length > 0) {
    return res.status(400).json({ error: `Not enough stock — ${shortfalls.join('; ')}` });
  }

  // Run as a transaction so all stock types and the order status stay in sync
  try {
    db.exec('BEGIN');
    for (const item of items) {
      db.prepare('UPDATE stock_types SET quantity = quantity - ? WHERE id = ?')
        .run(item.quantity, item.stock_type_id);
    }
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('accepted', orderId);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    return res.status(500).json({ error: 'Failed to accept order. Please try again.' });
  }

  const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);

  const customer = db.prepare('SELECT name, email FROM users WHERE id = ?').get(order.customer_id);
  sendOrderStatusEmail({
    to: customer.email,
    customerName: customer.name,
    quantity: order.quantity,
    status: 'accepted',
  });

  res.json(attachItems(updatedOrder));
});

// Admin: reject an order, with an optional reason shown to the customer
router.post('/:id/reject', authenticate, requireAdmin, (req, res) => {
  const orderId = req.params.id;
  const { reason } = req.body;
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);

  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'pending') {
    return res.status(400).json({ error: `Order is already ${order.status}` });
  }

  db.prepare('UPDATE orders SET status = ?, admin_note = ? WHERE id = ?')
    .run('rejected', reason || null, orderId);
  const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);

  const customer = db.prepare('SELECT name, email FROM users WHERE id = ?').get(order.customer_id);
  sendOrderStatusEmail({
    to: customer.email,
    customerName: customer.name,
    quantity: order.quantity,
    status: 'rejected',
    reason,
  });

  res.json(attachItems(updatedOrder));
});

module.exports = router;
