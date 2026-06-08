import {
  clearSession,
  getToken,
  hydrateSession,
  isHydratingSession,
  loadSession,
  persistSession,
  refreshSession,
} from './authSession';
import { getTenantHeaders } from './tenantContext';

const API_BASE = '/api/v1';

function buildQueryString(params = {}) {
  const entries = Object.entries(params).filter(
    ([, value]) => value != null && value !== '' && value !== 'undefined'
  );
  if (!entries.length) return '';
  return new URLSearchParams(entries).toString();
}

export async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...getTenantHeaders(),
    ...options.headers,
  };

  const skipAuth = options.skipAuth ?? false;
  const token = skipAuth ? null : getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let data = {};
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text.slice(0, 120) };
    }
  }

  if (res.status === 401 && !options._retry && !options.skipAuthRetry && token) {
    if (isHydratingSession()) {
      await hydrateSession();
      return api(path, { ...options, _retry: true });
    }
    const session = await refreshSession();
    if (session) {
      return api(path, { ...options, _retry: true });
    }
    if (!loadSession()?.token) {
      clearSession();
    }
  }

  if (!res.ok) {
    if (res.status >= 500 && !data.error) {
      throw new Error(
        'No se pudo conectar con el servidor. Inicia el backend con: npm run dev (puerto 3000)'
      );
    }
    throw new Error(data.error || 'Error en la solicitud');
  }

  return data;
}

async function apiForm(path, formData, options = {}) {
  const headers = {
    ...getTenantHeaders(),
    ...options.headers,
  };

  const token = options.skipAuth ? null : getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method || 'POST',
    headers,
    body: formData,
  });

  let data = {};
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text.slice(0, 120) };
    }
  }

  if (!res.ok) {
    throw new Error(data.error || 'Error al subir el archivo');
  }

  return data;
}

export function login(email, password, portal) {
  return api('/auth/login', {
    method: 'POST',
    body: { email, password, portal },
    skipAuth: true,
    skipAuthRetry: true,
  });
}

export const formatCop = (value) =>
  `$${Number(value || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;

export function formatMoney(value, currency = 'COP') {
  const code = currency === 'MXN' ? 'MXN' : 'COP';
  const locale = code === 'MXN' ? 'es-MX' : 'es-CO';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: code,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export const adminApi = {
  context: () => api('/admin/context'),
  dashboard: () => api('/admin/dashboard'),
  towers: {
    list: () => api('/admin/towers'),
    create: (body) => api('/admin/towers', { method: 'POST', body }),
    update: (id, body) => api(`/admin/towers/${id}`, { method: 'PATCH', body }),
    remove: (id) => api(`/admin/towers/${id}`, { method: 'DELETE' }),
  },
  units: {
    list: (params = {}) => {
      const q = buildQueryString(params);
      return api(`/admin/units${q ? `?${q}` : ''}`);
    },
    create: (body) => api('/admin/units', { method: 'POST', body }),
    bulkCreate: (body) => api('/admin/units/bulk', { method: 'POST', body }),
    replicateTower: (body) => api('/admin/units/replicate-tower', { method: 'POST', body }),
    syncFloors: (body) => api('/admin/units/sync-floors', { method: 'POST', body }),
    applyDefaultFee: (body) => api('/admin/units/apply-default-fee', { method: 'POST', body }),
    update: (id, body) => api(`/admin/units/${id}`, { method: 'PATCH', body }),
    remove: (id) => api(`/admin/units/${id}`, { method: 'DELETE' }),
    residents: (unitId) => api(`/admin/units/${unitId}/residents`),
  },
  facilities: {
    list: () => api('/admin/facilities'),
    create: (body) => api('/admin/facilities', { method: 'POST', body }),
    update: (id, body) => api(`/admin/facilities/${id}`, { method: 'PATCH', body }),
    remove: (id) => api(`/admin/facilities/${id}`, { method: 'DELETE' }),
    maintenance: (id, body) => api(`/admin/facilities/${id}/maintenance`, { method: 'POST', body }),
    reopen: (id) => api(`/admin/facilities/${id}/reopen`, { method: 'POST' }),
  },
  facilityBookings: {
    list: (params = {}) => {
      const q = buildQueryString(params);
      return api(`/admin/facility-bookings${q ? `?${q}` : ''}`);
    },
    create: (body) => api('/admin/facility-bookings', { method: 'POST', body }),
    update: (id, body) => api(`/admin/facility-bookings/${id}`, { method: 'PATCH', body }),
    remove: (id) => api(`/admin/facility-bookings/${id}`, { method: 'DELETE' }),
  },
  publications: {
    list: () => api('/admin/publications'),
    uploadMedia: (file) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiForm('/admin/publications/upload-media', formData);
    },
    create: (body) => api('/admin/publications', { method: 'POST', body }),
    remove: (id) => api(`/admin/publications/${id}`, { method: 'DELETE' }),
  },
  staff: {
    list: () => api('/admin/staff'),
    create: (body) => api('/admin/staff', { method: 'POST', body }),
    update: (id, body) => api(`/admin/staff/${id}`, { method: 'PATCH', body }),
    remove: (id) => api(`/admin/staff/${id}`, { method: 'DELETE' }),
  },
  porteriaSettings: {
    get: () => api('/admin/porteria-settings'),
    update: (body) => api('/admin/porteria-settings', { method: 'PATCH', body }),
  },
  visitorParking: {
    list: () => api('/admin/visitor-parking'),
    create: (body) => api('/admin/visitor-parking', { method: 'POST', body }),
    bulkCreate: (body) => api('/admin/visitor-parking/bulk', { method: 'POST', body }),
    update: (id, body) => api(`/admin/visitor-parking/${id}`, { method: 'PATCH', body }),
    remove: (id) => api(`/admin/visitor-parking/${id}`, { method: 'DELETE' }),
  },
  billing: {
    getSettings: () => api('/admin/billing-settings'),
    updateSettings: (body) => api('/admin/billing-settings', { method: 'PATCH', body }),
  },
  suspensions: {
    list: () => api('/admin/service-suspensions'),
    create: (body) => api('/admin/service-suspensions', { method: 'POST', body }),
    update: (id, body) => api(`/admin/service-suspensions/${id}`, { method: 'PATCH', body }),
    remove: (id) => api(`/admin/service-suspensions/${id}`, { method: 'DELETE' }),
    syncAuto: () => api('/admin/service-suspensions/sync-auto', { method: 'POST' }),
  },
  cartera: (params = {}) => {
    const q = buildQueryString(params);
    return api(`/admin/cartera${q ? `?${q}` : ''}`);
  },
  payments: {
    create: (body) => api('/admin/payments', { method: 'POST', body }),
  },
  residents: {
    list: (params = {}) => {
      const q = buildQueryString(params);
      return api(`/admin/residents${q ? `?${q}` : ''}`);
    },
    get: (id) => api(`/admin/residents/${id}`),
    create: (body) => api('/admin/residents', { method: 'POST', body }),
    update: (id, body) => api(`/admin/residents/${id}`, { method: 'PATCH', body }),
    remove: (id) => api(`/admin/residents/${id}`, { method: 'DELETE' }),
  },
};

export const porteriaApi = {
  settings: () => api('/porteria/settings'),
  residents: () => api('/porteria/residents'),
  units: () => api('/porteria/units'),
  towers: () => api('/porteria/towers'),
  bitacora: (params = {}) => {
    const q = buildQueryString(params);
    return api(`/porteria/bitacora${q ? `?${q}` : ''}`);
  },
  lockerPackages: {
    list: (params = {}) => {
      const q = buildQueryString(params);
      return api(`/porteria/locker-packages${q ? `?${q}` : ''}`);
    },
    summaryByUnit: () => api('/porteria/locker-packages/summary-by-unit'),
    uploadPhoto: (file) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiForm('/porteria/locker-packages/upload-photo', formData);
    },
    create: (body) => api('/porteria/locker-packages', { method: 'POST', body }),
    pickup: (id, body) => api(`/porteria/locker-packages/${id}/pickup`, { method: 'PATCH', body }),
    notify: (id) => api(`/porteria/locker-packages/${id}/notify`, { method: 'POST' }),
    notifyOverflow: (unitId) =>
      api(`/porteria/locker-packages/units/${unitId}/notify-overflow`, { method: 'POST' }),
  },
  parking: {
    summary: () => api('/porteria/parking/summary'),
    registerEntry: (body) => api('/porteria/parking/entries', { method: 'POST', body }),
    registerExit: (body) => api('/porteria/parking/exit', { method: 'POST', body }),
  },
  notifications: {
    send: (body) => api('/porteria/notifications', { method: 'POST', body }),
  },
};

export const residentApi = {
  billing: () => api('/resident/billing'),
  services: () => api('/resident/services'),
  myBookings: () => api('/resident/my-bookings'),
  notifications: () => api('/resident/notifications'),
  markNotificationRead: (id) => api(`/resident/notifications/${id}/read`, { method: 'PATCH' }),
  lockerPackages: () => api('/resident/locker-packages'),
  shop: () => api('/resident/shop'),
  shopOrders: () => api('/resident/shop/orders'),
  createShopOrder: (body) => api('/resident/shop/orders', { method: 'POST', body }),
  facilityBookings: {
    calendar: (params = {}) => {
      const q = buildQueryString(params);
      return api(`/resident/facility-bookings${q ? `?${q}` : ''}`);
    },
    create: (body) => api('/resident/facility-bookings', { method: 'POST', body }),
    remove: (id) => api(`/resident/facility-bookings/${id}`, { method: 'DELETE' }),
  },
};

export const platformApi = {
  dashboard: () => api('/platform/dashboard'),
  overview: () => api('/platform/overview'),
  conjuntosEngagement: () => api('/platform/conjuntos/engagement'),
  buildingAppAdoption: (buildingId, params = {}) => {
    const q = buildQueryString(params);
    return api(`/platform/buildings/${buildingId}/app-adoption${q ? `?${q}` : ''}`);
  },
  createUnitAppFollowUp: (unitId, body) =>
    api(`/platform/units/${unitId}/app-follow-up`, { method: 'POST', body }),
  createConjunto: (body) => api('/platform/conjuntos', { method: 'POST', body }),
  createBuilding: (orgId, body) =>
    api(`/platform/organizations/${orgId}/buildings`, { method: 'POST', body }),
  buildingSummary: (id) => api(`/platform/buildings/${id}/summary`),
  listAdmins: (orgId) => api(`/platform/organizations/${orgId}/admins`),
  createAdmin: (orgId, body) =>
    api(`/platform/organizations/${orgId}/admins`, { method: 'POST', body }),
  updateAdmin: (id, body) => api(`/platform/admins/${id}`, { method: 'PATCH', body }),
  serviceCategories: () => api('/platform/service-categories'),
  createServiceCategory: (body) =>
    api('/platform/service-categories', { method: 'POST', body }),
  updateServiceCategory: (id, body) =>
    api(`/platform/service-categories/${id}`, { method: 'PATCH', body }),
  removeServiceCategory: (id) =>
    api(`/platform/service-categories/${id}`, { method: 'DELETE' }),
  providerApplications: (params = {}) => {
    const q = buildQueryString(params);
    return api(`/platform/provider-applications${q ? `?${q}` : ''}`);
  },
  providers: () => api('/platform/providers'),
  updateProvider: (id, body) => api(`/platform/providers/${id}`, { method: 'PATCH', body }),
  approveProvider: (id) => api(`/platform/providers/${id}/approve`, { method: 'POST' }),
  rejectProvider: (id, body) => api(`/platform/providers/${id}/reject`, { method: 'POST', body }),
  removeProvider: (id) => api(`/platform/providers/${id}`, { method: 'DELETE' }),
  createInterview: (providerId, body) =>
    api(`/platform/providers/${providerId}/interviews`, { method: 'POST', body }),
  publications: () => api('/platform/publications'),
  createPublication: (body) => api('/platform/publications', { method: 'POST', body }),
  updatePublication: (id, body) => api(`/platform/publications/${id}`, { method: 'PATCH', body }),
  removePublication: (id) => api(`/platform/publications/${id}`, { method: 'DELETE' }),
  shopCategories: () => api('/platform/shop/categories'),
  createShopCategory: (body) => api('/platform/shop/categories', { method: 'POST', body }),
  updateShopCategory: (id, body) =>
    api(`/platform/shop/categories/${id}`, { method: 'PATCH', body }),
  removeShopCategory: (id) => api(`/platform/shop/categories/${id}`, { method: 'DELETE' }),
  shopProducts: (params = {}) => {
    const q = buildQueryString(params);
    return api(`/platform/shop/products${q ? `?${q}` : ''}`);
  },
  createShopProduct: (body) => api('/platform/shop/products', { method: 'POST', body }),
  updateShopProduct: (id, body) => api(`/platform/shop/products/${id}`, { method: 'PATCH', body }),
  removeShopProduct: (id) => api(`/platform/shop/products/${id}`, { method: 'DELETE' }),
  uploadShopProductImage: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiForm('/platform/shop/products/upload-image', formData);
  },
  shopOrders: (params = {}) => {
    const q = buildQueryString(params);
    return api(`/platform/shop/orders${q ? `?${q}` : ''}`);
  },
  updateShopOrder: (id, body) => api(`/platform/shop/orders/${id}`, { method: 'PATCH', body }),
  restaurants: () => api('/platform/restaurants'),
  restaurant: (id) => api(`/platform/restaurants/${id}`),
  createRestaurant: (body) => api('/platform/restaurants', { method: 'POST', body }),
  updateRestaurant: (id, body) => api(`/platform/restaurants/${id}`, { method: 'PATCH', body }),
  removeRestaurant: (id) => api(`/platform/restaurants/${id}`, { method: 'DELETE' }),
  uploadRestaurantImage: (file, type = 'cover') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    return apiForm('/platform/restaurants/upload-image', formData);
  },
  restaurantMenuCategories: (restaurantId) =>
    api(`/platform/restaurants/${restaurantId}/menu/categories`),
  createRestaurantMenuCategory: (restaurantId, body) =>
    api(`/platform/restaurants/${restaurantId}/menu/categories`, { method: 'POST', body }),
  updateRestaurantMenuCategory: (id, body) =>
    api(`/platform/restaurants/menu/categories/${id}`, { method: 'PATCH', body }),
  removeRestaurantMenuCategory: (id) =>
    api(`/platform/restaurants/menu/categories/${id}`, { method: 'DELETE' }),
  restaurantMenuItems: (restaurantId, params = {}) => {
    const q = buildQueryString(params);
    return api(`/platform/restaurants/${restaurantId}/menu/items${q ? `?${q}` : ''}`);
  },
  createRestaurantMenuItem: (restaurantId, body) =>
    api(`/platform/restaurants/${restaurantId}/menu/items`, { method: 'POST', body }),
  updateRestaurantMenuItem: (id, body) =>
    api(`/platform/restaurants/menu/items/${id}`, { method: 'PATCH', body }),
  removeRestaurantMenuItem: (id) =>
    api(`/platform/restaurants/menu/items/${id}`, { method: 'DELETE' }),
  uploadRestaurantMenuItemImage: (restaurantId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiForm(`/platform/restaurants/${restaurantId}/menu/items/upload-image`, formData);
  },
  restaurantOrders: (params = {}) => {
    const q = buildQueryString(params);
    return api(`/platform/restaurants/orders/list${q ? `?${q}` : ''}`);
  },
  updateRestaurantOrder: (id, body) =>
    api(`/platform/restaurants/orders/${id}`, { method: 'PATCH', body }),
};

export const providerApi = {
  me: () => api('/provider/me'),
  interviews: () => api('/provider/interviews'),
  updateOfferings: (offerings) =>
    api('/provider/offerings', { method: 'PATCH', body: { offerings } }),
};

export async function registerProvider(body) {
  return api('/auth/register-provider', { method: 'POST', body, skipAuth: true });
}

export async function fetchServiceCategories() {
  return api('/auth/service-categories', { skipAuth: true });
}
