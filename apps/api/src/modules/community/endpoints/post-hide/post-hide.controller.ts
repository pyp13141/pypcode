import { Controller, HttpCode, Inject, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../../common/guards/auth.guard';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CommunitySharedService } from '../../community-shared.service';

/**
 * POST /api/v1/community/posts/:id/hide — 契约：docs/modules/community/post-hide.md
 * 「不感兴趣」：仅影响当前用户信息流（本地偏好，post_hides，幂等）。
 */
@ApiTags('community')
@Controller('community/posts')
export class PostHideController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CommunitySharedService) private readonly shared: CommunitySharedService,
  ) {}

  @Post(':id/hide')
  @HttpCode(200)
  @ApiOperation({ summary: '不感兴趣（仅本人信息流；幂等）' })
  async hide(@CurrentUser() auth: AuthUser, @Param('id') id: string): Promise<{ hidden: true }> {
    await this.shared.requireVisiblePost(id, auth.id);
    await this.prisma.postHide.createMany({ data: [{ userId: auth.id, postId: id }], skipDuplicates: true });
    return { hidden: true };
  }
}
