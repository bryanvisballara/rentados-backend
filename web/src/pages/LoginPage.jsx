import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { LOGIN_PORTALS } from '../config/loginPortals';
import { useAuth } from '../context/AuthContext';
import { fetchLoginBuildings, fetchLoginCountries, login as loginApi } from '../api/client';
import { setActiveTenant } from '../api/tenantContext';
import { formatBuildingAddressLine, formatBuildingLoginLabel } from '../utils/buildingAddress';
import './LoginPage.css';

const REDIRECTS = {
  resident: '/app',
  admin: '/admin',
  superadmin: '/super-admin',
  provider: '/provider',
  porteria: '/porteria',
};

const RESIDENT_LOGIN_CTX_KEY = 'rentados_resident_login_ctx';

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

export default function LoginPage({ portal = 'resident', redirectTo }) {
  const config = LOGIN_PORTALS[portal] ?? LOGIN_PORTALS.resident;
  const isResidentPortal = portal === 'resident';
  const savedCtx = isResidentPortal ? loadResidentLoginContext() : null;

  const { loginSuccess } = useAuth();
  const navigate = useNavigate();

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
  const countryPickerRef = useRef(null);
  const buildingPickerRef = useRef(null);

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
      const data = await loginApi(email, password, portal, {
        buildingId: selectedBuilding?.id,
      });

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
    <div className="login" key={portal}>
      <aside className="login__hero" aria-hidden="true">
        <div className="login__hero-bg" />
        <div className="login__hero-overlay login-animate-in login-animate-in--hero-overlay" />
        <div className="login__hero-content">
          <p className="login__hero-tagline login-animate-in login-animate-in--hero-text">
            {config.heroTagline}
          </p>
        </div>
      </aside>

      <main className="login__panel login-animate-in login-animate-in--panel">
        <div className="login__card">
          <header className="login__header">
            <div className="login__logo-wrap login-animate-in login-animate-in--1">
              <Logo size="lg" />
            </div>
            <h1 className="login__title login-animate-in login-animate-in--2">{config.title}</h1>
            <p className="login__subtitle login-animate-in login-animate-in--3">{config.subtitle}</p>
          </header>

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
                      <span>{country || 'Seleccionar país'}</span>
                      <span className="login__combo-chevron" aria-hidden="true">
                        ▾
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
                    <input
                      id="building"
                      type="search"
                      value={buildingQuery}
                      onChange={(e) => handleBuildingQueryChange(e.target.value)}
                      onFocus={() => {
                        setShowBuildingList(true);
                        setShowCountryList(false);
                      }}
                      placeholder="Escribe nombre, ciudad o dirección"
                      autoComplete="off"
                      required
                      disabled={!country || buildingsLoading}
                    />
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
              <input
                id="email"
                type="text"
                name="username"
                autoComplete="username"
                inputMode="email"
                placeholder="41201 o tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="login__field login-animate-in login-animate-in--5">
              <label htmlFor="password">Contraseña</label>
              <div className="login__password-wrap">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="login__toggle-password"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? 'Ocultar' : 'Ver'}
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
            </button>
          </form>

          <nav className="login__portal-nav login-animate-in login-animate-in--8" aria-label="Otros portales">
            <p className="login__portal-nav-label">{config.switchPrompt}</p>
            <div className="login__portal-nav-links">
              {config.switchLinks.map((link, index) => (
                <span key={link.to}>
                  {index > 0 && <span className="login__portal-nav-sep">·</span>}
                  <Link to={link.to} className="login__portal-nav-link">
                    {link.label}
                  </Link>
                </span>
              ))}
            </div>
          </nav>

          <footer className="login__footer login-animate-in login-animate-in--9">
            <p>
              ¿Necesitas ayuda?{' '}
              <a href="mailto:soporte@rentados.co" className="login__link">
                Contáctanos
              </a>
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}
