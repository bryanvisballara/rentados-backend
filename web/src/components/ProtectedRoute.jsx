import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, roles = [], loginPath = '/admin/login' }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  if (roles.length && !roles.includes(user?.role)) {
    return <Navigate to={loginPath} replace />;
  }

  return children;
}
