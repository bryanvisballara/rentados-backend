import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { useAuth } from '../context/AuthContext';
import { formatCop, residentApi } from '../api/client';
import './ResidentHomePage.css';

const PRICING_LABELS = {
  free: 'Gratis',
  per_use: 'Por uso',
  monthly: 'Mensual',
};

export default function ResidentHomePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('pagos');
  const [billing, setBilling] = useState(null);
  const [servicesData, setServicesData] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    const [b, s] = await Promise.all([residentApi.billing(), residentApi.services()]);
    setBilling(b);
    setServicesData(s);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="resident">
      <header className="resident__header">
        <Logo size="sm" />
        <div>
          <p className="resident__greeting">Hola, {user?.firstName}</p>
          <p className="resident__unit">
            Unidad {billing?.unit?.number || servicesData?.unit?.number || '—'}
            {billing?.summary?.isOverdue && (
              <span className="resident__badge resident__badge--overdue">En mora</span>
            )}
          </p>
        </div>
        <button type="button" className="resident__logout" onClick={handleLogout}>
          Salir
        </button>
      </header>

      <nav className="resident__tabs">
        <button
          type="button"
          className={tab === 'pagos' ? 'is-active' : ''}
          onClick={() => setTab('pagos')}
        >
          Pagos
        </button>
        <button
          type="button"
          className={tab === 'servicios' ? 'is-active' : ''}
          onClick={() => setTab('servicios')}
        >
          Servicios
        </button>
      </nav>

      {error && <div className="resident__error">{error}</div>}

      {tab === 'pagos' && billing && (
        <section className="resident__section">
          <div className="resident__summary">
            <div>
              <p>Total a pagar</p>
              <strong>{formatCop(billing.summary.totalDue)}</strong>
            </div>
            <div>
              <p>Intereses por mora</p>
              <strong>{formatCop(billing.summary.totalInterest)}</strong>
            </div>
            <div>
              <p>Administración mensual</p>
              <strong>
                {billing.monthlyAdministrationFee != null
                  ? formatCop(billing.monthlyAdministrationFee)
                  : '—'}
              </strong>
            </div>
            <div>
              <p>Tasa mensual</p>
              <strong>{billing.billingSettings.monthlyInterestRatePercent}%</strong>
            </div>
          </div>

          <div className="resident__card">
            <h2>Estado de cuenta</h2>
            <ul className="resident__payments">
              {billing.payments.map((p) => (
                <li key={p._id} className={`resident__payment resident__payment--${p.status}`}>
                  <div>
                    <p className="resident__payment-period">{p.period}</p>
                    <p className="resident__payment-meta">
                      Vence {new Date(p.dueDate).toLocaleDateString()}
                      {p.interestAmount > 0 && ` · Interés ${formatCop(p.interestAmount)}`}
                    </p>
                  </div>
                  <div className="resident__payment-amount">
                    <span>{formatCop(p.totalDue || p.amount)}</span>
                    <small>{p.status}</small>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {tab === 'servicios' && servicesData && (
        <section className="resident__section">
          {servicesData.suspensions?.length > 0 && (
            <div className="resident__alert">
              Tienes servicios suspendidos por morosidad hasta{' '}
              {new Date(
                Math.max(...servicesData.suspensions.map((s) => new Date(s.endAt).getTime()))
              ).toLocaleDateString()}
              .
            </div>
          )}

          <div className="resident__services">
            {servicesData.services.map((s) => (
              <article
                key={s.id}
                className={`resident__service ${s.blocked ? 'resident__service--blocked' : ''}`}
              >
                <div>
                  <h3>{s.name}</h3>
                  <p>{s.description}</p>
                  <p className="resident__service-price">
                    {s.price > 0
                      ? `${formatCop(s.price)} · ${PRICING_LABELS[s.pricingType] || s.pricingType}`
                      : 'Sin costo'}
                  </p>
                </div>
                <span className={`resident__badge resident__badge--${s.available ? 'ok' : 'blocked'}`}>
                  {s.blocked ? 'Suspendido' : s.available ? 'Disponible' : s.blockReason || 'No disponible'}
                </span>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
