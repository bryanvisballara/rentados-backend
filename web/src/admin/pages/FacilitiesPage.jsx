import { useEffect, useState } from 'react';
import { adminApi } from '../../api/client';
import '../admin.css';

function statusBadge(status) {
  const map = { open: 'open', maintenance: 'maintenance', closed: 'closed' };
  return map[status] || 'pending';
}

export default function FacilitiesPage() {
  const [facilities, setFacilities] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    description: '',
    capacity: '',
    seasonOpenDate: '',
    seasonCloseDate: '',
    openStart: '06:00',
    openEnd: '22:00',
  });

  async function load() {
    const data = await adminApi.facilities.list();
    setFacilities(data.facilities);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await adminApi.facilities.create({
        name: form.name,
        description: form.description,
        capacity: form.capacity ? Number(form.capacity) : undefined,
        seasonOpenDate: form.seasonOpenDate || undefined,
        seasonCloseDate: form.seasonCloseDate || undefined,
        openHours: { start: form.openStart, end: form.openEnd },
      });
      setForm({
        name: '',
        description: '',
        capacity: '',
        seasonOpenDate: '',
        seasonCloseDate: '',
        openStart: '06:00',
        openEnd: '22:00',
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function closeForMaintenance(id) {
    const reason = window.prompt('Motivo del cierre temporal:');
    if (!reason) return;
    const end = new Date();
    end.setDate(end.getDate() + 7);
    try {
      await adminApi.facilities.maintenance(id, {
        startAt: new Date().toISOString(),
        endAt: end.toISOString(),
        reason,
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function reopen(id) {
    try {
      await adminApi.facilities.reopen(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <h1>Servicios del conjunto</h1>
        <p>Gimnasio, salón social, piscina, BBQ y horarios de apertura.</p>
      </header>

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-card">
        <h2>Agregar servicio</h2>
        <form className="admin-form" onSubmit={handleCreate}>
          <label>
            Nombre
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>
            Capacidad
            <input
              type="number"
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })}
            />
          </label>
          <label>
            Apertura temporada
            <input
              type="date"
              value={form.seasonOpenDate}
              onChange={(e) => setForm({ ...form, seasonOpenDate: e.target.value })}
            />
          </label>
          <label>
            Cierre temporada
            <input
              type="date"
              value={form.seasonCloseDate}
              onChange={(e) => setForm({ ...form, seasonCloseDate: e.target.value })}
            />
          </label>
          <label>
            Hora apertura
            <input
              type="time"
              value={form.openStart}
              onChange={(e) => setForm({ ...form, openStart: e.target.value })}
            />
          </label>
          <label>
            Hora cierre
            <input
              type="time"
              value={form.openEnd}
              onChange={(e) => setForm({ ...form, openEnd: e.target.value })}
            />
          </label>
          <label style={{ gridColumn: '1 / -1' }}>
            Descripción
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <button type="submit" className="admin-btn">
            Crear servicio
          </button>
        </form>
      </div>

      <div className="admin-card admin-table-wrap">
        <h2>Servicios registrados</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Servicio</th>
              <th>Horario</th>
              <th>Temporada</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {facilities.map((f) => (
              <tr key={f._id}>
                <td>{f.name}</td>
                <td>
                  {f.openHours?.start} – {f.openHours?.end}
                </td>
                <td>
                  {f.seasonOpenDate
                    ? `${new Date(f.seasonOpenDate).toLocaleDateString()} – ${new Date(f.seasonCloseDate).toLocaleDateString()}`
                    : '—'}
                </td>
                <td>
                  <span className={`admin-badge admin-badge--${statusBadge(f.status)}`}>{f.status}</span>
                </td>
                <td className="admin-actions">
                  {f.status === 'maintenance' ? (
                    <button type="button" className="admin-btn admin-btn--ghost" onClick={() => reopen(f._id)}>
                      Reabrir
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="admin-btn admin-btn--ghost"
                      onClick={() => closeForMaintenance(f._id)}
                    >
                      Cierre temporal
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
