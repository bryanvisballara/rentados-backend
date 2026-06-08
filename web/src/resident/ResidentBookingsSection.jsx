import { useEffect, useMemo, useState } from 'react';
import FacilityCalendar, { addDays, startOfWeek } from '../components/FacilityCalendar';
import { formatCop, residentApi } from '../api/client';
import '../components/FacilityCalendar.css';

const emptyForm = { startAt: '', endAt: '', blockIndex: '', notes: '' };

function toLocalInputValue(date) {
  const d = new Date(date);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export default function ResidentBookingsSection({ services = [] }) {
  const bookableServices = useMemo(() => services.filter((s) => s.bookable && s.available), [services]);
  const [facilityId, setFacilityId] = useState('');
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [bookings, setBookings] = useState([]);
  const [facilityMeta, setFacilityMeta] = useState(null);
  const [myBookings, setMyBookings] = useState([]);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);
  const selectedService = useMemo(
    () => bookableServices.find((s) => s.id === facilityId),
    [bookableServices, facilityId]
  );
  const pricingMode = facilityMeta?.bookingPricing?.mode || selectedService?.bookingPricing?.mode || 'free';
  const blocks = facilityMeta?.bookingPricing?.blocks || selectedService?.bookingPricing?.blocks || [];

  useEffect(() => {
    if (!facilityId && bookableServices[0]) setFacilityId(String(bookableServices[0].id));
  }, [bookableServices, facilityId]);

  async function loadCalendar(currentId = facilityId) {
    if (!currentId) return;
    const data = await residentApi.facilityBookings.calendar({
      facilityId: currentId,
      from: weekStart.toISOString(),
      to: weekEnd.toISOString(),
    });
    setBookings(data.bookings || []);
    setFacilityMeta(data.facility || null);
  }

  async function loadMine() {
    const data = await residentApi.myBookings();
    setMyBookings(data.bookings || []);
  }

  useEffect(() => {
    if (facilityId) loadCalendar().catch((err) => setError(err.message));
  }, [facilityId, weekStart]);

  useEffect(() => {
    loadMine().catch(() => {});
  }, []);

  function openCreate(slotDate) {
    const start = new Date(slotDate);
    const slotMinutes = facilityMeta?.bookingRules?.slotMinutes || selectedService?.bookingRules?.slotMinutes || 60;
    const end = new Date(start.getTime() + slotMinutes * 60000);
    setForm({ ...emptyForm, startAt: toLocalInputValue(start), endAt: toLocalInputValue(end) });
    setModal({ type: 'create' });
  }

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await residentApi.facilityBookings.create({
        facilityId,
        startAt: new Date(form.startAt).toISOString(),
        endAt: pricingMode === 'blocks' ? undefined : new Date(form.endAt).toISOString(),
        blockIndex: form.blockIndex === '' ? undefined : Number(form.blockIndex),
        notes: form.notes,
      });
      setModal(null);
      setForm(emptyForm);
      await Promise.all([loadCalendar(), loadMine()]);
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
                    {new Date(b.startAt).toLocaleString()} – {new Date(b.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {b.totalPrice > 0 && ` · ${formatCop(b.totalPrice)}`}
                  </p>
                </div>
                <button type="button" className="resident__link-btn" onClick={() => cancelBooking(b.id)}>
                  Cancelar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="resident__card">
        <div className="resident__bookings-toolbar">
          <label>
            Espacio
            <select value={facilityId} onChange={(e) => setFacilityId(e.target.value)}>
              {bookableServices.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <div className="resident__bookings-nav">
            <button type="button" onClick={() => setWeekStart(addDays(weekStart, -7))}>
              ←
            </button>
            <button type="button" onClick={() => setWeekStart(startOfWeek(new Date()))}>
              Hoy
            </button>
            <button type="button" onClick={() => setWeekStart(addDays(weekStart, 7))}>
              →
            </button>
          </div>
        </div>

        <p className="resident__muted">
          Toca un horario libre para reservar. Los bloques ocupados muestran la unidad; las tuyas tienen borde claro.
        </p>

        <FacilityCalendar
          weekStart={weekStart}
          openHours={facilityMeta?.openHours || selectedService?.openHours}
          slotMinutes={facilityMeta?.bookingRules?.slotMinutes || 60}
          events={bookings}
          onSelectSlot={openCreate}
          onSelectEvent={(event) => event.isOwn && setModal({ type: 'view', event })}
        />
      </div>

      {modal?.type === 'create' && (
        <div className="resident__modal-overlay" onClick={() => setModal(null)}>
          <div className="resident__modal" onClick={(e) => e.stopPropagation()}>
            <h2>Reservar {selectedService?.name}</h2>
            <form className="resident__booking-form" onSubmit={handleCreate}>
              <label>
                Inicio
                <input
                  type="datetime-local"
                  value={form.startAt}
                  onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                  required
                />
              </label>
              {pricingMode === 'blocks' ? (
                <label>
                  Paquete
                  <select
                    value={form.blockIndex}
                    onChange={(e) => setForm({ ...form, blockIndex: e.target.value })}
                    required
                  >
                    <option value="">Seleccionar…</option>
                    {blocks.map((block, index) => (
                      <option key={block.label} value={index}>
                        {block.label} · {formatCop(block.price)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label>
                  Fin
                  <input
                    type="datetime-local"
                    value={form.endAt}
                    onChange={(e) => setForm({ ...form, endAt: e.target.value })}
                    required
                  />
                </label>
              )}
              <label>
                Notas (opcional)
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </label>
              {selectedService?.requiresApproval && (
                <p className="resident__muted">Esta reserva quedará pendiente hasta aprobación del administrador.</p>
              )}
              <div className="resident__booking-actions">
                <button type="submit" className="resident__primary-btn">
                  Confirmar reserva
                </button>
                <button type="button" className="resident__ghost-btn" onClick={() => setModal(null)}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal?.type === 'view' && (
        <div className="resident__modal-overlay" onClick={() => setModal(null)}>
          <div className="resident__modal" onClick={(e) => e.stopPropagation()}>
            <h2>Tu reserva</h2>
            <p>{new Date(modal.event.startAt).toLocaleString()} – {new Date(modal.event.endAt).toLocaleString()}</p>
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
      )}
    </section>
  );
}
