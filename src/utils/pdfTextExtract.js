/**
 * Extrae texto de un PDF (pdf-parse v2) con fallback heurístico.
 */
async function extractTextFromPdfBuffer(buffer) {
  if (!buffer?.length) return '';

  try {
    const { PDFParse } = require('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      const text = String(result?.text || '')
        .replace(/\u0000/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (text.length >= 20) return text.slice(0, 20000);
    } finally {
      await parser.destroy().catch(() => {});
    }
  } catch (err) {
    console.warn('pdf-parse extract:', err.message);
  }

  // Fallback: literales entre paréntesis en streams PDF
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

function normalizeAccountCode(value) {
  if (value == null) return '';
  return String(value).replace(/\D/g, '');
}

function accountCodesMatch(a, b) {
  const na = normalizeAccountCode(a);
  const nb = normalizeAccountCode(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Evita falsos positivos con códigos muy cortos
  if (na.length >= 5 && nb.length >= 5 && (na.endsWith(nb) || nb.endsWith(na))) {
    return true;
  }
  return false;
}

module.exports = {
  extractTextFromPdfBuffer,
  normalizeAccountCode,
  accountCodesMatch,
};
