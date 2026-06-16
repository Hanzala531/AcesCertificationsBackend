import { Injectable, Logger } from '@nestjs/common';
import {
  CertificationOverviewRepository,
  PaginatedResult,
  OverviewAssessmentRow,
  OverviewIssuedCertRow,
} from '../repositories/certification-overview.repository';
import { CertificationOverviewQueryDto } from '../dto/certification-overview-query.dto';

export interface CertificationOverviewResponse {
  in_progress: PaginatedResult<OverviewAssessmentRow>;
  active: PaginatedResult<OverviewIssuedCertRow>;
  failed: PaginatedResult<OverviewAssessmentRow>;
  expired: PaginatedResult<OverviewIssuedCertRow>;
}

@Injectable()
export class CertificationOverviewService {
  private readonly logger = new Logger(CertificationOverviewService.name);

  constructor(
    private readonly overviewRepo: CertificationOverviewRepository,
  ) {}

  async getOverview(
    organizationId: string,
    query: CertificationOverviewQueryDto,
  ): Promise<CertificationOverviewResponse> {
    const [inProgress, active, failed, expired] = await Promise.all([
      this.overviewRepo.getInProgressAssessments(
        organizationId,
        query.in_progress_page ?? 1,
        query.in_progress_limit ?? 10,
      ),
      this.overviewRepo.getActiveCertificates(
        organizationId,
        query.active_page ?? 1,
        query.active_limit ?? 10,
      ),
      this.overviewRepo.getFailedAssessments(
        organizationId,
        query.failed_page ?? 1,
        query.failed_limit ?? 10,
      ),
      this.overviewRepo.getExpiredCertificates(
        organizationId,
        query.expired_page ?? 1,
        query.expired_limit ?? 10,
      ),
    ]);

    return { in_progress: inProgress, active, failed, expired };
  }
}
