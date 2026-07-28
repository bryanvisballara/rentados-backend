const {
  parseMoney,
  parseDateFlexible,
  extractNicFromText,
  extractDefrFromSubject,
  parseAirEEmailPayload,
  parseAirEXml,
  parseZipAttachment,
} = require('./airEBillEmail');
const { extractTextFromPdfBuffer, normalizeAccountCode } = require('./pdfTextExtract');

const UTILITY_EMAIL_PROVIDERS = [
  {
    slug: 'aire-energia',
    label: 'Air-e',
    serviceType: 'energy',
    accountCodeLabel: 'NIC',
    match: (from, subject, body) =>
      /air-?e\.com/i.test(from) || /air-?e/i.test(subject) || /\bDEFR\d+/i.test(subject),
    searchQuery: ({ newerThanDays = 120 } = {}) =>
      [
        'from:(entrega.de.factura.AIR-E@air-e.com OR air-e.com)',
        '(subject:Air-e OR subject:AIR-E OR subject:DEFR)',
        'has:attachment',
        `newer_than:${newerThanDays}d`,
      ].join(' '),
    parseEmail: (ctx) => {
      const parsed = parseAirEEmailPayload(ctx);
      return {
        providerSlug: 'aire-energia',
        accountCode: parsed.nic,
        amount: parsed.amount,
        dueDate: parsed.dueDate,
        issuedAt: parsed.issuedAt,
        period: parsed.period,
        externalBillId: parsed.defr || parsed.idCobro,
        pdfBuffer: parsed.pdfBuffer,
        pdfFileName: parsed.pdfFileName,
        raw: parsed,
      };
    },
  },
  {
    slug: 'gases-del-caribe',
    label: 'Gases del Caribe',
    serviceType: 'gas',
    accountCodeLabel: 'Código de usuario',
    match: (from, subject, body) =>
      /gascaribe\.com/i.test(from) ||
      /gasesdelcaribe\.com/i.test(from) ||
      /gases?\s+del\s+caribe/i.test(`${from} ${subject}`) ||
      /gascaribe/i.test(`${from} ${subject} ${body || ''}`),
    searchQuery: ({ newerThanDays = 120 } = {}) =>
      [
        'from:(gascaribe.com OR gasesdelcaribe.com OR gasesdelcaribe.com.co)',
        '(factura OR gas OR gascaribe OR "gases del caribe")',
        'has:attachment',
        `newer_than:${newerThanDays}d`,
      ].join(' '),
    parseEmail: (ctx) => parseGasesDelCaribeEmail(ctx),
  },
];

function extractContractCode(text) {
  if (!text) return null;
  const patterns = [
    /(?:n[uú]mero\s+de\s+)?contrato\s*[:#-]?\s*([\d.\s-]{5,20})/i,
    /(?:c[oó]digo\s+de\s+usuario|c[oó]digo\s+usuario|cuenta(?:\s+contrato)?|cliente|usuario)\s*[:#-]?\s*([\d.\s-]{5,20})/i,
    /\bNIC\s*[:#-]?\s*([\d.\s-]{5,20})\b/i,
    /(?:contrato|cuenta|cliente|usuario)[_\-](\d{5,14})/i,
    /factura[_\-]?(\d{5,14})/i,
  ];
  for (const pattern of patterns) {
    const m = String(text).match(pattern);
    if (m?.[1]) {
      const digits = normalizeAccountCode(m[1]);
      if (digits.length >= 5 && digits.length <= 14) return digits;
    }
  }
  return null;
}

function extractAmountFromText(text) {
  if (!text) return null;
  const labeled = String(text).match(
    /(?:total\s*a\s*pagar|valor\s*a\s*pagar|total\s*factura|importe|pago)\s*[:\-]?\s*\$?\s*([\d.,]+)/i
  );
  if (labeled?.[1]) {
    const n = parseMoney(labeled[1]);
    if (n != null && n > 0) return n;
  }
  const moneyMatches = [...String(text).matchAll(/\$\s*([\d]{1,3}(?:\.\d{3})+(?:,\d{2})?|\d+[.,]\d{2}|\d{4,})/g)];
  const amounts = moneyMatches
    .map((m) => parseMoney(m[1]))
    .filter((n) => n != null && n >= 1000);
  if (!amounts.length) return null;
  return Math.max(...amounts);
}

function extractDueDateFromText(text) {
  if (!text) return null;
  const labeled = String(text).match(
    /(?:vence|vencimiento|fecha\s*oportuna(?:\s*de\s*pago)?|pagar\s*antes\s*del?)\s*[:\-]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{4}-\d{2}-\d{2})/i
  );
  if (labeled?.[1]) return parseDateFlexible(labeled[1]);
  return null;
}

async function parseGasesDelCaribeEmail({
  subject,
  bodyText = '',
  attachmentName,
  attachmentBuffer,
  attachmentMime,
  pdfText: pdfTextHint = '',
}) {
  const blob = [subject, bodyText, attachmentName].filter(Boolean).join('\n');
  let accountCode = extractContractCode(blob);
  let amount = extractAmountFromText(blob);
  let dueDate = extractDueDateFromText(blob);
  let issuedAt = null;
  let period = null;
  let pdfBuffer = null;
  let pdfFileName = null;
  let externalBillId = null;
  let source = 'email_meta';

  const name = String(attachmentName || '').toLowerCase();
  const isZip =
    name.endsWith('.zip') ||
    attachmentMime === 'application/zip' ||
    attachmentMime === 'application/x-zip-compressed';

  if (isZip && attachmentBuffer?.length) {
    const fromZip = parseZipAttachment(attachmentBuffer);
    accountCode = normalizeAccountCode(fromZip.nic) || accountCode;
    amount = fromZip.amount || amount;
    dueDate = fromZip.dueDate || dueDate;
    issuedAt = fromZip.issuedAt || issuedAt;
    period = fromZip.period || period;
    pdfBuffer = fromZip.pdfBuffer;
    pdfFileName = fromZip.pdfFileName;
    externalBillId =
      (fromZip.xmlFileName || '').replace(/\.xml$/i, '') || fromZip.idCobro || null;
    source = 'zip';
  } else if (name.endsWith('.xml') && attachmentBuffer?.length) {
    const fromXml = parseAirEXml(attachmentBuffer.toString('utf8'));
    accountCode = normalizeAccountCode(fromXml.nic) || accountCode;
    amount = fromXml.amount || amount;
    dueDate = fromXml.dueDate || dueDate;
    issuedAt = fromXml.issuedAt || issuedAt;
    period = fromXml.period || period;
    source = 'xml';
  } else if (
    (name.endsWith('.pdf') || /pdf/i.test(String(attachmentMime || ''))) &&
    attachmentBuffer?.length
  ) {
    pdfBuffer = attachmentBuffer;
    pdfFileName = attachmentName;
    const pdfText = pdfTextHint || (await extractTextFromPdfBuffer(attachmentBuffer));
    accountCode = extractContractCode(`${blob}\n${pdfText}`) || accountCode;
    amount = extractAmountFromText(`${blob}\n${pdfText}`) || amount;
    dueDate = extractDueDateFromText(`${blob}\n${pdfText}`) || dueDate;
    source = 'pdf';
  }

  if (!externalBillId) {
    externalBillId =
      extractDefrFromSubject(subject) ||
      (accountCode && amount
        ? `gdc-${accountCode}-${amount}-${dueDate?.toISOString?.()?.slice(0, 10) || 'na'}`
        : null);
  }

  return {
    providerSlug: 'gases-del-caribe',
    accountCode,
    amount,
    dueDate,
    issuedAt,
    period,
    externalBillId,
    pdfBuffer,
    pdfFileName,
    raw: { source, subject, attachmentName },
  };
}

function gmailUtilityBillsSearchQuery({ newerThanDays = 180 } = {}) {
  // Remitentes conocidos; no exige filename:pdf (Gmail a veces no lo indexa igual).
  return [
    '(',
    'from:(air-e.com OR gascaribe.com OR gasesdelcaribe.com OR gasesdelcaribe.com.co)',
    'OR subject:(Air-e OR AIR-E OR DEFR OR gascaribe OR "gases del caribe" OR "Gases del Caribe")',
    ')',
    '(factura OR recibo OR DEFR OR gas OR Air-e OR AIR-E OR gascaribe OR attachment)',
    `newer_than:${newerThanDays}d`,
  ].join(' ');
}

function detectUtilityEmailProvider(from, subject, bodyText = '') {
  return (
    UTILITY_EMAIL_PROVIDERS.find((provider) => provider.match(from, subject, bodyText)) || null
  );
}

async function parseUtilityEmail(provider, ctx) {
  if (!provider?.parseEmail) return null;
  return provider.parseEmail(ctx);
}

module.exports = {
  UTILITY_EMAIL_PROVIDERS,
  gmailUtilityBillsSearchQuery,
  detectUtilityEmailProvider,
  parseUtilityEmail,
  parseGasesDelCaribeEmail,
  extractContractCode,
  extractAmountFromText,
  extractDueDateFromText,
  // re-export helpers used elsewhere
  parseMoney,
  parseDateFlexible,
  extractNicFromText,
};
