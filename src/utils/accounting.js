const crypto = require('crypto');
const { AccountingConnection, AccountingSync, Payment, Unit, Tower } = require('../models');

const PROVIDERS = [
  {
    id: 'siigo',
    name: 'Siigo Nube',
    mode: 'api',
    summary: 'El más usado por contadores en Colombia. Se conecta con el usuario y la clave API.',
  },
  {
    id: 'alegra',
    name: 'Alegra',
    mode: 'api',
    summary: 'Contabilidad en la nube. Se conecta con el correo y el token de integraciones.',
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    mode: 'oauth',
    summary: 'Se conecta con la cuenta de Intuit. Sirve si el contador trabaja fuera de Colombia.',
  },
  {
    id: 'worldoffice',
    name: 'World Office',
    mode: 'file',
    summary: 'No ofrece una clave para enlazar. Se descarga la cartera y el contador la importa.',
  },
  {
    id: 'helisa',
    name: 'Helisa',
    mode: 'file',
    summary: 'No ofrece una clave para enlazar. Se descarga la cartera y el contador la importa.',
  },
  {
    id: 'loggro',
    name: 'Loggro',
    mode: 'file',
    summary: 'La API no está abierta al administrador. Se descarga la cartera del mes.',
  },
];

function credentialKey() {
  const raw = process.env.ACCOUNTING_CREDENTIALS_KEY || process.env.JWT_SECRET || 'rentados-accounting';
  return crypto.createHash('sha256').update(String(raw)).digest();
}

function encryptCredentials(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', credentialKey(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, data]).toString('base64');
}

function decryptCredentials(payload) {
  if (!payload) return null;
  const buffer = Buffer.from(payload, 'base64');
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const data = buffer.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', credentialKey(), iv);
  decipher.setAuthTag(tag);
  const json = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  return JSON.parse(json);
}

function publicConnection(connection) {
  if (!connection) return { provider: null, status: 'disconnected', providers: PROVIDERS };
  return {
    provider: connection.provider,
    status: connection.status,
    companyName: connection.companyName || '',
    accountLabel: connection.accountLabel || '',
    settings: connection.settings || {},
    options: connection.options || {},
    lastTestedAt: connection.lastTestedAt,
    lastSyncAt: connection.lastSyncAt,
    lastError: connection.lastError || '',
    providers: PROVIDERS,
  };
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 180) };
  }
}

function apiError(data, fallback) {
  const message =
    data?.Errors?.[0]?.Message ||
    data?.errors?.[0]?.message ||
    data?.error?.message ||
    data?.message ||
    data?.error ||
    fallback;
  return new Error(typeof message === 'string' ? message : fallback);
}

async function siigoToken(credentials) {
  const response = await fetch('https://api.siigo.com/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Partner-Id': 'Rentados' },
    body: JSON.stringify({
      username: credentials.username,
      access_key: credentials.accessKey,
    }),
  });
  const data = await readJson(response);
  if (!response.ok || !data.access_token) throw apiError(data, 'Siigo no aceptó el usuario o la clave API');
  return data.access_token;
}

async function siigoGet(token, path) {
  const response = await fetch(`https://api.siigo.com${path}`, {
    headers: { Authorization: token, 'Partner-Id': 'Rentados' },
  });
  const data = await readJson(response);
  if (!response.ok) throw apiError(data, 'Siigo no respondió');
  return data;
}

function asList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

async function testSiigo(credentials) {
  const token = await siigoToken(credentials);
  const [documents, users, products, paymentTypes] = await Promise.all([
    siigoGet(token, '/v1/document-types?type=FV'),
    siigoGet(token, '/v1/users'),
    siigoGet(token, '/v1/products?page=1&page_size=50'),
    siigoGet(token, '/v1/payment-types?document_type=FV'),
  ]);
  return {
    companyName: credentials.username,
    accountLabel: credentials.username,
    options: {
      documents: asList(documents).map((item) => ({ id: String(item.id), name: item.name || item.code })),
      sellers: asList(users).map((item) => ({
        id: String(item.id),
        name: [item.first_name, item.last_name].filter(Boolean).join(' ') || item.username || String(item.id),
      })),
      items: asList(products).map((item) => ({
        id: item.code || String(item.id),
        name: item.name || item.code,
      })),
      paymentTypes: asList(paymentTypes).map((item) => ({ id: String(item.id), name: item.name })),
    },
  };
}

function alegraAuth(credentials) {
  return `Basic ${Buffer.from(`${credentials.email}:${credentials.token}`).toString('base64')}`;
}

async function alegraGet(credentials, path) {
  const response = await fetch(`https://api.alegra.com/api/v1${path}`, {
    headers: { Authorization: alegraAuth(credentials), Accept: 'application/json' },
  });
  const data = await readJson(response);
  if (!response.ok) throw apiError(data, 'Alegra no aceptó el correo o el token');
  return data;
}

async function testAlegra(credentials) {
  const [company, items, banks, contacts] = await Promise.all([
    alegraGet(credentials, '/company'),
    alegraGet(credentials, '/items?limit=30'),
    alegraGet(credentials, '/bank-accounts?limit=30'),
    alegraGet(credentials, '/contacts?type=client&limit=30'),
  ]);
  return {
    companyName: company.name || credentials.email,
    accountLabel: credentials.email,
    options: {
      items: asList(items).map((item) => ({ id: String(item.id), name: item.name })),
      banks: asList(banks).map((item) => ({ id: String(item.id), name: item.name })),
      contacts: asList(contacts).map((item) => ({ id: String(item.id), name: item.name })),
    },
  };
}

async function testConnection(provider, credentials) {
  if (provider === 'siigo') return testSiigo(credentials);
  if (provider === 'alegra') return testAlegra(credentials);
  if (provider === 'quickbooks') {
    const error = new Error(
      'QuickBooks se conecta con el inicio de sesión de Intuit. Pídele a Rentados activar la aplicación y, mientras tanto, descarga la cartera.'
    );
    error.status = 400;
    throw error;
  }
  const error = new Error('Este programa se enlaza descargando el archivo de cartera.');
  error.status = 400;
  throw error;
}

function dateOnly(value) {
  const date = value ? new Date(value) : new Date();
  return date.toISOString().slice(0, 10);
}

async function unitLabel(payment) {
  const unit = await Unit.findById(payment.unitId).select('number tower towerId');
  if (!unit) return 'Apartamento';
  let tower = unit.tower || '';
  if (!tower && unit.towerId) {
    const found = await Tower.findById(unit.towerId).select('name');
    tower = found?.name || '';
  }
  return [tower, unit.number].filter(Boolean).join(' ');
}

async function createSiigoInvoice(connection, credentials, payment, label) {
  const token = await siigoToken(credentials);
  const settings = connection.settings || {};
  const amount = Math.round(Number(payment.amount) || 0);
  const response = await fetch('https://api.siigo.com/v1/invoices', {
    method: 'POST',
    headers: {
      Authorization: token,
      'Partner-Id': 'Rentados',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      document: { id: Number(settings.documentTypeId) },
      date: dateOnly(payment.dueDate),
      customer: { identification: settings.customerIdentification, branch_office: 0 },
      seller: Number(settings.sellerId),
      observations: `Cuota de administración ${payment.period} · ${label}`,
      items: [
        {
          code: settings.itemId,
          description: `Cuota de administración ${payment.period} · ${label}`,
          quantity: 1,
          price: amount,
          discount: 0,
        },
      ],
      payments: [
        {
          id: Number(settings.paymentTypeId),
          value: amount,
          due_date: dateOnly(payment.dueDate),
        },
      ],
      stamp: { send: Boolean(settings.sendToDian) },
    }),
  });
  const data = await readJson(response);
  if (!response.ok) throw apiError(data, 'Siigo no creó la factura');
  return String(data.id || data.number || '');
}

async function createAlegraInvoice(connection, credentials, payment, label) {
  const settings = connection.settings || {};
  const amount = Math.round(Number(payment.amount) || 0);
  const response = await fetch('https://api.alegra.com/api/v1/invoices', {
    method: 'POST',
    headers: {
      Authorization: alegraAuth(credentials),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      date: dateOnly(payment.dueDate),
      dueDate: dateOnly(payment.dueDate),
      client: { id: Number(settings.contactId) },
      paymentMethod: 'CREDIT',
      observations: `Cuota de administración ${payment.period} · ${label}`,
      items: [
        {
          id: Number(settings.itemId),
          price: amount,
          quantity: 1,
          description: `Cuota de administración ${payment.period} · ${label}`,
        },
      ],
    }),
  });
  const data = await readJson(response);
  if (!response.ok) throw apiError(data, 'Alegra no creó la factura');
  return String(data.id || '');
}

async function createAlegraPayment(connection, credentials, payment) {
  const settings = connection.settings || {};
  const amount = Math.round(Number(payment.paidAmount || payment.amount) || 0);
  const response = await fetch('https://api.alegra.com/api/v1/payments', {
    method: 'POST',
    headers: {
      Authorization: alegraAuth(credentials),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      date: dateOnly(payment.paidAt),
      bankAccount: { id: Number(settings.bankAccountId) },
      client: { id: Number(settings.contactId) },
      type: 'in',
      invoices: [{ id: Number(payment.accountingInvoiceId), amount }],
    }),
  });
  const data = await readJson(response);
  if (!response.ok) throw apiError(data, 'Alegra no registró el pago');
  return String(data.id || '');
}

function readyToInvoice(connection) {
  const settings = connection.settings || {};
  if (connection.provider === 'siigo') {
    return Boolean(settings.documentTypeId && settings.sellerId && settings.itemId && settings.paymentTypeId && settings.customerIdentification);
  }
  if (connection.provider === 'alegra') {
    return Boolean(settings.itemId && settings.contactId);
  }
  return false;
}

async function syncPaymentDocument(payment) {
  const connection = await AccountingConnection.findOne({
    organizationId: payment.organizationId,
    status: 'connected',
  });
  if (!connection) return null;
  const credentials = decryptCredentials(connection.credentialsEnc);
  const settings = connection.settings || {};
  const label = await unitLabel(payment);

  if (settings.sendInvoices && !payment.accountingInvoiceId) {
    if (!readyToInvoice(connection)) {
      return AccountingSync.create({
        organizationId: payment.organizationId,
        paymentId: payment._id,
        provider: connection.provider,
        action: 'invoice',
        status: 'skipped',
        message: 'Falta elegir el comprobante, el producto o el cliente en Contabilidad.',
      });
    }
    try {
      const externalId =
        connection.provider === 'siigo'
          ? await createSiigoInvoice(connection, credentials, payment, label)
          : await createAlegraInvoice(connection, credentials, payment, label);
      payment.accountingInvoiceId = externalId;
      await payment.save();
      await AccountingSync.create({
        organizationId: payment.organizationId,
        paymentId: payment._id,
        provider: connection.provider,
        action: 'invoice',
        status: 'sent',
        externalId,
        message: `Factura enviada · ${label}`,
      });
    } catch (err) {
      await AccountingSync.create({
        organizationId: payment.organizationId,
        paymentId: payment._id,
        provider: connection.provider,
        action: 'invoice',
        status: 'error',
        message: err.message,
      });
      connection.lastError = err.message;
      await connection.save();
      return null;
    }
  }

  if (settings.sendPayments && payment.status === 'paid' && payment.accountingInvoiceId && !payment.accountingPaymentId) {
    if (connection.provider === 'siigo') {
      await AccountingSync.create({
        organizationId: payment.organizationId,
        paymentId: payment._id,
        provider: connection.provider,
        action: 'payment',
        status: 'skipped',
        message: 'El pago queda en la factura de Siigo. El recibo de caja se registra en Siigo Nube.',
      });
      return null;
    }
    if (connection.provider === 'alegra' && settings.bankAccountId) {
      try {
        const externalId = await createAlegraPayment(connection, credentials, payment);
        payment.accountingPaymentId = externalId;
        await payment.save();
        await AccountingSync.create({
          organizationId: payment.organizationId,
          paymentId: payment._id,
          provider: connection.provider,
          action: 'payment',
          status: 'sent',
          externalId,
          message: `Pago enviado · ${label}`,
        });
      } catch (err) {
        await AccountingSync.create({
          organizationId: payment.organizationId,
          paymentId: payment._id,
          provider: connection.provider,
          action: 'payment',
          status: 'error',
          message: err.message,
        });
        connection.lastError = err.message;
        await connection.save();
      }
    }
  }

  connection.lastSyncAt = new Date();
  connection.lastError = '';
  await connection.save();
  return null;
}

async function syncPaidPayments(payments) {
  for (const payment of payments || []) {
    if (!payment || payment.status !== 'paid') continue;
    try {
      await syncPaymentDocument(payment);
    } catch (err) {
      console.error('No se pudo enviar el pago al software contable:', err.message);
    }
  }
}

async function syncPeriod(organizationId, period) {
  const payments = await Payment.find({
    organizationId,
    concept: 'administration',
    period,
  }).limit(200);
  let sent = 0;
  let failed = 0;
  for (const payment of payments) {
    const before = payment.accountingInvoiceId;
    await syncPaymentDocument(payment);
    const fresh = await Payment.findById(payment._id).select('accountingInvoiceId');
    if (fresh?.accountingInvoiceId && fresh.accountingInvoiceId !== before) sent += 1;
  }
  const errors = await AccountingSync.countDocuments({
    organizationId,
    status: 'error',
    createdAt: { $gte: new Date(Date.now() - 60 * 1000) },
  });
  failed = errors;
  return { sent, failed, total: payments.length };
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

async function exportPeriodCsv(organizationId, period) {
  const payments = await Payment.find({ organizationId, concept: 'administration', period }).limit(500);
  const rows = [['Periodo', 'Apartamento', 'Concepto', 'Valor', 'Pagado', 'Estado', 'Vencimiento']];
  for (const payment of payments) {
    rows.push([
      payment.period,
      await unitLabel(payment),
      'Cuota de administración',
      payment.amount,
      payment.paidAmount || 0,
      payment.status,
      dateOnly(payment.dueDate),
    ]);
  }
  return rows.map((row) => row.map(csvEscape).join(',')).join('\n');
}

module.exports = {
  PROVIDERS,
  encryptCredentials,
  decryptCredentials,
  publicConnection,
  testConnection,
  syncPaidPayments,
  syncPeriod,
  exportPeriodCsv,
};
