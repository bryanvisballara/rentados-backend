import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { useAuth } from '../context/AuthContext';
import { clearActiveTenant } from '../api/tenantContext';
import { SUPER_ADMIN_NAV } from './superAdminNav';
import './SuperAdminLayout.css';

export default function SuperAdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    clearActiveTenant();
    logout();
    navigate('/super-admin/login');
  }

  return (
    <div className="superadmin-shell">
      <aside className="superadmin-sidebar">
        <div>
          <Logo size="sm" />
          <p className="superadmin-sidebar__title">Rentados Platform</p>
          <p className="superadmin-sidebar__subtitle">Super administración</p>
        </div>

        <nav className="superadmin-sidebar__nav">
          {SUPER_ADMIN_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `superadmin-sidebar__link${isActive ? ' superadmin-sidebar__link--active' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="superadmin-sidebar__footer">
          <p className="superadmin-sidebar__user">
            {user?.firstName} {user?.lastName}
          </p>
          <button type="button" className="superadmin-sidebar__logout" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="superadmin-main">
        <Outlet />
      </div>
    </div>
  );
}
