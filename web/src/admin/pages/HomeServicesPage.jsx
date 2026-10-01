import { useEffect, useState } from 'react';
import { adminApi } from '../../api/client';
import '../admin.css';

export default function HomeServicesPage() {
  const [services, setServices] = useState([]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [uploadingId, setUploadingId] = useState('');

  async function load() {
    const data = await adminApi.homeServices.list();
    setServices(data.services || []);
  }

  useEffect(() => {
    document.title = 'Prestadores Rentados · Admin';
    load().catch((err) => setError(err.message));
  }, []);

  async function saveService(service) {
    setError('');
    setSaved('');
    try {
      const data = await adminApi.homeServices.update(service.id, {
        name: service.name,
        description: service.description,
        isActive: service.isActive,
      });
      setServices((prev) => prev.map((s) => (s.id === service.id ? data.service : s)));
      setSaved(`Guardado: ${data.service.name}`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function uploadImage(id, file) {
    if (!file) return;
    setUploadingId(id);
    setError('');
    try {
      const data = await adminApi.homeServices.uploadImage(id, file);
      setServices((prev) => prev.map((s) => (s.id === id ? data.service : s)));
      setSaved('Imagen actualizada.');
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingId('');
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <h1>Prestadores Rentados</h1>
        <p>
          Servicios a domicilio que ofrece Rentados a los residentes. Edita textos e imágenes; el
          listado base (aseo, plomería, etc.) se crea automáticamente por conjunto.
        </p>
      </header>

      {error && <div className="admin-error">{error}</div>}
      {saved && (
        <div className="admin-card" style={{ background: '#dceee4', color: '#1e5a3d' }}>
          {saved}
        </div>
      )}

      <div className="admin-card-grid">
        {services.map((service) => (
          <article key={service.id} className="admin-card admin-home-service-card">
            <div
              className="admin-home-service-card__image"
              style={{
                backgroundImage: service.imageUrl ? `url('${service.imageUrl}')` : undefined,
              }}
            />
            <form
              className="admin-form"
              onSubmit={(e) => {
                e.preventDefault();
                saveService(service);
              }}
            >
              <label>
                Nombre
                <input
                  value={service.name}
                  onChange={(e) =>
                    setServices((prev) =>
                      prev.map((s) => (s.id === service.id ? { ...s, name: e.target.value } : s))
                    )
                  }
                  required
                />
              </label>
              <label>
                Descripción
                <textarea
                  value={service.description || ''}
                  rows={3}
                  onChange={(e) =>
                    setServices((prev) =>
                      prev.map((s) =>
                        s.id === service.id ? { ...s, description: e.target.value } : s
                      )
                    )
                  }
                />
              </label>
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={service.isActive !== false}
                  onChange={(e) =>
                    setServices((prev) =>
                      prev.map((s) =>
                        s.id === service.id ? { ...s, isActive: e.target.checked } : s
                      )
                    )
                  }
                />
                Visible en portal del residente
              </label>
              <label>
                Imagen
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingId === service.id}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    uploadImage(service.id, file);
                    e.target.value = '';
                  }}
                />
              </label>
              <button type="submit" className="admin-btn">
                Guardar
              </button>
            </form>
          </article>
        ))}
      </div>
    </div>
  );
}
