import { useEffect, useMemo, useState } from 'react';
import FacilityBookingForm from '../components/FacilityBookingForm';
import { formatCop, formatDateTime, formatTime, residentApi } from '../api/client';
import { addMonths, startOfMonth } from '../utils/facilityBookingSlots';
import { ResidentOverlay } from './ResidentLayout';
import './ResidentHomePage.css';

export default function ResidentBookingsSection({ services = [], selectedFacilityId = '' }) {
  const bookableServices = useMemo(() => services.filter((s) => s.bookable && s.available), [services]);
  const [facilityId, setFacilityId] = useState(() =>
    selectedFacilityId ? String(selectedFacilityId) : ''
  );
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [bookings, setBookings] = useState([]);
  const [facilityMeta, setFacilityMeta] = useState(null);
  const [myBookings, setMyBookings] = useState([]);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [createError, setCreateError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const monthRange = useMemo(() => {
    const from = startOfMonth(calendarMonth);
    const to = addMonths(from, 1);
    to.setMilliseconds(to.getMilliseconds() - 1);
    return { from, to };
  }, [calendarMonth]);
  const selectedService = useMemo(
    () => bookableServices.find((s) => String(s.id) === String(facilityId)),
    [bookableServices, facilityId]
  );

  const calendarFacility = useMemo(() => {
    const metaMatches =
      facilityMeta && String(facilityMeta.id) === String(facilityId) ? facilityMeta : null;
    return metaMatches || selectedService || null;
  }, [facilityMeta, facilityId, selectedService]);

  const pricingMode = facilityMeta?.bookingPricing?.mode || selectedService?.bookingPricing?.mode || 'free';
  const blocks = facilityMeta?.bookingPricing?.blocks || selectedService?.bookingPricing?.blocks || [];
  const serviceRequiresPayment = useMemo(() => {
    const p = facilityMeta?.bookingPricing || selectedService?.bookingPricing;
    if (p?.mode === 'hourly') return Number(p.hourlyRate) > 0;
    if (p?.mode === 'flat') return Number(p.flatPrice) > 0;
    if (p?.mode === 'blocks') return (p.blocks || []).some((b) => Number(b.price) > 0);
    if (p?.mode === 'free') return false;
    return Number(selectedService?.price) > 0;
  }, [facilityMeta, selectedService]);
  useEffect(() => {
    if (selectedFacilityId) {
      setFacilityId(String(selectedFacilityId));
      return;
    }
    if (!facilityId && bookableServices[0]) setFacilityId(String(bookableServices[0].id));
  }, [selectedFacilityId, bookableServices, facilityId]);

  async function loadCalendar(currentId = facilityId) {
    if (!currentId) return;
    const data = await residentApi.facilityBookings.calendar({
      facilityId: currentId,
      from: monthRange.from.toISOString(),
      to: monthRange.to.toISOString(),
    });
    setBookings(data.bookings || []);
    setFacilityMeta(data.facility || null);
  }

  async function loadMine() {
    const data = await residentApi.myBookings();
    setMyBookings(data.bookings || []);
  }

  useEffect(() => {
    setFacilityMeta(null);
    setBookings([]);
  }, [facilityId]);

  useEffect(() => {
    if (facilityId) loadCalendar().catch((err) => setError(err.message));
  }, [facilityId, monthRange.from.getTime()]);

  useEffect(() => {
    loadMine().catch(() => {});
  }, []);

  async function handleCreateBooking({ startAt, blockIndex, notes }) {
    setCreateError('');
    setError('');
    setSubmitting(true);

    const start = new Date(startAt);
    if (Number.isNaN(start.getTime())) {
      setCreateError('Indica una fecha y hora de inicio válidas.');
      setSubmitting(false);
      return;
    }
    if (start < new Date()) {
      setCreateError('La hora de inicio debe ser futura. Elige un horario más tarde.');
      setSubmitting(false);
      return;
    }
    if (pricingMode === 'blocks' && (blockIndex === undefined || blockIndex === '')) {
      setCreateError('Selecciona un paquete de horas.');
      setSubmitting(false);
      return;
    }

    const slotMinutes =
      facilityMeta?.bookingRules?.slotMinutes || selectedService?.bookingRules?.slotMinutes || 60;
    const end =
      pricingMode === 'blocks'
        ? undefined
        : new Date(start.getTime() + slotMinutes * 60000).toISOString();

    try {
      const result = await residentApi.facilityBookings.create({
        facilityId,
        startAt: start.toISOString(),
        endAt: end,
        blockIndex: blockIndex === undefined || blockIndex === '' ? undefined : Number(blockIndex),
        notes,
      });

      const bookingId = result.booking?.id ?? result.booking?._id;
      await Promise.all([loadCalendar(), loadMine()]);

      if (result.requiresPayment && bookingId) {
        setModal({
          type: 'pay',
          booking: { ...result.booking, id: bookingId },
          payment: result.payment,
        });
        return;
      }
    } catch (err) {
      setCreateError(err.message || 'No se pudo crear la reserva.');
    } finally {
      setSubmitting(false);
    }
  }

  async function payBooking(bookingId) {
    try {
      const checkout = await residentApi.facilityBookings.checkout(bookingId);
      if (checkout.paymentUrl) {
        window.open(checkout.paymentUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      setModal({
        type: 'pay',
        booking: { id: bookingId, totalPrice: checkout.amount },
        payment: {
          paymentReference: checkout.paymentReference,
          amount: checkout.amount,
        },
        message: checkout.message,
      });
    } catch (err) {
      setError(err.message);
    }
  }

  async function cancelBooking(id) {
    if (!window.confirm('¿Cancelar tu reserva?')) return;
    try {
      await residentApi.facilityBookings.remove(id);
      setModal(null);
      await Promise.all([loadCalendar(), loadMine()]);
    } catch (err) {
      setError(err.message);
    }
  }

  if (bookableServices.length === 0) {
    return (
      <div className="resident__card">
        <h2>Reservas</h2>
        <p className="resident__muted">No hay espacios reservables disponibles en este momento.</p>
      </div>
    );
  }

  return (
    <section className="resident__section">
      {error && <div className="resident__error">{error}</div>}

      {myBookings.length > 0 && (
        <div className="resident__card">
          <h2>Mis próximas reservas</h2>
          <ul className="resident__bookings-list">
            {myBookings.map((b) => (
              <li key={b.id}>
                <div>
                  <strong>{b.title || 'Reserva'}</strong>
                  <p className="resident__muted">
                    {formatDateTime(b.startAt)} – {formatTime(b.endAt)}
                    {b.totalPrice > 0 && ` · ${formatCop(b.totalPrice)}`}
                    {b.status === 'awaiting_payment' && ' · Pago pendiente'}
                    {b.status === 'pending' && ' · Esperando aprobación'}
                  </p>
                </div>
                <div className="resident__booking-actions">
                  {b.status === 'awaiting_payment' && (
                    <button type="button" className="resident__primary-btn" onClick={() => payBooking(b.id)}>
                      Pagar
                    </button>
                  )}
                  <button type="button" className="resident__link-btn" onClick={() => cancelBooking(b.id)}>
                    Cancelar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="resident__card">
        <div className="resident__bookings-toolbar">
          {selectedFacilityId ? (
            <div className="resident__bookings-space">
              <span className="resident__bookings-space-label">Espacio</span>
              <strong>{selectedService?.name || '—'}</strong>
            </div>
          ) : (
            <label>
              Espacio
              <select value={facilityId} onChange={(e) => setFacilityId(e.target.value)}>
                {bookableServices.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <FacilityBookingForm
          key={facilityId}
          facility={calendarFacility}
          events={bookings}
          slotMinutes={
            facilityMeta?.bookingRules?.slotMinutes ||
            selectedService?.bookingRules?.slotMinutes ||
            60
          }
          capacity={calendarFacility?.capacity || 1}
          pricingMode={pricingMode}
          blocks={blocks}
          serviceRequiresPayment={serviceRequiresPayment}
          requiresApproval={Boolean(selectedService?.requiresApproval)}
          submitting={submitting}
          submitError={createError}
          onSubmit={handleCreateBooking}
          onMonthChange={setCalendarMonth}
        />
      </div>

      {modal?.type === 'pay' && (
        <ResidentOverlay>
        <div className="resident__modal-overlay" onClick={() => setModal(null)}>
          <div className="resident__modal" onClick={(e) => e.stopPropagation()}>
            <h2>Pagar reserva</h2>
            <p className="resident__muted">
              {modal.message ||
                'La reserva se mostrará a los demás residentes cuando el webhook de la pasarela confirme el pago.'}
            </p>
            {modal.payment?.amount > 0 && (
              <p>
                <strong>{formatCop(modal.payment.amount)}</strong>
              </p>
            )}
            {modal.payment?.paymentReference && (
              <p className="resident__muted">Referencia: {modal.payment.paymentReference}</p>
            )}
            <div className="resident__booking-actions">
              <button
                type="button"
                className="resident__primary-btn"
                onClick={() => payBooking(modal.booking.id)}
              >
                Ir a pagar
              </button>
              <button type="button" className="resident__ghost-btn" onClick={() => setModal(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
        </ResidentOverlay>
      )}

      {modal?.type === 'view' && (
        <ResidentOverlay>
        <div className="resident__modal-overlay" onClick={() => setModal(null)}>
          <div className="resident__modal" onClick={(e) => e.stopPropagation()}>
            <h2>Tu reserva</h2>
            <p>{formatDateTime(modal.event.startAt)} – {formatDateTime(modal.event.endAt)}</p>
            <div className="resident__booking-actions">
              <button type="button" className="resident__danger-btn" onClick={() => cancelBooking(modal.event.id)}>
                Cancelar reserva
              </button>
              <button type="button" className="resident__ghost-btn" onClick={() => setModal(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
        </ResidentOverlay>
      )}
    </section>
  );
}
