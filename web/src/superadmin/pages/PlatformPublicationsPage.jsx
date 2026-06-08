import { useEffect, useState } from 'react';
import { platformApi } from '../../api/client';
import '../../admin/admin.css';

const emptyPub = {
  title: '',
  body: '',
  targetCountries: '',
  targetCities: '',
  isPinned: false,
};

function parseList(value) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function PlatformPublicationsPage() {
  const [publications, setPublications] = useState([]);
  const [form, setForm] = useState(emptyPub);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function load() {
    const data = await platformApi.publications();
    setPublications(data.publications.filter((p) => p.isActive !== false));
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await platformApi.createPublication({
        title: form.title,
        body: form.body,
        targetCountries: parseList(form.targetCountries),
        targetCities: parseList(form.targetCities),
        isPinned: form.isPinned,
      });
      setForm(emptyPub);
      setSuccess('Publicación creada.');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deactivate(id) {
    if (!window.confirm('¿Desactivar esta publicación?')) return;
    try {
      await platformApi.removePublication(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <h1>Publicaciones globales</h1>
        <p>
          Comunicados para residentes de todos los conjuntos. Filtra por país y ciudad (vacío =
          todos).
        </p>
      </header>

      {error && <div className="admin-error">{error}</div>}
      {success && (
        <div className="admin-card" style={{ background: '#dceee4', color: '#1e5a3d' }}>
          {success}
        </div>
      )}

      <div className="admin-card">
        <h2>Nueva publicación</h2>
        <form className="admin-form" onSubmit={handleCreate}>
          <label>
            Título
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </label>
          <label>
            Contenido
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={5}
              required
            />
          </label>
          <label>
            Países (separados por coma)
            <input
              value={form.targetCountries}
              onChange={(e) => setForm({ ...form, targetCountries: e.target.value })}
              placeholder="Colombia, México — vacío = todos"
            />
          </label>
          <label>
            Ciudades (separadas por coma)
            <input
              value={form.targetCities}
              onChange={(e) => setForm({ ...form, targetCities: e.target.value })}
              placeholder="Cartagena, Bogotá — vacío = todas"
            />
          </label>
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={form.isPinned}
              onChange={(e) => setForm({ ...form, isPinned: e.target.checked })}
            />
            Fijar publicación
          </label>
          <button type="submit" className="admin-btn">
            Publicar
          </button>
        </form>
      </div>

      <div className="admin-card admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Título</th>
              <th>Alcance</th>
              <th>Fecha</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {publications.map((p) => (
              <tr key={p._id}>
                <td>
                  <strong>{p.title}</strong>
                  {p.isPinned && (
                    <span className="admin-badge admin-badge--pending" style={{ marginLeft: '0.5rem' }}>
                      Fijada
                    </span>
                  )}
                </td>
                <td>
                  {(p.targetCountries?.length ? p.targetCountries.join(', ') : 'Todos los países')}
                  <br />
                  {(p.targetCities?.length ? p.targetCities.join(', ') : 'Todas las ciudades')}
                </td>
                <td>{new Date(p.publishedAt || p.createdAt).toLocaleString()}</td>
                <td>
                  <button
                    type="button"
                    className="admin-btn admin-btn--danger"
                    onClick={() => deactivate(p._id)}
                  >
                    Desactivar
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
