import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { useAuth } from '../context/AuthContext';
import './ProviderLayout.css';

const NAV = [{ to: '/provider', label: 'Inicio', end: true }];

export default function ProviderLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/provider/login');
  }

  return (
    <div className="provider-shell">
      <aside className="provider-sidebar">
        <div>
          <Logo size="sm" />
          <p className="provider-sidebar__title">Portal prestadores</p>
        </div>
        <nav className="provider-sidebar__nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `provider-sidebar__link${isActive ? ' provider-sidebar__link--active' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="provider-sidebar__footer">
          <p className="provider-sidebar__user">
            {user?.firstName} {user?.lastName}
          </p>
          <button type="button" className="provider-sidebar__logout" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </aside>
      <div className="provider-main">
        <Outlet />
      </div>
    </div>
  );
}
