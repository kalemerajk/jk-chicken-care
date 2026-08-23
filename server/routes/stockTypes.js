const express = require('express');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all stock types with their current quantity (any logged-in user)
router.get('/', authenticate, (req, res) => {
  const types = db.prepare('SELECT * FROM stock_types ORDER BY id').all();
  res.json(types);
});

// Admin-only: update a stock type's quantity directly (e.g. after a new delivery)
router.put('/:id', authenticate, requireAdmin, (req, res) => {
  const { quantity } = req.body;

  if (typeof quantity !== 'number' || quantity < 0) {
    return res.status(400).json({ error: 'Quantity must be a non-negative number' });
  }

  const type = db.prepare('SELECT * FROM stock_types WHERE id = ?').get(req.params.id);
  if (!type) return res.status(404).json({ error: 'Stock type not found' });

  db.prepare('UPDATE stock_types SET quantity = ? WHERE id = ?').run(quantity, req.params.id);
  const updated = db.prepare('SELECT * FROM stock_types WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// Admin-only: add a brand new stock type (e.g. "Turkeys")
router.post('/', authenticate, requireAdmin, (req, res) => {
  const { name, quantity } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'A name is required' });
  }

  const existing = db.prepare('SELECT id FROM stock_types WHERE name = ?').get(name.trim());
  if (existing) {
    return res.status(409).json({ error: 'A stock type with this name already exists' });
  }

  const result = db.prepare('INSERT INTO stock_types (name, quantity) VALUES (?, ?)')
    .run(name.trim(), Number(quantity) || 0);

  const created = db.prepare('SELECT * FROM stock_types WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

module.exports = router;
