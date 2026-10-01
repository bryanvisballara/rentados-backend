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
  IconPackage,
} from './components/ResidentIcons';
import { ResidentOverlay } from './ResidentLayout';
import {
  getResidentHomeCache,
  setResidentHomeCache,
} from './residentHomeCache';
import './ResidentLayout.css';

const DEFAULT_HERO =
  'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=80';

const PLACEHOLDER_PUB =
  'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80';

function syncNativeAppBadge(count) {
  const native = window.RentadosNative;
  if (!native || typeof native.setAppBadge !== 'function') return;
  try {
    native.setAppBadge(String(Math.max(0, Number(count) || 0)));
  } catch {
    /* El navegador no tiene ícono de app. */
  }
}

function badgeFromInbox(inbox, lockerCount) {
  const locker = Math.max(Number(inbox?.lockerPackages) || 0, Number(lockerCount) || 0);
  const alerts = Number.isFinite(Number(inbox?.alerts))
    ? Number(inbox.alerts)
    : (inbox?.notifications || []).filter((notice) => !notice.locked && notice.type !== 'locker_package')
        .length;
  return locker + alerts;
}

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
  const { onLogout, sectionEnabled } = useOutletContext();
  const showSection = (key) => (sectionEnabled ? sectionEnabled(key) : true);
  const navigate = useNavigate();
  const initialCache = getResidentHomeCache();
  const [home, setHome] = useState(initialCache?.home ?? null);
  const [servicesData, setServicesData] = useState(initialCache?.servicesData ?? null);
  const [publications, setPublications] = useState(initialCache?.publications ?? []);
  const [lockerData, setLockerData] = useState(initialCache?.lockerData ?? null);
  const [contentReady, setContentReady] = useState(Boolean(initialCache?.home));
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [modal, setModal] = useState(null);
  const [lockerPhotoPreview, setLockerPhotoPreview] = useState('');
  const [publicationZoom, setPublicationZoom] = useState(false);
  const [visitorForm, setVisitorForm] = useState({
    visitorName: '',
    licensePlate: '',
    expectedAt: '',
    notes: '',
  });
  const [savingVisitor, setSavingVisitor] = useState(false);
  const [notices, setNotices] = useState([]);
  const [selectedNoticeIds, setSelectedNoticeIds] = useState([]);
  const [clearingNotices, setClearingNotices] = useState(false);

  useEffect(() => {
    document.title = home?.building?.name
      ? `${home.building.name} · Rentados`
      : 'Rentados · Residente';
  }, [home?.building?.name]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      residentApi.home(),
      residentApi.services(),
      residentApi.publications().catch(() => ({ publications: [] })),
      residentApi.lockerPackages().catch(() => ({ enabled: false, packages: [] })),
      residentApi.notifications().catch(() => ({ notifications: [], badge: 0 })),
    ])
      .then(([homeData, services, pubs, locker, inbox]) => {
        if (cancelled) return;
        const nextPublications = pubs.publications || [];
        setHome(homeData);
        setServicesData(services);
        setPublications(nextPublications);
        setLockerData(locker);
        setNotices(inbox.notifications || []);
        syncNativeAppBadge(
          badgeFromInbox(inbox, locker?.enabled ? locker.packages?.length || 0 : 0)
        );
        setResidentHomeCache({
          home: homeData,
          servicesData: services,
          publications: nextPublications,
          lockerData: locker,
        });
        setContentReady(true);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setContentReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!lockerPhotoPreview) return undefined;
    function onKeyDown(e) {
      if (e.key === 'Escape') setLockerPhotoPreview('');
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lockerPhotoPreview]);

  const featuredServices = useMemo(
    () => (servicesData?.services || []).slice(0, 4),
    [servicesData]
  );

  const heroImage = home?.building?.heroImageUrl || DEFAULT_HERO;
  const buildingName = home?.building?.name || 'Tu conjunto';
  const unitLabel = home?.unit
    ? `Apto ${home.unit.number}${home.unit.tower ? ` · Torre ${home.unit.tower}` : ''}`
    : 'Tu unidad';

  const lockerPackageCount =
    lockerData?.enabled && lockerData?.packages?.length ? lockerData.packages.length : 0;
  const selectableNoticeIds = notices.filter((notice) => !notice.locked).map((notice) => String(notice.id));
  const allNoticesSelected =
    selectableNoticeIds.length > 0 &&
    selectableNoticeIds.every((id) => selectedNoticeIds.includes(id));

  function toggleSelectAllNotices() {
    setSelectedNoticeIds(allNoticesSelected ? [] : selectableNoticeIds);
  }

  function toggleNotice(id) {
    const key = String(id);
    setSelectedNoticeIds((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );
  }

  async function deleteSelectedNotices() {
    const ids = selectedNoticeIds.filter((id) => selectableNoticeIds.includes(id));
    if (!ids.length || clearingNotices) return;
    setClearingNotices(true);
    setError('');
    try {
      const inbox = await residentApi.clearNotifications(ids);
      setNotices(inbox.notifications || []);
      setSelectedNoticeIds([]);
      syncNativeAppBadge(badgeFromInbox(inbox, lockerPackageCount));
    } catch (err) {
      setError(err.message);
    } finally {
      setClearingNotices(false);
    }
  }

  const statusText =
    home?.unit?.adminStatus === 'overdue'
      ? 'Tienes pagos pendientes'
      : lockerPackageCount
        ? `${lockerPackageCount} paquete(s) en portería`
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
            <div className="resident-hero__actions">
              <button
                type="button"
                className="resident-hero__bell"
                onClick={() => setModal('notices')}
                aria-label={
                  notices.length
                    ? `Avisos, ${notices.length} pendiente(s)`
                    : 'Avisos'
                }
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                  <path d="M10 18a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                {notices.length > 0 && (
                  <span className="resident-hero__bell-badge">
                    {notices.length > 9 ? '9+' : notices.length}
                  </span>
                )}
              </button>
              <button type="button" className="resident-hero__logout" onClick={onLogout}>
                Salir
              </button>
            </div>
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

      <div
        className="resident-quick"
        style={{
          gridTemplateColumns: `repeat(${
            [showSection('casillero'), showSection('visitantes'), true, true].filter(Boolean).length
          }, minmax(0, 1fr))`,
        }}
      >
        {showSection('casillero') && (
        <button type="button" className="resident-quick__item" onClick={() => setModal('locker')}>
          <span className="resident-quick__circle">
            <IconPackage width={22} height={22} />
            {lockerPackageCount > 0 && (
              <span className="resident-quick__badge" aria-label={`${lockerPackageCount} paquete(s) pendientes`}>
                {lockerPackageCount > 9 ? '9+' : lockerPackageCount}
              </span>
            )}
          </span>
          <span className="resident-quick__label">Casillero</span>
        </button>
        )}
        {showSection('visitantes') && (
        <button type="button" className="resident-quick__item" onClick={() => setModal('visitor')}>
          <span className="resident-quick__circle">
            <IconCar width={22} height={22} />
          </span>
          <span className="resident-quick__label">Registrar visitantes</span>
        </button>
        )}
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

      {showSection('reservas') && (
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
          {!contentReady && featuredServices.length === 0 ? (
            <div className="resident-home-skeleton resident-home-skeleton--grid" aria-hidden="true" />
          ) : featuredServices.length === 0 ? (
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
      )}

      {showSection('publicaciones') && (
      <section className="resident-section">
        <div className="resident-section__head">
          <h2>Publicaciones</h2>
        </div>

        {!contentReady && publications.length === 0 ? (
          <div className="resident-home-skeleton resident-home-skeleton--pubs" aria-hidden="true" />
        ) : publications.length === 0 ? (
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
      )}

      {modal === 'notices' && (
        <ResidentOverlay>
          <div className="resident-modal-overlay" onClick={() => setModal(null)}>
            <div className="resident-modal resident-notices" onClick={(e) => e.stopPropagation()}>
              <header className="resident-notices__head">
                <h2>Avisos</h2>
                <div className="resident-notices__actions">
                  <button
                    type="button"
                    className={`resident-notices__clear${allNoticesSelected ? ' resident-notices__clear--on' : ''}`}
                    onClick={toggleSelectAllNotices}
                    disabled={!selectableNoticeIds.length}
                    aria-pressed={allNoticesSelected}
                    aria-label="Seleccionar todos los avisos"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M8 12.5 10.5 15 16 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="resident-notices__delete"
                    onClick={deleteSelectedNotices}
                    disabled={!selectedNoticeIds.length || clearingNotices}
                  >
                    {clearingNotices ? 'Borrando…' : 'Borrar'}
                  </button>
                </div>
              </header>
              <p className="resident-notices__hint">
                El check selecciona los avisos. Borrar los quita del ícono. El número del casillero sigue hasta que portería entregue el paquete.
              </p>
              {notices.length === 0 ? (
                <p className="resident-empty">No tienes avisos nuevos.</p>
              ) : (
                <ul className="resident-notices__list">
                  {notices.map((notice) => {
                    const selected = selectedNoticeIds.includes(String(notice.id));
                    return (
                      <li key={notice.id} className={notice.locked ? 'resident-notices__item--locked' : ''}>
                        <label className="resident-notices__row">
                          <input
                            type="checkbox"
                            checked={notice.locked ? false : selected}
                            disabled={notice.locked}
                            onChange={() => toggleNotice(notice.id)}
                          />
                          <span>
                            <p>{notice.title}</p>
                            {notice.body && <span>{notice.body}</span>}
                            <small>
                              {notice.createdAt ? formatDateTime(notice.createdAt) : ''}
                              {notice.locked ? ' · Casillero' : ''}
                            </small>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </ResidentOverlay>
      )}

      {modal === 'locker' && showSection('casillero') && (
        <ResidentOverlay>
        <div
          className="resident-modal-overlay"
          onClick={() => {
            setLockerPhotoPreview('');
            setModal(null);
          }}
        >
          <div className="resident-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Casillero / paquetes</h2>
            {!lockerData?.enabled ? (
              <p className="resident-empty">El casillero no está activo en tu conjunto.</p>
            ) : lockerData.packages.length === 0 ? (
              <p className="resident-empty">No tienes paquetes pendientes por recoger.</p>
            ) : (
              <ul className="resident-locker-list">
                {lockerData.packages.map((pkg) => (
                  <li key={pkg._id || pkg.id} className="resident-locker-item">
                    {pkg.photoUrl ? (
                      <button
                        type="button"
                        className="resident-locker-item__photo-btn"
                        onClick={() => setLockerPhotoPreview(pkg.photoUrl)}
                        aria-label="Ver foto del paquete ampliada"
                      >
                        <img
                          src={pkg.photoUrl}
                          alt=""
                          className="resident-locker-item__photo"
                          loading="lazy"
                        />
                      </button>
                    ) : (
                      <div className="resident-locker-item__photo resident-locker-item__photo--placeholder" aria-hidden>
                        <IconPackage width={28} height={28} />
                      </div>
                    )}
                    <div className="resident-locker-item__body">
                      <h3 className="resident-locker-item__title">
                        {pkg.status === 'held' ? 'En retención' : 'Listo para recoger'}
                      </h3>
                      <p className="resident-locker-item__meta">
                        Recibido {formatDateTime(pkg.createdAt)}
                      </p>
                      {pkg.comment ? (
                        <p className="resident-locker-item__comment">{pkg.comment}</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="resident-actions">
              <button
                type="button"
                className="resident-btn resident-btn--ghost"
                onClick={() => {
                  setLockerPhotoPreview('');
                  setModal(null);
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
        </ResidentOverlay>
      )}

      {lockerPhotoPreview && (
        <ResidentOverlay>
        <div
          className="resident-photo-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Foto del paquete"
          onClick={() => setLockerPhotoPreview('')}
        >
          <button
            type="button"
            className="resident-photo-lightbox__close"
            onClick={() => setLockerPhotoPreview('')}
          >
            Cerrar
          </button>
          <img
            src={lockerPhotoPreview}
            alt="Foto del paquete"
            className="resident-photo-lightbox__image"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        </ResidentOverlay>
      )}

      {modal === 'visitor' && showSection('visitantes') && (
        <ResidentOverlay>
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
        </ResidentOverlay>
      )}

      {modal?.type === 'publication' && showSection('publicaciones') && (
        <ResidentOverlay>
          <div
            className="resident-modal-overlay"
            onClick={() => {
              setPublicationZoom(false);
              setModal(null);
            }}
          >
            <article className="resident-pub-detail" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="resident-pub-detail__zoom"
                onClick={() => setPublicationZoom(true)}
                aria-label="Ver imagen completa"
              >
                <img
                  src={modal.pub.imageUrl || PLACEHOLDER_PUB}
                  alt=""
                  className="resident-pub-detail__image"
                />
              </button>
              <div className="resident-pub-detail__body">
                <h2>{modal.pub.title}</h2>
                {modal.pub.publishedAt && (
                  <p className="resident-pub-detail__date">{formatDateTime(modal.pub.publishedAt)}</p>
                )}
                <p className="resident-pub-detail__text">{modal.pub.body || 'Sin descripción.'}</p>
                <button
                  type="button"
                  className="resident-btn"
                  onClick={() => {
                    setPublicationZoom(false);
                    setModal(null);
                  }}
                >
                  Cerrar
                </button>
              </div>
            </article>
            {publicationZoom && (
              <div
                className="resident-photo-lightbox"
                role="dialog"
                aria-modal="true"
                aria-label="Imagen de la publicación"
                onClick={() => setPublicationZoom(false)}
              >
                <button
                  type="button"
                  className="resident-photo-lightbox__close"
                  onClick={() => setPublicationZoom(false)}
                >
                  Cerrar
                </button>
                <img
                  src={modal.pub.imageUrl || PLACEHOLDER_PUB}
                  alt={modal.pub.title || 'Publicación'}
                  className="resident-photo-lightbox__image resident-photo-lightbox__image--full"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
          </div>
        </ResidentOverlay>
      )}
    </div>
  );
}
