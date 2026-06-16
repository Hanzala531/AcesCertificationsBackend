import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { IndustryRepository } from './industry.repository';
import { CreateIndustryDto } from './dto/create-industry.dto';
import { UpdateIndustryDto } from './dto/update-industry.dto';
import { CacheService } from '../../common/services/cache.service';

const INDUSTRY_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

@Injectable()
export class IndustryService {
  constructor(
    private industryRepo: IndustryRepository,
    private cache: CacheService,
  ) {}

  async create(
    dto: CreateIndustryDto,
    userId?: string,
  ): Promise<Record<string, unknown>> {
    if (!dto.name || dto.name.trim() === '') {
      throw new BadRequestException('Industry name is required');
    }

    const trimmedName = dto.name.trim();
    const existing = await this.industryRepo.findByName(trimmedName);
    if (existing) {
      throw new ConflictException(
        `Industry with name "${trimmedName}" already exists`,
      );
    }

    const created = await this.industryRepo.create(trimmedName, userId);
    this.cache.invalidatePrefix('industries:');
    return created;
  }

  async findAll(
    limit: number = 10,
    offset: number = 0,
  ): Promise<{
    data: Record<string, unknown>[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const validLimit = Math.max(1, Math.min(limit, 100));
    const validOffset = Math.max(0, offset);

    const cacheKey = `industries:${validLimit}:${validOffset}`;
    const result = await this.cache.getOrSet(cacheKey, INDUSTRY_CACHE_TTL, () =>
      this.industryRepo.findAll(validLimit, validOffset),
    );

    return {
      data: result.data,
      total: result.total,
      page: Math.floor(validOffset / validLimit) + 1,
      pageSize: validLimit,
      totalPages: Math.ceil(result.total / validLimit),
    };
  }

  async findById(id: string): Promise<Record<string, unknown>> {
    if (!id) {
      throw new BadRequestException('Industry ID is required');
    }

    const industry = await this.industryRepo.findById(id);
    if (!industry) {
      throw new NotFoundException(`Industry with ID "${id}" not found`);
    }

    return industry;
  }

  async update(
    id: string,
    dto: UpdateIndustryDto,
    userId?: string,
  ): Promise<Record<string, unknown>> {
    if (!id) {
      throw new BadRequestException('Industry ID is required');
    }

    const existing = await this.industryRepo.findById(id);
    if (!existing) {
      throw new NotFoundException(`Industry with ID "${id}" not found`);
    }

    if (dto.name && dto.name.trim() !== '') {
      const nameExists = await this.industryRepo.findByName(dto.name);
      if (nameExists && nameExists.id !== id) {
        throw new ConflictException(
          `Industry with name "${dto.name}" already exists`,
        );
      }

      const updated = await this.industryRepo.update(
        id,
        dto.name.trim(),
        userId,
      );
      if (!updated) {
        throw new NotFoundException(`Industry with ID "${id}" not found`);
      }
      this.cache.invalidatePrefix('industries:');
      return updated;
    }

    return existing;
  }

  async delete(id: string): Promise<{ message: string }> {
    if (!id) {
      throw new BadRequestException('Industry ID is required');
    }

    const exists = await this.industryRepo.exists(id);
    if (!exists) {
      throw new NotFoundException(`Industry with ID "${id}" not found`);
    }

    await this.industryRepo.delete(id);
    this.cache.invalidatePrefix('industries:');
    return {
      message: `Industry with ID "${id}" has been deleted successfully`,
    };
  }

  async search(searchTerm: string): Promise<Record<string, unknown>[]> {
    if (!searchTerm || searchTerm.trim() === '') {
      return [];
    }

    const { data } = await this.industryRepo.findAll(100, 0);
    const lowerSearchTerm = searchTerm.toLowerCase();

    return data.filter(
      (industry) =>
        typeof industry.name === 'string' &&
        industry.name.toLowerCase().includes(lowerSearchTerm),
    );
  }
}
