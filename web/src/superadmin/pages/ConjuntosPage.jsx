import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { platformApi } from '../../api/client';
import { setActiveTenant } from '../../api/tenantContext';
import '../../admin/admin.css';

const emptyConjunto = {
  organizationName: '',
  nit: '',
  email: '',
  phone: '',
  buildingName: '',
  city: '',
  state: '',
  description: '',
  adminFirstName: '',
  adminLastName: '',
  adminEmail: '',
  adminPassword: '',
};

const emptyAdmin = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
};

export default function ConjuntosPage() {
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState(emptyConjunto);
  const [creating, setCreating] = useState(false);
  const [expandedOrgId, setExpandedOrgId] = useState(null);
  const [adminForms, setAdminForms] = useState({});
  const [addingAdminFor, setAddingAdminFor] = useState(null);

  async function load() {
    const data = await platformApi.overview();
    setOrganizations(data.organizations);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setError('');
    setSuccess('');

    try {
      const admins = [];
      if (form.adminEmail && form.adminPassword) {
        admins.push({
          firstName: form.adminFirstName,
          lastName: form.adminLastName,
          email: form.adminEmail,
          password: form.adminPassword,
        });
      }

      await platformApi.createConjunto({
        organizationName: form.organizationName,
        nit: form.nit,
        email: form.email,
        phone: form.phone,
        buildingName: form.buildingName,
        address: { city: form.city, state: form.state, country: 'Colombia' },
        description: form.description,
        admins,
      });

      setForm(emptyConjunto);
      setSuccess('Conjunto creado correctamente. Todos los datos quedan ligados a su edificio en MongoDB.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  function manageConjunto(org, building) {
    setActiveTenant({
      organizationId: org._id,
      buildingId: building._id,
      organizationName: org.name,
      buildingName: building.name,
    });
    navigate('/admin');
  }

  function getAdminForm(orgId) {
    return adminForms[orgId] || emptyAdmin;
  }

  function updateAdminForm(orgId, field, value) {
    setAdminForms((prev) => ({
      ...prev,
      [orgId]: { ...getAdminForm(orgId), [field]: value },
    }));
  }

  async function addAdmin(orgId) {
    const adminForm = getAdminForm(orgId);
    try {
      await platformApi.createAdmin(orgId, adminForm);
      setAdminForms((prev) => ({ ...prev, [orgId]: emptyAdmin }));
      setAddingAdminFor(null);
      setSuccess('Administrador asignado al conjunto.');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <h1>Conjuntos residenciales</h1>
        <p>
          Crea edificios o conjuntos, asígnale uno o varios administradores y gestiona cada predio con
          sus torres, unidades y usuarios referenciados por su ID de edificio.
        </p>
      </header>

      {error && <div className="admin-error">{error}</div>}
      {success && (
        <div className="admin-card" style={{ background: '#dceee4', color: '#1e5a3d' }}>
          {success}
        </div>
      )}

      <div className="admin-card">
        <h2>Crear conjunto residencial</h2>
        <form className="admin-form" onSubmit={handleCreate}>
          <label>
            Nombre administración
            <input
              value={form.organizationName}
              onChange={(e) => setForm({ ...form, organizationName: e.target.value })}
              placeholder="Administración Paraíso Caribe"
              required
            />
          </label>
          <label>
            Nombre del conjunto / edificio
            <input
              value={form.buildingName}
              onChange={(e) => setForm({ ...form, buildingName: e.target.value })}
              placeholder="Conjunto Paraíso Caribe"
              required
            />
          </label>
          <label>
            NIT
            <input value={form.nit} onChange={(e) => setForm({ ...form, nit: e.target.value })} />
          </label>
          <label>
            Correo contacto
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label>
            Teléfono
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
          <label>
            Ciudad
            <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </label>
          <label>
            Departamento
            <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
          </label>
          <label style={{ gridColumn: '1 / -1' }}>
            Descripción
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>

          <label style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}>
            <strong>Primer administrador (opcional)</strong>
          </label>
          <label>
            Nombre admin
            <input
              value={form.adminFirstName}
              onChange={(e) => setForm({ ...form, adminFirstName: e.target.value })}
            />
          </label>
          <label>
            Apellido admin
            <input
              value={form.adminLastName}
              onChange={(e) => setForm({ ...form, adminLastName: e.target.value })}
            />
          </label>
          <label>
            Correo admin
            <input
              type="email"
              value={form.adminEmail}
              onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
            />
          </label>
          <label>
            Contraseña admin
            <input
              value={form.adminPassword}
              onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
            />
          </label>

          <button type="submit" className="admin-btn" disabled={creating}>
            {creating ? 'Creando…' : 'Crear conjunto'}
          </button>
        </form>
      </div>

      <div className="admin-card admin-table-wrap">
        <h2>Conjuntos registrados</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Administración</th>
              <th>Conjunto / edificio</th>
              <th>Ciudad</th>
              <th>Administradores</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {organizations.length === 0 ? (
              <tr>
                <td colSpan={5} className="admin-empty">
                  Aún no hay conjuntos creados.
                </td>
              </tr>
            ) : (
              organizations.flatMap((org) =>
                (org.buildings?.length ? org.buildings : [null]).map((building) => (
                  <tr key={`${org._id}-${building?._id || 'none'}`}>
                    <td>{org.name}</td>
                    <td>{building?.name || '—'}</td>
                    <td>{building?.address?.city || '—'}</td>
                    <td>{org.admins?.length || 0}</td>
                    <td className="admin-actions">
                      {building && (
                        <>
                          <button
                            type="button"
                            className="admin-btn"
                            onClick={() => manageConjunto(org, building)}
                          >
                            Administrar
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn--ghost"
                            onClick={() =>
                              setExpandedOrgId(expandedOrgId === org._id ? null : org._id)
                            }
                          >
                            Admins
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )
            )}
          </tbody>
        </table>
      </div>

      {expandedOrgId && (
        <div className="admin-card">
          <h2>Administradores del conjunto</h2>
          {organizations
            .filter((org) => org._id === expandedOrgId)
            .map((org) => (
              <div key={org._id}>
                <ul className="admin-highlights">
                  {(org.admins || []).map((admin) => (
                    <li key={admin.id} className="admin-highlight">
                      {admin.firstName} {admin.lastName} · {admin.email}
                    </li>
                  ))}
                  {!org.admins?.length && (
                    <li className="admin-empty">Sin administradores asignados.</li>
                  )}
                </ul>

                {addingAdminFor === org._id ? (
                  <form
                    className="admin-form"
                    style={{ marginTop: '1rem' }}
                    onSubmit={(e) => {
                      e.preventDefault();
                      addAdmin(org._id);
                    }}
                  >
                    <label>
                      Nombre
                      <input
                        value={getAdminForm(org._id).firstName}
                        onChange={(e) => updateAdminForm(org._id, 'firstName', e.target.value)}
                        required
                      />
                    </label>
                    <label>
                      Apellido
                      <input
                        value={getAdminForm(org._id).lastName}
                        onChange={(e) => updateAdminForm(org._id, 'lastName', e.target.value)}
                        required
                      />
                    </label>
                    <label>
                      Correo
                      <input
                        type="email"
                        value={getAdminForm(org._id).email}
                        onChange={(e) => updateAdminForm(org._id, 'email', e.target.value)}
                        required
                      />
                    </label>
                    <label>
                      Contraseña
                      <input
                        value={getAdminForm(org._id).password}
                        onChange={(e) => updateAdminForm(org._id, 'password', e.target.value)}
                        required
                      />
                    </label>
                    <div className="admin-actions">
                      <button type="submit" className="admin-btn">
                        Guardar administrador
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn--ghost"
                        onClick={() => setAddingAdminFor(null)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    className="admin-btn admin-btn--ghost"
                    style={{ marginTop: '1rem' }}
                    onClick={() => setAddingAdminFor(org._id)}
                  >
                    + Agregar administrador
                  </button>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
