import { useEffect, useMemo, useRef, useState } from 'react';
import { adminApi } from '../../api/client';
import '../admin.css';

const emptyTower = { name: '', code: '', floors: '' };
const emptyUnit = { number: '', type: 'apartment', towerId: '', floor: '', adminStatus: 'current' };

function createBulkRow(overrides = {}) {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    number: '',
    floor: '',
    type: 'apartment',
    adminStatus: 'current',
    existing: false,
    unitId: null,
    ...overrides,
  };
}

function createBulkRows(count = 3) {
  return Array.from({ length: count }, () => createBulkRow());
}

function getUnitsForTower(towerId, allUnits) {
  if (towerId) {
    return allUnits.filter((u) => (u.towerId?._id || u.towerId)?.toString() === towerId);
  }
  return allUnits.filter((u) => !u.towerId);
}

function unitToBulkRow(unit) {
  return createBulkRow({
    unitId: unit._id,
    existing: true,
    number: unit.number,
    floor: unit.floor ?? '',
    type: unit.type,
    adminStatus: unit.adminStatus,
  });
}

function buildBulkRows(towerId, allUnits) {
  const existing = getUnitsForTower(towerId, allUnits)
    .map(unitToBulkRow)
    .sort((a, b) =>
      String(a.number).localeCompare(String(b.number), 'es', { numeric: true })
    );
  return [...existing, ...createBulkRows(existing.length ? 3 : 5)];
}

export default function TowersPage() {
  const [towers, setTowers] = useState([]);
  const [units, setUnits] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [towerForm, setTowerForm] = useState(emptyTower);
  const [unitForm, setUnitForm] = useState(emptyUnit);
  const [bulkTowerId, setBulkTowerId] = useState('');
  const [bulkRows, setBulkRows] = useState([]);
  const [savingBulk, setSavingBulk] = useState(false);
  const [replicateSourceId, setReplicateSourceId] = useState('');
  const [replicateTargetIds, setReplicateTargetIds] = useState([]);
  const [replicating, setReplicating] = useState(false);
  const replicateSelectAllRef = useRef(null);
  const [editingTowerId, setEditingTowerId] = useState(null);
  const [editingUnitId, setEditingUnitId] = useState(null);

  async function load() {
    const [t, u] = await Promise.all([adminApi.towers.list(), adminApi.units.list()]);
    setTowers(t.towers);
    setUnits(u.units);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (editingUnitId) return;
    setBulkRows(buildBulkRows(bulkTowerId, units));
  }, [bulkTowerId, units, editingUnitId]);

  async function saveTower(e) {
    e.preventDefault();
    try {
      const body = {
        ...towerForm,
        floors: towerForm.floors ? Number(towerForm.floors) : undefined,
      };
      if (editingTowerId) {
        await adminApi.towers.update(editingTowerId, body);
        setEditingTowerId(null);
      } else {
        await adminApi.towers.create(body);
      }
      setTowerForm(emptyTower);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveUnit(e) {
    e.preventDefault();
    try {
      const body = {
        ...unitForm,
        towerId: unitForm.towerId || null,
        floor: unitForm.floor ? Number(unitForm.floor) : undefined,
      };
      await adminApi.units.update(editingUnitId, body);
      setEditingUnitId(null);
      setUnitForm(emptyUnit);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function updateBulkRow(key, field, value) {
    setBulkRows((rows) =>
      rows.map((row) => (row.key === key && !row.existing ? { ...row, [field]: value } : row))
    );
  }

  function addBulkRow() {
    setBulkRows((rows) => [...rows, createBulkRow()]);
  }

  function removeBulkRow(key) {
    setBulkRows((rows) => rows.filter((row) => row.key !== key || row.existing));
  }

  async function saveBulkUnits(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    const items = bulkRows.filter((row) => !row.existing && row.number.trim());
    if (!items.length) {
      setError('Agrega al menos una unidad nueva con número');
      return;
    }

    setSavingBulk(true);
    try {
      const data = await adminApi.units.bulkCreate({
        towerId: bulkTowerId || null,
        units: items.map(({ number, floor, type, adminStatus }) => ({
          number,
          floor,
          type,
          adminStatus,
        })),
      });

      const failed = data.errors?.length || 0;
      setSuccess(
        failed
          ? `${data.created} unidad(es) nueva(s) creada(s). ${failed} no se pudieron guardar.`
          : `${data.created} unidad(es) nueva(s) creada(s) correctamente.`
      );
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingBulk(false);
    }
  }

  function startEditTower(tower) {
    setEditingTowerId(tower._id);
    setTowerForm({
      name: tower.name,
      code: tower.code,
      floors: tower.floors ?? '',
    });
  }

  function startEditUnit(unit) {
    setEditingUnitId(unit._id);
    setUnitForm({
      number: unit.number,
      type: unit.type,
      towerId: unit.towerId?._id || '',
      floor: unit.floor ?? '',
      adminStatus: unit.adminStatus,
    });
  }

  async function removeTower(id) {
    if (!window.confirm('¿Eliminar esta torre?')) return;
    try {
      await adminApi.towers.remove(id);
      if (editingTowerId === id) {
        setEditingTowerId(null);
        setTowerForm(emptyTower);
      }
      if (bulkTowerId === id) setBulkTowerId('');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeUnit(id) {
    if (!window.confirm('¿Eliminar esta unidad?')) return;
    try {
      await adminApi.units.remove(id);
      if (editingUnitId === id) {
        setEditingUnitId(null);
        setUnitForm(emptyUnit);
      }
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function toggleReplicateTarget(towerId) {
    setReplicateTargetIds((prev) =>
      prev.includes(towerId) ? prev.filter((id) => id !== towerId) : [...prev, towerId]
    );
  }

  function toggleAllReplicateTargets(checked) {
    setReplicateTargetIds(checked ? targetTowerOptions.map((t) => t._id) : []);
  }

  async function replicateTowerUnits(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setReplicating(true);

    try {
      const data = await adminApi.units.replicateTower({
        sourceTowerId: replicateSourceId,
        targetTowerIds: replicateTargetIds,
        skipExisting: true,
      });

      setSuccess(
        `Replicación completada: ${data.created} unidad(es) creada(s)` +
          (data.skipped ? `, ${data.skipped} ya existían` : '') +
          ` desde ${data.sourceTower} hacia ${data.targetTowers.join(', ')}.`
      );
      setReplicateTargetIds([]);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setReplicating(false);
    }
  }

  const selectedBulkTower = towers.find((t) => t._id === bulkTowerId);
  const existingBulkCount = bulkRows.filter((row) => row.existing).length;
  const newBulkCount = bulkRows.filter((row) => !row.existing && row.number.trim()).length;

  const sourceUnits = useMemo(
    () => getUnitsForTower(replicateSourceId, units),
    [replicateSourceId, units]
  );
  const targetTowerOptions = useMemo(
    () => towers.filter((t) => t._id !== replicateSourceId),
    [towers, replicateSourceId]
  );
  const allTargetsSelected =
    targetTowerOptions.length > 0 && replicateTargetIds.length === targetTowerOptions.length;
  const someTargetsSelected =
    replicateTargetIds.length > 0 && replicateTargetIds.length < targetTowerOptions.length;

  useEffect(() => {
    if (replicateSelectAllRef.current) {
      replicateSelectAllRef.current.indeterminate = someTargetsSelected;
    }
  }, [someTargetsSelected]);

  useEffect(() => {
    setReplicateTargetIds((prev) => prev.filter((id) => id !== replicateSourceId));
  }, [replicateSourceId]);

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <h1>Torres y unidades</h1>
        <p>Crea, edita y elimina torres, apartamentos y casas del conjunto.</p>
      </header>

      {error && <div className="admin-error">{error}</div>}
      {success && (
        <div className="admin-card" style={{ background: '#dceee4', color: '#1e5a3d' }}>
          {success}
        </div>
      )}

      <div className="admin-card">
        <h2>{editingTowerId ? 'Editar torre' : 'Nueva torre'}</h2>
        <form className="admin-form" onSubmit={saveTower}>
          <label>
            Nombre
            <input
              value={towerForm.name}
              onChange={(e) => setTowerForm({ ...towerForm, name: e.target.value })}
              required
            />
          </label>
          <label>
            Código
            <input
              value={towerForm.code}
              onChange={(e) => setTowerForm({ ...towerForm, code: e.target.value })}
              required
            />
          </label>
          <label>
            Pisos
            <input
              type="number"
              value={towerForm.floors}
              onChange={(e) => setTowerForm({ ...towerForm, floors: e.target.value })}
            />
          </label>
          <div className="admin-actions">
            <button type="submit" className="admin-btn">
              {editingTowerId ? 'Guardar torre' : 'Agregar torre'}
            </button>
            {editingTowerId && (
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                onClick={() => {
                  setEditingTowerId(null);
                  setTowerForm(emptyTower);
                }}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="admin-card">
        <h2>{editingUnitId ? 'Editar unidad' : 'Nueva unidad'}</h2>
        {!editingUnitId ? (
          <>
            <p className="admin-empty" style={{ marginTop: 0 }}>
              Selecciona una torre para ver las unidades ya registradas y agregar nuevas filas al final.
              Las unidades existentes aparecen en gris; solo se crean las filas nuevas.
            </p>
            <form onSubmit={saveBulkUnits}>
              <div className="admin-form" style={{ marginTop: '1rem' }}>
                <label>
                  Torre
                  <select
                    value={bulkTowerId}
                    onChange={(e) => setBulkTowerId(e.target.value)}
                  >
                    <option value="">Sin torre (casas / comerciales)</option>
                    {towers.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                {selectedBulkTower && (
                  <label>
                    Unidades registradas
                    <input value={`${existingBulkCount} en ${selectedBulkTower.name}`} readOnly />
                  </label>
                )}
              </div>

              {bulkRows.length === 0 && !bulkTowerId && towers.length > 0 && (
                <p className="admin-empty" style={{ marginTop: '1rem' }}>
                  Selecciona una torre para cargar sus unidades.
                </p>
              )}

              <div className="admin-table-wrap" style={{ marginTop: '1rem' }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Número</th>
                      <th>Piso</th>
                      <th>Tipo</th>
                      <th>Estado admin</th>
                      <th>Situación</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="admin-empty">
                          {bulkTowerId || !towers.length
                            ? 'No hay unidades registradas en esta torre. Usa las filas nuevas abajo.'
                            : 'Selecciona una torre para ver sus unidades.'}
                        </td>
                      </tr>
                    ) : (
                      bulkRows.map((row) => (
                        <tr key={row.key} className={row.existing ? 'is-existing' : ''}>
                          <td>
                            <input
                              className="admin-table-input"
                              value={row.number}
                              onChange={(e) => updateBulkRow(row.key, 'number', e.target.value)}
                              placeholder={bulkTowerId ? 'Ej: 701' : 'Ej: Casa 12'}
                              readOnly={row.existing}
                            />
                          </td>
                          <td>
                            <input
                              className="admin-table-input admin-table-input--sm"
                              type="number"
                              value={row.floor}
                              onChange={(e) => updateBulkRow(row.key, 'floor', e.target.value)}
                              placeholder="—"
                              readOnly={row.existing}
                            />
                          </td>
                          <td>
                            <select
                              className="admin-table-input"
                              value={row.type}
                              onChange={(e) => updateBulkRow(row.key, 'type', e.target.value)}
                              disabled={row.existing}
                            >
                              <option value="apartment">Apartamento</option>
                              <option value="house">Casa</option>
                              <option value="commercial">Comercial</option>
                            </select>
                          </td>
                          <td>
                            <select
                              className="admin-table-input"
                              value={row.adminStatus}
                              onChange={(e) => updateBulkRow(row.key, 'adminStatus', e.target.value)}
                              disabled={row.existing}
                            >
                              <option value="current">Al día</option>
                              <option value="pending">Pendiente</option>
                              <option value="overdue">Moroso</option>
                            </select>
                          </td>
                          <td>
                            <span
                              className={`admin-badge admin-badge--${row.existing ? 'paid' : 'pending'}`}
                            >
                              {row.existing ? 'Registrada' : 'Nueva'}
                            </span>
                          </td>
                          <td className="admin-actions">
                            {!row.existing && (
                              <button
                                type="button"
                                className="admin-btn admin-btn--ghost"
                                onClick={() => removeBulkRow(row.key)}
                                aria-label="Quitar fila"
                              >
                                Quitar
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="admin-actions" style={{ marginTop: '1rem' }}>
                <button type="button" className="admin-btn admin-btn--ghost" onClick={addBulkRow}>
                  + Agregar fila nueva
                </button>
                <button type="submit" className="admin-btn" disabled={savingBulk || !newBulkCount}>
                  {savingBulk
                    ? 'Guardando…'
                    : `Guardar unidades nuevas${newBulkCount ? ` (${newBulkCount})` : ''}`}
                </button>
              </div>
            </form>
          </>
        ) : (
          <form className="admin-form" onSubmit={saveUnit}>
            <label>
              Número
              <input
                value={unitForm.number}
                onChange={(e) => setUnitForm({ ...unitForm, number: e.target.value })}
                required
              />
            </label>
            <label>
              Tipo
              <select
                value={unitForm.type}
                onChange={(e) => setUnitForm({ ...unitForm, type: e.target.value })}
              >
                <option value="apartment">Apartamento</option>
                <option value="house">Casa</option>
                <option value="commercial">Comercial</option>
              </select>
            </label>
            <label>
              Torre
              <select
                value={unitForm.towerId}
                onChange={(e) => setUnitForm({ ...unitForm, towerId: e.target.value })}
              >
                <option value="">Sin torre (casas)</option>
                {towers.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Piso
              <input
                type="number"
                value={unitForm.floor}
                onChange={(e) => setUnitForm({ ...unitForm, floor: e.target.value })}
              />
            </label>
            <label>
              Estado admin
              <select
                value={unitForm.adminStatus}
                onChange={(e) => setUnitForm({ ...unitForm, adminStatus: e.target.value })}
              >
                <option value="current">Al día</option>
                <option value="pending">Pendiente</option>
                <option value="overdue">Moroso</option>
              </select>
            </label>
            <div className="admin-actions">
              <button type="submit" className="admin-btn">
                Guardar unidad
              </button>
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                onClick={() => {
                  setEditingUnitId(null);
                  setUnitForm(emptyUnit);
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="admin-card">
        <h2>Replicar unidades entre torres</h2>
        <p className="admin-empty" style={{ marginTop: 0 }}>
          Ideal para conjuntos BIS con torres idénticas: copia todos los apartamentos de una torre ya
          configurada hacia otras torres con los mismos números y pisos. Solo cambia la torre asignada.
        </p>

        <form onSubmit={replicateTowerUnits}>
          <div className="admin-form" style={{ marginTop: '1rem' }}>
            <label>
              Torre origen (ya configurada)
              <select
                value={replicateSourceId}
                onChange={(e) => setReplicateSourceId(e.target.value)}
                required
              >
                <option value="">Seleccionar torre</option>
                {towers.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name} ({getUnitsForTower(t._id, units).length} unidades)
                  </option>
                ))}
              </select>
            </label>
            {replicateSourceId && (
              <label>
                Apartamentos a copiar
                <input value={`${sourceUnits.length} unidad(es)`} readOnly />
              </label>
            )}
          </div>

          {replicateSourceId && targetTowerOptions.length > 0 && (
            <div className="admin-table-wrap" style={{ marginTop: '1rem' }}>
              <table className="admin-table admin-table--selectable">
                <thead>
                  <tr>
                    <th className="admin-table__check">
                      <label className="admin-checkbox admin-checkbox--table">
                        <input
                          ref={replicateSelectAllRef}
                          type="checkbox"
                          checked={allTargetsSelected}
                          onChange={(e) => toggleAllReplicateTargets(e.target.checked)}
                          aria-label="Seleccionar todas las torres destino"
                        />
                      </label>
                    </th>
                    <th>Torre destino</th>
                    <th>Código</th>
                    <th>Pisos</th>
                    <th>Unidades actuales</th>
                  </tr>
                </thead>
                <tbody>
                  {targetTowerOptions.map((t) => (
                    <tr
                      key={t._id}
                      className={replicateTargetIds.includes(t._id) ? 'is-selected' : ''}
                    >
                      <td className="admin-table__check">
                        <label className="admin-checkbox admin-checkbox--table">
                          <input
                            type="checkbox"
                            checked={replicateTargetIds.includes(t._id)}
                            onChange={() => toggleReplicateTarget(t._id)}
                            aria-label={`Replicar en ${t.name}`}
                          />
                        </label>
                      </td>
                      <td>{t.name}</td>
                      <td>{t.code}</td>
                      <td>{t.floors || '—'}</td>
                      <td>{getUnitsForTower(t._id, units).length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {replicateSourceId && !targetTowerOptions.length && (
            <p className="admin-empty" style={{ marginTop: '1rem' }}>
              Crea al menos otra torre para poder replicar apartamentos.
            </p>
          )}

          {replicateSourceId && sourceUnits.length === 0 && (
            <p className="admin-empty" style={{ marginTop: '1rem' }}>
              La torre origen no tiene unidades. Configúrala primero en el formulario de arriba.
            </p>
          )}

          <div className="admin-actions" style={{ marginTop: '1rem' }}>
            <button
              type="submit"
              className="admin-btn"
              disabled={
                replicating ||
                !replicateSourceId ||
                !replicateTargetIds.length ||
                !sourceUnits.length
              }
            >
              {replicating
                ? 'Replicando…'
                : `Replicar ${sourceUnits.length} unidad(es) en ${replicateTargetIds.length} torre(s)`}
            </button>
          </div>
        </form>
      </div>

      <div className="admin-card admin-table-wrap">
        <h2>Torres registradas</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Código</th>
              <th>Pisos</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {towers.map((t) => (
              <tr key={t._id}>
                <td>{t.name}</td>
                <td>{t.code}</td>
                <td>{t.floors || '—'}</td>
                <td className="admin-actions">
                  <button type="button" className="admin-btn admin-btn--ghost" onClick={() => startEditTower(t)}>
                    Editar
                  </button>
                  <button type="button" className="admin-btn admin-btn--danger" onClick={() => removeTower(t._id)}>
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="admin-card admin-table-wrap">
        <h2>Unidades</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Número</th>
              <th>Tipo</th>
              <th>Torre</th>
              <th>Piso</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {units.map((u) => (
              <tr key={u._id}>
                <td>{u.number}</td>
                <td>{u.type}</td>
                <td>{u.towerId?.name || u.tower || '—'}</td>
                <td>{u.floor ?? '—'}</td>
                <td>
                  <span className={`admin-badge admin-badge--${u.adminStatus}`}>{u.adminStatus}</span>
                </td>
                <td className="admin-actions">
                  <button type="button" className="admin-btn admin-btn--ghost" onClick={() => startEditUnit(u)}>
                    Editar
                  </button>
                  <button type="button" className="admin-btn admin-btn--danger" onClick={() => removeUnit(u._id)}>
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
