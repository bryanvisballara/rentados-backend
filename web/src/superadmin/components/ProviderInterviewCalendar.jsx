import { useMemo } from 'react';
import { formatTime } from '../../utils/dateTime';
import {
  buildOpenHourSlots,
  eventGridPosition,
  formatHourLabel,
  getEventColumnDay,
} from '../../utils/openHours';
import { addDays, startOfWeek } from '../../components/FacilityCalendar';
import './ProviderInterviewCalendar.css';

const DAY_LABELS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
const HOUR_HEIGHT = 56;
const INTERVIEW_DURATION_MIN = 60;
const OPEN_HOURS = { start: '07:00', end: '20:00' };

function sameDay(a, b) {
  return a.toDateString() === b.toDateString();
}

function interviewEndAt(scheduledAt) {
  return new Date(new Date(scheduledAt).getTime() + INTERVIEW_DURATION_MIN * 60000);
}

export default function ProviderInterviewCalendar({ weekStart, interviews = [], onSelectInterview }) {
  const grid = buildOpenHourSlots(OPEN_HOURS);
  const { slots } = grid;
  const totalHeight = slots.length * HOUR_HEIGHT;
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart]
  );
  const today = new Date();
  const minEventHeight = 28;

  const events = useMemo(
    () =>
      interviews.map((interview) => ({
        id: interview._id,
        interview,
        startAt: interview.scheduledAt,
        endAt: interviewEndAt(interview.scheduledAt),
        status: interview.status || 'scheduled',
        title: interview.providerId?.businessName || 'Prestador',
      })),
    [interviews]
  );

  function eventStyle(event) {
    const start = new Date(event.startAt);
    const end = new Date(event.endAt);
    const dayIndex = getEventColumnDay(start, days, OPEN_HOURS);
    if (dayIndex < 0) return null;

    const position = eventGridPosition(start, end, days[dayIndex], OPEN_HOURS);
    if (!position) return null;

    const top = (position.startOffset / 60) * HOUR_HEIGHT;
    const height = Math.max(
      ((position.endOffset - position.startOffset) / 60) * HOUR_HEIGHT,
      minEventHeight
    );

    return { dayIndex, top, height };
  }

  const nowLine = (() => {
    const dayIndex = days.findIndex((day) => sameDay(day, today));
    if (dayIndex < 0) return null;

    const position = eventGridPosition(today, today, days[dayIndex], OPEN_HOURS);
    if (!position) return null;

    return {
      dayIndex,
      top: (position.startOffset / 60) * HOUR_HEIGHT,
    };
  })();

  if (slots.length === 0) {
    return <p className="provider-cal__empty">No hay horario configurado para el calendario.</p>;
  }

  return (
    <div className="provider-cal">
      <div className="provider-cal__head">
        <div className="provider-cal__time-gutter" aria-hidden="true" />
        {days.map((day) => {
          const isToday = sameDay(day, today);
          return (
            <div
              key={day.toISOString()}
              className={`provider-cal__day-head${isToday ? ' provider-cal__day-head--today' : ''}`}
            >
              <span>{DAY_LABELS[(day.getDay() + 6) % 7]}</span>
              <strong className={isToday ? 'provider-cal__day-number--today' : ''}>
                {day.getDate()}
              </strong>
            </div>
          );
        })}
      </div>

      <div className="provider-cal__scroll">
        <div className="provider-cal__body" style={{ '--hour-height': `${HOUR_HEIGHT}px` }}>
          <div className="provider-cal__times" style={{ height: totalHeight }}>
            {slots.map((slot) => (
              <div key={slot.key} className="provider-cal__time-label">
                {formatHourLabel(slot.hour)}
              </div>
            ))}
          </div>

          <div className="provider-cal__grid" style={{ height: totalHeight }}>
            {days.map((day, dayIndex) => {
              const isToday = sameDay(day, today);
              return (
                <div
                  key={day.toISOString()}
                  className={`provider-cal__day-col${isToday ? ' provider-cal__day-col--today' : ''}`}
                >
                  {slots.map((slot) => (
                    <div
                      key={slot.key}
                      className="provider-cal__slot"
                      style={{ height: HOUR_HEIGHT }}
                    />
                  ))}

                  {nowLine?.dayIndex === dayIndex && (
                    <div className="provider-cal__now-line" style={{ top: nowLine.top }} aria-hidden="true">
                      <span className="provider-cal__now-dot" />
                    </div>
                  )}

                  {events.map((event) => {
                    const style = eventStyle(event);
                    if (!style || style.dayIndex !== dayIndex) return null;

                    const categories =
                      event.interview.providerId?.categoryIds
                        ?.map((c) => c.name)
                        .filter(Boolean)
                        .join(', ') || '';

                    return (
                      <button
                        key={event.id}
                        type="button"
                        className={`provider-cal__event provider-cal__event--${event.status}`}
                        style={{ top: style.top, height: style.height }}
                        onClick={() => onSelectInterview?.(event.interview)}
                        title={`${event.title} · ${formatTime(event.startAt)}`}
                      >
                        <span className="provider-cal__event-title">{event.title}</span>
                        <span className="provider-cal__event-time">{formatTime(event.startAt)}</span>
                        {categories && (
                          <span className="provider-cal__event-meta">{categories}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export { startOfWeek, addDays, OPEN_HOURS, INTERVIEW_DURATION_MIN };
