import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../../api/client';
import '../admin.css';

const emptyForm = {
  title: '',
  body: '',
  file: null,
  audienceScope: 'building',
  audienceTowerIds: [],
  audienceUnitIds: [],
};

function toggleId(list, id) {
  const key = String(id);
  return list.includes(key) ? list.filter((item) => item !== key) : [...list, key];
}

function describeAudience(pub, towers, units) {
  const scope = pub.audienceScope || 'building';
  if (scope === 'building') return 'Todo el conjunto';
  if (scope === 'towers') {
    const ids = (pub.audienceTowerIds || []).map(String);
    const names = ids
      .map((id) => towers.find((tower) => String(tower._id) === id)?.name)
      .filter(Boolean);
    return names.length ? `Torres: ${names.join(', ')}` : 'Torres seleccionadas';
  }
  if (scope === 'units') {
    const ids = (pub.audienceUnitIds || []).map(String);
    const labels = ids
      .map((id) => {
        const unit = units.find((item) => String(item._id) === id);
        if (!unit) return null;
        const tower = unit.tower ? `${unit.tower} · ` : '';
        return `${tower}Apto ${unit.number}`;
      })
      .filter(Boolean);
    return labels.length ? `Apartamentos: ${labels.join(', ')}` : 'Apartamentos seleccionados';
  }
  return 'Todo el conjunto';
}

export default function PublicationsPage() {
  const [publications, setPublications] = useState([]);
  const [towers, setTowers] = useState([]);
  const [units, setUnits] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  async function load() {
    const [pubData, towerData, unitData] = await Promise.all([
      adminApi.publications.list(),
      adminApi.towers.list(),
      adminApi.units.list(),
    ]);
    setPublications(pubData.publications);
    setTowers(towerData.towers || []);
    setUnits(unitData.units || []);
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

  const sortedUnits = useMemo(
    () =>
      [...units].sort((a, b) => {
        const towerA = String(a.tower || a.towerId?.name || '');
        const towerB = String(b.tower || b.towerId?.name || '');
        if (towerA !== towerB) return towerA.localeCompare(towerB, 'es');
        return String(a.number).localeCompare(String(b.number), 'es', { numeric: true });
      }),
    [units]
  );

  function handleFileChange(e) {
    const file = e.target.files?.[0] || null;
    setForm((prev) => ({ ...prev, file }));
    setError('');
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (form.audienceScope === 'towers' && form.audienceTowerIds.length === 0) {
      setError('Selecciona al menos una torre.');
      return;
    }
    if (form.audienceScope === 'units' && form.audienceUnitIds.length === 0) {
      setError('Selecciona al menos un apartamento.');
      return;
    }

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
        audienceScope: form.audienceScope,
        audienceTowerIds: form.audienceScope === 'towers' ? form.audienceTowerIds : [],
        audienceUnitIds: form.audienceScope === 'units' ? form.audienceUnitIds : [],
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
          <fieldset className="admin-audience" style={{ gridColumn: '1 / -1' }}>
            <legend>¿Quién puede ver esta publicación?</legend>
            <div className="admin-audience__options">
              <label className="admin-audience__radio">
                <input
                  type="radio"
                  name="audienceScope"
                  value="building"
                  checked={form.audienceScope === 'building'}
                  onChange={() =>
                    setForm((prev) => ({
                      ...prev,
                      audienceScope: 'building',
                      audienceTowerIds: [],
                      audienceUnitIds: [],
                    }))
                  }
                />
                Todo el conjunto
              </label>
              <label className="admin-audience__radio">
                <input
                  type="radio"
                  name="audienceScope"
                  value="towers"
                  checked={form.audienceScope === 'towers'}
                  onChange={() =>
                    setForm((prev) => ({
                      ...prev,
                      audienceScope: 'towers',
                      audienceUnitIds: [],
                    }))
                  }
                />
                Por torre(s)
              </label>
              <label className="admin-audience__radio">
                <input
                  type="radio"
                  name="audienceScope"
                  value="units"
                  checked={form.audienceScope === 'units'}
                  onChange={() =>
                    setForm((prev) => ({
                      ...prev,
                      audienceScope: 'units',
                      audienceTowerIds: [],
                    }))
                  }
                />
                Por apartamento(s)
              </label>
            </div>

            {form.audienceScope === 'towers' && (
              <div className="admin-audience__pickers">
                {towers.length === 0 ? (
                  <p className="admin-field-hint">No hay torres registradas en este conjunto.</p>
                ) : (
                  towers.map((tower) => (
                    <label key={tower._id} className="admin-audience__check">
                      <input
                        type="checkbox"
                        checked={form.audienceTowerIds.includes(String(tower._id))}
                        onChange={() =>
                          setForm((prev) => ({
                            ...prev,
                            audienceTowerIds: toggleId(prev.audienceTowerIds, tower._id),
                          }))
                        }
                      />
                      {tower.name}
                    </label>
                  ))
                )}
              </div>
            )}

            {form.audienceScope === 'units' && (
              <div className="admin-audience__pickers admin-audience__pickers--scroll">
                {sortedUnits.length === 0 ? (
                  <p className="admin-field-hint">No hay apartamentos registrados.</p>
                ) : (
                  sortedUnits.map((unit) => (
                    <label key={unit._id} className="admin-audience__check">
                      <input
                        type="checkbox"
                        checked={form.audienceUnitIds.includes(String(unit._id))}
                        onChange={() =>
                          setForm((prev) => ({
                            ...prev,
                            audienceUnitIds: toggleId(prev.audienceUnitIds, unit._id),
                          }))
                        }
                      />
                      {unit.tower ? `${unit.tower} · ` : ''}Apto {unit.number}
                    </label>
                  ))
                )}
              </div>
            )}
          </fieldset>
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
                <p className="admin-publication-audience">{describeAudience(p, towers, units)}</p>
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
