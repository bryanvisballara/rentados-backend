import { useEffect, useState } from 'react';
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

export default function ResidentAssignPage() {
  const [units, setUnits] = useState([]);
  const [error, setError] = useState('');
  const [createForm, setCreateForm] = useState(emptyResident);
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [unitResidents, setUnitResidents] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyEdit);

  useEffect(() => {
    adminApi.units
      .list()
      .then((data) => setUnits(data.units))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!selectedUnitId) {
      setUnitResidents([]);
      return;
    }
    adminApi.units
      .residents(selectedUnitId)
      .then((data) => setUnitResidents(data.residents))
      .catch((err) => setError(err.message));
  }, [selectedUnitId]);

  async function createResident(e) {
    e.preventDefault();
    try {
      await adminApi.residents.create(createForm);
      setCreateForm(emptyResident);
      if (selectedUnitId === createForm.unitId) {
        const data = await adminApi.units.residents(selectedUnitId);
        setUnitResidents(data.residents);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  function startEditResident(resident) {
    setEditingId(resident._id);
    setEditForm({
      firstName: resident.userId.firstName,
      lastName: resident.userId.lastName,
      email: resident.userId.email,
      phone: resident.userId.phone || '',
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
      const data = await adminApi.units.residents(selectedUnitId);
      setUnitResidents(data.residents);
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
      const data = await adminApi.units.residents(selectedUnitId);
      setUnitResidents(data.residents);
    } catch (err) {
      setError(err.message);
    }
  }

  const selectedUnit = units.find((u) => u._id === selectedUnitId);

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
        <form className="admin-form" onSubmit={(e) => e.preventDefault()}>
          <label>
            Seleccionar unidad
            <select value={selectedUnitId} onChange={(e) => setSelectedUnitId(e.target.value)}>
              <option value="">Elegir apartamento o casa</option>
              {units.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.number} {u.towerId?.name ? `· ${u.towerId.name}` : ''}
                </option>
              ))}
            </select>
          </label>
        </form>

        {selectedUnit && (
          <p className="admin-empty" style={{ marginTop: '0.75rem' }}>
            {selectedUnit.number}: {unitResidents.length} usuario(s) asignado(s)
          </p>
        )}

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

        {selectedUnitId && (
          <div className="admin-table-wrap" style={{ marginTop: '1rem' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Residente</th>
                  <th>Email</th>
                  <th>Relación</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {unitResidents.map((r) => (
                  <tr key={r._id}>
                    <td>
                      {r.userId?.firstName} {r.userId?.lastName}
                    </td>
                    <td>{r.userId?.email}</td>
                    <td>{r.relationship}</td>
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
