import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { throwError } from 'rxjs';

interface HttpError {
  status?: number;
  message?: string;
  stack?: string;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private logger = new Logger('HTTP Request');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, ip, headers } = request;
    const userAgent = headers['user-agent'] || 'Unknown';

    const startTime = Date.now();

    this.logger.log(`[${method}] ${url} | IP: ${ip} | UserAgent: ${userAgent}`);

    return next.handle().pipe(
      tap(() => {
        const responseTime = Date.now() - startTime;
        this.logger.log(
          `[${method}] ${url} | Status: ${context.switchToHttp().getResponse<Response>().statusCode} | ResponseTime: ${responseTime}ms`,
        );
      }),
      catchError((error: HttpError) => {
        const responseTime = Date.now() - startTime;
        const statusCode =
          (error as Record<string, number | undefined>).status || 500;
        const errorMessage =
          (error as Record<string, string | undefined>).message ||
          'Internal Server Error';

        this.logger.error(
          `[${method}] ${url} | Status: ${statusCode} | Error: ${errorMessage} | ResponseTime: ${responseTime}ms`,
          (error as Record<string, string | undefined>).stack,
        );

        return throwError(() => error);
      }),
    );
  }
}
