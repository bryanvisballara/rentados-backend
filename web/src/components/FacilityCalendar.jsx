import {
  buildOpenHourSlots,
  eventGridPosition,
  formatHourLabel,
  getEventColumnDay,
  slotToDate,
} from '../utils/openHours';
import './FacilityCalendar.css';

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const HOUR_HEIGHT = 48;

export function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export default function FacilityCalendar({
  weekStart,
  openHours = { start: '08:00', end: '22:00' },
  events = [],
  onSelectSlot,
  onSelectEvent,
  slotMinutes = 60,
}) {
  const grid = buildOpenHourSlots(openHours);
  const { slots } = grid;
  const totalHeight = slots.length * HOUR_HEIGHT;
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const minEventHeight = Math.max((slotMinutes / 60) * HOUR_HEIGHT * 0.5, 20);

  function eventStyle(event) {
    const start = new Date(event.startAt);
    const end = new Date(event.endAt);
    const dayIndex = getEventColumnDay(start, days, openHours);
    if (dayIndex < 0) return null;

    const position = eventGridPosition(start, end, days[dayIndex], openHours);
    if (!position) return null;

    const top = (position.startOffset / 60) * HOUR_HEIGHT;
    const height = Math.max(((position.endOffset - position.startOffset) / 60) * HOUR_HEIGHT, minEventHeight);

    return { dayIndex, top, height };
  }

  function handleGridClick(day, slot, domEvent) {
    if (!onSelectSlot || domEvent.target.closest('.facility-cal__event')) return;
    onSelectSlot(slotToDate(day, slot, openHours));
  }

  if (slots.length === 0) {
    return (
      <p className="facility-cal__empty">
        Revisa el horario de apertura y cierre del servicio en configuración.
      </p>
    );
  }

  return (
    <div className="facility-cal">
      <div className="facility-cal__head">
        <div className="facility-cal__time-gutter" />
        {days.map((day) => (
          <div key={day.toISOString()} className="facility-cal__day-head">
            <span>{DAY_LABELS[(day.getDay() + 6) % 7]}</span>
            <strong>{day.getDate()}</strong>
          </div>
        ))}
      </div>

      <div className="facility-cal__body" style={{ '--hour-height': `${HOUR_HEIGHT}px` }}>
        <div className="facility-cal__times" style={{ height: totalHeight }}>
          {slots.map((slot) => (
            <div key={slot.key} className="facility-cal__time-label">
              {formatHourLabel(slot.hour)}
            </div>
          ))}
        </div>

        <div className="facility-cal__grid" style={{ height: totalHeight }}>
          {days.map((day, dayIndex) => (
            <div key={day.toISOString()} className="facility-cal__day-col">
              {slots.map((slot) => (
                <button
                  key={slot.key}
                  type="button"
                  className="facility-cal__slot"
                  style={{ height: HOUR_HEIGHT }}
                  onClick={(e) => handleGridClick(day, slot, e)}
                  aria-label={`Reservar ${day.toLocaleDateString()} ${formatHourLabel(slot.hour)}`}
                />
              ))}

              {events.map((event) => {
                const style = eventStyle(event);
                if (!style || style.dayIndex !== dayIndex) return null;
                return (
                  <button
                    key={event.id}
                    type="button"
                    className={`facility-cal__event facility-cal__event--${event.status || 'confirmed'}${event.isOwn ? ' facility-cal__event--own' : ''}`}
                    style={{ top: style.top, height: style.height }}
                    onClick={() => onSelectEvent?.(event)}
                    title={event.title}
                  >
                    <span className="facility-cal__event-title">{event.title}</span>
                    <span className="facility-cal__event-time">
                      {new Date(event.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {' – '}
                      {new Date(event.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
