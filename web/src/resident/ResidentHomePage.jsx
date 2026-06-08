import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { useAuth } from '../context/AuthContext';
import { formatCop, residentApi } from '../api/client';
import { getPaymentConceptLabel } from '../admin/paymentConcepts';
import ResidentBookingsSection from './ResidentBookingsSection';
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
  const [notifications, setNotifications] = useState([]);
  const [lockerData, setLockerData] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    const [b, s, n, locker] = await Promise.all([
      residentApi.billing(),
      residentApi.services(),
      residentApi.notifications().catch(() => ({ notifications: [], unreadCount: 0 })),
      residentApi.lockerPackages().catch(() => ({ enabled: false, packages: [] })),
    ]);
    setBilling(b);
    setServicesData(s);
    setNotifications(n.notifications || []);
    setLockerData(locker);
  }

  async function markRead(id) {
    await residentApi.markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((item) => (item._id === id ? { ...item, read: true } : item))
    );
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
        <button
          type="button"
          className={tab === 'reservas' ? 'is-active' : ''}
          onClick={() => setTab('reservas')}
        >
          Reservas
        </button>
        <button
          type="button"
          className={tab === 'avisos' ? 'is-active' : ''}
          onClick={() => setTab('avisos')}
        >
          Avisos
          {notifications.filter((n) => !n.read).length > 0 && (
            <span className="resident__tab-badge">
              {notifications.filter((n) => !n.read).length}
            </span>
          )}
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
                      {getPaymentConceptLabel(p)}
                      {' · '}
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
                    {s.bookable
                      ? s.bookingPricing?.mode === 'hourly' && s.bookingPricing.hourlyRate > 0
                        ? `${formatCop(s.bookingPricing.hourlyRate)}/hora · Reservable`
                        : s.bookingPricing?.mode === 'blocks'
                          ? 'Paquetes por horas · Reservable'
                          : 'Reservable en calendario'
                      : s.price > 0
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

      {tab === 'reservas' && servicesData && (
        <ResidentBookingsSection services={servicesData.services} />
      )}

      {tab === 'avisos' && (
        <section className="resident__section">
          {lockerData?.enabled && (
            <div className="resident__card">
              <h2>Paquetes en portería</h2>
              {lockerData.packages.length === 0 ? (
                <p className="resident__empty">No tienes paquetes pendientes por recoger.</p>
              ) : (
                <ul className="resident__packages">
                  {lockerData.packages.map((pkg) => (
                    <li key={pkg._id} className="resident__package">
                      <img src={pkg.photoUrl} alt="Paquete" className="resident__package-photo" />
                      <div>
                        <p className="resident__package-title">
                          {pkg.status === 'held' ? 'Paquete en retención' : 'Paquete listo para recoger'}
                        </p>
                        <p className="resident__package-meta">
                          Recibido {new Date(pkg.createdAt).toLocaleString()}
                        </p>
                        {pkg.comment && <p>{pkg.comment}</p>}
                        {pkg.status === 'held' && (
                          <p className="resident__package-hint">
                            Portería lo recibió; te avisaremos cuando puedas retirarlo.
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="resident__card">
            <h2>Notificaciones</h2>
            {notifications.length === 0 ? (
              <p className="resident__empty">No tienes avisos recientes.</p>
            ) : (
              <ul className="resident__notifications">
                {notifications.map((item) => (
                  <li
                    key={item._id}
                    className={`resident__notification ${item.read ? 'is-read' : ''}`}
                  >
                    {item.imageUrl && (
                      <img src={item.imageUrl} alt="" className="resident__notification-photo" />
                    )}
                    <div>
                      <p className="resident__notification-title">{item.title}</p>
                      <p>{item.body}</p>
                      <p className="resident__package-meta">
                        {new Date(item.createdAt).toLocaleString()}
                      </p>
                      {!item.read && (
                        <button
                          type="button"
                          className="resident__mark-read"
                          onClick={() => markRead(item._id)}
                        >
                          Marcar leída
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
