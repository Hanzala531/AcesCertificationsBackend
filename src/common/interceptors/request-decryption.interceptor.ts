import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { PayloadCryptoUtil } from '../security/payload-crypto.util';

type DecryptableBody = {
  payload?: unknown;
  encryptedPayload?: unknown;
};

@Injectable()
export class RequestDecryptionInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();

    if (!PayloadCryptoUtil.isEncryptionEnabled()) {
      return next.handle();
    }

    if (PayloadCryptoUtil.shouldBypassEncryption(request)) {
      return next.handle();
    }

    const method = (request.method || '').toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return next.handle();
    }

    const contentType = request.headers['content-type'] || '';
    const isMultipart =
      typeof contentType === 'string' &&
      contentType.toLowerCase().includes('multipart/form-data');
    if (isMultipart) {
      const path = request.path || request.url || '';
      if (path.includes('/uploads')) {
        return next.handle();
      }
      throw new BadRequestException('Encrypted payload is required');
    }

    const body = request.body as DecryptableBody | undefined;
    if (!body || typeof body !== 'object') {
      return next.handle();
    }

    const encryptedPayload = body.encryptedPayload ?? body.payload;
    if (typeof encryptedPayload !== 'string') {
      if (Object.keys(body).length === 0) {
        return next.handle();
      }
      throw new BadRequestException('Encrypted payload is required');
    }

    try {
      request.body = PayloadCryptoUtil.decrypt<unknown>(encryptedPayload);
      return next.handle();
    } catch {
      throw new BadRequestException('Invalid encrypted payload');
    }
  }
}
