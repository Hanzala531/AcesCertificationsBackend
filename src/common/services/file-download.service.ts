import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { randomUUID } from 'crypto';

export interface DownloadedFile {
  filePath: string;
  questionId: string;
  originalUrl: string;
}

@Injectable()
export class FileDownloadService {
  private readonly logger = new Logger(FileDownloadService.name);
  private readonly downloadDir: string;

  constructor() {
    const isServerless = !!process.env.VERCEL;
    this.downloadDir = isServerless
      ? path.join('/tmp', 'downloads')
      : path.join(process.cwd(), 'downloads');

    if (!fs.existsSync(this.downloadDir)) {
      fs.mkdirSync(this.downloadDir, { recursive: true });
      this.logger.log(`Created downloads directory: ${this.downloadDir}`);
    }
  }

  async downloadFile(url: string, questionId: string): Promise<DownloadedFile> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          `Failed to download file from ${url}: ${response.status} ${response.statusText}`,
        );
      }

      const contentType = response.headers.get('content-type') || '';
      const extension = this.getFileExtension(url, contentType);
      const fileName = `${randomUUID()}-${questionId}${extension}`;
      const filePath = path.join(this.downloadDir, fileName);

      const body = response.body;
      if (!body) {
        throw new Error(`Response body is null for ${url}`);
      }

      const nodeStream = Readable.fromWeb(body as any);
      const writeStream = fs.createWriteStream(filePath);
      await pipeline(nodeStream, writeStream);

      const stats = fs.statSync(filePath);
      this.logger.debug(
        `Downloaded file: ${url} -> ${filePath} (${stats.size} bytes)`,
      );

      return {
        filePath,
        questionId,
        originalUrl: url,
      };
    } catch (error) {
      this.logger.error(
        `Failed to download file from ${url} for question ${questionId}:`,
        error,
      );
      throw error;
    }
  }

  async downloadFiles(
    files: Array<{ url: string; questionId: string }>,
  ): Promise<DownloadedFile[]> {
    const downloadPromises = files.map((file) =>
      this.downloadFile(file.url, file.questionId),
    );

    return Promise.all(downloadPromises);
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.logger.debug(`Deleted file: ${filePath}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to delete file ${filePath}:`, error);
    }
  }

  async deleteFiles(filePaths: string[]): Promise<void> {
    const deletePromises = filePaths.map((filePath) =>
      this.deleteFile(filePath),
    );
    await Promise.all(deletePromises);
  }

  async cleanupFiles(files: DownloadedFile[]): Promise<void> {
    const filePaths = files.map((f) => f.filePath);
    await this.deleteFiles(filePaths);
  }

  private getFileExtension(url: string, contentType: string): string {
    const urlMatch = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    if (urlMatch) {
      return `.${urlMatch[1]}`;
    }

    if (contentType.includes('pdf')) {
      return '.pdf';
    }
    if (contentType.includes('wordprocessingml')) {
      return '.docx';
    }
    if (contentType.includes('msword')) {
      return '.doc';
    }
    if (contentType.includes('spreadsheetml')) {
      return '.xlsx';
    }
    if (contentType.includes('ms-excel')) {
      return '.xls';
    }
    if (contentType.includes('plain')) {
      return '.txt';
    }

    return '';
  }
}
