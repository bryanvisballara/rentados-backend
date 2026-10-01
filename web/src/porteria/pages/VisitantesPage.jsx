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

const REQUEST_STATUS_LABELS = {
  pending: 'Pendiente',
  acknowledged: 'Atendida',
  cancelled: 'Cancelada',
};

export default function VisitantesPage() {
  const [units, setUnits] = useState([]);
  const [visits, setVisits] = useState([]);
  const [residentRequests, setResidentRequests] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [filterUnitId, setFilterUnitId] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');
  const [filterQuery, setFilterQuery] = useState('');
  const [requestStatus, setRequestStatus] = useState('pending');
  const [requestQuery, setRequestQuery] = useState('');
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

  async function loadResidentRequests(overrides = {}) {
    const data = await porteriaApi.visitorRequests.list({
      status: overrides.status ?? (requestStatus || undefined),
      q: overrides.q ?? (requestQuery || undefined),
    });
    setResidentRequests(data.requests || []);
  }

  useEffect(() => {
    Promise.all([loadUnits(), loadVisits(), loadResidentRequests()]).catch((err) =>
      setError(err.message)
    );
  }, []);

  useEffect(() => {
    loadVisits().catch((err) => setError(err.message));
  }, [filterUnitId, filterStatus]);

  useEffect(() => {
    loadResidentRequests().catch((err) => setError(err.message));
  }, [requestStatus]);

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

  async function handleAcknowledgeRequest(requestId) {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await porteriaApi.visitorRequests.acknowledge(requestId);
      setSuccess('Solicitud marcada como atendida.');
      await loadResidentRequests();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function prefillFromRequest(request) {
    const noteParts = [
      request.licensePlate ? `Placa ${request.licensePlate}` : '',
      request.notes?.trim(),
    ].filter(Boolean);
    setForm({
      unitId: request.unitId ? String(request.unitId) : '',
      visitorName: request.visitorName?.trim() || '',
      documentId: '',
      notes: noteParts.join(' · '),
    });
    setSuccess('Formulario listo: completa la cédula y registra el ingreso.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
        <p>
          Revisa avisos de residentes y registra ingresos al apartamento con nombre y cédula.
        </p>
      </header>

      {error && <div className="admin-error porteria-page__alert">{error}</div>}
      {success && <div className="porteria-page__success">{success}</div>}

      <div className="porteria__card">
        <h2>Solicitudes de residentes</h2>
        <p className="porteria__hint">
          Visitantes que un residente registró desde la app (placa y datos). Marca como atendida
          cuando los recibas o usa el formulario de abajo para registrar el ingreso.
        </p>
        <form className="admin-form" onSubmit={(e) => e.preventDefault()}>
          <label>
            Buscar
            <input
              type="search"
              value={requestQuery}
              onChange={(e) => setRequestQuery(e.target.value)}
              onBlur={() => loadResidentRequests().catch((err) => setError(err.message))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  loadResidentRequests().catch((err) => setError(err.message));
                }
              }}
              placeholder="Placa, nombre, unidad o residente"
            />
          </label>
          <label>
            Estado
            <select value={requestStatus} onChange={(e) => setRequestStatus(e.target.value)}>
              <option value="pending">Pendientes</option>
              <option value="acknowledged">Atendidas</option>
              <option value="">Todas</option>
            </select>
          </label>
        </form>

        <div className="admin-table-wrap" style={{ marginTop: '1rem' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Visitante</th>
                <th>Placa</th>
                <th>Unidad</th>
                <th>Residente</th>
                <th>Esperado</th>
                <th>Registrado</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {residentRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="admin-empty">
                    No hay solicitudes con ese filtro.
                  </td>
                </tr>
              ) : (
                residentRequests.map((request) => (
                  <tr key={request._id}>
                    <td>{request.visitorName || '—'}</td>
                    <td>{request.licensePlate || '—'}</td>
                    <td>
                      {request.unitCode || request.unitNumber || '—'}
                      {request.unitTower ? ` · ${request.unitTower}` : ''}
                    </td>
                    <td>{request.residentName || request.residentEmail || '—'}</td>
                    <td>{request.expectedAt ? formatDateTime(request.expectedAt) : '—'}</td>
                    <td>{request.createdAt ? formatDateTime(request.createdAt) : '—'}</td>
                    <td>
                      <span
                        className={`admin-badge admin-badge--${
                          request.status === 'pending'
                            ? 'pending'
                            : request.status === 'acknowledged'
                              ? 'paid'
                              : 'overdue'
                        }`}
                      >
                        {REQUEST_STATUS_LABELS[request.status] || request.status}
                      </span>
                    </td>
                    <td>
                      <div className="porteria-unit-card__actions">
                        {request.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              className="admin-btn admin-btn--ghost"
                              disabled={saving}
                              onClick={() => prefillFromRequest(request)}
                            >
                              Registrar ingreso
                            </button>
                            <button
                              type="button"
                              className="admin-btn admin-btn--ghost"
                              disabled={saving}
                              onClick={() => handleAcknowledgeRequest(request._id)}
                            >
                              Marcar atendida
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
        <h2>Registro de visitas en portería</h2>
        <p className="porteria__hint">Ingresos y salidas que registraste aquí con cédula.</p>
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
