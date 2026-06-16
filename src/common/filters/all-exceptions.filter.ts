import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PayloadCryptoUtil } from '../security/payload-crypto.util';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (res && typeof res === 'object' && (res as any).message) {
        message = (res as any).message;
      }
    } else if (exception && typeof exception === 'object') {
      message = (exception as any).message ?? message;
    }

    const stack =
      exception instanceof Error
        ? exception.stack || ''
        : '';
    const requestLabel = `${request.method} ${request.url}`;

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(`HTTP ${status} - ${message} | ${requestLabel}`, stack);
    } else {
      this.logger.warn(`HTTP ${status} - ${message} | ${requestLabel}`);
    }

    const errorBody = {
      success: false,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (
      PayloadCryptoUtil.isEncryptionEnabled() &&
      !PayloadCryptoUtil.shouldBypassEncryption(request)
    ) {
      response.setHeader('x-response-encrypted', 'true');
      response.status(status).json({
        payload: PayloadCryptoUtil.encrypt(errorBody),
      });
      return;
    }

    response.status(status).json(errorBody);
  }
}
