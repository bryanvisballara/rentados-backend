export const RESTAURANT_WEEKDAYS = [
  { key: 'mon', label: 'Lunes' },
  { key: 'tue', label: 'Martes' },
  { key: 'wed', label: 'Miércoles' },
  { key: 'thu', label: 'Jueves' },
  { key: 'fri', label: 'Viernes' },
  { key: 'sat', label: 'Sábado' },
  { key: 'sun', label: 'Domingo' },
];

export function defaultRestaurantWeeklyHours() {
  return RESTAURANT_WEEKDAYS.map(({ key }) => ({
    day: key,
    enabled: false,
    start: '11:00',
    end: '22:00',
  }));
}

export function normalizeRestaurantWeeklyHours(input) {
  const byDay = new Map();
  if (Array.isArray(input)) {
    input.forEach((row) => {
      if (!row?.day) return;
      byDay.set(row.day, {
        day: row.day,
        enabled: Boolean(row.enabled),
        start: row.start || '11:00',
        end: row.end || '22:00',
      });
    });
  }
  return RESTAURANT_WEEKDAYS.map(({ key }) => {
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

export function hasEnabledRestaurantDay(weeklyHours) {
  return normalizeRestaurantWeeklyHours(weeklyHours).some((row) => row.enabled);
}
