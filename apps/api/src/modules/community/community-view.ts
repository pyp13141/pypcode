/**
 * community 视图白名单：作者只出 public brief；内容不带密文。
 */
import type { Comment, Post, User } from '@prisma/client';

export interface CommunityUserBrief {
  id: string;
  nickname: string;
  avatarUrl: string | null;
}

export interface PostView {
  id: string;
  postType: string;
  content: string;
  visibility: string;
  moderationStatus: string;
  author: CommunityUserBrief;
  imageMediaIds: string[];
  likeCount: number;
  favoriteCount: number;
  commentCount: number;
  isLiked: boolean;
  isFavorited: boolean;
  isOwner: boolean;
  createdAt: string;
}

export interface CommentView {
  id: string;
  postId: string;
  parentId: string | null;
  content: string;
  author: CommunityUserBrief;
  isOwner: boolean;
  createdAt: string;
}

export interface HelpPostView {
  id: string;
  postId: string;
  category: string;
  title: string;
  content: string;
  status: string;
  cityId: string | null;
  stationId: string | null;
  deadlineAt: string | null;
  author: CommunityUserBrief;
  commentCount: number;
  isOwner: boolean;
  createdAt: string;
}

export function toCommunityUserBrief(user: Pick<User, 'id' | 'nickname' | 'avatarUrl'>): CommunityUserBrief {
  return { id: user.id, nickname: user.nickname, avatarUrl: user.avatarUrl };
}

export function toPostView(
  post: Post & { author: User; media: { mediaAssetId: string; sortOrder: number }[] },
  viewerId: string | undefined,
  counts: { likeCount: number; favoriteCount: number; commentCount: number },
  flags: { liked: boolean; favorited: boolean },
): PostView {
  return {
    id: post.id,
    postType: post.postType,
    content: post.content,
    visibility: post.visibility,
    moderationStatus: post.moderationStatus,
    author: toCommunityUserBrief(post.author),
    imageMediaIds: [...post.media].sort((a, b) => a.sortOrder - b.sortOrder).map((m) => m.mediaAssetId),
    likeCount: counts.likeCount,
    favoriteCount: counts.favoriteCount,
    commentCount: counts.commentCount,
    isLiked: flags.liked,
    isFavorited: flags.favorited,
    isOwner: viewerId === post.authorUserId,
    createdAt: post.createdAt.toISOString(),
  };
}

export function toCommentView(comment: Comment & { author: User }, viewerId?: string): CommentView {
  return {
    id: comment.id,
    postId: comment.postId,
    parentId: comment.parentId,
    content: comment.content,
    author: toCommunityUserBrief(comment.author),
    isOwner: viewerId === comment.authorUserId,
    createdAt: comment.createdAt.toISOString(),
  };
}

export function toHelpPostView(
  helpPost: {
    id: string;
    postId: string;
    authorUserId: string;
    category: string;
    title: string;
    cityId: string | null;
    stationId: string | null;
    deadlineAt: Date | null;
    status: string;
    createdAt: Date;
    author: User;
  },
  content: string,
  commentCount: number,
  viewerId?: string,
): HelpPostView {
  return {
    id: helpPost.id,
    postId: helpPost.postId,
    category: helpPost.category,
    title: helpPost.title,
    content,
    status: helpPost.status,
    cityId: helpPost.cityId,
    stationId: helpPost.stationId,
    deadlineAt: helpPost.deadlineAt?.toISOString() ?? null,
    author: toCommunityUserBrief(helpPost.author),
    commentCount,
    isOwner: viewerId === helpPost.authorUserId,
    createdAt: helpPost.createdAt.toISOString(),
  };
}
