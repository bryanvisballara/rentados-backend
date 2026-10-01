import { useEffect, useMemo, useState } from 'react';
import { formatCop } from '../api/client';
import { APP_LOCALE, APP_TIMEZONE } from '../utils/dateTime';
import {
  addMonths,
  buildSlotStartsForDay,
  isSlotAvailable,
  sameCalendarDay,
  startOfDay,
  startOfMonth,
} from '../utils/facilityBookingSlots';
import { formatOpenHoursRange, resolveFacilityCalendarOpenHours } from '../utils/openHours';
import './FacilityBookingForm.css';

const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function monthTitle(date) {
  const label = new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    month: 'long',
    year: 'numeric',
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatDayLabel(date) {
  return new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

function formatSlotTime(date) {
  return new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function buildMonthGrid(viewMonth) {
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - startOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return day;
  });
}

export default function FacilityBookingForm({
  facility,
  events = [],
  slotMinutes = 60,
  capacity = 1,
  pricingMode = 'free',
  blocks = [],
  serviceRequiresPayment = false,
  requiresApproval = false,
  submitting = false,
  submitError = '',
  onSubmit,
  onMonthChange,
  confirmExtra = null,
  confirmStepTitle = '3. Confirma tu reserva',
  submitLabel,
  showPaymentHints = true,
}) {
  const openHours = useMemo(() => resolveFacilityCalendarOpenHours(facility), [facility]);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));
  const [selectedStart, setSelectedStart] = useState(null);
  const [blockIndex, setBlockIndex] = useState('');
  const [notes, setNotes] = useState('');

  const today = startOfDay(new Date());
  const monthDays = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);

  useEffect(() => {
    onMonthChange?.(startOfMonth(viewMonth));
  }, [viewMonth, onMonthChange]);

  const dayEvents = useMemo(
    () =>
      events.filter((event) => {
        const start = new Date(event.startAt);
        return sameCalendarDay(start, selectedDay);
      }),
    [events, selectedDay]
  );

  const timeSlots = useMemo(() => {
    if (!openHours) return [];
    const starts = buildSlotStartsForDay(selectedDay, openHours, slotMinutes);
    const now = new Date();
    return starts.map((start) => {
      const past = sameCalendarDay(start, today) && start < now;
      const available = !past && isSlotAvailable(start, slotMinutes, dayEvents, capacity);
      return { start, past, available };
    });
  }, [openHours, selectedDay, slotMinutes, dayEvents, capacity, today]);

  const selectedBlock =
    blockIndex !== '' && blocks[Number(blockIndex)] ? blocks[Number(blockIndex)] : null;

  function pickDay(day) {
    if (day < today) return;
    setSelectedDay(startOfDay(day));
    setSelectedStart(null);
    setBlockIndex('');
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!selectedStart || !onSubmit) return;
    onSubmit({
      startAt: selectedStart,
      blockIndex: blockIndex === '' ? undefined : Number(blockIndex),
      notes: notes.trim(),
    });
  }

  if (!facility || !openHours) {
    return <p className="facility-book__empty">Cargando horario del servicio…</p>;
  }

  return (
    <div className="facility-book">
      <p className="facility-book__meta">
        Horario: {formatOpenHoursRange(facility.openHours, facility.open24Hours)}
        {capacity > 1 ? ` · Hasta ${capacity} reservas por horario` : ''}
      </p>

      <section className="facility-book__step" aria-labelledby="facility-book-date-title">
        <div className="facility-book__step-head">
          <h3 id="facility-book-date-title">1. Elige la fecha</h3>
          <div className="facility-book__month-nav">
            <button type="button" aria-label="Mes anterior" onClick={() => setViewMonth(addMonths(viewMonth, -1))}>
              ‹
            </button>
            <span>{monthTitle(viewMonth)}</span>
            <button type="button" aria-label="Mes siguiente" onClick={() => setViewMonth(addMonths(viewMonth, 1))}>
              ›
            </button>
          </div>
        </div>

        <div className="facility-book__calendar">
        <div className="facility-book__weekdays" aria-hidden="true">
          {WEEKDAY_LABELS.map((label, index) => (
            <span key={`${label}-${index}`}>{label}</span>
          ))}
        </div>

        <div className="facility-book__days" role="grid" aria-label="Calendario">
          {monthDays.map((day) => {
            const inMonth = day.getMonth() === viewMonth.getMonth();
            const isPast = day < today;
            const selected = sameCalendarDay(day, selectedDay);
            const isToday = sameCalendarDay(day, today);
            return (
              <button
                key={day.toISOString()}
                type="button"
                role="gridcell"
                disabled={isPast}
                className={`facility-book__day${
                  selected ? ' facility-book__day--selected' : ''
                }${isToday ? ' facility-book__day--today' : ''}${
                  !inMonth ? ' facility-book__day--muted' : ''
                }${isPast ? ' facility-book__day--past' : ''}`}
                onClick={() => pickDay(day)}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>
        </div>
      </section>

      {selectedDay && (
        <section className="facility-book__step" aria-labelledby="facility-book-time-title">
          <h3 id="facility-book-time-title">2. Elige la hora</h3>
          <p className="facility-book__day-label">{formatDayLabel(selectedDay)}</p>

          {timeSlots.length === 0 ? (
            <p className="facility-book__empty">No hay horarios disponibles este día.</p>
          ) : (
            <div className="facility-book__times">
              {timeSlots.map(({ start, past, available }) => {
                const selected = selectedStart && start.getTime() === selectedStart.getTime();
                return (
                  <button
                    key={start.toISOString()}
                    type="button"
                    disabled={past || !available}
                    className={`facility-book__time${
                      selected ? ' facility-book__time--selected' : ''
                    }${!available && !past ? ' facility-book__time--full' : ''}`}
                    onClick={() => {
                      setSelectedStart(start);
                      setBlockIndex('');
                    }}
                  >
                    {formatSlotTime(start)}
                    {!available && !past ? ' · Lleno' : ''}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {selectedStart && (
        <section className="facility-book__step" aria-labelledby="facility-book-confirm-title">
          <h3 id="facility-book-confirm-title">{confirmStepTitle}</h3>
          <form className="facility-book__confirm" onSubmit={handleSubmit}>
            <div className="facility-book__summary">
              <p>
                <span>Fecha</span>
                <strong>{formatDayLabel(selectedDay)}</strong>
              </p>
              <p>
                <span>Hora</span>
                <strong>{formatSlotTime(selectedStart)}</strong>
              </p>
              {pricingMode === 'blocks' && (
                <label className="facility-book__field">
                  <span>Paquete de horas</span>
                  <select
                    value={blockIndex}
                    onChange={(e) => setBlockIndex(e.target.value)}
                    required
                  >
                    <option value="">Seleccionar…</option>
                    {blocks.map((block, index) => (
                      <option key={block.label || index} value={index}>
                        {block.label} · {formatCop(block.price)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {selectedBlock && (
                <p>
                  <span>Total</span>
                  <strong>{formatCop(selectedBlock.price)}</strong>
                </p>
              )}
            </div>

            {confirmExtra}

            <label className="facility-book__field">
              <span>Notas (opcional)</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Comentario para administración"
              />
            </label>

            {showPaymentHints && requiresApproval && (
              <p className="facility-book__hint">
                Esta reserva quedará pendiente hasta que administración la apruebe.
              </p>
            )}
            {showPaymentHints && serviceRequiresPayment && (
              <p className="facility-book__hint">
                Después de confirmar irás al pago. La reserva será visible para todos cuando se confirme el cobro.
              </p>
            )}
            {submitError && <p className="facility-book__error">{submitError}</p>}

            <button
              type="submit"
              className="facility-book__submit"
              disabled={
                submitting || (pricingMode === 'blocks' && blockIndex === '')
              }
            >
              {submitting
                ? 'Procesando…'
                : submitLabel ||
                  (serviceRequiresPayment && showPaymentHints
                    ? 'Confirmar y pagar'
                    : 'Reservar ahora')}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
