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
    savedFloor: '',
    dirty: false,
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
  const floor = unit.floor ?? '';
  return createBulkRow({
    unitId: unit._id,
    existing: true,
    number: unit.number,
    floor,
    savedFloor: floor,
    type: unit.type,
    adminStatus: unit.adminStatus,
  });
}

function parseBulkFloor(value) {
  if (value === '' || value == null) return { ok: true, value: undefined };
  const parsed = Number(String(value).trim());
  if (!Number.isFinite(parsed)) {
    return { ok: false, value: undefined };
  }
  return { ok: true, value: Math.trunc(parsed) };
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
  const [syncingFloors, setSyncingFloors] = useState(false);
  const [replicateSourceId, setReplicateSourceId] = useState('');
  const [replicateTargetIds, setReplicateTargetIds] = useState([]);
  const [replicateModal, setReplicateModal] = useState(null);
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
      rows.map((row) => {
        if (row.key !== key) return row;
        if (row.existing && field !== 'floor') return row;

        const next = { ...row, [field]: value };
        if (row.existing && field === 'floor') {
          next.dirty = String(value ?? '') !== String(row.savedFloor ?? '');
        }
        return next;
      })
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

    const newItems = bulkRows.filter((row) => !row.existing && row.number.trim());
    const dirtyExisting = bulkRows.filter((row) => row.existing && row.dirty);

    if (!newItems.length && !dirtyExisting.length) {
      setError('Agrega unidades nuevas o corrige el piso de las registradas');
      return;
    }

    const payload = [];
    for (const row of [...newItems, ...dirtyExisting]) {
      const parsed = parseBulkFloor(row.floor);
      if (!parsed.ok) {
        setError(`Piso inválido en la unidad ${row.number || 'sin número'}`);
        return;
      }
      payload.push({ row, floor: parsed.value });
    }

    setSavingBulk(true);
    try {
      let updated = 0;
      let created = 0;

      for (const { row, floor } of payload.filter(({ row }) => row.existing)) {
        await adminApi.units.update(row.unitId, { floor: floor ?? null });
        updated += 1;
      }

      const toCreate = payload.filter(({ row }) => !row.existing);
      if (toCreate.length) {
        const data = await adminApi.units.bulkCreate({
          towerId: bulkTowerId || null,
          units: toCreate.map(({ row, floor }) => ({
            number: row.number.trim(),
            floor,
            type: row.type,
            adminStatus: row.adminStatus,
          })),
        });

        created = data.created || 0;
        const failed = data.errors?.length || 0;
        if (failed) {
          setSuccess(
            `${created} unidad(es) nueva(s) creada(s). ${updated} piso(s) actualizado(s). ${failed} no se pudieron guardar.`
          );
          await load();
          return;
        }
      }

      setSuccess(
        created && updated
          ? `${created} unidad(es) nueva(s) creada(s) y ${updated} piso(s) actualizado(s).`
          : created
            ? `${created} unidad(es) nueva(s) creada(s) correctamente.`
            : `${updated} piso(s) actualizado(s) correctamente.`
      );
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingBulk(false);
    }
  }

  async function syncTowerFloors() {
    if (!bulkTowerId) {
      setError('Selecciona una torre para recalcular pisos');
      return;
    }

    setError('');
    setSuccess('');
    setSyncingFloors(true);

    try {
      const data = await adminApi.units.syncFloors({ towerId: bulkTowerId });
      setSuccess(
        data.updated
          ? `${data.updated} unidad(es) sin piso completada(s) según el número del apartamento.`
          : 'Todas las unidades registradas ya tienen piso asignado.'
      );
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncingFloors(false);
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
      towerId: unit.towerId?._id || unit.towerId || '',
      floor: unit.floor ?? '',
      adminStatus: unit.adminStatus,
    });
    if (unit.towerId?._id || unit.towerId) {
      setBulkTowerId(String(unit.towerId?._id || unit.towerId));
    }
  }

  function startEditUnitFromRow(row) {
    const unit = units.find((u) => u._id === row.unitId);
    if (unit) startEditUnit(unit);
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
    const id = String(towerId);
    setReplicateTargetIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function toggleAllReplicateTargets(checked) {
    setReplicateTargetIds(checked ? targetTowerOptions.map((t) => String(t._id)) : []);
  }

  function closeReplicateModal() {
    if (replicateModal?.status === 'loading') return;
    setReplicateModal(null);
  }

  async function replicateTowerUnits(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    const sourceTower = towers.find((t) => String(t._id) === replicateSourceId);
    const targetNames = targetTowerOptions
      .filter((t) => replicateTargetIds.includes(String(t._id)))
      .map((t) => t.name);

    setReplicateModal({
      status: 'loading',
      unitCount: sourceUnits.length,
      towerCount: replicateTargetIds.length,
      sourceName: sourceTower?.name || 'Torre origen',
      targetNames,
    });

    try {
      const targetIds = [...replicateTargetIds];
      const data = await adminApi.units.replicateTower({
        sourceTowerId: replicateSourceId,
        targetTowerIds: targetIds.map(String),
        skipExisting: true,
      });

      setReplicateModal({
        status: 'success',
        data,
      });
      setReplicateTargetIds([]);
      await load();
    } catch (err) {
      setReplicateModal({
        status: 'error',
        message: err.message || 'No se pudo completar la replicación',
      });
    }
  }

  const selectedBulkTower = towers.find((t) => t._id === bulkTowerId);
  const existingBulkCount = bulkRows.filter((row) => row.existing).length;
  const newBulkCount = bulkRows.filter((row) => !row.existing && row.number.trim()).length;
  const dirtyBulkCount = bulkRows.filter((row) => row.existing && row.dirty).length;

  const sourceUnits = useMemo(
    () => getUnitsForTower(replicateSourceId, units),
    [replicateSourceId, units]
  );
  const targetTowerOptions = useMemo(
    () => towers.filter((t) => t._id !== replicateSourceId),
    [towers, replicateSourceId]
  );
  const allTargetsSelected =
    targetTowerOptions.length > 0 &&
    targetTowerOptions.every((t) => replicateTargetIds.includes(String(t._id)));
  const someTargetsSelected = replicateTargetIds.length > 0 && !allTargetsSelected;

  useEffect(() => {
    if (replicateSelectAllRef.current) {
      replicateSelectAllRef.current.indeterminate = someTargetsSelected;
    }
  }, [someTargetsSelected]);

  useEffect(() => {
    setReplicateTargetIds((prev) => prev.filter((id) => id !== String(replicateSourceId)));
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
              Selecciona una torre para ver sus unidades y agregar filas nuevas al final. Puedes corregir
              el piso, editar o eliminar unidades registradas desde la columna Acciones.
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
                      <th>Acciones</th>
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
                              className="admin-table-input admin-table-input--sm admin-table-input--editable"
                              type="text"
                              inputMode="numeric"
                              value={row.floor}
                              onChange={(e) => updateBulkRow(row.key, 'floor', e.target.value)}
                              placeholder="—"
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
                              className={`admin-badge admin-badge--${
                                row.existing ? (row.dirty ? 'pending' : 'paid') : 'pending'
                              }`}
                            >
                              {row.existing ? (row.dirty ? 'Modificada' : 'Registrada') : 'Nueva'}
                            </span>
                          </td>
                          <td className="admin-actions">
                            {row.existing ? (
                              <>
                                <button
                                  type="button"
                                  className="admin-btn admin-btn--ghost"
                                  onClick={() => startEditUnitFromRow(row)}
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  className="admin-btn admin-btn--danger"
                                  onClick={() => removeUnit(row.unitId)}
                                >
                                  Eliminar
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="admin-btn admin-btn--ghost"
                                onClick={() => removeBulkRow(row.key)}
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
                {bulkTowerId && (
                  <button
                    type="button"
                    className="admin-btn admin-btn--ghost"
                    onClick={syncTowerFloors}
                    disabled={syncingFloors}
                  >
                    {syncingFloors ? 'Completando…' : 'Completar pisos vacíos desde número'}
                  </button>
                )}
                <button
                  type="submit"
                  className="admin-btn"
                  disabled={savingBulk || (!newBulkCount && !dirtyBulkCount)}
                >
                  {savingBulk
                    ? 'Guardando…'
                    : `Guardar cambios${
                        newBulkCount || dirtyBulkCount
                          ? ` (${[
                              newBulkCount ? `${newBulkCount} nueva(s)` : '',
                              dirtyBulkCount ? `${dirtyBulkCount} piso(s)` : '',
                            ]
                              .filter(Boolean)
                              .join(', ')})`
                          : ''
                      }`}
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
                      className={replicateTargetIds.includes(String(t._id)) ? 'is-selected' : ''}
                    >
                      <td className="admin-table__check">
                        <label className="admin-checkbox admin-checkbox--table">
                          <input
                            type="checkbox"
                            checked={replicateTargetIds.includes(String(t._id))}
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
                replicateModal?.status === 'loading' ||
                !replicateSourceId ||
                !replicateTargetIds.length ||
                !sourceUnits.length
              }
            >
              {`Replicar ${sourceUnits.length} unidad(es) en ${replicateTargetIds.length} torre(s)`}
            </button>
          </div>
        </form>
      </div>

      {replicateModal && (
        <div
          className="admin-modal-overlay"
          role="presentation"
          onClick={closeReplicateModal}
        >
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="replicate-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            {replicateModal.status === 'loading' && (
              <>
                <h3 id="replicate-modal-title">Replicando unidades</h3>
                <div className="admin-modal__spinner" aria-hidden="true" />
                <p>
                  Copiando <strong>{replicateModal.unitCount}</strong> unidad(es) de{' '}
                  <strong>{replicateModal.sourceName}</strong> hacia{' '}
                  <strong>{replicateModal.targetNames.join(', ')}</strong>.
                </p>
                <p className="admin-modal__hint">Esto puede tardar unos segundos…</p>
              </>
            )}

            {replicateModal.status === 'success' && (
              <>
                <h3 id="replicate-modal-title">Replicación completada</h3>
                <p>
                  <strong>{replicateModal.data.created}</strong> unidad(es) creada(s)
                  {replicateModal.data.skipped
                    ? `, ${replicateModal.data.skipped} ya existían y se omitieron`
                    : ''}
                  .
                </p>
                <p className="admin-modal__detail">
                  Origen: {replicateModal.data.sourceTower} → Destino:{' '}
                  {replicateModal.data.targetTowers.join(', ')}
                </p>
                {replicateModal.data.errors?.length > 0 && (
                  <div className="admin-modal__errors">
                    <p>{replicateModal.data.errors.length} unidad(es) no se pudieron crear:</p>
                    <ul>
                      {replicateModal.data.errors.slice(0, 5).map((item, index) => (
                        <li key={`${item.number}-${index}`}>
                          {item.tower} — {item.number}: {item.error}
                        </li>
                      ))}
                    </ul>
                    {replicateModal.data.errors.length > 5 && (
                      <p className="admin-modal__hint">
                        Y {replicateModal.data.errors.length - 5} error(es) más.
                      </p>
                    )}
                  </div>
                )}
                {replicateModal.data.created === 0 && !replicateModal.data.skipped && (
                  <p className="admin-modal__hint">
                    No se creó ninguna unidad. Verifica que la torre destino no tenga ya los mismos
                    números o revisa los errores arriba.
                  </p>
                )}
                <div className="admin-actions" style={{ marginTop: '1.25rem' }}>
                  <button type="button" className="admin-btn" onClick={closeReplicateModal}>
                    Cerrar
                  </button>
                </div>
              </>
            )}

            {replicateModal.status === 'error' && (
              <>
                <h3 id="replicate-modal-title">No se pudo replicar</h3>
                <p className="admin-modal__error">{replicateModal.message}</p>
                <p className="admin-modal__hint">
                  Revisa que el backend esté corriendo (<code>npm run dev</code>) y que tengas
                  sesión activa en el conjunto correcto.
                </p>
                <div className="admin-actions" style={{ marginTop: '1.25rem' }}>
                  <button type="button" className="admin-btn" onClick={closeReplicateModal}>
                    Cerrar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

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
    </div>
  );
}
