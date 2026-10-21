import { useLoad, useRouter } from '@tarojs/taro';
import { useState } from 'react';
import { View, Text, Button } from '@tarojs/components';
import { platform } from '../../adapters';
import { api } from '../../services/api-client';
import './index.scss';

interface DealView {
  id: string;
  status: string;
  role: 'BUYER' | 'SELLER';
  listing: { id: string; title: string; priceMinor: number | null };
  handoverArea: string | null;
  completedAt: string | null;
  conversationId: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  CONTACTED: '已联系（待双方约定）',
  AGREEMENT_PENDING: '约定中（等待对方确认）',
  AGREED: '已约定（请在公共场所交接）',
  HANDED_OVER: '交接确认中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  DISPUTED: '争议中',
};

export default function MarketDealPage() {
  const router = useRouter();
  const id = router.params.id ?? '';
  const [deal, setDeal] = useState<DealView | null>(null);
  const [loadError, setLoadError] = useState('');

  const load = async () => {
    try {
      setDeal(await api.get<DealView>(`/market/deals/${id}`));
      setLoadError('');
    } catch (error) {
      // UX-REVIEW P0-3 修复配套：加载失败给出可恢复的错误态，不再无限「加载中…」
      setLoadError(error instanceof Error ? error.message : '加载失败');
    }
  };

  async function run(action: () => Promise<unknown>, okText: string) {
    try {
      await action();
      platform.toast.success(okText);
      await load();
    } catch (error) {
      platform.toast.error(error instanceof Error ? error.message : '操作失败');
    }
  }

  return (
    <View className='pn-page'>
      {deal && (
        <View>
          <View className='pn-hero'>
            <Text className='pn-hero__title'>{deal.listing.title}</Text>
            <View className='pn-hero__slogan'>
              {STATUS_LABEL[deal.status] ?? deal.status} · {deal.role === 'BUYER' ? '我是买家' : '我是卖家'}
            </View>
          </View>

          <View className='pn-card'>
            <Text className='pn-card__title'>下一步</Text>
            <View className='pn-row'>
              {['CONTACTED', 'AGREEMENT_PENDING'].includes(deal.status) && (
                <Button className='pn-btn' style={{ flex: 1 }} onClick={() => run(() => api.post(`/market/deals/${id}/agree`, { handoverArea: '约定的公共场所' }), '已确认约定')}>
                  确认交接约定
                </Button>
              )}
              {['AGREED', 'HANDED_OVER'].includes(deal.status) && (
                <Button className='pn-btn pn-btn--accent' style={{ flex: 1 }} onClick={() => run(() => api.post(`/market/deals/${id}/complete`), '已确认')}>
                  确认已交接
                </Button>
              )}
              {['CONTACTED', 'AGREEMENT_PENDING', 'AGREED'].includes(deal.status) && (
                <Button
                  className='pn-btn pn-btn--ghost'
                  style={{ flex: 1, marginLeft: '16px' }}
                  onClick={async () => {
                    const ok = await platform.modal.confirm({ title: '取消交易', content: '确定取消这笔交易吗？' });
                    if (ok) await run(() => api.post(`/market/deals/${id}/cancel`, { reasonCode: 'OTHER' }), '已取消');
                  }}
                >
                  取消交易
                </Button>
              )}
            </View>
            {deal.status === 'HANDED_OVER' && <Text className='pn-card__desc'>已由一方确认交接，等待另一方确认后完成（物品已锁定为售出）。</Text>}
          </View>

          {deal.status === 'COMPLETED' && (
            <Button
              className='pn-btn pn-btn--accent'
              onClick={() => run(() => api.post(`/market/deals/${id}/reviews`, { rating: 5, content: '沟通顺畅，物品如描述' }, { idempotencyKey: `deal-review-${id}` }), '评价已提交')}
            >
              五星好评对方
            </Button>
          )}

          {['AGREED', 'HANDED_OVER'].includes(deal.status) && (
            <Button
              className='pn-btn pn-btn--ghost'
              onClick={async () => {
                const ok = await platform.modal.confirm({ title: '发起纠纷', content: '将创建纠纷工单并由平台介入' });
                if (ok) await run(() => api.post(`/market/deals/${id}/disputes`, { reasonCode: 'OTHER', description: '客户端发起纠纷请求平台介入' }), '纠纷工单已创建');
              }}
            >
              发起纠纷
            </Button>
          )}
        </View>
      )}
      {loadError && (
        <View className='pn-card'>
          <Text className='pn-card__title'>加载失败</Text>
          <Text className='pn-card__desc'>{loadError}</Text>
          <Button className='pn-btn pn-btn--ghost' onClick={load}>
            重试
          </Button>
        </View>
      )}
      {!deal && !loadError && <View className='pn-empty'>加载中…</View>}
    </View>
  );
}
