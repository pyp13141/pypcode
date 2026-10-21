import { useLoad, useRouter, usePullDownRefresh, useShareAppMessage } from '@tarojs/taro';
import { useState } from 'react';
import { View, Text, Input, Button } from '@tarojs/components';
import { platform } from '../../adapters';
import { api } from '../../services/api-client';
import './index.scss';

interface CommentView {
  id: string;
  parentId: string | null;
  content: string;
  author: { nickname: string };
  isOwner: boolean;
}

interface PostPayload {
  post: {
    id: string;
    content: string;
    author: { nickname: string };
    likeCount: number;
    favoriteCount: number;
    isLiked: boolean;
    isFavorited: boolean;
    moderationStatus: string;
    isOwner: boolean;
  };
  comments: CommentView[];
  helpPostId: string | null;
}

export default function PostPage() {
  const router = useRouter();
  const id = router.params.id ?? '';
  const [payload, setPayload] = useState<PostPayload | null>(null);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    setPayload(await api.get<PostPayload>(`/community/posts/${id}`));
  };

  useShareAppMessage(() => ({
    title: '宠邻社区内容',
    path: `/pages/post/index?id=${id}`,
  }));

  useLoad(() => {
    load().catch((error) => platform.toast.error(error instanceof Error ? error.message : '加载失败'));
  });

  usePullDownRefresh(() => {
    void load();
  });

  async function react(type: 'LIKE' | 'FAVORITE') {
    if (!payload) return;
    const active = type === 'LIKE' ? payload.post.isLiked : payload.post.isFavorited;
    try {
      if (active) {
        await api.delete('/community/reactions', { targetType: 'POST', targetId: id, reactionType: type });
      } else {
        await api.post('/community/reactions', { targetType: 'POST', targetId: id, reactionType: type });
      }
      await load();
    } catch (error) {
      platform.toast.error(error instanceof Error ? error.message : '操作失败');
    }
  }

  async function submitComment() {
    if (draft.trim().length === 0) return;
    try {
      await api.post(`/community/posts/${id}/comments`, { content: draft.trim(), ...(replyTo ? { parentId: replyTo } : {}) });
      setDraft('');
      setReplyTo(null);
      await load();
    } catch (error) {
      platform.toast.error(error instanceof Error ? error.message : '评论失败');
    }
  }

  return (
    <View className='pn-page'>
      {payload && (
        <View>
          <View className='pn-card'>
            <Text className='pn-card__title'>{payload.post.author.nickname}</Text>
            {payload.post.moderationStatus !== 'APPROVED' && <Text className='pn-tag pn-tag--warn'>待审核（仅自己可见）</Text>}
            <Text className='pn-card__desc'>{payload.post.content}</Text>
            <View className='pn-row'>
              <Text className='pn-tag' onClick={() => react('LIKE')}>
                {payload.post.isLiked ? '已赞' : '点赞'} {payload.post.likeCount}
              </Text>
              <Text className='pn-tag' onClick={() => react('FAVORITE')}>
                {payload.post.isFavorited ? '已收藏' : '收藏'} {payload.post.favoriteCount}
              </Text>
              <Text className='pn-tag pn-tag--muted' onClick={() => platform.share.share('宠邻社区内容', `/pages/post/index?id=${id}`)}>
                分享
              </Text>
            </View>
          </View>

          <View className='pn-card'>
            <Text className='pn-card__title'>评论（{payload.comments.length}）</Text>
            {payload.comments.map((comment) => (
              <View key={comment.id} className='pn-row'>
                <View>
                  <Text className='pn-item__meta'>
                    {comment.author.nickname}
                    {comment.parentId ? ' 回复' : ''}
                  </Text>
                  <Text className='pn-item__body'>{comment.content}</Text>
                </View>
                <Text className='pn-tag pn-tag--muted' onClick={() => setReplyTo(comment.parentId ?? comment.id)}>
                  回复
                </Text>
              </View>
            ))}
            {replyTo && <Text className='pn-item__meta'>正在回复 #{replyTo.slice(0, 6)}（再点其他评论可切换；发送后生效）</Text>}
            <Input className='pn-input' placeholder='友善评论' value={draft} onInput={(e) => setDraft(e.detail.value)} />
            <Button className='pn-btn' onClick={submitComment}>
              发送
            </Button>
          </View>
        </View>
      )}
      {!payload && <View className='pn-empty'>加载中…（待审核内容仅作者可见）</View>}
    </View>
  );
}
