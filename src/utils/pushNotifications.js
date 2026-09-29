const http2 = require('http2');
const jwt = require('jsonwebtoken');
const webpush = require('web-push');
const admin = require('firebase-admin');
const { PushDevice, Resident, Unit } = require('../models');

const STATUS_COPY = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  preparing: 'En preparación',
  ready: 'Listo para entregar',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

let apnsToken = '';
let apnsTokenAt = 0;

function vapidConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function apnsConfigured() {
  return Boolean(process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID && process.env.APNS_PRIVATE_KEY);
}

function firebaseConfigured() {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT);
}

function ensureFirebase() {
  if (admin.apps.length) return true;
  if (!firebaseConfigured()) return false;
  const creds = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  if (typeof creds.private_key === 'string') {
    creds.private_key = creds.private_key.replace(/\\n/g, '\n');
  }
  admin.initializeApp({ credential: admin.credential.cert(creds) });
  return true;
}

function isApnsToken(token) {
  return /^[0-9a-f]{32,}$/.test(token);
}

function configureWebPush() {
  if (!vapidConfigured()) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:soporte@rentados.co',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  return true;
}

function apnsJwt() {
  if (apnsToken && Date.now() - apnsTokenAt < 40 * 60 * 1000) return apnsToken;
  const privateKey = String(process.env.APNS_PRIVATE_KEY).replace(/\\n/g, '\n');
  apnsToken = jwt.sign({}, privateKey, {
    algorithm: 'ES256',
    issuer: process.env.APNS_TEAM_ID,
    expiresIn: '50m',
    header: { alg: 'ES256', kid: process.env.APNS_KEY_ID },
  });
  apnsTokenAt = Date.now();
  return apnsToken;
}

function sendApns(deviceToken, payload) {
  const host = process.env.APNS_PRODUCTION === 'true' ? 'api.push.apple.com' : 'api.sandbox.push.apple.com';
  const client = http2.connect(`https://${host}`);
  const body = JSON.stringify({
    aps: {
      alert: { title: payload.title, body: payload.body },
      sound: 'default',
    },
    url: payload.url || '/app',
  });

  return new Promise((resolve) => {
    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      authorization: `bearer ${apnsJwt()}`,
      'apns-topic': process.env.APNS_BUNDLE_ID || 'com.rentados.app',
      'apns-push-type': 'alert',
      'apns-priority': '10',
    });
    let status = 0;
    req.on('response', (headers) => {
      status = Number(headers[':status'] || 0);
    });
    req.on('error', () => {
      client.close();
      resolve(0);
    });
    req.on('end', () => {
      client.close();
      resolve(status);
    });
    req.end(body);
  });
}

async function sendFcm(device, payload) {
  if (!ensureFirebase()) return;
  try {
    await admin.messaging().send({
      token: device.token,
      notification: { title: payload.title, body: payload.body },
      data: { url: payload.url || '/app' },
      apns: {
        headers: { 'apns-priority': '10', 'apns-push-type': 'alert' },
        payload: {
          aps: {
            alert: { title: payload.title, body: payload.body },
            sound: 'default',
          },
        },
      },
    });
  } catch (err) {
    const code = err.code || '';
    if (
      code === 'messaging/registration-token-not-registered' ||
      code === 'messaging/invalid-registration-token'
    ) {
      await PushDevice.deleteOne({ _id: device._id });
    }
  }
}

async function sendToDevice(device, payload) {
  if (device.platform === 'ios') {
    if (isApnsToken(device.token) && apnsConfigured()) {
      const status = await sendApns(device.token, payload);
      if (status === 410 || status === 400) {
        await PushDevice.deleteOne({ _id: device._id });
      }
      return;
    }
    await sendFcm(device, payload);
    return;
  }

  if (!configureWebPush() || !device.subscription) return;
  try {
    await webpush.sendNotification(
      device.subscription,
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url || '/app',
      })
    );
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) {
      await PushDevice.deleteOne({ _id: device._id });
    }
  }
}

async function sendPushToUsers(userIds, payload) {
  const ids = [...new Set((userIds || []).map((id) => String(id)).filter(Boolean))];
  if (!ids.length) return;
  const devices = await PushDevice.find({ userId: { $in: ids } });
  await Promise.all(devices.map((device) => sendToDevice(device, payload).catch(() => {})));
}

async function notifyNewPublication(publication) {
  const filter = { buildingId: publication.buildingId, isActive: { $ne: false } };
  if (publication.audienceScope === 'units' && publication.audienceUnitIds?.length) {
    filter._id = { $in: publication.audienceUnitIds };
  } else if (publication.audienceScope === 'towers' && publication.audienceTowerIds?.length) {
    filter.towerId = { $in: publication.audienceTowerIds };
  }
  const units = await Unit.find(filter).select('_id');
  const residents = await Resident.find({ unitId: { $in: units.map((unit) => unit._id) } }).select('userId');
  const excerpt = String(publication.body || '').replace(/\s+/g, ' ').trim().slice(0, 140);
  await sendPushToUsers(
    residents.map((resident) => resident.userId),
    {
      title: publication.title || 'Nueva publicación',
      body: excerpt || 'Hay un aviso nuevo en tu conjunto.',
      url: '/app',
    }
  );
}

async function notifyOrderStatus(order, kind) {
  const label = STATUS_COPY[order.status] || order.status;
  const title = kind === 'shop' ? 'Shop' : order.restaurantName || 'Restaurante';
  await sendPushToUsers([order.userId], {
    title,
    body: `Tu pedido ${order.orderNumber} está ${label.toLowerCase()}.`,
    url: kind === 'shop' ? '/app/shop' : '/app/restaurantes',
  });
}

async function savePushDevice(userId, body) {
  const platform = body.platform === 'ios' ? 'ios' : 'web';
  if (platform === 'ios') {
    const raw = String(body.token || '').trim();
    const token = isApnsToken(raw.toLowerCase()) ? raw.toLowerCase() : raw;
    if (!isApnsToken(token) && (token.length < 20 || /\s/.test(token))) {
      const error = new Error('Token de iPhone inválido');
      error.status = 400;
      throw error;
    }
    return PushDevice.findOneAndUpdate(
      { platform: 'ios', token },
      { userId, platform: 'ios', token, subscription: undefined },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  const subscription = body.subscription;
  const endpoint = subscription?.endpoint;
  if (!endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    const error = new Error('Suscripción del navegador inválida');
    error.status = 400;
    throw error;
  }
  return PushDevice.findOneAndUpdate(
    { platform: 'web', token: endpoint },
    { userId, platform: 'web', token: endpoint, subscription },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

module.exports = {
  vapidConfigured,
  firebaseConfigured,
  sendPushToUsers,
  notifyNewPublication,
  notifyOrderStatus,
  savePushDevice,
};
