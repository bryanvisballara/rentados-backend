import { useEffect, useState } from 'react';
import { formatCop, residentApi } from '../api/client';
import './ResidentLayout.css';

export default function ResidentProvidersPage() {
  const [providers, setProviders] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Prestadores · Rentados';
    residentApi
      .providers()
      .then((data) => setProviders(data.providers || []))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="resident-page">
      <header className="resident-page__header">
        <h1 className="resident-page__title">Prestadores</h1>
        <p className="resident-page__subtitle">
          Profesionales verificados disponibles para tu conjunto.
        </p>
      </header>

      <div className="resident-page__body">
        {error && <div className="resident-error">{error}</div>}

        {providers.length === 0 ? (
          <p className="resident-empty">No hay prestadores activos en este momento.</p>
        ) : (
          providers.map((item) => (
            <article key={item.id} className="resident-provider-card">
              <div className="resident-provider-card__avatar resident-provider-card__avatar--placeholder">
                {item.category?.name?.slice(0, 1) || 'P'}
              </div>
              <div>
                <h3 style={{ margin: '0 0 0.2rem' }}>{item.provider.businessName}</h3>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6b655c' }}>
                  {item.title} · {item.category?.name}
                </p>
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem' }}>
                  {item.description || item.provider.description}
                </p>
                <div style={{ marginTop: '0.45rem', display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                  {item.provider.rating > 0 && (
                    <span className="resident-rating">★ {item.provider.rating.toFixed(1)}</span>
                  )}
                  {item.priceFrom > 0 && (
                    <span className="resident-rating">Desde {formatCop(item.priceFrom)}</span>
                  )}
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
