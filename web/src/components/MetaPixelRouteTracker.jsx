import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function MetaPixelRouteTracker() {
  const location = useLocation();

  useEffect(() => {
    if (typeof window.fbq !== 'function') return;
    window.fbq('track', 'PageView');
  }, [location.pathname, location.search]);

  return null;
}
