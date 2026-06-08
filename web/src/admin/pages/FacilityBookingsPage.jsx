import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import FacilityCalendar, { addDays, startOfWeek } from '../../components/FacilityCalendar';
import { adminApi, formatCop } from '../../api/client';
import ResidentSelectField from '../components/ResidentSelectField';
import { formatOpenHoursRange } from '../../utils/openHours';
import '../admin.css';
import '../../components/FacilityCalendar.css';

const emptyBookingForm = {
  residentId: '',
  startAt: '',
  endAt: '',
  blockIndex: '',
  notes: '',
};

function toLocalInputValue(date) {
  const d = new Date(date);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function getPricingMode(facility) {
  return facility?.bookingPricing?.mode || 'free';
}

export default function FacilityBookingsPage() {
  const [facilities, setFacilities] = useState([]);
  const [residents, setResidents] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [facilityId, setFacilityId] = useState('');
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyBookingForm);

  const selectedFacility = useMemo(
    () => facilities.find((f) => String(f._id) === String(facilityId)),
    [facilities, facilityId]
  );

  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);

  async function loadFacilities() {
    const params = {
      from: weekStart.toISOString(),
      to: weekEnd.toISOString(),
    };
    const data = await adminApi.facilityBookings.list(params);
    const bookable = data.facilities || [];
    setFacilities(bookable);
    if (!facilityId && bookable[0]) {
      setFacilityId(String(bookable[0]._id));
    }
  }

  async function loadResidents() {
    const data = await adminApi.residents.list();
    setResidents(data.residents || []);
  }

  async function loadBookings(currentFacilityId = facilityId) {
    if (!currentFacilityId) {
      setBookings([]);
      return;
    }
    const data = await adminApi.facilityBookings.list({
      facilityId: currentFacilityId,
      from: weekStart.toISOString(),
      to: weekEnd.toISOString(),
    });
    setBookings(data.bookings || []);
  }

  useEffect(() => {
    Promise.all([loadFacilities(), loadResidents()]).catch((err) => setError(err.message));
  }, [weekStart]);

  useEffect(() => {
    if (facilityId) loadBookings().catch((err) => setError(err.message));
  }, [facilityId, weekStart]);

  function openCreate(slotDate) {
    const start = new Date(slotDate);
    const slotMinutes = selectedFacility?.bookingRules?.slotMinutes || 60;
    const end = new Date(start.getTime() + slotMinutes * 60000);

    setForm({
      ...emptyBookingForm,
      startAt: toLocalInputValue(start),
      endAt: toLocalInputValue(end),
    });
    setModal({ type: 'create' });
  }

  function openView(event) {
    setModal({ type: 'view', event });
  }

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await adminApi.facilityBookings.create({
        facilityId,
        residentId: form.residentId,
        startAt: new Date(form.startAt).toISOString(),
        endAt: getPricingMode(selectedFacility) === 'blocks' ? undefined : new Date(form.endAt).toISOString(),
        blockIndex: form.blockIndex === '' ? undefined : Number(form.blockIndex),
        notes: form.notes,
      });
      setModal(null);
      setForm(emptyBookingForm);
      await loadBookings();
    } catch (err) {
      setError(err.message);
    }
  }

  async function updateBookingStatus(status) {
    try {
      await adminApi.facilityBookings.update(modal.event.id, { status });
      setModal(null);
      await loadBookings();
    } catch (err) {
      setError(err.message);
    }
  }

  async function cancelBooking(id) {
    if (!window.confirm('¿Cancelar esta reserva?')) return;
    try {
      await adminApi.facilityBookings.remove(id);
      setModal(null);
      await loadBookings();
    } catch (err) {
      setError(err.message);
    }
  }

  const pricingMode = getPricingMode(selectedFacility);
  const blocks = selectedFacility?.bookingPricing?.blocks || [];

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <p className="admin-breadcrumb">
          <Link to="/admin/servicios">Servicios</Link> / Reservas
        </p>
        <h1>Calendario de reservas</h1>
        <p>Disponibilidad y reservas de salón social, BBQ, sauna y demás espacios por hora o paquetes.</p>
      </header>

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-card">
        <div className="admin-toolbar">
          <label>
            Servicio
            <select value={facilityId} onChange={(e) => setFacilityId(e.target.value)}>
              {facilities.length === 0 && <option value="">Sin servicios reservables</option>}
              {facilities.map((f) => (
                <option key={f._id} value={String(f._id)}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>

          <div className="admin-actions">
            <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setWeekStart(addDays(weekStart, -7))}>
              ← Semana anterior
            </button>
            <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setWeekStart(startOfWeek(new Date()))}>
              Hoy
            </button>
            <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setWeekStart(addDays(weekStart, 7))}>
              Semana siguiente →
            </button>
          </div>
        </div>

        {selectedFacility && (
          <p style={{ margin: '0 0 1rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            Horario {formatOpenHoursRange(selectedFacility.openHours, selectedFacility.open24Hours)}
            {pricingMode === 'hourly' && selectedFacility.bookingPricing?.hourlyRate > 0 && (
              <> · {formatCop(selectedFacility.bookingPricing.hourlyRate)}/hora</>
            )}
            {pricingMode === 'blocks' && blocks.length > 0 && (
              <> · Paquetes: {blocks.map((b) => `${b.label} (${formatCop(b.price)})`).join(', ')}</>
            )}
          </p>
        )}

        {facilityId ? (
          <FacilityCalendar
            weekStart={weekStart}
            openHours={selectedFacility?.openHours}
            slotMinutes={selectedFacility?.bookingRules?.slotMinutes || 60}
            events={bookings}
            onSelectSlot={openCreate}
            onSelectEvent={openView}
          />
        ) : (
          <p className="admin-empty">
            Marca un servicio como reservable en{' '}
            <Link to="/admin/servicios">Servicios</Link> para ver su calendario.
          </p>
        )}
      </div>

      {modal?.type === 'create' && (
        <div className="admin-modal-overlay" onClick={() => setModal(null)}>
          <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
            <h2>Nueva reserva</h2>
            <form className="admin-form" onSubmit={handleCreate}>
              <label className="admin-unit-picker-field">
                Residente
                <ResidentSelectField
                  key={form.startAt}
                  residents={residents}
                  value={form.residentId}
                  onChange={(residentId) => setForm({ ...form, residentId })}
                  required
                />
              </label>
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
                  Paquete de horas
                  <select
                    value={form.blockIndex}
                    onChange={(e) => setForm({ ...form, blockIndex: e.target.value })}
                    required
                  >
                    <option value="">Seleccionar…</option>
                    {blocks.map((block, index) => (
                      <option key={block.label} value={index}>
                        {block.label} · {Math.round(block.durationMinutes / 60)} h · {formatCop(block.price)}
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
              <label style={{ gridColumn: '1 / -1' }}>
                Notas
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </label>
              <div className="admin-actions">
                <button type="submit" className="admin-btn">
                  Reservar
                </button>
                <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setModal(null)}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal?.type === 'view' && (
        <div className="admin-modal-overlay" onClick={() => setModal(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{modal.event.title}</h2>
            <p>
              {new Date(modal.event.startAt).toLocaleString()} –{' '}
              {new Date(modal.event.endAt).toLocaleString()}
            </p>
            <p>
              Estado: <strong>{modal.event.status}</strong>
              {modal.event.totalPrice > 0 && <> · {formatCop(modal.event.totalPrice)}</>}
            </p>
            {modal.event.notes && <p>{modal.event.notes}</p>}
            <div className="admin-actions">
              {modal.event.status === 'pending' && (
                <button type="button" className="admin-btn" onClick={() => updateBookingStatus('confirmed')}>
                  Confirmar
                </button>
              )}
              <button type="button" className="admin-btn admin-btn--danger" onClick={() => cancelBooking(modal.event.id)}>
                Cancelar reserva
              </button>
              <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setModal(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
