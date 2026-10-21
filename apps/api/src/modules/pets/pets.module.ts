import { Module } from '@nestjs/common';
import { PetsController } from './endpoints/pets/pets.controller';
import { PetByIdController } from './endpoints/pet-by-id/pet-by-id.controller';

/** 宠物模块：档案 CRUD + 字段白名单。契约见 docs/modules/pets.md */
@Module({
  controllers: [PetsController, PetByIdController],
})
export class PetsModule {}
