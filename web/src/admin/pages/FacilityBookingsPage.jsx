import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import FacilityBookingForm from '../../components/FacilityBookingForm';
import { adminApi, formatCop, formatDateTime, formatTime } from '../../api/client';
import ResidentSelectField from '../components/ResidentSelectField';
import { addMonths, startOfMonth } from '../../utils/facilityBookingSlots';
import '../admin.css';
import '../../components/FacilityBookingForm.css';

function getPricingMode(facility) {
  return facility?.bookingPricing?.mode || 'free';
}

export default function FacilityBookingsPage() {
  const [facilities, setFacilities] = useState([]);
  const [residents, setResidents] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [facilityId, setFacilityId] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [error, setError] = useState('');
  const [createError, setCreateError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [residentId, setResidentId] = useState('');
  const [modal, setModal] = useState(null);

  const monthRange = useMemo(() => {
    const from = startOfMonth(calendarMonth);
    const to = addMonths(from, 1);
    to.setMilliseconds(to.getMilliseconds() - 1);
    return { from, to };
  }, [calendarMonth]);

  const selectedFacility = useMemo(
    () => facilities.find((f) => String(f._id) === String(facilityId)),
    [facilities, facilityId]
  );

  const pricingMode = getPricingMode(selectedFacility);
  const blocks = selectedFacility?.bookingPricing?.blocks || [];

  const serviceRequiresPayment = useMemo(() => {
    const p = selectedFacility?.bookingPricing;
    if (p?.mode === 'hourly') return Number(p.hourlyRate) > 0;
    if (p?.mode === 'flat') return Number(p.flatPrice) > 0;
    if (p?.mode === 'blocks') return (p.blocks || []).some((b) => Number(b.price) > 0);
    if (p?.mode === 'free') return false;
    return false;
  }, [selectedFacility]);

  async function loadFacilitiesAndBookings(currentFacilityId = facilityId) {
    const params = {
      from: monthRange.from.toISOString(),
      to: monthRange.to.toISOString(),
    };
    if (currentFacilityId) params.facilityId = currentFacilityId;

    const data = await adminApi.facilityBookings.list(params);
    const bookable = data.facilities || [];
    setFacilities(bookable);
    if (!currentFacilityId && bookable[0]) {
      setFacilityId(String(bookable[0]._id));
    }
    if (currentFacilityId) {
      setBookings(data.bookings || []);
    }
  }

  async function loadResidents() {
    const data = await adminApi.residents.list();
    setResidents(data.residents || []);
  }

  useEffect(() => {
    loadResidents().catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    loadFacilitiesAndBookings(facilityId || undefined).catch((err) => setError(err.message));
  }, [monthRange.from.getTime(), facilityId]);

  async function handleCreateBooking({ startAt, blockIndex, notes }) {
    setCreateError('');
    setError('');

    if (!residentId) {
      setCreateError('Selecciona el residente de la reserva.');
      return;
    }

    const start = new Date(startAt);
    if (Number.isNaN(start.getTime())) {
      setCreateError('Indica una fecha y hora de inicio válidas.');
      return;
    }
    if (start < new Date()) {
      setCreateError('La hora de inicio debe ser futura.');
      return;
    }
    if (pricingMode === 'blocks' && (blockIndex === undefined || blockIndex === '')) {
      setCreateError('Selecciona un paquete de horas.');
      return;
    }

    const slotMinutes = selectedFacility?.bookingRules?.slotMinutes || 60;
    const end =
      pricingMode === 'blocks'
        ? undefined
        : new Date(start.getTime() + slotMinutes * 60000).toISOString();

    setSubmitting(true);
    try {
      await adminApi.facilityBookings.create({
        facilityId,
        residentId,
        startAt: start.toISOString(),
        endAt: end,
        blockIndex: blockIndex === undefined || blockIndex === '' ? undefined : Number(blockIndex),
        notes,
      });
      setResidentId('');
      await loadFacilitiesAndBookings(facilityId);
    } catch (err) {
      setCreateError(err.message || 'No se pudo crear la reserva.');
    } finally {
      setSubmitting(false);
    }
  }

  async function updateBookingStatus(status) {
    try {
      await adminApi.facilityBookings.update(modal.event.id, { status });
      setModal(null);
      await loadFacilitiesAndBookings(facilityId);
    } catch (err) {
      setError(err.message);
    }
  }

  async function cancelBooking(id) {
    if (!window.confirm('¿Cancelar esta reserva?')) return;
    try {
      await adminApi.facilityBookings.remove(id);
      setModal(null);
      await loadFacilitiesAndBookings(facilityId);
    } catch (err) {
      setError(err.message);
    }
  }

  const upcomingBookings = useMemo(
    () =>
      [...bookings]
        .filter((b) => new Date(b.endAt) >= new Date())
        .sort((a, b) => new Date(a.startAt) - new Date(b.startAt)),
    [bookings]
  );

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <p className="admin-breadcrumb">
          <Link to="/admin/servicios">Servicios del conjunto</Link> / Reservas
        </p>
        <h1>Calendario de reservas</h1>
        <p>
          Elige fecha y hora como en la app de residentes. Las reservas creadas aquí quedan confirmadas para el
          residente.
        </p>
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
        </div>

        {facilityId && selectedFacility ? (
          <FacilityBookingForm
            key={facilityId}
            facility={selectedFacility}
            events={bookings}
            slotMinutes={selectedFacility?.bookingRules?.slotMinutes || 60}
            capacity={selectedFacility?.capacity || 1}
            pricingMode={pricingMode}
            blocks={blocks}
            serviceRequiresPayment={serviceRequiresPayment}
            requiresApproval={Boolean(selectedFacility?.requiresApproval)}
            submitting={submitting}
            submitError={createError}
            onSubmit={handleCreateBooking}
            onMonthChange={setCalendarMonth}
            confirmStepTitle="3. Confirma la reserva"
            submitLabel="Crear reserva"
            showPaymentHints={false}
            confirmExtra={
              <label className="facility-book__field admin-unit-picker-field">
                <span>Residente</span>
                <ResidentSelectField
                  residents={residents}
                  value={residentId}
                  onChange={setResidentId}
                  required
                />
              </label>
            }
          />
        ) : (
          <p className="admin-empty">
            Marca un servicio como reservable en{' '}
            <Link to="/admin/servicios">Servicios del conjunto</Link> para reservar.
          </p>
        )}
      </div>

      {facilityId && upcomingBookings.length > 0 && (
        <div className="admin-card">
          <h2 style={{ marginTop: 0 }}>Próximas reservas (mes visible)</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Reserva</th>
                  <th>Horario</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {upcomingBookings.map((b) => (
                  <tr
                    key={b.id}
                    role="button"
                    tabIndex={0}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setModal({ type: 'view', event: b })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setModal({ type: 'view', event: b });
                      }
                    }}
                  >
                    <td>{b.title || selectedFacility?.name || 'Reserva'}</td>
                    <td>
                      {formatDateTime(b.startAt)} – {formatTime(b.endAt)}
                      {b.totalPrice > 0 && ` · ${formatCop(b.totalPrice)}`}
                    </td>
                    <td>{b.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal?.type === 'view' && (
        <div className="admin-modal-overlay" onClick={() => setModal(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{modal.event.title}</h2>
            <p>
              {formatDateTime(modal.event.startAt)} – {formatDateTime(modal.event.endAt)}
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
