import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseService } from './database.service';
import { MigrationsService } from './migrations.service';

@Module({
  imports: [ConfigModule],
  providers: [DatabaseService, MigrationsService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
