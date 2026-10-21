import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** 宠物 DTO + 字段白名单（ERD/产品文档 6.2：健康与医疗字段任何可见性下都不进公开 DTO） */

export class PetOwnerView {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() species!: string;
  @ApiPropertyOptional() breed!: string | null;
  @ApiPropertyOptional() sex!: string | null;
  @ApiPropertyOptional() birthDate!: string | null;
  @ApiPropertyOptional() weightValue!: number | null;
  @ApiPropertyOptional() weightUnit!: string | null;
  @ApiPropertyOptional() weightMeasuredAt!: string | null;
  @ApiPropertyOptional() sterilized!: string | null;
  @ApiProperty() visibility!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

/** 他人可见的公开字段子集（仅 visibility=PUBLIC 时返回） */
export class PetPublicView {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() species!: string;
  @ApiPropertyOptional() breed!: string | null;
  @ApiPropertyOptional() sex!: string | null;
  @ApiPropertyOptional() birthDate!: string | null;
  @ApiProperty() visibility!: string;
}

type PetRow = {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  sex: string | null;
  birthDate: Date | null;
  weightValue: number | null;
  weightUnit: string | null;
  weightMeasuredAt: Date | null;
  sterilized: string | null;
  visibility: string;
  createdAt: Date;
  updatedAt: Date;
};

export function toOwnerView(pet: PetRow): PetOwnerView {
  return {
    id: pet.id,
    name: pet.name,
    species: pet.species,
    breed: pet.breed,
    sex: pet.sex,
    birthDate: pet.birthDate?.toISOString().slice(0, 10) ?? null,
    weightValue: pet.weightValue,
    weightUnit: pet.weightUnit,
    weightMeasuredAt: pet.weightMeasuredAt?.toISOString() ?? null,
    sterilized: pet.sterilized,
    visibility: pet.visibility,
    createdAt: pet.createdAt.toISOString(),
    updatedAt: pet.updatedAt.toISOString(),
  };
}

export function toPublicView(pet: PetRow): PetPublicView {
  return {
    id: pet.id,
    name: pet.name,
    species: pet.species,
    breed: pet.breed,
    sex: pet.sex,
    birthDate: pet.birthDate?.toISOString().slice(0, 10) ?? null,
    visibility: pet.visibility,
  };
}
