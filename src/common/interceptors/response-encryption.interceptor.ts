import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, map } from 'rxjs';
import { PayloadCryptoUtil } from '../security/payload-crypto.util';

@Injectable()
export class ResponseEncryptionInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    if (!PayloadCryptoUtil.isEncryptionEnabled()) {
      return next.handle();
    }

    if (PayloadCryptoUtil.shouldBypassEncryption(request)) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data: unknown) => {
        if (data instanceof StreamableFile || Buffer.isBuffer(data)) {
          return data;
        }

        response.setHeader('x-response-encrypted', 'true');
        return { payload: PayloadCryptoUtil.encrypt(data) };
      }),
    );
  }
}
