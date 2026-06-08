import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { platformApi } from '../../api/client';
import '../../admin/admin.css';
import './ConjuntoAppAdoptionPage.css';

const REASON_SUGGESTIONS = [
  'No tiene smartphone',
  'No sabe cómo descargar la app',
  'No quiere usar la app',
  'No estaba en casa',
  'Pendiente segunda visita',
  'Prefiere canales tradicionales',
];

const emptyFollowUp = {
  visitorName: '',
  reason: '',
  notes: '',
};

export default function ConjuntoAppAdoptionPage() {
  const { buildingId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [onlyPending, setOnlyPending] = useState(false);
  const [activeUnitId, setActiveUnitId] = useState(null);
  const [followUpForm, setFollowUpForm] = useState(emptyFollowUp);
  const [saving, setSaving] = useState(false);

  async function load() {
    const response = await platformApi.buildingAppAdoption(buildingId, {
      onlyWithoutApp: true,
    });
    setData(response);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [buildingId]);

  const units = data?.units || [];
  const summary = data?.summary || {};

  const visibleUnits = useMemo(() => {
    const term = search.trim().toLowerCase();
    return units.filter((unit) => {
      if (onlyPending && unit.latestFollowUp) return false;
      if (!term) return true;
      const haystack = [
        unit.code,
        unit.number,
        unit.tower,
        ...(unit.residents || []).flatMap((resident) => [
          resident.firstName,
          resident.lastName,
          resident.email,
          resident.phone,
        ]),
        unit.latestFollowUp?.reason,
        unit.latestFollowUp?.visitorName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [units, search, onlyPending]);

  function openFollowUp(unitId) {
    setActiveUnitId(String(unitId));
    setFollowUpForm(emptyFollowUp);
    setSuccess('');
    setError('');
  }

  async function submitFollowUp(e) {
    e.preventDefault();
    if (!activeUnitId) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await platformApi.createUnitAppFollowUp(activeUnitId, followUpForm);
      setSuccess('Seguimiento registrado.');
      setActiveUnitId(null);
      setFollowUpForm(emptyFollowUp);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const activeUnit = units.find((unit) => String(unit.unitId) === activeUnitId);

  return (
    <div className="admin-page app-adoption-page">
      <header className="admin-page__header">
        <Link to="/super-admin/conjuntos" className="app-adoption-back">
          ← Volver a conjuntos
        </Link>
        <h1>{data?.building?.name || 'Adopción de la app'}</h1>
        <p>
          Apartamentos sin app activa en los últimos 30 días. Registra visitas y motivos para
          impulsar la descarga.
        </p>
      </header>

      {error && <div className="admin-error">{error}</div>}
      {success && <div className="admin-success">{success}</div>}

      {summary.totalApartments > 0 && (
        <div className="conjuntos-summary app-adoption-summary">
          <div className="admin-stat">
            <p className="admin-stat__label">Apartamentos</p>
            <p className="admin-stat__value">{summary.totalApartments}</p>
          </div>
          <div className="admin-stat">
            <p className="admin-stat__label">Con app activa</p>
            <p className="admin-stat__value">{summary.unitsWithActiveApp}</p>
          </div>
          <div className="admin-stat">
            <p className="admin-stat__label">Sin app activa</p>
            <p className="admin-stat__value admin-stat__value--warn">
              {summary.unitsWithoutApp}
            </p>
          </div>
          <div className="admin-stat">
            <p className="admin-stat__label">Adopción</p>
            <p className="admin-stat__value">{summary.appAdoptionRate}%</p>
          </div>
          <div className="admin-stat">
            <p className="admin-stat__label">Con seguimiento</p>
            <p className="admin-stat__value">{summary.unitsWithFollowUp}</p>
          </div>
          <div className="admin-stat">
            <p className="admin-stat__label">Pendientes visita</p>
            <p className="admin-stat__value admin-stat__value--alert">
              {summary.unitsPendingFollowUp}
            </p>
          </div>
        </div>
      )}

      <div className="admin-card conjuntos-table-card">
        <div className="conjuntos-table-card__head">
          <h2>Apartamentos sin app activa</h2>
          <p>
            App activa = al menos un residente con sesión en la app durante los últimos 30 días.
          </p>
        </div>

        <div className="app-adoption-toolbar">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar apto, torre o contacto…"
          />
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={onlyPending}
              onChange={(e) => setOnlyPending(e.target.checked)}
            />
            Solo sin seguimiento registrado
          </label>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Apto</th>
                <th>Torre</th>
                <th>Contacto</th>
                <th>Último seguimiento</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {!data ? (
                <tr>
                  <td colSpan={5} className="admin-empty">
                    Cargando apartamentos…
                  </td>
                </tr>
              ) : visibleUnits.length === 0 ? (
                <tr>
                  <td colSpan={5} className="admin-empty">
                    No hay apartamentos con este filtro.
                  </td>
                </tr>
              ) : (
                visibleUnits.map((unit) => (
                  <tr key={unit.unitId}>
                    <td>
                      <span className="conjuntos-metric">{unit.code || unit.number}</span>
                      {unit.floor != null && (
                        <span className="conjuntos-metric-sub">Piso {unit.floor}</span>
                      )}
                    </td>
                    <td>{unit.tower || '—'}</td>
                    <td>
                      {unit.residents?.length ? (
                        unit.residents.map((resident) => (
                          <span key={resident.id} className="app-adoption-contact">
                            {resident.firstName} {resident.lastName}
                            {resident.phone ? ` · ${resident.phone}` : ''}
                            {!resident.phone && resident.email ? ` · ${resident.email}` : ''}
                          </span>
                        ))
                      ) : (
                        <span className="conjuntos-metric-sub">Sin residente registrado</span>
                      )}
                    </td>
                    <td>
                      {unit.latestFollowUp ? (
                        <>
                          <span className="conjuntos-metric">{unit.latestFollowUp.reason}</span>
                          <span className="conjuntos-metric-sub">
                            {unit.latestFollowUp.visitorName
                              ? `${unit.latestFollowUp.visitorName} · `
                              : ''}
                            {new Date(unit.latestFollowUp.createdAt).toLocaleDateString('es-CO')}
                          </span>
                          {unit.latestFollowUp.notes && (
                            <span className="conjuntos-metric-sub">{unit.latestFollowUp.notes}</span>
                          )}
                        </>
                      ) : (
                        <span className="conjuntos-metric-sub">Sin visita registrada</span>
                      )}
                    </td>
                    <td className="admin-actions">
                      <button
                        type="button"
                        className="admin-btn"
                        onClick={() => openFollowUp(unit.unitId)}
                      >
                        Registrar visita
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {activeUnit && (
        <div className="app-adoption-modal" role="dialog" aria-modal="true">
          <div className="app-adoption-modal__backdrop" onClick={() => setActiveUnitId(null)} />
          <div className="admin-card app-adoption-modal__panel">
            <h2>Registrar visita · {activeUnit.code || activeUnit.number}</h2>
            <p className="conjuntos-metric-sub">
              {activeUnit.tower}
              {activeUnit.floor != null ? ` · Piso ${activeUnit.floor}` : ''}
            </p>

            <form className="admin-form" onSubmit={submitFollowUp}>
              <label>
                Visitador
                <input
                  value={followUpForm.visitorName}
                  onChange={(e) =>
                    setFollowUpForm({ ...followUpForm, visitorName: e.target.value })
                  }
                  placeholder="Nombre del visitador"
                />
              </label>
              <label style={{ gridColumn: '1 / -1' }}>
                Razón por la que no tiene la app activa
                <textarea
                  value={followUpForm.reason}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, reason: e.target.value })}
                  placeholder="Ej. No estaba en casa, no tiene smartphone…"
                  required
                  rows={3}
                />
              </label>
              <div className="app-adoption-suggestions" style={{ gridColumn: '1 / -1' }}>
                {REASON_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="admin-btn admin-btn--ghost app-adoption-suggestion"
                    onClick={() => setFollowUpForm({ ...followUpForm, reason: suggestion })}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
              <label style={{ gridColumn: '1 / -1' }}>
                Notas adicionales (opcional)
                <textarea
                  value={followUpForm.notes}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, notes: e.target.value })}
                  rows={2}
                />
              </label>
              <div className="admin-actions" style={{ gridColumn: '1 / -1' }}>
                <button type="submit" className="admin-btn" disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar seguimiento'}
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  onClick={() => setActiveUnitId(null)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
