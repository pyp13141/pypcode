import { Body, Controller, HttpCode, Inject, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { ApplicationView } from '../../care-view';
import { ApplicationRejectService } from './application-reject.service';

class RejectDto {
  @IsOptional() @IsString() @MaxLength(200) reason?: string;
}

/** POST /api/v1/care/applications/:applicationId/reject — 契约：docs/modules/care/application-reject.md */
@ApiTags('care')
@Controller('care/applications')
export class ApplicationRejectController {
  constructor(@Inject(ApplicationRejectService) private readonly service: ApplicationRejectService) {}

  @Post(':applicationId/reject')
  @HttpCode(200)
  @ApiOperation({ summary: '拒绝申请（仅需求方；PENDING→REJECTED）' })
  @ApiOkResponse({ description: 'ApplicationView' })
  async reject(
    @CurrentUser() auth: AuthUser,
    @Param('applicationId') applicationId: string,
    @Body() dto: RejectDto,
  ): Promise<ApplicationView> {
    return this.service.reject(applicationId, auth.id, dto.reason);
  }
}
