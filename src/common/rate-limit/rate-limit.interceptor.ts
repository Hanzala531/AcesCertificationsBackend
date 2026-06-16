import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import {
  RATE_LIMIT_METADATA_KEY,
  RateLimitOptions,
} from './rate-limit.decorator';

type RateLimitRole = 'admin' | 'subadmin' | 'user' | 'anonymous';

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

interface RequestUser {
  sub?: string;
  userId?: string;
  id?: string;
  role?: string;
}

interface RequestWithUser extends Request {
  user?: RequestUser;
}

@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  private readonly buckets = new Map<string, RateLimitBucket>();
  private requestCounter = 0;

  private readonly globalWindowMs = this.getPositiveNumber(
    process.env.RATE_LIMIT_GLOBAL_WINDOW_MS,
    60_000,
  );
  private readonly globalMax = this.getPositiveNumber(
    process.env.RATE_LIMIT_GLOBAL_MAX,
    120,
  );
  private readonly routeWindowMs = this.getPositiveNumber(
    process.env.RATE_LIMIT_ROUTE_WINDOW_MS,
    60_000,
  );
  private readonly routeMax = this.getPositiveNumber(
    process.env.RATE_LIMIT_ROUTE_MAX,
    30,
  );
  private readonly resourceWindowMs = this.getPositiveNumber(
    process.env.RATE_LIMIT_RESOURCE_WINDOW_MS,
    60_000,
  );
  private readonly resourceMax = this.getNonNegativeNumber(
    process.env.RATE_LIMIT_RESOURCE_MAX,
    600,
  );
  private readonly adminMultiplier = this.getPositiveNumber(
    process.env.RATE_LIMIT_ADMIN_MULTIPLIER,
    2,
  );
  private readonly subadminMultiplier = this.getPositiveNumber(
    process.env.RATE_LIMIT_SUBADMIN_MULTIPLIER,
    1.5,
  );

  private readonly groupDefaults = new Map<
    string,
    { max: number; windowMs: number }
  >();

  constructor(private readonly reflector: Reflector) {
    this.loadGroupDefaults();
  }

  private loadGroupDefaults() {
    const prefix = 'RATE_LIMIT_';
    const suffix_max = '_MAX';
    const suffix_window = '_WINDOW_MS';

    const groups = new Set<string>();
    for (const key of Object.keys(process.env)) {
      if (!key.startsWith(prefix)) continue;
      const rest = key.slice(prefix.length);
      if (
        rest.endsWith(suffix_max) &&
        !['GLOBAL_MAX', 'ROUTE_MAX', 'RESOURCE_MAX'].includes(rest)
      ) {
        groups.add(rest.slice(0, -suffix_max.length).toLowerCase());
      }
    }

    for (const group of groups) {
      const envKey = group.toUpperCase();
      const max = this.getPositiveNumber(
        process.env[`${prefix}${envKey}_MAX`],
        this.routeMax,
      );
      const windowMs = this.getPositiveNumber(
        process.env[`${prefix}${envKey}_WINDOW_MS`],
        this.routeWindowMs,
      );
      this.groupDefaults.set(group, { max, windowMs });
    }
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const res = context.switchToHttp().getResponse<Response>();
    const role = this.getRole(req.user?.role);
    const identity = this.getIdentity(req);
    const endpoint = this.getEndpointKey(req);

    this.cleanupIfNeeded();

    const endpointOverride = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (endpointOverride?.skip) {
      return next.handle();
    }

    const groupConfig = endpointOverride?.group
      ? this.groupDefaults.get(endpointOverride.group)
      : undefined;

    const adjustedGlobalMax = this.getRoleAdjustedMax(this.globalMax, role);
    const adjustedRouteMax = this.getRoleAdjustedMax(
      endpointOverride?.max ?? groupConfig?.max ?? this.routeMax,
      role,
    );
    const activeRouteWindowMs =
      endpointOverride?.windowMs ?? groupConfig?.windowMs ?? this.routeWindowMs;

    const globalCheck = this.hitLimit(
      `global:${identity}`,
      adjustedGlobalMax,
      this.globalWindowMs,
    );
    if (!globalCheck.allowed) {
      res.setHeader('Retry-After', globalCheck.retryAfterSeconds);
      throw new HttpException(
        `Too many requests. Retry in ${globalCheck.retryAfterSeconds}s.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const routeCheck = this.hitLimit(
      `route:${identity}:${req.method}:${endpoint}`,
      adjustedRouteMax,
      activeRouteWindowMs,
    );
    if (!routeCheck.allowed) {
      res.setHeader('Retry-After', routeCheck.retryAfterSeconds);
      throw new HttpException(
        `Too many requests for this endpoint. Retry in ${routeCheck.retryAfterSeconds}s.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (this.resourceMax > 0) {
      const resourceCheck = this.hitLimit(
        `resource:${req.method}:${endpoint}`,
        this.resourceMax,
        this.resourceWindowMs,
      );
      if (!resourceCheck.allowed) {
        res.setHeader('Retry-After', resourceCheck.retryAfterSeconds);
        throw new HttpException(
          `This resource is currently busy. Retry in ${resourceCheck.retryAfterSeconds}s.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      res.setHeader('X-RateLimit-Resource-Limit', this.resourceMax);
      res.setHeader('X-RateLimit-Resource-Remaining', resourceCheck.remaining);
      res.setHeader(
        'X-RateLimit-Resource-Reset',
        Math.ceil(resourceCheck.resetAt / 1000),
      );
    }

    res.setHeader('X-RateLimit-Limit', adjustedRouteMax);
    res.setHeader('X-RateLimit-Remaining', routeCheck.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(routeCheck.resetAt / 1000));

    return next.handle();
  }

  private hitLimit(key: string, max: number, windowMs: number) {
    const now = Date.now();
    const existing = this.buckets.get(key);

    if (!existing || now >= existing.resetAt) {
      const resetAt = now + windowMs;
      this.buckets.set(key, { count: 1, resetAt });
      return {
        allowed: true,
        remaining: Math.max(max - 1, 0),
        resetAt,
        retryAfterSeconds: 0,
      };
    }

    if (existing.count >= max) {
      const retryAfterMs = Math.max(existing.resetAt - now, 0);
      return {
        allowed: false,
        remaining: 0,
        resetAt: existing.resetAt,
        retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      };
    }

    existing.count += 1;
    this.buckets.set(key, existing);
    return {
      allowed: true,
      remaining: Math.max(max - existing.count, 0),
      resetAt: existing.resetAt,
      retryAfterSeconds: 0,
    };
  }

  private getIdentity(req: RequestWithUser): string {
    const userId = req.user?.sub || req.user?.userId || req.user?.id;
    if (userId) {
      return `user:${userId}`;
    }

    const forwardedFor = req.headers['x-forwarded-for'];
    const ipFromProxy = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor?.split(',')[0]?.trim();
    const ip = ipFromProxy || req.ip || 'unknown-ip';
    return `ip:${ip}`;
  }

  private getRole(rawRole?: string): RateLimitRole {
    if (!rawRole) {
      return 'anonymous';
    }
    if (rawRole === 'admin') {
      return 'admin';
    }
    if (rawRole === 'subadmin') {
      return 'subadmin';
    }
    return 'user';
  }

  private getRoleAdjustedMax(baseMax: number, role: RateLimitRole): number {
    if (role === 'admin') {
      return Math.max(Math.ceil(baseMax * this.adminMultiplier), 1);
    }
    if (role === 'subadmin') {
      return Math.max(Math.ceil(baseMax * this.subadminMultiplier), 1);
    }
    return Math.max(baseMax, 1);
  }

  private getEndpointKey(req: Request): string {
    const routePath = req.route?.path;
    const baseUrl = req.baseUrl || '';
    if (typeof routePath === 'string') {
      return `${baseUrl}${routePath}`;
    }
    return req.path || req.url;
  }

  private cleanupIfNeeded() {
    this.requestCounter += 1;
    if (this.requestCounter % 250 !== 0) {
      return;
    }

    const now = Date.now();
    for (const [key, bucket] of this.buckets.entries()) {
      if (now >= bucket.resetAt) {
        this.buckets.delete(key);
      }
    }
  }

  private getPositiveNumber(raw: string | undefined, fallback: number): number {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }
    return parsed;
  }

  private getNonNegativeNumber(
    raw: string | undefined,
    fallback: number,
  ): number {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return fallback;
    }
    return parsed;
  }
}
