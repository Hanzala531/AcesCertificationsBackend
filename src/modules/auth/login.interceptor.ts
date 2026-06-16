import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { UsersService } from '../users/users.service';
import { resolveRequestLocation } from '../../common/utils/request-location.util';

@Injectable()
export class LoginInterceptor implements NestInterceptor {
  constructor(private usersService: UsersService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const method = request.method;
    const url = request.url;

    return next.handle().pipe(
      mergeMap(async (data: Record<string, unknown>) => {
        if (
          method === 'POST' &&
          url.includes('/auth/login') &&
          response.statusCode === 201
        ) {
          try {
            const userId = (data as Record<string, Record<string, string>>)
              ?.user?.id;
            if (userId) {
              const device = request.get('User-Agent') || 'Unknown';
              const location = await resolveRequestLocation(request);
              const name =
                (data as Record<string, Record<string, string>>)?.user?.email ||
                'Unknown';
              await this.usersService.insertLoginLog(
                userId,
                name,
                device,
                location,
              );
            }
          } catch (e) {
            const errorMsg = (e as Record<string, string>).message ?? String(e);
            console.error('Failed to log login', errorMsg);
          }
        }
        return data;
      }),
    );
  }
}
