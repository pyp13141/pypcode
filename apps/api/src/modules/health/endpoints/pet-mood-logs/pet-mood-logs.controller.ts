import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { Paginated } from '../../../../common/pagination';
import { EMERGENCY_HINT, MOOD_TAGS } from '../../health-state';
import { PetMoodLogsService } from './pet-mood-logs.service';

class CreateMoodLogDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(5) @IsString({ each: true }) moodTags!: string[];
  @IsOptional() @IsInt() @Min(1) @Max(5) severity?: number;
  @IsString() observedAt!: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

class ListMoodLogsParams {
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() pageSize?: string;
}

/** POST/GET /api/v1/pets/:petId/mood-logs — 契约：docs/modules/health/pet-mood-logs.md */
@ApiTags('health')
@Controller('pets')
export class PetMoodLogsController {
  constructor(@Inject(PetMoodLogsService) private readonly service: PetMoodLogsService) {}

  @Post(':petId/mood-logs')
  @ApiOperation({ summary: '记录情绪观察（仅主人；主观标签，非诊断）' })
  async create(@CurrentUser() auth: AuthUser, @Param('petId') petId: string, @Body() dto: CreateMoodLogDto) {
    const log = await this.service.create(petId, auth.id, dto);
    return { log, disclaimer: EMERGENCY_HINT };
  }

  @Get(':petId/mood-logs')
  @ApiOperation({ summary: '情绪日志列表（仅主人）' })
  @ApiOkResponse({ description: '分页：data 为 MoodLogView[]' })
  async list(@CurrentUser() auth: AuthUser, @Param('petId') petId: string, @Query() query: ListMoodLogsParams) {
    return this.service.list(petId, auth.id, query.page, query.pageSize);
  }
}
