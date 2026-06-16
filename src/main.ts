// Prefer IPv4 when resolving hostnames. Neon publishes both A (IPv4) and AAAA
// (IPv6) records, but many machines have no working IPv6 route — Node then wastes
// time/fails on the IPv6 address (ENETUNREACH) before falling back to IPv4, which
// shows up as AggregateError [ETIMEDOUT] on DB connect. Forcing IPv4-first avoids it.
import * as dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

import { NestFactory } from '@nestjs/core';
import { RequestMethod } from '@nestjs/common';
import { ValidationPipe, Logger, BadRequestException } from '@nestjs/common';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { RequestDecryptionInterceptor } from './common/interceptors/request-decryption.interceptor';
import { ResponseEncryptionInterceptor } from './common/interceptors/response-encryption.interceptor';
import { PayloadCryptoUtil } from './common/security/payload-crypto.util';
import { INestApplication } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Server } from 'http';
import helmet from 'helmet';
import {
  getAllowedCorsOrigins,
  isCorsOriginAllowed,
} from './common/config/cors.config';

function validateEnvironment() {
  const logger = new Logger('Environment');
  const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];

  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName],
  );

  if (missingVars.length > 0) {
    logger.error(
      `❌ Missing required environment variables: ${missingVars.join(', ')}`,
    );
    process.exit(1);
  }

  if (
    process.env.JWT_SECRET === 'change-me' ||
    process.env.JWT_REFRESH_SECRET === 'change-me-refresh'
  ) {
    logger.warn(
      '⚠️  WARNING: Using default JWT secrets. Please set secure values in production!',
    );
  }
  if (
    PayloadCryptoUtil.isEncryptionEnabled() &&
    !process.env.API_PAYLOAD_ENCRYPTION_KEY
  ) {
    logger.error(
      'API_PAYLOAD_ENCRYPTION_KEY must be set when API_PAYLOAD_ENCRYPTION_ENABLED=true',
    );
    process.exit(1);
  }
  logger.log('✅ Environment validation passed');
}

let app: INestApplication | undefined;
let appPromise: Promise<INestApplication> | undefined;

async function createApp(): Promise<INestApplication> {
  if (app) return app;

  if (appPromise) return appPromise;

  appPromise = (async () => {
    validateEnvironment();
    app = await NestFactory.create(AppModule, { bufferLogs: true });
    const logger = new Logger('Bootstrap');
    const allowedCorsOrigins = getAllowedCorsOrigins();
    app.getHttpAdapter().getInstance().set('trust proxy', 1);

    app.setGlobalPrefix('api', {
      exclude: [
        { path: '', method: RequestMethod.GET },
        { path: 'api-json', method: RequestMethod.GET },
      ],
    });

    app.getHttpAdapter().get('/api', (_req: Request, res: Response) => {
      res.status(200).json({
        success: true,
        message: 'Aces Certifications API',
        docs: '/api/docs',
      });
    });

    app.use(
      helmet({
        contentSecurityPolicy: false, // Disabled — frontend is separate origin
        crossOriginEmbedderPolicy: false, // Allow embedding (Stripe, Cloudinary)
      }),
    );

    app.enableCors({
      origin: (origin, callback) => {
        if (isCorsOriginAllowed(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error(`CORS blocked for origin: ${origin}`), false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Cookie',
        'X-Requested-With',
        'Accept',
        'Origin',
      ],
      exposedHeaders: ['Set-Cookie'],
    });

    if (allowedCorsOrigins.length > 0) {
      logger.log(`CORS enabled for origins: ${allowedCorsOrigins.join(', ')}`);
    } else {
      logger.warn('CORS_ORIGINS is empty.');
    }

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        stopAtFirstError: true,
        transform: true,
        exceptionFactory: (errors) => {
          const flatten = (errs: any[]): string[] =>
            errs.reduce((acc: string[], err: any) => {
              if (err.constraints) {
                acc.push(
                  ...Object.values(err.constraints as Record<string, string>),
                );
              }
              if (err.children && err.children.length) {
                acc.push(...flatten(err.children));
              }
              return acc;
            }, []);

          const messages = flatten(errors as any[]);
          return new BadRequestException(
            messages.length > 0 ? messages : 'Validation failed',
          );
        },
      }),
    );

    app.useGlobalFilters(new AllExceptionsFilter());

    app.useGlobalInterceptors(
      new RequestDecryptionInterceptor(),
      new LoggingInterceptor(),
      new ResponseEncryptionInterceptor(),
    );

    const tagOrder = [
      '🏠 Root',
      '🔐 Authentication',
      '👤 Subadmin Management',
      '👁️ Reviewer Management',
      '👨‍⚖️ Auditor Management',
      '🏢 Organization Profile',
      '🏢 Branch Management',
      '👥 Employee Management',
      '💳 Payments',
      '🔔 Notifications',
      '🏅 Badges',
      '🏭 Industries',
      '📤 Uploads',
      'Certificates',
      '📋 Assessments',
      '💬 Chat',
      '🤖 AI Reviews',
    ];

    const config = new DocumentBuilder()
      .setTitle('Aces Certifications API')
      .setDescription('API for user management and authentication')
      .setVersion('1.0.0')
      .addTag('🏠 Root', 'Health check and API information')
      .addTag(
        '🔐 Authentication',
        'User registration, login, and token management',
      )
      .addTag(
        '👤 Subadmin Management',
        'Subadmin account and permissions management',
      )
      .addTag(
        '👁️ Reviewer Management',
        'Reviewer profile and assignment management',
      )
      .addTag(
        '👨‍⚖️ Auditor Management',
        'Auditor profile and assignment management',
      )
      .addTag('🏢 Organization Profile', 'Organization management and profile')
      .addTag('🏢 Branch Management', 'Branch operations and management')
      .addTag(
        '👥 Employee Management',
        'Employee account and permissions management',
      )
      .addTag('💳 Payments', 'Payment processing and management')
      .addTag('🔔 Notifications', 'Notification settings and management')
      .addTag('🏅 Badges', 'Badge allocation and management')
      .addTag('🏭 Industries', 'Industry management')
      .addTag('📤 Uploads', 'File upload operations')
      .addTag('Certificates', 'Certificate creation and management')
      .addTag(
        '📋 Assessments',
        'Assessment creation, submission, and management',
      )
      .addTag('💬 Chat', 'Assessment-scoped real-time messaging')
      .addTag('🤖 AI Reviews', 'AI-powered assessment review and analysis')
      .addServer('/', 'Current Deployment (Same Origin)')
      .addServer('https://aces-test.vercel.app', 'Production')
      .addServer('https://aces-test-2.vercel.app', 'Production')
      .addServer('https://new-aces.vercel.app', 'Encrypted Payload')
      .addServer('https://new-aces-test.vercel.app', 'Simple Payload')
      .addServer('http://localhost:3000', 'Development')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'Authorization',
          description: 'Enter your JWT token (without "Bearer " prefix)',
          in: 'header',
        },
        'JWT-auth',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);

    if (document.tags && Array.isArray(document.tags)) {
      document.tags.sort((a, b) => {
        const nameA = a.name || '';
        const nameB = b.name || '';
        const indexA = tagOrder.indexOf(nameA);
        const indexB = tagOrder.indexOf(nameB);

        if (indexA !== -1 && indexB !== -1) {
          return indexA - indexB;
        }

        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;

        return nameA.localeCompare(nameB);
      });
    }

    const swaggerOptions = {
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        docExpansion: 'list',
        filter: true,
        showRequestHeaders: true,
        tryItOutEnabled: true,
      },
      ...(process.env.VERCEL && {
        customCssUrl:
          'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.min.css',
        customJs: [
          'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.min.js',
          'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-standalone-preset.min.js',
        ],
      }),
    };

    SwaggerModule.setup('api/docs', app, document, swaggerOptions);

    app.getHttpAdapter().get('/api-json', (_req: Request, res: Response) => {
      res.json(document);
    });

    await app.init();
    return app;
  })();

  return appPromise;
}

// Vercel handler with timeout and error handling
export const handler = async (req: Request, res: Response) => {
  try {
    const nestApp = await Promise.race([
      createApp(),
      new Promise<INestApplication>((_, reject) =>
        setTimeout(
          () => reject(new Error('App initialization timeout')),
          30000,
        ),
      ),
    ]);

    const server = nestApp.getHttpAdapter().getInstance() as Server &
      ((req: Request, res: Response) => void);
    return server(req, res);
  } catch (error) {
    console.error('Vercel handler error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error - initialization failed',
      timestamp: new Date().toISOString(),
      path: req.url,
    });
  }
};

export default handler;

async function bootstrap() {
  const nestApp = await createApp();
  const port = process.env.PORT || 3000;
  await nestApp.listen(port, '::');
  Logger.log(`Server running at http://localhost:${port}`);
  Logger.log(`Swagger docs available at http://localhost:${port}/api/docs`);
}

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

if (!process.env.VERCEL) {
  bootstrap().catch((err) => {
    console.error('Failed to start application:', err);
    process.exit(1);
  });
}
