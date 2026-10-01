import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../api/client';
import { setActiveTenant } from '../../api/tenantContext';
import '../admin.css';

const emptyForm = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
};

export default function AdminBuildingsPage() {
  const navigate = useNavigate();
  const [context, setContext] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [openBuildingId, setOpenBuildingId] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    const ctx = await adminApi.context();
    setContext(ctx);
    if (ctx.scope === 'building') {
      setAdmins([]);
      return;
    }
    const staff = await adminApi.buildingAdmins();
    setAdmins(staff.admins || []);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  function enterBuilding(building) {
    setActiveTenant({
      organizationId: building.organizationId,
      buildingId: building.id,
      buildingName: building.name,
      organizationName: context?.organization?.name || '',
    });
    navigate('/admin');
  }

  async function createAdmin(event, building) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await adminApi.createBuildingAdmin({
        ...form,
        buildingId: building.id,
      });
      setForm(emptyForm);
      setOpenBuildingId('');
      setSuccess(`Administrador creado para ${building.name}.`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (context?.scope === 'building') {
    return (
      <div className="admin-card">
        <h2>Conjuntos</h2>
        <p>Tu ingreso está limitado a {context.building?.name || 'tu conjunto'}.</p>
      </div>
    );
  }

  const buildings = context?.buildings || [];

  return (
    <div>
      <header style={{ marginBottom: '1rem' }}>
        <h1 style={{ margin: '0 0 0.35rem' }}>Conjuntos de la empresa</h1>
        <p style={{ margin: 0, color: '#6b6560' }}>
          Entra al conjunto que quieras operar, o crea el ingreso del administrador de ese edificio.
        </p>
      </header>

      {error && <div className="admin-error">{error}</div>}
      {success && <div className="admin-success">{success}</div>}

      {!context && !error && <p>Cargando conjuntos…</p>}

      <div className="company-buildings">
        {buildings.map((building) => {
          const buildingAdmins = admins.filter((admin) => String(admin.buildingId) === String(building.id));
          const isOpen = openBuildingId === String(building.id);
          return (
            <article key={building.id} className="admin-card company-building">
              <div className="company-building__head">
                <div>
                  <h2>{building.name}</h2>
                  {building.city && <p>{building.city}</p>}
                </div>
                <div className="company-building__actions">
                  <button type="button" className="admin-btn" onClick={() => enterBuilding(building)}>
                    Entrar
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn--ghost"
                    onClick={() => {
                      setOpenBuildingId(isOpen ? '' : String(building.id));
                      setForm(emptyForm);
                    }}
                  >
                    {isOpen ? 'Cerrar' : 'Nuevo administrador'}
                  </button>
                </div>
              </div>

              <ul className="company-building__admins">
                {buildingAdmins.length === 0 && <li>Todavía no hay un administrador solo de este conjunto.</li>}
                {buildingAdmins.map((admin) => (
                  <li key={admin.id}>
                    {admin.firstName} {admin.lastName} · {admin.email}
                  </li>
                ))}
              </ul>

              {isOpen && (
                <form className="company-building__form" onSubmit={(event) => createAdmin(event, building)}>
                  <label>
                    Nombre
                    <input
                      value={form.firstName}
                      onChange={(event) => setForm({ ...form, firstName: event.target.value })}
                      required
                    />
                  </label>
                  <label>
                    Apellido
                    <input
                      value={form.lastName}
                      onChange={(event) => setForm({ ...form, lastName: event.target.value })}
                      required
                    />
                  </label>
                  <label>
                    Correo
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) => setForm({ ...form, email: event.target.value })}
                      required
                    />
                  </label>
                  <label>
                    Contraseña
                    <input
                      value={form.password}
                      onChange={(event) => setForm({ ...form, password: event.target.value })}
                      required
                    />
                  </label>
                  <button type="submit" className="admin-btn" disabled={saving}>
                    {saving ? 'Guardando…' : 'Crear ingreso'}
                  </button>
                </form>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
