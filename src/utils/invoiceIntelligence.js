const { parseMoney, parseDateFlexible } = require('./airEBillEmail');
const {
  UTILITY_EMAIL_PROVIDERS,
  detectUtilityEmailProvider,
  parseUtilityEmail,
  extractContractCode,
  extractAmountFromText,
  extractDueDateFromText,
  gmailUtilityBillsSearchQuery,
} = require('./utilityEmailProviders');
const {
  extractTextFromPdfBuffer,
  normalizeAccountCode,
  accountCodesMatch,
} = require('./pdfTextExtract');

const COMPANY_ALIASES = [
  { slug: 'aire-energia', keywords: ['air-e', 'air e', 'aire energia', 'aire'] },
  { slug: 'gases-del-caribe', keywords: ['gases del caribe', 'gascaribe', 'gas caribe'] },
  { slug: 'triple-a-agua', keywords: ['triple a', 'triplea', 'aaa', 'acueducto'] },
  { slug: 'ruitoque-energia', keywords: ['ruitoque'] },
  { slug: 'claro-internet', keywords: ['claro hogar', 'claro internet', 'claro tv'] },
  { slug: 'claro-movil', keywords: ['claro móvil', 'claro movil', 'claro celular'] },
  { slug: 'movistar-internet', keywords: ['movistar hogar', 'movistar internet', 'movistar tv'] },
  { slug: 'movistar-movil', keywords: ['movistar móvil', 'movistar movil', 'movistar celular'] },
  { slug: 'tigo-internet', keywords: ['tigo hogar', 'tigo internet', 'tigo une'] },
  { slug: 'tigo-movil', keywords: ['tigo móvil', 'tigo movil', 'tigo celular'] },
];

const INVOICE_HINT =
  /factura|invoice|recibo|cuenta\s*de\s*cobro|estado\s*de\s*cuenta|pago|vencimiento|total\s*a\s*pagar|defr|cup[oó]n|nic\b|contrato/i;

function isAiInvoiceConfigured() {
  return Boolean(String(process.env.OPENAI_API_KEY || '').trim());
}

function looksLikeInvoice({ from = '', subject = '', bodyText = '', fileName = '' } = {}) {
  const blob = `${from}\n${subject}\n${bodyText}\n${fileName}`;
  if (detectUtilityEmailProvider(from, subject, bodyText)) return true;
  if (INVOICE_HINT.test(blob)) return true;
  if (/\.pdf$/i.test(fileName) && /(factura|recibo|bill|invoice|cuenta)/i.test(fileName)) return true;
  return false;
}

function resolveProviderSlugFromCompany(companyName = '') {
  const normalized = String(companyName || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  if (!normalized) return null;

  const ranked = [...COMPANY_ALIASES].sort(
    (a, b) =>
      Math.max(...b.keywords.map((k) => k.length)) - Math.max(...a.keywords.map((k) => k.length))
  );

  for (const item of ranked) {
    if (item.keywords.some((keyword) => normalized.includes(keyword))) {
      return item.slug;
    }
  }

  if (/claro/.test(normalized)) return 'claro-internet';
  if (/movistar|telefonica/.test(normalized)) return 'movistar-internet';
  if (/tigo/.test(normalized)) return 'tigo-internet';
  return null;
}

function findLinkedAccountCodeInText(text, linkedAccounts = []) {
  const digits = normalizeAccountCode(text);
  if (!digits) return null;
  for (const account of linkedAccounts) {
    const code = normalizeAccountCode(account.accountCode);
    if (code && code.length >= 5 && digits.includes(code)) {
      return String(account.accountCode).replace(/\D/g, '') || code;
    }
  }
  return null;
}

function gmailSmartInvoiceSearchQuery({ newerThanDays = 180 } = {}) {
  return [
    '(',
    'has:attachment',
    'OR from:(air-e.com OR gascaribe.com OR gasesdelcaribe.com OR gasesdelcaribe.com.co)',
    ')',
    '(',
    'factura OR recibo OR invoice OR "total a pagar" OR vencimiento OR DEFR',
    'OR air-e OR aire OR gascaribe OR "gases del caribe" OR "triple a" OR aaa',
    'OR claro OR movistar OR tigo OR ruitoque',
    ')',
    `newer_than:${newerThanDays}d`,
  ].join(' ');
}

function gmailInvoiceSearchQueries({ newerThanDays = 180 } = {}) {
  return [
    gmailSmartInvoiceSearchQuery({ newerThanDays }),
    gmailUtilityBillsSearchQuery({ newerThanDays }),
  ];
}

async function analyzeInvoiceWithAi({
  subject,
  from,
  bodyText,
  fileName,
  pdfText,
  linkedAccounts = [],
}) {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) return null;

  const model = process.env.OPENAI_INVOICE_MODEL || 'gpt-4o-mini';
  const linkedSummary = linkedAccounts
    .map(
      (a) =>
        `${a.providerName || a.providerSlug}: código ${a.accountCode} (${a.serviceType || 'servicio'})`
    )
    .join('\n');

  const prompt = `Eres un extractor de facturas colombianas para la app Rentados.
Analiza el correo y el texto del PDF y responde SOLO JSON válido con esta forma:
{
  "isInvoice": boolean,
  "confidence": number,
  "companyName": string|null,
  "providerSlugHint": string|null,
  "accountCode": string|null,
  "amount": number|null,
  "currency": "COP"|null,
  "dueDate": "YYYY-MM-DD"|null,
  "issuedAt": "YYYY-MM-DD"|null,
  "period": string|null,
  "externalBillId": string|null,
  "notes": string|null
}

Reglas:
- amount en número entero COP sin puntos (ej. 185420).
- accountCode es NIC, contrato, cuenta o línea.
- providerSlugHint si puedes inferirlo: aire-energia, gases-del-caribe, triple-a-agua, claro-internet, claro-movil, movistar-internet, movistar-movil, tigo-internet, tigo-movil, ruitoque-energia.
- Si no es factura, isInvoice=false.
- Usa las cuentas vinculadas del residente si ayudan a decidir.

Cuentas vinculadas:
${linkedSummary || '(ninguna)'}

Remitente: ${from}
Asunto: ${subject}
Archivo: ${fileName}
Cuerpo:
${String(bodyText || '').slice(0, 3500)}

Texto PDF:
${String(pdfText || '').slice(0, 8000)}
`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Extraes datos de facturas y respondes solo JSON.' },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI invoice extract failed: ${response.status} ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(content);
  return {
    isInvoice: Boolean(parsed.isInvoice),
    confidence: Number(parsed.confidence) || 0,
    companyName: parsed.companyName || null,
    providerSlug:
      parsed.providerSlugHint ||
      resolveProviderSlugFromCompany(parsed.companyName) ||
      null,
    accountCode: parsed.accountCode ? String(parsed.accountCode).trim() : null,
    amount: parseMoney(parsed.amount),
    dueDate: parseDateFlexible(parsed.dueDate),
    issuedAt: parseDateFlexible(parsed.issuedAt),
    period: parsed.period || null,
    externalBillId: parsed.externalBillId || null,
    notes: parsed.notes || null,
    source: 'ai',
  };
}

function heuristicInvoiceExtract({ subject, bodyText, fileName, pdfText, linkedAccounts = [] }) {
  const blob = [subject, bodyText, fileName, pdfText].filter(Boolean).join('\n');
  const linkedCode = findLinkedAccountCodeInText(blob, linkedAccounts);
  return {
    isInvoice: looksLikeInvoice({ subject, bodyText, fileName }) || Boolean(linkedCode),
    confidence: linkedCode ? 0.55 : 0.45,
    companyName: null,
    providerSlug: null,
    accountCode: linkedCode || extractContractCode(blob),
    amount: extractAmountFromText(blob),
    dueDate: extractDueDateFromText(blob),
    issuedAt: null,
    period: null,
    externalBillId: null,
    notes: 'Extracción heurística sin IA',
    source: 'heuristic',
  };
}

/**
 * Pipeline del Centro Inteligente de Facturas:
 * 1) parsers conocidos (Air-e / Gascaribe)
 * 2) IA si hay API key
 * 3) heurística de texto
 */
async function analyzeInvoiceCandidate(ctx) {
  const {
    from,
    subject,
    bodyText,
    fileName,
    attachmentBuffer,
    attachmentMime,
    linkedAccounts = [],
  } = ctx;

  let pdfBuffer = null;
  let pdfFileName = fileName;
  let pdfText = '';
  const name = String(fileName || '').toLowerCase();
  const mime = String(attachmentMime || '').toLowerCase();

  if ((name.endsWith('.pdf') || mime.includes('pdf')) && attachmentBuffer?.length) {
    pdfBuffer = attachmentBuffer;
    pdfText = await extractTextFromPdfBuffer(attachmentBuffer);
  } else if (
    (name.endsWith('.zip') || mime.includes('zip')) &&
    attachmentBuffer?.length
  ) {
    try {
      const { parseZipAttachment } = require('./airEBillEmail');
      const zip = parseZipAttachment(attachmentBuffer);
      pdfBuffer = zip.pdfBuffer;
      pdfFileName = zip.pdfFileName || fileName;
      pdfText = await extractTextFromPdfBuffer(zip.pdfBuffer || Buffer.alloc(0));
      if (zip.amount && zip.nic) {
        return {
          isInvoice: true,
          confidence: 0.85,
          companyName: null,
          providerSlug: resolveProviderSlugFromCompany(subject) || null,
          accountCode: normalizeAccountCode(zip.nic) || zip.nic,
          amount: zip.amount,
          dueDate: zip.dueDate,
          issuedAt: zip.issuedAt,
          period: zip.period,
          externalBillId: zip.idCobro || (zip.xmlFileName || '').replace(/\.xml$/i, ''),
          pdfBuffer,
          pdfFileName,
          notes: 'ZIP/XML parse',
          source: 'zip',
        };
      }
    } catch {
      /* continue */
    }
  }

  const knownProvider = detectUtilityEmailProvider(from, subject, bodyText);
  let partialKnown = null;
  if (knownProvider) {
    const known = await parseUtilityEmail(knownProvider, {
      subject,
      bodyText,
      attachmentName: fileName,
      attachmentBuffer,
      attachmentMime,
      pdfText,
    });
    if (known?.amount && (known.accountCode || known.nic)) {
      return {
        isInvoice: true,
        confidence: 0.92,
        companyName: knownProvider.label,
        providerSlug: known.providerSlug || knownProvider.slug,
        accountCode: normalizeAccountCode(known.accountCode || known.nic) || known.accountCode,
        amount: known.amount,
        dueDate: known.dueDate,
        issuedAt: known.issuedAt,
        period: known.period,
        externalBillId: known.externalBillId || known.defr || known.idCobro,
        pdfBuffer: known.pdfBuffer || pdfBuffer || null,
        pdfFileName: known.pdfFileName || pdfFileName,
        notes: `Parser especializado ${knownProvider.label}`,
        source: 'provider_parser',
        raw: known.raw,
      };
    }
    if (known) {
      partialKnown = {
        companyName: knownProvider.label,
        providerSlug: known.providerSlug || knownProvider.slug,
        accountCode: known.accountCode || known.nic || null,
        amount: known.amount || null,
        dueDate: known.dueDate || null,
        issuedAt: known.issuedAt || null,
        period: known.period || null,
        externalBillId: known.externalBillId || known.defr || known.idCobro || null,
        pdfBuffer: known.pdfBuffer || pdfBuffer,
        pdfFileName: known.pdfFileName || pdfFileName,
      };
    }
  }

  if (!looksLikeInvoice({ from, subject, bodyText, fileName }) && !pdfText && !knownProvider) {
    return {
      isInvoice: false,
      confidence: 0.1,
      source: 'reject',
      notes: 'No parece factura',
    };
  }

  let aiResult = null;
  if (isAiInvoiceConfigured()) {
    try {
      aiResult = await analyzeInvoiceWithAi({
        subject,
        from,
        bodyText,
        fileName,
        pdfText: `${pdfText}\n${bodyText}`,
        linkedAccounts,
      });
    } catch (err) {
      console.warn('AI invoice extract:', err.message);
    }
  }

  const heuristic = heuristicInvoiceExtract({
    subject,
    bodyText,
    fileName,
    pdfText,
    linkedAccounts,
  });

  let accountCode =
    aiResult?.accountCode ||
    partialKnown?.accountCode ||
    heuristic.accountCode ||
    findLinkedAccountCodeInText(`${pdfText}\n${bodyText}\n${subject}`, linkedAccounts);

  if (accountCode) accountCode = normalizeAccountCode(accountCode) || accountCode;

  // Si el proveedor es conocido y hay una sola cuenta vinculada de ese proveedor, úsala.
  if (!accountCode && knownProvider) {
    const same = linkedAccounts.filter((a) => a.providerSlug === knownProvider.slug);
    if (same.length === 1) accountCode = normalizeAccountCode(same[0].accountCode);
  }

  const amount = aiResult?.amount || partialKnown?.amount || heuristic.amount;
  const merged = {
    isInvoice:
      Boolean(knownProvider) ||
      (aiResult?.isInvoice ?? heuristic.isInvoice) ||
      Boolean(amount && accountCode),
    confidence: aiResult?.confidence || (partialKnown ? 0.7 : heuristic.confidence),
    companyName: aiResult?.companyName || partialKnown?.companyName || knownProvider?.label || null,
    providerSlug:
      aiResult?.providerSlug ||
      partialKnown?.providerSlug ||
      knownProvider?.slug ||
      resolveProviderSlugFromCompany(aiResult?.companyName || subject),
    accountCode,
    amount,
    dueDate: aiResult?.dueDate || partialKnown?.dueDate || heuristic.dueDate,
    issuedAt: aiResult?.issuedAt || partialKnown?.issuedAt || heuristic.issuedAt,
    period: aiResult?.period || partialKnown?.period || heuristic.period,
    externalBillId:
      aiResult?.externalBillId || partialKnown?.externalBillId || heuristic.externalBillId,
    pdfBuffer: partialKnown?.pdfBuffer || pdfBuffer,
    pdfFileName: partialKnown?.pdfFileName || pdfFileName,
    source: aiResult ? 'ai' : partialKnown ? 'provider_partial' : heuristic.source,
    notes: aiResult?.notes || partialKnown?.notes || heuristic.notes,
  };

  return merged;
}

module.exports = {
  isAiInvoiceConfigured,
  looksLikeInvoice,
  resolveProviderSlugFromCompany,
  gmailSmartInvoiceSearchQuery,
  gmailInvoiceSearchQueries,
  analyzeInvoiceCandidate,
  analyzeInvoiceWithAi,
  COMPANY_ALIASES,
  UTILITY_EMAIL_PROVIDERS,
  accountCodesMatch,
  normalizeAccountCode,
};
