const express = require('express');
const cors = require('cors');
const path = require('path'); //added
require('dotenv').config();

require('./db'); // ensures DB + tables + default admin are set up on startup

const authRoutes = require('./routes/auth');
const stockTypeRoutes = require('./routes/stockTypes');
const orderRoutes = require('./routes/orders');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/stock-types', stockTypeRoutes);
app.use('/api/orders', orderRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Serve the built React frontend (client/dist) from this same server.
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDistPath));

app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`JK Chicken Care server running on http://localhost:${PORT}`);
});
