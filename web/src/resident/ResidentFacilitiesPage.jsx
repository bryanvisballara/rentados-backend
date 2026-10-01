import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { formatCop, residentApi } from '../api/client';
import ResidentBookingsSection from './ResidentBookingsSection';
import { FacilityGlyph } from './components/ResidentIcons';
import './ResidentLayout.css';

const PRICING_LABELS = {
  free: 'Gratis',
  per_use: 'Por uso',
  monthly: 'Mensual',
};

export default function ResidentFacilitiesPage() {
  const location = useLocation();
  const [servicesData, setServicesData] = useState(null);
  const [selectedId, setSelectedId] = useState(location.state?.serviceId || '');
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Servicios del conjunto · Rentados';
    residentApi
      .services()
      .then((data) => setServicesData(data))
      .catch((err) => setError(err.message));
  }, []);

  const services = servicesData?.services || [];
  const selected = services.find((s) => String(s.id) === String(selectedId));
  const visibleServices = selectedId
    ? services.filter((s) => String(s.id) === String(selectedId))
    : services;

  return (
    <div className="resident-page">
      <header className="resident-page__header">
        <h1 className="resident-page__title">Servicios del conjunto</h1>
        <p className="resident-page__subtitle">Reserva gimnasio, salón social, sauna y más.</p>
      </header>

      <div className="resident-page__body">
        {error && <div className="resident-error">{error}</div>}

        {servicesData && (
          <>
            {selectedId && (
              <div className="resident-facilities-back" style={{ marginBottom: '0.75rem' }}>
                <button
                  type="button"
                  className="resident-link-btn"
                  onClick={() => setSelectedId('')}
                >
                  ← Ver todos los espacios
                </button>
              </div>
            )}

            <div
              className={`resident-services-grid${
                selectedId ? ' resident-services-grid--single' : ''
              }`}
              style={{ marginBottom: '1rem' }}
            >
              {visibleServices.map((service) => (
                <button
                  key={service.id}
                  type="button"
                  className={`resident-service-card${
                    String(service.id) === String(selectedId) ? ' resident-service-card--active' : ''
                  }${service.blocked ? ' resident-service-card--blocked' : ''}`}
                  onClick={() => setSelectedId(String(service.id))}
                >
                  <FacilityGlyph icon={service.icon} className="resident-service-card__icon" />
                  <h3>{service.name}</h3>
                  <p>{service.description}</p>
                  <span className="resident-service-card__tag">
                    {service.bookable
                      ? 'Reservable'
                      : service.price > 0
                        ? `${formatCop(service.price)} · ${PRICING_LABELS[service.pricingType]}`
                        : 'Disponible'}
                  </span>
                </button>
              ))}
            </div>

            {!selectedId ? (
              <div className="resident-card">
                <p className="resident-empty">
                  Elige un espacio arriba para ver el calendario y reservar.
                </p>
              </div>
            ) : selected?.bookable && selected.available ? (
              <div className="resident-card">
                <ResidentBookingsSection
                  services={services.filter((s) => s.bookable && s.available)}
                  selectedFacilityId={selectedId}
                />
              </div>
            ) : (
              <div className="resident-card">
                <p className="resident-empty">
                  {selected?.blocked
                    ? 'Este servicio está suspendido para tu unidad. Consulta con administración.'
                    : selected?.bookable
                      ? 'Este espacio no está disponible para reservar en este momento.'
                      : 'Este servicio no tiene reservas en línea. Consulta con administración.'}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
