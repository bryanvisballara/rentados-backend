import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { useAuth } from '../context/AuthContext';
import { PORTERIA_NAV } from './porteriaNav';
import './PorteriaHomePage.css';
import './PorteriaLayout.css';

export default function PorteriaLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/porteria/login');
  }

  return (
    <div className="porteria-shell">
      <aside className="porteria-sidebar">
        <div className="porteria-sidebar__brand">
          <Logo size="sm" />
          <div>
            <p className="porteria-sidebar__title">Rentados</p>
            <p className="porteria-sidebar__subtitle">Portal de portería</p>
          </div>
        </div>

        <nav className="porteria-sidebar__nav">
          {PORTERIA_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `porteria-sidebar__link${isActive ? ' porteria-sidebar__link--active' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="porteria-sidebar__footer">
          <p className="porteria-sidebar__user">
            {user?.firstName} {user?.lastName}
          </p>
          <button type="button" className="porteria-sidebar__logout" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="porteria-main">
        <Outlet />
      </main>
    </div>
  );
}
