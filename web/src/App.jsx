import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import LegalPage from './pages/LegalPage';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './admin/AdminLayout';
import SuperAdminLayout from './superadmin/SuperAdminLayout';
import SuperAdminDashboardPage from './superadmin/pages/DashboardPage';
import ResidentAppSectionsPage from './superadmin/pages/ResidentAppSectionsPage';
import ConjuntosPage from './superadmin/pages/ConjuntosPage';
import ConjuntoAppAdoptionPage from './superadmin/pages/ConjuntoAppAdoptionPage';
import RentadosHomeServicesPage from './superadmin/pages/RentadosHomeServicesPage';
import RentadosHomeServiceDetailPage from './superadmin/pages/RentadosHomeServiceDetailPage';
import UtilityProvidersPage from './superadmin/pages/UtilityProvidersPage';
import PlatformPublicationsPage from './superadmin/pages/PlatformPublicationsPage';
import ShopPage from './superadmin/pages/ShopPage';
import ShopOrdersPage from './superadmin/pages/ShopOrdersPage';
import RestaurantsPage from './superadmin/pages/RestaurantsPage';
import RestaurantMenuPage from './superadmin/pages/RestaurantMenuPage';
import RestaurantOrdersPage from './superadmin/pages/RestaurantOrdersPage';
import DashboardPage from './admin/pages/DashboardPage';
import AdminBuildingsPage from './admin/pages/AdminBuildingsPage';
import TowersPage from './admin/pages/TowersPage';
import FacilitiesPage from './admin/pages/FacilitiesPage';
import FacilityBookingsPage from './admin/pages/FacilityBookingsPage';
import PublicationsPage from './admin/pages/PublicationsPage';
import PorteriaPage from './admin/pages/PorteriaPage';
import VisitorParkingPage from './admin/pages/VisitorParkingPage';
import AdminPaymentsPage from './admin/pages/AdminPaymentsPage';
import CarteraPage from './admin/pages/CarteraPage';
import AccountingPage from './admin/pages/AccountingPage';
import CarteraDetailPage from './admin/pages/CarteraDetailPage';
import MorosidadPage from './admin/pages/MorosidadPage';
import ResidentHomePage from './resident/ResidentHomePage';
import ResidentLayout from './resident/ResidentLayout';
import ResidentAdministrationPage from './resident/ResidentAdministrationPage';
import ResidentPublicServicesPage from './resident/ResidentPublicServicesPage';
import ResidentProvidersPage from './resident/ResidentProvidersPage';
import ResidentRestaurantsPage from './resident/ResidentRestaurantsPage';
import ResidentShopPage from './resident/ResidentShopPage';
import ResidentFacilitiesPage from './resident/ResidentFacilitiesPage';
import ResidentAssignPage from './admin/pages/ResidentAssignPage';
import ResidentsPage from './admin/pages/ResidentsPage';
import ResidentDetailPage from './admin/pages/ResidentDetailPage';
import PorteriaLoginPage from './porteria/PorteriaLoginPage';
import PorteriaLayout from './porteria/PorteriaLayout';
import ParkingPage from './porteria/pages/ParkingPage';
import CasilleroPage from './porteria/pages/CasilleroPage';
import VisitantesPage from './porteria/pages/VisitantesPage';
import NotificationsPage from './porteria/pages/NotificationsPage';
import ReservasPage from './porteria/pages/ReservasPage';

export default function App() {
  return (
    <Routes>
      <Route path="/privacidad" element={<LegalPage page="privacidad" />} />
      <Route path="/soporte" element={<LegalPage page="soporte" />} />
      <Route path="/marketing" element={<LegalPage page="marketing" />} />
      <Route path="/login" element={<LoginPage portal="resident" />} />
      <Route path="/admin/login" element={<LoginPage portal="admin" />} />
      <Route path="/super-admin/login" element={<LoginPage portal="superadmin" />} />
      <Route path="/porteria/login" element={<PorteriaLoginPage />} />

      <Route path="/provider/login" element={<Navigate to="/login" replace />} />
      <Route path="/provider/register" element={<Navigate to="/login" replace />} />
      <Route path="/provider/*" element={<Navigate to="/login" replace />} />

      <Route
        path="/super-admin"
        element={
          <ProtectedRoute roles={['SUPER_ADMIN']} loginPath="/super-admin/login">
            <SuperAdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<SuperAdminDashboardPage />} />
        <Route path="app-residente" element={<ResidentAppSectionsPage />} />
        <Route path="conjuntos" element={<ConjuntosPage />} />
        <Route path="conjuntos/:buildingId/adopcion" element={<ConjuntoAppAdoptionPage />} />
        <Route path="servicios-rentados" element={<RentadosHomeServicesPage />} />
        <Route path="servicios-rentados/:serviceId" element={<RentadosHomeServiceDetailPage />} />
        <Route path="servicios" element={<Navigate to="/super-admin/servicios-rentados" replace />} />
        <Route path="solicitudes-prestadores" element={<Navigate to="/super-admin/servicios-rentados" replace />} />
        <Route path="cronograma-prestadores" element={<Navigate to="/super-admin/servicios-rentados" replace />} />
        <Route path="prestadores" element={<Navigate to="/super-admin/servicios-rentados" replace />} />
        <Route path="servicios-publicos" element={<UtilityProvidersPage />} />
        <Route path="publicaciones" element={<PlatformPublicationsPage />} />
        <Route path="shop" element={<ShopPage />} />
        <Route path="shop-pedidos" element={<ShopOrdersPage />} />
        <Route path="restaurantes" element={<RestaurantsPage />} />
        <Route path="restaurantes/:restaurantId/menu" element={<RestaurantMenuPage />} />
        <Route path="restaurantes-pedidos" element={<RestaurantOrdersPage />} />
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
        <Route path="conjuntos" element={<AdminBuildingsPage />} />
        <Route path="torres" element={<TowersPage />} />
        <Route path="asignacion" element={<ResidentAssignPage />} />
        <Route path="servicios" element={<FacilitiesPage />} />
        <Route path="servicios/reservas" element={<FacilityBookingsPage />} />
        <Route path="publicaciones" element={<PublicationsPage />} />
        <Route path="porteria" element={<PorteriaPage />} />
        <Route path="parqueaderos" element={<VisitorParkingPage />} />
        <Route path="contabilidad" element={<AccountingPage />} />
        <Route path="pagos" element={<AdminPaymentsPage />} />
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
        <Route index element={<Navigate to="casillero" replace />} />
        <Route path="casillero" element={<CasilleroPage />} />
        <Route path="reservas" element={<ReservasPage />} />
        <Route path="visitantes" element={<VisitantesPage />} />
        <Route path="parqueadero" element={<ParkingPage />} />
        <Route path="notificaciones" element={<NotificationsPage />} />
        <Route path="registrar-paquete" element={<Navigate to="/porteria/casillero" replace />} />
        <Route path="bitacora" element={<Navigate to="/porteria/casillero" replace />} />
      </Route>

      <Route
        path="/app"
        element={
          <ProtectedRoute roles={['RESIDENT']} loginPath="/login">
            <ResidentLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ResidentHomePage />} />
        <Route path="administracion" element={<ResidentAdministrationPage />} />
        <Route path="servicios-publicos" element={<ResidentPublicServicesPage />} />
        <Route path="prestadores" element={<ResidentProvidersPage />} />
        <Route path="shop" element={<ResidentShopPage />} />
        <Route path="restaurantes" element={<ResidentRestaurantsPage />} />
        <Route path="servicios-conjunto" element={<ResidentFacilitiesPage />} />
      </Route>

      <Route path="/" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
