import { Controller, Delete, Inject, Param, Put } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { FollowView, FollowsService } from './follows.service';

/** PUT/DELETE /api/v1/community/users/:userId/follow — 契约：docs/modules/community/follows.md */
@ApiTags('community')
@Controller('community/users')
export class FollowsController {
  constructor(@Inject(FollowsService) private readonly service: FollowsService) {}

  @Put(':userId/follow')
  @ApiOperation({ summary: '关注（幂等；禁自关注）' })
  @ApiOkResponse({ description: '{ userId, following, followerCount }' })
  async follow(@CurrentUser() auth: AuthUser, @Param('userId') userId: string): Promise<FollowView> {
    return this.service.follow(auth.id, userId);
  }

  @Delete(':userId/follow')
  @ApiOperation({ summary: '取消关注（幂等）' })
  @ApiOkResponse({ description: '{ userId, following, followerCount }' })
  async unfollow(@CurrentUser() auth: AuthUser, @Param('userId') userId: string): Promise<FollowView> {
    return this.service.unfollow(auth.id, userId);
  }
}
