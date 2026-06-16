import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { BadgeDto } from '../dto/badge.dto';

@ValidatorConstraint({ name: 'exactlyThreeBadges', async: false })
export class ExactlyThreeBadgesValidator implements ValidatorConstraintInterface {
  validate(badges: BadgeDto[]): boolean {
    return Array.isArray(badges) && badges.length === 3;
  }

  defaultMessage(): string {
    return 'Certificate must have exactly 3 badges';
  }
}

@ValidatorConstraint({ name: 'uniqueBadgeSlots', async: false })
export class UniqueBadgeSlotsValidator implements ValidatorConstraintInterface {
  validate(badges: BadgeDto[]): boolean {
    if (!Array.isArray(badges)) return false;
    const slots = badges.map((b) => b.slot);
    const uniqueSlots = new Set(slots);
    return (
      uniqueSlots.size === 3 &&
      uniqueSlots.has(1) &&
      uniqueSlots.has(2) &&
      uniqueSlots.has(3)
    );
  }

  defaultMessage(): string {
    return 'Badge slots must be unique and include 1, 2, and 3';
  }
}

@ValidatorConstraint({ name: 'uniqueBadgeNames', async: false })
export class UniqueBadgeNamesValidator implements ValidatorConstraintInterface {
  validate(badges: BadgeDto[]): boolean {
    if (!Array.isArray(badges)) return false;
    const names = badges.map((b) => b.name.toLowerCase());
    return new Set(names).size === names.length;
  }

  defaultMessage(): string {
    return 'Badge names must be unique within the certificate';
  }
}

@ValidatorConstraint({ name: 'uniqueColorsPerBadge', async: false })
export class UniqueColorsPerBadgeValidator implements ValidatorConstraintInterface {
  validate(badges: BadgeDto[]): boolean {
    if (!Array.isArray(badges)) return false;
    for (const badge of badges) {
      if (!badge.colors || !Array.isArray(badge.colors)) continue;
      const colors = badge.colors.map((c) => c.color.toLowerCase());
      if (new Set(colors).size !== colors.length) {
        return false;
      }
    }
    return true;
  }

  defaultMessage(): string {
    return 'Colors must be unique within each badge';
  }
}

@ValidatorConstraint({ name: 'validScoreRanges', async: false })
export class ValidScoreRangesValidator implements ValidatorConstraintInterface {
  validate(badges: BadgeDto[]): boolean {
    if (!Array.isArray(badges)) return false;
    for (const badge of badges) {
      if (!badge.colors || !Array.isArray(badge.colors)) continue;
      for (const color of badge.colors) {
        if (color.min_score > color.max_score) {
          return false;
        }
      }
    }
    return true;
  }

  defaultMessage(): string {
    return 'min_score must be less than or equal to max_score for each color';
  }
}
