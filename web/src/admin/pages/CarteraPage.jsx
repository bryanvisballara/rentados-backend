import { useEffect, useState } from 'react';
import { adminApi, formatCop, formatDate } from '../../api/client';
import { formatUnitLabel } from '../../utils/units';
import '../admin.css';

function currentPeriodValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function CarteraPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState(currentPeriodValue);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    adminApi
      .cartera({
        period: period || undefined,
        from: from || undefined,
        to: to || undefined,
      })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [period, from, to]);

  const summary = data?.summary;

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <h1>Cartera</h1>
        <p>
          Pagos, pendientes, morosos e intereses calculados según la configuración de morosidad (
          {data?.billingSettings?.monthlyInterestRatePercent ?? '—'}% mensual).
        </p>
      </header>

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-card">
        <form className="admin-form" onSubmit={(e) => e.preventDefault()}>
          <label>
            Periodo
            <input
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="2026-06"
            />
          </label>
          <label>
            Vencimiento desde
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            Vencimiento hasta
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          {(period || from || to) && (
            <div className="admin-actions" style={{ alignSelf: 'end' }}>
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                onClick={() => {
                  setPeriod('');
                  setFrom('');
                  setTo('');
                }}
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </form>
      </div>

      <div className="admin-grid">
        <div className="admin-stat">
          <p className="admin-stat__label">Pagados</p>
          <p className="admin-stat__value">{summary?.paid ?? '—'}</p>
        </div>
        <div className="admin-stat">
          <p className="admin-stat__label">Pendientes</p>
          <p className="admin-stat__value">{summary?.pending ?? '—'}</p>
        </div>
        <div className="admin-stat">
          <p className="admin-stat__label">Morosos</p>
          <p className="admin-stat__value">{summary?.overdue ?? '—'}</p>
        </div>
        <div className="admin-stat">
          <p className="admin-stat__label">Intereses</p>
          <p className="admin-stat__value">{summary ? formatCop(summary.totalInterest) : '—'}</p>
        </div>
        <div className="admin-stat">
          <p className="admin-stat__label">Total con interés</p>
          <p className="admin-stat__value">{summary ? formatCop(summary.totalDue) : '—'}</p>
        </div>
      </div>

      <div className="admin-card admin-table-wrap">
        <h2>Movimientos</h2>
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
                  No hay movimientos con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              (data?.payments ?? []).map((p) => (
                <tr key={p._id}>
                  <td>{p.unitId ? formatUnitLabel(p.unitId, { prefix: '' }) : '—'}</td>
                  <td>{p.period}</td>
                  <td>{formatCop(p.amount)}</td>
                  <td>{formatCop(p.interestAmount)}</td>
                  <td>{formatCop(p.totalDue ?? p.amount)}</td>
                  <td>{formatDate(p.dueDate)}</td>
                  <td>
                    <span className={`admin-badge admin-badge--${p.status}`}>{p.status}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
