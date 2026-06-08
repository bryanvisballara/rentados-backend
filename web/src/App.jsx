import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './admin/AdminLayout';
import SuperAdminLayout from './superadmin/SuperAdminLayout';
import SuperAdminDashboardPage from './superadmin/pages/DashboardPage';
import ConjuntosPage from './superadmin/pages/ConjuntosPage';
import ConjuntoAppAdoptionPage from './superadmin/pages/ConjuntoAppAdoptionPage';
import ProviderApplicationsPage from './superadmin/pages/ProviderApplicationsPage';
import ProvidersPage from './superadmin/pages/ProvidersPage';
import PlatformServicesPage from './superadmin/pages/PlatformServicesPage';
import PlatformPublicationsPage from './superadmin/pages/PlatformPublicationsPage';
import ShopPage from './superadmin/pages/ShopPage';
import ShopOrdersPage from './superadmin/pages/ShopOrdersPage';
import RestaurantsPage from './superadmin/pages/RestaurantsPage';
import RestaurantMenuPage from './superadmin/pages/RestaurantMenuPage';
import RestaurantOrdersPage from './superadmin/pages/RestaurantOrdersPage';
import ProviderLayout from './provider/ProviderLayout';
import ProviderHomePage from './provider/pages/ProviderHomePage';
import ProviderRegisterPage from './provider/pages/ProviderRegisterPage';
import DashboardPage from './admin/pages/DashboardPage';
import TowersPage from './admin/pages/TowersPage';
import FacilitiesPage from './admin/pages/FacilitiesPage';
import FacilityBookingsPage from './admin/pages/FacilityBookingsPage';
import PublicationsPage from './admin/pages/PublicationsPage';
import PorteriaPage from './admin/pages/PorteriaPage';
import VisitorParkingPage from './admin/pages/VisitorParkingPage';
import CarteraPage from './admin/pages/CarteraPage';
import CarteraDetailPage from './admin/pages/CarteraDetailPage';
import MorosidadPage from './admin/pages/MorosidadPage';
import ResidentHomePage from './resident/ResidentHomePage';
import ResidentAssignPage from './admin/pages/ResidentAssignPage';
import ResidentsPage from './admin/pages/ResidentsPage';
import ResidentDetailPage from './admin/pages/ResidentDetailPage';
import PorteriaLoginPage from './porteria/PorteriaLoginPage';
import PorteriaLayout from './porteria/PorteriaLayout';
import RegisterPackagePage from './porteria/pages/RegisterPackagePage';
import ParkingPage from './porteria/pages/ParkingPage';
import BitacoraPage from './porteria/pages/BitacoraPage';
import CasilleroPage from './porteria/pages/CasilleroPage';
import NotificationsPage from './porteria/pages/NotificationsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage portal="resident" />} />
      <Route path="/admin/login" element={<LoginPage portal="admin" />} />
      <Route path="/super-admin/login" element={<LoginPage portal="superadmin" />} />
      <Route path="/provider/login" element={<LoginPage portal="provider" />} />
      <Route path="/porteria/login" element={<PorteriaLoginPage />} />

      <Route path="/provider/register" element={<ProviderRegisterPage />} />

      <Route
        path="/super-admin"
        element={
          <ProtectedRoute roles={['SUPER_ADMIN']} loginPath="/super-admin/login">
            <SuperAdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<SuperAdminDashboardPage />} />
        <Route path="conjuntos" element={<ConjuntosPage />} />
        <Route path="conjuntos/:buildingId/adopcion" element={<ConjuntoAppAdoptionPage />} />
        <Route path="solicitudes-prestadores" element={<ProviderApplicationsPage />} />
        <Route path="prestadores" element={<ProvidersPage />} />
        <Route path="servicios" element={<PlatformServicesPage />} />
        <Route path="publicaciones" element={<PlatformPublicationsPage />} />
        <Route path="shop" element={<ShopPage />} />
        <Route path="shop-pedidos" element={<ShopOrdersPage />} />
        <Route path="restaurantes" element={<RestaurantsPage />} />
        <Route path="restaurantes/:restaurantId/menu" element={<RestaurantMenuPage />} />
        <Route path="restaurantes-pedidos" element={<RestaurantOrdersPage />} />
      </Route>

      <Route
        path="/provider"
        element={
          <ProtectedRoute roles={['PROVIDER']} loginPath="/provider/login">
            <ProviderLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ProviderHomePage />} />
      </Route>

      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={['ORG_ADMIN', 'SUPER_ADMIN']} loginPath="/admin/login">
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="torres" element={<TowersPage />} />
        <Route path="asignacion" element={<ResidentAssignPage />} />
        <Route path="servicios" element={<FacilitiesPage />} />
        <Route path="servicios/reservas" element={<FacilityBookingsPage />} />
        <Route path="publicaciones" element={<PublicationsPage />} />
        <Route path="porteria" element={<PorteriaPage />} />
        <Route path="parqueaderos" element={<VisitorParkingPage />} />
        <Route path="cartera" element={<CarteraPage />} />
        <Route path="cartera/:view" element={<CarteraDetailPage />} />
        <Route path="morosidad" element={<MorosidadPage />} />
        <Route path="residentes" element={<ResidentsPage />} />
        <Route path="residentes/:id" element={<ResidentDetailPage />} />
      </Route>

      <Route
        path="/porteria"
        element={
          <ProtectedRoute roles={['ORG_STAFF']} loginPath="/porteria/login">
            <PorteriaLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="registrar-paquete" replace />} />
        <Route path="registrar-paquete" element={<RegisterPackagePage />} />
        <Route path="parqueadero" element={<ParkingPage />} />
        <Route path="bitacora" element={<BitacoraPage />} />
        <Route path="casillero" element={<CasilleroPage />} />
        <Route path="notificaciones" element={<NotificationsPage />} />
      </Route>

      <Route
        path="/app"
        element={
          <ProtectedRoute roles={['RESIDENT']} loginPath="/login">
            <ResidentHomePage />
          </ProtectedRoute>
        }
      />

      <Route path="/" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
