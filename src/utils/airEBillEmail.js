const AdmZip = require('adm-zip');
const { XMLParser } = require('fast-xml-parser');

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  trimValues: true,
});

const AIR_E_SENDERS = [
  'entrega.de.factura.AIR-E@air-e.com',
  'entrega.de.factura.air-e@air-e.com',
  'air-e.com',
];

function gmailAirESearchQuery({ newerThanDays = 120 } = {}) {
  return [
    'from:(entrega.de.factura.AIR-E@air-e.com OR air-e.com)',
    '(subject:Air-e OR subject:AIR-E OR subject:DEFR)',
    'has:attachment',
    `newer_than:${newerThanDays}d`,
  ].join(' ');
}

function parseMoney(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = String(value).replace(/[^\d.,-]/g, '').trim();
  if (!raw) return null;
  // 472.150 or 472150,00 or 472150.00
  if (raw.includes(',') && raw.includes('.')) {
    const normalized = raw.replace(/\./g, '').replace(',', '.');
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }
  if (raw.includes(',') && !raw.includes('.')) {
    const n = Number(raw.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  // Colombian display often uses . as thousands: 472.150
  if (/^\d{1,3}(\.\d{3})+$/.test(raw)) {
    const n = Number(raw.replace(/\./g, ''));
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseDateFlexible(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const d = new Date(text);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const m = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    const d = new Date(year, month - 1, day);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? null : d;
}

function collectStrings(node, out = []) {
  if (node == null) return out;
  if (typeof node === 'string' || typeof node === 'number') {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    node.forEach((item) => collectStrings(item, out));
    return out;
  }
  if (typeof node === 'object') {
    if (node['#text'] != null) out.push(String(node['#text']));
    Object.values(node).forEach((value) => collectStrings(value, out));
  }
  return out;
}

function findFirstByKeys(node, keys) {
  if (!node || typeof node !== 'object') return null;
  for (const [key, value] of Object.entries(node)) {
    if (keys.some((k) => key.toLowerCase() === k.toLowerCase())) {
      if (value && typeof value === 'object' && value['#text'] != null) return value['#text'];
      return value;
    }
  }
  for (const value of Object.values(node)) {
    if (value && typeof value === 'object') {
      const found = findFirstByKeys(value, keys);
      if (found != null) return found;
    }
  }
  return null;
}

function extractNicFromText(text) {
  if (!text) return null;
  const patterns = [
    /Reguladas_NIC(\d+)/i,
    /\bNIC\s*[:#-]?\s*(\d{5,12})\b/i,
    /\bNIC(\d{5,12})\b/i,
  ];
  for (const pattern of patterns) {
    const m = String(text).match(pattern);
    if (m?.[1]) return m[1];
  }
  return null;
}

function extractDefrFromSubject(subject) {
  const parts = String(subject || '').split(';').map((p) => p.trim());
  const defr = parts.find((p) => /^DEFR\d+/i.test(p));
  if (defr) return defr.toUpperCase();
  const m = String(subject || '').match(/DEFR\d+/i);
  return m ? m[0].toUpperCase() : null;
}

function parseAirEXml(xmlText) {
  const parsed = xmlParser.parse(xmlText);
  const payableRaw =
    findFirstByKeys(parsed, ['PayableAmount', 'TotalInclTaxAmount', 'TaxInclusiveAmount']) ||
    findFirstByKeys(parsed, ['PayableAmount']);
  const amount = parseMoney(
    typeof payableRaw === 'object' ? payableRaw['#text'] ?? payableRaw : payableRaw
  );

  const dueRaw =
    findFirstByKeys(parsed, ['PaymentDueDate', 'DueDate', 'FechaOportunaPago']) ||
    findFirstByKeys(parsed, ['PaymentDueDate']);
  const issuedRaw = findFirstByKeys(parsed, ['IssueDate', 'IssueDateTime', 'FechaEmision']);

  const allText = collectStrings(parsed).join(' ');
  const nic =
    extractNicFromText(allText) ||
    extractNicFromText(String(findFirstByKeys(parsed, ['ID', 'AccountID', 'CustomerAssignedAccountID']) || ''));

  const period =
    findFirstByKeys(parsed, ['BillingPeriod', 'PeriodoFacturacion']) ||
    (issuedRaw ? String(issuedRaw).slice(0, 7) : null);

  return {
    amount,
    dueDate: parseDateFlexible(typeof dueRaw === 'object' ? dueRaw['#text'] : dueRaw),
    issuedAt: parseDateFlexible(typeof issuedRaw === 'object' ? issuedRaw['#text'] : issuedRaw),
    nic,
    period: period ? String(period) : null,
    rawKeys: {
      payableRaw,
      dueRaw,
      issuedRaw,
    },
  };
}

function parseZipAttachment(buffer) {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  const xmlEntry = entries.find((e) => /\.xml$/i.test(e.entryName) && !e.isDirectory);
  const pdfEntry = entries.find((e) => /\.pdf$/i.test(e.entryName) && !e.isDirectory);

  let fromXml = null;
  if (xmlEntry) {
    fromXml = parseAirEXml(xmlEntry.getData().toString('utf8'));
  }

  const nicFromPdf = pdfEntry ? extractNicFromText(pdfEntry.entryName) : null;
  const idCobroFromPdf = pdfEntry
    ? (String(pdfEntry.entryName).match(/NIC\d+_(\d+)/i) || [])[1] || null
    : null;

  return {
    xmlFileName: xmlEntry?.entryName || null,
    pdfFileName: pdfEntry?.entryName || null,
    pdfBuffer: pdfEntry ? pdfEntry.getData() : null,
    nic: fromXml?.nic || nicFromPdf,
    amount: fromXml?.amount || null,
    dueDate: fromXml?.dueDate || null,
    issuedAt: fromXml?.issuedAt || null,
    period: fromXml?.period || null,
    idCobro: idCobroFromPdf,
    xml: fromXml,
  };
}

function parseAirEEmailPayload({ subject, attachmentName, attachmentBuffer, attachmentMime }) {
  const defr = extractDefrFromSubject(subject);
  let parsed = {
    nic: extractNicFromText(attachmentName) || extractNicFromText(subject),
    amount: null,
    dueDate: null,
    issuedAt: null,
    period: null,
    idCobro: null,
    defr,
    source: 'email_meta',
  };

  const name = String(attachmentName || '').toLowerCase();
  const isZip =
    name.endsWith('.zip') ||
    attachmentMime === 'application/zip' ||
    attachmentMime === 'application/x-zip-compressed';

  if (isZip && attachmentBuffer?.length) {
    const fromZip = parseZipAttachment(attachmentBuffer);
    parsed = {
      ...parsed,
      ...fromZip,
      nic: fromZip.nic || parsed.nic,
      amount: fromZip.amount || parsed.amount,
      dueDate: fromZip.dueDate || parsed.dueDate,
      issuedAt: fromZip.issuedAt || parsed.issuedAt,
      period: fromZip.period || parsed.period,
      pdfBuffer: fromZip.pdfBuffer || null,
      pdfFileName: fromZip.pdfFileName || null,
      defr: parsed.defr || (fromZip.xmlFileName || '').replace(/\.xml$/i, '').toUpperCase() || null,
      source: 'zip',
    };
  } else if (name.endsWith('.xml') && attachmentBuffer?.length) {
    const fromXml = parseAirEXml(attachmentBuffer.toString('utf8'));
    parsed = {
      ...parsed,
      ...fromXml,
      nic: fromXml.nic || parsed.nic,
      source: 'xml',
    };
  } else if (name.endsWith('.pdf') && attachmentBuffer?.length) {
    parsed = {
      ...parsed,
      pdfBuffer: attachmentBuffer,
      pdfFileName: attachmentName,
      nic: extractNicFromText(attachmentName) || parsed.nic,
      source: 'pdf',
    };
  }

  return parsed;
}

module.exports = {
  AIR_E_SENDERS,
  gmailAirESearchQuery,
  parseMoney,
  parseDateFlexible,
  extractNicFromText,
  extractDefrFromSubject,
  parseAirEXml,
  parseZipAttachment,
  parseAirEEmailPayload,
};
