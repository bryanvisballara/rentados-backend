import { Link } from 'react-router-dom';
import Logo from '../components/Logo';
import {
  RENTADOS_APP_STORE_URL,
  RENTADOS_PLAY_STORE_URL,
  RENTADOS_QR_ANDROID,
  RENTADOS_QR_IOS,
} from '../lib/rentadosAppStores';

const FOOTER_BRANDS = [
  {
    id: 'comergio',
    name: 'Comergio',
    ios: 'https://apps.apple.com/app/id6760672707',
    android: 'https://play.google.com/store/apps/details?id=com.comergio.app&hl=es_CO',
  },
  {
    id: 'tecnowallet',
    name: 'TecnoWallet',
    ios: 'https://apps.apple.com/co/app/tecnowallet/id6802359477',
    android:
      'https://play.google.com/store/apps/details?id=com.tecnowallet.mobile&hl=es_CO',
  },
  {
    id: 'pushgo',
    name: 'PushGo Viral',
    web: 'https://pushgoviral.com/',
  },
];

function FooterStoreQr({ href, qrSrc, platform }) {
  return (
    <a
      className="land-foot__qr-card"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      <img
        className="land-foot__qr-img"
        src={qrSrc}
        alt={`Código QR para descargar Rentados en ${platform}`}
        width={104}
        height={104}
        loading="lazy"
        decoding="async"
      />
      <span className="land-foot__qr-label">{platform}</span>
    </a>
  );
}

function FooterBrandRow({ brand }) {
  if (brand.web) {
    return (
      <li className="land-foot__brand-line">
        <span className="land-foot__brand-line-name">{brand.name}</span>
        <a
          className="land-foot__brand-line-web"
          href={brand.web}
          target="_blank"
          rel="noopener noreferrer"
        >
          {brand.web.replace(/^https?:\/\//, '')}
        </a>
      </li>
    );
  }

  return (
    <li className="land-foot__brand-line">
      <span className="land-foot__brand-line-name">{brand.name}</span>
      <span className="land-foot__brand-line-stores">
        <a href={brand.ios} target="_blank" rel="noopener noreferrer">
          App Store
        </a>
        <span aria-hidden="true"> · </span>
        <a href={brand.android} target="_blank" rel="noopener noreferrer">
          Google Play
        </a>
      </span>
    </li>
  );
}

export default function LandingFooter() {
  return (
    <footer className="land-foot" data-reveal="fade">
      <div className="land-foot__inner">
        <div className="land-foot__grid">
          <section className="land-foot__col land-foot__col--rentados" aria-labelledby="land-foot-rentados">
            <div className="land-foot__brand-head">
              <Logo size="sm" />
              <span className="land-foot__wordmark">Rentados</span>
            </div>
            <p id="land-foot-rentados" className="land-foot__lead">
              Administración de conjuntos residenciales en Colombia.
            </p>
            <div className="land-foot__downloads">
              <FooterStoreQr
                href={RENTADOS_APP_STORE_URL}
                qrSrc={RENTADOS_QR_IOS}
                platform="App Store"
              />
              <FooterStoreQr
                href={RENTADOS_PLAY_STORE_URL}
                qrSrc={RENTADOS_QR_ANDROID}
                platform="Google Play"
              />
            </div>
          </section>

          <section className="land-foot__col" aria-labelledby="land-foot-about">
            <h2 id="land-foot-about" className="land-foot__heading">
              Conócenos
            </h2>
            <p className="land-foot__about-text">Rentados es una marca de</p>
            <p className="land-foot__about-company">WW TECNO S.A.S</p>
            <p className="land-foot__about-tagline">World Wide Technologies</p>
            <a
              className="land-foot__about-link"
              href="https://wwtecno.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              wwtecno.com
            </a>
          </section>

          <section className="land-foot__col" aria-labelledby="land-foot-brands">
            <h2 id="land-foot-brands" className="land-foot__heading">
              Nuestras marcas
            </h2>
            <ul className="land-foot__brand-list">
              {FOOTER_BRANDS.map((brand) => (
                <FooterBrandRow key={brand.id} brand={brand} />
              ))}
            </ul>
          </section>

          <section className="land-foot__col land-foot__col--legal" aria-labelledby="land-foot-legal">
            <h2 id="land-foot-legal" className="land-foot__heading">
              Legal
            </h2>
            <nav className="land-foot__legal" aria-label="Legal">
              <Link to="/privacidad">Privacidad</Link>
              <Link to="/soporte">Soporte</Link>
              <Link to="/login">Iniciar sesión</Link>
            </nav>
          </section>
        </div>

        <p className="land-foot__copy">
          © {new Date().getFullYear()} WW TECNO S.A.S · Rentados
        </p>
      </div>
    </footer>
  );
}
