import { Body, Controller, HttpCode, Inject, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { ApplicationView } from '../../care-view';
import { ApplicationWithdrawService } from './application-withdraw.service';

class WithdrawDto {
  @IsOptional() @IsString() @MaxLength(200) reason?: string;
}

/** POST /api/v1/care/applications/:applicationId/withdraw — 契约：docs/modules/care/application-withdraw.md */
@ApiTags('care')
@Controller('care/applications')
export class ApplicationWithdrawController {
  constructor(@Inject(ApplicationWithdrawService) private readonly service: ApplicationWithdrawService) {}

  @Post(':applicationId/withdraw')
  @HttpCode(200)
  @ApiOperation({ summary: '撤回申请（仅申请人；PENDING→WITHDRAWN）' })
  @ApiOkResponse({ description: 'ApplicationView' })
  async withdraw(
    @CurrentUser() auth: AuthUser,
    @Param('applicationId') applicationId: string,
    @Body() dto: WithdrawDto,
  ): Promise<ApplicationView> {
    return this.service.withdraw(applicationId, auth.id, dto.reason);
  }
}
