const TENANT_KEY = 'rentados_tenant';

export function getActiveTenant() {
  try {
    const raw = localStorage.getItem(TENANT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setActiveTenant(tenant) {
  if (!tenant?.organizationId) {
    localStorage.removeItem(TENANT_KEY);
  } else {
    localStorage.setItem(TENANT_KEY, JSON.stringify(tenant));
  }
  window.dispatchEvent(new CustomEvent('rentados:tenant', { detail: tenant || null }));
}

export function clearActiveTenant() {
  setActiveTenant(null);
}

export function getTenantHeaders() {
  const tenant = getActiveTenant();
  if (!tenant?.organizationId) return {};
  const headers = { 'x-organization-id': tenant.organizationId };
  if (tenant.buildingId) headers['x-building-id'] = tenant.buildingId;
  return headers;
}
