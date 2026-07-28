import { useEffect, useState } from 'react';
import { formatDateTime, porteriaApi } from '../../api/client';
import UnitSelectField from '../components/UnitSelectField';
import '../../admin/admin.css';
import '../PorteriaHomePage.css';

const emptyForm = {
  unitId: '',
  visitorName: '',
  documentId: '',
  notes: '',
};

export default function VisitantesPage() {
  const [units, setUnits] = useState([]);
  const [visits, setVisits] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [filterUnitId, setFilterUnitId] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');
  const [filterQuery, setFilterQuery] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadUnits() {
    const data = await porteriaApi.units();
    setUnits(data.units || []);
  }

  async function loadVisits(overrides = {}) {
    const data = await porteriaApi.apartmentVisits.list({
      unitId: overrides.unitId ?? (filterUnitId || undefined),
      status: overrides.status ?? (filterStatus || undefined),
      q: overrides.q ?? (filterQuery || undefined),
    });
    setVisits(data.visits || []);
  }

  useEffect(() => {
    Promise.all([loadUnits(), loadVisits()]).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    loadVisits().catch((err) => setError(err.message));
  }, [filterUnitId, filterStatus]);

  async function handleRegister(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await porteriaApi.apartmentVisits.create({
        unitId: form.unitId,
        visitorName: form.visitorName.trim(),
        documentId: form.documentId.trim(),
        notes: form.notes.trim() || undefined,
      });
      setSuccess('Visita registrada.');
      setForm(emptyForm);
      await loadVisits();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleExit(visitId) {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await porteriaApi.apartmentVisits.exit(visitId);
      setSuccess('Salida de visitante registrada.');
      await loadVisits();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="porteria-page">
      <header className="porteria-page__header">
        <h1>Visitantes</h1>
        <p>Registra el ingreso de visitas a los apartamentos con nombre y cédula.</p>
      </header>

      {error && <div className="admin-error porteria-page__alert">{error}</div>}
      {success && <div className="porteria-page__success">{success}</div>}

      <div className="porteria__card">
        <h2>Registrar ingreso</h2>
        <form className="admin-form" onSubmit={handleRegister}>
          <label className="admin-unit-picker-field" style={{ gridColumn: '1 / -1' }}>
            Apartamento a visitar
            <UnitSelectField
              units={units}
              value={form.unitId}
              onChange={(unitId) => setForm({ ...form, unitId })}
              required
              placeholder="Seleccionar unidad"
            />
          </label>
          <label>
            Nombre completo
            <input
              value={form.visitorName}
              onChange={(e) => setForm({ ...form, visitorName: e.target.value })}
              required
              placeholder="Nombre del visitante"
            />
          </label>
          <label>
            Cédula
            <input
              value={form.documentId}
              onChange={(e) => setForm({ ...form, documentId: e.target.value })}
              required
              placeholder="Número de cédula"
            />
          </label>
          <label style={{ gridColumn: '1 / -1' }}>
            Notas (opcional)
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Motivo de la visita, acompañantes…"
            />
          </label>
          <div className="admin-actions" style={{ gridColumn: '1 / -1' }}>
            <button type="submit" className="admin-btn" disabled={saving || !form.unitId}>
              {saving ? 'Registrando…' : 'Registrar ingreso'}
            </button>
          </div>
        </form>
      </div>

      <div className="porteria__card">
        <h2>Registro de visitas</h2>
        <form className="admin-form" onSubmit={(e) => e.preventDefault()}>
          <label>
            Buscar
            <input
              type="search"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              onBlur={() => loadVisits().catch((err) => setError(err.message))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  loadVisits().catch((err) => setError(err.message));
                }
              }}
              placeholder="Nombre, cédula o código"
            />
          </label>
          <label>
            Estado
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="active">Dentro del conjunto</option>
              <option value="exited">Ya salieron</option>
              <option value="">Todas</option>
            </select>
          </label>
          <label className="admin-unit-picker-field">
            Unidad
            <UnitSelectField units={units} value={filterUnitId} onChange={setFilterUnitId} />
          </label>
        </form>

        <div className="admin-table-wrap" style={{ marginTop: '1rem' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Visitante</th>
                <th>Cédula</th>
                <th>Unidad</th>
                <th>Ingreso</th>
                <th>Salida</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="admin-empty">
                    No hay visitas con ese filtro.
                  </td>
                </tr>
              ) : (
                visits.map((visit) => (
                  <tr key={visit._id}>
                    <td>{visit.visitorName}</td>
                    <td>{visit.documentId}</td>
                    <td>
                      {visit.unitCode || visit.unitNumber || '—'}
                      {visit.unitTower ? ` · ${visit.unitTower}` : ''}
                    </td>
                    <td>{visit.entryAt ? formatDateTime(visit.entryAt) : '—'}</td>
                    <td>{visit.exitAt ? formatDateTime(visit.exitAt) : '—'}</td>
                    <td>
                      <span
                        className={`admin-badge admin-badge--${
                          visit.status === 'active' ? 'pending' : 'paid'
                        }`}
                      >
                        {visit.status === 'active' ? 'Dentro' : 'Salió'}
                      </span>
                    </td>
                    <td>
                      {visit.status === 'active' && (
                        <button
                          type="button"
                          className="admin-btn admin-btn--ghost"
                          disabled={saving}
                          onClick={() => handleExit(visit._id)}
                        >
                          Registrar salida
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
