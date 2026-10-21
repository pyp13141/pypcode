import { Body, Controller, Delete, HttpCode, Inject, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsUUID } from 'class-validator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { ReactionResultView, ReactionsService } from './reactions.service';

class ReactionDto {
  @IsIn(['POST', 'COMMENT']) targetType!: string;
  @IsUUID('4') targetId!: string;
  @IsIn(['LIKE', 'FAVORITE']) reactionType!: string;
}

/** POST/DELETE /api/v1/community/reactions — 契约：docs/modules/community/reactions.md */
@ApiTags('community')
@Controller('community/reactions')
export class ReactionsController {
  constructor(@Inject(ReactionsService) private readonly service: ReactionsService) {}

  @Post()
  @ApiOperation({ summary: '点赞/收藏（幂等；目标须存在且可见）' })
  @ApiOkResponse({ description: '{ targetType, targetId, reactionType, reacted, count }' })
  async react(@CurrentUser() auth: AuthUser, @Body() dto: ReactionDto): Promise<ReactionResultView> {
    return this.service.react(auth.id, dto.targetType, dto.targetId, dto.reactionType);
  }

  @Delete()
  @HttpCode(200)
  @ApiOperation({ summary: '取消点赞/收藏（幂等；D-013 补口）' })
  async unreact(@CurrentUser() auth: AuthUser, @Body() dto: ReactionDto): Promise<ReactionResultView> {
    return this.service.unreact(auth.id, dto.targetType, dto.targetId, dto.reactionType);
  }
}
