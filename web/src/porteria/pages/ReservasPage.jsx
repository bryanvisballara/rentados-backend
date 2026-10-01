import { useEffect, useMemo, useState } from 'react';
import FacilityCalendar, { addDays, startOfWeek } from '../../components/FacilityCalendar';
import { formatDateTime, porteriaApi } from '../../api/client';
import { formatOpenHoursRange, resolveFacilityCalendarOpenHours } from '../../utils/openHours';
import '../../components/FacilityCalendar.css';
import '../../admin/admin.css';

export default function ReservasPage() {
  const [facilities, setFacilities] = useState([]);
  const [facilityId, setFacilityId] = useState('');
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState('');

  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);
  const selectedFacility = useMemo(
    () => facilities.find((f) => String(f.id) === String(facilityId)),
    [facilities, facilityId]
  );

  useEffect(() => {
    porteriaApi.facilities
      .list()
      .then((data) => {
        const list = data.facilities || [];
        setFacilities(list);
        if (!facilityId && list[0]) setFacilityId(String(list[0].id));
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!facilityId) return;
    porteriaApi.facilityBookings
      .list({
        facilityId,
        from: weekStart.toISOString(),
        to: weekEnd.toISOString(),
      })
      .then((data) => setBookings(data.bookings || []))
      .catch((err) => setError(err.message));
  }, [facilityId, weekStart, weekEnd]);

  return (
    <div className="porteria-page">
      <header className="porteria-page__header">
        <h1>Reservas de servicios</h1>
        <p>Calendario con residente, unidad y estado (incluye pagos pendientes).</p>
      </header>

      {error && <div className="admin-error porteria-page__alert">{error}</div>}

      <div className="porteria__card">
        <form className="admin-form" onSubmit={(e) => e.preventDefault()}>
          <label>
            Espacio
            <select value={facilityId} onChange={(e) => setFacilityId(e.target.value)}>
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
        </form>

        {selectedFacility && (
          <p className="admin-empty" style={{ marginTop: '0.75rem', textAlign: 'left' }}>
            Horario: {formatOpenHoursRange(selectedFacility.openHours, selectedFacility.open24Hours)}
            {selectedFacility.capacity > 1 ? ` · Cupo ${selectedFacility.capacity} por horario` : ''}
          </p>
        )}

        <div className="resident__bookings-nav" style={{ margin: '0.75rem 0' }}>
          <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setWeekStart(addDays(weekStart, -7))}>
            ←
          </button>
          <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setWeekStart(startOfWeek(new Date()))}>
            Hoy
          </button>
          <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            →
          </button>
        </div>

        {facilityId ? (
          <FacilityCalendar
            weekStart={weekStart}
            facility={selectedFacility}
            openHours={resolveFacilityCalendarOpenHours(selectedFacility)}
            slotMinutes={selectedFacility?.bookingRules?.slotMinutes || 60}
            events={bookings}
          />
        ) : (
          <p className="admin-empty">No hay espacios reservables configurados.</p>
        )}

        {bookings.length > 0 && (
          <ul className="admin-empty" style={{ marginTop: '1rem', textAlign: 'left', listStyle: 'none', padding: 0 }}>
            {bookings.map((b) => (
              <li key={b.id} style={{ marginBottom: '0.35rem' }}>
                <strong>{b.title}</strong> · {b.statusLabel || b.status} ·{' '}
                {formatDateTime(b.startAt)} – {formatDateTime(b.endAt)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
