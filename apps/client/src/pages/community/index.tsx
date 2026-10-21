import { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { useState } from 'react';
import { View, Text, Button } from '@tarojs/components';
import { platform } from '../../adapters';
import { fetchPaged } from '../../services/api-client';
import './index.scss';

interface Post {
  id: string;
  content: string;
  moderationStatus: string;
  author: { nickname: string };
  likeCount: number;
  commentCount: number;
  isLiked: boolean;
  createdAt: string;
}

interface HelpPost {
  id: string;
  category: string;
  title: string;
  status: string;
  author: { nickname: string };
  commentCount: number;
}

const CATEGORY_LABEL: Record<string, string> = { PET_CARE: '宠物相关', NEIGHBOR: '邻里小事' };

export default function CommunityPage() {
  const [tab, setTab] = useState<'feed' | 'help'>('feed');
  const [posts, setPosts] = useState<Post[]>([]);
  const [helpPosts, setHelpPosts] = useState<HelpPost[]>([]);

  const load = async () => {
    try {
      const [feed, help] = await Promise.all([
        fetchPaged<Post>('/community/feed?tab=recommended&pageSize=20'),
        fetchPaged<HelpPost>('/community/help-posts?pageSize=20'),
      ]);
      setPosts(feed.items);
      setHelpPosts(help.items);
    } catch {
      /* ignore */
    }
  };

  useDidShow(() => {
    void load();
  });

  usePullDownRefresh(() => {
    void load();
  });

  return (
    <View className='pn-page'>
      <View className='pn-seg'>
        <View className={`pn-seg__item${tab === 'feed' ? ' pn-seg__item--active' : ''}`} onClick={() => setTab('feed')}>
          社区动态
        </View>
        <View className={`pn-seg__item${tab === 'help' ? ' pn-seg__item--active' : ''}`} onClick={() => setTab('help')}>
          邻里求助
        </View>
      </View>

      {tab === 'feed' && (
        <View>
          <Button className='pn-btn' onClick={() => platform.navigation.to('/pages/post-publish/index')}>
            发布动态
          </Button>
          <View className='pn-list'>
            {posts.length === 0 && <View className='pn-empty'>还没有内容，发第一条吧（新账号内容会先经人工审核）</View>}
            {posts.map((post) => (
              <View key={post.id} className='pn-item' onClick={() => platform.navigation.to(`/pages/post/index?id=${post.id}`)}>
                <View className='pn-item__head'>
                  <View className='pn-avatar'>{post.author.nickname.slice(0, 1)}</View>
                  <View style={{ flex: 1 }}>
                    <Text className='pn-item__title'>{post.author.nickname}</Text>
                    <Text className='pn-item__meta'>{post.createdAt.slice(5, 16).replace('T', ' ')}</Text>
                  </View>
                  {post.moderationStatus !== 'APPROVED' && <Text className='pn-tag pn-tag--warn'>待审核</Text>}
                </View>
                <Text className='pn-item__body'>{post.content.slice(0, 120)}</Text>
                <View className='pn-item__foot'>
                  <Text>♥ {post.likeCount}</Text>
                  <Text>💬 {post.commentCount}</Text>
                  <Text>分享 ›</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {tab === 'help' && (
        <View>
          <Button className='pn-btn pn-btn--accent' onClick={() => platform.navigation.to('/pages/help-publish/index')}>
            发求助帖
          </Button>
          <View className='pn-list'>
            {helpPosts.length === 0 && <View className='pn-empty'>附近还没有求助帖</View>}
            {helpPosts.map((item) => (
              <View key={item.id} className='pn-item' onClick={() => platform.navigation.to(`/pages/post/index?id=${item.postId ?? ''}&helpId=${item.id}`)}>
                <View className='pn-item__head'>
                  <Text className='pn-item__title'>{item.title}</Text>
                  <Text className={`pn-tag${item.status === 'OPEN' ? ' pn-tag--warn' : ' pn-tag--success'}`}>
                    {item.status === 'OPEN' ? '求助中' : item.status === 'RESOLVED' ? '已解决' : '已关闭'}
                  </Text>
                </View>
                <Text className='pn-item__meta'>
                  {CATEGORY_LABEL[item.category] ?? item.category} · {item.author.nickname} · 评论 {item.commentCount}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
