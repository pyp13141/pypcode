import { Body, ConflictException, Controller, Get, Inject, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { ERROR_CODES } from '../../../../common/error-codes';
import { PrismaService } from '../../../../prisma/prisma.service';
import { PetOwnerView, toOwnerView } from '../../pet-view';

const PET_LIMIT = 50;

class CreatePetDto {
  @IsString() @Length(1, 20) name!: string;
  @IsIn(['CAT', 'DOG', 'BIRD', 'SMALL_ANIMAL', 'OTHER']) species!: string;
  @IsOptional() @IsString() @MaxLength(50) breed?: string;
  @IsOptional() @IsIn(['MALE', 'FEMALE', 'UNKNOWN']) sex?: string;
  @IsOptional() @IsString() birthDate?: string; // ISO 日期，应用层校验不超今天
  @IsOptional() @IsNumber() @Min(0.01) @Max(500) weightValue?: number;
  @IsOptional() @IsIn(['kg', 'g', 'lb']) weightUnit?: string;
  @IsOptional() @IsIn(['YES', 'NO', 'UNKNOWN']) sterilized?: string;
  @IsOptional() @IsIn(['PRIVATE', 'PUBLIC']) visibility?: string;
}

/**
 * GET/POST /api/v1/pets — 契约：docs/modules/pets/pets.md
 * GET 返回本人全字段视图；POST 建档（软上限 50 只/人）。
 */
@ApiTags('pets')
@Controller('pets')
export class PetsController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: '我的宠物列表（全字段）' })
  @ApiOkResponse({ type: [PetOwnerView] })
  async list(@CurrentUser() auth: AuthUser): Promise<PetOwnerView[]> {
    const pets = await this.prisma.pet.findMany({
      where: { ownerUserId: auth.id, archivedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return pets.map(toOwnerView);
  }

  @Post()
  @ApiOperation({ summary: '新建宠物档案' })
  @ApiOkResponse({ type: PetOwnerView })
  async create(@CurrentUser() auth: AuthUser, @Body() dto: CreatePetDto): Promise<PetOwnerView> {
    if (dto.birthDate && new Date(dto.birthDate) > new Date()) {
      throw new ConflictException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: '出生日期不能晚于今天' });
    }
    if (dto.weightValue !== undefined && dto.weightUnit === undefined) {
      throw new ConflictException({ code: ERROR_CODES.REQUEST_VALIDATION_FAILED, message: '填写体重时必须提供单位' });
    }
    const count = await this.prisma.pet.count({ where: { ownerUserId: auth.id, archivedAt: null } });
    if (count >= PET_LIMIT) {
      throw new ConflictException({ code: ERROR_CODES.PET_LIMIT_REACHED, message: `宠物档案已达上限（${PET_LIMIT} 只）` });
    }
    const pet = await this.prisma.pet.create({
      data: {
        ownerUserId: auth.id,
        name: dto.name,
        species: dto.species,
        breed: dto.breed,
        sex: dto.sex,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        weightValue: dto.weightValue,
        weightUnit: dto.weightUnit,
        weightMeasuredAt: dto.weightValue !== undefined ? new Date() : null,
        sterilized: dto.sterilized,
        visibility: dto.visibility ?? 'PRIVATE',
      },
    });
    return toOwnerView(pet);
  }
}
