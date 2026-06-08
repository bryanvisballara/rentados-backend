import { useEffect, useState } from 'react';
import { providerApi } from '../../api/client';
import '../../admin/admin.css';

const STATUS_LABELS = {
  pending: 'Solicitud en revisión',
  approved: 'Prestador aprobado',
  rejected: 'Solicitud rechazada',
};

function buildOfferingForms(provider) {
  const categories = provider?.categoryIds || [];
  const byCategory = Object.fromEntries(
    (provider?.offerings || []).map((o) => [String(o.categoryId?._id || o.categoryId), o])
  );

  return categories.map((category) => {
    const existing = byCategory[String(category._id)] || {};
    return {
      categoryId: category._id,
      categoryName: category.name,
      description: existing.description || '',
      pricingNotes: existing.pricingNotes || '',
      referencePrice:
        existing.referencePrice != null && existing.referencePrice !== ''
          ? String(existing.referencePrice)
          : '',
    };
  });
}

export default function ProviderHomePage() {
  const [profile, setProfile] = useState(null);
  const [interviews, setInterviews] = useState([]);
  const [offerings, setOfferings] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const [meData, interviewsData] = await Promise.all([
      providerApi.me(),
      providerApi.interviews(),
    ]);
    setProfile(meData);
    setInterviews(interviewsData.interviews);
    setOfferings(buildOfferingForms(meData.provider));
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  const provider = profile?.provider;
  const status = provider?.approvalStatus || 'pending';

  function updateOffering(categoryId, field, value) {
    setOfferings((rows) =>
      rows.map((row) =>
        row.categoryId === categoryId ? { ...row, [field]: value } : row
      )
    );
  }

  async function saveOfferings(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await providerApi.updateOfferings(
        offerings.map(({ categoryId, description, pricingNotes, referencePrice }) => ({
          categoryId,
          description,
          pricingNotes,
          referencePrice: referencePrice === '' ? undefined : Number(referencePrice),
        }))
      );
      setSuccess('Tarifas guardadas.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <h1>{provider?.businessName || 'Mi perfil'}</h1>
        <p>Estado de tu solicitud, entrevistas y tarifas por servicio.</p>
      </header>

      {error && <div className="admin-error">{error}</div>}
      {success && (
        <div className="admin-card" style={{ background: '#dceee4', color: '#1e5a3d' }}>
          {success}
        </div>
      )}

      <div className="admin-card">
        <h2>Estado</h2>
        <p>
          <span className={`admin-badge admin-badge--${status === 'approved' ? 'paid' : 'pending'}`}>
            {STATUS_LABELS[status] || status}
          </span>
        </p>
        {status === 'pending' && (
          <p className="admin-empty">
            Tu perfil está en revisión. Cuando agendemos una entrevista, la verás abajo.
          </p>
        )}
        {status === 'approved' && (
          <p className="admin-empty">
            Define tus tarifas por servicio. Los precios finales dependen de cada trabajo.
          </p>
        )}
        {status === 'rejected' && (
          <p className="admin-empty">{provider?.rejectionReason || 'Contacta a soporte Rentados.'}</p>
        )}
      </div>

      {status === 'approved' && offerings.length > 0 && (
        <div className="admin-card">
          <h2>Mis tarifas por servicio</h2>
          <p className="admin-empty" style={{ marginTop: 0 }}>
            Indica referencias y condiciones (tamaño del apto, urgencia, materiales, etc.).
          </p>
          <form onSubmit={saveOfferings}>
            {offerings.map((row) => (
              <div key={row.categoryId} className="admin-form" style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ margin: '0 0 0.75rem' }}>{row.categoryName}</h3>
                <label>
                  Descripción de tu servicio
                  <textarea
                    value={row.description}
                    onChange={(e) => updateOffering(row.categoryId, 'description', e.target.value)}
                    rows={2}
                  />
                </label>
                <label>
                  Condiciones de precio
                  <input
                    value={row.pricingNotes}
                    onChange={(e) => updateOffering(row.categoryId, 'pricingNotes', e.target.value)}
                    placeholder="Ej: Según m² del apto y tipo de daño"
                  />
                </label>
                <label>
                  Precio referencia desde (opcional)
                  <input
                    type="number"
                    min="0"
                    value={row.referencePrice}
                    onChange={(e) => updateOffering(row.categoryId, 'referencePrice', e.target.value)}
                    placeholder="Valor orientativo, no fijo"
                  />
                </label>
              </div>
            ))}
            <button type="submit" className="admin-btn" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar tarifas'}
            </button>
          </form>
        </div>
      )}

      <div className="admin-card">
        <h2>Entrevistas</h2>
        {interviews.length === 0 ? (
          <p className="admin-empty">No tienes citas programadas.</p>
        ) : (
          <ul className="admin-list">
            {interviews.map((item) => (
              <li key={item._id} style={{ marginBottom: '1rem' }}>
                <strong>{new Date(item.scheduledAt).toLocaleString()}</strong>
                <br />
                {item.location || 'Lugar por confirmar'}
                {item.notes && (
                  <>
                    <br />
                    {item.notes}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
