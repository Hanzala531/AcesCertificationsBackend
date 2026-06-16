import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Request,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  SwaggerUploadImage,
  SwaggerUploadDocument,
} from './swagger/uploads.swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  profilePictureMulterConfig,
  documentMulterConfig,
} from '../../common/config/multer.config';
import { FileUploadInterceptor } from './interceptors/file-upload.interceptor';

interface ImageUploadResponse {
  message: string;
  url: string;
  type: 'image';
}

interface DocumentUploadResponse {
  message: string;
  url: string;
  type: 'document';
}

interface RequestWithUpload extends Request {
  uploadResult?: {
    url: string;
    publicId: string;
  };
  folder?: string;
  resourceType?: 'image' | 'raw';
}

@ApiTags('📤 Uploads')
@Controller('uploads')
export class UploadsController {
  @Post('images')
  @UseInterceptors(
    FileInterceptor('image', profilePictureMulterConfig),
    FileUploadInterceptor,
  )
  @SwaggerUploadImage()
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: RequestWithUpload,
  ): Promise<ImageUploadResponse> {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    req.folder = 'uploads/images';
    req.resourceType = 'image';

    if (!req.uploadResult) {
      throw new BadRequestException('Failed to upload image');
    }

    return {
      message: 'Image uploaded successfully',
      url: req.uploadResult.url,
      type: 'image',
    };
  }

  @Post('documents')
  @UseInterceptors(
    FileInterceptor('document', documentMulterConfig),
    FileUploadInterceptor,
  )
  @SwaggerUploadDocument()
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: RequestWithUpload,
  ): Promise<DocumentUploadResponse> {
    if (!file) {
      throw new BadRequestException('Document file is required');
    }

    req.folder = 'uploads/documents';
    req.resourceType = 'raw';

    if (!req.uploadResult) {
      throw new BadRequestException('Failed to upload document');
    }

    return {
      message: 'Document uploaded successfully',
      url: req.uploadResult.url,
      type: 'document',
    };
  }
}
