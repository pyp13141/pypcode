import { Module } from '@nestjs/common';
import { CareModule } from '../care/care.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CommunitySharedService } from './community-shared.service';
import { FeedController } from './endpoints/feed/get-feed.controller';
import { FeedService } from './endpoints/feed/feed.service';
import { PostsController } from './endpoints/posts/posts.controller';
import { PostsService } from './endpoints/posts/posts.service';
import { PostByIdController } from './endpoints/post-by-id/post-by-id.controller';
import { PostCommentsController } from './endpoints/post-comments/post-comments.controller';
import { PostCommentsService } from './endpoints/post-comments/post-comments.service';
import { CommentByIdController } from './endpoints/comment-by-id/comment-by-id.controller';
import { CommentByIdService } from './endpoints/comment-by-id/comment-by-id.service';
import { ReactionsController } from './endpoints/reactions/reactions.controller';
import { ReactionsService } from './endpoints/reactions/reactions.service';
import { FollowsController } from './endpoints/follows/follows.controller';
import { FollowsService } from './endpoints/follows/follows.service';
import { PostHideController } from './endpoints/post-hide/post-hide.controller';
import { LeaderboardsController } from './endpoints/leaderboards/get-leaderboards.controller';
import { LeaderboardsService } from './endpoints/leaderboards/leaderboards.service';
import { BadgesController } from './endpoints/badges/badges.controller';
import { HelpPostsController } from './endpoints/help-posts/help-posts.controller';
import { HelpPostsService } from './endpoints/help-posts/help-posts.service';
import { HelpPostByIdController } from './endpoints/help-post-by-id/help-post-by-id.controller';
import { HelpPostResolveController } from './endpoints/help-post-resolve/help-post-resolve.controller';
import { HelpPostCancelController } from './endpoints/help-post-cancel/help-post-cancel.controller';

/**
 * 社区模块（M4）：信息流（推荐/关注/最新）、帖子/评论/互动/关注/隐藏、榜单、徽章、
 * 通用求助帖（D-010 轻量层）。契约总览 docs/modules/community.md。
 */
@Module({
  imports: [NotificationsModule, CareModule],
  controllers: [
    FeedController,
    PostsController,
    PostByIdController,
    PostCommentsController,
    CommentByIdController,
    ReactionsController,
    FollowsController,
    PostHideController,
    LeaderboardsController,
    BadgesController,
    HelpPostsController,
    HelpPostByIdController,
    HelpPostResolveController,
    HelpPostCancelController,
  ],
  providers: [CommunitySharedService, FeedService, PostsService, PostCommentsService, CommentByIdService, ReactionsService, FollowsService, LeaderboardsService, HelpPostsService],
  exports: [CommunitySharedService],
})
export class CommunityModule {}
