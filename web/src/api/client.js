import {
  clearSession,
  getToken,
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
    const session = await refreshSession();
    if (session) {
      return api(path, { ...options, _retry: true });
    }
    clearSession();
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
  overview: () => api('/platform/overview'),
  createConjunto: (body) => api('/platform/conjuntos', { method: 'POST', body }),
  createBuilding: (orgId, body) =>
    api(`/platform/organizations/${orgId}/buildings`, { method: 'POST', body }),
  buildingSummary: (id) => api(`/platform/buildings/${id}/summary`),
  listAdmins: (orgId) => api(`/platform/organizations/${orgId}/admins`),
  createAdmin: (orgId, body) =>
    api(`/platform/organizations/${orgId}/admins`, { method: 'POST', body }),
  updateAdmin: (id, body) => api(`/platform/admins/${id}`, { method: 'PATCH', body }),
};
