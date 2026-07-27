const normalizeBase = (value) => {
  if (!value) return '/api';
  const trimmed = String(value).trim();
  if (!trimmed) return '/api';
  if (trimmed === '/') return '/api';
  if (trimmed.endsWith('/')) {
    return `${trimmed.slice(0, -1)}/api`;
  }
  return `${trimmed}/api`;
};

export const resolveApiBase = (env = import.meta.env) => {
  if (env?.VITE_API_BASE) {
    return normalizeBase(env.VITE_API_BASE);
  }

  if (env?.BASE_URL) {
    return normalizeBase(env.BASE_URL);
  }

  return '/api';
};

export const API_BASE = resolveApiBase();