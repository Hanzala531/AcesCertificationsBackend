import { ApiProperty } from '@nestjs/swagger';

export class IndustryResponseDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6',
    description: 'Unique identifier for the industry',
  })
  id: string;

  @ApiProperty({
    example: 'Information Technology',
    description: 'Name of the industry',
  })
  name: string;

  @ApiProperty({
    example: '2026-01-11T10:00:00.000Z',
    description: 'Timestamp when the industry was last updated',
  })
  updated_at: Date;
}
