const WEEKDAYS = [
  { key: 'mon', label: 'Lunes' },
  { key: 'tue', label: 'Martes' },
  { key: 'wed', label: 'Miércoles' },
  { key: 'thu', label: 'Jueves' },
  { key: 'fri', label: 'Viernes' },
  { key: 'sat', label: 'Sábado' },
  { key: 'sun', label: 'Domingo' },
];

const DAY_KEYS = WEEKDAYS.map((d) => d.key);

function normalizeTime(value, fallback) {
  const raw = String(value || fallback || '09:00').trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback || '09:00';
  const h = Math.min(23, Math.max(0, Number(match[1])));
  const m = Math.min(59, Math.max(0, Number(match[2])));
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function defaultWeeklyHours() {
  return WEEKDAYS.map(({ key }) => ({
    day: key,
    enabled: false,
    start: '11:00',
    end: '22:00',
  }));
}

function normalizeWeeklyHours(input) {
  const byDay = new Map();
  if (Array.isArray(input)) {
    input.forEach((row) => {
      if (!row?.day || !DAY_KEYS.includes(row.day)) return;
      byDay.set(row.day, {
        day: row.day,
        enabled: Boolean(row.enabled),
        start: normalizeTime(row.start, '11:00'),
        end: normalizeTime(row.end, '22:00'),
      });
    });
  }

  return WEEKDAYS.map(({ key }) => {
    const row = byDay.get(key);
    return (
      row || {
        day: key,
        enabled: false,
        start: '11:00',
        end: '22:00',
      }
    );
  });
}

function formatWeeklyHoursSummary(weeklyHours) {
  const rows = normalizeWeeklyHours(weeklyHours).filter((r) => r.enabled);
  if (rows.length === 0) return '';

  const labelByKey = Object.fromEntries(WEEKDAYS.map((d) => [d.key, d.label]));
  const shortLabel = (key) => labelByKey[key]?.slice(0, 3) || key;

  const groups = [];
  let current = null;

  rows.forEach((row) => {
    const slot = `${row.start} – ${row.end}`;
    if (current && current.slot === slot) {
      current.endDay = row.day;
      current.endLabel = shortLabel(row.day);
    } else {
      if (current) groups.push(current);
      current = {
        startDay: row.day,
        endDay: row.day,
        startLabel: shortLabel(row.day),
        endLabel: shortLabel(row.day),
        slot,
      };
    }
  });
  if (current) groups.push(current);

  return groups
    .map((g) => {
      const days =
        g.startDay === g.endDay ? g.startLabel : `${g.startLabel}–${g.endLabel}`;
      return `${days} ${g.slot}`;
    })
    .join(' · ');
}

function syncOpeningHoursString(weeklyHours) {
  return formatWeeklyHoursSummary(weeklyHours);
}

module.exports = {
  WEEKDAYS,
  defaultWeeklyHours,
  normalizeWeeklyHours,
  formatWeeklyHoursSummary,
  syncOpeningHoursString,
};
