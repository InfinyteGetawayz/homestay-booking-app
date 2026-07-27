const normalizeBase = (value) => {
  if (!value) return '/api';
  const trimmed = String(value).trim();
  if (!trimmed) return '/api';
  if (trimmed === '/') return '/api';

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/+$/, '').replace(/\/api$/, '') + '/api';
  }

  return trimmed.replace(/\/+$/, '') + '/api';
};

const inferBaseFromLocation = (location) => {
  if (!location?.pathname) return '/api';

  const pathname = String(location.pathname).replace(/\/+$/, '');
  if (!pathname || pathname === '/api') return '/api';

  const segments = pathname.split('/').filter(Boolean);
  const knownRoutes = new Set(['dashboard', 'calendar', 'add', 'settings', 'bookings', 'properties', 'login', 'setup', 'auth-status', 'export-csv', 'backups', 'vapid-key', 'subscribe', 'unsubscribe']);

  if (segments.length > 1 && knownRoutes.has(segments[segments.length - 1].toLowerCase())) {
    const prefix = segments.slice(0, -1).join('/');
    return prefix ? `/${prefix}/api` : '/api';
  }

  if (segments.length > 0 && !segments[0].toLowerCase().startsWith('api')) {
    return `/${segments[0]}/api`;
  }

  return '/api';
};

export const resolveApiBase = (env = import.meta.env, location = typeof window !== 'undefined' ? window.location : undefined) => {
  if (env?.VITE_API_BASE) {
    return normalizeBase(env.VITE_API_BASE);
  }

  if (env?.BASE_URL && env.BASE_URL !== '/') {
    return '/api';
  }

  return inferBaseFromLocation(location);
};

export const API_BASE = resolveApiBase();