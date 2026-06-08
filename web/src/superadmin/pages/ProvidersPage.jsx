import { useEffect, useState } from 'react';
import { platformApi } from '../../api/client';
import '../../admin/admin.css';

export default function ProvidersPage() {
  const [providers, setProviders] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function load() {
    const data = await platformApi.providers();
    setProviders(data.providers);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function toggleActive(provider) {
    try {
      await platformApi.updateProvider(provider._id, { isActive: !provider.isActive });
      setSuccess(provider.isActive ? 'Prestador desactivado.' : 'Prestador activado.');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeProvider(id) {
    if (!window.confirm('¿Desactivar este prestador y sus servicios asociados?')) return;
    try {
      await platformApi.removeProvider(id);
      setSuccess('Prestador desactivado.');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <h1>Prestadores activos</h1>
        <p>Gestiona prestadores aprobados visibles para residentes.</p>
      </header>

      {error && <div className="admin-error">{error}</div>}
      {success && (
        <div className="admin-card" style={{ background: '#dceee4', color: '#1e5a3d' }}>
          {success}
        </div>
      )}

      <div className="admin-card admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Negocio</th>
              <th>Contacto</th>
              <th>Rating</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {providers.map((p) => (
              <tr key={p._id}>
                <td>
                  <strong>{p.businessName}</strong>
                  <p className="admin-empty" style={{ margin: '0.25rem 0 0' }}>
                    {(p.categoryIds || []).map((c) => c.name).join(', ') || '—'}
                  </p>
                </td>
                <td>
                  {p.userId?.firstName} {p.userId?.lastName}
                  <br />
                  {p.userId?.email}
                </td>
                <td>
                  {p.rating || 0} ({p.reviewCount || 0})
                </td>
                <td>
                  <span className={`admin-badge admin-badge--${p.isActive ? 'paid' : 'pending'}`}>
                    {p.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="admin-actions">
                  <button
                    type="button"
                    className="admin-btn admin-btn--ghost"
                    onClick={() => toggleActive(p)}
                  >
                    {p.isActive ? 'Desactivar' : 'Activar'}
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn--danger"
                    onClick={() => removeProvider(p._id)}
                  >
                    Eliminar
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
