import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { Request } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

interface UploadResult {
  url: string;
  publicId: string;
}

interface FileUploadContext {
  file?: Express.Multer.File;
  folder?: string;
  resourceType?: 'image' | 'raw';
}

@Injectable()
export class FileUploadInterceptor implements NestInterceptor {
  private readonly logger = new Logger(FileUploadInterceptor.name);
  private readonly uploadDir: string;

  constructor(private configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });

    const isServerless = !!process.env.VERCEL;
    this.uploadDir = isServerless
      ? path.join('/tmp', 'uploads', 'temp')
      : path.join(process.cwd(), 'uploads', 'temp');

    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context
      .switchToHttp()
      .getRequest<
        Request & FileUploadContext & { uploadResult?: UploadResult }
      >();

    const file = request.file;

    if (file) {
      try {
        // Determine resource type and folder based on file mimetype or request context
        const resourceType = this.determineResourceType(file, request);
        const folder = request.folder || this.getDefaultFolder(resourceType);

        const uploadResult = await this.uploadToCloudinary(
          file,
          folder,
          resourceType,
        );

        // Attach upload result to request for use in controller
        request.uploadResult = uploadResult;
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : typeof error === 'object' && error !== null && 'message' in error
              ? String(error.message)
              : String(error);

        const errorStack =
          error instanceof Error
            ? error.stack
            : typeof error === 'object' && error !== null && 'stack' in error
              ? String(error.stack)
              : undefined;

        this.logger.error(
          `Failed to upload file to Cloudinary: ${errorMessage}`,
          errorStack,
        );

        const cloudinaryError =
          error &&
          typeof error === 'object' &&
          'http_code' in error &&
          'message' in error
            ? `Cloudinary error (${error.http_code}): ${error.message}`
            : errorMessage;

        throw new BadRequestException(cloudinaryError);
      } finally {
        this.deleteLocalFile(file.path);
      }
    }

    return next.handle();
  }

  private determineResourceType(
    file: Express.Multer.File,
    request: Request & FileUploadContext,
  ): 'image' | 'raw' {
    if (request.resourceType) {
      return request.resourceType;
    }

    const imageMimes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/jpg',
    ];
    const documentMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
    ];

    if (imageMimes.includes(file.mimetype)) {
      return 'image';
    }
    if (documentMimes.includes(file.mimetype)) {
      return 'raw';
    }

    return 'image';
  }

  private getDefaultFolder(resourceType: 'image' | 'raw'): string {
    return resourceType === 'image' ? 'uploads/images' : 'uploads/documents';
  }

  private async uploadToCloudinary(
    file: Express.Multer.File,
    folder: string,
    resourceType: 'image' | 'raw',
  ): Promise<UploadResult> {
    const localFilePath =
      file.path || path.join(this.uploadDir, file.originalname);

    if (resourceType === 'image') {
      const result = await cloudinary.uploader.upload(localFilePath, {
        folder,
        resource_type: 'image',
        type: 'upload',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      });

      return { url: result.secure_url, publicId: result.public_id };
    } else {
      const result = await cloudinary.uploader.upload(localFilePath, {
        folder,
        resource_type: 'raw',
        type: 'upload',
        allowed_formats: ['pdf', 'doc', 'docx', 'txt'],
      });

      const rawUrl = result.secure_url.replace(
        '/image/upload/',
        '/raw/upload/',
      );

      return { url: rawUrl, publicId: result.public_id };
    }
  }

  private deleteLocalFile(filePath: string): void {
    try {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to delete local file ${filePath}:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
