import { Module } from '@nestjs/common';
import { IndustryService } from './industry.service';
import { IndustryController } from './industry.controller';
import { IndustryRepository } from './industry.repository';
import { DatabaseModule } from '../../database/database.module';
import { CacheService } from '../../common/services/cache.service';

@Module({
  imports: [DatabaseModule],
  providers: [IndustryService, IndustryRepository, CacheService],
  controllers: [IndustryController],
  exports: [IndustryService, IndustryRepository],
})
export class IndustryModule {}
