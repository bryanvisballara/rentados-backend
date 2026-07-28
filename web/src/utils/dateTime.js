export const APP_TIMEZONE = 'America/Bogota';
export const APP_LOCALE = 'es-CO';

function toDate(value) {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(value, options = {}) {
  const date = toDate(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    dateStyle: 'short',
    timeStyle: 'short',
    ...options,
  }).format(date);
}

export function formatDate(value, options = {}) {
  const date = toDate(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    dateStyle: 'short',
    ...options,
  }).format(date);
}

export function formatTime(value, options = {}) {
  const date = toDate(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  }).format(date);
}
