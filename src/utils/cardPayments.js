const crypto = require('crypto');
const {
  SavedPaymentMethod,
  CardPayment,
  RestaurantOrder,
  Payment,
  User,
} = require('../models');
const { buildRestaurantOrderNumber, formatRestaurantOrder } = require('./restaurantOrder');
const { getBillingSettings, enrichPayment } = require('./billing');
const {
  settleAdministrationPayments,
} = require('./administrationBalance');

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function luhnOk(number) {
  let sum = 0;
  let alt = false;
  for (let i = number.length - 1; i >= 0; i -= 1) {
    let n = Number(number[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function detectBrand(number) {
  if (/^3[47]/.test(number)) return 'amex';
  if (/^4/.test(number)) return 'visa';
  if (/^5[1-5]/.test(number) || /^2[2-7]/.test(number)) return 'mastercard';
  return 'card';
}

function formatSavedCard(doc) {
  return {
    id: doc._id,
    brand: doc.brand,
    last4: doc.last4,
    expMonth: doc.expMonth,
    expYear: doc.expYear,
    holderName: doc.holderName,
    isDefault: doc.isDefault,
  };
}

function formatCardPayment(doc, order) {
  return {
    id: doc._id,
    purpose: doc.purpose,
    amount: doc.amount,
    currency: doc.currency,
    status: doc.status,
    paidAt: doc.paidAt,
    order: order ? formatRestaurantOrder(order) : undefined,
  };
}

async function tokenizeCard({ userId, holderName, number, expMonth, expYear, cvv }) {
  const pan = digitsOnly(number);
  const code = digitsOnly(cvv);
  const month = Number(expMonth);
  const year = Number(expYear);
  const name = String(holderName || '').trim();

  if (name.length < 3) {
    const err = new Error('Escribe el nombre del titular');
    err.status = 400;
    throw err;
  }
  if (pan.length < 13 || pan.length > 19 || !luhnOk(pan)) {
    const err = new Error('Número de tarjeta inválido');
    err.status = 400;
    throw err;
  }
  if (!month || month < 1 || month > 12 || !year || year < 2000) {
    const err = new Error('Fecha de vencimiento inválida');
    err.status = 400;
    throw err;
  }
  const now = new Date();
  const expired =
    year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);
  if (expired) {
    const err = new Error('La tarjeta está vencida');
    err.status = 400;
    throw err;
  }
  if (code.length < 3 || code.length > 4) {
    const err = new Error('CVV inválido');
    err.status = 400;
    throw err;
  }

  const existingCount = await SavedPaymentMethod.countDocuments({ userId });
  const method = await SavedPaymentMethod.create({
    userId,
    token: `tok_${crypto.randomBytes(18).toString('hex')}`,
    brand: detectBrand(pan),
    last4: pan.slice(-4),
    expMonth: month,
    expYear: year,
    holderName: name,
    isDefault: existingCount === 0,
  });

  return formatSavedCard(method);
}

async function listSavedCards(userId) {
  const cards = await SavedPaymentMethod.find({ userId }).sort({ isDefault: -1, createdAt: -1 });
  return cards.map(formatSavedCard);
}

async function assertOwnedCard(userId, cardId) {
  const card = await SavedPaymentMethod.findOne({ _id: cardId, userId });
  if (!card) {
    const err = new Error('Selecciona una tarjeta guardada');
    err.status = 400;
    throw err;
  }
  return card;
}

async function confirmCardPayment({ paymentId, amount, externalRef, approved = true }) {
  const charge = await CardPayment.findById(paymentId);
  if (!charge) {
    const err = new Error('Pago no encontrado');
    err.status = 404;
    throw err;
  }

  if (charge.status === 'paid') {
    let order = null;
    if (charge.restaurantOrderId) {
      order = await RestaurantOrder.findById(charge.restaurantOrderId);
    }
    return { payment: formatCardPayment(charge, order), alreadyConfirmed: true };
  }

  if (!approved) {
    charge.status = 'failed';
    if (externalRef) charge.externalRef = String(externalRef);
    await charge.save();
    return { payment: formatCardPayment(charge), alreadyConfirmed: false };
  }

  if (amount != null && Math.round(Number(amount)) !== Math.round(Number(charge.amount))) {
    const err = new Error('El monto confirmado no coincide');
    err.status = 400;
    throw err;
  }

  let order = null;
  if (charge.purpose === 'restaurant') {
    const payload = charge.payload || {};
    order = await RestaurantOrder.create({
      ...payload,
      orderNumber: buildRestaurantOrderNumber(),
      status: 'pending',
    });
    charge.restaurantOrderId = order._id;
  }

  if (charge.purpose === 'administration') {
    const adminPayment = await Payment.findById(charge.administrationPaymentId);
    if (!adminPayment) {
      const err = new Error('Cuota de administración no encontrada');
      err.status = 404;
      throw err;
    }

    const { Organization } = require('../models');
    const org = await Organization.findById(adminPayment.organizationId);
    const billingSettings = getBillingSettings(org);
    const note = `tarjeta ${externalRef || charge._id}`.trim();
    let settledPayments = [];

    if (charge.payload?.settleOutstandingAdmin) {
      settledPayments = await settleAdministrationPayments({
        organizationId: adminPayment.organizationId,
        unitId: adminPayment.unitId,
        amount: charge.amount,
        billingSettings,
        notes: note,
      });
    } else if (adminPayment.status !== 'paid') {
      const enriched = enrichPayment(adminPayment, billingSettings);
      adminPayment.paidAmount = adminPayment.amount;
      adminPayment.interestAmount = enriched.interestAmount || 0;
      adminPayment.status = 'paid';
      adminPayment.paidAt = new Date();
      adminPayment.notes = `${adminPayment.notes || ''} · ${note}`.trim();
      await adminPayment.save();
      settledPayments = [adminPayment];
      const { refreshUnitAdminStatus } = require('./administrationCharges');
      await refreshUnitAdminStatus(adminPayment.unitId, adminPayment.organizationId);
    }

    if (settledPayments.length) {
      try {
        const { syncPaidPayments } = require('./accounting');
        await syncPaidPayments(settledPayments);
      } catch (err) {
        console.error('No se pudo enviar el pago al software contable:', err.message);
      }
    }
  }

  charge.status = 'paid';
  charge.paidAt = new Date();
  if (externalRef) charge.externalRef = String(externalRef);
  await charge.save();

  if (charge.purpose === 'administration') {
    const adminPayment = await Payment.findById(charge.administrationPaymentId).select(
      'organizationId'
    );
    const { pushResidentCardPaymentConfirmed } = require('./residentPush');
    pushResidentCardPaymentConfirmed({
      userId: charge.userId,
      organizationId: adminPayment?.organizationId,
      amount: charge.amount,
      purpose: charge.purpose,
    }).catch(() => {});
  }

  return { payment: formatCardPayment(charge, order), alreadyConfirmed: false };
}

async function startCardCharge({
  user,
  resident,
  cardId,
  purpose,
  amount,
  currency,
  payload,
  administrationPaymentId,
}) {
  const card = await assertOwnedCard(user._id, cardId);
  const charge = await CardPayment.create({
    userId: user._id,
    residentId: resident._id,
    methodId: card._id,
    purpose,
    amount,
    currency: currency || 'COP',
    status: 'awaiting_payment',
    administrationPaymentId,
    payload,
  });

  if (process.env.CARD_PAYMENTS_WAIT_WEBHOOK === 'true') {
    return { payment: formatCardPayment(charge), awaitingWebhook: true };
  }

  return confirmCardPayment({
    paymentId: charge._id,
    amount,
    externalRef: `local-${card.token.slice(0, 12)}`,
    approved: true,
  });
}

async function updatePayerName(userId, firstName, lastName) {
  const nextFirst = String(firstName || '').trim();
  const nextLast = String(lastName || '').trim();
  if (!nextFirst || !nextLast) return;
  await User.updateOne({ _id: userId }, { firstName: nextFirst, lastName: nextLast });
}

module.exports = {
  formatSavedCard,
  formatCardPayment,
  tokenizeCard,
  listSavedCards,
  confirmCardPayment,
  startCardCharge,
  updatePayerName,
};
