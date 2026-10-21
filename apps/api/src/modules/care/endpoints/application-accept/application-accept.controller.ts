import { Controller, Headers, HttpCode, Inject, Param, Post } from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { IdempotencyService } from '../../../../common/idempotency/idempotency.service';
import { ApplicationAcceptService, AcceptResult } from './application-accept.service';

/**
 * POST /api/v1/care/applications/:applicationId/accept — 契约：docs/modules/care/application-accept.md
 * 幂等键必填；关键事务见 service 注释。
 */
@ApiTags('care')
@Controller('care/applications')
export class ApplicationAcceptController {
  constructor(
    @Inject(ApplicationAcceptService) private readonly service: ApplicationAcceptService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
  ) {}

  @Post(':applicationId/accept')
  @HttpCode(200)
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: '幂等键（同 key 重放返回同一结果）' })
  @ApiOperation({ summary: '接受申请（仅需求方；事务内创建订单并把需求置 MATCHED）' })
  @ApiOkResponse({ description: '{ applicationId, orderId }' })
  async accept(
    @CurrentUser() auth: AuthUser,
    @Param('applicationId') applicationId: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<AcceptResult> {
    const key = this.idempotency.requireKey(idempotencyKey);
    const requestHash = this.idempotency.hashBody({ op: 'care.applications.accept', applicationId });
    return this.service.accept(applicationId, auth.id, key, requestHash);
  }
}
