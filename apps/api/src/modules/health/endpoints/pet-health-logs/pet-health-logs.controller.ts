import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { Paginated } from '../../../../common/pagination';
import { EMERGENCY_HINT, HEALTH_LOG_TYPES, HEALTH_SOURCES } from '../../health-state';
import { PetHealthLogsService } from './pet-health-logs.service';

class CreateHealthLogDto {
  @IsIn(HEALTH_LOG_TYPES as unknown as string[]) logType!: string;
  @IsOptional() @IsNumber() valueNum?: number;
  @IsOptional() @IsString() @Length(1, 20) unit?: string;
  @IsString() recordedAt!: string;
  @IsOptional() @IsIn(HEALTH_SOURCES as unknown as string[]) source?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

class ListHealthLogsParams {
  @IsOptional() @IsIn(HEALTH_LOG_TYPES as unknown as string[]) logType?: string;
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() pageSize?: string;
}

/** POST/GET /api/v1/pets/:petId/health-logs — 契约：docs/modules/health/pet-health-logs.md */
@ApiTags('health')
@Controller('pets')
export class PetHealthLogsController {
  constructor(@Inject(PetHealthLogsService) private readonly service: PetHealthLogsService) {}

  @Post(':petId/health-logs')
  @ApiOperation({ summary: '记录健康日志（仅主人；只记录不产建议）' })
  async create(@CurrentUser() auth: AuthUser, @Param('petId') petId: string, @Body() dto: CreateHealthLogDto) {
    const log = await this.service.create(petId, auth.id, dto);
    // 6.5：随响应下发就医提醒文案（服务端不做症状判定）
    return { log, emergencyHint: EMERGENCY_HINT };
  }

  @Get(':petId/health-logs')
  @ApiOperation({ summary: '健康日志列表（仅主人；?logType= 过滤，按记录时间倒序）' })
  @ApiOkResponse({ description: '分页：data 为 HealthLogView[]' })
  async list(
    @CurrentUser() auth: AuthUser,
    @Param('petId') petId: string,
    @Query() query: ListHealthLogsParams,
  ): Promise<Paginated<ReturnType<PetHealthLogsService['create']> extends never ? never : object>> {
    return this.service.list(petId, auth.id, query.logType, query.page, query.pageSize) as never;
  }
}
