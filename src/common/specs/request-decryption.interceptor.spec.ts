import {
  BadRequestException,
  type CallHandler,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import { firstValueFrom, of } from 'rxjs';
import { PayloadCryptoUtil } from '../security/payload-crypto.util';
import { RequestDecryptionInterceptor } from '../interceptors/request-decryption.interceptor';

describe('RequestDecryptionInterceptor', () => {
  const originalEnabled = process.env.API_PAYLOAD_ENCRYPTION_ENABLED;
  const originalKey = process.env.API_PAYLOAD_ENCRYPTION_KEY;

  afterEach(() => {
    process.env.API_PAYLOAD_ENCRYPTION_ENABLED = originalEnabled;
    process.env.API_PAYLOAD_ENCRYPTION_KEY = originalKey;
  });

  function makeContext(req: Request): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as ExecutionContext;
  }

  it('decrypts wrapped payload for post request', async () => {
    process.env.API_PAYLOAD_ENCRYPTION_ENABLED = 'true';
    process.env.API_PAYLOAD_ENCRYPTION_KEY = 'test-secret';

    const plain = { email: 'admin@example.com', password: 'x' };
    const encrypted = PayloadCryptoUtil.encrypt(plain);
    const req = {
      method: 'POST',
      path: '/api/auth/login',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      body: { payload: encrypted },
    } as unknown as Request;

    const interceptor = new RequestDecryptionInterceptor();
    const handler: CallHandler = { handle: () => of({ ok: true }) };

    await firstValueFrom(interceptor.intercept(makeContext(req), handler));
    expect(req.body).toEqual(plain);
  });

  it('rejects plain json body when encryption is enabled', () => {
    process.env.API_PAYLOAD_ENCRYPTION_ENABLED = 'true';
    process.env.API_PAYLOAD_ENCRYPTION_KEY = 'test-secret';

    const req = {
      method: 'POST',
      path: '/api/auth/login',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      body: { email: 'admin@example.com', password: 'x' },
    } as unknown as Request;

    const interceptor = new RequestDecryptionInterceptor();
    const handler: CallHandler = { handle: () => of({ ok: true }) };

    expect(() => interceptor.intercept(makeContext(req), handler)).toThrow(
      BadRequestException,
    );
  });
});
