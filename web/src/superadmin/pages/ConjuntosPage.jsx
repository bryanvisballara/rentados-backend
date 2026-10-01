import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { platformApi } from '../../api/client';
import { setActiveTenant } from '../../api/tenantContext';
import '../../admin/admin.css';
import './ConjuntosPage.css';

const emptyConjunto = {
  companyMode: 'new',
  organizationId: '',
  organizationName: '',
  nit: '',
  email: '',
  phone: '',
  buildingName: '',
  street: '',
  city: '',
  state: '',
  country: 'Colombia',
  description: '',
  adminFirstName: '',
  adminLastName: '',
  adminEmail: '',
  adminPassword: '',
};

const emptyBuildingEdit = {
  buildingName: '',
  street: '',
  city: '',
  state: '',
  country: 'Colombia',
  description: '',
};

const emptyAdmin = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  scope: 'company',
  buildingId: '',
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
  const [editingBuildingId, setEditingBuildingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyBuildingEdit);
  const [savingBuilding, setSavingBuilding] = useState(false);
  const [assignmentDraft, setAssignmentDraft] = useState({});
  const [savingAssignmentId, setSavingAssignmentId] = useState('');
  const adminsPanelRef = useRef(null);

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

  useEffect(() => {
    if (!expandedOrgId || !adminsPanelRef.current) return;
    adminsPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [expandedOrgId]);

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
      if (form.companyMode === 'existing') {
        if (!form.organizationId) {
          setError('Elige la empresa cliente a la que pertenece este conjunto.');
          return;
        }
        await platformApi.createBuilding(form.organizationId, {
          name: form.buildingName,
          address: {
            street: form.street,
            city: form.city,
            state: form.state,
            country: form.country || 'Colombia',
          },
          description: form.description,
        });
        setForm(emptyConjunto);
        setShowCreateForm(false);
        setSuccess('Conjunto agregado a la empresa. Su administrador de toda la empresa ya puede verlo.');
        await load();
        return;
      }

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
        address: {
          street: form.street,
          city: form.city,
          state: form.state,
          country: form.country || 'Colombia',
        },
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

  function openAdmins(row) {
    const orgId = String(row.organizationId);
    setExpandedOrgId(expandedOrgId === orgId ? null : orgId);
    setAddingAdminFor(orgId);
    setEditingBuildingId(null);
    setAdminForms((prev) => ({
      ...prev,
      [orgId]: {
        ...emptyAdmin,
        scope: 'building',
        buildingId: String(row.buildingId),
      },
    }));
  }

  async function addAdmin(orgId) {
    const adminForm = getAdminForm(orgId);
    if (adminForm.scope === 'building' && !adminForm.buildingId) {
      setError('Elige el conjunto al que pertenece este administrador.');
      return;
    }
    try {
      await platformApi.createAdmin(orgId, {
        firstName: adminForm.firstName,
        lastName: adminForm.lastName,
        email: adminForm.email,
        password: adminForm.password,
        buildingId: adminForm.scope === 'building' ? adminForm.buildingId : undefined,
      });
      setAdminForms((prev) => ({ ...prev, [orgId]: emptyAdmin }));
      setAddingAdminFor(null);
      setSuccess(
        adminForm.scope === 'building'
          ? 'Administrador del conjunto creado.'
          : 'Administrador de la empresa creado. Puede entrar a todos los conjuntos.'
      );
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveAssignment(admin, org) {
    const selected = assignmentDraft[admin.id] ?? (admin.buildingId ? String(admin.buildingId) : 'company');
    setSavingAssignmentId(admin.id);
    setError('');
    setSuccess('');
    try {
      await platformApi.updateAdmin(admin.id, {
        scope: selected === 'company' ? 'company' : 'building',
        buildingId: selected === 'company' ? null : selected,
      });
      setSuccess(
        selected === 'company'
          ? `${admin.firstName} ahora ve todos los conjuntos de ${org.name}.`
          : `${admin.firstName} quedó asignado a un solo conjunto.`
      );
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingAssignmentId('');
    }
  }

  function startEditBuilding(row) {
    setEditingBuildingId(String(row.buildingId));
    setEditForm({
      buildingName: row.buildingName,
      street: row.street === '—' ? '' : row.street,
      city: row.city === '—' ? '' : row.city,
      state: row.state === '—' ? '' : row.state,
      country: row.country === '—' ? 'Colombia' : row.country,
      description: '',
    });
    setExpandedOrgId(null);
    setAddingAdminFor(null);
  }

  async function saveBuildingEdit(e) {
    e.preventDefault();
    setSavingBuilding(true);
    setError('');
    setSuccess('');

    try {
      await platformApi.updateBuilding(editingBuildingId, {
        name: editForm.buildingName.trim(),
        address: {
          street: editForm.street.trim(),
          city: editForm.city.trim(),
          state: editForm.state.trim(),
          country: editForm.country.trim() || 'Colombia',
        },
        description: editForm.description.trim() || undefined,
      });
      setEditingBuildingId(null);
      setEditForm(emptyBuildingEdit);
      setSuccess('Datos del conjunto actualizados.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingBuilding(false);
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
                        {[row.street !== '—' ? row.street : null, row.city !== '—' ? row.city : null, row.country]
                          .filter(Boolean)
                          .join(' · ')}
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
                      <button
                        type="button"
                        className="admin-btn admin-btn--ghost"
                        onClick={() => startEditBuilding(row)}
                      >
                        Editar
                      </button>
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
                        onClick={() => openAdmins(row)}
                      >
                        Administradores
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {expandedOrgId && (
        <div className="admin-card" ref={adminsPanelRef}>
          {organizations
            .filter((org) => String(org._id) === expandedOrgId)
            .map((org) => {
              const adminForm = getAdminForm(org._id);
              const buildingsOfOrg = org.buildings || [];
              return (
                <div key={org._id}>
                  <h2>Administradores de {org.name}</h2>
                  <p className="conjuntos-admins__hint">
                    Crea el ingreso de la empresa, que ve todos sus conjuntos, o el de un administrador
                    y asígnalo a un conjunto que ya exista.
                  </p>
                  {buildingsOfOrg.length > 0 && (
                    <p className="conjuntos-admins__hint">
                      Conjuntos: {buildingsOfOrg.map((building) => building.name).join(' · ')}
                    </p>
                  )}

                  <ul className="conjuntos-admins__list">
                    {(org.admins || []).map((admin) => {
                      const selected =
                        assignmentDraft[admin.id] ?? (admin.buildingId ? String(admin.buildingId) : 'company');
                      return (
                        <li key={admin.id} className="conjuntos-admins__item">
                          <div>
                            <strong>
                              {admin.firstName} {admin.lastName}
                            </strong>
                            <span>{admin.email}</span>
                          </div>
                          <label>
                            Asignación
                            <select
                              value={selected}
                              onChange={(event) =>
                                setAssignmentDraft((prev) => ({ ...prev, [admin.id]: event.target.value }))
                              }
                            >
                              <option value="company">Toda la empresa</option>
                              {buildingsOfOrg.map((building) => (
                                <option key={building._id} value={String(building._id)}>
                                  {building.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            type="button"
                            className="admin-btn admin-btn--ghost"
                            disabled={savingAssignmentId === admin.id}
                            onClick={() => saveAssignment(admin, org)}
                          >
                            {savingAssignmentId === admin.id ? 'Guardando…' : 'Guardar'}
                          </button>
                        </li>
                      );
                    })}
                    {!org.admins?.length && <li className="admin-empty">Sin administradores asignados.</li>}
                  </ul>

                  {addingAdminFor === String(org._id) || addingAdminFor === org._id ? (
                    <form
                      className="conjuntos-admin-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        addAdmin(org._id);
                      }}
                    >
                      <label>
                        Nombre
                        <input
                          value={adminForm.firstName}
                          onChange={(event) => updateAdminForm(org._id, 'firstName', event.target.value)}
                          required
                        />
                      </label>
                      <label>
                        Apellido
                        <input
                          value={adminForm.lastName}
                          onChange={(event) => updateAdminForm(org._id, 'lastName', event.target.value)}
                          required
                        />
                      </label>
                      <label>
                        Correo
                        <input
                          type="email"
                          value={adminForm.email}
                          onChange={(event) => updateAdminForm(org._id, 'email', event.target.value)}
                          required
                        />
                      </label>
                      <label>
                        Contraseña
                        <input
                          value={adminForm.password}
                          onChange={(event) => updateAdminForm(org._id, 'password', event.target.value)}
                          required
                        />
                      </label>
                      <label>
                        Tipo de administrador
                        <select
                          value={adminForm.scope}
                          onChange={(event) => updateAdminForm(org._id, 'scope', event.target.value)}
                        >
                          <option value="company">De la empresa (todos los conjuntos)</option>
                          <option value="building">De un solo conjunto</option>
                        </select>
                      </label>
                      {adminForm.scope === 'building' && (
                        <label>
                          Conjunto
                          <select
                            value={adminForm.buildingId}
                            onChange={(event) => updateAdminForm(org._id, 'buildingId', event.target.value)}
                            required
                          >
                            <option value="">Elige un conjunto</option>
                            {buildingsOfOrg.map((building) => (
                              <option key={building._id} value={String(building._id)}>
                                {building.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <div className="conjuntos-admin-form__actions">
                        <button type="submit" className="admin-btn">
                          Crear administrador
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
                      className="admin-btn"
                      onClick={() => setAddingAdminFor(org._id)}
                    >
                      Crear administrador
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      )}

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
          <p className="conjuntos-admins__hint">
            Una empresa cliente agrupa sus edificios. El administrador de toda la empresa solo ve los
            conjuntos de esa empresa, no los de otro cliente.
          </p>
          <form className="admin-form" onSubmit={handleCreate}>
            <label>
              Este conjunto pertenece a
              <select
                value={form.companyMode}
                onChange={(e) => setForm({ ...form, companyMode: e.target.value, organizationId: '' })}
              >
                <option value="new">Una empresa cliente nueva</option>
                <option value="existing">Una empresa que ya existe</option>
              </select>
            </label>
            {form.companyMode === 'existing' ? (
              <label>
                Empresa cliente
                <select
                  value={form.organizationId}
                  onChange={(e) => setForm({ ...form, organizationId: e.target.value })}
                  required
                >
                  <option value="">Elige la empresa</option>
                  {organizations.map((org) => (
                    <option key={org._id} value={org._id}>
                      {org.name} · {(org.buildings || []).length} conjuntos
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label>
                Nombre de la empresa
                <input
                  value={form.organizationName}
                  onChange={(e) => setForm({ ...form, organizationName: e.target.value })}
                  placeholder="Administración Paraíso Caribe"
                  required
                />
              </label>
            )}
            <label>
              Nombre del conjunto / edificio
              <input
                value={form.buildingName}
                onChange={(e) => setForm({ ...form, buildingName: e.target.value })}
                placeholder="Conjunto Paraíso Caribe"
                required
              />
            </label>
            {form.companyMode === 'new' && (
              <>
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
              </>
            )}
            <label>
              Dirección
              <input
                value={form.street}
                onChange={(e) => setForm({ ...form, street: e.target.value })}
                placeholder="Cra 75 # 78-54"
              />
            </label>
            <label>
              Ciudad
              <input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="Barranquilla"
              />
              <small style={{ color: '#6b655c', fontWeight: 400 }}>
                Define qué empresas de servicios públicos verán los residentes (energía, agua, gas,
                etc.).
              </small>
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

            {form.companyMode === 'new' && (
              <>
                <label style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}>
                  <strong>Administrador de la empresa (opcional)</strong>
                  <span style={{ display: 'block', fontWeight: 400, color: '#6b6560' }}>
                    Este ingreso ve todos los conjuntos de esta empresa, y ninguno de otro cliente.
                  </span>
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
              </>
            )}

            <button type="submit" className="admin-btn" disabled={creating}>
              {creating ? 'Creando…' : 'Crear conjunto'}
            </button>
          </form>
        </div>
      )}

      {editingBuildingId && (
        <div className="admin-card">
          <h2>Editar conjunto</h2>
          <p className="admin-empty" style={{ marginTop: 0 }}>
            La dirección ayuda a distinguir conjuntos con el mismo nombre, incluso en la misma ciudad.
          </p>
          <form className="admin-form" onSubmit={saveBuildingEdit}>
            <label>
              Nombre del conjunto
              <input
                value={editForm.buildingName}
                onChange={(e) => setEditForm({ ...editForm, buildingName: e.target.value })}
                required
              />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Dirección
              <input
                value={editForm.street}
                onChange={(e) => setEditForm({ ...editForm, street: e.target.value })}
                placeholder="Cra 75 # 78-54"
                required
              />
            </label>
            <label>
              Ciudad
              <input
                value={editForm.city}
                onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                required
              />
            </label>
            <label>
              Departamento / estado
              <input
                value={editForm.state}
                onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
              />
            </label>
            <label>
              País
              <input
                value={editForm.country}
                onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                required
              />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Descripción
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </label>
            <div className="admin-actions">
              <button type="submit" className="admin-btn" disabled={savingBuilding}>
                {savingBuilding ? 'Guardando…' : 'Guardar cambios'}
              </button>
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                onClick={() => {
                  setEditingBuildingId(null);
                  setEditForm(emptyBuildingEdit);
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
