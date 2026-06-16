import { Injectable, Logger } from '@nestjs/common';
import { BadgeRepository, BadgeWithDetails } from './badge.repository';
import { NotificationService } from './services/notification.service';
import { NotificationType } from './types/notification.types';

export interface BadgeAllocationConfig {
  bronze: { minScore: number; color: string };
  silver: { minScore: number; color: string };
  gold: { minScore: number; color: string };
  platinum: { minScore: number; color: string };
}

@Injectable()
export class BadgeService {
  private readonly logger = new Logger(BadgeService.name);
  private readonly defaultConfig: BadgeAllocationConfig = {
    bronze: { minScore: 0, color: '#CD7F32' },
    silver: { minScore: 90, color: '#C0C0C0' },
    gold: { minScore: 95, color: '#FFD700' },
    platinum: { minScore: 98, color: '#E5E4E2' },
  };

  constructor(
    private readonly badgeRepo: BadgeRepository,
    private readonly notificationService: NotificationService,
  ) {}

  async allocateBadge(data: {
    organizationId: string;
    branchId?: string | null;
    certificateId?: string | null;
    score: number;
    assessedByUserId: string;
    assessmentId?: string | null;
  }): Promise<{
    badge: {
      id: string;
      badge_name: string;
      color: string;
      score: number;
    } | null;
    tier: 'bronze' | 'silver' | 'gold' | 'platinum' | null;
  }> {
    const tier = this.determineBadgeTier(data.score);

    if (!tier) {
      this.logger.debug(
        `Score ${data.score} does not meet minimum criteria for badge allocation`,
      );
      return { badge: null, tier: null };
    }

    const config = this.defaultConfig[tier];
    const existingBadge = data.assessmentId
      ? await this.badgeRepo.findLatestBadgeForAssessment(data.assessmentId)
      : null;

    if (existingBadge) {
      this.logger.debug(
        `Badge already allocated for assessment ${data.assessmentId}: ${existingBadge.badge_name}`,
      );
      return {
        badge: {
          id: existingBadge.id,
          badge_name: existingBadge.badge_name,
          color: existingBadge.color,
          score: existingBadge.score,
        },
        tier: existingBadge.badge_name,
      };
    }

    const badge = await this.badgeRepo.createBadge({
      organization_id: data.organizationId,
      branch_id: data.branchId,
      certificate_id: data.certificateId,
      badge_name: tier,
      color: config.color,
      assessed_by_user_id: data.assessedByUserId,
      score: data.score,
      assessment_id: data.assessmentId,
    });

    this.logger.log(
      `Badge allocated: ${tier} (${config.color}) for organization ${data.organizationId}${data.branchId ? `, branch ${data.branchId}` : ''} with score ${data.score}`,
    );

    await this.notifyBadgeAllocation(badge, data.organizationId, data.branchId);

    return {
      badge: {
        id: badge.id,
        badge_name: badge.badge_name,
        color: badge.color,
        score: badge.score,
      },
      tier,
    };
  }

  async getBadgesForOrganization(
    organizationId: string,
    branchId?: string | null,
  ): Promise<BadgeWithDetails[]> {
    return this.badgeRepo.findBadgesByOrganization(organizationId, branchId);
  }

  async getBadgeById(badgeId: string): Promise<BadgeWithDetails | null> {
    return this.badgeRepo.findBadgeById(badgeId);
  }

  private determineBadgeTier(
    score: number,
  ): 'bronze' | 'silver' | 'gold' | 'platinum' | null {
    if (score >= this.defaultConfig.platinum.minScore) {
      return 'platinum';
    }
    if (score >= this.defaultConfig.gold.minScore) {
      return 'gold';
    }
    if (score >= this.defaultConfig.silver.minScore) {
      return 'silver';
    }
    if (score >= this.defaultConfig.bronze.minScore) {
      return 'bronze';
    }
    return null;
  }

  private async notifyBadgeAllocation(
    badge: {
      id: string;
      organization_id: string;
      branch_id: string | null;
      badge_name: string;
      score: number;
    },
    organizationId: string,
    branchId?: string | null,
  ): Promise<void> {
    try {
      const badgeDisplayName =
        badge.badge_name.charAt(0).toUpperCase() + badge.badge_name.slice(1);

      await this.notificationService.notify({
        payload: {
          type: NotificationType.SUCCESS,
          title: 'Badge Allocated',
          message: `Congratulations! Your organization has been awarded a ${badgeDisplayName} badge based on assessment score of ${badge.score}.`,
          module: 'certificate',
          actionUrl: `/badges/${badge.id}`,
          metadata: {
            badge_id: badge.id,
            badge_name: badge.badge_name,
            organization_id: organizationId,
            branch_id: branchId,
            score: badge.score,
          },
        },
        target: {
          roles: ['organization', 'organization_member'],
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to send badge allocation notification: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
