import { useEffect, useState } from 'react';
import { formatCop, formatDate, residentApi } from '../api/client';
import { getPaymentConceptLabel } from '../admin/paymentConcepts';
import './ResidentLayout.css';

export default function ResidentAdministrationPage() {
  const [billing, setBilling] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Administración · Rentados';
    residentApi
      .billing()
      .then(setBilling)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="resident-page">
      <header className="resident-page__header">
        <h1 className="resident-page__title">Administración</h1>
        <p className="resident-page__subtitle">Estado de cuenta, pagos e información de tu unidad.</p>
      </header>

      <div className="resident-page__body">
        {error && <div className="resident-error">{error}</div>}

        {billing && (
          <>
            <div className="resident-summary-grid">
              <div>
                <p>Total a pagar</p>
                <strong>{formatCop(billing.summary.totalDue)}</strong>
              </div>
              <div>
                <p>Intereses</p>
                <strong>{formatCop(billing.summary.totalInterest)}</strong>
              </div>
              <div>
                <p>Admin. mensual</p>
                <strong>
                  {billing.monthlyAdministrationFee != null
                    ? formatCop(billing.monthlyAdministrationFee)
                    : '—'}
                </strong>
              </div>
              <div>
                <p>Estado</p>
                <strong>{billing.summary.isOverdue ? 'En mora' : 'Al día'}</strong>
              </div>
            </div>

            <div className="resident-card">
              <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Estado de cuenta</h2>
              {billing.payments.length === 0 ? (
                <p className="resident-empty">No hay movimientos recientes.</p>
              ) : (
                billing.payments.map((payment) => (
                  <div key={payment._id} className="resident-payment">
                    <div>
                      <strong>{payment.period}</strong>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.8125rem', color: '#6b655c' }}>
                        {getPaymentConceptLabel(payment)} · Vence {formatDate(payment.dueDate)}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <strong>{formatCop(payment.totalDue || payment.amount)}</strong>
                      <small>{payment.status}</small>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
