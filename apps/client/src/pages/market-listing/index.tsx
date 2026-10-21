import { useLoad, useRouter, useShareAppMessage } from '@tarojs/taro';
import { useState } from 'react';
import { View, Text, Textarea, Button } from '@tarojs/components';
import { platform } from '../../adapters';
import { api } from '../../services/api-client';
import { ensureAuth } from '../../services/auth';
import './index.scss';

interface ListingDetail {
  id: string;
  title: string;
  description: string;
  listingType: string;
  priceMinor: number | null;
  areaCode: string;
  status: string;
  seller: { id: string; nickname: string };
  sellerTrust: { completedOrderCount: number; reviewCount: number };
  favoriteCount: number;
  isFavorited: boolean;
  isOwner: boolean;
  safetyTips: string[];
}

export default function MarketListingPage() {
  const router = useRouter();
  const id = router.params.id ?? '';
  const [detail, setDetail] = useState<ListingDetail | null>(null);
  const [message, setMessage] = useState('你好，想要这件物品');

  const load = async () => setDetail(await api.get<ListingDetail>(`/market/listings/${id}`));

  useShareAppMessage(() => ({
    title: detail ? `宠邻集市·${detail.title}` : '宠邻集市',
    path: `/pages/market-listing/index?id=${id}`,
  }));

  useLoad(() => {
    load().catch((error) => platform.toast.error(error instanceof Error ? error.message : '加载失败'));
  });

  async function toggleFavorite() {
    if (!detail) return;
    try {
      const res = detail.isFavorited
        ? await api.delete<{ favoriteCount: number }>(`/market/listings/${id}/favorite`)
        : await api.put<{ favoriteCount: number }>(`/market/listings/${id}/favorite`);
      setDetail({ ...detail, isFavorited: !detail.isFavorited, favoriteCount: res.favoriteCount });
    } catch (error) {
      platform.toast.error(error instanceof Error ? error.message : '操作失败');
    }
  }

  async function startDeal() {
    if (!ensureAuth('发起交易')) return;
    try {
      const deal = await api.post<{ id: string }>('/market/deals', { listingId: id, message });
      platform.toast.success('已发起交易');
      platform.navigation.to(`/pages/market-deal/index?id=${deal.id}`);
    } catch (error) {
      platform.toast.error(error instanceof Error ? error.message : '发起失败');
    }
  }

  const priceLabel =
    detail === null
      ? ''
      : detail.listingType === 'GIFT'
        ? '免费赠送'
        : detail.listingType === 'WANTED'
          ? '求购'
          : detail.priceMinor === null
            ? '面议'
            : `${detail.priceMinor / 100} 元`;
  const tradable = detail !== null && detail.status === 'PUBLISHED';

  return (
    <View className='pn-page'>
      {detail && (
        <View>
          <View className='pn-hero'>
            <Text className='pn-hero__title'>{detail.title}</Text>
            <View className='pn-hero__slogan'>
              {priceLabel} · {detail.areaCode} · 卖家 {detail.seller.nickname}
              {detail.status !== 'PUBLISHED' ? ` · ${detail.status === 'SOLD' ? '已送出/售出' : detail.status === 'PENDING_REVIEW' ? '审核中' : detail.status}` : ''}
            </View>
          </View>
          <View className='pn-card'>
            <Text className='pn-card__title'>物品说明</Text>
            <Text className='pn-card__desc'>{detail.description}</Text>
          </View>
          <View className='pn-card'>
            <Text className='pn-card__title'>线下交接安全提示</Text>
            {detail.safetyTips.map((tip) => (
              <Text key={tip} className='pn-card__desc'>
                · {tip}
              </Text>
            ))}
          </View>
          {!detail.isOwner && tradable && (
            <View className='pn-card'>
              <Text className='pn-card__title'>发起交易</Text>
              <Textarea className='pn-textarea' value={message} onInput={(e) => setMessage(e.detail.value)} />
              <Button className='pn-btn' onClick={startDeal}>
                联系卖家发起交易
              </Button>
            </View>
          )}
          {!detail.isOwner && !tradable && (
            <View className='pn-card'>
              <Text className='pn-card__desc'>
                {detail.status === 'SOLD' ? '这件物品已完成交接，去看看其他闲置吧。' : '该物品当前状态暂不可交易。'}
              </Text>
            </View>
          )}
          <Button className='pn-btn pn-btn--ghost' onClick={toggleFavorite}>
            {detail.isFavorited ? '取消收藏' : '收藏'}（{detail.favoriteCount}）
          </Button>
          <Button className='pn-btn pn-btn--ghost' onClick={() => platform.share.share(detail.title, `/pages/market-listing/index?id=${detail.id}`)}>
            分享给朋友
          </Button>
        </View>
      )}
      {!detail && <View className='pn-empty'>加载中…</View>}
    </View>
  );
}
