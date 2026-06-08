export function parseTimeToMinutes(timeStr) {
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

export function formatHourLabel(hour) {
  return `${String(hour).padStart(2, '0')}:00`;
}

export function formatOpenHoursRange(openHours, open24Hours = false) {
  if (open24Hours) return '24 horas';
  if (!openHours?.start || !openHours?.end) return '—';
  const crossesMidnight = parseTimeToMinutes(openHours.end) <= parseTimeToMinutes(openHours.start);
  if (crossesMidnight && openHours.start === '00:00' && openHours.end === '00:00') return '24 horas';
  return `${openHours.start} – ${openHours.end}${crossesMidnight ? ' (hasta madrugada)' : ''}`;
}

/** Filas del calendario según hora apertura/cierre del administrador. */
export function buildOpenHourSlots(openHours = {}) {
  const startMin = parseTimeToMinutes(openHours.start || '08:00');
  let endMin = parseTimeToMinutes(openHours.end || '22:00');
  const crossesMidnight = endMin <= startMin;
  if (crossesMidnight) endMin += 24 * 60;

  const startHour = Math.floor(startMin / 60);
  const endHourExclusive = Math.ceil(endMin / 60);
  const slots = [];

  for (let h = startHour; h < endHourExclusive; h += 1) {
    slots.push({
      key: String(h),
      hour: ((h % 24) + 24) % 24,
      rowIndex: h - startHour,
    });
  }

  return {
    slots,
    crossesMidnight,
    startHour,
    startMin,
    endMin,
    endHourExclusive,
    rowCount: slots.length,
  };
}

export function slotToDate(day, slot, openHours) {
  const { crossesMidnight, startHour } = buildOpenHourSlots(openHours);
  const date = new Date(day);
  date.setHours(slot.hour, 0, 0, 0);
  if (crossesMidnight && slot.hour < startHour) {
    date.setDate(date.getDate() + 1);
  }
  return date;
}

function sameDay(a, b) {
  return a.toDateString() === b.toDateString();
}

/** Minutos desde el inicio del grid para posicionar eventos. */
export function eventGridPosition(eventStart, eventEnd, columnDay, openHours) {
  const grid = buildOpenHourSlots(openHours);
  const { startHour, endMin, crossesMidnight } = grid;
  const gridStartMin = startHour * 60;
  const closeMinOnClock = parseTimeToMinutes(openHours.end || '22:00');

  const toGridMinutes = (date, forColumnDay) => {
    let mins = date.getHours() * 60 + date.getMinutes();
    const dayDiff = Math.round(
      (new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() -
        new Date(forColumnDay.getFullYear(), forColumnDay.getMonth(), forColumnDay.getDate()).getTime()) /
        86400000
    );
    mins += dayDiff * 24 * 60;
    if (crossesMidnight && dayDiff === 1 && mins < closeMinOnClock) {
      return mins + 24 * 60 - gridStartMin;
    }
    if (dayDiff === 0) {
      return mins - gridStartMin;
    }
    return null;
  };

  const startOffset = toGridMinutes(eventStart, columnDay);
  const endOffset = toGridMinutes(eventEnd, columnDay);
  if (startOffset == null || endOffset == null) return null;
  if (startOffset < 0 || endOffset > endMin - gridStartMin) return null;

  return { startOffset, endOffset: Math.max(endOffset, startOffset + 15) };
}

export function getEventColumnDay(eventStart, weekDays, openHours) {
  const grid = buildOpenHourSlots(openHours);
  const idx = weekDays.findIndex((d) => sameDay(d, eventStart));
  if (idx >= 0) {
    const h = eventStart.getHours() * 60 + eventStart.getMinutes();
    if (!grid.crossesMidnight || h >= grid.startMin) return idx;
  }
  if (grid.crossesMidnight) {
    const prev = new Date(eventStart);
    prev.setDate(prev.getDate() - 1);
    const prevIdx = weekDays.findIndex((d) => sameDay(d, prev));
    const closeMin = parseTimeToMinutes(openHours.end);
    const h = eventStart.getHours() * 60 + eventStart.getMinutes();
    if (prevIdx >= 0 && h < closeMin) return prevIdx;
  }
  return idx;
}
