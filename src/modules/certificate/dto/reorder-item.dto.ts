import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsInt,
  IsOptional,
  Min,
  IsUUID,
} from 'class-validator';

export enum ReorderItemType {
  MAIN_SECTION = 'main_section',
  SECTION = 'section',
  SUB_SECTION = 'sub_section',
  QUESTION = 'question',
}

export enum ReorderParentType {
  MAIN_SECTION = 'main_section',
  SECTION = 'section',
  SUB_SECTION = 'sub_section',
}

export enum ReorderOperationType {
  MOVE = 'move',
  CHANGE_RANK = 'change_rank',
}

export class ReorderItemDto {
  @ApiPropertyOptional({
    enum: ReorderOperationType,
    example: 'move',
    description:
      'Operation mode. move: relocate/reparent/promote/demote item. change_rank: change rank within current parent only.',
  })
  @IsOptional()
  @IsEnum(ReorderOperationType)
  operation?: ReorderOperationType;

  @ApiProperty({
    enum: ReorderItemType,
    example: 'section',
    description: 'Type of item being moved: main_section, section, sub_section, or question',
  })
  @IsEnum(ReorderItemType)
  item_type: ReorderItemType;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'UUID of the item being moved',
  })
  @IsUUID()
  @IsNotEmpty()
  item_id: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description:
      'UUID of the new parent. Optional for in-place reorder (keeps current parent). For main_section: certificate id. For section: main_section id. For sub_section: section id. For question: section or sub_section id.',
  })
  @IsOptional()
  @IsUUID()
  @IsNotEmpty()
  new_parent_id?: string;

  @ApiPropertyOptional({
    enum: ReorderParentType,
    example: 'section',
    description:
      'Type of the new parent. Optional for questions: if omitted, the API auto-detects by new_parent_id (or keeps current parent type for in-place reorder). Used for promote/demote to clarify target level.',
  })
  @IsOptional()
  @IsEnum(ReorderParentType)
  new_parent_type?: ReorderParentType;

  @ApiPropertyOptional({
    enum: ReorderItemType,
    example: 'main_section',
    description:
      'Target item type for promote/demote. When different from item_type, the item is converted. E.g. item_type=section + new_item_type=main_section promotes a section to a main section.',
  })
  @IsOptional()
  @IsEnum(ReorderItemType)
  new_item_type?: ReorderItemType;

  @ApiPropertyOptional({
    example: 2,
    description:
      'New 1-based rank/position. Required for operation=change_rank. Optional for move (if omitted, item is placed at end).',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  new_rank?: number;
}
