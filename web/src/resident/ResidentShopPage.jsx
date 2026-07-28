import { useEffect, useState } from 'react';
import ResidentShopSection from './ResidentShopSection';
import { residentApi } from '../api/client';
import './ResidentLayout.css';

export default function ResidentShopPage() {
  const [shopData, setShopData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Shop · Rentados';
    residentApi
      .shop()
      .then(setShopData)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="resident-page">
      <header className="resident-page__header">
        <h1 className="resident-page__title">Shop</h1>
        <p className="resident-page__subtitle">Productos seleccionados para tu hogar.</p>
      </header>

      <div className="resident-page__body">
        {error && <div className="resident-error">{error}</div>}
        {!shopData && !error ? (
          <p className="resident-empty">Cargando shop…</p>
        ) : (
          shopData && <ResidentShopSection shopData={shopData} />
        )}
      </div>
    </div>
  );
}
