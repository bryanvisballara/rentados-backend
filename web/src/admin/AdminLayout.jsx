import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { useAuth } from '../context/AuthContext';
import { clearActiveTenant, getActiveTenant } from '../api/tenantContext';
import { ADMIN_NAV } from './adminNav';
import './AdminLayout.css';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const tenant = getActiveTenant();

  if (user?.role === 'SUPER_ADMIN' && !tenant?.organizationId) {
    return <Navigate to="/super-admin" replace />;
  }

  function handleLogout() {
    if (user?.role === 'SUPER_ADMIN') {
      clearActiveTenant();
      logout();
      navigate('/super-admin/login');
      return;
    }
    logout();
    navigate('/admin/login');
  }

  function changeConjunto() {
    clearActiveTenant();
    navigate('/super-admin');
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar__brand">
          <Logo size="sm" />
          <div>
            <p className="admin-sidebar__title">Rentados</p>
            <p className="admin-sidebar__subtitle">Panel administrativo</p>
          </div>
        </div>

        <nav className="admin-sidebar__nav">
          {ADMIN_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `admin-sidebar__link${isActive ? ' admin-sidebar__link--active' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar__footer">
          <p className="admin-sidebar__user">
            {user?.firstName} {user?.lastName}
          </p>
          <button type="button" className="admin-sidebar__logout" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="admin-main">
        {user?.role === 'SUPER_ADMIN' && tenant && (
          <div className="admin-tenant-banner">
            <div>
              <strong>{tenant.buildingName}</strong>
              <span> · {tenant.organizationName}</span>
            </div>
            <button type="button" className="admin-btn admin-btn--ghost" onClick={changeConjunto}>
              Cambiar conjunto
            </button>
          </div>
        )}
        <Outlet />
      </div>
    </div>
  );
}
