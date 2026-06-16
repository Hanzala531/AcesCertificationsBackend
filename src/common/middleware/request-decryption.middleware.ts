import { BadRequestException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { PayloadCryptoUtil } from '../security/payload-crypto.util';

type DecryptableBody = {
  payload?: unknown;
  encryptedPayload?: unknown;
};

export function requestDecryptionMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (!PayloadCryptoUtil.isEncryptionEnabled()) {
    return next();
  }

  if (PayloadCryptoUtil.shouldBypassEncryption(req)) {
    return next();
  }

  const contentType = req.headers['content-type'] || '';
  const isMultipart =
    typeof contentType === 'string' &&
    contentType.toLowerCase().includes('multipart/form-data');
  if (isMultipart) {
    const path = req.path || req.url || '';
    const isUploadRoute = path.includes('/uploads');
    if (isUploadRoute) {
      return next();
    }
    return next(new BadRequestException('Encrypted payload is required'));
  }

  const body = req.body as DecryptableBody | undefined;
  if (!body || typeof body !== 'object') {
    return next();
  }

  const encryptedPayload = body.encryptedPayload ?? body.payload;
  if (typeof encryptedPayload !== 'string') {
    if (Object.keys(body).length === 0) {
      return next();
    }
    return next(new BadRequestException('Encrypted payload is required'));
  }

  try {
    req.body = PayloadCryptoUtil.decrypt<unknown>(encryptedPayload);
    return next();
  } catch {
    return next(new BadRequestException('Invalid encrypted payload'));
  }
}
