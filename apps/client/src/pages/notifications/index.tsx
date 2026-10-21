import { useDidShow } from '@tarojs/taro';
import { useState } from 'react';
import { View, Text } from '@tarojs/components';
import { platform } from '../../adapters';
import { api, fetchPaged } from '../../services/api-client';
import './index.scss';

interface NotificationView {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

const TYPE_LABEL: Record<string, string> = {
  ORDER_CREATED: '收到新的互助订单',
  ORDER_AWAITING_CONFIRM: '订单等待你确认条款',
  ORDER_CONFIRMED: '订单已确认',
  ORDER_STARTED: '服务已开始',
  ORDER_COMPLETION_SUBMITTED: '服务者已提交完成',
  ORDER_COMPLETED: '订单已完成',
  DEAL_CREATED: '有人想交易你的物品',
  DEAL_AGREEMENT_UPDATED: '交接约定有更新',
  DEAL_STATUS_CHANGED: '交易状态更新',
  DISPUTE_OPENED: '对方发起了纠纷',
  DISPUTE_RULED: '纠纷已裁定',
  REVIEW_RECEIVED: '收到一条新评价',
  POST_COMMENTED: '有人评论了你的帖子',
  COMMENT_REPLIED: '有人回复了你',
  NEW_FOLLOWER: '有新粉丝',
  NEW_MESSAGE: '收到新消息',
  CONTENT_APPROVED: '内容审核通过',
  CONTENT_REMOVED: '内容未通过审核',
  LISTING_APPROVED: '商品审核通过',
  LISTING_REMOVED: '商品未通过审核',
  REPORT_RESOLVED: '举报已处理',
};

/** 通知类型 → 跳转目标（payload 里的业务引用；UX-REVIEW P1：通知从死列表变成入口） */
function targetOf(item: NotificationView): string | null {
  const p = item.payload ?? {};
  const orderId = typeof p.orderId === 'string' ? p.orderId : null;
  const dealId = typeof p.dealId === 'string' ? p.dealId : null;
  const postId = typeof p.postId === 'string' ? p.postId : null;
  const listingId = typeof p.listingId === 'string' ? p.listingId : null;
  if (item.type.startsWith('ORDER_') && orderId) return `/pages/care-order/index?id=${orderId}`;
  if (item.type.startsWith('DEAL_') && dealId) return `/pages/market-deal/index?id=${dealId}`;
  if ((item.type === 'POST_COMMENTED' || item.type === 'COMMENT_REPLIED') && postId) return `/pages/post/index?id=${postId}`;
  if ((item.type === 'LISTING_APPROVED' || item.type === 'LISTING_REMOVED') && listingId) return `/pages/market-listing/index?id=${listingId}`;
  return null;
}

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationView[]>([]);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());

  const load = async () => {
    try {
      const res = await fetchPaged<NotificationView>('/notifications?pageSize=50');
      setItems(res.items);
      const unread = new Set(res.items.filter((n) => !n.readAt).map((n) => n.id));
      setUnreadIds(unread);
      // 进入即全部已读（首页横幅的「新通知」随之归零）；未读样式按进入时的快照展示
      if (unread.size > 0) {
        await Promise.all([...unread].map((id) => api.post(`/notifications/${id}/read`).catch(() => undefined)));
      }
    } catch {
      /* 未登录由 api-client 处理 */
    }
  };

  useDidShow(() => {
    void load();
  });

  function open(item: NotificationView) {
    setUnreadIds((prev) => {
      const next = new Set(prev);
      next.delete(item.id);
      return next;
    });
    const target = targetOf(item);
    if (target) platform.navigation.to(target);
  }

  return (
    <View className='pn-page'>
      <View className='pn-list'>
        {items.length === 0 && <View className='pn-empty'>暂无通知</View>}
        {items.map((item) => (
          <View key={item.id} className='pn-item' onClick={() => open(item)}>
            <View className='pn-item__head'>
              <Text className='pn-item__title'>
                {!item.readAt && unreadIds.has(item.id) && <Text className='pn-dot' />}
                {TYPE_LABEL[item.type] ?? item.type}
              </Text>
              {targetOf(item) && <Text className='pn-item__arrow'>›</Text>}
            </View>
            <Text className='pn-item__meta'>{item.createdAt.replace('T', ' ').slice(0, 16)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
