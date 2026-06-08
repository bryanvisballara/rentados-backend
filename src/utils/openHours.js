function parseTimeToMinutes(timeStr) {
  if (timeStr == null) return 0;
  if (timeStr instanceof Date) {
    return timeStr.getHours() * 60 + timeStr.getMinutes();
  }
  const raw = String(timeStr).trim();
  if (!raw) return 0;
  if (raw.includes('T')) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d.getHours() * 60 + d.getMinutes();
  }
  const [hours, minutes] = raw.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function formatHHmm(hours, minutes = 0) {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function normalizeOpenHours(openHours) {
  if (!openHours) {
    return { start: '08:00', end: '22:00' };
  }

  const startMin = parseTimeToMinutes(openHours.start);
  const endMin = parseTimeToMinutes(openHours.end);

  return {
    start: formatHHmm(Math.floor(startMin / 60), startMin % 60),
    end: formatHHmm(Math.floor(endMin / 60), endMin % 60),
  };
}

module.exports = { parseTimeToMinutes, normalizeOpenHours, formatHHmm };
