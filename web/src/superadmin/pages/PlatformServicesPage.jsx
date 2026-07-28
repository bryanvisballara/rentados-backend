import { useEffect, useState } from 'react';
import { platformApi } from '../../api/client';
import '../../admin/admin.css';

const emptyCategory = {
  name: '',
  slug: '',
  description: '',
  icon: '',
  sortOrder: '0',
};

export default function PlatformServicesPage() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(emptyCategory);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const data = await platformApi.serviceCategories();
    setCategories(data.categories || []);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  function startEdit(category) {
    setEditingId(category._id);
    setForm({
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      icon: category.icon || '',
      sortOrder: String(category.sortOrder ?? 0),
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyCategory);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    const body = {
      name: form.name.trim(),
      slug: form.slug.trim() || undefined,
      description: form.description.trim() || undefined,
      icon: form.icon.trim() || undefined,
      sortOrder: Number(form.sortOrder) || 0,
    };

    try {
      setSaving(true);
      if (editingId) {
        await platformApi.updateServiceCategory(editingId, body);
        setSuccess(`Servicio "${body.name}" actualizado. Visible en registro de prestadores.`);
      } else {
        const result = await platformApi.createServiceCategory(body);
        setSuccess(
          `Servicio "${result.category?.name || body.name}" creado. Ya aparece en el registro de prestadores.`
        );
      }
      cancelEdit();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(id) {
    if (!window.confirm('¿Desactivar este servicio del catálogo?')) return;
    try {
      await platformApi.removeServiceCategory(id);
      setSuccess('Servicio desactivado.');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const activeCategories = categories.filter((c) => c.isActive !== false);
  const inactiveCategories = categories.filter((c) => c.isActive === false);

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <h1>Catálogo de servicios</h1>
        <p>
          Tipos de servicio que verán residentes y prestadores (plomería, aseo, jardinería, etc.).
          Lo que guardes aquí alimenta el formulario de registro de prestadores en tiempo real.
        </p>
        <p className="admin-page__header-meta">
          {activeCategories.length} activo(s)
          {inactiveCategories.length > 0 ? ` · ${inactiveCategories.length} inactivo(s)` : ''}
        </p>
      </header>

      {error && <div className="admin-error">{error}</div>}
      {success && (
        <div className="admin-card" style={{ background: '#dceee4', color: '#1e5a3d' }}>
          {success}
        </div>
      )}

      <div className="admin-card">
        <h2>{editingId ? 'Editar servicio' : 'Nuevo servicio'}</h2>
        <form className="admin-form" onSubmit={handleSubmit}>
          <label>
            Nombre
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ej: Plomería"
              required
            />
          </label>
          <label>
            Slug (opcional)
            <input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="plomeria"
            />
          </label>
          <label>
            Descripción
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              placeholder="Qué incluye este tipo de servicio"
            />
          </label>
          <label>
            Icono (opcional)
            <input
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              placeholder="wrench, sparkles, zap…"
            />
          </label>
          <label>
            Orden
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
            />
          </label>
          <div className="admin-actions">
            <button type="submit" className="admin-btn" disabled={saving}>
              {saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Agregar servicio'}
            </button>
            {editingId && (
              <button type="button" className="admin-btn admin-btn--ghost" onClick={cancelEdit}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="admin-card admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Orden</th>
              <th>Servicio</th>
              <th>Slug</th>
              <th>Descripción</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {activeCategories.length === 0 ? (
              <tr>
                <td colSpan={6} className="admin-empty">
                  No hay servicios en el catálogo.
                </td>
              </tr>
            ) : (
              activeCategories.map((category) => (
                <tr key={category._id}>
                  <td>{category.sortOrder ?? 0}</td>
                  <td>
                    <strong>{category.name}</strong>
                    {category.icon && (
                      <span className="admin-empty" style={{ display: 'block' }}>
                        icono: {category.icon}
                      </span>
                    )}
                  </td>
                  <td>{category.slug}</td>
                  <td>{category.description || '—'}</td>
                  <td>
                    <span className="admin-badge admin-badge--paid">Activo</span>
                  </td>
                  <td className="admin-actions">
                    <button
                      type="button"
                      className="admin-btn admin-btn--ghost"
                      onClick={() => startEdit(category)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn--danger"
                      onClick={() => deactivate(category._id)}
                    >
                      Desactivar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {inactiveCategories.length > 0 && (
        <div className="admin-card admin-table-wrap">
          <h2>Servicios inactivos</h2>
          <p className="admin-empty" style={{ padding: '0 0 1rem' }}>
            No aparecen en el registro de prestadores.
          </p>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Servicio</th>
                <th>Slug</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {inactiveCategories.map((category) => (
                <tr key={category._id}>
                  <td>{category.name}</td>
                  <td>{category.slug}</td>
                  <td className="admin-actions">
                    <button
                      type="button"
                      className="admin-btn admin-btn--ghost"
                      onClick={async () => {
                        try {
                          await platformApi.updateServiceCategory(category._id, { isActive: true });
                          setSuccess(`Servicio "${category.name}" reactivado.`);
                          await load();
                        } catch (err) {
                          setError(err.message);
                        }
                      }}
                    >
                      Reactivar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
