import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { platformApi } from '../../api/client';
import { setActiveTenant } from '../../api/tenantContext';
import '../../admin/admin.css';
import './ConjuntosPage.css';

const emptyConjunto = {
  organizationName: '',
  nit: '',
  email: '',
  phone: '',
  buildingName: '',
  city: '',
  state: '',
  country: 'Colombia',
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

function AdoptionCell({ rate, healthKey }) {
  const fillClass =
    healthKey === 'critical' ? 'is-critical' : healthKey === 'low' ? 'is-low' : '';

  return (
    <span className="conjuntos-adoption">
      <span>{rate}%</span>
      <span className="conjuntos-adoption__bar" aria-hidden="true">
        <span
          className={`conjuntos-adoption__fill ${fillClass}`}
          style={{ width: `${Math.min(rate, 100)}%` }}
        />
      </span>
    </span>
  );
}

export default function ConjuntosPage() {
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState([]);
  const [engagement, setEngagement] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState(emptyConjunto);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [onlyNeedsAttention, setOnlyNeedsAttention] = useState(false);
  const [expandedOrgId, setExpandedOrgId] = useState(null);
  const [adminForms, setAdminForms] = useState({});
  const [addingAdminFor, setAddingAdminFor] = useState(null);

  async function load() {
    const [overviewData, engagementData] = await Promise.all([
      platformApi.overview(),
      platformApi.conjuntosEngagement(),
    ]);
    setOrganizations(overviewData.organizations);
    setEngagement(engagementData);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  const buildings = engagement?.buildings || [];
  const summary = engagement?.summary || {};

  const visibleBuildings = useMemo(() => {
    if (!onlyNeedsAttention) return buildings;
    return buildings.filter((row) => ['critical', 'low', 'setup'].includes(row.health.key));
  }, [buildings, onlyNeedsAttention]);

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
        address: { city: form.city, state: form.state, country: form.country || 'Colombia' },
        description: form.description,
        admins,
      });

      setForm(emptyConjunto);
      setShowCreateForm(false);
      setSuccess('Conjunto creado correctamente.');
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
          Adopción de la app por apartamento. Identifica unidades sin app activa y registra
          seguimiento de visitas para impulsar la descarga.
        </p>
      </header>

      {error && <div className="admin-error">{error}</div>}
      {success && <div className="admin-success">{success}</div>}

      {summary.totalBuildings > 0 && (
        <div className="conjuntos-summary">
          <div className="admin-stat">
            <p className="admin-stat__label">Conjuntos</p>
            <p className="admin-stat__value">{summary.totalBuildings}</p>
          </div>
          <div className="admin-stat">
            <p className="admin-stat__label">Apartamentos</p>
            <p className="admin-stat__value">{summary.totalApartments ?? 0}</p>
          </div>
          <div className="admin-stat">
            <p className="admin-stat__label">Con app activa</p>
            <p className="admin-stat__value">{summary.unitsWithActiveApp ?? 0}</p>
            <p className="conjuntos-metric-sub">últimos {summary.appActiveWindowDays || 30} días</p>
          </div>
          <div className="admin-stat">
            <p className="admin-stat__label">Sin app activa</p>
            <p className="admin-stat__value admin-stat__value--warn">
              {summary.unitsWithoutApp ?? 0}
            </p>
          </div>
          <div className="admin-stat">
            <p className="admin-stat__label">Adopción promedio</p>
            <p className="admin-stat__value">{summary.averageAppAdoption ?? 0}%</p>
          </div>
          <div className="admin-stat">
            <p className="admin-stat__label">Pendientes visita</p>
            <p className="admin-stat__value admin-stat__value--alert">
              {summary.unitsPendingFollowUp ?? 0}
            </p>
          </div>
          <div className="admin-stat">
            <p className="admin-stat__label">Requieren refuerzo</p>
            <p className="admin-stat__value admin-stat__value--warn">
              {summary.lowEngagementBuildings ?? 0}
            </p>
          </div>
        </div>
      )}

      <div className="admin-card conjuntos-table-card">
        <div className="conjuntos-table-card__head">
          <h2>Adopción por conjunto</h2>
          <p>
            App activa = al menos un residente del apartamento con sesión en los últimos{' '}
            {summary.appActiveWindowDays || 30} días.
          </p>
        </div>

        <div className="conjuntos-toolbar" style={{ padding: '0 1.25rem 1rem' }}>
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={onlyNeedsAttention}
              onChange={(e) => setOnlyNeedsAttention(e.target.checked)}
            />
            Solo conjuntos que requieren atención
          </label>
          <p className="conjuntos-toolbar__hint">
            Ordenados por prioridad: baja adopción primero.
          </p>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Salud</th>
                <th>Conjunto</th>
                <th>Apartamentos</th>
                <th>Con app</th>
                <th>Sin app</th>
                <th>Adopción</th>
                <th>Seguimiento</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {!engagement ? (
                <tr>
                  <td colSpan={8} className="admin-empty">
                    Cargando indicadores…
                  </td>
                </tr>
              ) : visibleBuildings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="admin-empty">
                    No hay conjuntos con este filtro.
                  </td>
                </tr>
              ) : (
                visibleBuildings.map((row) => (
                  <tr key={row.buildingId}>
                    <td>
                      <span className={`conjuntos-health conjuntos-health--${row.health.key}`}>
                        {row.health.label}
                      </span>
                    </td>
                    <td>
                      <span className="conjuntos-building-name">{row.buildingName}</span>
                      <span className="conjuntos-building-org">{row.organizationName}</span>
                      <span className="conjuntos-metric-sub">
                        {row.city}
                        {row.country ? ` · ${row.country}` : ''}
                      </span>
                    </td>
                    <td>
                      <span className="conjuntos-metric">{row.totalApartments ?? 0}</span>
                    </td>
                    <td>
                      <span className="conjuntos-metric">{row.unitsWithActiveApp ?? 0}</span>
                    </td>
                    <td>
                      <span className="conjuntos-metric">{row.unitsWithoutApp ?? 0}</span>
                    </td>
                    <td>
                      <AdoptionCell rate={row.appAdoptionRate ?? 0} healthKey={row.health.key} />
                    </td>
                    <td>
                      <span className="conjuntos-metric-sub">
                        {row.unitsWithFollowUp ?? 0} con visita
                      </span>
                      <span className="conjuntos-metric-sub">
                        {row.unitsPendingFollowUp ?? 0} pendientes
                      </span>
                    </td>
                    <td className="admin-actions">
                      <Link
                        to={`/super-admin/conjuntos/${row.buildingId}/adopcion`}
                        className="admin-btn"
                      >
                        Ver sin app
                      </Link>
                      <button
                        type="button"
                        className="admin-btn admin-btn--ghost"
                        onClick={() =>
                          manageConjunto(
                            { _id: row.organizationId, name: row.organizationName },
                            { _id: row.buildingId, name: row.buildingName }
                          )
                        }
                      >
                        Administrar
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn--ghost"
                        onClick={() =>
                          setExpandedOrgId(
                            expandedOrgId === String(row.organizationId)
                              ? null
                              : String(row.organizationId)
                          )
                        }
                      >
                        Admins
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <button
        type="button"
        className="admin-btn admin-btn--ghost conjuntos-create-toggle"
        onClick={() => setShowCreateForm((prev) => !prev)}
      >
        {showCreateForm ? 'Ocultar formulario' : '+ Crear nuevo conjunto'}
      </button>

      {showCreateForm && (
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
            <label>
              País
              <input
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                placeholder="Colombia"
              />
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
      )}

      {expandedOrgId && (
        <div className="admin-card">
          <h2>Administradores del conjunto</h2>
          {organizations
            .filter((org) => String(org._id) === expandedOrgId)
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
