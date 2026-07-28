const APP_TIMEZONE = 'America/Bogota';
const APP_LOCALE = 'es-CO';

function toDate(value) {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTimeCO(value, options = {}) {
  const date = toDate(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    dateStyle: 'short',
    timeStyle: 'short',
    ...options,
  }).format(date);
}

function formatDateCO(value, options = {}) {
  const date = toDate(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    dateStyle: 'short',
    ...options,
  }).format(date);
}

function formatTimeCO(value, options = {}) {
  const date = toDate(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  }).format(date);
}

/** YYYYMMDD en hora Colombia (p. ej. números de pedido). */
function getColombiaDateStamp(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(date)
    .replace(/-/g, '');
}

module.exports = {
  APP_TIMEZONE,
  APP_LOCALE,
  formatDateTimeCO,
  formatDateCO,
  formatTimeCO,
  getColombiaDateStamp,
  toDate,
};
