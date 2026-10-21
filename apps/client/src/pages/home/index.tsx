import { useDidShow } from '@tarojs/taro';
import { useState } from 'react';
import { View, Text } from '@tarojs/components';
import { platform } from '../../adapters';
import { auth, fetchPaged } from '../../services/api-client';
import './index.scss';

export default function HomePage() {
  const [unread, setUnread] = useState(0);
  const loggedIn = Boolean(auth.token());

  useDidShow(() => {
    if (!auth.token()) {
      setUnread(0);
      return;
    }
    fetchPaged<{ id: string }>('/notifications?unreadOnly=true&pageSize=1')
      .then((res) => setUnread(res.total))
      .catch(() => setUnread(0));
  });

  const entries = [
    { emoji: '🐾', title: '我要找人帮忙', desc: '发布喂养/遛宠/照看需求，可信邻居来响应', tab: '/pages/care/index' },
    { emoji: '💚', title: '我可以提供帮助', desc: '发布服务公告，积累真实履约记录', tab: '/pages/care/index' },
    { emoji: '🛍️', title: '逛集市', desc: '闲置赠送/交换/出售，同城线下交接', tab: '/pages/market/index' },
    { emoji: '💬', title: '社区广场', desc: '晒宠物日常、发邻里求助帖', tab: '/pages/community/index' },
  ];

  return (
    <View className='pn-page'>
      <View className='pn-hero'>
        <Text className='pn-hero__title'>🐾 宠邻</Text>
        <View className='pn-hero__slogan'>邻里互助，让每一份爱宠有回应。</View>
      </View>

      {!loggedIn && (
        <View className='pn-card' onClick={() => platform.navigation.to('/pages/login/index')}>
          <Text className='pn-card__title'>先登录，再开始互助</Text>
          <Text className='pn-card__desc'>邮箱验证码登录 / 微信一键登录</Text>
        </View>
      )}

      {loggedIn && unread > 0 && (
        <View className='pn-card' onClick={() => platform.navigation.to('/pages/notifications/index')}>
          <Text className='pn-card__title'>🔔 你有 {unread} 条新通知</Text>
          <Text className='pn-card__desc'>订单、交易、互动消息都在这</Text>
        </View>
      )}

      <View className='pn-section-title'>开始互助</View>
      {entries.map((entry) => (
        <View key={entry.title} className='pn-tile' onClick={() => platform.navigation.switchTab(entry.tab)}>
          <View className='pn-tile__emoji'>{entry.emoji}</View>
          <View className='pn-tile__body'>
            <Text className='pn-tile__title'>{entry.title}</Text>
            <Text className='pn-tile__desc'>{entry.desc}</Text>
          </View>
          <Text className='pn-tile__arrow'>›</Text>
        </View>
      ))}
    </View>
  );
}
