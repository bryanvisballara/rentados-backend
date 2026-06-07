const express = require('express');
const { runSeed } = require('../scripts/seed');

const router = express.Router();

router.post('/sync-db', async (req, res) => {
  try {
    const deployKey = process.env.DEPLOY_KEY;
    if (!deployKey) {
      return res.status(503).json({ error: 'DEPLOY_KEY no configurada en el servidor' });
    }

    if (req.headers['x-deploy-key'] !== deployKey) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    await runSeed();
    res.json({ ok: true, message: 'MongoDB sincronizado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
