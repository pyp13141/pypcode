import { Module } from '@nestjs/common';
import { PetHealthLogsController } from './endpoints/pet-health-logs/pet-health-logs.controller';
import { PetHealthLogsService } from './endpoints/pet-health-logs/pet-health-logs.service';
import { PetMoodLogsController } from './endpoints/pet-mood-logs/pet-mood-logs.controller';
import { PetMoodLogsService } from './endpoints/pet-mood-logs/pet-mood-logs.service';

/**
 * 健康与成长模块（M6）：健康日志 + 情绪日志。
 * 硬约束（产品 6.5/6.6）：只存记录不产建议、不做诊断结论；紧急症状提示就医由客户端文案承担。
 * 读取权限（MVP）：仅主人（订单参与方授权机制复用 pet_care_notes，二期）。
 */
@Module({
  controllers: [PetHealthLogsController, PetMoodLogsController],
  providers: [PetHealthLogsService, PetMoodLogsService],
})
export class HealthModule {}
