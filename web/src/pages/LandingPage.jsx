import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo';
import { LANDING_LEAD_PATH, LANDING_VINCULA_CTA_LABEL } from '../lib/landingLead';
import {
  RENTADOS_APP_STORE_URL,
  RENTADOS_PLAY_STORE_URL,
  RENTADOS_QR_ANDROID,
  RENTADOS_QR_IOS,
  STORE_BADGE_APP_STORE,
  STORE_BADGE_GOOGLE_PLAY,
} from '../lib/rentadosAppStores';
import LandingFooter from './LandingFooter';
import './LandingPage.css';

const HERO_VALUES = [
  { label: 'Mejora procesos', icon: 'leaf' },
  { label: 'Ahorra dinero', icon: 'savings' },
  { label: 'Ahorra tiempo', icon: 'time' },
];

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

const RISK_ITEMS = [
  {
    icon: 'chart',
    title: 'Cartera que no baja.',
    note: 'La morosidad crece cuando nadie recuerda pagar a tiempo.',
  },
  {
    icon: 'bell',
    title: 'Residentes insatisfechos.',
    note: 'Paquetes sin aviso y portería desbordada generan quejas.',
  },
  {
    icon: 'clock',
    title: 'Tiempo y dinero perdidos.',
    note: 'Minutas y chats dispersos se comen horas de tu equipo.',
  },
];

const VALUE_PROP_POINTS = [
  {
    icon: 'megaphone',
    title: 'Centraliza las comunicaciones.',
    text: 'Notifica a los residentes los eventos y novedades del conjunto de manera fácil y organizada. Incluye recordatorios en tus comunicaciones.',
  },
  {
    icon: 'chart',
    titleLines: ['Reducimos la cartera de tu', 'conjunto hasta en un 30%.'],
    bullets: [
      'Avisos automáticos en el celular.',
      'Débitos automáticos.',
      'Más pagos, menos morosidad.',
    ],
  },
  {
    icon: 'box',
    title: 'No más minutas manuales, no más papelería.',
    bullets: [
      'Dale a tus colaboradores mejores herramientas de trabajo.',
      'Dale a tus colaboradores optimización en sus procesos.',
    ],
  },
];

const GUIDE_CREDENTIALS = [
  {
    id: 'wwtecno',
    icon: 'doc',
    pre: 'Una marca de',
    title: 'WW TECNO S.A.S',
    subtitle: 'World Wide Technologies',
  },
  {
    id: 'clients',
    icon: 'people',
    title: 'Más de 1.000 clientes felices',
  },
  {
    id: 'focus',
    icon: 'chart',
    title: 'Especialistas en conjuntos residenciales en Colombia',
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

function HeroValueIcon({ name }) {
  const common = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 };
  if (name === 'leaf') {
    return (
      <svg {...common}>
        <path d="M12 21c-4-3.5-7-7.5-7-12a7 7 0 0 1 14 0c0 4.5-3 8.5-7 12Z" />
        <path d="M12 9v12" />
      </svg>
    );
  }
  if (name === 'savings') {
    return (
      <svg {...common}>
        <rect x="5" y="7" width="14" height="10" rx="1.5" />
        <circle cx="12" cy="12" r="2.5" />
        <path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.5l3.5 2" />
    </svg>
  );
}

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

/** Secciones inferiores (cartera, casillero, CTA final) — desactivadas en landing actual */
const SHOW_LANDING_LOWER_SECTIONS = false;

const DEVICE_GALLERY_HERO_PHONE = {
  variant: 'iphone',
  src: LANDING_APP_VIDEO,
  title: 'Recorrido por la app en iPhone',
  description:
    'Pagos de administración, comunicados, paquetes y servicios del conjunto en un solo lugar.',
  label: 'Demostración en video de la app Rentados en un iPhone',
};

const DEVICE_GALLERY_PHONE_ROW = [
  {
    variant: 'iphone',
    src: SHOWCASE_IPHONE_VIDEO,
    title: 'Push en iPhone',
    description: 'El residente ve al instante cuando llega un paquete o un aviso importante.',
    label: 'Notificación push en iPhone',
    startDelayMs: PHONE_VIDEO_DELAY_MS,
  },
  {
    variant: 'android',
    src: SHOWCASE_ANDROID_VIDEO,
    title: 'Push en Android',
    description: 'La misma alerta en celulares Android, sin depender de WhatsApp.',
    label: 'Notificación push en Android',
    startDelayMs: PHONE_VIDEO_DELAY_MS,
  },
  {
    variant: 'iphone',
    src: SHOWCASE_MODULES_IPHONE_VIDEO,
    title: 'Módulos en iPhone',
    description: 'Todo lo que ofrece el conjunto, organizado en la app del residente.',
    label: 'Módulos de Rentados en iPhone',
    startDelayMs: PHONE_VIDEO_DELAY_MS,
  },
  {
    variant: 'android',
    src: SHOWCASE_MODULES_ANDROID_VIDEO,
    title: 'Módulos en Android',
    description: 'Experiencia completa para residentes con equipos Android.',
    label: 'Módulos de Rentados en Android',
    startDelayMs: PHONE_VIDEO_DELAY_MS,
  },
];

const DEVICE_GALLERY_TABLET_ROW = [
  {
    variant: 'ipad',
    src: SHOWCASE_IPAD_VIDEO,
    title: 'Registro de paquete',
    description: 'Registro de visitantes, paquetes y operación diaria desde la recepción.',
    label: 'Demostración en tablet de portería Rentados',
  },
  {
    variant: 'ipad',
    src: SHOWCASE_MODULES_TABLET_VIDEO,
    title: 'Publicación de comunicado',
    description: 'Comunicaciones, cartera y módulos del conjunto en pantalla amplia.',
    label: 'Módulos de Rentados en tablet',
  },
];

const DEVICE_GALLERY_GROUPS = [
  {
    id: 'residente',
    title: 'La app del residente',
    layout: 'hero-phones',
    hero: DEVICE_GALLERY_HERO_PHONE,
    phoneRow: DEVICE_GALLERY_PHONE_ROW,
  },
  {
    id: 'tablets',
    title: 'Portería y módulos en tablet',
    layout: 'tablets-row',
    tabletRow: DEVICE_GALLERY_TABLET_ROW,
  },
];

const VINCULA_ACQUISITION_STEPS = [
  {
    n: 1,
    icon: 'contact',
    title: 'Crea tu conjunto en segundos',
    text: 'Sin costos de inscripción ni de configuración.',
  },
  {
    n: 2,
    icon: 'building',
    title: 'Configura tu conjunto',
    text: 'Contáctanos para terminar de configurar tu conjunto.',
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

const READ_MORE_PREVIEW =
  'Hoy un residente puede necesitar más de ocho pasos solo para pagar la administración; muchos abandonan a mitad del camino y la deuda crece. En portería, buscar en la minuta un paquete recibido hace una semana roba minutos y genera filas. Los visitantes sin registro previo alargan las entradas en parqueadero. Los comunicados por WhatsApp se pierden entre chats personales y, además, las cuentas se bloquean por envíos masivos.';

function LandReadMoreStory() {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();

  return (
    <article className="land-read-more__block" data-reveal="clip-up">
      <h2 id="land-read-more-heading" className="land-read-more__title">
        <span className="land-read-more__title-line">Lo que hoy frena a residentes</span>
        <span className="land-read-more__title-line">y cómo Rentados lo simplifica</span>
      </h2>
      {!expanded ? (
        <p className="land-read-more__preview">{READ_MORE_PREVIEW}</p>
      ) : (
        <div id={panelId} className="land-read-more__full">
          <p className="land-read-more__lead">
            Actualmente a un residente le toma más de ocho pasos pagar una administración, y eso
            conlleva a que termine no pagándola y acumulando deudas.
          </p>
          <p className="land-read-more__label">Un residente tiene que:</p>
          <ol className="land-read-more__steps">
            <li>Entrar al navegador.</li>
            <li>Buscar en Google la página que recibe pagos.</li>
            <li>Abrir la página proveedora del servicio.</li>
            <li>Buscar la opción de pagos.</li>
            <li>Buscar el nombre del edificio.</li>
            <li>Colocar la referencia del apartamento.</li>
            <li>Colocar el valor de la administración.</li>
            <li>Dirigirse al pago.</li>
          </ol>
          <p>
            Esta serie de pasos, que toma varios minutos, hace que los residentes abandonen el proceso
            a mitad del camino. En Rentados, con dos clics pagan la administración en menos de diez
            segundos.
          </p>
          <h3 className="land-read-more__subhead">Minutas y paquetes</h3>
          <p>
            ¿Cuánto tiempo pierde un recepcionista buscando en la minuta un paquete que recibió hace
            una semana, para que el residente firme y por fin se lo entreguen? Cada búsqueda manual
            es fila, estrés y residentes molestos.
          </p>
          <h3 className="land-read-more__subhead">Parqueadero y visitantes</h3>
          <p>
            Las filas en parqueadero también crecen cuando los visitantes no están registrados con
            antelación: portería debe validar datos en el momento, en lugar de autorizar ingresos
            que ya conocía.
          </p>
          <h3 className="land-read-more__subhead">Comunicaciones que sí llegan</h3>
          <p>
            Hoy los mensajes de WhatsApp se pierden entre tantos chats que reciben los residentes.
            Además, WhatsApp está bloqueando cuentas por la cantidad de mensajes enviados desde los
            conjuntos.
          </p>
          <p>
            Con Rentados publicas comunicados oficiales y puedes añadir uno o varios recordatorios a
            cada aviso, sin crear publicaciones nuevas: llegan como notificaciones push al celular.
          </p>
          <p className="land-read-more__example">
            <strong>Ejemplo:</strong> se suspende el suministro de agua por doce horas por
            mantenimiento en los tanques de reserva, a las 6 p.&nbsp;m. del martes; se recomienda
            recoger agua. El comunicado se envía un día antes o la misma mañana, y el administrador
            puede programar recordatorios — por ejemplo una hora antes y quince minutos antes — para
            que el residente reciba el aviso a tiempo.
          </p>
        </div>
      )}
      <button
        type="button"
        className="land-read-more__toggle"
        aria-expanded={expanded}
        aria-controls={expanded ? panelId : undefined}
        onClick={() => setExpanded((open) => !open)}
      >
        {expanded ? 'Ver menos' : 'Ver más'}
      </button>
    </article>
  );
}

function LandingVinculaSteps({ className = '', staggerReveal = '' }) {
  const staggerId = staggerReveal.trim();
  return (
    <div className={`land-vincula-flow${className ? ` ${className}` : ''}`}>
      <ol
        className="land-vincula-flow__track"
        {...(staggerId ? { 'data-reveal-stagger': staggerId } : {})}
      >
        {VINCULA_ACQUISITION_STEPS.map((step, index) => (
          <li
            key={step.title}
            className="land-vincula-flow__segment"
            {...(staggerId
              ? { 'data-reveal-item': true, style: { '--reveal-i': index } }
              : {})}
          >
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

function DeviceGalleryItem({ variant, src, title, description, label, startDelayMs = 0, featured = false }) {
  return (
    <article
      className={`land-device-gallery__item land-device-gallery__item--${variant}${
        featured ? ' land-device-gallery__item--featured' : ''
      }`}
    >
      <div className="land-device-gallery__item-copy">
        <h4 className="land-device-gallery__item-title">{title}</h4>
        <p className="land-device-gallery__item-desc">{description}</p>
      </div>
      <div className="land-device-gallery__item-device">
        <DeviceVideoMock
          variant={variant}
          src={src}
          label={label}
          startDelayMs={startDelayMs}
        />
      </div>
    </article>
  );
}

function LandingDeviceGallery() {
  return (
    <section className="land-device-gallery" id="demos" aria-labelledby="land-device-gallery-title">
      <header className="land-device-gallery__head" data-reveal="right">
        <LandingPosterKicker>Demos en video</LandingPosterKicker>
        <h2 id="land-device-gallery-title" className="land-device-gallery__title">
          Así se vive la experiencia en un conjunto moderno.
        </h2>
        <p className="land-device-gallery__lead">
          Cada dispositivo muestra un flujo real: la app del residente, la operación en portería y los
          módulos del conjunto.
        </p>
      </header>

      {DEVICE_GALLERY_GROUPS.map((group) => (
        <div
          key={group.id}
          className={`land-device-gallery__group land-device-gallery__group--${group.layout}`}
          data-reveal-stagger="demos"
        >
          <h3
            className="land-device-gallery__group-title"
            data-reveal-item
            style={{ '--reveal-i': 0 }}
          >
            {group.title}
          </h3>
          {group.layout === 'hero-phones' ? (
            <div className="land-device-gallery__layout land-device-gallery__layout--hero-phones">
              <div data-reveal-item style={{ '--reveal-i': 1 }}>
                <DeviceGalleryItem {...group.hero} featured />
              </div>
              <div
                className="land-device-gallery__phones-row"
                data-reveal-item
                style={{ '--reveal-i': 2 }}
              >
                {group.phoneRow.map((item) => (
                  <div
                    key={`${group.id}-${item.variant}-${item.title}`}
                    className="land-device-gallery__phones-row-cell"
                  >
                    <DeviceGalleryItem {...item} />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {group.layout === 'tablets-row' ? (
            <>
              <div
                className="land-device-gallery__tablets-row"
                data-reveal-item
                style={{ '--reveal-i': 1 }}
              >
                {group.tabletRow.map((item) => (
                  <div
                    key={`${group.id}-${item.variant}-${item.title}`}
                    className="land-device-gallery__tablets-row-cell"
                  >
                    <DeviceGalleryItem {...item} />
                  </div>
                ))}
              </div>
              <div className="land-device-gallery__cta-wrap">
                <Link
                  className="land-device-gallery__cta land-nav__enter"
                  to="/crear-edificio"
                  data-reveal="pop"
                >
                  Crea tu conjunto ahora
                </Link>
              </div>
            </>
          ) : null}
        </div>
      ))}
    </section>
  );
}

export default function LandingPage() {
  const [flowIndex, setFlowIndex] = useState(0);

  useEffect(() => {
    document.title = 'Rentados · Tu conjunto, en una sola app';
    document.documentElement.classList.add('land-page');
    return () => document.documentElement.classList.remove('land-page');
  }, []);

  useEffect(() => {
    if (!SHOW_LANDING_LOWER_SECTIONS) return undefined;
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

    document.querySelectorAll('.land-hero-banner').forEach(reveal);

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
      { threshold: 0.12, rootMargin: '0px 0px -2% 0px' }
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
          <Link className="land-nav__enter" to="/crear-edificio">
            Crea tu conjunto ahora
          </Link>
        </div>
      </header>

      <section className="land-hero-wrap land-hero-wrap--banner">
        <div className="land-hero-image">
          <div className="land-hero-bg" aria-hidden="true" />
          <div className="land-hero-banner">
            <p className="land-hero-banner__eyebrow">Conjuntos residenciales</p>
            <h1 className="land-hero-banner__title">
              Transforma la manera de administrar tu conjunto residencial.
            </h1>
            <p className="land-hero-banner__lead">
              Sé parte de la nueva generación de administradores.
            </p>
            <Link className="land-hero-banner__cta land-nav__enter" to="/crear-edificio">
              Crea tu conjunto ahora
            </Link>
          </div>
        </div>
        <ul className="land-hero-values" aria-label="Beneficios" data-reveal-stagger="hero-values">
          {HERO_VALUES.map((item, index) => (
            <li
              key={item.label}
              className="land-hero-value"
              data-reveal-item
              style={{ '--reveal-i': index }}
            >
              <span className="land-hero-value__icon" aria-hidden="true">
                <HeroValueIcon name={item.icon} />
              </span>
              <span className="land-hero-value__label">{item.label}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="land-risks" id="riesgos" aria-labelledby="land-risks-title">
        <div className="land-risks__inner">
          <h2 id="land-risks-title" className="land-risks__title" data-reveal="left">
            Lo que le cuesta a tu conjunto quedarse en lo manual
          </h2>
          <ul className="land-risks__strip" aria-label="Consecuencias" data-reveal-stagger="risks">
            {RISK_ITEMS.map((item, index) => (
              <li
                key={item.title}
                className="land-risks__item"
                data-reveal-item
                style={{ '--reveal-i': index }}
              >
                <span className="land-risks__item-icon" aria-hidden="true">
                  <ModuleIcon name={item.icon} />
                </span>
                <p className="land-risks__item-title">{item.title}</p>
                <p className="land-risks__item-note">{item.note}</p>
              </li>
            ))}
          </ul>
          <Link className="land-risks__cta land-nav__enter" to="/crear-edificio" data-reveal="fade">
            Crea tu conjunto ahora
          </Link>
        </div>
      </section>

      <section className="land-value-prop" id="propuesta" aria-labelledby="land-value-prop-title">
        <header className="land-value-prop__head" data-reveal="impact">
          <h2 id="land-value-prop-title" className="land-value-prop__title">
            Más organización para ti. Una mejor experiencia para todos.
          </h2>
          <p className="land-value-prop__lead">
            <span className="land-value-prop__lead-line">
              Organiza las operaciones, consulta la información y mantén conectada a tu comunidad
            </span>
            <span className="land-value-prop__lead-line">
              desde una plataforma diseñada para las necesidades reales de los conjuntos residenciales.
            </span>
          </p>
        </header>
        <div className="land-value-prop__media" data-reveal="right" aria-hidden="true" />
        <div className="land-value-prop__body">
          <ul className="land-value-prop__cards" data-reveal-stagger="value-cards">
            {VALUE_PROP_POINTS.map((item, index) => (
              <li
                key={item.title ?? item.titleLines?.join(' ')}
                className="land-value-prop__card"
                data-reveal-item
                style={{ '--reveal-i': index }}
              >
                <span className="land-value-prop__card-icon" aria-hidden="true">
                  <ModuleIcon name={item.icon} />
                </span>
                <h3>
                  {item.titleLines ? (
                    item.titleLines.map((line) => (
                      <span key={line} className="land-value-prop__card-title-line">
                        {line}
                      </span>
                    ))
                  ) : (
                    item.title
                  )}
                </h3>
                {item.text ? <p>{item.text}</p> : null}
                {item.bullets ? (
                  <ul className="land-value-prop__card-list">
                    {item.bullets.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
          <Link className="land-value-prop__cta land-nav__enter" to="/crear-edificio" data-reveal="zoom">
            Crea tu conjunto ahora
          </Link>
        </div>
      </section>

      <section className="land-guide" id="guia" aria-labelledby="land-guide-title">
        <div className="land-guide__layout">
          <div className="land-guide__copy" data-reveal="left">
            <div className="land-guide__heading">
              <div className="land-guide__logo">
                <Logo size="md" />
              </div>
              <h2 id="land-guide-title" className="land-guide__title">
                Conocemos la presión de una asamblea, y sabemos que las filas en portería y las carteras que
                no dejan de subir son frustantes.
              </h2>
            </div>
            <p className="land-guide__story">
              Rentados nació escuchando a administradores y equipos de portería en Colombia.
            </p>
          </div>
          <ul className="land-guide__credentials" data-reveal-stagger="guide-creds">
            {GUIDE_CREDENTIALS.map((item, index) => (
              <li
                key={item.id}
                className="land-guide__credential"
                data-reveal-item
                style={{ '--reveal-i': index }}
              >
                <span className="land-guide__credential-icon" aria-hidden="true">
                  <ModuleIcon name={item.icon} />
                </span>
                <div className="land-guide__credential-body">
                  {item.pre ? <p className="land-guide__credential-pre">{item.pre}</p> : null}
                  <p className="land-guide__credential-title">{item.title}</p>
                  {item.subtitle ? (
                    <p className="land-guide__credential-sub">{item.subtitle}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          <aside
            className="land-guide__download"
            aria-labelledby="land-guide-download-title"
            data-reveal="right"
          >
            <h3 id="land-guide-download-title" className="land-guide__download-title">
              Descarga la App ahora
            </h3>
            <div className="land-guide__download-stores">
              <div className="land-guide__store-block">
                <img
                  className="land-guide__store-badge"
                  src={STORE_BADGE_APP_STORE}
                  alt="Disponible en App Store"
                  width={158}
                  height={48}
                  loading="lazy"
                  decoding="async"
                />
                <img
                  className="land-guide__store-qr"
                  src={RENTADOS_QR_IOS}
                  alt="QR para descargar Rentados en App Store"
                  width={124}
                  height={124}
                  loading="lazy"
                  decoding="async"
                />
                <a
                  className="land-guide__download-btn land-nav__enter"
                  href={RENTADOS_APP_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Descárgala para iPhone
                </a>
              </div>
              <div className="land-guide__store-block">
                <img
                  className="land-guide__store-badge"
                  src={STORE_BADGE_GOOGLE_PLAY}
                  alt="Disponible en Google Play"
                  width={158}
                  height={48}
                  loading="lazy"
                  decoding="async"
                />
                <img
                  className="land-guide__store-qr"
                  src={RENTADOS_QR_ANDROID}
                  alt="QR para descargar Rentados en Google Play"
                  width={124}
                  height={124}
                  loading="lazy"
                  decoding="async"
                />
                <a
                  className="land-guide__download-btn land-nav__enter"
                  href={RENTADOS_PLAY_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Descárgala para Android
                </a>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="land-how-it-works" id="como-funciona" aria-labelledby="land-how-it-works-title">
        <p id="land-how-it-works-title" className="land-how-it-works__intro" data-reveal="fade">
          Cómo funciona:
        </p>
        <LandingVinculaSteps className="land-vincula-flow--section" staggerReveal="vincula-steps" />
      </section>

      <section className="land-read-more" id="detalle" aria-labelledby="land-read-more-heading">
        <LandReadMoreStory />
      </section>

      <LandingDeviceGallery />

      {SHOW_LANDING_LOWER_SECTIONS ? (
      <>
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
      </>
      ) : null}

      <LandingFooter />
    </div>
  );
}
