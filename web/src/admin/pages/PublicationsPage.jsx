import { useEffect, useState } from 'react';
import { adminApi } from '../../api/client';
import '../admin.css';

export default function PublicationsPage() {
  const [publications, setPublications] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', body: '', mediaUrl: '' });

  async function load() {
    const data = await adminApi.publications.list();
    setPublications(data.publications);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await adminApi.publications.create({
        title: form.title,
        body: form.body,
        media: form.mediaUrl
          ? [{ type: 'image', url: form.mediaUrl }]
          : [],
      });
      setForm({ title: '', body: '', mediaUrl: '' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemove(id) {
    if (!window.confirm('¿Eliminar publicación?')) return;
    try {
      await adminApi.publications.remove(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <h1>Publicaciones</h1>
        <p>Comunicados con fotos y videos para residentes. Cloudinary se conectará en el siguiente paso.</p>
      </header>

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-card">
        <h2>Nueva publicación</h2>
        <form className="admin-form" onSubmit={handleCreate}>
          <label>
            Título
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </label>
          <label>
            URL imagen/video (temporal)
            <input
              value={form.mediaUrl}
              onChange={(e) => setForm({ ...form, mediaUrl: e.target.value })}
              placeholder="https://..."
            />
          </label>
          <label style={{ gridColumn: '1 / -1' }}>
            Contenido
            <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required />
          </label>
          <button type="submit" className="admin-btn">
            Publicar
          </button>
        </form>
      </div>

      <div className="admin-card">
        <h2>Publicaciones recientes</h2>
        {publications.length === 0 ? (
          <p className="admin-empty">No hay publicaciones aún.</p>
        ) : (
          publications.map((p) => (
            <div key={p._id} style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--color-border)' }}>
              <strong>{p.title}</strong>
              <p style={{ margin: '0.35rem 0', color: 'var(--color-text-muted)' }}>{p.body}</p>
              {p.media?.[0]?.url && (
                <img src={p.media[0].url} alt="" style={{ maxWidth: '220px', borderRadius: '12px' }} />
              )}
              <div style={{ marginTop: '0.5rem' }}>
                <button type="button" className="admin-btn admin-btn--danger" onClick={() => handleRemove(p._id)}>
                  Eliminar
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
