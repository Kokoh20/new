const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const app = express();

app.use(express.json());
app.use(cors());

// Configuration and catalog (authoritative on server)
const appConfig = {
  business: {
    name: 'Mauiz Cafe',
    email: 'hello@mauizcafe.example',
    phone: '+1 (555) 010-CAFE',
    address: '12 Brew Street, Bean City',
  },
  currency: { code: 'USD', locale: 'en-US' },
  tax: { enabled: false, rate: 0 },
};

const catalog = [
  { id: 'coffee-espresso', name: 'Espresso', price: 2.5, category: 'Coffee', image: 'https://images.unsplash.com/photo-1512568400610-62da28bc8a13?w=800&q=60' },
  { id: 'coffee-americano', name: 'Americano', price: 3.0, category: 'Coffee', image: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=800&q=60' },
  { id: 'coffee-latte', name: 'Caffe Latte', price: 3.75, category: 'Coffee', image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=800&q=60' },
  { id: 'coffee-cappuccino', name: 'Cappuccino', price: 3.75, category: 'Coffee', image: 'https://images.unsplash.com/photo-1510972527921-ce03766a1cf1?w=800&q=60' },
  { id: 'coffee-mocha', name: 'Mocha', price: 4.0, category: 'Coffee', image: 'https://images.unsplash.com/photo-1498804103079-a6351b050096?w=800&q=60' },
  { id: 'noncoffee-chocolate', name: 'Hot Chocolate', price: 3.25, category: 'Non-Coffee', image: 'https://images.unsplash.com/photo-1517686469429-8bdb88b9f907?w=800&q=60' },
  { id: 'noncoffee-matcha', name: 'Matcha Latte', price: 4.0, category: 'Non-Coffee', image: 'https://images.unsplash.com/photo-1515824955341-513a8d249d6a?w=800&q=60' },
  { id: 'noncoffee-icedtea', name: 'Iced Tea', price: 2.5, category: 'Non-Coffee', image: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800&q=60' },
  { id: 'pastry-croissant', name: 'Butter Croissant', price: 2.75, category: 'Pastries', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&q=60' },
  { id: 'pastry-muffin', name: 'Blueberry Muffin', price: 2.25, category: 'Pastries', image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476d?w=800&q=60' },
  { id: 'pastry-cookie', name: 'Chocolate Chip Cookie', price: 1.75, category: 'Pastries', image: 'https://images.unsplash.com/photo-1606813907291-76b599ecb39e?w=800&q=60' },
];

// Utility
function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function calculateTotals(items) {
  // items: [{ productId, quantity }]
  const detailed = items.map(it => {
    const product = catalog.find(p => p.id === it.productId);
    if (!product) throw new Error(`Unknown product: ${it.productId}`);
    const quantity = Math.max(1, Math.min(999, Number(it.quantity || 1)));
    const lineTotal = roundMoney(product.price * quantity);
    return { product, quantity, lineTotal };
  });
  const subtotal = roundMoney(detailed.reduce((s, d) => s + d.lineTotal, 0));
  const tax = appConfig.tax.enabled ? roundMoney(subtotal * appConfig.tax.rate) : 0;
  const total = roundMoney(subtotal + tax);
  return { itemsDetailed: detailed, subtotal, tax, total };
}

function generateInvoiceId() {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const frag = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `MC-${yyyy}${mm}${dd}-${frag}`;
}

const dataDir = path.join(__dirname(), 'data');
const ordersPath = path.join(dataDir, 'orders.json');

function __dirname() {
  return path.dirname(__filename);
}

function ensureDataFile() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(ordersPath)) fs.writeFileSync(ordersPath, '[]', 'utf-8');
}

function readOrders() {
  ensureDataFile();
  try {
    return JSON.parse(fs.readFileSync(ordersPath, 'utf-8'));
  } catch {
    return [];
  }
}

function writeOrders(orders) {
  ensureDataFile();
  fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2), 'utf-8');
}

// API routes
app.get('/api/config', (req, res) => {
  res.json(appConfig);
});

app.get('/api/catalog', (req, res) => {
  res.json({ catalog });
});

app.get('/api/orders', (req, res) => {
  res.json({ orders: readOrders() });
});

app.get('/api/orders/:id', (req, res) => {
  const orders = readOrders();
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Not found' });
  res.json(order);
});

app.post('/api/orders', (req, res) => {
  try {
    const { items, customer, paymentMethod, paymentDetails } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items required' });
    }
    if (!paymentMethod) {
      return res.status(400).json({ error: 'Payment method required' });
    }

    const totals = calculateTotals(items);
    const invoiceId = generateInvoiceId();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const createdAt = new Date().toISOString();

    const order = {
      id,
      invoiceId,
      createdAt,
      items,
      itemsDetailed: totals.itemsDetailed.map(d => ({
        productId: d.product.id,
        name: d.product.name,
        price: d.product.price,
        quantity: d.quantity,
        lineTotal: d.lineTotal,
      })),
      totals: { subtotal: totals.subtotal, tax: totals.tax, total: totals.total },
      customer: customer || {},
      paymentMethod,
      paymentDetails: paymentDetails || {},
    };

    const orders = readOrders();
    orders.push(order);
    writeOrders(orders);

    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// Serve static site
const staticDir = '/workspace/microbiz-site';
app.use(express.static(staticDir));
app.get('*', (req, res) => {
  res.sendFile(path.join(staticDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Mauiz Cafe server running on http://localhost:${PORT}`);
});

