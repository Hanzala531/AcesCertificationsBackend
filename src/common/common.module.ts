import { Module, Global } from '@nestjs/common';
import { OtpService } from './services/otp.service';
import { EmailService } from './services/email.service';
import { FileUploadService } from './services/file-upload.service';
import { FileDownloadService } from './services/file-download.service';
import { PasswordGeneratorService } from './services/password-generator.service';
import { CacheService } from './services/cache.service';
import { ConfigModule } from '@nestjs/config';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    OtpService,
    EmailService,
    FileUploadService,
    FileDownloadService,
    PasswordGeneratorService,
    CacheService,
  ],
  exports: [
    OtpService,
    EmailService,
    FileUploadService,
    FileDownloadService,
    PasswordGeneratorService,
    CacheService,
  ],
})
export class CommonModule {}
