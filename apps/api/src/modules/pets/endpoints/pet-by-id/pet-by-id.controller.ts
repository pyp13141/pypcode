import { Controller, Delete, Get, Inject, NotFoundException, Param, Patch } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Body } from '@nestjs/common';
import { IsIn, IsNumber, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { Public } from '../../../../common/decorators/public.decorator';
import { ERROR_CODES } from '../../../../common/error-codes';
import { PrismaService } from '../../../../prisma/prisma.service';
import { PetOwnerView, PetPublicView, toOwnerView, toPublicView } from '../../pet-view';

class UpdatePetDto {
  @IsOptional() @IsString() @Length(1, 20) name?: string;
  @IsOptional() @IsIn(['CAT', 'DOG', 'BIRD', 'SMALL_ANIMAL', 'OTHER']) species?: string;
  @IsOptional() @IsString() @MaxLength(50) breed?: string;
  @IsOptional() @IsIn(['MALE', 'FEMALE', 'UNKNOWN']) sex?: string;
  @IsOptional() @IsString() birthDate?: string;
  @IsOptional() @IsNumber() @Min(0.01) @Max(500) weightValue?: number;
  @IsOptional() @IsIn(['kg', 'g', 'lb']) weightUnit?: string;
  @IsOptional() @IsIn(['YES', 'NO', 'UNKNOWN']) sterilized?: string;
  @IsOptional() @IsIn(['PRIVATE', 'PUBLIC']) visibility?: string;
}

/**
 * /api/v1/pets/:petId — 契约：docs/modules/pets/pet-by-id.md
 * GET 公开但按权限返回：本人全字段；他人 PUBLIC 仅白名单；PRIVATE 对他人 404（不泄露存在性）。
 * PATCH/DELETE 仅主人；DELETE=软删除（archived）。
 */
@ApiTags('pets')
@Controller('pets/:petId')
export class PetByIdController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: '宠物档案（按可见性返回字段白名单）' })
  @ApiOkResponse({ description: '本人→全字段；他人→PUBLIC 仅公开字段，PRIVATE→404' })
  async get(@Param('petId') petId: string, @CurrentUser() auth?: AuthUser) {
    const pet = await this.prisma.pet.findFirst({
      where: { id: petId, archivedAt: null },
    });
    const isOwner = auth != null && pet?.ownerUserId === auth.id;
    if (!pet || (!isOwner && pet.visibility !== 'PUBLIC')) {
      throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '宠物不存在' });
    }
    return isOwner ? toOwnerView(pet) : toPublicView(pet);
  }

  @Patch()
  @ApiOperation({ summary: '更新宠物档案（仅主人）' })
  @ApiOkResponse({ type: PetOwnerView })
  async update(@CurrentUser() auth: AuthUser, @Param('petId') petId: string, @Body() dto: UpdatePetDto): Promise<PetOwnerView> {
    const pet = await this.prisma.pet.findFirst({ where: { id: petId, ownerUserId: auth.id, archivedAt: null } });
    if (!pet) {
      throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '宠物不存在' });
    }
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.species !== undefined) data.species = dto.species;
    if (dto.breed !== undefined) data.breed = dto.breed;
    if (dto.sex !== undefined) data.sex = dto.sex;
    if (dto.birthDate !== undefined) data.birthDate = new Date(dto.birthDate);
    if (dto.weightValue !== undefined) {
      data.weightValue = dto.weightValue;
      data.weightMeasuredAt = new Date(); // 体重必须带测量时间（6.2）
    }
    if (dto.weightUnit !== undefined) data.weightUnit = dto.weightUnit;
    if (dto.sterilized !== undefined) data.sterilized = dto.sterilized;
    if (dto.visibility !== undefined) data.visibility = dto.visibility;
    const updated = await this.prisma.pet.update({ where: { id: petId }, data });
    return toOwnerView(updated);
  }

  @Delete()
  @ApiOperation({ summary: '归档宠物档案（软删除，仅主人）' })
  async remove(@CurrentUser() auth: AuthUser, @Param('petId') petId: string) {
    const pet = await this.prisma.pet.findFirst({ where: { id: petId, ownerUserId: auth.id, archivedAt: null } });
    if (!pet) {
      throw new NotFoundException({ code: ERROR_CODES.RESOURCE_NOT_FOUND, message: '宠物不存在' });
    }
    await this.prisma.pet.update({ where: { id: petId }, data: { archivedAt: new Date() } });
    return { archived: true };
  }
}
