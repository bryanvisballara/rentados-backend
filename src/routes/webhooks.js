const express = require('express');
const { UtilityProvider, UtilityBill, UtilityPayment } = require('../models');
const { handleGmailPubSubPush } = require('../utils/gmailUtilitySync');
const { confirmFacilityBookingPayment } = require('../utils/facilityBookingPayment');
const { confirmCardPayment } = require('../utils/cardPayments');

const router = express.Router();

/**
 * Confirmación de pago desde un proveedor (cuando exista integración).
 * POST /api/webhooks/utilities/:slug
 */
router.post('/utilities/:slug', async (req, res) => {
  try {
    const provider = await UtilityProvider.findOne({
      slug: String(req.params.slug).toLowerCase(),
      isActive: { $ne: false },
    });
    if (!provider) return res.status(404).json({ error: 'Proveedor no encontrado' });

    const externalBillId = req.body.externalBillId || req.body.billId;
    const accountCode = req.body.accountCode || req.body.nic || req.body.cupon;

    let bill = null;
    if (externalBillId) {
      bill = await UtilityBill.findOne({
        providerId: provider._id,
        externalBillId: String(externalBillId),
      });
    }

    if (!bill && accountCode) {
      bill = await UtilityBill.findOne({
        providerId: provider._id,
        status: { $in: ['pending', 'overdue'] },
      })
        .populate({
          path: 'accountId',
          match: { accountCode: String(accountCode).trim(), isActive: true },
        })
        .sort({ dueDate: 1 });

      if (bill && !bill.accountId) bill = null;
    }

    if (!bill) {
      return res.status(404).json({
        error: 'Factura no encontrada. Verifica accountCode / externalBillId.',
      });
    }

    if (bill.status !== 'paid') {
      bill.status = 'paid';
      bill.paidAt = req.body.paidAt ? new Date(req.body.paidAt) : new Date();
      await bill.save();

      await UtilityPayment.create({
        organizationId: bill.organizationId,
        residentId: bill.residentId,
        userId: bill.userId,
        accountId: bill.accountId._id || bill.accountId,
        billId: bill._id,
        providerId: bill.providerId,
        serviceType: bill.serviceType,
        amount: req.body.amount != null ? Number(req.body.amount) : bill.amount,
        currency: bill.currency,
        paidAt: bill.paidAt,
        source: 'webhook',
        externalRef: req.body.externalRef || req.body.reference,
        notes: 'Confirmado por webhook del proveedor',
      });
    }

    res.json({ ok: true, billId: bill._id, status: 'paid' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Confirmación de pago de reserva de servicio (pasarela / Wompi / manual integrado).
 * POST /api/v1/webhooks/facility-bookings/payment
 * Header opcional: x-webhook-secret (FACILITY_BOOKING_WEBHOOK_SECRET)
 */
router.post('/facility-bookings/payment', async (req, res) => {
  try {
    const secret = process.env.FACILITY_BOOKING_WEBHOOK_SECRET;
    if (secret && req.headers['x-webhook-secret'] !== secret) {
      return res.status(401).json({ error: 'Webhook no autorizado' });
    }

    const { bookingId, paymentReference, reference, amount, externalRef } = req.body;
    const result = await confirmFacilityBookingPayment({
      bookingId,
      paymentReference: paymentReference || reference,
      amount,
      externalRef,
    });

    res.json({
      ok: true,
      bookingId: result.booking._id,
      status: result.booking.status,
      alreadyConfirmed: result.alreadyConfirmed,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Push de Gmail via Google Cloud Pub/Sub.
 * Configura el topic en GMAIL_PUBSUB_TOPIC y una suscripción push a:
 * POST /api/v1/webhooks/gmail/pubsub
 */
router.post('/gmail/pubsub', async (req, res) => {
  try {
    const result = await handleGmailPubSubPush(req.body);
    res.status(204).send();
    if (result?.summary?.created) {
      console.log('Gmail push sync:', result.summary);
    }
  } catch (err) {
    console.error('Gmail Pub/Sub webhook error:', err.message);
    res.status(204).send();
  }
});

/**
 * Confirmación de cobro con tarjeta tokenizada (restaurante o administración).
 * POST /api/v1/webhooks/card-payments
 * Header opcional: x-webhook-secret (CARD_PAYMENT_WEBHOOK_SECRET)
 * Body: { paymentId, amount, externalRef, status: "approved" | "rejected" }
 */
router.post('/card-payments', async (req, res) => {
  try {
    const secret = process.env.CARD_PAYMENT_WEBHOOK_SECRET;
    if (secret && req.headers['x-webhook-secret'] !== secret) {
      return res.status(401).json({ error: 'Webhook no autorizado' });
    }

    const approved = String(req.body.status || 'approved').toLowerCase() !== 'rejected';
    const result = await confirmCardPayment({
      paymentId: req.body.paymentId || req.body.reference,
      amount: req.body.amount,
      externalRef: req.body.externalRef || req.body.transactionId,
      approved,
    });

    res.json({
      ok: true,
      status: result.payment.status,
      alreadyConfirmed: result.alreadyConfirmed,
      orderNumber: result.payment.order?.orderNumber,
    });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

module.exports = router;
