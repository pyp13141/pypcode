import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../../common/decorators/public.decorator';
import { ERROR_CODES } from '../../../../common/error-codes';
import { GetHealthService, HealthStatus } from './get-health.service';

/**
 * GET /api/v1/health — 存活与数据库连通性检查
 * 契约文档：docs/modules/system/health.md（错误码见 docs/ERRORS.md）
 */
@ApiTags('system')
@Controller('health')
export class GetHealthController {
  constructor(private readonly service: GetHealthService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: '存活与数据库连通性检查' })
  @ApiOkResponse({ description: 'status=ok 表示 API 与数据库均正常' })
  async execute(): Promise<HealthStatus> {
    const result = await this.service.execute();
    if (result.db === 'error') {
      throw new ServiceUnavailableException({
        code: ERROR_CODES.HEALTH_DB_UNAVAILABLE,
        message: '数据库不可用',
      });
    }
    return result;
  }
}
