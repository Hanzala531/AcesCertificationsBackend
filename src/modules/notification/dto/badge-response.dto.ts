import { ApiProperty } from '@nestjs/swagger';

export class OrganizationBadgeDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  organization_id: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174001',
    nullable: true,
  })
  branch_id: string | null;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174002',
    nullable: true,
  })
  certificate_id: string | null;

  @ApiProperty({
    example: 'silver',
    enum: ['bronze', 'silver', 'gold', 'platinum'],
  })
  badge_name: string;

  @ApiProperty({ example: '#C0C0C0' })
  color: string;

  @ApiProperty({ example: '0cda2c55-ca9f-4e3d-a0bc-322628f26d27' })
  assessed_by_user_id: string;

  @ApiProperty({
    example: '0cda2c55-ca9f-4e3d-a0bc-322628f26d28',
    nullable: true,
  })
  accessed_by_user_id: string | null;

  @ApiProperty({ example: 92.5 })
  score: number;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174003',
    nullable: true,
  })
  assessment_id: string | null;

  @ApiProperty({ example: 'ACME Corporation' })
  organization_name?: string;

  @ApiProperty({ example: 'New York Branch' })
  branch_name?: string;

  @ApiProperty({ example: 'ISO 9001 Certification' })
  certificate_name?: string;

  @ApiProperty({ example: 'assessor@example.com' })
  assessed_by_email?: string;

  @ApiProperty({ example: '2026-01-26T21:42:28.000Z' })
  created_at: Date;

  @ApiProperty({ example: '2026-01-26T21:42:28.000Z' })
  updated_at: Date;
}

export class GetOrganizationBadgesApiResponse {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: [OrganizationBadgeDto] })
  data: OrganizationBadgeDto[];
}

export class GetBadgeByIdApiResponse {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: OrganizationBadgeDto })
  data: OrganizationBadgeDto;
}

export class BadgeNotFoundErrorDto {
  @ApiProperty({ example: false })
  success: boolean;

  @ApiProperty({ example: 'Badge not found' })
  message: string;
}
