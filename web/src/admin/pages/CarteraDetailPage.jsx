import { useEffect, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { adminApi, formatCop } from '../../api/client';
import { CARTERA_VIEWS } from '../carteraViews';
import '../admin.css';

export default function CarteraDetailPage() {
  const { view } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const meta = CARTERA_VIEWS[view];
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const period = searchParams.get('period') || '';

  useEffect(() => {
    if (!meta) return;
    adminApi
      .cartera({ period: period || undefined, view })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [view, period, meta]);

  if (!meta) {
    return <Navigate to="/admin/cartera" replace />;
  }

  function updatePeriod(nextPeriod) {
    const params = new URLSearchParams(searchParams);
    if (nextPeriod) params.set('period', nextPeriod);
    else params.delete('period');
    setSearchParams(params);
  }

  const activePeriod = data?.period || period || '—';

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <p className="admin-breadcrumb">
          <Link to="/admin">Inicio</Link> / {meta.label}
        </p>
        <h1>{meta.label}</h1>
        <p>{meta.description}</p>
      </header>

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-card">
        <form className="admin-form" onSubmit={(e) => e.preventDefault()}>
          <label>
            Periodo
            <input
              value={period}
              onChange={(e) => updatePeriod(e.target.value)}
              placeholder="2026-06"
            />
          </label>
        </form>
      </div>

      {view === 'tasa-recaudo' && data?.breakdown && (
        <div className="admin-grid">
          <div className="admin-stat">
            <p className="admin-stat__label">Facturado</p>
            <p className="admin-stat__value admin-stat__value--money">
              {formatCop(data.breakdown.facturadoMes)}
            </p>
          </div>
          <div className="admin-stat">
            <p className="admin-stat__label">Recaudado</p>
            <p className="admin-stat__value admin-stat__value--money">
              {formatCop(data.breakdown.recaudoMes)}
            </p>
          </div>
          <div className="admin-stat">
            <p className="admin-stat__label">Pendiente</p>
            <p className="admin-stat__value admin-stat__value--money">
              {formatCop(data.breakdown.pendienteMes)}
            </p>
          </div>
          <div className="admin-stat">
            <p className="admin-stat__label">En mora</p>
            <p className="admin-stat__value admin-stat__value--money">
              {formatCop(data.breakdown.morosidadMes)}
            </p>
          </div>
          <div className="admin-stat">
            <p className="admin-stat__label">Tasa de recaudo</p>
            <p className="admin-stat__value">{data.breakdown.tasaRecaudo}%</p>
          </div>
        </div>
      )}

      {view !== 'tasa-recaudo' && data && (
        <div className="admin-grid">
          <div className="admin-stat">
            <p className="admin-stat__label">Periodo</p>
            <p className="admin-stat__value">{activePeriod}</p>
          </div>
          <div className="admin-stat">
            <p className="admin-stat__label">Movimientos</p>
            <p className="admin-stat__value">{data.summary?.total ?? 0}</p>
          </div>
          <div className="admin-stat">
            <p className="admin-stat__label">Total</p>
            <p className="admin-stat__value admin-stat__value--money">
              {formatCop(data.detailTotal ?? data.summary?.totalDue ?? 0)}
            </p>
          </div>
          {data.summary?.totalInterest > 0 && (
            <div className="admin-stat">
              <p className="admin-stat__label">Intereses</p>
              <p className="admin-stat__value admin-stat__value--money">
                {formatCop(data.summary.totalInterest)}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="admin-card admin-table-wrap">
        <h2>Detalle</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Unidad</th>
              <th>Periodo</th>
              <th>Capital</th>
              <th>Interés</th>
              <th>Total</th>
              <th>Vencimiento</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {(data?.payments ?? []).length === 0 ? (
              <tr>
                <td colSpan={7} className="admin-empty">
                  No hay movimientos para esta vista.
                </td>
              </tr>
            ) : (
              data.payments.map((p) => (
                <tr key={p._id}>
                  <td>{p.unitId?.number || '—'}</td>
                  <td>{p.period}</td>
                  <td>{formatCop(p.amount)}</td>
                  <td>{formatCop(p.interestAmount)}</td>
                  <td>{formatCop(p.totalDue ?? p.amount)}</td>
                  <td>{new Date(p.dueDate).toLocaleDateString()}</td>
                  <td>
                    <span className={`admin-badge admin-badge--${p.status}`}>{p.status}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-actions">
        <Link to="/admin" className="admin-btn admin-btn--ghost">
          Volver al inicio
        </Link>
        <Link to="/admin/cartera" className="admin-btn admin-btn--ghost">
          Ver cartera completa
        </Link>
      </div>
    </div>
  );
}
