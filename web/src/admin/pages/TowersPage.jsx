import { useEffect, useState } from 'react';
import { adminApi } from '../../api/client';
import '../admin.css';

const emptyTower = { name: '', code: '', floors: '' };
const emptyUnit = { number: '', type: 'apartment', towerId: '', floor: '', adminStatus: 'current' };

export default function TowersPage() {
  const [towers, setTowers] = useState([]);
  const [units, setUnits] = useState([]);
  const [error, setError] = useState('');
  const [towerForm, setTowerForm] = useState(emptyTower);
  const [unitForm, setUnitForm] = useState(emptyUnit);
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
      if (editingUnitId) {
        await adminApi.units.update(editingUnitId, body);
        setEditingUnitId(null);
      } else {
        await adminApi.units.create(body);
      }
      setUnitForm(emptyUnit);
      await load();
    } catch (err) {
      setError(err.message);
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

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <h1>Torres y unidades</h1>
        <p>Crea, edita y elimina torres, apartamentos y casas del conjunto.</p>
      </header>

      {error && <div className="admin-error">{error}</div>}

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
              {editingUnitId ? 'Guardar unidad' : 'Agregar unidad'}
            </button>
            {editingUnitId && (
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
            )}
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
