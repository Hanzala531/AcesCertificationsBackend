import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UploadsController } from './uploads.controller';
import { FileUploadInterceptor } from './interceptors/file-upload.interceptor';

@Module({
  imports: [ConfigModule],
  controllers: [UploadsController],
  providers: [FileUploadInterceptor],
  exports: [FileUploadInterceptor],
})
export class UploadsModule {}
