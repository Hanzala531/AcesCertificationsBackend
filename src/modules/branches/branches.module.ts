import { Module } from '@nestjs/common';
import { BranchController } from './branches.controller';
import { BranchService } from './branches.service';
import { BranchRepository } from './branches.repository';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [BranchController],
  providers: [BranchService, BranchRepository],
  exports: [BranchService],
})
export class BranchesModule {}
