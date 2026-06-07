import { useEffect, useMemo, useRef, useState } from 'react';
import { adminApi, formatCop } from '../../api/client';
import '../admin.css';

function buildOverdueRows(units, payments) {
  const byUnit = new Map();

  payments
    .filter((p) => p.status === 'overdue')
    .forEach((p) => {
      const id = p.unitId?._id || p.unitId;
      if (!id) return;

      const existing = byUnit.get(id) || {
        unitId: id,
        unit: p.unitId,
        totalDue: 0,
        interest: 0,
        periods: [],
      };

      existing.totalDue += p.totalDue || 0;
      existing.interest += p.interestAmount || 0;
      existing.periods.push(p.period);
      byUnit.set(id, existing);
    });

  units
    .filter((u) => u.adminStatus === 'overdue')
    .forEach((u) => {
      if (!byUnit.has(u._id)) {
        byUnit.set(u._id, {
          unitId: u._id,
          unit: u,
          totalDue: 0,
          interest: 0,
          periods: [],
        });
      }
    });

  return Array.from(byUnit.values()).sort((a, b) =>
    String(a.unit?.number || '').localeCompare(String(b.unit?.number || ''), 'es', {
      numeric: true,
    })
  );
}

function normalizeId(id) {
  return String(id);
}

function normalizeBilling(billing) {
  return {
    ...billing,
    autoSuspension: {
      ...billing.autoSuspension,
      facilityIds: (billing.autoSuspension?.facilityIds || []).map(normalizeId),
    },
  };
}

const emptySuspension = {
  facilityIds: [],
  startAt: '',
  endAt: '',
  reason: 'morosidad',
  notes: '',
};

export default function MorosidadPage() {
  const selectAllRef = useRef(null);
  const selectAllFacilitiesRef = useRef(null);
  const [billing, setBilling] = useState({
    defaultAdministrationFee: '',
    monthlyInterestRatePercent: 1.5,
    gracePeriodDays: 5,
    maxInterestMonths: 12,
    autoSuggestSuspensionOnOverdue: true,
    autoSuspension: {
      enabled: false,
      facilityIds: [],
      durationDays: 30,
      autoLiftWhenPaid: true,
    },
  });
  const [overdueRows, setOverdueRows] = useState([]);
  const [selectedUnitIds, setSelectedUnitIds] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [suspensions, setSuspensions] = useState([]);
  const [form, setForm] = useState(emptySuspension);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [savingAuto, setSavingAuto] = useState(false);
  const [syncingAuto, setSyncingAuto] = useState(false);

  const selectedSet = useMemo(() => new Set(selectedUnitIds), [selectedUnitIds]);
  const allSelected = overdueRows.length > 0 && selectedUnitIds.length === overdueRows.length;
  const someSelected = selectedUnitIds.length > 0 && !allSelected;

  const autoFacilityIds = billing.autoSuspension?.facilityIds || [];
  const autoFacilitySet = useMemo(() => new Set(autoFacilityIds.map(normalizeId)), [autoFacilityIds]);
  const allAutoFacilitiesSelected =
    facilities.length > 0 && facilities.every((f) => autoFacilitySet.has(normalizeId(f._id)));
  const someAutoFacilitiesSelected =
    autoFacilitySet.size > 0 && !allAutoFacilitiesSelected;

  async function load() {
    const [settings, unitsData, facilitiesData, suspensionsData, cartera] = await Promise.all([
      adminApi.billing.getSettings(),
      adminApi.units.list(),
      adminApi.facilities.list(),
      adminApi.suspensions.list(),
      adminApi.cartera(),
    ]);

    setBilling(normalizeBilling({
      ...settings.billing,
      defaultAdministrationFee: settings.billing.defaultAdministrationFee ?? '',
    }));
    setOverdueRows(buildOverdueRows(unitsData.units, cartera.payments));
    setFacilities(facilitiesData.facilities);
    setSuspensions(suspensionsData.suspensions);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  useEffect(() => {
    if (selectAllFacilitiesRef.current) {
      selectAllFacilitiesRef.current.indeterminate = someAutoFacilitiesSelected;
    }
  }, [someAutoFacilitiesSelected]);

  async function saveAdminFee(e) {
    e.preventDefault();
    try {
      const data = await adminApi.billing.updateSettings({
        defaultAdministrationFee:
          billing.defaultAdministrationFee === '' ||
          billing.defaultAdministrationFee == null
            ? null
            : Number(billing.defaultAdministrationFee),
      });
      setBilling((prev) => ({
        ...data.billing,
        autoSuspension: prev.autoSuspension,
        defaultAdministrationFee: data.billing.defaultAdministrationFee ?? '',
      }));
      setSaved('Valor de administración guardado');
      setTimeout(() => setSaved(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveBilling(e) {
    e.preventDefault();
    try {
      const { autoSuspension, ...interestSettings } = billing;
      const data = await adminApi.billing.updateSettings(interestSettings);
      setBilling((prev) => ({ ...data.billing, autoSuspension: prev.autoSuspension }));
      setSaved('Configuración de intereses guardada');
      setTimeout(() => setSaved(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveAutoSuspension(e) {
    e.preventDefault();
    setSavingAuto(true);
    setError('');
    setSyncMessage('');

    try {
      const data = await adminApi.billing.updateSettings({
        autoSuspension: billing.autoSuspension,
      });
      setBilling(normalizeBilling(data.billing));
      if (data.syncResult && !data.syncResult.skipped) {
        setSyncMessage(
          `Automáticas aplicadas: ${data.syncResult.created} nuevas, ${data.syncResult.updated} actualizadas, ${data.syncResult.lifted} levantadas.`
        );
      } else if (billing.autoSuspension.enabled) {
        setSyncMessage('Configuración guardada. Usa "Sincronizar ahora" para aplicar a morosos actuales.');
      } else {
        setSyncMessage('Suspensiones automáticas desactivadas.');
      }
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingAuto(false);
    }
  }

  async function runAutoSync() {
    setSyncingAuto(true);
    setError('');
    setSyncMessage('');

    try {
      const data = await adminApi.suspensions.syncAuto();
      const result = data.syncResult;
      if (result.skipped) {
        setSyncMessage(result.reason || 'Las suspensiones automáticas están desactivadas.');
      } else {
        setSyncMessage(
          `Sincronización completada: ${result.created} nuevas, ${result.updated} actualizadas, ${result.lifted} levantadas (${result.overdueUnits} unidad(es) en mora).`
        );
      }
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncingAuto(false);
    }
  }

  function toggleAutoFacility(id) {
    const normalized = normalizeId(id);
    setBilling((prev) => {
      const ids = prev.autoSuspension.facilityIds.map(normalizeId);
      const nextIds = ids.includes(normalized)
        ? ids.filter((x) => x !== normalized)
        : [...ids, normalized];
      return {
        ...prev,
        autoSuspension: { ...prev.autoSuspension, facilityIds: nextIds },
      };
    });
  }

  function toggleAllAutoFacilities(checked) {
    setBilling((prev) => ({
      ...prev,
      autoSuspension: {
        ...prev.autoSuspension,
        facilityIds: checked ? facilities.map((f) => normalizeId(f._id)) : [],
      },
    }));
  }

  function isAutoFacilitySelected(id) {
    return autoFacilitySet.has(normalizeId(id));
  }

  function updateAutoSuspension(field, value) {
    setBilling((prev) => ({
      ...prev,
      autoSuspension: { ...prev.autoSuspension, [field]: value },
    }));
  }

  function toggleUnit(unitId) {
    setSelectedUnitIds((prev) =>
      prev.includes(unitId) ? prev.filter((id) => id !== unitId) : [...prev, unitId]
    );
  }

  function toggleAll(checked) {
    setSelectedUnitIds(checked ? overdueRows.map((row) => row.unitId) : []);
  }

  async function createSuspension(e) {
    e.preventDefault();
    if (!selectedUnitIds.length || !form.facilityIds.length) return;

    setSubmitting(true);
    setError('');

    try {
      const payload = {
        facilityIds: form.facilityIds,
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
        reason: form.reason,
        notes: form.notes,
      };

      await Promise.all(
        selectedUnitIds.map((unitId) => adminApi.suspensions.create({ ...payload, unitId }))
      );

      setSelectedUnitIds([]);
      setForm(emptySuspension);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function toggleFacility(id) {
    const normalized = normalizeId(id);
    setForm((prev) => {
      const ids = prev.facilityIds.map(normalizeId);
      const nextIds = ids.includes(normalized)
        ? ids.filter((x) => x !== normalized)
        : [...ids, normalized];
      return { ...prev, facilityIds: nextIds };
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
      {saved && (
        <div className="admin-card" style={{ background: '#dceee4', color: '#1e5a3d' }}>
          {saved}
        </div>
      )}
      {syncMessage && (
        <div className="admin-card" style={{ background: '#eef4ff', color: '#1e3a5f' }}>
          {syncMessage}
        </div>
      )}

      <div className="admin-card">
        <h2>Valor de administración</h2>
        <p className="admin-empty" style={{ marginTop: 0 }}>
          Cuota mensual base del conjunto. Las unidades nuevas la heredan automáticamente; puedes
          personalizarla por apartamento en Torres y unidades.
        </p>
        <form className="admin-form" onSubmit={saveAdminFee}>
          <label>
            Cuota mensual por defecto (COP)
            <input
              type="number"
              min="0"
              step="1000"
              value={billing.defaultAdministrationFee ?? ''}
              onChange={(e) =>
                setBilling({ ...billing, defaultAdministrationFee: e.target.value })
              }
              placeholder="Ej: 420000"
            />
          </label>
          <button type="submit" className="admin-btn">
            Guardar valor
          </button>
        </form>
      </div>

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
          Ejemplo: administración de{' '}
          {formatCop(billing.defaultAdministrationFee || 420000)} con 1 mes de mora al 1.5% → interés ≈{' '}
          {formatCop(Math.round((billing.defaultAdministrationFee || 420000) * 0.015))}
        </p>
      </div>

      <div className="admin-card">
        <h2>Suspensiones automáticas</h2>
        <p className="admin-empty" style={{ marginTop: 0 }}>
          Al detectar morosidad en cartera o al marcar una unidad como morosa, el sistema suspende los
          servicios seleccionados por la duración definida. Si la unidad paga, puede levantarse sola.
        </p>

        <form className="admin-form" onSubmit={saveAutoSuspension}>
          <label className="admin-checkbox" style={{ gridColumn: '1 / -1' }}>
            <input
              type="checkbox"
              checked={billing.autoSuspension.enabled}
              onChange={(e) => updateAutoSuspension('enabled', e.target.checked)}
            />
            <span>Activar suspensiones automáticas por morosidad</span>
          </label>

          <label>
            Duración (días)
            <input
              type="number"
              min="1"
              value={billing.autoSuspension.durationDays}
              onChange={(e) => updateAutoSuspension('durationDays', Number(e.target.value))}
            />
          </label>

          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={billing.autoSuspension.autoLiftWhenPaid}
              onChange={(e) => updateAutoSuspension('autoLiftWhenPaid', e.target.checked)}
            />
            <span>Levantar suspensión al salir de mora</span>
          </label>

          <label style={{ gridColumn: '1 / -1' }}>
            Servicios a suspender automáticamente
            <div className="admin-table-wrap" style={{ marginTop: '0.75rem' }}>
              <table className="admin-table admin-table--selectable">
                <thead>
                  <tr>
                    <th className="admin-table__check">
                      <label className="admin-checkbox admin-checkbox--table">
                        <input
                          ref={selectAllFacilitiesRef}
                          type="checkbox"
                          checked={allAutoFacilitiesSelected}
                          onChange={(e) => toggleAllAutoFacilities(e.target.checked)}
                          disabled={!facilities.length}
                          aria-label="Seleccionar todos los servicios"
                        />
                      </label>
                    </th>
                    <th>Servicio</th>
                    <th>Costo</th>
                  </tr>
                </thead>
                <tbody>
                  {facilities.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="admin-empty">
                        No hay servicios registrados en el conjunto.
                      </td>
                    </tr>
                  ) : (
                    facilities.map((f) => (
                      <tr
                        key={f._id}
                        className={isAutoFacilitySelected(f._id) ? 'is-selected' : ''}
                      >
                        <td className="admin-table__check">
                          <label className="admin-checkbox admin-checkbox--table">
                            <input
                              type="checkbox"
                              checked={isAutoFacilitySelected(f._id)}
                              onChange={() => toggleAutoFacility(f._id)}
                              aria-label={`Suspender automáticamente ${f.name}`}
                            />
                          </label>
                        </td>
                        <td>{f.name}</td>
                        <td>
                          {f.price > 0
                            ? `${formatCop(f.price)} · ${f.pricingType === 'monthly' ? 'Mensual' : f.pricingType === 'per_use' ? 'Por uso' : 'Gratis'}`
                            : 'Gratis'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </label>

          <div className="admin-actions" style={{ gridColumn: '1 / -1' }}>
            <button
              type="submit"
              className="admin-btn"
              disabled={savingAuto || (billing.autoSuspension.enabled && !billing.autoSuspension.facilityIds.length)}
            >
              {savingAuto ? 'Guardando…' : 'Guardar reglas automáticas'}
            </button>
            <button
              type="button"
              className="admin-btn admin-btn--ghost"
              onClick={runAutoSync}
              disabled={syncingAuto || !billing.autoSuspension.enabled}
            >
              {syncingAuto ? 'Sincronizando…' : 'Sincronizar ahora'}
            </button>
          </div>
        </form>
      </div>

      <div className="admin-card">
        <h2>Suspender servicios a unidades morosas</h2>
        <p className="admin-empty" style={{ marginTop: 0 }}>
          Selecciona las unidades en mora según cartera e intereses configurados. Puedes marcar todas o
          elegir filas individuales.
        </p>

        <form onSubmit={createSuspension}>
          <div className="admin-table-wrap" style={{ marginTop: '1rem' }}>
            <table className="admin-table admin-table--selectable">
              <thead>
                <tr>
                  <th className="admin-table__check">
                    <label className="admin-checkbox admin-checkbox--table">
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        checked={allSelected}
                        onChange={(e) => toggleAll(e.target.checked)}
                        disabled={!overdueRows.length}
                        aria-label="Seleccionar todas las unidades morosas"
                      />
                    </label>
                  </th>
                  <th>Unidad</th>
                  <th>Torre</th>
                  <th>Periodos en mora</th>
                  <th>Interés</th>
                  <th>Total adeudado</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {overdueRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="admin-empty">
                      No hay unidades en mora según la cartera y el estado definido por administración.
                    </td>
                  </tr>
                ) : (
                  overdueRows.map((row) => (
                    <tr key={row.unitId} className={selectedSet.has(row.unitId) ? 'is-selected' : ''}>
                      <td className="admin-table__check">
                        <label className="admin-checkbox admin-checkbox--table">
                          <input
                            type="checkbox"
                            checked={selectedSet.has(row.unitId)}
                            onChange={() => toggleUnit(row.unitId)}
                            aria-label={`Seleccionar unidad ${row.unit?.number}`}
                          />
                        </label>
                      </td>
                      <td>{row.unit?.number || '—'}</td>
                      <td>{row.unit?.tower || '—'}</td>
                      <td>{row.periods.length ? row.periods.join(', ') : '—'}</td>
                      <td>{formatCop(row.interest)}</td>
                      <td>{formatCop(row.totalDue)}</td>
                      <td>
                        <span className="admin-badge admin-badge--overdue">En mora</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="admin-form" style={{ marginTop: '1rem' }}>
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
                      checked={form.facilityIds.map(normalizeId).includes(normalizeId(f._id))}
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
            <button
              type="submit"
              className="admin-btn"
              disabled={
                submitting ||
                !selectedUnitIds.length ||
                !form.facilityIds.length ||
                !form.startAt ||
                !form.endAt
              }
            >
              {submitting
                ? 'Aplicando…'
                : `Aplicar suspensión${selectedUnitIds.length ? ` (${selectedUnitIds.length})` : ''}`}
            </button>
          </div>
        </form>
      </div>

      <div className="admin-card admin-table-wrap">
        <h2>Suspensiones activas y programadas</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Unidad</th>
              <th>Servicios</th>
              <th>Tipo</th>
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
                  {s.unitId?.number}{' '}
                  <span className={`admin-badge admin-badge--${s.unitId?.adminStatus}`}>
                    {s.unitId?.adminStatus}
                  </span>
                </td>
                <td>{s.facilityIds?.map((f) => f.name).join(', ') || '—'}</td>
                <td>
                  <span className={`admin-badge admin-badge--${s.isAutomatic ? 'pending' : 'open'}`}>
                    {s.isAutomatic ? 'Automática' : 'Manual'}
                  </span>
                </td>
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
