const express = require('express');
const { AccountingConnection, AccountingSync } = require('../models');
const { getOrgContext } = require('../utils/tenantContext');
const {
  PROVIDERS,
  encryptCredentials,
  decryptCredentials,
  publicConnection,
  testConnection,
  syncPeriod,
  exportPeriodCsv,
} = require('../utils/accounting');

const router = express.Router();

const FILE_PROVIDERS = new Set(['worldoffice', 'helisa', 'loggro']);

async function requireOrganization(req, res) {
  const { organization } = await getOrgContext(req.user, req);
  if (!organization) {
    res.status(400).json({ error: 'No hay conjunto seleccionado' });
    return null;
  }
  return organization;
}

router.get('/', async (req, res) => {
  try {
    const organization = await requireOrganization(req, res);
    if (!organization) return;
    const connection = await AccountingConnection.findOne({ organizationId: organization._id });
    const recent = connection
      ? await AccountingSync.find({ organizationId: organization._id }).sort({ createdAt: -1 }).limit(12)
      : [];
    res.json({
      connection: publicConnection(connection),
      activity: recent.map((item) => ({
        id: item._id,
        action: item.action,
        status: item.status,
        message: item.message,
        createdAt: item.createdAt,
      })),
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/connect', async (req, res) => {
  try {
    const organization = await requireOrganization(req, res);
    if (!organization) return;
    const provider = String(req.body.provider || '');
    if (!PROVIDERS.some((item) => item.id === provider)) {
      return res.status(400).json({ error: 'Elige un software contable' });
    }

    if (FILE_PROVIDERS.has(provider)) {
      const connection = await AccountingConnection.findOneAndUpdate(
        { organizationId: organization._id },
        {
          provider,
          status: 'connected',
          companyName: '',
          credentialsEnc: '',
          accountLabel: '',
          options: {},
          lastError: '',
          lastTestedAt: new Date(),
        },
        { upsert: true, new: true }
      );
      return res.json({ connection: publicConnection(connection) });
    }

    const existing = await AccountingConnection.findOne({ organizationId: organization._id });
    const previous = existing?.provider === provider ? decryptCredentials(existing.credentialsEnc) : null;
    const incoming = req.body.credentials || {};
    const credentials =
      provider === 'siigo'
        ? {
            username: String(incoming.username || previous?.username || '').trim(),
            accessKey: String(incoming.accessKey || previous?.accessKey || '').trim(),
          }
        : {
            email: String(incoming.email || previous?.email || '').trim(),
            token: String(incoming.token || previous?.token || '').trim(),
          };

    const tested = await testConnection(provider, credentials);
    const connection = await AccountingConnection.findOneAndUpdate(
      { organizationId: organization._id },
      {
        provider,
        status: 'connected',
        companyName: tested.companyName,
        accountLabel: tested.accountLabel,
        credentialsEnc: encryptCredentials(credentials),
        options: tested.options,
        lastTestedAt: new Date(),
        lastError: '',
      },
      { upsert: true, new: true }
    );
    res.json({ connection: publicConnection(connection) });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

router.patch('/settings', async (req, res) => {
  try {
    const organization = await requireOrganization(req, res);
    if (!organization) return;
    const connection = await AccountingConnection.findOne({ organizationId: organization._id });
    if (!connection || connection.status !== 'connected') {
      return res.status(400).json({ error: 'Primero conecta el software contable' });
    }
    connection.settings = { ...(connection.settings?.toObject?.() || connection.settings || {}), ...req.body };
    connection.lastError = '';
    await connection.save();
    res.json({ connection: publicConnection(connection) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/sync', async (req, res) => {
  try {
    const organization = await requireOrganization(req, res);
    if (!organization) return;
    const period = String(req.body.period || '').trim();
    if (!/^\d{4}-\d{2}$/.test(period)) return res.status(400).json({ error: 'Elige el mes a enviar' });
    const result = await syncPeriod(organization._id, period);
    const recent = await AccountingSync.find({ organizationId: organization._id }).sort({ createdAt: -1 }).limit(12);
    res.json({
      ...result,
      activity: recent.map((item) => ({
        id: item._id,
        action: item.action,
        status: item.status,
        message: item.message,
        createdAt: item.createdAt,
      })),
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/export', async (req, res) => {
  try {
    const organization = await requireOrganization(req, res);
    if (!organization) return;
    const period = String(req.query.period || '').trim();
    if (!/^\d{4}-\d{2}$/.test(period)) return res.status(400).json({ error: 'Elige el mes a descargar' });
    const csv = await exportPeriodCsv(organization._id, period);
    res.json({ filename: `cartera-${period}.csv`, csv });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/', async (req, res) => {
  try {
    const organization = await requireOrganization(req, res);
    if (!organization) return;
    await AccountingConnection.deleteOne({ organizationId: organization._id });
    res.json({ connection: publicConnection(null) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
