import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { adminApi } from '../../api/client';
import '../admin.css';

export default function ResidentDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi
      .residents.get(id)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [id]);

  const resident = data?.resident;
  const payments = data?.payments ?? [];

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <Link to="/admin/residentes" className="admin-link">
          ← Volver a residentes
        </Link>
        <h1>
          {resident?.userId?.firstName} {resident?.userId?.lastName}
        </h1>
        <p>Detalle del residente y últimos pagos.</p>
      </header>

      {error && <div className="admin-error">{error}</div>}

      {resident && (
        <>
          <div className="admin-grid">
            <div className="admin-stat">
              <p className="admin-stat__label">Unidad</p>
              <p className="admin-stat__value" style={{ fontSize: '1.25rem' }}>
                {resident.unitId?.number}
              </p>
            </div>
            <div className="admin-stat">
              <p className="admin-stat__label">Estado</p>
              <p className="admin-stat__value" style={{ fontSize: '1.25rem' }}>
                {resident.unitId?.adminStatus}
              </p>
            </div>
            <div className="admin-stat">
              <p className="admin-stat__label">Email</p>
              <p className="admin-stat__value" style={{ fontSize: '1rem' }}>
                {resident.userId?.email}
              </p>
            </div>
          </div>

          <div className="admin-card admin-table-wrap">
            <h2>Últimos pagos</h2>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Periodo</th>
                  <th>Concepto</th>
                  <th>Monto</th>
                  <th>Estado</th>
                  <th>Fecha pago</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p._id}>
                    <td>{p.period}</td>
                    <td>{p.concept}</td>
                    <td>${p.amount?.toLocaleString('es-CO')}</td>
                    <td>
                      <span className={`admin-badge admin-badge--${p.status}`}>{p.status}</span>
                    </td>
                    <td>{p.paidAt ? new Date(p.paidAt).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
