const DEFAULT_DEV_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://aces-test.vercel.app',
  'https://aces-test-2.vercel.app',
  'https://new-aces.vercel.app',
  'https://new-aces-test.vercel.app',
  'https://aces-new-frontend.vercel.app',
  'https://aces-certification.onrender.com',
  'https://app.acescertification.org',
  'https://api.acescertification.org',
];

const DEFAULT_PROD_CORS_ORIGINS = [
  'https://aces-test.vercel.app',
  'https://aces-test-2.vercel.app',
  'https://new-aces.vercel.app',
  'https://new-aces-test.vercel.app',
  'https://aces-new-frontend.vercel.app',
  'https://aces-certification.onrender.com',
  'https://app.acescertification.org',
  'https://api.acescertification.org',
];

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '');
}

export function getAllowedCorsOrigins(): string[] {
  const envOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean);

  if (envOrigins.length > 0) {
    return envOrigins;
  }

  if (process.env.NODE_ENV !== 'production') {
    return DEFAULT_DEV_CORS_ORIGINS;
  }

  return DEFAULT_PROD_CORS_ORIGINS;
}

export function isCorsOriginAllowed(origin?: string): boolean {
  if (!origin) {
    return true;
  }

  const normalizedOrigin = normalizeOrigin(origin);
  const allowedOrigins = getAllowedCorsOrigins();

  if (allowedOrigins.includes('*')) {
    return true;
  }

  if (allowedOrigins.includes(normalizedOrigin)) {
    return true;
  }

  try {
    const requestHost = new URL(normalizedOrigin).hostname;
    return allowedOrigins.some((allowedOrigin) => {
      const normalizedAllowed = normalizeOrigin(allowedOrigin);
      if (!normalizedAllowed.startsWith('*.')) {
        return false;
      }
      const wildcardDomain = normalizedAllowed.slice(2);
      return (
        requestHost === wildcardDomain ||
        requestHost.endsWith(`.${wildcardDomain}`)
      );
    });
  } catch {
    return false;
  }
}
