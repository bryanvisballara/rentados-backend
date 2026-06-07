import {
  clearSession,
  getToken,
  persistSession,
  refreshSession,
} from './authSession';

const API_BASE = '/api/v1';

export async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
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
      const q = new URLSearchParams(params).toString();
      return api(`/admin/units${q ? `?${q}` : ''}`);
    },
    create: (body) => api('/admin/units', { method: 'POST', body }),
    bulkCreate: (body) => api('/admin/units/bulk', { method: 'POST', body }),
    update: (id, body) => api(`/admin/units/${id}`, { method: 'PATCH', body }),
    remove: (id) => api(`/admin/units/${id}`, { method: 'DELETE' }),
    residents: (unitId) => api(`/admin/units/${unitId}/residents`),
  },
  facilities: {
    list: () => api('/admin/facilities'),
    create: (body) => api('/admin/facilities', { method: 'POST', body }),
    update: (id, body) => api(`/admin/facilities/${id}`, { method: 'PATCH', body }),
    maintenance: (id, body) => api(`/admin/facilities/${id}/maintenance`, { method: 'POST', body }),
    reopen: (id) => api(`/admin/facilities/${id}/reopen`, { method: 'POST' }),
  },
  publications: {
    list: () => api('/admin/publications'),
    create: (body) => api('/admin/publications', { method: 'POST', body }),
    remove: (id) => api(`/admin/publications/${id}`, { method: 'DELETE' }),
  },
  staff: {
    list: () => api('/admin/staff'),
    create: (body) => api('/admin/staff', { method: 'POST', body }),
    update: (id, body) => api(`/admin/staff/${id}`, { method: 'PATCH', body }),
    remove: (id) => api(`/admin/staff/${id}`, { method: 'DELETE' }),
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
  cartera: (period) => {
    const q = period ? `?period=${period}` : '';
    return api(`/admin/cartera${q}`);
  },
  residents: {
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return api(`/admin/residents${q ? `?${q}` : ''}`);
    },
    get: (id) => api(`/admin/residents/${id}`),
    create: (body) => api('/admin/residents', { method: 'POST', body }),
    update: (id, body) => api(`/admin/residents/${id}`, { method: 'PATCH', body }),
    remove: (id) => api(`/admin/residents/${id}`, { method: 'DELETE' }),
  },
};

export const residentApi = {
  billing: () => api('/resident/billing'),
  services: () => api('/resident/services'),
};
