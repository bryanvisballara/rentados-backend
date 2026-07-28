import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { formatCop, formatDate, formatDateTime, residentApi } from '../api/client';
import { buildWhatsappUrl } from '../utils/whatsapp';
import {
  FacilityGlyph,
  IconBriefcase,
  IconCar,
  IconChevronRight,
  IconHeadset,
  IconHeart,
  IconPackage,
} from './components/ResidentIcons';
import './ResidentLayout.css';

const DEFAULT_HERO =
  'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=80';

const PLACEHOLDER_PUB =
  'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80';

const PRICING_LABELS = {
  free: 'Gratis',
  per_use: 'Por uso',
  monthly: 'Mensual',
};

function serviceTag(service) {
  if (service.blocked) return 'Suspendido';
  if (service.bookable) return 'Reservable';
  if (service.price > 0) return PRICING_LABELS[service.pricingType] || 'Con costo';
  return 'Disponible';
}

function servicePriceLabel(service) {
  if (service.bookable) {
    if (service.bookingPricing?.mode === 'hourly' && service.bookingPricing.hourlyRate > 0) {
      return `${formatCop(service.bookingPricing.hourlyRate)}/hora`;
    }
    return 'Reserva en calendario';
  }
  if (service.price > 0) return formatCop(service.price);
  return 'Sin costo';
}

export default function ResidentHomePage() {
  const { onLogout } = useOutletContext();
  const navigate = useNavigate();
  const [home, setHome] = useState(null);
  const [servicesData, setServicesData] = useState(null);
  const [publications, setPublications] = useState([]);
  const [lockerData, setLockerData] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [modal, setModal] = useState(null);
  const [visitorForm, setVisitorForm] = useState({
    visitorName: '',
    licensePlate: '',
    expectedAt: '',
    notes: '',
  });
  const [savingVisitor, setSavingVisitor] = useState(false);

  useEffect(() => {
    document.title = home?.building?.name
      ? `${home.building.name} · Rentados`
      : 'Rentados · Residente';
  }, [home?.building?.name]);

  useEffect(() => {
    Promise.all([
      residentApi.home(),
      residentApi.services(),
      residentApi.publications().catch(() => ({ publications: [] })),
      residentApi.lockerPackages().catch(() => ({ enabled: false, packages: [] })),
    ])
      .then(([homeData, services, pubs, locker]) => {
        setHome(homeData);
        setServicesData(services);
        setPublications(pubs.publications || []);
        setLockerData(locker);
      })
      .catch((err) => setError(err.message));
  }, []);

  const featuredServices = useMemo(
    () => (servicesData?.services || []).slice(0, 4),
    [servicesData]
  );

  const heroImage = home?.building?.heroImageUrl || DEFAULT_HERO;
  const buildingName = home?.building?.name || 'Tu conjunto';
  const unitLabel = home?.unit
    ? `Apto ${home.unit.number}${home.unit.tower ? ` · Torre ${home.unit.tower}` : ''}`
    : 'Tu unidad';

  const statusText =
    home?.unit?.adminStatus === 'overdue'
      ? 'Tienes pagos pendientes'
      : lockerData?.packages?.length
        ? `${lockerData.packages.length} paquete(s) en portería`
        : 'Todo en orden';

  async function submitVisitor(e) {
    e.preventDefault();
    setSavingVisitor(true);
    setError('');
    try {
      await residentApi.createVisitorRequest(visitorForm);
      setSuccess('Visita registrada. Portería recibirá la información.');
      setModal(null);
      setVisitorForm({ visitorName: '', licensePlate: '', expectedAt: '', notes: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingVisitor(false);
    }
  }

  function openContact(type) {
    const contacts = home?.organization?.contacts || {};
    const phone =
      type === 'reception' ? contacts.receptionWhatsapp : contacts.adminWhatsapp;
    const message =
      type === 'reception'
        ? 'Hola, soy residente y quiero hablar con recepción/portería.'
        : 'Hola, soy residente y quiero hablar con administración.';

    const url = buildWhatsappUrl(phone, message);
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    setError(
      type === 'reception'
        ? 'La recepción aún no tiene WhatsApp configurado. Avísale a la administración.'
        : 'La administración aún no tiene WhatsApp configurado.'
    );
  }

  return (
    <div className="resident-page">
      <section className="resident-hero">
        <div
          className="resident-hero__bg"
          style={{ backgroundImage: `url('${heroImage}')` }}
        />
        <div className="resident-hero__overlay" />
        <div className="resident-hero__content">
          <div className="resident-hero__top">
            <h1 className="resident-hero__building">{buildingName}</h1>
            <button type="button" className="resident-hero__logout" onClick={onLogout}>
              Salir
            </button>
          </div>
          <p className="resident-hero__greeting">Hola, {home?.user?.firstName || 'residente'}</p>
          <p className="resident-hero__unit">{unitLabel}</p>
        </div>

        <div className="resident-hero__status">
          <div>
            <p className="resident-hero__status-label">Estado de tu unidad</p>
            <p className="resident-hero__status-value">{statusText}</p>
          </div>
          <span
            className={`resident-hero__status-badge${
              home?.unit?.adminStatus === 'overdue' ? ' resident-hero__status-badge--warn' : ''
            }`}
          >
            {home?.unit?.adminStatus === 'overdue' ? 'En mora' : 'Al día'}
          </span>
        </div>
      </section>

      <div className="resident-quick">
        <button type="button" className="resident-quick__item" onClick={() => setModal('locker')}>
          <span className="resident-quick__circle">
            <IconPackage width={22} height={22} />
          </span>
          <span className="resident-quick__label">Casillero</span>
        </button>
        <button type="button" className="resident-quick__item" onClick={() => setModal('visitor')}>
          <span className="resident-quick__circle">
            <IconCar width={22} height={22} />
          </span>
          <span className="resident-quick__label">Registrar visitantes</span>
        </button>
        <button type="button" className="resident-quick__item" onClick={() => openContact('reception')}>
          <span className="resident-quick__circle">
            <IconHeadset width={22} height={22} />
          </span>
          <span className="resident-quick__label">Hablar con recepción</span>
        </button>
        <button type="button" className="resident-quick__item" onClick={() => openContact('admin')}>
          <span className="resident-quick__circle">
            <IconBriefcase width={22} height={22} />
          </span>
          <span className="resident-quick__label">Hablar con administración</span>
        </button>
      </div>

      {error && <div className="resident-error">{error}</div>}
      {success && <div className="resident-success">{success}</div>}

      <section className="resident-section">
        <div className="resident-section__head">
          <h2>Servicios &amp; reservas</h2>
          <Link className="resident-section__link" to="/app/servicios-conjunto">
            Ver todos <IconChevronRight width={16} height={16} />
          </Link>
        </div>

        {servicesData?.suspensions?.length > 0 && (
          <div className="resident-error" style={{ margin: '0 0 0.85rem' }}>
            Tienes servicios suspendidos por morosidad hasta{' '}
            {formatDate(
              Math.max(...servicesData.suspensions.map((s) => new Date(s.endAt).getTime()))
            )}
            .
          </div>
        )}

        <div className="resident-services-grid">
          {featuredServices.length === 0 ? (
            <p className="resident-empty" style={{ gridColumn: '1 / -1' }}>
              No hay servicios del conjunto configurados.
            </p>
          ) : (
            featuredServices.map((service) => (
              <button
                key={service.id}
                type="button"
                className={`resident-service-card${service.blocked ? ' resident-service-card--blocked' : ''}`}
                onClick={() => navigate('/app/servicios-conjunto', { state: { serviceId: service.id } })}
              >
                <FacilityGlyph icon={service.icon} className="resident-service-card__icon" />
                <h3>{service.name}</h3>
                <p>{service.description || servicePriceLabel(service)}</p>
                <span className="resident-service-card__tag">{serviceTag(service)}</span>
              </button>
            ))
          )}
        </div>
      </section>

      <section className="resident-section">
        <div className="resident-section__head">
          <h2>Publicaciones</h2>
        </div>

        {publications.length === 0 ? (
          <p className="resident-empty">No hay publicaciones recientes del conjunto.</p>
        ) : (
          <div className="resident-pubs">
            {publications.map((pub) => (
              <button
                key={pub.id}
                type="button"
                className="resident-pub-card"
                onClick={() => setModal({ type: 'publication', pub })}
              >
                <img
                  src={pub.imageUrl || PLACEHOLDER_PUB}
                  alt=""
                  className="resident-pub-card__image"
                />
                <div className="resident-pub-card__overlay" />
                <span className="resident-pub-card__heart" aria-hidden="true">
                  <IconHeart width={16} height={16} />
                </span>
                <div className="resident-pub-card__body">
                  <h3>{pub.title}</h3>
                  <p className="resident-pub-card__meta">
                    {pub.publishedAt ? formatDate(pub.publishedAt) : 'Reciente'}
                  </p>
                  <div className="resident-pub-card__tags">
                    {pub.isPinned && <span className="resident-pub-card__tag">Destacada</span>}
                    <span className="resident-pub-card__tag">{buildingName}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {modal === 'locker' && (
        <div className="resident-modal-overlay" onClick={() => setModal(null)}>
          <div className="resident-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Casillero / paquetes</h2>
            {!lockerData?.enabled ? (
              <p className="resident-empty">El casillero no está activo en tu conjunto.</p>
            ) : lockerData.packages.length === 0 ? (
              <p className="resident-empty">No tienes paquetes pendientes por recoger.</p>
            ) : (
              <ul className="resident-list">
                {lockerData.packages.map((pkg) => (
                  <li key={pkg._id} className="resident-list-item">
                    <img src={pkg.photoUrl} alt="Paquete" />
                    <div>
                      <h3>{pkg.status === 'held' ? 'En retención' : 'Listo para recoger'}</h3>
                      <p>Recibido {formatDateTime(pkg.createdAt)}</p>
                      {pkg.comment && <p>{pkg.comment}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="resident-actions">
              <button type="button" className="resident-btn resident-btn--ghost" onClick={() => setModal(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'visitor' && (
        <div className="resident-modal-overlay" onClick={() => setModal(null)}>
          <div className="resident-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Registrar visitante</h2>
            <form className="resident-form" onSubmit={submitVisitor}>
              <label>
                Nombre del visitante
                <input
                  value={visitorForm.visitorName}
                  onChange={(e) => setVisitorForm({ ...visitorForm, visitorName: e.target.value })}
                  placeholder="Nombre completo"
                />
              </label>
              <label>
                Placa del vehículo
                <input
                  value={visitorForm.licensePlate}
                  onChange={(e) => setVisitorForm({ ...visitorForm, licensePlate: e.target.value })}
                  placeholder="ABC123"
                  required
                />
              </label>
              <label>
                Fecha esperada (opcional)
                <input
                  type="datetime-local"
                  value={visitorForm.expectedAt}
                  onChange={(e) => setVisitorForm({ ...visitorForm, expectedAt: e.target.value })}
                />
              </label>
              <label>
                Notas para portería
                <textarea
                  value={visitorForm.notes}
                  onChange={(e) => setVisitorForm({ ...visitorForm, notes: e.target.value })}
                  rows={3}
                />
              </label>
              <div className="resident-actions">
                <button type="submit" className="resident-btn" disabled={savingVisitor}>
                  {savingVisitor ? 'Enviando…' : 'Registrar visita'}
                </button>
                <button
                  type="button"
                  className="resident-btn resident-btn--ghost"
                  onClick={() => setModal(null)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal?.type === 'publication' && (
        <div className="resident-modal-overlay" onClick={() => setModal(null)}>
          <div className="resident-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{modal.pub.title}</h2>
            {modal.pub.publishedAt && (
              <p className="resident-page__subtitle">{formatDateTime(modal.pub.publishedAt)}</p>
            )}
            <p>{modal.pub.body || 'Sin descripción.'}</p>
            <div className="resident-actions">
              <button type="button" className="resident-btn" onClick={() => setModal(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      )}
    </div>
  );
}
