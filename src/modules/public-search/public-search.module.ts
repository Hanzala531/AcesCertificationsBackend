import { Module } from '@nestjs/common';
import { PublicSearchController } from './public-search.controller';
import { PublicSearchService } from './public-search.service';
import { PublicSearchRepository } from './public-search.repository';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [PublicSearchController],
  providers: [PublicSearchService, PublicSearchRepository],
})
export class PublicSearchModule {}
