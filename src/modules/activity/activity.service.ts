import { Injectable } from '@nestjs/common';
import { isIP } from 'node:net';
import { ActivityRepository, type ActivityLogRow } from './activity.repository';
import { GetActivityDto } from './dto/get-activity.dto';

export interface ActivityItem {
  title: string;
  location: string;
  date: string;
  time: string;
}

@Injectable()
export class ActivityService {
  constructor(private readonly activityRepository: ActivityRepository) {}

  async getAccountActivity(
    userId: string,
    query: GetActivityDto,
  ): Promise<{
    items: ActivityItem[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);

    const { items, total } = await this.activityRepository.findByUser(userId, {
      type: query.type,
      fromDate: query.fromDate,
      toDate: query.toDate,
      page,
      limit,
    });

    return {
      items: items.map((item) => this.toActivityItem(item)),
      total,
      page,
      limit,
    };
  }

  private toActivityItem(item: ActivityLogRow): ActivityItem {
    const metadata = item.metadata ?? {};
    const location = this.normalizeLocation(metadata.location);
    const date = this.normalizeDate(item.created_at);
    const time = this.normalizeTime(item.created_at);
    const title = this.toFriendlyTitle(item.action, item.http_path);

    return {
      title,
      location,
      date,
      time,
    };
  }

  private toFriendlyTitle(action: string, httpPath?: string | null): string {
    const normalizedAction = action.trim().toLowerCase();
    const normalizedPath = (httpPath ?? '').trim().toLowerCase();

    if (
      normalizedAction.includes('logout') ||
      normalizedPath.includes('/logout')
    ) {
      return 'Logged out';
    }

    if (
      normalizedAction.includes('password_change') ||
      normalizedAction.includes('password') ||
      normalizedPath.includes('change-password') ||
      normalizedPath.includes('update-password') ||
      normalizedPath.includes('/password')
    ) {
      return 'Password changed';
    }

    if (normalizedAction.includes('login')) return 'Logged in';

    if (
      normalizedAction.includes('refresh') ||
      normalizedPath.includes('/auth/refresh')
    ) {
      return 'Session refreshed';
    }

    if (
      normalizedAction.includes('otp_send') ||
      normalizedPath.includes('/auth/send-otp') ||
      normalizedPath.includes('/auth/resend-otp')
    ) {
      return 'OTP sent';
    }

    if (
      normalizedAction.includes('otp_verify') ||
      normalizedPath.includes('/auth/verify-otp')
    ) {
      return 'OTP verified';
    }

    if (
      normalizedAction.includes('password_reset') ||
      normalizedPath.includes('/auth/forgot-password')
    ) {
      return 'Password reset requested';
    }

    if (
      normalizedAction.includes('profile') ||
      normalizedPath.includes('/users/me') ||
      normalizedPath.includes('/profile')
    ) {
      return 'Profile updated';
    }

    if (normalizedAction.endsWith('.update')) return 'Profile updated';
    if (normalizedAction.startsWith('auth.')) return 'Authentication activity';

    return 'Activity updated';
  }

  private normalizeDate(rawDate: unknown): string {
    if (rawDate instanceof Date) return rawDate.toISOString();

    if (typeof rawDate === 'string' || typeof rawDate === 'number') {
      const parsedDate = new Date(rawDate);
      if (!Number.isNaN(parsedDate.getTime())) return parsedDate.toISOString();
    }

    return '';
  }

  private normalizeTime(rawDate: unknown): string {
    let parsedDate: Date | null = null;

    if (rawDate instanceof Date) {
      parsedDate = rawDate;
    } else if (typeof rawDate === 'string' || typeof rawDate === 'number') {
      const candidate = new Date(rawDate);
      if (!Number.isNaN(candidate.getTime())) {
        parsedDate = candidate;
      }
    }

    if (!parsedDate) return '';

    return parsedDate.toISOString().slice(11, 19);
  }

  private normalizeLocation(rawLocation: unknown): string {
    if (typeof rawLocation !== 'string') return 'Unknown location';

    const location = rawLocation.trim();
    if (!location) return 'Unknown location';

    const lowered = location.toLowerCase();
    if (
      lowered === 'localhost' ||
      lowered === '::1' ||
      lowered === 'unknown' ||
      lowered === 'unknown location'
    ) {
      return 'Unknown location';
    }

    if (isIP(location)) return 'Unknown location';

    return location;
  }
}
