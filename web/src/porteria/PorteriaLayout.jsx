import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import PortalShell from '../components/PortalShell';
import { porteriaApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PORTERIA_NAV } from './porteriaNav';
import { registerPorteriaPush } from './registerPush';
import './PorteriaHomePage.css';
import './PorteriaLayout.css';

export default function PorteriaLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    registerPorteriaPush(porteriaApi);
  }, []);

  function handleLogout() {
    logout();
    navigate('/porteria/login');
  }

  return (
    <PortalShell
      variant="porteria"
      brandSubtitle="Portal de portería"
      navItems={PORTERIA_NAV}
      user={user}
      onLogout={handleLogout}
    >
      <Outlet />
    </PortalShell>
  );
}
