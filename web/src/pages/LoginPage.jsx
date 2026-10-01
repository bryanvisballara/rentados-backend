import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { LOGIN_PORTALS } from '../config/loginPortals';
import { useAuth } from '../context/AuthContext';
import { homePathForUser } from '../utils/homePath';
import { fetchLoginBuildings, fetchLoginCountries, login as loginApi } from '../api/client';
import { setActiveTenant } from '../api/tenantContext';
import { formatBuildingAddressLine, formatBuildingLoginLabel } from '../utils/buildingAddress';
import './LoginPage.css';

const REDIRECTS = {
  resident: '/app',
  admin: '/admin',
  superadmin: '/super-admin',
  porteria: '/porteria',
};

const RESIDENT_LOGIN_CTX_KEY = 'rentados_resident_login_ctx';

const COUNTRY_FLAGS = {
  Colombia: '🇨🇴',
  México: '🇲🇽',
  Mexico: '🇲🇽',
};

function FieldIcon({ children }) {
  return (
    <span className="login__field-icon" aria-hidden="true">
      {children}
    </span>
  );
}

function IconBuilding() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V9l8-5 8 5v11" />
      <path d="M9 20v-6h6v6" />
      <path d="M4 20h16" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function IconEye({ off = false }) {
  return off ? (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6A3 3 0 0 0 13.4 13.4" />
      <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5.5 0 9.5 4.2 10.5 7-0.4 1.1-1.2 2.4-2.3 3.6" />
      <path d="M6.1 6.1C4.2 7.5 2.8 9.4 1.5 12c1 2.8 5 7 10.5 7 1.6 0 3.1-.4 4.4-1" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconChevron() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function loadResidentLoginContext() {
  try {
    const raw = sessionStorage.getItem(RESIDENT_LOGIN_CTX_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveResidentLoginContext(ctx) {
  sessionStorage.setItem(RESIDENT_LOGIN_CTX_KEY, JSON.stringify(ctx));
}

function useNarrowLoginViewport(maxWidth = 899) {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(`(max-width: ${maxWidth}px)`).matches : false
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const onChange = () => setNarrow(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [maxWidth]);

  return narrow;
}

const PHONE_STAFF_SWITCH_LINKS = [
  { label: 'Residentes', to: '/login' },
  { label: 'Portería', to: '/porteria/login' },
];

export default function LoginPage({ portal = 'resident', redirectTo }) {
  const config = LOGIN_PORTALS[portal] ?? LOGIN_PORTALS.resident;
  const isResidentPortal = portal === 'resident';
  const isStaffPortal = portal === 'admin' || portal === 'porteria';
  const isPhoneViewport = useNarrowLoginViewport();
  const savedCtx = isResidentPortal ? loadResidentLoginContext() : null;

  const portalSwitchLinks = useMemo(() => {
    if (isPhoneViewport && portal === 'admin') return PHONE_STAFF_SWITCH_LINKS;
    if (isPhoneViewport && portal === 'porteria') {
      return [
        { label: 'Residentes', to: '/login' },
        { label: 'Administración', to: '/admin/login' },
      ];
    }
    return config.switchLinks;
  }, [config.switchLinks, isPhoneViewport, portal]);

  const { loginSuccess, ready, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  function goToAdminLogin() {
    if (!isPhoneViewport || !isResidentPortal) return;
    navigate('/admin/login');
  }

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [countries, setCountries] = useState([]);
  const [country, setCountry] = useState(savedCtx?.country || '');
  const [buildings, setBuildings] = useState([]);
  const [buildingQuery, setBuildingQuery] = useState(savedCtx?.buildingName || '');
  const [selectedBuilding, setSelectedBuilding] = useState(
    savedCtx?.buildingId
      ? {
          id: savedCtx.buildingId,
          name: savedCtx.buildingName,
          city: savedCtx.buildingCity,
          organizationId: savedCtx.organizationId,
        }
      : null
  );
  const [buildingsLoading, setBuildingsLoading] = useState(false);
  const [showCountryList, setShowCountryList] = useState(false);
  const [showBuildingList, setShowBuildingList] = useState(false);
  const [showSplash, setShowSplash] = useState(isResidentPortal);
  const countryPickerRef = useRef(null);
  const buildingPickerRef = useRef(null);

  useEffect(() => {
    if (!isResidentPortal) return undefined;
    const timer = window.setTimeout(() => setShowSplash(false), 1000);
    return () => window.clearTimeout(timer);
  }, [isResidentPortal]);

  useEffect(() => {
    if (!ready || !isAuthenticated) return;
    const home = homePathForUser(user);
    if (!home || home === '/login' || location.pathname === home) return;
    navigate(home, { replace: true });
  }, [ready, isAuthenticated, user, navigate, location.pathname]);

  useEffect(() => {
    if (!isResidentPortal) return undefined;

    fetchLoginCountries()
      .then((data) => {
        const list = data.countries || [];
        setCountries(list);
        setCountry((current) => {
          if (current) return current;
          if (savedCtx?.country && list.includes(savedCtx.country)) return savedCtx.country;
          if (list.includes('Colombia')) return 'Colombia';
          return list[0] || '';
        });
      })
      .catch((err) => setError(err.message));

    return undefined;
  }, [isResidentPortal, savedCtx?.country]);

  useEffect(() => {
    if (!isResidentPortal || !country) return undefined;

    setBuildingsLoading(true);
    fetchLoginBuildings({ country })
      .then((data) => {
        setBuildings(data.buildings || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setBuildingsLoading(false));

    return undefined;
  }, [isResidentPortal, country]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (countryPickerRef.current && !countryPickerRef.current.contains(event.target)) {
        setShowCountryList(false);
      }
      if (buildingPickerRef.current && !buildingPickerRef.current.contains(event.target)) {
        setShowBuildingList(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredBuildings = useMemo(() => {
    const q = buildingQuery.trim().toLowerCase();
    if (!q) return buildings.slice(0, 8);
    return buildings
      .filter((building) => {
        const haystack = [building.name, building.street, building.city, building.state, building.slug]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 8);
  }, [buildings, buildingQuery]);

  function handleCountryChange(nextCountry) {
    setCountry(nextCountry);
    setBuildingQuery('');
    setSelectedBuilding(null);
    setShowBuildingList(false);
    setShowCountryList(false);
  }

  function handleBuildingQueryChange(value) {
    setBuildingQuery(value);
    setSelectedBuilding(null);
    setShowBuildingList(true);
    setShowCountryList(false);
  }

  function selectBuilding(building) {
    setSelectedBuilding(building);
    setBuildingQuery(formatBuildingLoginLabel(building));
    setShowBuildingList(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const formData = new FormData(e.currentTarget);
    const emailValue = String(formData.get('username') || email).trim();
    const passwordValue = String(formData.get('password') || password);
    setEmail(emailValue);
    setPassword(passwordValue);

    if (isResidentPortal && !country) {
      setError('Selecciona tu país');
      return;
    }

    if (isResidentPortal && !selectedBuilding?.id) {
      setError('Selecciona tu conjunto residencial de la lista');
      return;
    }

    setLoading(true);

    try {
      const data = await loginApi(emailValue, passwordValue, portal, {
        buildingId: selectedBuilding?.id,
      });

      if (portal === 'admin' && data.user?.role === 'ORG_ADMIN' && data.building) {
        setActiveTenant({
          organizationId: data.building.organizationId,
          buildingId: data.building.id,
          buildingName: data.building.name,
          organizationName: data.organizationName || '',
        });
      }

      if (isResidentPortal && data.building) {
        setActiveTenant({
          organizationId: data.building.organizationId,
          buildingId: data.building.id,
          buildingName: data.building.name,
        });
        saveResidentLoginContext({
          country,
          buildingId: data.building.id,
          buildingName: data.building.name,
          buildingCity: data.building.city,
          organizationId: data.building.organizationId,
        });
      }

      loginSuccess({
        token: data.token,
        user: data.user,
      });
      navigate(redirectTo || REDIRECTS[portal] || '/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`login${isResidentPortal ? ' login--welcome' : ''}`} key={portal}>
      {showSplash && (
        <div className="login-splash" aria-hidden="true">
          <div className="login-splash__mark">
            <img src="/assets/logo.png" alt="" />
            <span>rentados</span>
          </div>
        </div>
      )}
      {isResidentPortal && (
        <header className="login-welcome__top">
          {isPhoneViewport ? (
            <button
              type="button"
              className="login-welcome__brand login-welcome__brand--secret"
              onClick={goToAdminLogin}
              aria-label="Rentados"
            >
              <img src="/assets/app-icon.jpg" alt="" />
              <span>rentados</span>
            </button>
          ) : (
            <div className="login-welcome__brand">
              <img src="/assets/logo.png" alt="" />
              <span>rentados</span>
            </div>
          )}
          <h1>Bienvenido</h1>
          <p>{config.subtitle}</p>
        </header>
      )}
      {!isResidentPortal && (
      <aside className="login__hero" aria-hidden="true">
        <div className="login__hero-bg" />
        <div className="login__hero-overlay login-animate-in login-animate-in--hero-overlay" />
        <div className="login__hero-content">
          <p className="login__hero-tagline login-animate-in login-animate-in--hero-text">
            {config.heroTagline}
          </p>
        </div>
      </aside>
      )}

      <main className={isResidentPortal ? 'login-welcome__sheet' : 'login__panel login-animate-in login-animate-in--panel'}>
        <div className={isResidentPortal ? 'login-welcome__card' : 'login__card'}>
          {!isResidentPortal && (
          <header className="login__header">
            <div className="login__logo-wrap login-animate-in login-animate-in--1">
              <Logo size="lg" />
            </div>
            <h1 className="login__title login-animate-in login-animate-in--2">{config.title}</h1>
            <p className="login__subtitle login-animate-in login-animate-in--3">{config.subtitle}</p>
          </header>
          )}

          {error && <div className="login__error login-animate-in login-animate-in--4">{error}</div>}

          <form className="login__form" onSubmit={handleSubmit}>
            {isResidentPortal && (
              <>
                <div className="login__field login-animate-in login-animate-in--4">
                  <label id="country-label">País</label>
                  <div
                    className={`login__combo-picker${showCountryList ? ' login__combo-picker--open' : ''}`}
                    ref={countryPickerRef}
                  >
                    <button
                      type="button"
                      id="country"
                      className={`login__combo-trigger${country ? '' : ' login__combo-trigger--placeholder'}`}
                      onClick={() => {
                        setShowCountryList((open) => !open);
                        setShowBuildingList(false);
                      }}
                      aria-haspopup="listbox"
                      aria-expanded={showCountryList}
                      aria-labelledby="country-label"
                    >
                      <span className="login__combo-value">
                        {COUNTRY_FLAGS[country] && <span className="login__flag">{COUNTRY_FLAGS[country]}</span>}
                        <span>{country || 'Seleccionar país'}</span>
                      </span>
                      <span className="login__combo-chevron" aria-hidden="true">
                        <IconChevron />
                      </span>
                    </button>
                    {showCountryList && countries.length > 0 && (
                      <ul className="login__combo-list" role="listbox" aria-label="Países">
                        {countries.map((item) => (
                          <li key={item}>
                            <button
                              type="button"
                              className="login__combo-option"
                              role="option"
                              aria-selected={country === item}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => handleCountryChange(item)}
                            >
                              {item}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="login__field login-animate-in login-animate-in--5">
                  <label htmlFor="building">Conjunto residencial</label>
                  <div
                    className={`login__combo-picker${showBuildingList ? ' login__combo-picker--open' : ''}`}
                    ref={buildingPickerRef}
                  >
                    <div className="login__icon-field">
                      <FieldIcon>
                        <IconBuilding />
                      </FieldIcon>
                      <input
                        id="building"
                        type="search"
                        value={buildingQuery}
                        onChange={(e) => handleBuildingQueryChange(e.target.value)}
                        onFocus={() => {
                          setShowBuildingList(true);
                          setShowCountryList(false);
                        }}
                        placeholder="Escribe el nombre, ciudad o dirección"
                        autoComplete="off"
                        required
                        disabled={!country || buildingsLoading}
                      />
                    </div>
                    {selectedBuilding && (
                      <p className="login__building-selected">
                        {formatBuildingLoginLabel(selectedBuilding)}
                      </p>
                    )}
                    {showBuildingList && country && !buildingsLoading && filteredBuildings.length > 0 && (
                      <ul className="login__combo-list" role="listbox" aria-label="Conjuntos">
                        {filteredBuildings.map((building) => (
                          <li key={building.id}>
                            <button
                              type="button"
                              className="login__combo-option"
                              role="option"
                              aria-selected={selectedBuilding?.id === building.id}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => selectBuilding(building)}
                            >
                              <span className="login__combo-option-name">{building.name}</span>
                              <span className="login__combo-option-meta">
                                {formatBuildingAddressLine(building) || building.city || 'Sin dirección'}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {showBuildingList && country && !buildingsLoading && buildingQuery.trim() && filteredBuildings.length === 0 && (
                      <p className="login__building-empty">No hay conjuntos con ese nombre.</p>
                    )}
                  </div>
                </div>
              </>
            )}

            <div className="login__field login-animate-in login-animate-in--4">
              <label htmlFor="email">Usuario o correo</label>
              <div className="login__icon-field">
                {isResidentPortal && (
                  <FieldIcon>
                    <IconMail />
                  </FieldIcon>
                )}
                <input
                  id="email"
                  type="text"
                  name="username"
                  autoComplete="username"
                  inputMode="email"
                  placeholder={isResidentPortal ? 'Tu correo o usuario' : '41201 o tu@correo.com'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onInput={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="login__field login-animate-in login-animate-in--5">
              <label htmlFor="password">Contraseña</label>
              <div className="login__password-wrap login__icon-field">
                {isResidentPortal && (
                  <FieldIcon>
                    <IconLock />
                  </FieldIcon>
                )}
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  placeholder={isResidentPortal ? 'Tu contraseña' : '••••••••'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onInput={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="login__toggle-password"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {isResidentPortal ? <IconEye off={showPassword} /> : showPassword ? 'Ocultar' : 'Ver'}
                </button>
              </div>
            </div>

            <div className="login__actions-row login-animate-in login-animate-in--6">
              <label className="login__remember">
                <input type="checkbox" name="remember" defaultChecked />
                <span>Mantener sesión iniciada</span>
              </label>
              <a href="#" className="login__link">
                ¿Olvidaste tu contraseña?
              </a>
            </div>

            <button type="submit" className="login__submit login-animate-in login-animate-in--7" disabled={loading}>
              {loading ? 'Ingresando…' : config.submitLabel}
              {!loading && isResidentPortal && <span className="login__submit-arrow" aria-hidden="true">→</span>}
            </button>
          </form>

          {isResidentPortal ? (
            <>
              {location.state?.accountDeleted && (
                <p className="login-welcome__deleted">Tu cuenta fue eliminada.</p>
              )}
              <p className="login-welcome__code">Accede con tu código de apto</p>
              <nav className="login-welcome__legal" aria-label="Información de Rentados">
                <Link to="/privacidad">Privacidad</Link>
                <Link to="/soporte">Soporte</Link>
                <Link to="/marketing">Rentados</Link>
              </nav>
            </>
          ) : (
          <nav
            className={`login__portal-nav login-animate-in login-animate-in--8${
              isPhoneViewport && isStaffPortal ? ' login__portal-nav--phone-staff' : ''
            }`}
            aria-label="Otros portales"
          >
            <p className="login__portal-nav-label">
              {isPhoneViewport && portal === 'admin'
                ? 'Cambiar portal'
                : config.switchPrompt}
            </p>
            <div className="login__portal-nav-links">
              {portalSwitchLinks.map((link, index) => (
                <span key={link.to}>
                  {index > 0 && <span className="login__portal-nav-sep">·</span>}
                  <Link to={link.to} className="login__portal-nav-link">
                    {link.label}
                  </Link>
                </span>
              ))}
            </div>
          </nav>
          )}

          {!isResidentPortal && (
          <footer className="login__footer login-animate-in login-animate-in--9">
            <p>
              ¿Necesitas ayuda?{' '}
              <a href="mailto:soporte@rentados.co" className="login__link">
                Contáctanos
              </a>
            </p>
          </footer>
          )}
        </div>
      </main>
    </div>
  );
}
