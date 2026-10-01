import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { residentApi } from '../api/client';
import { registerResidentPush } from './registerPush';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  IconBag,
  IconBuilding,
  IconGrid,
  IconHome,
  IconUtensils,
  IconUsers,
} from './components/ResidentIcons';
import { ResidentRefreshRoot } from './ResidentRefresh';
import './ResidentLayout.css';
import './ResidentHomePage.css';

const OverlayHostContext = createContext(null);

export function ResidentOverlay({ children }) {
  const host = useContext(OverlayHostContext);
  if (!host) return children;
  return createPortal(children, host);
}

const NAV = [
  { to: '/app', label: 'Inicio', end: true, Icon: IconHome },
  { to: '/app/administracion', label: 'Admin', section: 'administracion', Icon: IconBuilding },
  { to: '/app/servicios-publicos', label: 'Facturas', section: 'facturas', Icon: IconGrid },
  { to: '/app/prestadores', label: 'Servicios', section: 'servicios', Icon: IconUsers },
  { to: '/app/shop', label: 'Shop', section: 'shop', Icon: IconBag },
  { to: '/app/restaurantes', label: 'Restaurantes', section: 'restaurantes', Icon: IconUtensils },
];

const SECTION_ROUTES = [
  ['/app/administracion', 'administracion'],
  ['/app/servicios-publicos', 'facturas'],
  ['/app/prestadores', 'servicios'],
  ['/app/shop', 'shop'],
  ['/app/restaurantes', 'restaurantes'],
  ['/app/servicios-conjunto', 'reservas'],
];

const FALLBACK_SECTIONS = {
  administracion: true,
  facturas: true,
  servicios: false,
  shop: true,
  restaurantes: false,
  reservas: true,
  publicaciones: true,
  casillero: true,
  visitantes: true,
  sos: true,
};

const SOS_CONTACTS = [
  {
    id: 'policia',
    icon: '🚓',
    label: 'Policía Nacional',
    phone: '123',
    when: 'Robos, agresiones, violencia, accidentes, emergencias de seguridad.',
  },
  {
    id: 'bomberos',
    icon: '🚒',
    label: 'Cuerpo Oficial de Bomberos',
    phone: '119',
    when: 'Incendios, fugas de gas, rescates y personas atrapadas.',
  },
  {
    id: 'cruz-roja',
    icon: '🚑',
    label: 'Cruz Roja / Ambulancias',
    phone: '132',
    when: 'Emergencias médicas y solicitud de ambulancia.',
  },
  {
    id: 'defensa-civil',
    icon: '🛡️',
    label: 'Defensa Civil',
    phone: '144',
    when: 'Inundaciones, desastres naturales, rescates y apoyo en emergencias.',
  },
  {
    id: 'icbf',
    icon: '👶',
    label: 'ICBF',
    phone: '141',
    when: 'Protección de niños, niñas y adolescentes.',
  },
];

export default function ResidentLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sosOpen, setSosOpen] = useState(false);
  const [overlayHost, setOverlayHost] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [sections, setSections] = useState(FALLBACK_SECTIONS);
  const mainRef = useRef(null);

  const reloadSections = useCallback(
    () =>
      residentApi
        .appSections()
        .then((data) => setSections({ ...FALLBACK_SECTIONS, ...(data.sections || {}) }))
        .catch(() => {}),
    []
  );

  useEffect(() => {
    registerResidentPush(residentApi);
  }, []);

  useEffect(() => {
    reloadSections();
  }, [reloadSections]);

  function sectionEnabled(key) {
    return sections[key] !== false;
  }

  const visibleNav = NAV.filter((item) => !item.section || sectionEnabled(item.section));
  const blockedSection = SECTION_ROUTES.some(
    ([path, key]) =>
      (location.pathname === path || location.pathname.startsWith(`${path}/`)) &&
      !sectionEnabled(key)
  );

  useEffect(() => {
    if (!sosOpen) return undefined;
    function onKeyDown(event) {
      if (event.key === 'Escape') setSosOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [sosOpen]);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  function closeSos() {
    if (deletingAccount) return;
    setSosOpen(false);
    setDeleteOpen(false);
    setDeleteError('');
  }

  async function confirmDeleteAccount() {
    setDeletingAccount(true);
    setDeleteError('');
    try {
      await residentApi.deleteAccount();
      logout();
      navigate('/login', { replace: true, state: { accountDeleted: true } });
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeletingAccount(false);
    }
  }

  return (
    <OverlayHostContext.Provider value={overlayHost}>
    <div className="resident-app">
      <div className="resident-app__frame">
        <main ref={mainRef} className="resident-app__main">
          <ResidentRefreshRoot scrollElRef={mainRef} onGlobalRefresh={reloadSections}>
            {blockedSection ? (
              <Navigate to="/app" replace />
            ) : (
              <div key={location.pathname} className="resident-page-enter">
                <Outlet context={{ onLogout: handleLogout, sectionEnabled }} />
              </div>
            )}
          </ResidentRefreshRoot>
        </main>

        <nav
          className="resident-app__nav"
          aria-label="Navegación principal"
          style={{ gridTemplateColumns: `repeat(${visibleNav.length}, minmax(0, 1fr))` }}
        >
          {visibleNav.map(({ to, label, end, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `resident-app__nav-item${isActive ? ' resident-app__nav-item--active' : ''}`
              }
            >
              <Icon width={20} height={20} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {sectionEnabled('sos') && (
          <button
            type="button"
            className="resident-sos-fab"
            onClick={() => {
              setDeleteOpen(false);
              setDeleteError('');
              setSosOpen(true);
            }}
            aria-label="Emergencia SOS"
          >
            SOS
          </button>
        )}

        {sosOpen && sectionEnabled('sos') && (
          <div className="resident-sos" role="dialog" aria-modal="true" aria-labelledby="resident-sos-title">
            <button
              type="button"
              className="resident-sos__backdrop"
              aria-label="Cerrar emergencias"
              onClick={closeSos}
            />
            <div className="resident-sos__sheet">
              <header className="resident-sos__header">
                <div>
                  <p className="resident-sos__eyebrow">Emergencia</p>
                  <h2 id="resident-sos-title">¿A quién quieres llamar?</h2>
                </div>
                <button type="button" className="resident-sos__close" onClick={closeSos}>
                  Cerrar
                </button>
              </header>
              <ul className="resident-sos__list">
                {SOS_CONTACTS.map((contact) => (
                  <li key={contact.id}>
                    <a
                      href={`tel:${contact.phone}`}
                      className="resident-sos__item"
                      onClick={() => setSosOpen(false)}
                    >
                      <span className="resident-sos__icon" aria-hidden="true">
                        {contact.icon}
                      </span>
                      <span className="resident-sos__body">
                        <span className="resident-sos__label">{contact.label}</span>
                        <span className="resident-sos__when">{contact.when}</span>
                      </span>
                      <span className="resident-sos__phone">{contact.phone}</span>
                    </a>
                  </li>
                ))}
              </ul>
              <div className="resident-sos__account">
                {deleteOpen ? (
                  <>
                    <p>Se borra tu usuario, tu sesión y las tarjetas guardadas.</p>
                    {deleteError && <p className="resident-sos__account-error">{deleteError}</p>}
                    <button
                      type="button"
                      className="resident-sos__delete"
                      disabled={deletingAccount}
                      onClick={confirmDeleteAccount}
                    >
                      {deletingAccount ? 'Eliminando…' : 'Sí, eliminar mi cuenta'}
                    </button>
                    <button
                      type="button"
                      className="resident-sos__delete"
                      disabled={deletingAccount}
                      onClick={() => setDeleteOpen(false)}
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button type="button" className="resident-sos__delete" onClick={() => setDeleteOpen(true)}>
                    Eliminar cuenta
                  </button>
                )}
                <p>
                  <Link to="/privacidad">Privacidad</Link>
                  {' · '}
                  <Link to="/soporte">Soporte</Link>
                </p>
              </div>
            </div>
          </div>
        )}
        <div ref={setOverlayHost} className="resident-app__overlay-root" />
      </div>
    </div>
    </OverlayHostContext.Provider>
  );
}
