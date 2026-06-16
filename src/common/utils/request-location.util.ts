import type { Request } from 'express';
import { isIP } from 'node:net';

function headerValue(req: Request, key: string): string | null {
  const raw = req.headers[key];
  if (!raw) return null;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function getClientIp(req: Request): string {
  const forwardedFor = headerValue(req, 'x-forwarded-for');
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) return first;
  }

  const realIp = headerValue(req, 'x-real-ip');
  if (realIp) return realIp;

  const cfIp = headerValue(req, 'cf-connecting-ip');
  if (cfIp) return cfIp;

  return req.ip || 'Unknown';
}

function locationFromHeaders(req: Request): string | null {
  const city =
    headerValue(req, 'x-vercel-ip-city') ??
    headerValue(req, 'cf-ipcity') ??
    headerValue(req, 'x-appengine-city');
  const country =
    headerValue(req, 'x-vercel-ip-country') ??
    headerValue(req, 'cf-ipcountry') ??
    headerValue(req, 'x-appengine-country');
  const region =
    headerValue(req, 'x-vercel-ip-country-region') ??
    headerValue(req, 'x-vercel-ip-region') ??
    headerValue(req, 'x-appengine-region');

  const parts = [city, region, country].filter((value): value is string =>
    Boolean(value),
  );

  return parts.length > 0 ? parts.join(', ') : null;
}

function isPrivateOrLocalIp(ip: string): boolean {
  const normalized = ip.toLowerCase();

  if (
    normalized === 'localhost' ||
    normalized === '::1' ||
    normalized.startsWith('127.') ||
    normalized.startsWith('10.') ||
    normalized.startsWith('192.168.') ||
    normalized.startsWith('169.254.')
  ) {
    return true;
  }

  const match172 = normalized.match(/^172\.(\d{1,3})\./);
  if (match172) {
    const secondOctet = Number(match172[1]);
    if (secondOctet >= 16 && secondOctet <= 31) return true;
  }

  return normalized.startsWith('fc') || normalized.startsWith('fd');
}

async function lookupLocationByIp(ip: string): Promise<string | null> {
  if (!ip || ip === 'Unknown' || !isIP(ip) || isPrivateOrLocalIp(ip)) {
    return null;
  }

  const timeoutMs = Number(process.env.IP_GEO_TIMEOUT_MS ?? 1800);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `https://ipapi.co/${encodeURIComponent(ip)}/json/`,
      {
        headers: { accept: 'application/json' },
        signal: controller.signal,
      },
    );

    if (!response.ok) return null;

    const data = (await response.json()) as {
      city?: string;
      region_code?: string;
      country_code?: string;
      country_name?: string;
      error?: boolean;
    };

    if (data.error) return null;

    const parts = [data.city, data.region_code, data.country_code].filter(
      (value): value is string => Boolean(value),
    );

    if (parts.length > 0) return parts.join(', ');

    return data.country_name?.trim() || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveRequestLocation(req: Request): Promise<string> {
  const providerLocation = locationFromHeaders(req);
  if (providerLocation) return providerLocation;

  const ip = getClientIp(req);
  const byIpLookup = await lookupLocationByIp(ip);
  if (byIpLookup) return byIpLookup;

  return 'Unknown location';
}
