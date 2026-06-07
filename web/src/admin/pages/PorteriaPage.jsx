import { useEffect, useState } from 'react';
import { adminApi } from '../../api/client';
import '../admin.css';

const emptyStaff = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: 'Rentados2026!',
};

export default function PorteriaPage() {
  const [staff, setStaff] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyStaff);
  const [editingId, setEditingId] = useState(null);

  async function load() {
    const data = await adminApi.staff.list();
    setStaff(data.staff);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (editingId) {
        const body = { ...form };
        if (!body.password) delete body.password;
        await adminApi.staff.update(editingId, body);
        setEditingId(null);
      } else {
        await adminApi.staff.create(form);
      }
      setForm(emptyStaff);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(member) {
    setEditingId(member._id);
    setForm({
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email,
      phone: member.phone || '',
      password: '',
    });
  }

  async function removeStaff(id) {
    if (!window.confirm('¿Eliminar este usuario de portería?')) return;
    try {
      await adminApi.staff.remove(id);
      if (editingId === id) {
        setEditingId(null);
        setForm(emptyStaff);
      }
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <h1>Usuarios de portería</h1>
        <p>Crea, edita contraseñas y elimina accesos al portal de portería.</p>
      </header>

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-card">
        <h2>{editingId ? 'Editar usuario' : 'Nuevo usuario de portería'}</h2>
        <form className="admin-form" onSubmit={handleSubmit}>
          <label>
            Nombre
            <input
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              required
            />
          </label>
          <label>
            Apellido
            <input
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </label>
          <label>
            Teléfono
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
          <label>
            {editingId ? 'Nueva contraseña (opcional)' : 'Contraseña'}
            <input
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={editingId ? 'Dejar vacío para no cambiar' : 'Rentados2026!'}
              required={!editingId}
            />
          </label>
          <div className="admin-actions">
            <button type="submit" className="admin-btn">
              {editingId ? 'Guardar cambios' : 'Crear usuario'}
            </button>
            {editingId && (
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyStaff);
                }}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="admin-card admin-table-wrap">
        <h2>Personal de portería</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Teléfono</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s._id}>
                <td>
                  {s.firstName} {s.lastName}
                </td>
                <td>{s.email}</td>
                <td>{s.phone || '—'}</td>
                <td className="admin-actions">
                  <button type="button" className="admin-btn admin-btn--ghost" onClick={() => startEdit(s)}>
                    Editar
                  </button>
                  <button type="button" className="admin-btn admin-btn--danger" onClick={() => removeStaff(s._id)}>
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
