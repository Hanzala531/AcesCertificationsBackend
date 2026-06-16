import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  SwaggerCreateIndustry,
  SwaggerGetAllIndustries,
  SwaggerSearchIndustries,
  SwaggerGetIndustryById,
  SwaggerUpdateIndustry,
  SwaggerDeleteIndustry,
} from './swagger/industry.swagger';
import { AuthGuard } from '@nestjs/passport';
import { RoleGuard } from '../auth/role.guard';
import { Roles } from '../auth/roles.decorator';
import { IndustryService } from './industry.service';
import { CreateIndustryDto } from './dto/create-industry.dto';
import { UpdateIndustryDto } from './dto/update-industry.dto';
import type { RequestWithUser } from '../auth/types/auth.types';

@ApiTags('🏭 Industries')
@Controller('industries')
export class IndustryController {
  constructor(private industryService: IndustryService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), RoleGuard)
  @Roles('admin', 'subadmin')
  @SwaggerCreateIndustry()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Request() req: RequestWithUser,
    @Body() dto: CreateIndustryDto,
  ): Promise<Record<string, unknown>> {
    const userId = req.user?.sub;
    const data = await this.industryService.create(dto, userId);
    return {
      message: 'Industry created successfully',
      data,
    };
  }

  @Get()
  @SwaggerGetAllIndustries()
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ): Promise<Record<string, unknown>> {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(parseInt(limit, 10) || 10, 100));
    const offset = (pageNum - 1) * limitNum;
    const data = await this.industryService.findAll(limitNum, offset);
    return {
      message: 'Industries retrieved successfully',
      data,
    };
  }

  @Get('search')
  @SwaggerSearchIndustries()
  async search(
    @Query('q') searchTerm: string,
  ): Promise<Record<string, unknown>> {
    const data = await this.industryService.search(searchTerm);
    return {
      message: 'Search results retrieved successfully',
      data,
    };
  }

  @Get(':id')
  @SwaggerGetIndustryById()
  async findById(@Param('id') id: string): Promise<Record<string, unknown>> {
    const data = await this.industryService.findById(id);
    return {
      message: 'Industry retrieved successfully',
      data,
    };
  }

  @Put(':id')
  @UseGuards(AuthGuard('jwt'), RoleGuard)
  @Roles('admin', 'subadmin')
  @SwaggerUpdateIndustry()
  async update(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateIndustryDto,
  ): Promise<Record<string, unknown>> {
    const userId = req.user?.sub;
    const data = await this.industryService.update(id, dto, userId);
    return {
      message: 'Industry updated successfully',
      data,
    };
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RoleGuard)
  @Roles('admin', 'subadmin')
  @SwaggerDeleteIndustry()
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id') id: string): Promise<Record<string, unknown>> {
    await this.industryService.delete(id);
    return {
      message: `Industry deleted successfully`,
      data: { id },
    };
  }
}
