const STORAGE_KEY = 'rentados.resident.home.v1';

let memoryCache = null;

function readStorage() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeStorage(data) {
  try {
    if (!data) {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* quota / private mode */
  }
}

export function getResidentHomeCache() {
  if (memoryCache) return memoryCache;
  const stored = readStorage();
  if (stored) memoryCache = stored;
  return memoryCache;
}

export function setResidentHomeCache(payload) {
  memoryCache = {
    home: payload.home ?? null,
    servicesData: payload.servicesData ?? null,
    publications: payload.publications ?? [],
    lockerData: payload.lockerData ?? null,
    cachedAt: Date.now(),
  };
  writeStorage(memoryCache);
}

export function clearResidentHomeCache() {
  memoryCache = null;
  writeStorage(null);
}
