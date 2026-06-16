import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiExtraModels,
} from '@nestjs/swagger';
import {
  GetLoginLogsResponseDto,
  LoginLogsPaginatedDataDto,
  LoginLogItemDto,
  UnauthorizedErrorDto,
} from '../dto/users-response.dto';

export function SwaggerGetLoginLogs() {
  return applyDecorators(
    ApiExtraModels(
      GetLoginLogsResponseDto,
      LoginLogsPaginatedDataDto,
      LoginLogItemDto,
      UnauthorizedErrorDto,
    ),
    ApiOperation({
      summary: 'Get login activity logs',
      description: `
Returns paginated login activity logs for the authenticated user.

Each entry captures the email, device (User-Agent), IP address, and timestamp
of a login event — both successful and failed attempts.

**Pagination:**
- \`page\`: Page number (default: 1, minimum: 1)
- \`limit\`: Items per page (default: 20, minimum: 1, maximum: 100)

**Access:** Any authenticated user can view their own login logs.
      `,
    }),
    ApiQuery({
      name: 'page',
      required: false,
      type: Number,
      description: 'Page number (default: 1)',
      example: 1,
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      description: 'Items per page (default: 20, max: 100)',
      example: 20,
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Login logs retrieved successfully',
      type: GetLoginLogsResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized — missing or invalid JWT token',
      type: UnauthorizedErrorDto,
    }),
  );
}
