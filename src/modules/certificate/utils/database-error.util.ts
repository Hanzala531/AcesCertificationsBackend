import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { isDbError } from '../../../common/utils/error.util';

export function handleDatabaseError(error: unknown): never {
  if (isDbError(error) && error.code === '23505') {
    if (error.constraint?.includes('badge_slot')) {
      throw new ConflictException(
        'Badge slot already exists for this certificate',
      );
    }
    if (error.constraint?.includes('badge_name')) {
      throw new ConflictException(
        'Badge name already exists for this certificate',
      );
    }
    if (error.constraint?.includes('badge_color')) {
      throw new ConflictException('Color already exists for this badge');
    }
    if (error.constraint?.includes('rank')) {
      throw new ConflictException(
        'Rank already exists for this parent section',
      );
    }
    if (error.constraint?.includes('certificate_id')) {
      throw new ConflictException('Certificate ID already exists');
    }
    throw new ConflictException('Duplicate entry detected');
  }

  if (isDbError(error) && error.code === '23503') {
    throw new NotFoundException('Referenced entity not found');
  }

  if (isDbError(error) && error.code === '23514') {
    if (error.constraint?.includes('slot')) {
      throw new BadRequestException('Badge slot must be between 1 and 3');
    }
    if (error.constraint?.includes('score')) {
      throw new BadRequestException(
        'min_score must be less than or equal to max_score',
      );
    }
    throw new BadRequestException('Constraint violation');
  }

  throw error;
}
