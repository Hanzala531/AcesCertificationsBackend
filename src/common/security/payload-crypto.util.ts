import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';
import type { Request } from 'express';

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

export class PayloadCryptoUtil {
  private static readonly PAYLOAD_SEPARATOR = '.';

  static isEncryptionEnabled(): boolean {
    const value = process.env.API_PAYLOAD_ENCRYPTION_ENABLED;
    return value ? TRUE_VALUES.has(value.trim().toLowerCase()) : false;
  }

  static shouldBypassEncryption(request: Request): boolean {
    const path = request.path || request.url || '';
    return path.includes('/api/docs') || path.includes('/api-json');
  }

  static encrypt(value: unknown): string {
    const key = this.getKeyBuffer();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const plaintext = JSON.stringify(value);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [
      iv.toString('base64url'),
      authTag.toString('base64url'),
      encrypted.toString('base64url'),
    ].join(this.PAYLOAD_SEPARATOR);
  }

  static decrypt<T>(payload: string): T {
    const [ivPart, tagPart, encryptedPart, ...rest] = payload.split(
      this.PAYLOAD_SEPARATOR,
    );

    if (!ivPart || !tagPart || !encryptedPart || rest.length > 0) {
      throw new Error('Invalid encrypted payload format');
    }

    const iv = Buffer.from(ivPart, 'base64url');
    const authTag = Buffer.from(tagPart, 'base64url');
    const encrypted = Buffer.from(encryptedPart, 'base64url');
    const key = this.getKeyBuffer();

    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8');

    return JSON.parse(decrypted) as T;
  }

  private static getKeyBuffer(): Buffer {
    const rawKey = process.env.API_PAYLOAD_ENCRYPTION_KEY;

    if (!rawKey) {
      throw new Error(
        'API_PAYLOAD_ENCRYPTION_KEY is not configured while payload encryption is enabled',
      );
    }

    return createHash('sha256').update(rawKey).digest();
  }
}
