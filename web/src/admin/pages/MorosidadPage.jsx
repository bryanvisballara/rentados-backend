import { useEffect, useState } from 'react';
import { adminApi, formatCop } from '../../api/client';
import '../admin.css';

const emptySuspension = {
  unitId: '',
  facilityIds: [],
  startAt: '',
  endAt: '',
  reason: 'morosidad',
  notes: '',
};

export default function MorosidadPage() {
  const [billing, setBilling] = useState({
    monthlyInterestRatePercent: 1.5,
    gracePeriodDays: 5,
    maxInterestMonths: 12,
    autoSuggestSuspensionOnOverdue: true,
  });
  const [units, setUnits] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [suspensions, setSuspensions] = useState([]);
  const [form, setForm] = useState(emptySuspension);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  async function load() {
    const [settings, u, f, s] = await Promise.all([
      adminApi.billing.getSettings(),
      adminApi.units.list(),
      adminApi.facilities.list(),
      adminApi.suspensions.list(),
    ]);
    setBilling(settings.billing);
    setUnits(u.units);
    setFacilities(f.facilities);
    setSuspensions(s.suspensions);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function saveBilling(e) {
    e.preventDefault();
    try {
      const data = await adminApi.billing.updateSettings(billing);
      setBilling(data.billing);
      setSaved('Configuración de intereses guardada');
      setTimeout(() => setSaved(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  }

  async function createSuspension(e) {
    e.preventDefault();
    try {
      await adminApi.suspensions.create({
        ...form,
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
      });
      setForm(emptySuspension);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function toggleFacility(id) {
    setForm((prev) => {
      const ids = prev.facilityIds.includes(id)
        ? prev.facilityIds.filter((x) => x !== id)
        : [...prev.facilityIds, id];
      return { ...prev, facilityIds: ids };
    });
  }

  async function removeSuspension(id) {
    if (!window.confirm('¿Eliminar esta suspensión de servicios?')) return;
    try {
      await adminApi.suspensions.remove(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deactivateSuspension(id) {
    try {
      await adminApi.suspensions.update(id, { isActive: false });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <h1>Morosidad e intereses</h1>
        <p>
          Define intereses por mora y suspende servicios (gimnasio, salón, piscina, etc.) a unidades morosas
          por fechas. El residente verá esto reflejado en su app de pagos.
        </p>
      </header>

      {error && <div className="admin-error">{error}</div>}
      {saved && <div className="admin-card" style={{ background: '#dceee4', color: '#1e5a3d' }}>{saved}</div>}

      <div className="admin-card">
        <h2>Intereses por morosidad</h2>
        <form className="admin-form" onSubmit={saveBilling}>
          <label>
            Tasa mensual (%)
            <input
              type="number"
              step="0.1"
              min="0"
              value={billing.monthlyInterestRatePercent}
              onChange={(e) =>
                setBilling({ ...billing, monthlyInterestRatePercent: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Días de gracia
            <input
              type="number"
              min="0"
              value={billing.gracePeriodDays}
              onChange={(e) => setBilling({ ...billing, gracePeriodDays: Number(e.target.value) })}
            />
          </label>
          <label>
            Meses máx. de interés
            <input
              type="number"
              min="1"
              value={billing.maxInterestMonths}
              onChange={(e) => setBilling({ ...billing, maxInterestMonths: Number(e.target.value) })}
            />
          </label>
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={billing.autoSuggestSuspensionOnOverdue}
              onChange={(e) =>
                setBilling({ ...billing, autoSuggestSuspensionOnOverdue: e.target.checked })
              }
            />
            <span>Sugerir suspensión al marcar morosidad</span>
          </label>
          <button type="submit" className="admin-btn">
            Guardar intereses
          </button>
        </form>
        <p className="admin-empty" style={{ marginTop: '0.75rem' }}>
          Ejemplo: administración de {formatCop(420000)} con 1 mes de mora al 1.5% → interés ≈{' '}
          {formatCop(Math.round(420000 * 0.015))}
        </p>
      </div>

      <div className="admin-card">
        <h2>Suspender servicios a unidad morosa</h2>
        <form className="admin-form" onSubmit={createSuspension}>
          <label>
            Unidad morosa / pendiente
            <select
              value={form.unitId}
              onChange={(e) => setForm({ ...form, unitId: e.target.value })}
              required
            >
              <option value="">Seleccionar unidad</option>
              {units.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.number} · {u.adminStatus}
                </option>
              ))}
            </select>
          </label>
          <label>
            Desde
            <input
              type="date"
              value={form.startAt}
              onChange={(e) => setForm({ ...form, startAt: e.target.value })}
              required
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              value={form.endAt}
              onChange={(e) => setForm({ ...form, endAt: e.target.value })}
              required
            />
          </label>
          <label style={{ gridColumn: '1 / -1' }}>
            Servicios a suspender
            <div className="admin-checklist">
              {facilities.map((f) => (
                <label key={f._id} className="admin-checkbox">
                  <input
                    type="checkbox"
                    checked={form.facilityIds.includes(f._id)}
                    onChange={() => toggleFacility(f._id)}
                  />
                  <span>
                    {f.name}
                    {f.price > 0 ? ` · ${formatCop(f.price)}` : ' · Gratis'}
                  </span>
                </label>
              ))}
            </div>
          </label>
          <label style={{ gridColumn: '1 / -1' }}>
            Notas
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Ej: Suspensión por mora junio 2026"
            />
          </label>
          <button type="submit" className="admin-btn" disabled={!form.facilityIds.length}>
            Aplicar suspensión
          </button>
        </form>
      </div>

      <div className="admin-card admin-table-wrap">
        <h2>Suspensiones activas y programadas</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Unidad</th>
              <th>Servicios</th>
              <th>Desde</th>
              <th>Hasta</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {suspensions.map((s) => (
              <tr key={s._id}>
                <td>
                  {s.unitId?.number} <span className={`admin-badge admin-badge--${s.unitId?.adminStatus}`}>{s.unitId?.adminStatus}</span>
                </td>
                <td>{s.facilityIds?.map((f) => f.name).join(', ') || '—'}</td>
                <td>{new Date(s.startAt).toLocaleDateString()}</td>
                <td>{new Date(s.endAt).toLocaleDateString()}</td>
                <td>
                  <span className={`admin-badge admin-badge--${s.isActive ? 'overdue' : 'paid'}`}>
                    {s.isActive ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
                <td className="admin-actions">
                  {s.isActive && (
                    <button
                      type="button"
                      className="admin-btn admin-btn--ghost"
                      onClick={() => deactivateSuspension(s._id)}
                    >
                      Levantar
                    </button>
                  )}
                  <button
                    type="button"
                    className="admin-btn admin-btn--danger"
                    onClick={() => removeSuspension(s._id)}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
