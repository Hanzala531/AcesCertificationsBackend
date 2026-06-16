import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

interface RequestWithUser {
  user?: {
    role: string;
    [key: string]: unknown;
  };
}

@Injectable()
export class RoleGuard implements CanActivate {
  private readonly logger = new Logger(RoleGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>(
      'roles',
      context.getHandler(),
    );
    if (!requiredRoles) {
      this.logger.debug('⚠️  No specific roles required for this endpoint');
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user) {
      this.logger.error('❌ User not found in request');
      throw new ForbiddenException('User not found');
    }

    const userRole = user.role;
    this.logger.debug(
      `🔍 Checking role - Required: [${requiredRoles.join(', ')}], User has: "${userRole}"`,
    );

    const hasRole = requiredRoles.includes(userRole);
    if (!hasRole) {
      this.logger.error(
        `❌ Role mismatch - User "${userRole}" not in required roles [${requiredRoles.join(', ')}]`,
      );
      throw new ForbiddenException('Insufficient permissions');
    }

    this.logger.debug(`✅ Role "${userRole}" authorized`);
    return true;
  }
}
