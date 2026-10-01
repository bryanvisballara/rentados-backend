import { useCallback, useEffect, useState } from 'react';
import { residentApi } from '../api/client';
import { buildWhatsappUrl } from '../utils/whatsapp';
import { ResidentOverlay } from './ResidentLayout';
import { useResidentRefresh } from './ResidentRefresh';
import './ResidentLayout.css';

const PLACEHOLDER =
  'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80';

export default function ResidentProvidersPage() {
  const [services, setServices] = useState([]);
  const [contacts, setContacts] = useState({});
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [lightboxUrl, setLightboxUrl] = useState('');

  const loadProviders = useCallback(async () => {
    const [providersData, home] = await Promise.all([
      residentApi.providers(),
      residentApi.home().catch(() => ({})),
    ]);
    const list = providersData.providers || [];
    setServices(list);
    setContacts(home?.organization?.contacts || {});
    setSelected((current) => {
      if (!current) return current;
      const id = current.id || current._id;
      return list.find((item) => (item.id || item._id) === id) || current;
    });
    setError('');
  }, []);

  useEffect(() => {
    document.title = 'Servicios a domicilio · Rentados';
    loadProviders().catch((err) => setError(err.message));
  }, [loadProviders]);

  useResidentRefresh(loadProviders);

  function requestService(service, member) {
    const phone = contacts.adminWhatsapp || contacts.receptionWhatsapp;
    const who = member?.name ? ` con ${member.name}` : '';
    const message = `Hola, soy residente y quiero solicitar el servicio de ${service.name}${who} (Rentados).`;
    const url = buildWhatsappUrl(phone, message);
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    setError('No hay WhatsApp de administración configurado. Avísale al conjunto.');
  }

  if (selected) {
    const members = selected.members || [];
    return (
      <div className="resident-page">
        <header className="resident-page__header">
          <button
            type="button"
            className="resident-link-btn"
            onClick={() => setSelected(null)}
            style={{ marginBottom: '0.5rem' }}
          >
            ← Todos los servicios
          </button>
          <h1 className="resident-page__title">{selected.name}</h1>
          <p className="resident-page__subtitle">{selected.description}</p>
        </header>

        <div className="resident-page__body">
          {error && <div className="resident-error">{error}</div>}

          {members.length === 0 ? (
            <p className="resident-empty">
              Aún no hay perfiles publicados para este servicio. Puedes solicitarlo y te contactamos.
            </p>
          ) : (
            <div className="resident-home-service-members">
              {members.map((member) => (
                <article key={member.id} className="resident-home-service-member">
                  <div className="resident-home-service-member__head">
                    <h3>{member.name}</h3>
                    <span className="resident-home-service-member__type">
                      {member.memberType === 'company' ? 'Empresa' : 'Persona'}
                    </span>
                  </div>
                  {member.tagline && <p className="resident-home-service-member__tagline">{member.tagline}</p>}

                  {(member.media || []).length > 0 && (
                    <div className="resident-home-service-member__media">
                      {(member.media || []).map((item) => {
                        const mediaId = item._id || item.id || item.url;
                        if (item.type === 'video') {
                          return (
                            <video
                              key={mediaId}
                              src={item.url}
                              controls
                              poster={item.thumbnailUrl}
                              className="resident-home-service-member__media-item"
                            />
                          );
                        }
                        return (
                          <button
                            key={mediaId}
                            type="button"
                            className="resident-home-service-member__media-btn"
                            onClick={() => setLightboxUrl(item.url)}
                          >
                            <img src={item.url} alt="" loading="lazy" />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {member.resume && (
                    <div className="resident-home-service-member__resume">{member.resume}</div>
                  )}

                  <button
                    type="button"
                    className="resident-btn"
                    style={{ marginTop: '0.75rem' }}
                    onClick={() => requestService(selected, member)}
                  >
                    Solicitar por WhatsApp
                  </button>
                </article>
              ))}
            </div>
          )}

          {members.length === 0 && (
            <button
              type="button"
              className="resident-btn"
              style={{ marginTop: '1rem' }}
              onClick={() => requestService(selected)}
            >
              Solicitar por WhatsApp
            </button>
          )}
        </div>

        {lightboxUrl && (
          <ResidentOverlay>
          <div
            className="resident-photo-lightbox"
            role="dialog"
            aria-modal="true"
            onClick={() => setLightboxUrl('')}
            onKeyDown={(e) => e.key === 'Escape' && setLightboxUrl('')}
          >
            <button
              type="button"
              className="resident-photo-lightbox__close"
              onClick={() => setLightboxUrl('')}
            >
              Cerrar
            </button>
            <img src={lightboxUrl} alt="" className="resident-photo-lightbox__image" />
          </div>
          </ResidentOverlay>
        )}
      </div>
    );
  }

  return (
    <div className="resident-page">
      <header className="resident-page__header">
        <h1 className="resident-page__title">Servicios a domicilio</h1>
        <p className="resident-page__subtitle">
          Servicios operados por Rentados para tu conjunto. Elige uno para ver perfiles, fotos y hoja de
          vida.
        </p>
      </header>

      <div className="resident-page__body">
        {error && <div className="resident-error">{error}</div>}

        {services.length === 0 ? (
          <p className="resident-empty">Los servicios se están configurando. Vuelve pronto.</p>
        ) : (
          <div className="resident-home-services-grid">
            {services.map((service) => (
              <button
                key={service.id}
                type="button"
                className="resident-home-service-card resident-home-service-card--clickable"
                onClick={() => setSelected(service)}
              >
                <img
                  src={service.imageUrl || PLACEHOLDER}
                  alt=""
                  className="resident-home-service-card__image"
                  loading="lazy"
                />
                <div className="resident-home-service-card__body">
                  <h3>{service.name}</h3>
                  <p>{service.description}</p>
                  <span className="resident-home-service-card__cta">
                    {(service.members || []).length > 0
                      ? `${service.members.length} perfil(es) · Ver detalle`
                      : 'Ver detalle'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
