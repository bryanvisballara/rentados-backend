import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
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
import './ResidentLayout.css';
import './ResidentHomePage.css';

const NAV = [
  { to: '/app', label: 'Inicio', end: true, Icon: IconHome },
  { to: '/app/administracion', label: 'Admin', Icon: IconBuilding },
  { to: '/app/servicios-publicos', label: 'Facturas', Icon: IconGrid },
  { to: '/app/prestadores', label: 'Prestadores', Icon: IconUsers },
  { to: '/app/shop', label: 'Shop', Icon: IconBag },
  { to: '/app/restaurantes', label: 'Restaurantes', Icon: IconUtensils },
];

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
  const [sosOpen, setSosOpen] = useState(false);

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

  return (
    <div className="resident-app">
      <div className="resident-app__frame">
        <main className="resident-app__main">
          <Outlet context={{ onLogout: handleLogout }} />
        </main>

        <button
          type="button"
          className="resident-sos-fab"
          onClick={() => setSosOpen(true)}
          aria-label="Emergencia SOS"
        >
          SOS
        </button>

        <nav className="resident-app__nav" aria-label="Navegación principal">
          {NAV.map(({ to, label, end, Icon }) => (
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

        {sosOpen && (
          <div className="resident-sos" role="dialog" aria-modal="true" aria-labelledby="resident-sos-title">
            <button
              type="button"
              className="resident-sos__backdrop"
              aria-label="Cerrar emergencias"
              onClick={() => setSosOpen(false)}
            />
            <div className="resident-sos__sheet">
              <header className="resident-sos__header">
                <div>
                  <p className="resident-sos__eyebrow">Emergencia</p>
                  <h2 id="resident-sos-title">¿A quién quieres llamar?</h2>
                </div>
                <button type="button" className="resident-sos__close" onClick={() => setSosOpen(false)}>
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
