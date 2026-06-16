import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import { firstValueFrom, of, throwError } from 'rxjs';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuditInterceptor } from '../interceptors/audit.interceptor';
import { AuditLogService } from '../audit-log.service';
import {
  AUDIT_METADATA_KEY,
  AuditMetadata,
} from '../decorators/audited.decorator';
import { AuditAction, AuditCategory } from '../enums/audit.enums';

function makeContext(
  req: Partial<Request & { user?: { sub?: string; role?: string } }>,
  res: Partial<Response> = { statusCode: 200 },
  metadata?: AuditMetadata,
): ExecutionContext {
  return {
    getHandler: () => ({}),
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  } as unknown as ExecutionContext;
}

function makeHandler(returnValue: unknown = { ok: true }): CallHandler {
  return { handle: () => of(returnValue) };
}

function makeErrorHandler(error: unknown): CallHandler {
  return { handle: () => throwError(() => error) };
}

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;
  let auditService: jest.Mocked<AuditLogService>;
  let reflector: jest.Mocked<Reflector>;
  let clsService: jest.Mocked<ClsService>;

  const defaultMetadata: AuditMetadata = {
    action: AuditAction.AUTH_LOGIN,
    category: AuditCategory.AUTH,
  };

  const defaultReq = {
    method: 'POST',
    path: '/api/auth/login',
    ip: '127.0.0.1',
    headers: { 'user-agent': 'jest/1.0' },
    user: { sub: 'user-uuid', role: 'admin' },
    params: {},
    body: {},
  } as unknown as Request & { user: { sub: string; role: string } };

  beforeEach(async () => {
    const mockAuditService = {
      log: jest.fn(),
    } as unknown as jest.Mocked<AuditLogService>;

    const mockReflector = {
      get: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    const mockCls = {
      getId: jest.fn().mockReturnValue('cls-request-id'),
    } as unknown as jest.Mocked<ClsService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditInterceptor,
        { provide: AuditLogService, useValue: mockAuditService },
        { provide: Reflector, useValue: mockReflector },
        { provide: ClsService, useValue: mockCls },
      ],
    }).compile();

    interceptor = module.get<AuditInterceptor>(AuditInterceptor);
    auditService = module.get(AuditLogService);
    reflector = module.get(Reflector);
    clsService = module.get(ClsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  describe('when no @Audited() metadata is present', () => {
    it('logs non-read requests using derived metadata', async () => {
      reflector.get.mockReturnValue(undefined);
      const ctx = makeContext(defaultReq);
      const handler = makeHandler();

      await firstValueFrom(interceptor.intercept(ctx, handler));
      expect(auditService.log).toHaveBeenCalledTimes(1);
      const logged = auditService.log.mock.calls[0][0];
      expect(logged.action).toBe('auth.create');
      expect(logged.category).toBe(AuditCategory.AUTH);
    });

    it('skips GET requests by default when no decorator metadata exists', async () => {
      reflector.get.mockReturnValue(undefined);
      const req = {
        ...defaultReq,
        method: 'GET',
        path: '/api/employee',
      } as unknown as Request;

      await firstValueFrom(
        interceptor.intercept(makeContext(req), makeHandler()),
      );
      expect(auditService.log).not.toHaveBeenCalled();
    });

    it('skips excluded paths when no decorator metadata exists', async () => {
      reflector.get.mockReturnValue(undefined);
      const req = {
        ...defaultReq,
        path: '/api/admin/audit-logs',
      } as unknown as Request;

      await firstValueFrom(
        interceptor.intercept(makeContext(req), makeHandler()),
      );
      expect(auditService.log).not.toHaveBeenCalled();
    });
  });

  describe('successful request', () => {
    beforeEach(() => {
      reflector.get.mockReturnValue(defaultMetadata);
    });

    it('logs the audit entry after successful response', async () => {
      const ctx = makeContext(defaultReq, { statusCode: 200 });
      await firstValueFrom(interceptor.intercept(ctx, makeHandler()));

      expect(auditService.log).toHaveBeenCalledTimes(1);
    });

    it('passes the action and category from metadata', async () => {
      const ctx = makeContext(defaultReq, { statusCode: 200 });
      await firstValueFrom(interceptor.intercept(ctx, makeHandler()));

      const logged = auditService.log.mock.calls[0][0];
      expect(logged.action).toBe(AuditAction.AUTH_LOGIN);
      expect(logged.category).toBe(AuditCategory.AUTH);
    });

    it('captures actor_id and actor_role from req.user', async () => {
      const ctx = makeContext(defaultReq, { statusCode: 200 });
      await firstValueFrom(interceptor.intercept(ctx, makeHandler()));

      const logged = auditService.log.mock.calls[0][0];
      expect(logged.actor_id).toBe('user-uuid');
      expect(logged.actor_role).toBe('admin');
    });

    it('captures http_method and http_path from request', async () => {
      const ctx = makeContext(defaultReq, { statusCode: 200 });
      await firstValueFrom(interceptor.intercept(ctx, makeHandler()));

      const logged = auditService.log.mock.calls[0][0];
      expect(logged.http_method).toBe('POST');
      expect(logged.http_path).toBe('/api/auth/login');
    });

    it('captures http_status_code from response', async () => {
      const ctx = makeContext(defaultReq, { statusCode: 201 });
      await firstValueFrom(interceptor.intercept(ctx, makeHandler()));

      const logged = auditService.log.mock.calls[0][0];
      expect(logged.http_status_code).toBe(201);
    });

    it('captures ip from x-forwarded-for header', async () => {
      const req = {
        ...defaultReq,
        headers: {
          'x-forwarded-for': '10.0.0.1, 10.0.0.2',
          'user-agent': 'jest',
        },
      } as unknown as Request;

      const ctx = makeContext(req, { statusCode: 200 });
      await firstValueFrom(interceptor.intercept(ctx, makeHandler()));

      const logged = auditService.log.mock.calls[0][0];
      expect(logged.ip_address).toBe('10.0.0.1');
    });

    it('captures request_id from CLS', async () => {
      const ctx = makeContext(defaultReq, { statusCode: 200 });
      await firstValueFrom(interceptor.intercept(ctx, makeHandler()));

      const logged = auditService.log.mock.calls[0][0];
      expect(logged.request_id).toBe('cls-request-id');
    });

    it('returns null request_id when CLS throws', async () => {
      clsService.getId.mockImplementationOnce(() => {
        throw new Error('CLS not active');
      });

      const ctx = makeContext(defaultReq, { statusCode: 200 });
      await firstValueFrom(interceptor.intercept(ctx, makeHandler()));

      const logged = auditService.log.mock.calls[0][0];
      expect(logged.request_id).toBeNull();
    });

    it('records a positive duration_ms', async () => {
      const ctx = makeContext(defaultReq, { statusCode: 200 });
      await firstValueFrom(interceptor.intercept(ctx, makeHandler()));

      const logged = auditService.log.mock.calls[0][0];
      expect(logged.duration_ms).toBeGreaterThanOrEqual(0);
    });

    it('sets error_message to null on success', async () => {
      const ctx = makeContext(defaultReq, { statusCode: 200 });
      await firstValueFrom(interceptor.intercept(ctx, makeHandler()));

      const logged = auditService.log.mock.calls[0][0];
      expect(logged.error_message).toBeNull();
    });

    it('uses targetEntity from metadata when provided', async () => {
      reflector.get.mockReturnValue({
        ...defaultMetadata,
        targetEntity: 'Employee',
      } as AuditMetadata);

      const ctx = makeContext(defaultReq, { statusCode: 200 });
      await firstValueFrom(interceptor.intercept(ctx, makeHandler()));

      const logged = auditService.log.mock.calls[0][0];
      expect(logged.target_entity).toBe('Employee');
    });

    it('resolves targetId from req.params using targetParam', async () => {
      reflector.get.mockReturnValue({
        ...defaultMetadata,
        targetParam: 'id',
      } as AuditMetadata);

      const req = {
        ...defaultReq,
        params: { id: 'entity-uuid-123' },
      } as unknown as Request;

      const ctx = makeContext(req, { statusCode: 200 });
      await firstValueFrom(interceptor.intercept(ctx, makeHandler()));

      const logged = auditService.log.mock.calls[0][0];
      expect(logged.target_id).toBe('entity-uuid-123');
    });

    it('calls extractMetadata and sanitizes result', async () => {
      const extractMetadata = jest.fn().mockReturnValue({
        userId: 'u-1',
        password: 'should-be-redacted',
      });

      reflector.get.mockReturnValue({
        ...defaultMetadata,
        extractMetadata,
      } as AuditMetadata);

      const ctx = makeContext(defaultReq, { statusCode: 200 });
      await firstValueFrom(interceptor.intercept(ctx, makeHandler()));

      const logged = auditService.log.mock.calls[0][0];
      expect(logged.metadata?.userId).toBe('u-1');
      expect(logged.metadata?.password).toBe('[REDACTED]');
    });

    it('sets metadata to null when no extractMetadata provided', async () => {
      const ctx = makeContext(defaultReq, { statusCode: 200 });
      await firstValueFrom(interceptor.intercept(ctx, makeHandler()));

      const logged = auditService.log.mock.calls[0][0];
      expect(logged.metadata).toBeNull();
    });
  });

  describe('failed request (error path)', () => {
    beforeEach(() => {
      reflector.get.mockReturnValue(defaultMetadata);
    });

    it('logs audit entry on error and re-throws', async () => {
      const error = { status: 403, message: 'Forbidden' };
      const ctx = makeContext(defaultReq);
      const handler = makeErrorHandler(error);

      await expect(
        firstValueFrom(interceptor.intercept(ctx, handler)),
      ).rejects.toMatchObject(error);

      expect(auditService.log).toHaveBeenCalledTimes(1);
    });

    it('captures the error message', async () => {
      const error = { status: 400, message: 'Bad input' };
      const ctx = makeContext(defaultReq);

      await expect(
        firstValueFrom(interceptor.intercept(ctx, makeErrorHandler(error))),
      ).rejects.toBeDefined();

      const logged = auditService.log.mock.calls[0][0];
      expect(logged.error_message).toBe('Bad input');
    });

    it('uses error.status for http_status_code', async () => {
      const error = { status: 422, message: 'Unprocessable' };
      const ctx = makeContext(defaultReq);

      await expect(
        firstValueFrom(interceptor.intercept(ctx, makeErrorHandler(error))),
      ).rejects.toBeDefined();

      const logged = auditService.log.mock.calls[0][0];
      expect(logged.http_status_code).toBe(422);
    });

    it('falls back to 500 when error has no status', async () => {
      const ctx = makeContext(defaultReq);

      await expect(
        firstValueFrom(
          interceptor.intercept(ctx, makeErrorHandler(new Error('crash'))),
        ),
      ).rejects.toBeDefined();

      const logged = auditService.log.mock.calls[0][0];
      expect(logged.http_status_code).toBe(500);
    });

    it('sets metadata to null on error path', async () => {
      const ctx = makeContext(defaultReq);

      await expect(
        firstValueFrom(
          interceptor.intercept(ctx, makeErrorHandler({ status: 500 })),
        ),
      ).rejects.toBeDefined();

      const logged = auditService.log.mock.calls[0][0];
      expect(logged.metadata).toBeNull();
    });
  });

  describe('anonymous request (no user)', () => {
    it('logs null actor_id and actor_role for unauthenticated requests', async () => {
      reflector.get.mockReturnValue(defaultMetadata);
      const req = { ...defaultReq, user: undefined } as unknown as Request;
      const ctx = makeContext(req, { statusCode: 200 });

      await firstValueFrom(interceptor.intercept(ctx, makeHandler()));

      const logged = auditService.log.mock.calls[0][0];
      expect(logged.actor_id).toBeNull();
      expect(logged.actor_role).toBeNull();
    });
  });
});
