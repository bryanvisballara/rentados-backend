const { parseMoney, parseDateFlexible } = require('./airEBillEmail');
const {
  UTILITY_EMAIL_PROVIDERS,
  detectUtilityEmailProvider,
  parseUtilityEmail,
  extractContractCode,
  extractAmountFromText,
  extractDueDateFromText,
} = require('./utilityEmailProviders');

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

function extractTextFromPdfBuffer(buffer) {
  if (!buffer?.length) return '';
  const raw = buffer.toString('latin1');
  const chunks = [];
  for (const m of raw.matchAll(/\(([^)]{3,160})\)/g)) {
    const cleaned = m[1]
      .replace(/\\[nrt]/g, ' ')
      .replace(/[^\x20-\x7EÁÉÍÓÚÜáéíóúüñÑ\$.,:\-\/%\d]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned.length >= 3) chunks.push(cleaned);
  }
  return chunks.join('\n').slice(0, 12000);
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

  // Prefer longer/more specific aliases first
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

function gmailSmartInvoiceSearchQuery({ newerThanDays = 90 } = {}) {
  return [
    'has:attachment',
    '(filename:pdf OR filename:zip OR filename:xml)',
    '(',
    'factura OR recibo OR invoice OR "total a pagar" OR vencimiento OR DEFR',
    'OR air-e OR aire OR gascaribe OR "gases del caribe" OR "triple a" OR aaa',
    'OR claro OR movistar OR tigo OR ruitoque OR administracion OR seguro',
    ')',
    `newer_than:${newerThanDays}d`,
  ].join(' ');
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

function heuristicInvoiceExtract({ subject, bodyText, fileName, pdfText }) {
  const blob = [subject, bodyText, fileName, pdfText].filter(Boolean).join('\n');
  return {
    isInvoice: looksLikeInvoice({ subject, bodyText, fileName }),
    confidence: 0.45,
    companyName: null,
    providerSlug: null,
    accountCode: extractContractCode(blob),
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

  const knownProvider = detectUtilityEmailProvider(from, subject, bodyText);
  if (knownProvider) {
    const known = parseUtilityEmail(knownProvider, {
      subject,
      bodyText,
      attachmentName: fileName,
      attachmentBuffer,
      attachmentMime,
    });
    if (known?.amount && (known.accountCode || known.nic)) {
      return {
        isInvoice: true,
        confidence: 0.92,
        companyName: knownProvider.label,
        providerSlug: known.providerSlug || knownProvider.slug,
        accountCode: known.accountCode || known.nic,
        amount: known.amount,
        dueDate: known.dueDate,
        issuedAt: known.issuedAt,
        period: known.period,
        externalBillId: known.externalBillId || known.defr || known.idCobro,
        pdfBuffer: known.pdfBuffer || null,
        pdfFileName: known.pdfFileName || fileName,
        notes: `Parser especializado ${knownProvider.label}`,
        source: 'provider_parser',
        raw: known.raw,
      };
    }
  }

  let pdfBuffer = null;
  let pdfFileName = fileName;
  let pdfText = '';
  const name = String(fileName || '').toLowerCase();
  if (name.endsWith('.pdf') && attachmentBuffer?.length) {
    pdfBuffer = attachmentBuffer;
    pdfText = extractTextFromPdfBuffer(attachmentBuffer);
  } else if (name.endsWith('.zip') && attachmentBuffer?.length) {
    // Reuse known zip parse path via Air-e util if possible
    try {
      const { parseZipAttachment } = require('./airEBillEmail');
      const zip = parseZipAttachment(attachmentBuffer);
      pdfBuffer = zip.pdfBuffer;
      pdfFileName = zip.pdfFileName || fileName;
      pdfText = extractTextFromPdfBuffer(zip.pdfBuffer || Buffer.alloc(0));
      if (zip.amount && zip.nic) {
        return {
          isInvoice: true,
          confidence: 0.85,
          companyName: knownProvider?.label || null,
          providerSlug: knownProvider?.slug || resolveProviderSlugFromCompany(subject),
          accountCode: zip.nic,
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

  if (!looksLikeInvoice({ from, subject, bodyText, fileName }) && !pdfText) {
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

  const heuristic = heuristicInvoiceExtract({ subject, bodyText, fileName, pdfText });
  const merged = {
    ...heuristic,
    ...(aiResult || {}),
    isInvoice: aiResult?.isInvoice ?? heuristic.isInvoice,
    confidence: aiResult?.confidence || heuristic.confidence,
    providerSlug:
      aiResult?.providerSlug ||
      heuristic.providerSlug ||
      knownProvider?.slug ||
      resolveProviderSlugFromCompany(aiResult?.companyName || subject),
    accountCode: aiResult?.accountCode || heuristic.accountCode,
    amount: aiResult?.amount || heuristic.amount,
    dueDate: aiResult?.dueDate || heuristic.dueDate,
    issuedAt: aiResult?.issuedAt || heuristic.issuedAt,
    period: aiResult?.period || heuristic.period,
    externalBillId: aiResult?.externalBillId || heuristic.externalBillId,
    pdfBuffer,
    pdfFileName,
    companyName: aiResult?.companyName || knownProvider?.label || null,
    source: aiResult ? 'ai' : heuristic.source,
    notes: aiResult?.notes || heuristic.notes,
  };

  return merged;
}

module.exports = {
  isAiInvoiceConfigured,
  looksLikeInvoice,
  resolveProviderSlugFromCompany,
  gmailSmartInvoiceSearchQuery,
  analyzeInvoiceCandidate,
  analyzeInvoiceWithAi,
  COMPANY_ALIASES,
  UTILITY_EMAIL_PROVIDERS,
};
