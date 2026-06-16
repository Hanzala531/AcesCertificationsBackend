import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import { Observable, tap, catchError, throwError } from 'rxjs';
import type { Request, Response } from 'express';
import {
  AUDIT_METADATA_KEY,
  AuditMetadata,
} from '../decorators/audited.decorator';
import { AuditLogService } from '../audit-log.service';
import { sanitizeMetadata } from '../utils/sanitize.util';
import { AuditCategory } from '../enums/audit.enums';

interface JwtUser {
  sub?: string;
  role?: string;
}

const AUDIT_LOG_ENABLED =
  (process.env.AUDIT_LOG_ENABLED ?? 'true').toLowerCase() !== 'false';
const AUDIT_LOG_CAPTURE_READS =
  (process.env.AUDIT_LOG_CAPTURE_READS ?? 'false').toLowerCase() === 'true';
const AUDIT_LOG_EXCLUDE_PATHS = (
  process.env.AUDIT_LOG_EXCLUDE_PATHS ??
  '/api/docs,/api-json,/api/admin/audit-logs'
)
  .split(',')
  .map((path) => path.trim())
  .filter(Boolean);

function deriveTargetEntity(category: AuditCategory | string): string | null {
  const map: Record<string, string> = {
    [AuditCategory.AUTH]: 'User',
    [AuditCategory.RESOURCE]: 'Resource',
    [AuditCategory.TRANSACTION]: 'Transaction',
    [AuditCategory.PAYMENT]: 'Payment',
    [AuditCategory.COMMUNICATION]: 'Message',
    [AuditCategory.ADMIN]: 'Admin',
    [AuditCategory.SYSTEM]: 'System',
  };
  return map[category] ?? null;
}

function resolveTargetId(req: Request, targetParam?: string): string | null {
  if (!targetParam) return null;
  const params = req.params as Record<string, string> | undefined;
  const body = req.body as Record<string, unknown> | undefined;
  const value = params?.[targetParam] ?? body?.[targetParam] ?? null;
  if (value === null || value === undefined) return null;
  return String(value);
}

function extractRequestData(req: Request): {
  ip: string | null;
  userAgent: string | null;
} {
  const forwarded = req.headers?.['x-forwarded-for'];
  const ip =
    (Array.isArray(forwarded)
      ? forwarded[0]
      : forwarded?.split(',')[0]?.trim()) ??
    req.ip ??
    null;
  const userAgent = (req.headers?.['user-agent'] as string) ?? null;
  return { ip, userAgent };
}

function getRequestId(cls: ClsService): string | null {
  try {
    return cls.getId() ?? null;
  } catch {
    return null;
  }
}

function shouldSkipRequest(req: Request): boolean {
  if (!AUDIT_LOG_ENABLED) return true;

  const method = req.method?.toUpperCase() ?? '';
  if (!AUDIT_LOG_CAPTURE_READS && (method === 'GET' || method === 'HEAD')) {
    return true;
  }

  const requestPath = req.path ?? '';
  return AUDIT_LOG_EXCLUDE_PATHS.some(
    (excluded) =>
      requestPath === excluded || requestPath.startsWith(`${excluded}/`),
  );
}

function deriveCategory(path: string): AuditCategory {
  const normalized = path.toLowerCase();
  if (normalized.includes('/auth')) return AuditCategory.AUTH;
  if (normalized.includes('/payment')) return AuditCategory.PAYMENT;
  if (
    normalized.includes('/chat') ||
    normalized.includes('/support-ticket') ||
    normalized.includes('/notification')
  ) {
    return AuditCategory.COMMUNICATION;
  }
  if (normalized.includes('/admin')) return AuditCategory.ADMIN;
  return AuditCategory.RESOURCE;
}

function deriveAction(method: string): string {
  const normalized = method.toUpperCase();
  if (normalized === 'POST') return 'create';
  if (normalized === 'PUT' || normalized === 'PATCH') return 'update';
  if (normalized === 'DELETE') return 'delete';
  if (normalized === 'GET') return 'read';
  return 'execute';
}

function deriveDefaultMetadata(req: Request): AuditMetadata {
  const category = deriveCategory(req.path ?? '');
  const targetParam = Object.keys(
    (req.params ?? {}) as Record<string, string>,
  ).find((key) => /(^id$|_id$|Id$|ID$)/.test(key));

  return {
    action: `${category.toLowerCase()}.${deriveAction(req.method ?? '')}`,
    category,
    targetParam,
  };
}

function safeExtractMetadata(
  metadata: AuditMetadata,
  req: Request,
  response: unknown,
): Record<string, unknown> | null {
  if (!metadata.extractMetadata) return null;

  try {
    return sanitizeMetadata(metadata.extractMetadata(req, response));
  } catch {
    return null;
  }
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditService: AuditLogService,
    private readonly reflector: Reflector,
    private readonly cls: ClsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const decoratedMetadata = this.reflector.get<AuditMetadata | undefined>(
      AUDIT_METADATA_KEY,
      context.getHandler(),
    );

    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtUser }>();
    if (!decoratedMetadata && shouldSkipRequest(req)) {
      return next.handle();
    }

    const metadata = decoratedMetadata ?? deriveDefaultMetadata(req);
    const startTime = Date.now();
    const { ip, userAgent } = extractRequestData(req);
    const requestId = getRequestId(this.cls);
    const actorId = req.user?.sub ?? null;
    const actorRole = req.user?.role ?? null;
    const targetEntity =
      metadata.targetEntity ?? deriveTargetEntity(metadata.category);
    const targetId = resolveTargetId(req, metadata.targetParam);
    const httpMethod = req.method;
    const httpPath = req.path;

    return next.handle().pipe(
      tap((response) => {
        const httpRes = context.switchToHttp().getResponse<Response>();

        this.auditService.log({
          action: metadata.action,
          category: metadata.category,
          actor_id: actorId,
          actor_role: actorRole,
          target_entity: targetEntity,
          target_id: targetId,
          http_method: httpMethod,
          http_path: httpPath,
          http_status_code: httpRes.statusCode,
          request_id: requestId,
          ip_address: ip,
          user_agent: userAgent,
          metadata: safeExtractMetadata(metadata, req, response),
          error_message: null,
          duration_ms: Date.now() - startTime,
        });
      }),
      catchError((err: unknown) => {
        const errObj = err as { status?: number; message?: string } | null;

        this.auditService.log({
          action: metadata.action,
          category: metadata.category,
          actor_id: actorId,
          actor_role: actorRole,
          target_entity: targetEntity,
          target_id: targetId,
          http_method: httpMethod,
          http_path: httpPath,
          http_status_code: errObj?.status ?? 500,
          request_id: requestId,
          ip_address: ip,
          user_agent: userAgent,
          metadata: null,
          error_message: errObj?.message ?? 'Unknown error',
          duration_ms: Date.now() - startTime,
        });

        return throwError(() => err);
      }),
    );
  }
}
