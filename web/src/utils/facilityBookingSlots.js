import { buildOpenHourSlots, slotToDate } from './openHours';

export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfMonth(date) {
  const d = startOfDay(date);
  d.setDate(1);
  return d;
}

export function addMonths(date, delta) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + delta);
  return d;
}

export function sameCalendarDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function buildSlotStartsForDay(day, openHours, slotMinutes = 60) {
  const grid = buildOpenHourSlots(openHours);
  if (!grid.slots.length) return [];

  const first = slotToDate(day, grid.slots[0], openHours);
  const lastHourSlot = grid.slots[grid.slots.length - 1];
  const lastHourStart = slotToDate(day, lastHourSlot, openHours);
  const dayClose = new Date(lastHourStart.getTime() + 60 * 60000);

  const starts = [];
  let cursor = new Date(first);
  const step = Math.max(15, Number(slotMinutes) || 60) * 60000;

  while (cursor.getTime() + step <= dayClose.getTime()) {
    starts.push(new Date(cursor));
    cursor = new Date(cursor.getTime() + step);
  }

  return starts;
}

export function overlapsRange(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

export function countOverlappingBookings(slotStart, slotEnd, events = []) {
  return events.filter((event) => {
    const start = new Date(event.startAt);
    const end = new Date(event.endAt);
    return overlapsRange(slotStart, slotEnd, start, end);
  }).length;
}

export function isSlotAvailable(slotStart, slotMinutes, events, capacity = 1) {
  const slotEnd = new Date(slotStart.getTime() + slotMinutes * 60000);
  const used = countOverlappingBookings(slotStart, slotEnd, events);
  return used < Math.max(1, capacity);
}
