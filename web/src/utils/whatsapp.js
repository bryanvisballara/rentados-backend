export function normalizeWhatsappNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10 && digits.startsWith('3')) return `57${digits}`;
  return digits;
}

export function buildWhatsappUrl(phone, message) {
  const normalized = normalizeWhatsappNumber(phone);
  if (!normalized) return null;
  const base = `https://wa.me/${normalized}`;
  if (!message) return base;
  return `${base}?text=${encodeURIComponent(message)}`;
}
