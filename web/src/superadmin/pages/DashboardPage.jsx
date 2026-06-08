import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatCop, platformApi } from '../../api/client';
import '../../admin/admin.css';

function FinanceBlock({ title, data }) {
  return (
    <div className="admin-card">
      <h2>{title}</h2>
      <div className="admin-grid">
        <div className="admin-stat">
          <p className="admin-stat__label">Volumen recaudado</p>
          <p className="admin-stat__value admin-stat__value--money">{formatCop(data?.volume || 0)}</p>
        </div>
        <div className="admin-stat">
          <p className="admin-stat__label">Utilidad Rentados</p>
          <p className="admin-stat__value admin-stat__value--money">
            {formatCop(data?.platformRevenue || 0)}
          </p>
        </div>
        <div className="admin-stat">
          <p className="admin-stat__label">Transacciones</p>
          <p className="admin-stat__value">{data?.transactions ?? 0}</p>
        </div>
      </div>
    </div>
  );
}

export default function SuperAdminDashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    platformApi.dashboard().then(setData).catch((err) => setError(err.message));
  }, []);

  const counts = data?.counts ?? {};
  const finance = data?.finance ?? {};

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <h1>Dashboard Rentados</h1>
        <p>
          KPIs de recaudo de administración y utilidad por comisión de plataforma (split ePayco por
          conjunto).
        </p>
      </header>

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-grid" style={{ marginBottom: '1rem' }}>
        <div className="admin-stat">
          <p className="admin-stat__label">Administraciones</p>
          <p className="admin-stat__value">{counts.organizations ?? '—'}</p>
        </div>
        <Link to="/super-admin/conjuntos" className="admin-stat admin-stat--link">
          <p className="admin-stat__label">Conjuntos activos</p>
          <p className="admin-stat__value">{counts.buildings ?? '—'}</p>
        </Link>
        <Link to="/super-admin/solicitudes-prestadores" className="admin-stat admin-stat--link">
          <p className="admin-stat__label">Solicitudes prestadores</p>
          <p className="admin-stat__value">{counts.pendingProviders ?? 0}</p>
        </Link>
        <div className="admin-stat">
          <p className="admin-stat__label">Prestadores activos</p>
          <p className="admin-stat__value">{counts.approvedProviders ?? 0}</p>
        </div>
        <div className="admin-stat">
          <p className="admin-stat__label">Entrevistas programadas</p>
          <p className="admin-stat__value">{counts.upcomingInterviews ?? 0}</p>
        </div>
        <Link to="/super-admin/shop" className="admin-stat admin-stat--link">
          <p className="admin-stat__label">Productos shop</p>
          <p className="admin-stat__value">{counts.shopProducts ?? 0}</p>
        </Link>
        <Link to="/super-admin/shop-pedidos" className="admin-stat admin-stat--link">
          <p className="admin-stat__label">Pedidos shop pendientes</p>
          <p className="admin-stat__value">{counts.pendingShopOrders ?? 0}</p>
        </Link>
      </div>

      <FinanceBlock title="Hoy" data={finance.day} />
      <FinanceBlock title="Esta semana" data={finance.week} />
      <FinanceBlock title="Este mes" data={finance.month} />
      <FinanceBlock title="Este año" data={finance.year} />
      <FinanceBlock title="Histórico total" data={finance.totals} />
    </div>
  );
}
