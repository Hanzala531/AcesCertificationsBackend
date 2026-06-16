import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  organization_id?: string;
  employee_id?: string;
  auditor_id?: string;
  reviewer_id?: string;
  industry_id?: string;
  iat?: number;
  exp?: number;
}

interface RequestWithCookies {
  cookies?: {
    access_token?: string;
  };
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor() {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error(
        'JWT_SECRET environment variable is required. Application cannot start without it.',
      );
    }

    super({
      jwtFromRequest: (req: RequestWithCookies) => {
        if (!req) return null;
        const cookieToken = req.cookies?.access_token;
        if (cookieToken) return cookieToken;
        return ExtractJwt.fromAuthHeaderAsBearerToken()(req as Request);
      },
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  validate(payload: JwtPayload) {
    this.logger.debug(
      `🔐 JWT Validated - User: ${payload.email}, Role: "${payload.role}", Sub: ${payload.sub}`,
    );

    const user = {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      organization_id: payload.organization_id,
      employee_id: payload.employee_id,
      auditor_id: payload.auditor_id,
      reviewer_id: payload.reviewer_id,
      industry_id: payload.industry_id,
    };

    this.logger.debug(`🔐 Returning user object: ${JSON.stringify(user)}`);
    return user;
  }
}
