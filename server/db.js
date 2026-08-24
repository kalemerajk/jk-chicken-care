const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const bcrypt = require('bcryptjs');

// In production, set DB_PATH to a location on a persistent disk (e.g. Render
// disk mounted at /var/data), so the database survives restarts and
// redeploys. Locally, this defaults to a file right next to this script.
const dbPath = process.env.DB_PATH || path.join(__dirname, 'chicken_care.db');
const db = new DatabaseSync(dbPath);
console.log(`Using database at: ${dbPath}`);

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer', -- 'customer' or 'admin'
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- Legacy single-total stock table. Kept only so old databases can be migrated;
  -- new code reads/writes stock_types instead.
  CREATE TABLE IF NOT EXISTS stock (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    quantity INTEGER NOT NULL DEFAULT 0
  );

  -- Each kind of chicken the business sells (e.g. Broilers, Layers, Chicks),
  -- with its own running stock count.
  CREATE TABLE IF NOT EXISTS stock_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
    note TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES users(id)
  );

  -- Line items within an order: one row per stock type requested,
  -- e.g. an order for "5 Broilers + 3 Layers" is two rows here.
  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    stock_type_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (stock_type_id) REFERENCES stock_types(id)
  );
`);

// Migration helper: safely add a column to orders if it doesn't already exist
// (safe to run on both fresh and existing databases, every time the app starts)
function ensureOrderColumn(name, definition) {
  const columns = db.prepare("PRAGMA table_info(orders)").all();
  const exists = columns.some((col) => col.name === name);
  if (!exists) {
    db.exec(`ALTER TABLE orders ADD COLUMN ${definition}`);
    console.log(`Migrated: added ${name} column to orders table`);
  }
}

ensureOrderColumn('admin_note', 'admin_note TEXT');
ensureOrderColumn('delivery_date', 'delivery_date TEXT');
ensureOrderColumn('delivery_location', 'delivery_location TEXT');

// Seed default stock types the first time this runs.
// If an old single-total "stock" row already exists (from before multiple
// types were supported), carry its quantity over into a "Broilers" type so
// no stock count is lost, and leave the other types at 0 for the admin to set.
const stockTypeCount = db.prepare('SELECT COUNT(*) AS count FROM stock_types').get().count;
if (stockTypeCount === 0) {
  const legacyStock = db.prepare('SELECT quantity FROM stock WHERE id = 1').get();
  const carriedOverQuantity = legacyStock ? legacyStock.quantity : 100;

  db.prepare('INSERT INTO stock_types (name, quantity) VALUES (?, ?)').run('Broilers', carriedOverQuantity);
  db.prepare('INSERT INTO stock_types (name, quantity) VALUES (?, ?)').run('Layers', 0);
  db.prepare('INSERT INTO stock_types (name, quantity) VALUES (?, ?)').run('Chicks', 0);

  console.log(
    `Migrated: created stock types (Broilers, Layers, Chicks). Existing stock of ${carriedOverQuantity} moved into Broilers -- adjust in the admin dashboard if needed.`
  );
}

// Migrate any existing orders (created before order_items existed) into the
// new line-item model, so old order history still displays correctly.
// Each legacy order becomes a single line item against the "Broilers" type,
// since that's where the original single stock count came from above.
const legacyOrders = db.prepare(`
  SELECT orders.id, orders.quantity
  FROM orders
  LEFT JOIN order_items ON order_items.order_id = orders.id
  WHERE order_items.id IS NULL
`).all();

if (legacyOrders.length > 0) {
  const broilers = db.prepare('SELECT id FROM stock_types WHERE name = ?').get('Broilers');
  const insertItem = db.prepare(
    'INSERT INTO order_items (order_id, stock_type_id, quantity) VALUES (?, ?, ?)'
  );
  for (const order of legacyOrders) {
    insertItem.run(order.id, broilers.id, order.quantity);
  }
  console.log(`Migrated: linked ${legacyOrders.length} existing order(s) to Broilers line items.`);
}

// Seed a default admin account if none exists (email: admin@jk.com / password: admin123)
const adminExists = db.prepare('SELECT * FROM users WHERE role = ?').get('admin');
if (!adminExists) {
  const passwordHash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
    .run('Admin', 'admin@jk.com', passwordHash, 'admin');
  console.log('Seeded default admin account -> email: admin@jk.com | password: admin123');
}

module.exports = db;