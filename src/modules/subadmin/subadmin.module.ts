import { Module, forwardRef } from '@nestjs/common';
import { SubadminService } from './subadmin.service';
import { SubadminRepository } from './subadmin.repository';
import { SubadminController } from './subadmin.controller';
import { DatabaseModule } from '../../database/database.module';
import { CommonModule } from '../../common/common.module';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    DatabaseModule,
    CommonModule,
    UsersModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [SubadminController],
  providers: [SubadminService, SubadminRepository],
  exports: [SubadminService, SubadminRepository],
})
export class SubadminModule {}
