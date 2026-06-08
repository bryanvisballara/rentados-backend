import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import '../admin.css';

const emptyStaff = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: 'Rentados2026!',
};

const defaultLockerSettings = {
  enabled: false,
  receiveWhenOverdue: true,
  notifyWhenOverdue: true,
};

export default function PorteriaPage() {
  const [staff, setStaff] = useState([]);
  const [lockerSettings, setLockerSettings] = useState(defaultLockerSettings);
  const [savingLocker, setSavingLocker] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyStaff);
  const [editingId, setEditingId] = useState(null);

  async function load() {
    const [staffData, settingsData] = await Promise.all([
      adminApi.staff.list(),
      adminApi.porteriaSettings.get(),
    ]);
    setStaff(staffData.staff);
    setLockerSettings({ ...defaultLockerSettings, ...settingsData.locker });
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function saveLockerSettings(e) {
    e.preventDefault();
    setSavingLocker(true);
    setError('');
    try {
      const data = await adminApi.porteriaSettings.update(lockerSettings);
      setLockerSettings({ ...defaultLockerSettings, ...data.locker });
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingLocker(false);
    }
  }

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
        <h1>Portería</h1>
        <p>Configura el casillero de paquetes y gestiona los accesos al portal de portería.</p>
      </header>

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-card">
        <h2>Servicio de casillero</h2>
        <p className="admin-modal__hint">
          Si lo habilitas, portería podrá registrar paquetes con foto y comentario. El residente recibe una
          notificación en su app (push nativo próximamente).
        </p>
        <form className="admin-form" onSubmit={saveLockerSettings}>
          <label className="admin-checkbox" style={{ gridColumn: '1 / -1' }}>
            <input
              type="checkbox"
              checked={lockerSettings.enabled}
              onChange={(e) => setLockerSettings({ ...lockerSettings, enabled: e.target.checked })}
            />
            <span>Habilitar casillero de paquetes en portal de portería</span>
          </label>

          {lockerSettings.enabled && (
            <>
              <label className="admin-checkbox" style={{ gridColumn: '1 / -1' }}>
                <input
                  type="checkbox"
                  checked={lockerSettings.receiveWhenOverdue}
                  onChange={(e) =>
                    setLockerSettings({ ...lockerSettings, receiveWhenOverdue: e.target.checked })
                  }
                />
                <span>Recibir paquetes de unidades en mora</span>
              </label>
              <label className="admin-checkbox" style={{ gridColumn: '1 / -1' }}>
                <input
                  type="checkbox"
                  checked={lockerSettings.notifyWhenOverdue}
                  onChange={(e) =>
                    setLockerSettings({ ...lockerSettings, notifyWhenOverdue: e.target.checked })
                  }
                  disabled={!lockerSettings.receiveWhenOverdue}
                />
                <span>Notificar al residente si la unidad está en mora</span>
              </label>
              {!lockerSettings.receiveWhenOverdue && (
                <p className="admin-hours-preview" style={{ gridColumn: '1 / -1' }}>
                  Portería no podrá registrar paquetes para unidades en mora.
                </p>
              )}
              {lockerSettings.receiveWhenOverdue && !lockerSettings.notifyWhenOverdue && (
                <p className="admin-hours-preview" style={{ gridColumn: '1 / -1' }}>
                  Se guardará el paquete en retención y el residente no será notificado hasta que la mora se
                  regularice o portería envíe la notificación manualmente.
                </p>
              )}
            </>
          )}

          <div className="admin-actions" style={{ gridColumn: '1 / -1' }}>
            <button type="submit" className="admin-btn" disabled={savingLocker}>
              {savingLocker ? 'Guardando…' : 'Guardar configuración'}
            </button>
          </div>
        </form>
      </div>

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
