import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo';
import { LANDING_VINCULA_WHATSAPP_HREF } from '../lib/landingLead';
import './LeadThankYouPage.css';

export default function LeadThankYouPage() {
  useEffect(() => {
    document.title = 'Gracias — Rentados';
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'conversion_event_purchase', {});
    }
  }, []);

  return (
    <main className="lead-thanks">
      <header className="lead-thanks__header">
        <Link to="/conocenos" className="lead-thanks__logo" aria-label="Rentados — Conócenos">
          <Logo />
        </Link>
      </header>

      <section className="lead-thanks__panel" aria-labelledby="lead-thanks-title">
        <p className="lead-thanks__eyebrow">Solicitud recibida</p>
        <h1 id="lead-thanks-title">¡Gracias por contactarnos!</h1>
        <p className="lead-thanks__lead">
          Recibimos tu interés en vincular tu conjunto con Rentados. El siguiente paso es hablar con nuestro
          equipo por WhatsApp: te acompañamos sin costo de vinculación.
        </p>
        <a
          className="lead-thanks__whatsapp"
          href={LANDING_VINCULA_WHATSAPP_HREF}
          target="_blank"
          rel="noopener noreferrer"
        >
          Continuar por WhatsApp
          <span aria-hidden="true">→</span>
        </a>
        <p className="lead-thanks__hint">
          Si WhatsApp no se abrió, usa el botón de arriba. Respondemos en horario laboral (Colombia).
        </p>
        <nav className="lead-thanks__nav" aria-label="Más información">
          <Link to="/conocenos">Volver a Conócenos</Link>
          <Link to="/privacidad">Privacidad</Link>
          <Link to="/soporte">Soporte</Link>
        </nav>
      </section>
    </main>
  );
}
