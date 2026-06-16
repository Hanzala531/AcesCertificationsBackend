import { sanitizeMetadata } from '../utils/sanitize.util';

describe('sanitizeMetadata', () => {
  describe('sensitive key redaction', () => {
    it('redacts "password" key', () => {
      const result = sanitizeMetadata({ password: 'secret123', name: 'John' });
      expect(result.password).toBe('[REDACTED]');
      expect(result.name).toBe('John');
    });

    it('redacts "token" key', () => {
      const result = sanitizeMetadata({ token: 'abc.def.ghi' });
      expect(result.token).toBe('[REDACTED]');
    });

    it('redacts "secret" key', () => {
      const result = sanitizeMetadata({ secret: 'my-secret' });
      expect(result.secret).toBe('[REDACTED]');
    });

    it('redacts "otp" key', () => {
      const result = sanitizeMetadata({ otp: '123456' });
      expect(result.otp).toBe('[REDACTED]');
    });

    it('redacts "cvv" key', () => {
      const result = sanitizeMetadata({ cvv: '123' });
      expect(result.cvv).toBe('[REDACTED]');
    });

    it('redacts "pin" key', () => {
      const result = sanitizeMetadata({ pin: '4321' });
      expect(result.pin).toBe('[REDACTED]');
    });

    it('redacts "authorization" key', () => {
      const result = sanitizeMetadata({ authorization: 'Bearer token' });
      expect(result.authorization).toBe('[REDACTED]');
    });

    it('redacts "cookie" key', () => {
      const result = sanitizeMetadata({ cookie: 'session=abc' });
      expect(result.cookie).toBe('[REDACTED]');
    });

    it('redacts "refreshToken" camelCase key', () => {
      const result = sanitizeMetadata({ refreshToken: 'rt-abc' });
      expect(result.refreshToken).toBe('[REDACTED]');
    });

    it('redacts "accessToken" camelCase key', () => {
      const result = sanitizeMetadata({ accessToken: 'at-abc' });
      expect(result.accessToken).toBe('[REDACTED]');
    });

    it('redacts "cardNumber" camelCase key', () => {
      const result = sanitizeMetadata({ cardNumber: '4111111111111111' });
      expect(result.cardNumber).toBe('[REDACTED]');
    });

    it('redacts case-insensitive keys', () => {
      const result = sanitizeMetadata({ PASSWORD: 'secret' });
      expect(result.PASSWORD).toBe('[REDACTED]');
    });
  });

  describe('string truncation', () => {
    it('passes through strings under 500 chars unchanged', () => {
      const short = 'a'.repeat(100);
      const result = sanitizeMetadata({ note: short });
      expect(result.note).toBe(short);
    });

    it('truncates strings over 500 chars', () => {
      const long = 'b'.repeat(600);
      const result = sanitizeMetadata({ note: long });
      expect(result.note).toBe('b'.repeat(500) + '...[truncated]');
    });

    it('truncates strings at exactly 501 chars', () => {
      const borderline = 'c'.repeat(501);
      const result = sanitizeMetadata({ note: borderline });
      expect((result.note as string).endsWith('...[truncated]')).toBe(true);
    });

    it('passes through string of exactly 500 chars unchanged', () => {
      const exact = 'd'.repeat(500);
      const result = sanitizeMetadata({ note: exact });
      expect(result.note).toBe(exact);
    });
  });

  describe('nested objects', () => {
    it('recursively sanitizes nested objects', () => {
      const result = sanitizeMetadata({
        user: {
          name: 'Alice',
          password: 'hunter2',
        },
      });
      expect((result.user as Record<string, unknown>).name).toBe('Alice');
      expect((result.user as Record<string, unknown>).password).toBe(
        '[REDACTED]',
      );
    });

    it('does not recurse into arrays', () => {
      const result = sanitizeMetadata({ tags: ['a', 'b', 'c'] });
      expect(result.tags).toEqual(['a', 'b', 'c']);
    });
  });

  describe('non-string safe values', () => {
    it('passes through numbers', () => {
      const result = sanitizeMetadata({ count: 42 });
      expect(result.count).toBe(42);
    });

    it('passes through booleans', () => {
      const result = sanitizeMetadata({ active: true });
      expect(result.active).toBe(true);
    });

    it('passes through null values', () => {
      const result = sanitizeMetadata({ field: null });
      expect(result.field).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('returns empty object for empty input', () => {
      expect(sanitizeMetadata({})).toEqual({});
    });

    it('handles multiple sensitive and safe keys together', () => {
      const result = sanitizeMetadata({
        userId: 'u-123',
        email: 'user@test.com',
        password: 'secret',
        token: 'tok',
        action: 'login',
      });
      expect(result.userId).toBe('u-123');
      expect(result.email).toBe('user@test.com');
      expect(result.password).toBe('[REDACTED]');
      expect(result.token).toBe('[REDACTED]');
      expect(result.action).toBe('login');
    });
  });
});
