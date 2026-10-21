import { BadRequestException, Body, Controller, Delete, Get, Inject, NotFoundException, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { ERROR_CODES } from '../../../../common/error-codes';
import { PrismaService } from '../../../../prisma/prisma.service';

class AddStationDto {
  @IsString() @MaxLength(36) cityId!: string;
  @IsString() @MaxLength(36) stationId!: string;
  @IsOptional() @IsString() @Length(1, 20) label?: string;
}

/**
 * GET/POST /api/v1/me/stations、DELETE /me/stations/:stationId — 契约：docs/modules/transit/my-stations.md
 * D-009：用户自选常驻站代替地理编码；同 user+station 幂等。
 */
@ApiTags('transit')
@Controller('me/stations')
export class MyStationsController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: '我的常用地铁站' })
  async list(@CurrentUser() auth: AuthUser) {
    const rows = await this.prisma.userStation.findMany({
      where: { userId: auth.id },
      include: { station: { select: { id: true, name: true } }, city: { select: { id: true, name: true } } },
    });
    return rows.map((r) => ({
      stationId: r.station.id,
      stationName: r.station.name,
      cityId: r.city.id,
      cityName: r.city.name,
      label: r.label,
    }));
  }

  @Post()
  @ApiOperation({ summary: '添加常驻站（幂等）' })
  @ApiOkResponse({ description: '同一站点重复添加只更新 label' })
  async add(@CurrentUser() auth: AuthUser, @Body() dto: AddStationDto) {
    const station = await this.prisma.transitStation.findFirst({
      where: { id: dto.stationId, cityId: dto.cityId },
    });
    if (!station) {
      throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '站点不存在' });
    }
    await this.prisma.userStation.upsert({
      where: { userId_stationId: { userId: auth.id, stationId: dto.stationId } },
      create: { userId: auth.id, cityId: dto.cityId, stationId: dto.stationId, label: dto.label },
      update: { label: dto.label },
    });
    return { stationId: station.id, stationName: station.name, label: dto.label ?? null };
  }

  @Delete(':stationId')
  @ApiOperation({ summary: '移除常驻站（幂等）' })
  async remove(@CurrentUser() auth: AuthUser, @Param('stationId') stationId: string) {
    await this.prisma.userStation.deleteMany({ where: { userId: auth.id, stationId } });
    return { removed: true };
  }
}
