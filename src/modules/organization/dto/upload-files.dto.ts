import { ApiProperty } from '@nestjs/swagger';

export class UploadLogoDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Organization logo image (JPG, PNG, GIF, WebP - max 5MB)',
  })
  logo: Express.Multer.File;
}

export class UploadLegalDocumentDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Legal document (PDF, Word - max 10MB)',
  })
  legal_document: Express.Multer.File;
}
