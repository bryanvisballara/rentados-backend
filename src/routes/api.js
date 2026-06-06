const express = require('express');
const mongoose = require('mongoose');
const models = require('../models');

const router = express.Router();

router.get('/collections', async (_req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        error: 'MongoDB no conectado',
        hint: 'Configura MONGO_URI en las variables de entorno',
      });
    }

    const counts = await Promise.all(
      Object.entries(models).map(async ([name, Model]) => {
        const count = await Model.countDocuments();
        return { collection: Model.collection.name, model: name, count };
      })
    );

    res.json({
      database: mongoose.connection.db.databaseName,
      collections: counts.sort((a, b) => a.collection.localeCompare(b.collection)),
      totalDocuments: counts.reduce((sum, c) => sum + c.count, 0),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
