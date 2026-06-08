const { Unit, Payment, Resident, Facility } = require('../models');
const { getBillingSettings, enrichPayment } = require('./billing');
const { syncAutoSuspensions } = require('./autoSuspension');
const { releaseHeldLockerPackages } = require('./lockerPackage');

const VALID_CONCEPTS = ['administration', 'utilities', 'parking', 'fine', 'service', 'other'];

function isPaidFacility(facility) {
  if (!facility) return false;
  if (Number(facility.price) > 0) return true;

  const pricing = facility.bookingPricing || {};
  if (pricing.mode === 'hourly' && Number(pricing.hourlyRate) > 0) return true;
  if (pricing.mode === 'flat' && Number(pricing.flatPrice) > 0) return true;
  if (pricing.mode === 'blocks' && pricing.blocks?.some((b) => Number(b.price) > 0)) return true;

  return ['monthly', 'per_use', 'per_hour', 'per_block'].includes(facility.pricingType);
}

async function resolvePaymentConcept(input, organizationId) {
  let concept = String(input.concept || 'administration').trim().toLowerCase();
  let facilityId = input.facilityId || undefined;
  let conceptLabel = input.conceptLabel?.trim() || undefined;

  if (concept.startsWith('service:')) {
    facilityId = concept.replace('service:', '');
    concept = 'service';
  }

  if (concept === 'service') {
    if (!facilityId) throw new Error('Selecciona un servicio de pago');
    const facility = await Facility.findOne({ _id: facilityId, organizationId });
    if (!facility) throw new Error('Servicio no encontrado');
    if (!isPaidFacility(facility)) throw new Error('El servicio seleccionado no es de pago');
    conceptLabel = facility.name;
    return { concept: 'service', facilityId: facility._id, conceptLabel };
  }

  if (concept === 'other') {
    if (!conceptLabel) throw new Error('Escribe el concepto del pago');
    return { concept: 'other', facilityId: undefined, conceptLabel };
  }

  if (!VALID_CONCEPTS.includes(concept)) {
    return { concept: 'other', facilityId: undefined, conceptLabel: conceptLabel || input.concept };
  }

  return { concept, facilityId: undefined, conceptLabel: undefined };
}

function currentPeriod(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

async function refreshUnitBillingStatus(unitId, organizationId) {
  const overdueCount = await Payment.countDocuments({
    unitId,
    organizationId,
    status: 'overdue',
  });
  const pendingCount = await Payment.countDocuments({
    unitId,
    organizationId,
    status: { $in: ['pending', 'partial'] },
  });

  let adminStatus = 'current';
  if (overdueCount > 0) adminStatus = 'overdue';
  else if (pendingCount > 0) adminStatus = 'pending';

  await Unit.findByIdAndUpdate(unitId, { adminStatus });
}

async function registerPayment(input, context) {
  const { organization, userId } = context;
  if (!organization) throw new Error('No hay conjunto configurado');

  const amount = Math.round(Number(input.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('El monto debe ser mayor a cero');
  }

  const resident = await Resident.findOne({
    _id: input.residentId,
    organizationId: organization._id,
  }).populate('unitId');

  if (!resident) throw new Error('Residente no encontrado');

  const { concept, facilityId, conceptLabel } = await resolvePaymentConcept(input, organization._id);
  const notes = input.notes?.trim() || undefined;
  const now = new Date();
  const paymentPeriod = input.period || currentPeriod(now);
  const billingSettings = getBillingSettings(organization);

  let remaining = amount;
  const affectedPayments = [];

  const openPayments = await Payment.find({
    organizationId: organization._id,
    unitId: resident.unitId._id,
    status: { $in: ['pending', 'overdue', 'partial'] },
  }).sort({ dueDate: 1 });

  for (const open of openPayments) {
    if (remaining <= 0) break;

    const owed = open.amount - (open.paidAmount || 0);
    if (owed <= 0) continue;

    const applied = Math.min(remaining, owed);
    open.paidAmount = (open.paidAmount || 0) + applied;
    remaining -= applied;

    if (open.paidAmount >= open.amount) {
      open.status = 'paid';
      open.paidAt = now;
    } else {
      open.status = 'partial';
    }

    if (notes) open.notes = notes;
    await open.save();
    affectedPayments.push(open);
  }

  if (remaining > 0 || affectedPayments.length === 0) {
    const recordAmount = remaining > 0 ? remaining : amount;
    const created = await Payment.create({
      organizationId: organization._id,
      unitId: resident.unitId._id,
      residentId: resident._id,
      concept,
      facilityId,
      conceptLabel,
      period: paymentPeriod,
      amount: recordAmount,
      paidAmount: recordAmount,
      dueDate: now,
      paidAt: now,
      status: 'paid',
      notes,
    });
    affectedPayments.push(created);
  }

  await refreshUnitBillingStatus(resident.unitId._id, organization._id);

  const updatedUnit = await Unit.findById(resident.unitId._id);
  if (updatedUnit?.adminStatus !== 'overdue') {
    await releaseHeldLockerPackages(resident.unitId._id, organization);
  }

  let syncResult = null;
  if (billingSettings.autoSuspension?.enabled) {
    syncResult = await syncAutoSuspensions(organization, { userId });
  }

  const payments = affectedPayments.map((p) => enrichPayment(p, billingSettings));

  return {
    payment: payments[payments.length - 1],
    payments,
    syncResult,
  };
}

module.exports = {
  VALID_CONCEPTS,
  isPaidFacility,
  resolvePaymentConcept,
  currentPeriod,
  refreshUnitBillingStatus,
  registerPayment,
};
