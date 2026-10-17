import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo';
import { LANDING_LEAD_PATH, LANDING_VINCULA_CTA_LABEL } from '../lib/landingLead';
import './LandingPage.css';

const HERO_FEATURES = [
  { label: 'Paquetes y entregas.', icon: 'box' },
  { label: 'Registro de visitas.', icon: 'people' },
  { label: 'Reservas de áreas comunes.', icon: 'calendar' },
  { label: 'Cuotas y facturas.', icon: 'card' },
  { label: 'Avisos del conjunto.', icon: 'megaphone' },
];

const MODULES_FEATURED = [
  {
    title: 'Casillero',
    text: 'Registro de paquetes y avisos al residente.',
    icon: 'box',
    accent: true,
  },
  {
    title: 'Push del conjunto',
    text: 'Envía avisos, noticias y comunicaciones.',
    icon: 'megaphone',
  },
  {
    title: 'Entrega con firma',
    text: 'Control y confirmación de recibo.',
    icon: 'signature',
  },
  {
    title: 'Campana',
    text: 'Los avisos viven en la app hasta la entrega.',
    icon: 'bell',
  },
];

const MODULES_COMPACT = [
  { title: 'Visitantes', text: 'Registro previo de ingresos.', icon: 'people' },
  { title: 'Parqueadero', text: 'Control de vehículos en portería.', icon: 'car' },
  { title: 'Publicaciones', text: 'Avisos oficiales del conjunto.', icon: 'doc' },
  { title: 'Cuotas', text: 'Administración y pagos en la app.', icon: 'card' },
  { title: 'Cartera', text: 'Estado de cuenta por unidad.', icon: 'chart' },
  { title: 'Morosidad', text: 'Seguimiento de pagos pendientes.', icon: 'clock' },
  { title: 'Facturas', text: 'Servicios públicos de la unidad.', icon: 'invoice' },
  { title: 'Reservas', text: 'Salón, gimnasio y zonas comunes.', icon: 'calendar' },
  { title: 'Shop', text: 'Compras dentro del conjunto.', icon: 'cart' },
  { title: 'Restaurantes', text: 'Pedidos a domicilio.', icon: 'restaurant' },
  { title: 'Servicios', text: 'Prestadores habilitados.', icon: 'wrench' },
  { title: 'SOS', text: 'Líneas de emergencia.', icon: 'shield' },
];

const MODULES = [...MODULES_FEATURED, ...MODULES_COMPACT];

const SOLUTIONS_BENEFITS = [
  {
    bold: 'Dale a tus colaboradores',
    rest: 'mejores herramientas de trabajo.',
  },
  {
    bold: 'Dale a tus colaboradores',
    rest: 'optimización en sus procesos.',
  },
  {
    bold: 'Ahorra dinero',
    rest: 'en minutas de seguridad y libros contables.',
  },
  {
    bold: 'Simplifica el cobro',
    rest: 'de cuotas de administración.',
  },
  {
    bold: 'Mejora la experiencia',
    rest: 'de tus residentes.',
  },
];

const CARTERA_HIGHLIGHTS = [
  {
    n: '01',
    icon: 'bell',
    title: 'Avisos automáticos en el celular.',
    text: 'Recordatorios push antes del vencimiento y seguimiento después: el residente ve cuotas y facturas pendientes directo en la app.',
  },
  {
    n: '02',
    icon: 'card',
    title: 'Débitos automáticos.',
    text: 'El residente puede programar el pago de cuotas desde la app: menos olvidos, cobros más predecibles y menos trabajo manual para la administración.',
  },
  {
    n: '03',
    icon: 'chart',
    title: 'Más pagos, menos morosidad.',
    text: 'Al llegar a tiempo los recordatorios, suben los pagos y baja la cartera. Conjuntos que usan la app reportan reducciones de cartera de hasta un 30%.',
  },
];

const FLOW = [
  {
    n: '01',
    icon: 'camera',
    title: 'Portería fotografía.',
    text: 'Elige la unidad y deja un comentario si hace falta.',
  },
  {
    n: '02',
    icon: 'bell',
    title: 'El residente recibe.',
    text: 'Push y campana con el nombre del conjunto.',
  },
  {
    n: '03',
    icon: 'check',
    title: 'Se entrega.',
    text: 'Firma en portería. El número del ícono baja.',
  },
];

function FeatureIcon({ name }) {
  const common = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6 };
  if (name === 'box') {
    return (
      <svg {...common}>
        <path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5v-7Z" />
        <path d="M12 12v8M4 8.5 12 12l8-3.5" />
      </svg>
    );
  }
  if (name === 'people') {
    return (
      <svg {...common}>
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M3.5 19c.6-2.8 3-4.5 5.5-4.5S14.4 16.2 15 19M13 19c.4-1.8 1.8-3 3.5-3s3.1 1.2 3.5 3" />
      </svg>
    );
  }
  if (name === 'calendar') {
    return (
      <svg {...common}>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M8 3v4M16 3v4M4 10h16" />
      </svg>
    );
  }
  if (name === 'card') {
    return (
      <svg {...common}>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M3 10h18" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M4 11v2a2 2 0 0 0 2 2h1l3 3v-8l-3-3H6a2 2 0 0 0-2 2Z" />
      <path d="M15.5 8.5a4.5 4.5 0 0 1 0 7M18.5 6a7.5 7.5 0 0 1 0 12" />
    </svg>
  );
}

function PortalIcon({ name }) {
  const common = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6 };
  if (name === 'porteria') {
    return (
      <svg {...common}>
        <rect x="7" y="2.5" width="10" height="19" rx="2" />
        <circle cx="12" cy="17" r="1.2" fill="currentColor" stroke="none" />
        <path d="M10 6h4" />
      </svg>
    );
  }
  if (name === 'admin') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M3.5 19c.6-2.8 3-4.5 5.5-4.5S14.4 16.2 15 19M13 19c.4-1.8 1.8-3 3.5-3s3.1 1.2 3.5 3" />
    </svg>
  );
}

function FlowStepIcon({ name }) {
  const common = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6 };
  if (name === 'camera') {
    return (
      <svg {...common}>
        <path d="M4 8h3l1.5-2h7L17 8h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z" />
        <circle cx="12" cy="13" r="3.2" />
      </svg>
    );
  }
  if (name === 'bell') {
    return (
      <svg {...common}>
        <path d="M12 3a5 5 0 0 0-5 5v3.5L5 14h14l-2-2.5V8a5 5 0 0 0-5-5Z" />
        <path d="M10 18a2 2 0 0 0 4 0" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.2 10.8 15 16 9.5" />
    </svg>
  );
}

function PortalArrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function ModuleIcon({ name }) {
  const common = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6 };
  if (name === 'megaphone') {
    return (
      <svg {...common}>
        <path d="M4 11v2a2 2 0 0 0 2 2h1l3 3v-8l-3-3H6a2 2 0 0 0-2 2Z" />
        <path d="M15.5 8.5a4.5 4.5 0 0 1 0 7M18.5 6a7.5 7.5 0 0 1 0 12" />
      </svg>
    );
  }
  if (name === 'signature') {
    return (
      <svg {...common}>
        <path d="M4 18h16M8 14l2-2 2 2 4-4 2 2" />
        <rect x="4" y="4" width="16" height="12" rx="2" />
      </svg>
    );
  }
  if (name === 'bell') {
    return (
      <svg {...common}>
        <path d="M12 3a5 5 0 0 0-5 5v3.5L5 14h14l-2-2.5V8a5 5 0 0 0-5-5Z" />
        <path d="M10 18a2 2 0 0 0 4 0" />
      </svg>
    );
  }
  if (name === 'car') {
    return (
      <svg {...common}>
        <path d="M5 16h14l-1.5-5.5a2 2 0 0 0-1.9-1.5H8.4a2 2 0 0 0-1.9 1.5L5 16Z" />
        <circle cx="8" cy="16.5" r="1.2" />
        <circle cx="16" cy="16.5" r="1.2" />
      </svg>
    );
  }
  if (name === 'doc') {
    return (
      <svg {...common}>
        <path d="M8 4h8l4 4v12H8z" />
        <path d="M16 4v4h4M10 13h6M10 17h4" />
      </svg>
    );
  }
  if (name === 'chart') {
    return (
      <svg {...common}>
        <path d="M5 19V9M12 19V5M19 19v-7" />
      </svg>
    );
  }
  if (name === 'clock') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }
  if (name === 'invoice') {
    return (
      <svg {...common}>
        <path d="M6 4h12v16l-3-2-3 2-3-2-3 2z" />
        <path d="M9 9h6M9 13h6" />
      </svg>
    );
  }
  if (name === 'cart') {
    return (
      <svg {...common}>
        <circle cx="9" cy="19" r="1.2" />
        <circle cx="17" cy="19" r="1.2" />
        <path d="M3 5h2l2 11h10l2-8H7" />
      </svg>
    );
  }
  if (name === 'restaurant') {
    return (
      <svg {...common}>
        <path d="M8 3v8a2 2 0 0 0 4 0V3M10 11v10M16 3v6a2 2 0 0 0 4 0V3M18 9v12" />
      </svg>
    );
  }
  if (name === 'wrench') {
    return (
      <svg {...common}>
        <path d="M14 4a5 5 0 0 1 1.7 9.7L8 21l-2-2 7.7-7.7A5 5 0 0 1 14 4Z" />
      </svg>
    );
  }
  if (name === 'shield') {
    return (
      <svg {...common}>
        <path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" />
      </svg>
    );
  }
  if (name === 'people') {
    return (
      <svg {...common}>
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M3.5 19c.6-2.8 3-4.5 5.5-4.5S14.4 16.2 15 19M13 19c.4-1.8 1.8-3 3.5-3s3.1 1.2 3.5 3" />
      </svg>
    );
  }
  if (name === 'card') {
    return (
      <svg {...common}>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M3 10h18" />
      </svg>
    );
  }
  if (name === 'calendar') {
    return (
      <svg {...common}>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M8 3v4M16 3v4M4 10h16" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5v-7Z" />
      <path d="M12 12v8M4 8.5 12 12l8-3.5" />
    </svg>
  );
}

const LANDING_APP_VIDEO = '/assets/landing-app-demo.mp4';
const SHOWCASE_IPAD_VIDEO = '/assets/landing-showcase-ipad.mov';
const SHOWCASE_IPHONE_VIDEO = '/assets/landing-showcase-iphone-push.mp4';
const SHOWCASE_ANDROID_VIDEO = '/assets/landing-showcase-android-push.mp4';

const SHOWCASE_MODULES_TABLET_VIDEO = '/assets/landing-modules-showcase-tablet.mov';
const SHOWCASE_MODULES_IPHONE_VIDEO = '/assets/landing-modules-showcase-iphone.mp4';
const SHOWCASE_MODULES_ANDROID_VIDEO = '/assets/landing-modules-showcase-android.mp4';

const PHONE_VIDEO_DELAY_MS = 2000;

const VINCULA_ACQUISITION_STEPS = [
  {
    n: 1,
    icon: 'contact',
    title: 'Contáctanos para crear tu cuenta',
    text: 'Sin costos de inscripción ni de configuración.',
  },
  {
    n: 2,
    icon: 'building',
    title: 'Configura tu conjunto',
    text: 'En pocos minutos y con nuestro acompañamiento.',
  },
  {
    n: 3,
    icon: 'residents',
    title: 'Invita a tus residentes',
    text: 'Entrega credenciales y listo para empezar.',
  },
];

const VINCULA_CARD_POINTS = [
  {
    title: 'Vinculación 100% gratis.',
    text: 'Sin costos de inscripción ni de configuración.',
  },
  {
    title: 'Empieza sin pagar.',
    text: 'Activa tu cuenta sin inversión inicial.',
  },
  {
    title: 'Digitaliza tu conjunto hoy.',
    text: 'Da el primer paso hacia una administración más práctica.',
  },
];

const VINCULA_CTA_HIGHLIGHTS = [
  {
    icon: 'bolt',
    title: '100% gratis',
    text: 'Sin costos de inscripción ni de configuración.',
  },
  {
    icon: 'shield',
    title: 'Sin inversión inicial',
    text: 'Empieza a usar todas las funciones desde el primer día.',
  },
  {
    icon: 'chart',
    title: 'Más eficiencia',
    text: 'Gestiona tu conjunto en un solo lugar y ahorra tiempo.',
  },
];

function LandingPosterTitleAccent({ children }) {
  return (
    <span className="land-poster-title__last">
      {children}
      <svg className="land-poster-title__spark" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 14l5-6" />
        <path d="M6 14h7" />
        <path d="M6 14l4 5" />
      </svg>
      <svg
        className="land-poster-title__underline"
        viewBox="0 0 320 16"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M6 12 C 90 14, 210 8, 314 5"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

function LandingPosterTitle({
  tag: Tag = 'h2',
  align = 'center',
  line1,
  pill,
  line3,
  lines = 3,
  className = '',
}) {
  const wrapClass = [
    'land-poster-title-wrap',
    `land-poster-title-wrap--${align}`,
    lines === 2 ? 'land-poster-title-wrap--two' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapClass}>
      <svg className="land-poster-title-deco land-poster-title-deco--tl" viewBox="0 0 120 120" aria-hidden="true">
        <path d="M118 8 C60 28 28 58 8 118" fill="none" stroke="currentColor" strokeWidth="1.2" />
      </svg>
      <svg className="land-poster-title-deco land-poster-title-deco--br" viewBox="0 0 120 120" aria-hidden="true">
        <path d="M8 112 C48 88 82 52 112 8" fill="none" stroke="currentColor" strokeWidth="1.2" />
      </svg>
      <Tag className="land-poster-title">
        <span className="land-poster-title__line">{line1}</span>
        {lines === 2 ? (
          <span className="land-poster-title__line land-poster-title__line--combo land-poster-title__line--last">
            <span className="land-poster-title__pill">{pill}</span>
            <span className="land-poster-title__combo-mid"> en un </span>
            <LandingPosterTitleAccent>{line3}</LandingPosterTitleAccent>
          </span>
        ) : (
          <>
            <span className="land-poster-title__line">
              <span className="land-poster-title__pill">{pill}</span>
            </span>
            <span className="land-poster-title__line land-poster-title__line--last">
              <LandingPosterTitleAccent>{line3}</LandingPosterTitleAccent>
            </span>
          </>
        )}
      </Tag>
    </div>
  );
}

function LandingPosterKicker({ children, className = '' }) {
  return (
    <>
      <p className={`land-kicker${className ? ` ${className}` : ''}`}>{children}</p>
      <span className="land-kicker-rule" aria-hidden="true" />
    </>
  );
}

function VinculaStepIcon({ name }) {
  const common = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 };
  if (name === 'contact') {
    return (
      <svg {...common}>
        <circle cx="9" cy="8" r="3" />
        <path d="M4 20v-1a5 5 0 0 1 5-5h0a5 5 0 0 1 5 5v1" />
        <path d="M19 8v6M16 11h6" />
      </svg>
    );
  }
  if (name === 'building') {
    return (
      <svg {...common}>
        <path d="M5 20V9l7-3.5L19 9v11" />
        <path d="M9 20v-5h6v5" />
        <path d="M9 11h.01M9 14h.01M15 11h.01M15 14h.01" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="9" cy="9" r="2.5" />
      <circle cx="16.5" cy="10" r="2" />
      <circle cx="5.5" cy="10" r="2" />
      <path d="M3.5 19v-1a3 3 0 0 1 3-3" />
      <path d="M6.5 19v-1a4 4 0 0 1 4-4" />
      <path d="M13 19v-1a3.5 3.5 0 0 1 3.5-3.5h.5a3 3 0 0 1 3 3v1.5" />
    </svg>
  );
}

function VinculaFlowBridge() {
  return (
    <div className="land-vincula-flow__bridge" aria-hidden="true">
      <span className="land-vincula-flow__bridge-line" />
      <span className="land-vincula-flow__bridge-node">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M5 12h12M13 8l4 4-4 4" />
        </svg>
      </span>
      <span className="land-vincula-flow__bridge-line" />
    </div>
  );
}

function LandingVinculaSteps({ className = '' }) {
  return (
    <div className={`land-vincula-flow${className ? ` ${className}` : ''}`}>
      <ol className="land-vincula-flow__track">
        {VINCULA_ACQUISITION_STEPS.map((step, index) => (
          <li key={step.title} className="land-vincula-flow__segment">
            <article className="land-vincula-flow__card">
              <span className="land-vincula-flow__badge">{step.n}</span>
              <span className="land-vincula-flow__icon">
                <VinculaStepIcon name={step.icon} />
              </span>
              <h3 className="land-vincula-flow__title">{step.title}</h3>
              <p className="land-vincula-flow__text">{step.text}</p>
            </article>
            {index < VINCULA_ACQUISITION_STEPS.length - 1 ? <VinculaFlowBridge /> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

function VinculaFlowYConnector() {
  const stroke = 'rgba(127, 154, 136, 0.55)';
  const hubX = 480;
  const hubY = 72;
  const hubR = 22;
  return (
    <div className="land-vincula-y-join" aria-hidden="true">
      <svg
        className="land-vincula-y-join__art"
        viewBox="0 0 960 128"
        preserveAspectRatio="xMidYMid meet"
      >
        <path
          d={`M 158 0 V 48 Q 158 ${hubY} 248 ${hubY} H ${hubX}`}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={`M ${hubX} 0 V 128`}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d={`M 802 0 V 48 Q 802 ${hubY} 712 ${hubY} H ${hubX}`}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={hubX} cy={hubY} r={hubR} fill="#8fa892" />
        <text
          x={hubX}
          y={hubY + 6}
          textAnchor="middle"
          fill="#fff"
          fontSize="18"
          fontFamily="var(--font-sans), sans-serif"
          fontWeight="600"
        >
          y
        </text>
      </svg>
    </div>
  );
}

function LandingSolutionsBenefits() {
  return (
    <div className="land-solutions__benefits-card">
      <ul className="land-solutions__benefits land-solutions__benefits--head">
        {SOLUTIONS_BENEFITS.map((item) => (
          <li key={`${item.bold}-${item.rest}`} className="land-solutions__benefit">
            <span className="land-solutions__benefit-check" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M5 12.5 9.5 17 19 7" />
              </svg>
            </span>
            <span className="land-solutions__benefit-copy">
              <strong>{item.bold}</strong> {item.rest}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function VinculaCtaHighlightIcon({ name }) {
  const common = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.65 };
  if (name === 'bolt') {
    return (
      <svg {...common}>
        <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
      </svg>
    );
  }
  if (name === 'shield') {
    return (
      <svg {...common}>
        <path d="M12 3 5 6v6c0 4.2 3 7.8 7 9 4-1.2 7-4.8 7-9V6l-7-3Z" />
        <path d="M9.5 12.2 11.2 14 15 10" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M5 19V9M12 19V5M19 19v-7" />
    </svg>
  );
}

function LandingVinculaSolutionsCta() {
  return (
    <div className="land-vincula-cta">
      <ul className="land-vincula-cta__highlights">
        {VINCULA_CTA_HIGHLIGHTS.map((item) => (
          <li key={item.title}>
            <span className="land-vincula-cta__icon" aria-hidden="true">
              <VinculaCtaHighlightIcon name={item.icon} />
            </span>
            <strong className="land-vincula-cta__title">{item.title}</strong>
            <p className="land-vincula-cta__text">{item.text}</p>
          </li>
        ))}
      </ul>
      <div className="land-vincula-cta__action">
        <p className="land-vincula-cta__prompt">¿Listo para comenzar?</p>
        <div className="land-vincula-cta__btn-wrap">
          <Link className="land-vincula-cta__btn" to={LANDING_LEAD_PATH}>
            {LANDING_VINCULA_CTA_LABEL}
            <span className="land-vincula-cta__btn-arrow" aria-hidden="true">
              →
            </span>
          </Link>
          <span className="land-vincula-cta__btn-spark" aria-hidden="true">
            <svg viewBox="0 0 48 32" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 24 L18 8" />
              <path d="M14 26 L26 10" />
              <path d="M22 28 L34 12" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}

function LandingVinculaCard({ className = '' }) {
  return (
    <div className={`land-vincula-card${className ? ` ${className}` : ''}`}>
      <ul className="land-vincula-card__list">
        {VINCULA_CARD_POINTS.map((item) => (
          <li key={item.title}>
            <span className="land-vincula-card__check" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M5 12.5 9.5 17 19 7" />
              </svg>
            </span>
            <div>
              <strong>{item.title}</strong>
              <p>{item.text}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="land-vincula-card__foot">
        <p className="land-vincula-card__prompt">¿Listo para comenzar?</p>
        <Link className="land-vincula-card__btn" to={LANDING_LEAD_PATH}>
          {LANDING_VINCULA_CTA_LABEL}
        </Link>
      </div>
    </div>
  );
}

function DeviceVideoMock({ variant, src, label, startDelayMs = 0 }) {
  const rootRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    const video = videoRef.current;
    if (!root || !video) return undefined;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.pause();
    video.currentTime = 0;

    let delayTimer;
    let unlocked = false;
    let hasStarted = false;

    const tryPlay = () => {
      video.muted = true;
      return video.play().catch(() => {
        if (unlocked) return undefined;
        const unlock = () => {
          unlocked = true;
          video.muted = true;
          video.play().catch(() => {});
        };
        document.addEventListener('touchstart', unlock, { once: true, passive: true });
        document.addEventListener('click', unlock, { once: true });
        return undefined;
      });
    };

    const schedulePlay = () => {
      window.clearTimeout(delayTimer);
      video.pause();
      video.currentTime = 0;
      if (startDelayMs > 0) {
        delayTimer = window.setTimeout(() => {
          tryPlay();
        }, startDelayMs);
      } else {
        tryPlay();
      }
    };

    const prime = () => {
      if (hasStarted) return;
      hasStarted = true;
      if (video.readyState >= 1) {
        schedulePlay();
      } else {
        video.addEventListener('loadeddata', schedulePlay, { once: true });
        video.load();
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        prime();
      },
      { threshold: 0.2, rootMargin: '0px 0px 8% 0px' }
    );

    observer.observe(root);
    requestAnimationFrame(() => {
      const rect = root.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      if (rect.top < vh * 0.92 && rect.bottom > vh * 0.08) {
        prime();
      }
    });

    return () => {
      window.clearTimeout(delayTimer);
      observer.disconnect();
    };
  }, [src, startDelayMs]);

  return (
    <div
      ref={rootRef}
      className={`land-device land-device--${variant} land-device--video`}
      role="img"
      aria-label={label}
    >
      <div className="land-device__frame">
        <div className="land-device__screen">
          {variant === 'iphone' ? (
            <div className="land-device__island land-device__island--overlay" aria-hidden="true" />
          ) : null}
          {variant === 'android' ? (
            <div className="land-device__cam land-device__cam--overlay" aria-hidden="true" />
          ) : null}
          <video
            ref={videoRef}
            className="land-device__video"
            src={src}
            muted
            defaultMuted
            loop
            playsInline
            preload="metadata"
          />
        </div>
      </div>
    </div>
  );
}

function PhoneDashboard() {
  return (
    <DeviceVideoMock
      variant="iphone"
      src={LANDING_APP_VIDEO}
      label="Demostración en video de la app Rentados en un iPhone"
    />
  );
}

function ShowcaseDevices({
  ariaLabel,
  tabletSrc,
  iphoneSrc,
  androidSrc,
  tabletTag = 'Tablet · Portería.',
  className = '',
}) {
  return (
    <section
      className={`land-showcase-devices${className ? ` ${className}` : ''}`}
      aria-label={ariaLabel}
    >
      <div className="land-showcase-devices__grid" data-reveal-stagger>
        <div className="land-showcase-devices__ipad" data-reveal-item style={{ '--reveal-i': 0 }}>
          <div className="land-showcase-devices__device">
            <span className="land-showcase-devices__tag">{tabletTag}</span>
            <DeviceVideoMock variant="ipad" src={tabletSrc} label={`Demostración en ${tabletTag}`} />
          </div>
        </div>
        <div className="land-showcase-devices__phones" data-reveal-item style={{ '--reveal-i': 1 }}>
          <div className="land-showcase-devices__device land-showcase-devices__device--phone">
            <span className="land-showcase-devices__tag">iOS</span>
            <DeviceVideoMock
              variant="iphone"
              src={iphoneSrc}
              label="Notificación push en iPhone"
              startDelayMs={PHONE_VIDEO_DELAY_MS}
            />
          </div>
          <div className="land-showcase-devices__device land-showcase-devices__device--phone">
            <span className="land-showcase-devices__tag">Android</span>
            <DeviceVideoMock
              variant="android"
              src={androidSrc}
              label="Notificación push en Android"
              startDelayMs={PHONE_VIDEO_DELAY_MS}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  const [flowIndex, setFlowIndex] = useState(0);

  useEffect(() => {
    document.title = 'Rentados · Tu conjunto, en una sola app';
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return undefined;
    const timer = window.setInterval(() => {
      setFlowIndex((current) => (current + 1) % FLOW.length);
    }, 2400);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const nodes = document.querySelectorAll('[data-reveal], [data-reveal-stagger]');
    const reveal = (node) => node.classList.add('is-in');

    const revealInView = () => {
      const vh = window.innerHeight || document.documentElement.clientHeight;
      nodes.forEach((node) => {
        if (node.classList.contains('is-in')) return;
        const rect = node.getBoundingClientRect();
        if (rect.top < vh * 0.94 && rect.bottom > vh * 0.06) reveal(node);
      });
    };

    if (reduce) {
      nodes.forEach(reveal);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) reveal(entry.target);
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px 4% 0px' }
    );
    nodes.forEach((node) => observer.observe(node));

    revealInView();
    requestAnimationFrame(revealInView);
    const onAfterNav = () => window.setTimeout(revealInView, 80);
    window.addEventListener('load', revealInView);
    window.addEventListener('hashchange', onAfterNav);
    window.addEventListener('scroll', revealInView, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('load', revealInView);
      window.removeEventListener('hashchange', onAfterNav);
      window.removeEventListener('scroll', revealInView);
    };
  }, []);

  return (
    <div className="land">
      <header className="land-nav">
        <Link to="/conocenos" className="land-nav__brand" aria-label="Rentados">
          <Logo size="sm" />
          <span>Rentados</span>
        </Link>
        <div className="land-nav__end">
          <nav className="land-nav__links" aria-label="Secciones">
            <a href="#casillero">Casillero</a>
            <a href="#cartera">Cartera</a>
            <a href="#modulos">Todo</a>
          </nav>
          <Link className="land-nav__enter" to="/login">
            Entrar
          </Link>
        </div>
      </header>

      <section className="land-hero-wrap">
        <div className="land-hero-bg" aria-hidden="true" />
        <div className="land-hero">
          <div className="land-hero__copy" data-reveal="left">
            <LandingPosterKicker>Conjuntos residenciales</LandingPosterKicker>
            <LandingPosterTitle
              tag="h1"
              align="left"
              lines={2}
              className="land-poster-title-wrap--hero"
              line1="Te ayudamos a que conviertas tu"
              pill="conjunto residencial"
              line3="mejor lugar"
            />
            <p className="land-lead">
              Residentes, portería y administración conectados en un solo lugar.
            </p>
            <ul className="land-features">
              {HERO_FEATURES.map((item, index) => (
                <li key={item.label} style={{ animationDelay: `${0.12 + index * 0.06}s` }}>
                  <span className="land-features__icon">
                    <FeatureIcon name={item.icon} />
                  </span>
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
            <LandingVinculaCard className="land-vincula-card--hero" />
          </div>
          <div className="land-hero__stage" data-reveal="right">
            <div className="land-device-shell">
              <PhoneDashboard />
            </div>
          </div>
        </div>
      </section>

      <div className="land-ticker" aria-hidden="true" data-reveal="fade">
        <div className="land-ticker__track">
          {[...MODULES, ...MODULES].map((item, index) => (
            <span key={`${item.title}-${index}`}>{item.title}</span>
          ))}
        </div>
      </div>

      <section className="land-portals-wrap" id="cartera">
        <div className="land-portals-scene">
          <div className="land-portals-scene__photo" aria-hidden="true" data-reveal="right" />
          <div className="land-portals-scene__copy" data-reveal="left">
            <LandingPosterKicker>Cartera y morosidad</LandingPosterKicker>
            <h2 className="land-portals-scene__title">
              <span className="land-portals-scene__title-line">Reducimos la cartera de tu</span>
              <span className="land-portals-scene__title-line">
                conjunto <strong>hasta en un 30%</strong>.
              </span>
            </h2>
            <p className="land-portals-scene__lead">
              Con <strong>avisos automáticos en el celular</strong> (push), Rentados hace la gestión de
              cartera por ti: más pagos a tiempo, menos morosidad y sin tener que escribirle a cada
              residente uno por uno.
            </p>
          </div>
        </div>
        <div className="land-portals-cards" data-reveal-stagger>
          {CARTERA_HIGHLIGHTS.map((item, index) => (
            <article
              key={item.n}
              className="land-portals-card"
              data-reveal-item
              style={{ '--reveal-i': index }}
            >
              <span className="land-portals-card__num">{item.n}</span>
              <span className="land-portals-card__icon">
                <ModuleIcon name={item.icon} />
              </span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="land-locker-wrap" id="casillero">
        <div className="land-locker-scene">
          <div className="land-locker-scene__photo" aria-hidden="true" data-reveal="left" />
          <div className="land-locker-scene__panel">
            <div className="land-locker-scene__copy" data-reveal="right">
              <LandingPosterKicker>Casillero</LandingPosterKicker>
              <h2>No más minutas manuales, no más papelería.</h2>
              <p>
                Digitaliza la recepción en segundos: portería registra con foto, el residente recibe el
                aviso al instante en el celular y todo queda trazado en la app. Menos filas, cero
                papeles y conjuntos que se ven más modernos.
              </p>
            </div>
            <ol className="land-locker-flow land-locker-flow--rail" data-reveal-stagger>
            {FLOW.map((step, index) => (
              <li
                key={step.n}
                className={index === flowIndex ? 'is-on' : ''}
                data-reveal-item
                style={{ '--reveal-i': index }}
              >
                <span className="land-locker-flow__num">{step.n}</span>
                <span className="land-locker-flow__icon">
                  <FlowStepIcon name={step.icon} />
                </span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
            </ol>
          </div>
        </div>
      </section>

      <ShowcaseDevices
        ariaLabel="Demos en tablet, iPhone y Android — portería"
        tabletSrc={SHOWCASE_IPAD_VIDEO}
        iphoneSrc={SHOWCASE_IPHONE_VIDEO}
        androidSrc={SHOWCASE_ANDROID_VIDEO}
      />

      <section className="land-dashboard" aria-label="Comunicaciones del conjunto">
        <header className="land-dashboard__head" data-reveal>
          <LandingPosterKicker>App del residente</LandingPosterKicker>
          <h2>Centraliza las comunicaciones.</h2>
        </header>
        <div className="land-dashboard__statement" data-reveal="zoom">
          <p className="land-dashboard__statement-text">
            Notifica a los residentes los <strong>eventos y novedades</strong> del conjunto de manera{' '}
            <strong>fácil y organizada</strong>.
          </p>
        </div>
      </section>

      <ShowcaseDevices
        ariaLabel="Demos en tablet, iPhone y Android — módulos"
        className="land-showcase-devices--before-modules"
        tabletSrc={SHOWCASE_MODULES_TABLET_VIDEO}
        iphoneSrc={SHOWCASE_MODULES_IPHONE_VIDEO}
        androidSrc={SHOWCASE_MODULES_ANDROID_VIDEO}
      />

      <section className="land-solutions land-solutions--cta" id="modulos">
        <div className="land-solutions__head" data-reveal="zoom">
          <LandingPosterKicker>Da el siguiente paso</LandingPosterKicker>
          <LandingPosterTitle
            tag="h2"
            align="center"
            className="land-poster-title-wrap--solutions"
            line1="Forma parte de la nueva"
            pill="generación de administradores"
            line3="de propiedad horizontal"
          />
          <p className="land-solutions__steps-intro">Siguiendo estos 3 simples pasos:</p>
          <div className="land-vincula-stack">
            <LandingVinculaSteps className="land-vincula-flow--head" />
            <VinculaFlowYConnector />
            <LandingSolutionsBenefits />
          </div>
        </div>

        <div className="land-solutions__cta-center">
          <LandingVinculaSolutionsCta />
        </div>
      </section>

      <footer className="land-foot" data-reveal="fade">
        <span>Rentados</span>
        <nav aria-label="Información">
          <Link to="/privacidad">Privacidad</Link>
          <Link to="/soporte">Soporte</Link>
          <Link to="/login">Iniciar sesión</Link>
        </nav>
      </footer>
    </div>
  );
}
