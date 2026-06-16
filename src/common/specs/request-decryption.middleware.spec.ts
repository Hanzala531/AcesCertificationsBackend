import { BadRequestException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { requestDecryptionMiddleware } from '../middleware/request-decryption.middleware';
import { PayloadCryptoUtil } from '../security/payload-crypto.util';

describe('requestDecryptionMiddleware', () => {
  const originalEnabled = process.env.API_PAYLOAD_ENCRYPTION_ENABLED;
  const originalKey = process.env.API_PAYLOAD_ENCRYPTION_KEY;

  afterEach(() => {
    process.env.API_PAYLOAD_ENCRYPTION_ENABLED = originalEnabled;
    process.env.API_PAYLOAD_ENCRYPTION_KEY = originalKey;
  });

  it('replaces req.body with decrypted payload when present', () => {
    process.env.API_PAYLOAD_ENCRYPTION_ENABLED = 'true';
    process.env.API_PAYLOAD_ENCRYPTION_KEY = 'test-secret-key';

    const raw = { score: 99, remarks: 'ok' };
    const encrypted = PayloadCryptoUtil.encrypt(raw);

    const req = {
      body: { payload: encrypted },
      headers: { 'content-type': 'application/json' },
      path: '/api/test',
      url: '/api/test',
    } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn() as NextFunction;

    requestDecryptionMiddleware(req, res, next);

    expect(req.body).toEqual(raw);
    expect(next).toHaveBeenCalledWith();
  });

  it('passes bad request exception when encrypted payload is invalid', () => {
    process.env.API_PAYLOAD_ENCRYPTION_ENABLED = 'true';
    process.env.API_PAYLOAD_ENCRYPTION_KEY = 'test-secret-key';

    const req = {
      body: { payload: 'invalid' },
      headers: { 'content-type': 'application/json' },
      path: '/api/test',
      url: '/api/test',
    } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn() as NextFunction;

    requestDecryptionMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as jest.Mock).mock.calls[0][0] as unknown;
    expect(error).toBeInstanceOf(BadRequestException);
  });

  it('rejects plain json body when encryption is enabled', () => {
    process.env.API_PAYLOAD_ENCRYPTION_ENABLED = 'true';
    process.env.API_PAYLOAD_ENCRYPTION_KEY = 'test-secret-key';

    const req = {
      body: { name: 'plain-json' },
      headers: { 'content-type': 'application/json' },
      path: '/api/test',
      url: '/api/test',
    } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn() as NextFunction;

    requestDecryptionMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as jest.Mock).mock.calls[0][0] as unknown;
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).message).toContain(
      'Encrypted payload is required',
    );
  });

  it('rejects multipart request on non-upload route when encryption is enabled', () => {
    process.env.API_PAYLOAD_ENCRYPTION_ENABLED = 'true';
    process.env.API_PAYLOAD_ENCRYPTION_KEY = 'test-secret-key';

    const req = {
      body: { email: 'test@example.com' },
      headers: { 'content-type': 'multipart/form-data; boundary=----abc' },
      path: '/api/auth/login',
      url: '/api/auth/login',
    } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn() as NextFunction;

    requestDecryptionMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as jest.Mock).mock.calls[0][0] as unknown;
    expect(error).toBeInstanceOf(BadRequestException);
  });

  it('allows multipart request on upload route', () => {
    process.env.API_PAYLOAD_ENCRYPTION_ENABLED = 'true';
    process.env.API_PAYLOAD_ENCRYPTION_KEY = 'test-secret-key';

    const req = {
      body: { file: 'binary' },
      headers: { 'content-type': 'multipart/form-data; boundary=----abc' },
      path: '/api/uploads/file',
      url: '/api/uploads/file',
    } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn() as NextFunction;

    requestDecryptionMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });
});
