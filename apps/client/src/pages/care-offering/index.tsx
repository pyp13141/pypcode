import { useLoad, useRouter, useShareAppMessage } from '@tarojs/taro';
import { useState } from 'react';
import { View, Text, Button } from '@tarojs/components';
import { platform } from '../../adapters';
import { api } from '../../services/api-client';
import './index.scss';

interface OfferingDetail {
  id: string;
  title: string;
  description: string;
  areaCode: string;
  status: string;
  priceMinor: number | null;
  pricingType: string;
  provider: { id: string; nickname: string };
  trust: { completedOrderCount: number; reviewCount: number; phoneVerified: boolean };
  availabilities: { startAt: string; endAt: string; capacity: number }[];
  safetyTips: string[];
  isOwner: boolean;
}

const PRICE_LABEL: Record<string, string> = { FREE: '免费互助', NEGOTIABLE: '面议', BARTER: '以物换' };

export default function CareOfferingPage() {
  const router = useRouter();
  const id = router.params.id ?? '';
  const [detail, setDetail] = useState<OfferingDetail | null>(null);
  const [loadError, setLoadError] = useState('');

  useShareAppMessage(() => ({
    title: detail ? `宠邻·${detail.title}` : '宠邻互助',
    path: `/pages/care-offering/index?id=${id}`,
  }));

  useLoad(() => {
    api
      .get<OfferingDetail>(`/care/offerings/${id}`)
      .then(setDetail)
      .catch((error) => setLoadError(error instanceof Error ? error.message : '加载失败'));
  });

  /** UX-REVIEW P1：原「去发需求找 TA」调占位接口且把留言静默丢弃，已改为诚实引导 */
  function goPublishRequest() {
    platform.navigation.switchTab('/pages/care/index');
  }

  const priceLabel =
    detail === null ? '' : detail.priceMinor === null ? PRICE_LABEL[detail.pricingType] ?? '面议' : `${detail.priceMinor / 100} 元`;

  if (loadError) {
    return (
      <View className='pn-page'>
        <View className='pn-empty'>加载失败：{loadError}</View>
      </View>
    );
  }

  return (
    <View className='pn-page'>
      {detail && (
        <View>
          <View className='pn-hero'>
            <Text className='pn-hero__title'>{detail.title}</Text>
            <View className='pn-hero__slogan'>
              {priceLabel} · {detail.areaCode} · {detail.provider.nickname}
            </View>
          </View>

          <View className='pn-card'>
            <Text className='pn-card__title'>服务说明</Text>
            <Text className='pn-card__desc'>{detail.description}</Text>
            <View className='pn-item__body'>
              <Text className='pn-tag'>{detail.trust.completedOrderCount} 单完成</Text>
              <Text className='pn-tag pn-tag--muted'>{detail.trust.reviewCount} 条评价</Text>
              {detail.trust.phoneVerified && <Text className='pn-tag'>手机号已验证</Text>}
            </View>
          </View>

          <View className='pn-card'>
            <Text className='pn-card__title'>安全提示</Text>
            {detail.safetyTips.map((tip) => (
              <Text key={tip} className='pn-card__desc'>
                · {tip}
              </Text>
            ))}
          </View>

          {!detail.isOwner && (
            <View className='pn-card'>
              <Text className='pn-card__title'>想约这位邻居？</Text>
              <Text className='pn-card__desc'>到「互助」页发布一条求助需求，TA 看到后会来申请；也可以把这份公告分享给需要的朋友。</Text>
              <Button className='pn-btn' onClick={goPublishRequest}>
                去互助页发需求
              </Button>
            </View>
          )}

          <Button className='pn-btn pn-btn--ghost' onClick={() => platform.share.share(detail.title, `/pages/care-offering/index?id=${detail.id}`)}>
            分享给朋友
          </Button>
        </View>
      )}
      {!detail && !loadError && <View className='pn-empty'>加载中…</View>}
    </View>
  );
}
