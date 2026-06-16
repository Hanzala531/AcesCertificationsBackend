const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'secret',
  'otp',
  'cvv',
  'pin',
  'authorization',
  'cookie',
  'refreshtoken',
  'accesstoken',
  'cardnumber',
  'refreshToken',
  'accessToken',
  'cardNumber',
]);

const MAX_STRING_LENGTH = 500;

export function sanitizeMetadata(
  data: Record<string, unknown>,
): Record<string, unknown> {
  if (!data || typeof data !== 'object') return {};

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key) || SENSITIVE_KEYS.has(key.toLowerCase())) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'string') {
      result[key] =
        value.length > MAX_STRING_LENGTH
          ? value.slice(0, MAX_STRING_LENGTH) + '...[truncated]'
          : value;
    } else if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      result[key] = sanitizeMetadata(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  return result;
}
