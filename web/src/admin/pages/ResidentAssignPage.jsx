import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../../api/client';
import '../admin.css';

const emptyResident = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  unitId: '',
  relationship: 'owner',
};

const emptyEdit = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  relationship: 'owner',
};

const defaultFilters = {
  q: '',
  unitId: '',
  status: '',
  type: '',
  tower: '',
  relationship: '',
};

const RELATIONSHIP_LABELS = {
  owner: 'Propietario',
  tenant: 'Arrendatario',
  family: 'Familiar',
};

export default function ResidentAssignPage() {
  const [units, setUnits] = useState([]);
  const [residents, setResidents] = useState([]);
  const [filters, setFilters] = useState(defaultFilters);
  const [error, setError] = useState('');
  const [createForm, setCreateForm] = useState(emptyResident);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyEdit);

  const towers = useMemo(
    () => [...new Set(units.map((u) => u.tower || u.towerId?.name).filter(Boolean))].sort(),
    [units]
  );

  async function loadResidents(nextFilters = filters) {
    const data = await adminApi.residents.list(nextFilters);
    setResidents(data.residents);
  }

  useEffect(() => {
    adminApi.units
      .list()
      .then((data) => setUnits(data.units))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    loadResidents(filters).catch((err) => setError(err.message));
  }, [filters]);

  async function createResident(e) {
    e.preventDefault();
    try {
      await adminApi.residents.create(createForm);
      setCreateForm(emptyResident);
      await loadResidents();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEditResident(resident) {
    setEditingId(resident._id);
    setEditForm({
      firstName: resident.userId?.firstName || '',
      lastName: resident.userId?.lastName || '',
      email: resident.userId?.email || '',
      phone: resident.userId?.phone || '',
      password: '',
      relationship: resident.relationship,
    });
  }

  async function saveEditResident(e) {
    e.preventDefault();
    try {
      const body = { ...editForm };
      if (!body.password) delete body.password;
      await adminApi.residents.update(editingId, body);
      setEditingId(null);
      setEditForm(emptyEdit);
      await loadResidents();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeResident(id) {
    if (!window.confirm('¿Eliminar este residente y su acceso?')) return;
    try {
      await adminApi.residents.remove(id);
      if (editingId === id) {
        setEditingId(null);
        setEditForm(emptyEdit);
      }
      await loadResidents();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <h1>Residentes</h1>
        <p>Crea usuarios con contraseña y asígnalos a un apartamento o casa.</p>
      </header>

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-card">
        <h2>Crear residente</h2>
        <form className="admin-form" onSubmit={createResident}>
          <label>
            Nombre
            <input
              value={createForm.firstName}
              onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
              required
            />
          </label>
          <label>
            Apellido
            <input
              value={createForm.lastName}
              onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
              required
            />
          </label>
          <label>
            Correo (usuario)
            <input
              type="email"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              required
            />
          </label>
          <label>
            Contraseña
            <input
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              required
            />
          </label>
          <label>
            Unidad
            <select
              value={createForm.unitId}
              onChange={(e) => setCreateForm({ ...createForm, unitId: e.target.value })}
              required
            >
              <option value="">Seleccionar unidad</option>
              {units.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.number} {u.towerId?.name ? `· ${u.towerId.name}` : ''} ({u.type})
                </option>
              ))}
            </select>
          </label>
          <label>
            Relación
            <select
              value={createForm.relationship}
              onChange={(e) => setCreateForm({ ...createForm, relationship: e.target.value })}
            >
              <option value="owner">Propietario</option>
              <option value="tenant">Arrendatario</option>
              <option value="family">Familiar</option>
            </select>
          </label>
          <button type="submit" className="admin-btn">
            Crear y asignar
          </button>
        </form>
      </div>

      <div className="admin-card">
        <h2>Residentes por unidad</h2>
        <p className="admin-empty" style={{ marginTop: 0 }}>
          Por defecto se muestran todos los residentes. Usa los filtros para acotar la lista.
        </p>

        <form className="admin-form" style={{ marginTop: '1rem' }} onSubmit={(e) => e.preventDefault()}>
          <label>
            Buscar
            <input
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              placeholder="Nombre, correo o unidad"
            />
          </label>
          <label>
            Unidad
            <select
              value={filters.unitId}
              onChange={(e) => setFilters({ ...filters, unitId: e.target.value })}
            >
              <option value="">Todas</option>
              {units.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.number} {u.towerId?.name ? `· ${u.towerId.name}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            Torre
            <select
              value={filters.tower}
              onChange={(e) => setFilters({ ...filters, tower: e.target.value })}
            >
              <option value="">Todas</option>
              {towers.map((tower) => (
                <option key={tower} value={tower}>
                  {tower}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tipo de unidad
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            >
              <option value="">Todos</option>
              <option value="apartment">Apartamento</option>
              <option value="house">Casa</option>
            </select>
          </label>
          <label>
            Estado administración
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">Todos</option>
              <option value="current">Al día</option>
              <option value="pending">Pendiente</option>
              <option value="overdue">Moroso</option>
            </select>
          </label>
          <label>
            Relación
            <select
              value={filters.relationship}
              onChange={(e) => setFilters({ ...filters, relationship: e.target.value })}
            >
              <option value="">Todas</option>
              <option value="owner">Propietario</option>
              <option value="tenant">Arrendatario</option>
              <option value="family">Familiar</option>
            </select>
          </label>
        </form>

        <p className="admin-empty" style={{ marginTop: '0.75rem' }}>
          {residents.length} residente(s) encontrado(s)
        </p>

        {editingId && (
          <form className="admin-form" style={{ marginTop: '1rem' }} onSubmit={saveEditResident}>
            <label>
              Nombre
              <input
                value={editForm.firstName}
                onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                required
              />
            </label>
            <label>
              Apellido
              <input
                value={editForm.lastName}
                onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                required
              />
            </label>
            <label>
              Correo
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                required
              />
            </label>
            <label>
              Nueva contraseña (opcional)
              <input
                value={editForm.password}
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
              />
            </label>
            <label>
              Relación
              <select
                value={editForm.relationship}
                onChange={(e) => setEditForm({ ...editForm, relationship: e.target.value })}
              >
                <option value="owner">Propietario</option>
                <option value="tenant">Arrendatario</option>
                <option value="family">Familiar</option>
              </select>
            </label>
            <div className="admin-actions">
              <button type="submit" className="admin-btn">
                Guardar residente
              </button>
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                onClick={() => {
                  setEditingId(null);
                  setEditForm(emptyEdit);
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        <div className="admin-table-wrap" style={{ marginTop: '1rem' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Residente</th>
                <th>Email</th>
                <th>Unidad</th>
                <th>Torre</th>
                <th>Relación</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {residents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="admin-empty">
                    No hay residentes con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                residents.map((r) => (
                  <tr key={r._id}>
                    <td>
                      {r.userId?.firstName} {r.userId?.lastName}
                    </td>
                    <td>{r.userId?.email}</td>
                    <td>{r.unitId?.number || '—'}</td>
                    <td>{r.unitId?.tower || '—'}</td>
                    <td>{RELATIONSHIP_LABELS[r.relationship] || r.relationship}</td>
                    <td>
                      {r.unitId?.adminStatus ? (
                        <span className={`admin-badge admin-badge--${r.unitId.adminStatus}`}>
                          {r.unitId.adminStatus}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="admin-actions">
                      <button
                        type="button"
                        className="admin-btn admin-btn--ghost"
                        onClick={() => startEditResident(r)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn--danger"
                        onClick={() => removeResident(r._id)}
                      >
                        Eliminar
                      </button>
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
