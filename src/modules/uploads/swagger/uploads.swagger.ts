import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';

// Error response schema
const errorResponseSchema = (
  statusCode: number,
  message: string,
  path: string,
) => ({
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    message: { type: 'string', example: message },
    timestamp: { type: 'string', example: '2026-01-13T12:00:00.000Z' },
    path: { type: 'string', example: path },
  },
});

// Response examples
const IMAGE_UPLOAD_RESPONSE = {
  message: 'Image uploaded successfully',
  url: 'https://res.cloudinary.com/account/image/upload/v1234567890/uploads/images/abc123def456.jpg',
  type: 'image',
};

const DOCUMENT_UPLOAD_RESPONSE = {
  message: 'Document uploaded successfully',
  url: 'https://s3.amazonaws.com/bucket-name/uploads/documents/abc123def456.pdf',
  type: 'document',
};

// Swagger decorator for POST /uploads/images
export const SwaggerUploadImage = () =>
  applyDecorators(
    ApiConsumes('multipart/form-data'),
    ApiOperation({
      summary: 'Upload image to Cloudinary',
      description: `Upload an image file to Cloudinary. The returned URL can be used for profile pictures, logos, etc.

**Supported Formats:** JPG, PNG, GIF, WebP
**Max Size:** 5MB

**Usage:** Use the returned Cloudinary URL when updating profile_picture or logo fields.`,
    }),
    ApiBody({
      schema: {
        type: 'object',
        required: ['image'],
        properties: {
          image: {
            type: 'string',
            format: 'binary',
            description: 'Image file (JPG, PNG, GIF, WebP - max 5MB)',
          },
        },
      },
    }),
    ApiCreatedResponse({
      description: 'Image uploaded successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          url: { type: 'string', format: 'uri' },
          type: { type: 'string', enum: ['image'] },
        },
        example: IMAGE_UPLOAD_RESPONSE,
      },
    }),
    ApiBadRequestResponse({
      description: 'No file provided or invalid file type/size',
      schema: errorResponseSchema(
        400,
        'Image file is required',
        '/api/uploads/images',
      ),
    }),
    ApiInternalServerErrorResponse({
      description: 'Failed to upload image to Cloudinary',
      schema: errorResponseSchema(
        500,
        'Failed to upload image',
        '/api/uploads/images',
      ),
    }),
  );

// Swagger decorator for POST /uploads/documents
export const SwaggerUploadDocument = () =>
  applyDecorators(
    ApiConsumes('multipart/form-data'),
    ApiOperation({
      summary: 'Upload document to S3',
      description: `Upload a document file to S3. The returned URL can be used for legal documents, certificates, etc.

**Supported Formats:** PDF, Word (DOC, DOCX), Excel (XLS, XLSX)
**Max Size:** 10MB

**Usage:** Use the returned S3 URL when updating legal_document_url or similar fields.`,
    }),
    ApiBody({
      schema: {
        type: 'object',
        required: ['document'],
        properties: {
          document: {
            type: 'string',
            format: 'binary',
            description: 'Document file (PDF, DOC, DOCX, XLS, XLSX - max 10MB)',
          },
        },
      },
    }),
    ApiCreatedResponse({
      description: 'Document uploaded successfully',
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          url: { type: 'string', format: 'uri' },
          type: { type: 'string', enum: ['document'] },
        },
        example: DOCUMENT_UPLOAD_RESPONSE,
      },
    }),
    ApiBadRequestResponse({
      description: 'No file provided or invalid file type/size',
      schema: errorResponseSchema(
        400,
        'Document file is required',
        '/api/uploads/documents',
      ),
    }),
    ApiInternalServerErrorResponse({
      description: 'Failed to upload document to S3',
      schema: errorResponseSchema(
        500,
        'Failed to upload document',
        '/api/uploads/documents',
      ),
    }),
  );
