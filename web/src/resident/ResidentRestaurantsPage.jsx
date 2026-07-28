import { useEffect, useState } from 'react';
import { formatMoney, residentApi } from '../api/client';
import './ResidentLayout.css';

export default function ResidentRestaurantsPage() {
  const [restaurants, setRestaurants] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Restaurantes · Rentados';
    residentApi
      .restaurants()
      .then((data) => setRestaurants(data.restaurants || []))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="resident-page">
      <header className="resident-page__header">
        <h1 className="resident-page__title">Restaurantes</h1>
        <p className="resident-page__subtitle">
          Opciones de comida disponibles para residentes Rentados.
        </p>
      </header>

      <div className="resident-page__body">
        {error && <div className="resident-error">{error}</div>}

        {restaurants.length === 0 ? (
          <p className="resident-empty">No hay restaurantes disponibles en tu zona.</p>
        ) : (
          restaurants.map((restaurant) => (
            <article key={restaurant.id} className="resident-restaurant-card">
              {restaurant.coverImageUrl ? (
                <img
                  src={restaurant.coverImageUrl}
                  alt=""
                  className="resident-restaurant-card__cover"
                />
              ) : (
                <div className="resident-restaurant-card__cover resident-restaurant-card__cover--placeholder">
                  🍽️
                </div>
              )}
              <div>
                <h3 style={{ margin: '0 0 0.2rem' }}>{restaurant.name}</h3>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6b655c' }}>
                  {restaurant.cuisineType || 'Cocina variada'}
                  {restaurant.openingHours ? ` · ${restaurant.openingHours}` : ''}
                </p>
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem' }}>
                  {restaurant.shortDescription}
                </p>
                <div style={{ marginTop: '0.45rem', fontSize: '0.75rem', fontWeight: 600 }}>
                  {restaurant.minOrderAmount > 0 &&
                    `Pedido mín. ${formatMoney(restaurant.minOrderAmount)}`}
                  {restaurant.avgPrepMinutes
                    ? ` · ~${restaurant.avgPrepMinutes} min`
                    : ''}
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
