const express = require('express');
const cors = require('cors');

const env = require('./config/env');
const logger = require('./utils/logger');
const rateLimiter = require('./middleware/rateLimiter');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth.routes');
const productRoutes = require('./routes/products.routes');
const orderRoutes = require('./routes/orders.routes');
const cartRoutes = require('./routes/cart.routes');
const chatRoutes = require('./routes/chat.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();

app.set('trust proxy', 1); // so req.ip is the real client behind a host's proxy

app.use(
  cors({
    origin: env.corsOrigin === '*' ? true : env.corsOrigin.split(',').map((o) => o.trim()),
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));

// One line per request, with the status and how long it took.
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - startedAt}ms`);
  });
  next();
});

// Broad backstop limit. The auth and chat routers add their own tighter ones.
app.use('/api', rateLimiter({ windowMs: 60_000, max: 200 }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), env: env.nodeEnv });
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);

// Must stay last, and in this order.
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
