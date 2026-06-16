import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_METADATA_KEY = 'rate_limit_metadata';

export interface RateLimitOptions {
  max?: number;
  windowMs?: number;
  skip?: boolean;
  group?: string;
}

export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_METADATA_KEY, options);
