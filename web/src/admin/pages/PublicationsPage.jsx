import { useEffect, useState } from 'react';
import { adminApi } from '../../api/client';
import '../admin.css';

const emptyForm = { title: '', body: '', file: null };

export default function PublicationsPage() {
  const [publications, setPublications] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  async function load() {
    const data = await adminApi.publications.list();
    setPublications(data.publications);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!form.file) {
      setPreviewUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(form.file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [form.file]);

  function handleFileChange(e) {
    const file = e.target.files?.[0] || null;
    setForm((prev) => ({ ...prev, file }));
    setError('');
  }

  async function handleCreate(e) {
    e.preventDefault();
    setUploading(true);
    setError('');

    try {
      let media = [];
      if (form.file) {
        const { media: uploaded } = await adminApi.publications.uploadMedia(form.file);
        media = [uploaded];
      }

      await adminApi.publications.create({
        title: form.title,
        body: form.body,
        media,
      });

      setForm(emptyForm);
      const fileInput = document.getElementById('publication-media-file');
      if (fileInput) fileInput.value = '';
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
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

  const previewIsVideo = form.file?.type?.startsWith('video/');

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <h1>Publicaciones</h1>
        <p>Comunicados con fotos y videos para residentes. Los archivos se optimizan automáticamente en Cloudinary.</p>
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
            Imagen o video
            <input
              id="publication-media-file"
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,image/heic,video/mp4,video/quicktime,video/webm"
              onChange={handleFileChange}
            />
          </label>
          {previewUrl && (
            <div className="admin-media-preview" style={{ gridColumn: '1 / -1' }}>
              {previewIsVideo ? (
                <video src={previewUrl} controls muted playsInline className="admin-media-preview__media" />
              ) : (
                <img src={previewUrl} alt="Vista previa" className="admin-media-preview__media" />
              )}
              <p className="admin-media-preview__name">{form.file?.name}</p>
            </div>
          )}
          <label style={{ gridColumn: '1 / -1' }}>
            Contenido
            <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required />
          </label>
          <button type="submit" className="admin-btn" disabled={uploading}>
            {uploading ? 'Subiendo…' : 'Publicar'}
          </button>
        </form>
      </div>

      <div className="admin-card">
        <h2>Publicaciones recientes</h2>
        {publications.length === 0 ? (
          <p className="admin-empty">No hay publicaciones aún.</p>
        ) : (
          publications.map((p) => {
            const media = p.media?.[0];
            const previewSrc = media?.thumbnailUrl || media?.url;
            return (
              <div
                key={p._id}
                style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--color-border)' }}
              >
                <strong>{p.title}</strong>
                <p style={{ margin: '0.35rem 0', color: 'var(--color-text-muted)' }}>{p.body}</p>
                {media?.type === 'video' && media.url ? (
                  <video
                    src={media.url}
                    controls
                    playsInline
                    style={{ maxWidth: '320px', borderRadius: '12px' }}
                  />
                ) : (
                  previewSrc && (
                    <img src={previewSrc} alt="" style={{ maxWidth: '220px', borderRadius: '12px' }} />
                  )
                )}
                <div style={{ marginTop: '0.5rem' }}>
                  <button type="button" className="admin-btn admin-btn--danger" onClick={() => handleRemove(p._id)}>
                    Eliminar
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
