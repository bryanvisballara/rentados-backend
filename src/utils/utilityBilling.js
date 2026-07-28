const {
  UtilityProvider,
  ResidentUtilityAccount,
  UtilityBill,
  UtilityPayment,
  ResidentNotification,
  GmailConnection,
} = require('../models');
const { normalizeCity, serviceTypeLabel } = require('./utilityServices');

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function billPaymentStatus(bill) {
  if (!bill) return null;
  if (bill.status === 'paid' || bill.status === 'cancelled') return bill.status;
  if (bill.status === 'overdue') return 'overdue';
  if (bill.dueDate && new Date(bill.dueDate) < startOfToday()) return 'overdue';
  return 'pending';
}

/**
 * current = al día (verde)
 * on_time = por pagar, aún no vence (amarillo)
 * overdue = en mora (rojo)
 * unknown = aún no hay factura importada (gris)
 */
function resolveAccountStatus(pendingBills = [], { hasAnyBill = false } = {}) {
  const open = pendingBills.filter((b) => ['pending', 'overdue'].includes(billPaymentStatus(b)));
  if (open.some((b) => billPaymentStatus(b) === 'overdue')) {
    return {
      key: 'overdue',
      label: 'En mora',
      tone: 'danger',
    };
  }
  if (open.length > 0) {
    return {
      key: 'on_time',
      label: 'A tiempo',
      tone: 'warning',
    };
  }
  if (!hasAnyBill) {
    return {
      key: 'unknown',
      label: 'Sin factura',
      tone: 'neutral',
    };
  }
  return {
    key: 'current',
    label: 'Al día',
    tone: 'success',
  };
}

function formatProvider(provider) {
  const doc = provider?.toObject ? provider.toObject() : provider;
  if (!doc) return doc;
  return {
    id: doc._id,
    name: doc.name,
    slug: doc.slug,
    serviceType: doc.serviceType,
    serviceTypeLabel: serviceTypeLabel(doc.serviceType),
    cities: doc.cities || [],
    accountCodeLabel: doc.accountCodeLabel || 'Código de usuario',
    accountCodeHelp: doc.accountCodeHelp || '',
    websiteUrl: doc.websiteUrl || '',
    paymentUrl: doc.paymentUrl || '',
    integrationStatus: doc.integrationStatus || 'manual',
    integrationNotes: doc.integrationNotes || '',
    logoUrl: doc.logoUrl || '',
    sortOrder: doc.sortOrder || 0,
    isActive: doc.isActive !== false,
  };
}

function formatBill(bill) {
  const doc = bill?.toObject ? bill.toObject() : bill;
  if (!doc) return doc;
  const provider = doc.providerId?.name ? formatProvider(doc.providerId) : null;
  const effectiveStatus = billPaymentStatus(doc);
  return {
    id: doc._id,
    serviceType: doc.serviceType,
    serviceTypeLabel: serviceTypeLabel(doc.serviceType),
    period: doc.period,
    amount: doc.amount,
    currency: doc.currency || 'COP',
    dueDate: doc.dueDate,
    issuedAt: doc.issuedAt,
    status: effectiveStatus,
    paymentUrl: doc.paymentUrl || provider?.paymentUrl || '',
    documentUrl: doc.documentUrl || '',
    documentFileName: doc.documentFileName || '',
    notifiedAt: doc.notifiedAt,
    paidAt: doc.paidAt,
    provider,
    accountId: doc.accountId?._id || doc.accountId,
  };
}

function formatAccount(account, { bills = [] } = {}) {
  const doc = account?.toObject ? account.toObject() : account;
  if (!doc) return doc;
  const provider = doc.providerId?.name ? formatProvider(doc.providerId) : null;
  const accountId = String(doc._id);
  const related = bills.filter((b) => String(b.accountId?._id || b.accountId) === accountId);
  const open = related.filter((b) => ['pending', 'overdue'].includes(billPaymentStatus(b)));
  const latestOpen = open.sort((a, b) => {
    const da = a.dueDate ? new Date(a.dueDate).getTime() : 0;
    const db = b.dueDate ? new Date(b.dueDate).getTime() : 0;
    return da - db;
  })[0];
  const status = resolveAccountStatus(open, { hasAnyBill: related.length > 0 });
  const amountDue = open.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

  return {
    id: doc._id,
    serviceType: doc.serviceType,
    serviceTypeLabel: serviceTypeLabel(doc.serviceType),
    accountCode: doc.accountCode,
    accountCodeType: doc.accountCodeType || '',
    nickname: doc.nickname || '',
    linkedAt: doc.linkedAt,
    isActive: doc.isActive !== false,
    provider,
    status,
    amountDue,
    openBillsCount: open.length,
    billsCount: related.length,
    latestBill: latestOpen ? formatBill(latestOpen) : null,
  };
}

function formatPayment(payment) {
  const doc = payment?.toObject ? payment.toObject() : payment;
  if (!doc) return doc;
  const provider = doc.providerId?.name ? formatProvider(doc.providerId) : null;
  return {
    id: doc._id,
    serviceType: doc.serviceType,
    serviceTypeLabel: serviceTypeLabel(doc.serviceType),
    amount: doc.amount,
    currency: doc.currency || 'COP',
    paidAt: doc.paidAt,
    source: doc.source,
    externalRef: doc.externalRef || '',
    notes: doc.notes || '',
    provider,
    billId: doc.billId?._id || doc.billId,
  };
}

async function listProvidersForCity(city, { serviceType } = {}) {
  const cityKey = normalizeCity(city);
  const filter = { isActive: { $ne: false } };
  if (serviceType) filter.serviceType = serviceType;
  if (cityKey) filter.cityKeys = cityKey;

  return UtilityProvider.find(filter).sort({ sortOrder: 1, name: 1 });
}

async function syncOverdueBills({ residentId } = {}) {
  const filter = {
    status: 'pending',
    dueDate: { $lt: startOfToday() },
  };
  if (residentId) filter.residentId = residentId;
  await UtilityBill.updateMany(filter, { $set: { status: 'overdue' } });
}

async function linkResidentUtilityAccount(input, context) {
  const { resident, user, organization, building } = context;
  const provider = await UtilityProvider.findOne({
    _id: input.providerId,
    isActive: { $ne: false },
  });
  if (!provider) throw new Error('Proveedor no encontrado');

  const accountCode = String(input.accountCode || '').trim();
  if (!accountCode) throw new Error('Ingresa tu código con el proveedor');

  const cityKey = normalizeCity(building?.address?.city);
  if (cityKey && provider.cityKeys?.length && !provider.cityKeys.includes(cityKey)) {
    throw new Error('Este proveedor no aplica para la ciudad de tu conjunto');
  }

  const existing = await ResidentUtilityAccount.findOne({
    residentId: resident._id,
    providerId: provider._id,
  });

  if (existing) {
    existing.accountCode = accountCode;
    existing.accountCodeType = input.accountCodeType || provider.accountCodeLabel;
    existing.nickname = input.nickname || existing.nickname;
    existing.isActive = true;
    existing.linkedAt = new Date();
    await existing.save();
    await existing.populate('providerId');
    return formatAccount(existing);
  }

  const account = await ResidentUtilityAccount.create({
    organizationId: organization._id,
    buildingId: building._id,
    unitId: resident.unitId._id || resident.unitId,
    residentId: resident._id,
    userId: user._id,
    providerId: provider._id,
    serviceType: provider.serviceType,
    accountCode,
    accountCodeType: input.accountCodeType || provider.accountCodeLabel,
    nickname: input.nickname,
  });

  await account.populate('providerId');
  return formatAccount(account);
}

async function createUtilityBill(input, { notify = true } = {}) {
  const account = await ResidentUtilityAccount.findById(input.accountId).populate('providerId');
  if (!account || !account.isActive) throw new Error('Cuenta de servicio no encontrada');

  if (input.externalBillId) {
    const existing = await UtilityBill.findOne({
      accountId: account._id,
      externalBillId: input.externalBillId,
    }).populate('providerId');
    if (existing) return formatBill(existing);
  }

  const amount = Number(input.amount);
  const providerName = account.providerId?.name || serviceTypeLabel(account.serviceType);
  const dueLabel = input.dueDate
    ? new Date(input.dueDate).toLocaleDateString('es-CO', {
        day: 'numeric',
        month: 'long',
      })
    : null;

  const bill = await UtilityBill.create({
    organizationId: account.organizationId,
    buildingId: account.buildingId,
    residentId: account.residentId,
    userId: account.userId,
    accountId: account._id,
    providerId: account.providerId._id || account.providerId,
    serviceType: account.serviceType,
    period: input.period,
    amount,
    dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
    issuedAt: input.issuedAt ? new Date(input.issuedAt) : new Date(),
    status: input.status || 'pending',
    externalBillId: input.externalBillId,
    paymentUrl: input.paymentUrl || account.providerId?.paymentUrl,
    documentUrl: input.documentUrl,
    documentPublicId: input.documentPublicId,
    documentFileName: input.documentFileName,
    documentMimeType: input.documentMimeType || (input.documentUrl ? 'application/pdf' : undefined),
    rawPayload: input.rawPayload,
  });

  if (notify) {
    const amountLabel = `$${amount.toLocaleString('es-CO')}`;
    await ResidentNotification.create({
      organizationId: account.organizationId,
      userId: account.userId,
      type: 'utility_bill',
      title: `Llegó tu factura de ${providerName}`,
      body: dueLabel
        ? `Valor: ${amountLabel}. Vence el ${dueLabel}.`
        : `Valor: ${amountLabel}. Ábrela en Servicios públicos para pagar.`,
      read: false,
      meta: { billId: bill._id, serviceType: account.serviceType },
    });
    bill.notifiedAt = new Date();
    await bill.save();
  }

  await bill.populate('providerId');
  return formatBill(bill);
}

async function markUtilityBillPaid(billId, context, options = {}) {
  const bill = await UtilityBill.findOne({
    _id: billId,
    residentId: context.resident._id,
  });
  if (!bill) throw new Error('Factura no encontrada');
  if (bill.status === 'paid') {
    await bill.populate('providerId');
    return formatBill(bill);
  }

  bill.status = 'paid';
  bill.paidAt = new Date();
  await bill.save();

  await UtilityPayment.create({
    organizationId: bill.organizationId,
    residentId: bill.residentId,
    userId: context.user._id,
    accountId: bill.accountId,
    billId: bill._id,
    providerId: bill.providerId,
    serviceType: bill.serviceType,
    amount: bill.amount,
    currency: bill.currency,
    paidAt: bill.paidAt,
    source: options.source || 'manual',
    externalRef: options.externalRef,
    notes: options.notes,
  });

  await bill.populate('providerId');
  return formatBill(bill);
}

async function getAccountDetail(accountId, resident) {
  await syncOverdueBills({ residentId: resident._id });

  const account = await ResidentUtilityAccount.findOne({
    _id: accountId,
    residentId: resident._id,
    isActive: true,
  }).populate('providerId');
  if (!account) throw new Error('Cuenta no encontrada');

  const [bills, gmailConnection] = await Promise.all([
    UtilityBill.find({
      accountId: account._id,
      residentId: resident._id,
    })
      .populate('providerId')
      .sort({ dueDate: -1, createdAt: -1 })
      .limit(20),
    GmailConnection.findOne({
      userId: account.userId || resident.userId,
      isActive: true,
    }).select('googleEmail lastSyncAt isActive'),
  ]);

  const openBills = bills.filter((b) => ['pending', 'overdue'].includes(billPaymentStatus(b)));
  const formatted = formatAccount(account, { bills });
  const gmailConnected = Boolean(gmailConnection);

  return {
    account: formatted,
    openBills: openBills.map(formatBill),
    recentBills: bills.map(formatBill),
    lookup: buildProviderLookupHint(account, {
      gmailConnected,
      googleEmail: gmailConnection?.googleEmail || null,
    }),
    gmail: {
      connected: gmailConnected,
      googleEmail: gmailConnection?.googleEmail || null,
      lastSyncAt: gmailConnection?.lastSyncAt || null,
    },
  };
}

function buildProviderLookupHint(account, { gmailConnected = false, googleEmail = null } = {}) {
  const provider = account.providerId;
  const paymentUrl = provider?.paymentUrl || provider?.websiteUrl || '';
  const slug = provider?.slug || '';
  const emailHint = googleEmail ? ` (${googleEmail})` : '';

  if (slug === 'aire-energia' || /air-?e/i.test(provider?.name || '')) {
    return {
      mode: 'portal_manual',
      providerSlug: slug,
      paymentUrl: paymentUrl || 'https://portal.air-e.com/Pagar#/List',
      accountCode: account.accountCode,
      accountCodeLabel: provider?.accountCodeLabel || 'NIC',
      message: gmailConnected
        ? `Gmail ya está conectado${emailHint}. Usa “Buscar facturas ahora” en el Centro de Facturas (o Reintentar importación) para traer el recibo de Air-e. En air-e.com activa factura digital al mismo correo.`
        : 'Además del portal, conecta Gmail en el Centro de Facturas para que Rentados lea el correo de Air-e (ZIP/XML/PDF) y te avise con el valor y la fecha de vencimiento.',
      canAutoFetch: gmailConnected,
      gmailConnected,
    };
  }

  if (slug === 'gases-del-caribe' || /gases?\s+del\s+caribe|gascaribe/i.test(provider?.name || '')) {
    return {
      mode: 'portal_manual',
      providerSlug: slug,
      paymentUrl: paymentUrl || 'https://portal.gascaribe.com',
      accountCode: account.accountCode,
      accountCodeLabel: provider?.accountCodeLabel || 'Código / contrato',
      message: gmailConnected
        ? `Gmail ya está conectado${emailHint}. Las facturas de Gases del Caribe se importan desde ese correo: vuelve al inicio y pulsa “Reintentar importación”. En portal.gascaribe.com confirma que la factura digital llega al mismo Gmail.`
        : 'Conecta Gmail en el Centro de Facturas para detectar facturas de Gases del Caribe. Activa la factura digital en portal.gascaribe.com con el mismo correo.',
      canAutoFetch: gmailConnected,
      gmailConnected,
    };
  }

  return {
    mode: provider?.integrationStatus === 'api' ? 'api' : 'portal_manual',
    providerSlug: slug,
    paymentUrl,
    accountCode: account.accountCode,
    accountCodeLabel: provider?.accountCodeLabel || 'Código',
    message:
      provider?.integrationStatus === 'api'
        ? 'Consultando integración del proveedor…'
        : gmailConnected
          ? `Gmail ya está conectado${emailHint}. Si este proveedor envía factura por correo, usa “Buscar facturas ahora” en el inicio. También puedes pagar en su portal con tu código guardado.`
          : 'Este proveedor aún no tiene API conectada. Usa su portal de pagos con tu código guardado, o conecta Gmail en el Centro de Facturas si te envían el recibo por correo.',
    canAutoFetch: provider?.integrationStatus === 'api' || gmailConnected,
    gmailConnected,
  };
}

module.exports = {
  formatProvider,
  formatAccount,
  formatBill,
  formatPayment,
  listProvidersForCity,
  linkResidentUtilityAccount,
  createUtilityBill,
  markUtilityBillPaid,
  syncOverdueBills,
  getAccountDetail,
  resolveAccountStatus,
  billPaymentStatus,
  buildProviderLookupHint,
};
