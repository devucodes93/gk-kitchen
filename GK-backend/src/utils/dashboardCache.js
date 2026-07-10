const DASHBOARD_CACHE_TTL_MS = 10000;
const RESOURCE_CACHE_TTL_MS = 8000;

let dashboardCache = null;
const resourceCache = new Map();

const getDashboardCache = () => {
  if (!dashboardCache) return null;
  if (Date.now() > dashboardCache.expiresAt) {
    dashboardCache = null;
    return null;
  }
  return dashboardCache.value;
};

const setDashboardCache = (value) => {
  dashboardCache = {
    value,
    expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS,
  };
  return value;
};

const invalidateDashboardCache = () => {
  dashboardCache = null;
};

const getResourceCache = (key) => {
  const cached = resourceCache.get(key);
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) {
    resourceCache.delete(key);
    return null;
  }
  return cached.value;
};

const setResourceCache = (key, value, ttlMs = RESOURCE_CACHE_TTL_MS) => {
  resourceCache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
  return value;
};

const invalidateResourceCache = (key) => {
  if (key) {
    resourceCache.delete(key);
    return;
  }
  resourceCache.clear();
};

module.exports = {
  getDashboardCache,
  setDashboardCache,
  invalidateDashboardCache,
  getResourceCache,
  setResourceCache,
  invalidateResourceCache,
};
