import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';

// Picture Upload Config
export const profilePictureMulterConfig = {
  storage: diskStorage({
    destination: (
      req: Express.Request,
      file: Express.Multer.File,
      cb: (err: Error | null, destination: string) => void,
    ) => {
      const uploadDir = process.env.VERCEL
        ? path.join('/tmp', 'uploads')
        : path.join(process.cwd(), 'uploads', 'temp');

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (
      req: Express.Request,
      file: Express.Multer.File,
      cb: (err: Error | null, filename: string) => void,
    ) => {
      const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (
    req: Express.Request,
    file: Express.Multer.File,
    cb: (err: Error | null, acceptFile: boolean) => void,
  ) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new BadRequestException(
          'Invalid file type. Only JPG, PNG, GIF, and WebP are allowed.',
        ),
        false,
      );
    }
  },
};

// Document Upload Config
export const documentMulterConfig = {
  storage: diskStorage({
    destination: (
      req: Express.Request,
      file: Express.Multer.File,
      cb: (err: Error | null, destination: string) => void,
    ) => {
      const uploadDir = process.env.VERCEL
        ? path.join('/tmp', 'uploads')
        : path.join(process.cwd(), 'uploads', 'temp');

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (
      req: Express.Request,
      file: Express.Multer.File,
      cb: (err: Error | null, filename: string) => void,
    ) => {
      const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (
    req: Express.Request,
    file: Express.Multer.File,
    cb: (err: Error | null, acceptFile: boolean) => void,
  ) => {
    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new BadRequestException(
          'Invalid file type. Only PDF, Word (DOC, DOCX), Excel (XLS, XLSX), and TXT are allowed.',
        ),
        false,
      );
    }
  },
};
