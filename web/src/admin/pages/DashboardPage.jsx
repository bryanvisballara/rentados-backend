import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, formatCop } from '../../api/client';
import '../admin.css';

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi
      .dashboard()
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  const stats = data?.stats ?? {};
  const finance = data?.finance ?? {};

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <h1>Panel administrativo</h1>
        <p>{data?.building?.name || 'Resumen del conjunto'}</p>
      </header>

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-card">
        <h2>Cartera — {finance.currentPeriod || 'mes actual'}</h2>
        <div className="admin-grid">
          <div className="admin-stat">
            <p className="admin-stat__label">Cartera actual</p>
            <p className="admin-stat__value admin-stat__value--money">{formatCop(finance.carteraActual)}</p>
          </div>
          <div className="admin-stat">
            <p className="admin-stat__label">Recaudo del mes</p>
            <p className="admin-stat__value admin-stat__value--money">{formatCop(finance.recaudoMes)}</p>
          </div>
          <div className="admin-stat">
            <p className="admin-stat__label">Morosidad total</p>
            <p className="admin-stat__value admin-stat__value--money">{formatCop(finance.morosidadTotal)}</p>
          </div>
          <div className="admin-stat">
            <p className="admin-stat__label">Pendiente del mes</p>
            <p className="admin-stat__value admin-stat__value--money">{formatCop(finance.pendienteMes)}</p>
          </div>
          <div className="admin-stat">
            <p className="admin-stat__label">Facturado del mes</p>
            <p className="admin-stat__value admin-stat__value--money">{formatCop(finance.facturadoMes)}</p>
          </div>
          <div className="admin-stat">
            <p className="admin-stat__label">Tasa de recaudo</p>
            <p className="admin-stat__value">{finance.tasaRecaudo ?? 0}%</p>
          </div>
        </div>
      </div>

      {(finance.highlights ?? []).length > 0 && (
        <div className="admin-card">
          <h2>Alertas financieras</h2>
          <ul className="admin-highlights">
            {finance.highlights.map((item) => (
              <li key={item.message} className={`admin-highlight admin-highlight--${item.type}`}>
                {item.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="admin-card">
        <h2>Resumen operativo</h2>
        <div className="admin-grid">
          <div className="admin-stat">
            <p className="admin-stat__label">Torres</p>
            <p className="admin-stat__value">{stats.towers ?? '—'}</p>
          </div>
          <div className="admin-stat">
            <p className="admin-stat__label">Unidades</p>
            <p className="admin-stat__value">{stats.units ?? '—'}</p>
          </div>
          <div className="admin-stat">
            <p className="admin-stat__label">Residentes</p>
            <p className="admin-stat__value">{stats.residents ?? '—'}</p>
          </div>
          <div className="admin-stat">
            <p className="admin-stat__label">Unidades morosas</p>
            <p className="admin-stat__value">{stats.overdue ?? '—'}</p>
          </div>
          <div className="admin-stat">
            <p className="admin-stat__label">Parqueaderos visitantes</p>
            <p className="admin-stat__value">{stats.visitorParking ?? '—'}</p>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <h2>Accesos rápidos</h2>
        <div className="admin-actions">
          <Link to="/admin/cartera" className="admin-btn admin-btn--ghost">
            Ver cartera
          </Link>
          <Link to="/admin/asignacion" className="admin-btn admin-btn--ghost">
            Asignar residentes
          </Link>
        </div>
      </div>
    </div>
  );
}
