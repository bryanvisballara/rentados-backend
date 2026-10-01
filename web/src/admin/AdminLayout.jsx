import { useEffect, useMemo, useState } from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import PortalShell from '../components/PortalShell';
import { useAuth } from '../context/AuthContext';
import { adminApi } from '../api/client';
import { clearActiveTenant, getActiveTenant, setActiveTenant } from '../api/tenantContext';
import { ADMIN_NAV } from './adminNav';
import './AdminLayout.css';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const tenant = getActiveTenant();
  const [portal, setPortal] = useState(null);
  const [activeBuildingId, setActiveBuildingId] = useState(tenant?.buildingId || '');

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

  useEffect(() => {
    if (user?.role !== 'ORG_ADMIN') return undefined;
    let cancelled = false;
    adminApi
      .context()
      .then((ctx) => {
        if (cancelled) return;
        setPortal(ctx);
        const saved = getActiveTenant();
        const match = (ctx.buildings || []).find(
          (building) => String(building.id) === String(saved?.buildingId)
        );
        const active = ctx.scope === 'building' ? ctx.buildings?.[0] : match || ctx.buildings?.[0];
        if (!active) return;
        setActiveTenant({
          organizationId: active.organizationId,
          buildingId: active.id,
          buildingName: active.name,
          organizationName: ctx.organization?.name || '',
        });
        setActiveBuildingId(String(active.id));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.role]);

  function changeConjunto() {
    clearActiveTenant();
    navigate('/super-admin');
  }

  function switchBuilding(buildingId) {
    const building = (portal?.buildings || []).find((item) => String(item.id) === String(buildingId));
    if (!building) return;
    setActiveTenant({
      organizationId: building.organizationId,
      buildingId: building.id,
      buildingName: building.name,
      organizationName: portal?.organization?.name || '',
    });
    setActiveBuildingId(String(building.id));
  }

  const navItems = useMemo(() => {
    return portal?.scope === 'company'
      ? [ADMIN_NAV[0], { to: '/admin/conjuntos', label: 'Conjuntos' }, ...ADMIN_NAV.slice(1)]
      : ADMIN_NAV;
  }, [portal?.scope]);

  if (user?.role === 'SUPER_ADMIN' && !tenant?.organizationId) {
    return <Navigate to="/super-admin" replace />;
  }

  return (
    <PortalShell
      variant="admin"
      brandSubtitle="Panel administrativo"
      navItems={navItems}
      user={user}
      onLogout={handleLogout}
    >
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
      {user?.role === 'ORG_ADMIN' && portal?.building && (
        <div className="admin-tenant-banner">
          <div>
            <span>{portal.organization?.name}</span>
            {portal.scope === 'company' && (portal.buildings || []).length > 0 ? (
              <label className="admin-tenant-banner__switch">
                Conjunto
                <select value={activeBuildingId} onChange={(event) => switchBuilding(event.target.value)}>
                  {(portal.buildings || []).map((building) => (
                    <option key={building.id} value={String(building.id)}>
                      {building.name}
                      {building.city ? ` · ${building.city}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <strong>{portal.buildings?.[0]?.name || portal.building.name}</strong>
            )}
          </div>
        </div>
      )}
      <Outlet key={activeBuildingId || 'conjunto'} />
    </PortalShell>
  );
}
