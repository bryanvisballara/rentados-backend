function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeWhatsappNumber(value) {
  const digits = digitsOnly(value);
  if (!digits) return '';
  // Si viene un celular colombiano de 10 dígitos (3xx…), antepone 57.
  if (digits.length === 10 && digits.startsWith('3')) return `57${digits}`;
  return digits;
}

function getContactSettings(org) {
  const contacts = org?.settings?.contacts || {};
  return {
    receptionWhatsapp: contacts.receptionWhatsapp || '',
    adminWhatsapp: contacts.adminWhatsapp || '',
  };
}

function buildWhatsappUrl(phone, message) {
  const normalized = normalizeWhatsappNumber(phone);
  if (!normalized) return null;
  const base = `https://wa.me/${normalized}`;
  if (!message) return base;
  return `${base}?text=${encodeURIComponent(message)}`;
}

module.exports = {
  digitsOnly,
  normalizeWhatsappNumber,
  getContactSettings,
  buildWhatsappUrl,
};
