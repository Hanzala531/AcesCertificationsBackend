import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FileUploadService {
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

  async uploadImage(
    file: Express.Multer.File,
    folder: string = 'aces-certifications',
  ): Promise<{ url: string; publicId: string }> {
    if (!file) throw new Error('No file provided');

    const localFilePath =
      file.path || path.join(this.uploadDir, file.originalname);

    try {
      const result: { secure_url: string; public_id: string } =
        await cloudinary.uploader.upload(localFilePath, {
          folder,
          resource_type: 'auto',
          allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        });

      return { url: result.secure_url, publicId: result.public_id };
    } finally {
      this.deleteLocalFile(localFilePath);
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'aces-certifications',
  ): Promise<{ url: string; publicId: string }> {
    if (!file) throw new Error('No file provided');

    const localFilePath =
      file.path || path.join(this.uploadDir, file.originalname);

    try {
      const result: { secure_url: string; public_id: string } =
        await cloudinary.uploader.upload(localFilePath, {
          folder,
          resource_type: 'auto',
          allowed_formats: ['pdf', 'doc', 'docx', 'txt'],
        });

      return { url: result.secure_url, publicId: result.public_id };
    } finally {
      this.deleteLocalFile(localFilePath);
    }
  }

  private deleteLocalFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error(`Failed to delete local file ${filePath}:`, error);
    }
  }

  async deleteImage(publicId: string): Promise<boolean> {
    try {
      const result = (await cloudinary.uploader.destroy(publicId)) as {
        result: string;
      };
      return result.result === 'ok';
    } catch (error) {
      console.error('Failed to delete image from Cloudinary:', error);
      return false;
    }
  }
}
