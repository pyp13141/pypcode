import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../../common/decorators/public.decorator';

export interface MetaResult {
  name: string;
  version: string;
  env: string;
  paymentEnabled: boolean;
}

/**
 * GET /api/v1/meta — 服务版本与环境标识
 * 契约文档：docs/modules/system/meta.md
 */
@ApiTags('system')
@Controller('meta')
export class GetMetaController {
  @Get()
  @Public()
  @ApiOperation({ summary: '服务版本与环境标识' })
  execute(): MetaResult {
    return {
      name: 'pet-neighbor-api',
      version: process.env.APP_VERSION ?? '0.1.0',
      env: process.env.NODE_ENV ?? 'development',
      paymentEnabled: process.env.PAYMENT_ENABLED === 'true',
    };
  }
}
