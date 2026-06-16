import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';
import { of, firstValueFrom } from 'rxjs';
import { ResponseEncryptionInterceptor } from '../interceptors/response-encryption.interceptor';
import { PayloadCryptoUtil } from '../security/payload-crypto.util';

describe('ResponseEncryptionInterceptor', () => {
  const originalEnabled = process.env.API_PAYLOAD_ENCRYPTION_ENABLED;
  const originalKey = process.env.API_PAYLOAD_ENCRYPTION_KEY;

  afterEach(() => {
    process.env.API_PAYLOAD_ENCRYPTION_ENABLED = originalEnabled;
    process.env.API_PAYLOAD_ENCRYPTION_KEY = originalKey;
  });

  it('returns encrypted payload when encryption is enabled', async () => {
    process.env.API_PAYLOAD_ENCRYPTION_ENABLED = 'true';
    process.env.API_PAYLOAD_ENCRYPTION_KEY = 'test-secret-key';

    const req = { path: '/api/test', url: '/api/test' } as Request;
    const res = { setHeader: jest.fn() } as unknown as Response;

    const context = {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as ExecutionContext;

    const handler: CallHandler = {
      handle: () => of({ ok: true }),
    };

    const interceptor = new ResponseEncryptionInterceptor();
    const result = await firstValueFrom(
      interceptor.intercept(context, handler),
    );
    const output = result as { payload: string };
    const decrypted = PayloadCryptoUtil.decrypt<{ ok: boolean }>(
      output.payload,
    );

    expect(decrypted).toEqual({ ok: true });
    expect(res.setHeader).toHaveBeenCalledWith('x-response-encrypted', 'true');
  });
});
