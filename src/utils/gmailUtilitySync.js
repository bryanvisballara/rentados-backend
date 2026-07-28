const jwt = require('jsonwebtoken');
const {
  GmailConnection,
  UtilityProvider,
  ResidentUtilityAccount,
  UtilityBill,
  Resident,
  User,
} = require('../models');
const { encryptSecret, decryptSecret } = require('./tokenCrypto');
const {
  isGmailOAuthConfigured,
  buildGmailAuthUrl,
  exchangeCodeForTokens,
  gmailClientFromRefreshToken,
  getWebAppUrl,
} = require('./gmailOAuth');
const { gmailSmartInvoiceSearchQuery, analyzeInvoiceCandidate, isAiInvoiceConfigured } = require('./invoiceIntelligence');
const { createUtilityBill } = require('./utilityBilling');
const { uploadUtilityBillPdf } = require('./utilityBillMedia');

function isGmailPushConfigured() {
  return Boolean(process.env.GMAIL_PUBSUB_TOPIC);
}

function signGmailOAuthState(payload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET no está definida');
  return jwt.sign({ ...payload, purpose: 'gmail_oauth' }, secret, { expiresIn: '15m' });
}

function verifyGmailOAuthState(state) {
  const secret = process.env.JWT_SECRET;
  const payload = jwt.verify(state, secret);
  if (payload.purpose !== 'gmail_oauth') throw new Error('Estado OAuth inválido');
  return payload;
}

function formatGmailStatus(connection) {
  if (!connection) {
    return {
      connected: false,
      configured: isGmailOAuthConfigured(),
      pushConfigured: isGmailPushConfigured(),
      aiConfigured: isAiInvoiceConfigured(),
      googleEmail: null,
      lastSyncAt: null,
      lastSyncStatus: 'never',
      lastSyncSummary: null,
      lastSyncError: null,
      pushEnabled: false,
      watchExpiration: null,
    };
  }
  return {
    connected: connection.isActive !== false,
    configured: isGmailOAuthConfigured(),
    pushConfigured: isGmailPushConfigured(),
    aiConfigured: isAiInvoiceConfigured(),
    googleEmail: connection.googleEmail,
    lastSyncAt: connection.lastSyncAt,
    lastSyncStatus: connection.lastSyncStatus,
    lastSyncSummary: connection.lastSyncSummary,
    lastSyncError: connection.lastSyncError,
    pushEnabled: Boolean(connection.pushEnabled && connection.watchExpiration),
    watchExpiration: connection.watchExpiration,
  };
}

async function startGmailConnect({ user, resident }) {
  if (!isGmailOAuthConfigured()) {
    throw new Error(
      'Gmail aún no está habilitado en este entorno. Configura GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GOOGLE_REDIRECT_URI.'
    );
  }
  const state = signGmailOAuthState({
    userId: user._id.toString(),
    residentId: resident._id.toString(),
  });
  return { authUrl: buildGmailAuthUrl(state), state };
}

async function ensureGmailWatch(connection, gmail) {
  if (!isGmailPushConfigured()) {
    connection.pushEnabled = false;
    connection.watchTopic = undefined;
    return connection;
  }

  const topicName = process.env.GMAIL_PUBSUB_TOPIC;
  const expiresSoon =
    !connection.watchExpiration ||
    new Date(connection.watchExpiration).getTime() < Date.now() + 24 * 60 * 60 * 1000;

  if (!expiresSoon && connection.pushEnabled && connection.watchTopic === topicName) {
    return connection;
  }

  const watch = await gmail.users.watch({
    userId: 'me',
    requestBody: {
      topicName,
      labelIds: ['INBOX'],
    },
  });

  connection.historyId = watch.data.historyId ? String(watch.data.historyId) : connection.historyId;
  connection.watchExpiration = watch.data.expiration
    ? new Date(Number(watch.data.expiration))
    : new Date(Date.now() + 6 * 24 * 60 * 60 * 1000);
  connection.watchTopic = topicName;
  connection.pushEnabled = true;
  await connection.save();
  return connection;
}

async function completeGmailConnect({ code, state }) {
  const payload = verifyGmailOAuthState(state);
  const tokens = await exchangeCodeForTokens(code);

  const existing = await GmailConnection.findOne({ userId: payload.userId });
  const refreshToken =
    tokens.refresh_token ||
    (existing?.refreshTokenEnc ? decryptSecret(existing.refreshTokenEnc) : null);

  if (!refreshToken || refreshToken === 'revoked') {
    throw new Error(
      'Google no devolvió refresh_token. En https://myaccount.google.com/permissions revoca el acceso de Rentados e intenta conectar de nuevo.'
    );
  }

  const gmail = gmailClientFromRefreshToken(refreshToken);
  const profile = await gmail.users.getProfile({ userId: 'me' });
  const googleEmail = profile.data.emailAddress;

  let connection = await GmailConnection.findOneAndUpdate(
    { userId: payload.userId },
    {
      $set: {
        userId: payload.userId,
        residentId: payload.residentId,
        googleEmail,
        refreshTokenEnc: encryptSecret(refreshToken),
        accessTokenEnc: tokens.access_token ? encryptSecret(tokens.access_token) : undefined,
        accessTokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        scope: tokens.scope,
        isActive: true,
        lastSyncError: null,
        historyId: profile.data.historyId ? String(profile.data.historyId) : undefined,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  try {
    connection = await ensureGmailWatch(connection, gmail);
  } catch (err) {
    connection.lastSyncError = `Watch Pub/Sub: ${err.message}`;
    connection.pushEnabled = false;
    await connection.save();
  }

  return {
    connection: formatGmailStatus(connection),
    redirectUrl: `${getWebAppUrl()}/app/servicios-publicos?gmail=connected`,
  };
}

async function disconnectGmail(userId) {
  const connection = await GmailConnection.findOne({ userId, isActive: true });
  if (connection) {
    try {
      const refreshToken = decryptSecret(connection.refreshTokenEnc);
      if (refreshToken && refreshToken !== 'revoked') {
        const gmail = gmailClientFromRefreshToken(refreshToken);
        await gmail.users.stop({ userId: 'me' }).catch(() => {});
      }
    } catch {
      /* ignore */
    }
    connection.isActive = false;
    connection.pushEnabled = false;
    connection.refreshTokenEnc = encryptSecret('revoked');
    await connection.save();
  }
  return { ok: true };
}

function decodeGmailBodyData(data) {
  if (!data) return Buffer.alloc(0);
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64');
}

async function downloadAttachment(gmail, messageId, attachmentId) {
  const res = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId,
    id: attachmentId,
  });
  return decodeGmailBodyData(res.data.data);
}

function flattenParts(payload, out = []) {
  if (!payload) return out;
  if (payload.filename || payload.body?.attachmentId) out.push(payload);
  (payload.parts || []).forEach((part) => flattenParts(part, out));
  return out;
}

async function findProviderBySlug(slug) {
  return UtilityProvider.findOne({
    slug,
    isActive: { $ne: false },
  });
}

async function matchAccountForCode({ residentId, userId, accountCode, providerId }) {
  if (!accountCode) return null;
  return ResidentUtilityAccount.findOne({
    residentId,
    userId,
    providerId,
    isActive: true,
    accountCode: String(accountCode).trim(),
  });
}

async function ingestParsedBill({ resident, user, messageId, subject, parsed, linkedAccounts = [] }) {
  if (!parsed?.isInvoice && parsed?.source === 'reject') {
    return { status: 'skipped', reason: 'No parece una factura' };
  }

  const accountCode = parsed.accountCode || parsed.nic;
  let providerSlug = parsed.providerSlug || null;
  let provider = providerSlug ? await findProviderBySlug(providerSlug) : null;

  // Si hay código, intenta casar con cuentas vinculadas aunque el slug venga incompleto.
  let account = null;
  if (accountCode) {
    if (provider) {
      account = await matchAccountForCode({
        residentId: resident._id,
        userId: user._id,
        accountCode,
        providerId: provider._id,
      });
    }
    if (!account) {
      const codeMatches = linkedAccounts.filter(
        (item) => String(item.accountCode).trim() === String(accountCode).trim()
      );
      if (codeMatches.length === 1) {
        account = await ResidentUtilityAccount.findById(codeMatches[0].id).populate('providerId');
        provider = account?.providerId || provider;
        providerSlug = provider?.slug || providerSlug;
      }
    }
  }

  // Una sola cuenta vinculada del proveedor detectado.
  if (!account && provider) {
    const sameProvider = linkedAccounts.filter((item) => item.providerSlug === provider.slug);
    if (sameProvider.length === 1 && accountCode && sameProvider[0].accountCode === accountCode) {
      account = await ResidentUtilityAccount.findById(sameProvider[0].id).populate('providerId');
    }
  }

  if (!provider) {
    return {
      status: 'skipped',
      reason: parsed.companyName
        ? `Detectamos factura de ${parsed.companyName}, pero aún no hay proveedor/cuenta vinculada`
        : 'No se pudo identificar la empresa de la factura',
    };
  }

  if (!accountCode) {
    return {
      status: 'skipped',
      reason: `No se pudo leer el ${provider.accountCodeLabel || 'código'} de la factura de ${provider.name}`,
    };
  }
  if (parsed.amount == null || Number(parsed.amount) <= 0) {
    return {
      status: 'skipped',
      reason: `${provider.name}: no se pudo leer el valor de la factura`,
    };
  }

  if (!account) {
    account = await matchAccountForCode({
      residentId: resident._id,
      userId: user._id,
      accountCode,
      providerId: provider._id,
    });
  }

  if (!account) {
    return {
      status: 'skipped',
      reason: `Factura de ${provider.name} (${provider.accountCodeLabel || 'código'} ${accountCode}) no coincide con tus cuentas vinculadas`,
    };
  }

  const externalBillId =
    parsed.externalBillId || parsed.defr || parsed.idCobro || `gmail:${messageId}`;

  const existing = await UtilityBill.findOne({
    accountId: account._id,
    externalBillId,
  });
  if (existing) {
    if (!existing.documentUrl && parsed.pdfBuffer?.length) {
      const uploaded = await uploadUtilityBillPdf(parsed.pdfBuffer, {
        organizationId: account.organizationId,
        fileName: parsed.pdfFileName,
        nic: accountCode,
      });
      if (uploaded) {
        existing.documentUrl = uploaded.url;
        existing.documentPublicId = uploaded.cloudinaryPublicId;
        existing.documentFileName = uploaded.fileName;
        existing.documentMimeType = uploaded.mimeType;
        await existing.save();
      }
    }
    return { status: 'skipped', reason: 'Factura ya registrada', billId: existing._id };
  }

  let document = null;
  if (parsed.pdfBuffer?.length) {
    try {
      document = await uploadUtilityBillPdf(parsed.pdfBuffer, {
        organizationId: account.organizationId,
        fileName: parsed.pdfFileName,
        nic: accountCode,
      });
    } catch (err) {
      console.warn('No se pudo guardar PDF de factura:', err.message);
    }
  }

  const bill = await createUtilityBill(
    {
      accountId: account._id,
      amount: parsed.amount,
      dueDate: parsed.dueDate,
      issuedAt: parsed.issuedAt || new Date(),
      period: parsed.period,
      externalBillId,
      paymentUrl: provider.paymentUrl || provider.websiteUrl,
      documentUrl: document?.url,
      documentPublicId: document?.cloudinaryPublicId,
      documentFileName: document?.fileName,
      documentMimeType: document?.mimeType,
      rawPayload: {
        source: 'smart_invoice_center',
        extractionSource: parsed.source,
        companyName: parsed.companyName,
        confidence: parsed.confidence,
        messageId,
        subject,
        notes: parsed.notes,
        parsed: {
          ...parsed,
          pdfBuffer: undefined,
        },
      },
    },
    { notify: true }
  );

  return { status: 'created', bill, provider: provider.name };
}

function extractBodyText(payload) {
  const parts = [];
  function walk(node) {
    if (!node) return;
    const mime = String(node.mimeType || '').toLowerCase();
    if ((mime === 'text/plain' || mime === 'text/html') && node.body?.data) {
      const decoded = Buffer.from(
        String(node.body.data).replace(/-/g, '+').replace(/_/g, '/'),
        'base64'
      ).toString('utf8');
      parts.push(decoded.replace(/<[^>]+>/g, ' '));
    }
    (node.parts || []).forEach(walk);
  }
  walk(payload);
  return parts.join('\n').slice(0, 20000);
}

async function loadLinkedAccounts(resident, user) {
  const accounts = await ResidentUtilityAccount.find({
    residentId: resident._id,
    userId: user._id,
    isActive: true,
  }).populate('providerId');

  return accounts.map((account) => ({
    id: account._id,
    accountCode: account.accountCode,
    serviceType: account.serviceType,
    providerSlug: account.providerId?.slug,
    providerName: account.providerId?.name,
  }));
}

async function processGmailMessage({ gmail, user, resident, messageId, processed, summary, linkedAccounts }) {
  if (processed.has(messageId)) {
    summary.skipped += 1;
    return;
  }

  const full = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });
  const headers = full.data.payload?.headers || [];
  const subject = headers.find((h) => h.name?.toLowerCase() === 'subject')?.value || '';
  const from = headers.find((h) => h.name?.toLowerCase() === 'from')?.value || '';
  const bodyText = extractBodyText(full.data.payload);
  const snippet = full.data.snippet || '';

  const parts = flattenParts(full.data.payload);
  const zipOrXmlOrPdf = parts.find((p) => {
    const name = (p.filename || '').toLowerCase();
    return name.endsWith('.zip') || name.endsWith('.xml') || name.endsWith('.pdf');
  });

  if (!zipOrXmlOrPdf?.body?.attachmentId) {
    summary.skipped += 1;
    processed.add(messageId);
    return;
  }

  const buffer = await downloadAttachment(gmail, messageId, zipOrXmlOrPdf.body.attachmentId);
  const analyzed = await analyzeInvoiceCandidate({
    from,
    subject,
    bodyText: `${bodyText}\n${snippet}`,
    fileName: zipOrXmlOrPdf.filename,
    attachmentBuffer: buffer,
    attachmentMime: zipOrXmlOrPdf.mimeType,
    linkedAccounts,
  });

  if (!analyzed?.isInvoice) {
    summary.skipped += 1;
    processed.add(messageId);
    return;
  }

  const result = await ingestParsedBill({
    resident,
    user,
    messageId,
    subject,
    parsed: analyzed,
    linkedAccounts,
  });

  if (result.status === 'created') {
    summary.created += 1;
    summary.imported = summary.imported || [];
    summary.imported.push(result.provider || analyzed.companyName || 'Factura');
  } else {
    summary.skipped += 1;
    if (result.reason) summary.errors.push({ messageId, reason: result.reason });
  }
  processed.add(messageId);
}

async function syncAirEBillsFromGmail({ user, resident, maxMessages = 30 } = {}) {
  const connection = await GmailConnection.findOne({ userId: user._id, isActive: true });
  if (!connection) {
    throw new Error('Conecta Gmail primero para el Centro Inteligente de Facturas');
  }

  const refreshToken = decryptSecret(connection.refreshTokenEnc);
  if (!refreshToken || refreshToken === 'revoked') {
    throw new Error('La conexión de Gmail expiró. Vuelve a conectar tu correo.');
  }

  const gmail = gmailClientFromRefreshToken(refreshToken);
  try {
    await ensureGmailWatch(connection, gmail);
  } catch (err) {
    connection.lastSyncError = `Watch Pub/Sub: ${err.message}`;
  }

  const linkedAccounts = await loadLinkedAccounts(resident, user);
  const list = await gmail.users.messages.list({
    userId: 'me',
    q: gmailSmartInvoiceSearchQuery(),
    maxResults: maxMessages,
  });

  const messages = list.data.messages || [];
  const summary = {
    scanned: messages.length,
    created: 0,
    skipped: 0,
    errors: [],
    imported: [],
    aiEnabled: isAiInvoiceConfigured(),
  };
  const processed = new Set(connection.processedMessageIds || []);

  for (const item of messages) {
    try {
      await processGmailMessage({
        gmail,
        user,
        resident,
        messageId: item.id,
        processed,
        summary,
        linkedAccounts,
      });
    } catch (err) {
      summary.skipped += 1;
      summary.errors.push({ messageId: item.id, reason: err.message });
    }
  }

  const profile = await gmail.users.getProfile({ userId: 'me' });
  connection.historyId = profile.data.historyId
    ? String(profile.data.historyId)
    : connection.historyId;
  connection.processedMessageIds = Array.from(processed).slice(-300);
  connection.lastSyncAt = new Date();
  connection.lastSyncStatus = summary.errors.length && summary.created === 0 ? 'partial' : 'ok';
  connection.lastSyncSummary = {
    scanned: summary.scanned,
    created: summary.created,
    skipped: summary.skipped,
  };
  if (!connection.lastSyncError?.startsWith('Watch Pub/Sub') || summary.created > 0) {
    connection.lastSyncError = summary.errors[0]?.reason || null;
  }
  await connection.save();

  return {
    connection: formatGmailStatus(connection),
    summary,
  };
}

async function handleGmailPubSubPush(body) {
  const encoded = body?.message?.data;
  if (!encoded) {
    return { ok: true, ignored: true, reason: 'Sin data' };
  }

  const decoded = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
  const emailAddress = String(decoded.emailAddress || '')
    .trim()
    .toLowerCase();
  if (!emailAddress) {
    return { ok: true, ignored: true, reason: 'Sin emailAddress' };
  }

  const connection = await GmailConnection.findOne({
    googleEmail: emailAddress,
    isActive: true,
  });
  if (!connection) {
    return { ok: true, ignored: true, reason: 'Sin conexión Gmail activa' };
  }

  if (decoded.historyId) {
    connection.historyId = String(decoded.historyId);
    await connection.save();
  }

  const user = await User.findById(connection.userId);
  const resident = await Resident.findById(connection.residentId).populate(
    'unitId',
    'number type tower adminStatus buildingId administrationFee'
  );
  if (!user || !resident) {
    return { ok: true, ignored: true, reason: 'Usuario/residente no encontrado' };
  }

  const result = await syncAirEBillsFromGmail({ user, resident, maxMessages: 10 });
  return { ok: true, push: true, summary: result.summary };
}

module.exports = {
  formatGmailStatus,
  startGmailConnect,
  completeGmailConnect,
  disconnectGmail,
  syncAirEBillsFromGmail,
  handleGmailPubSubPush,
  ensureGmailWatch,
  signGmailOAuthState,
  verifyGmailOAuthState,
  isGmailOAuthConfigured,
  isGmailPushConfigured,
};
