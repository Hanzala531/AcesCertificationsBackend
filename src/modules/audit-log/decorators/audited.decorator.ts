import { SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import { AuditAction, AuditCategory } from '../enums/audit.enums';

export const AUDIT_METADATA_KEY = 'audit:metadata';

export interface AuditMetadata {
  action: AuditAction | string;
  category: AuditCategory;
  targetEntity?: string;
  targetParam?: string;
  extractMetadata?: (req: Request, res: unknown) => Record<string, unknown>;
}

export const Audited = (
  action: AuditAction | string,
  category: AuditCategory,
  options?: Pick<
    AuditMetadata,
    'targetEntity' | 'targetParam' | 'extractMetadata'
  >,
): MethodDecorator =>
  SetMetadata(AUDIT_METADATA_KEY, {
    action,
    category,
    ...options,
  } as AuditMetadata);
