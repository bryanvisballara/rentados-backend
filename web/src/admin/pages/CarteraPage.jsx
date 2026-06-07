import { useEffect, useState } from 'react';
import { adminApi, formatCop } from '../../api/client';
import '../admin.css';

export default function CarteraPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('2026-06');

  useEffect(() => {
    adminApi
      .cartera(period)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [period]);

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
            <input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2026-06" />
          </label>
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
            {(data?.payments ?? []).map((p) => (
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
