require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { connectDB } = require('./config/db');
const apiRoutes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'rentados-backend',
    version: '0.1.0',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/v1', (_req, res) => {
  res.json({
    name: 'Rentados API',
    version: '0.1.0',
    docs: 'See BLUEPRINT.md',
    endpoints: {
      health: 'GET /health',
      info: 'GET /api/v1',
      collections: 'GET /api/v1/collections',
    },
  });
});

app.use('/api', apiRoutes);

if (isProd) {
  const webDist = path.join(__dirname, '../web/dist');
  app.use(express.static(webDist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(webDist, 'index.html'));
  });
} else {
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  app.listen(PORT, () => {
    console.log(`Rentados API escuchando en puerto ${PORT}`);
  });

  try {
    await connectDB();
  } catch (err) {
    console.error('MongoDB no conectó al iniciar (reintentará en requests):', err.message);
  }
}

start().catch((err) => {
  console.error('No se pudo iniciar el servidor:', err);
  process.exit(1);
});
