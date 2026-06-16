import { Module } from '@nestjs/common';
import { CertificateController } from './certificate.controller';
import { CertificateService } from './services/certificate.service';
import { CertificateStructureService } from './services/certificate-structure.service';
import { CertificateQueryService } from './services/certificate-query.service';
import { CertificateDuplicateService } from './services/certificate-duplicate.service';
import { CertificateDevService } from './services/certificate-dev.service';
import { CertificationOverviewService } from './services/certification-overview.service';
import { ScoreCalculationService } from './services/score-calculation.service';
import { CertificateRepository } from './certificate.repository';
import { CertificationOverviewRepository } from './repositories/certification-overview.repository';
import { OrganizationRepository } from '../organization/organization.repository';
import { EmployeeRepository } from '../employee/employee.repository';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [CertificateController],
  providers: [
    CertificateService,
    CertificateStructureService,
    CertificateQueryService,
    CertificateDuplicateService,
    CertificateDevService,
    CertificationOverviewService,
    ScoreCalculationService,
    CertificateRepository,
    CertificationOverviewRepository,
    OrganizationRepository,
    EmployeeRepository,
  ],
  exports: [
    CertificateService,
    CertificateStructureService,
    CertificateQueryService,
    ScoreCalculationService,
    CertificateRepository,
  ],
})
export class CertificateModule {}
