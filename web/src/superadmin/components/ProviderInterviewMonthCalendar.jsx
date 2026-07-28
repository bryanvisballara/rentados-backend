import { useMemo } from 'react';
import { formatTime } from '../../utils/dateTime';
import { addDays, startOfWeek } from '../../components/FacilityCalendar';
import './ProviderInterviewMonthCalendar.css';

const WEEKDAY_LABELS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
const MAX_VISIBLE = 3;

function sameDay(a, b) {
  return a.toDateString() === b.toDateString();
}

export function startOfMonth(date) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfMonth(date) {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function buildMonthGrid(monthDate) {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = addDays(startOfWeek(monthEnd), 6);
  gridEnd.setHours(23, 59, 59, 999);

  const days = [];
  let current = new Date(gridStart);
  while (current <= gridEnd) {
    days.push(new Date(current));
    current = addDays(current, 1);
  }

  return {
    days,
    monthStart,
    monthEnd,
    gridStart,
    gridEnd,
    month: monthStart.getMonth(),
    year: monthStart.getFullYear(),
  };
}

function providerTitle(interview) {
  return interview.providerId?.businessName || 'Prestador';
}

export default function ProviderInterviewMonthCalendar({
  monthDate,
  interviews = [],
  onSelectInterview,
  onSelectDay,
}) {
  const today = new Date();
  const grid = useMemo(() => buildMonthGrid(monthDate), [monthDate]);

  const interviewsByDay = useMemo(() => {
    const map = new Map();
    interviews.forEach((interview) => {
      const key = new Date(interview.scheduledAt).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(interview);
    });

    map.forEach((items) => {
      items.sort(
        (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      );
    });

    return map;
  }, [interviews]);

  return (
    <div className="provider-month-cal">
      <div className="provider-month-cal__weekdays">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="provider-month-cal__weekday">
            {label}
          </div>
        ))}
      </div>

      <div className="provider-month-cal__grid">
        {grid.days.map((day) => {
          const isToday = sameDay(day, today);
          const inMonth = day.getMonth() === grid.month;
          const dayInterviews = interviewsByDay.get(day.toDateString()) || [];
          const visible = dayInterviews.slice(0, MAX_VISIBLE);
          const hiddenCount = Math.max(dayInterviews.length - MAX_VISIBLE, 0);

          return (
            <div
              key={day.toISOString()}
              className={[
                'provider-month-cal__cell',
                !inMonth && 'provider-month-cal__cell--outside',
                isToday && 'provider-month-cal__cell--today',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <button
                type="button"
                className={`provider-month-cal__day-number${isToday ? ' provider-month-cal__day-number--today' : ''}`}
                onClick={() => onSelectDay?.(day, dayInterviews)}
              >
                {day.getDate()}
              </button>

              <div className="provider-month-cal__events">
                {visible.map((interview) => (
                  <button
                    key={interview._id}
                    type="button"
                    className={`provider-month-cal__event provider-month-cal__event--${interview.status || 'scheduled'}`}
                    onClick={() => onSelectInterview?.(interview)}
                    title={`${providerTitle(interview)} · ${formatTime(interview.scheduledAt)}`}
                  >
                    <span className="provider-month-cal__event-time">
                      {formatTime(interview.scheduledAt)}
                    </span>
                    <span className="provider-month-cal__event-title">{providerTitle(interview)}</span>
                  </button>
                ))}

                {hiddenCount > 0 && (
                  <button
                    type="button"
                    className="provider-month-cal__more"
                    onClick={() => onSelectDay?.(day, dayInterviews)}
                  >
                    +{hiddenCount} más
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
