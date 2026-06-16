import type { Request } from 'express';

interface IpWhoIsResponse {
  success?: boolean;
  city?: string;
  country?: string;
  region?: string;
  message?: string;
}

function headerValue(req: Request, key: string): string | null {
  const raw = req.headers[key];
  if (!raw) return null;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeIp(ip: string): string {
  if (!ip) return 'Unknown';
  if (ip.startsWith('::ffff:')) return ip.slice(7);
  return ip;
}

function isPrivateOrLocalIp(ip: string): boolean {
  const normalized = normalizeIp(ip);

  if (
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized === 'localhost'
  ) {
    return true;
  }

  if (normalized.startsWith('10.')) return true;
  if (normalized.startsWith('192.168.')) return true;
  if (normalized.startsWith('169.254.')) return true;

  const parts = normalized.split('.');
  if (parts.length === 4 && parts[0] === '172') {
    const second = Number(parts[1]);
    if (second >= 16 && second <= 31) return true;
  }

  return false;
}

function composeLocation(
  parts: Array<string | null | undefined>,
): string | null {
  const clean = parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return clean.length > 0 ? clean.join(', ') : null;
}

async function lookupGeoByIp(ip: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);

  try {
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as IpWhoIsResponse;
    if (payload.success === false) return null;

    return composeLocation([payload.city, payload.region, payload.country]);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function getClientIp(req: Request): string {
  const forwardedFor = headerValue(req, 'x-forwarded-for');
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) return normalizeIp(first);
  }

  const realIp = headerValue(req, 'x-real-ip');
  if (realIp) return normalizeIp(realIp);

  const cfIp = headerValue(req, 'cf-connecting-ip');
  if (cfIp) return normalizeIp(cfIp);

  return normalizeIp(req.ip || 'Unknown');
}

export async function resolveLoginLocation(req: Request): Promise<string> {
  const ip = getClientIp(req);

  const headerDerived = composeLocation([
    headerValue(req, 'x-vercel-ip-city') ?? headerValue(req, 'cf-ipcity'),
    headerValue(req, 'x-vercel-ip-country-region') ??
      headerValue(req, 'x-vercel-ip-region'),
    headerValue(req, 'x-vercel-ip-country') ?? headerValue(req, 'cf-ipcountry'),
  ]);
  if (headerDerived) return headerDerived;

  if (ip === 'Unknown' || isPrivateOrLocalIp(ip)) {
    return ip;
  }

  const geoLocation = await lookupGeoByIp(ip);
  return geoLocation ?? ip;
}
