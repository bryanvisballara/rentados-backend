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
      .then((data) => {
        setServicesData(data);
        if (!selectedId && data.services?.[0]) {
          setSelectedId(data.services[0].id);
        }
      })
      .catch((err) => setError(err.message));
  }, []);

  const selected = servicesData?.services?.find((s) => String(s.id) === String(selectedId));

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
            <div className="resident-services-grid" style={{ marginBottom: '1rem' }}>
              {servicesData.services.map((service) => (
                <button
                  key={service.id}
                  type="button"
                  className={`resident-service-card${
                    String(service.id) === String(selectedId) ? ' resident-service-card--active' : ''
                  }${service.blocked ? ' resident-service-card--blocked' : ''}`}
                  style={{
                    outline:
                      String(service.id) === String(selectedId)
                        ? '2px solid #2d3321'
                        : undefined,
                  }}
                  onClick={() => setSelectedId(service.id)}
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

            {selected?.bookable ? (
              <div className="resident-card">
                <ResidentBookingsSection services={servicesData.services.filter((s) => s.bookable)} />
              </div>
            ) : (
              <div className="resident-card">
                <p className="resident-empty">
                  {selected
                    ? 'Este servicio no tiene reservas en línea. Consulta con administración.'
                    : 'Selecciona un servicio para ver detalle.'}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
