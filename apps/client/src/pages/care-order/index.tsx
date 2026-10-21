import { useLoad, useRouter, useShareAppMessage } from '@tarojs/taro';
import { useState } from 'react';
import { View, Text, Input, Button } from '@tarojs/components';
import { platform } from '../../adapters';
import { api, newIdempotencyKey } from '../../services/api-client';
import './index.scss';

interface VisitView {
  id: string;
  seq: number;
  status: string;
  notes: string | null;
}

interface OrderView {
  id: string;
  orderNo: string;
  status: string;
  role: 'REQUESTER' | 'PROVIDER';
  priceMinor: number | null;
  requester: { id: string; nickname: string };
  provider: { id: string; nickname: string };
  hasPrivateDetails: boolean;
  visits?: VisitView[];
  agreedTerms: { pets?: { name: string; careNotes: { noteType: string; content: string }[] }[]; cancelRule?: string };
}

const STATUS_LABEL: Record<string, string> = {
  PENDING_CONFIRMATION: '待双方确认条款',
  CONFIRMED: '已确认',
  IN_PROGRESS: '服务中',
  COMPLETION_SUBMITTED: '服务者已提交完成',
  COMPLETED: '已完成',
  CANCEL_REQUESTED: '取消申请中',
  CANCELLED: '已取消',
  DISPUTED: '争议处理中',
};

export default function CareOrderPage() {
  const router = useRouter();
  const id = router.params.id ?? '';
  const [order, setOrder] = useState<OrderView | null>(null);
  const [address, setAddress] = useState('');
  const [entry, setEntry] = useState('');
  const [emergency, setEmergency] = useState('');
  const [lastKey] = useState(() => newIdempotencyKey('order'));

  const load = async () => {
    const detail = await api.get<OrderView>(`/care/orders/${id}`);
    setOrder(detail);
  };

  useShareAppMessage(() => ({
    title: `宠邻互助订单 ${order?.orderNo ?? ''}`,
    path: `/pages/care-order/index?id=${id}`,
  }));

  useLoad(() => {
    load().catch((error) => platform.toast.error(error instanceof Error ? error.message : '加载失败'));
  });

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
      {order && (
        <View>
          <View className='pn-hero'>
            <Text className='pn-hero__title'>{order.orderNo}</Text>
            <View className='pn-hero__slogan'>
              {STATUS_LABEL[order.status] ?? order.status} · {order.role === 'REQUESTER' ? '我是需求方' : '我是服务者'}
            </View>
          </View>

          <View className='pn-card'>
            <Text className='pn-card__title'>条款快照</Text>
            <Text className='pn-card__desc'>
              价格：{order.priceMinor === null ? '面议/免费' : `${order.priceMinor / 100} 元`} · 取消规则：{order.agreedTerms?.cancelRule ?? '-'}
            </Text>
            {(order.agreedTerms?.pets ?? []).map((pet) => (
              <Text key={pet.name} className='pn-card__desc'>
                宠物 {pet.name}
                {pet.careNotes.length > 0 ? `：${pet.careNotes.map((n) => n.content).join('；')}` : ''}
              </Text>
            ))}
          </View>

          {order.role === 'REQUESTER' && (
            <View className='pn-card'>
              <Text className='pn-card__title'>服务地址（仅双方可见，加密存储）</Text>
              {order.status === 'PENDING_CONFIRMATION' || order.status === 'CONFIRMED' ? (
                <View>
                  <Input className='pn-input' placeholder='详细地址（送达给服务者）' value={address} onInput={(e) => setAddress(e.detail.value)} />
                  <Input className='pn-input' placeholder='门禁/进门说明（可选）' value={entry} onInput={(e) => setEntry(e.detail.value)} />
                  <Input className='pn-input' placeholder='紧急联系人（可选）' value={emergency} onInput={(e) => setEmergency(e.detail.value)} />
                  <Button
                    className='pn-btn pn-btn--ghost'
                    onClick={() =>
                      run(
                        () => api.put(`/care/orders/${id}/private-details`, { address: address.trim() || '待补充', ...(entry ? { entryInstructions: entry } : {}), ...(emergency ? { emergencyContact: emergency } : {}) }),
                        '地址已保存',
                      )
                    }
                  >
                    保存地址
                  </Button>
                </View>
              ) : (
                <Text className='pn-card__desc'>地址读取需订单已确认且状态在服务中；此处仅发起人或服务者可经独立授权接口读取（每次读取写审计）。</Text>
              )}
            </View>
          )}

          <View className='pn-card'>
            <Text className='pn-card__title'>操作</Text>
            <View className='pn-row'>
              {order.status === 'PENDING_CONFIRMATION' && (
                <Button className='pn-btn' style={{ flex: 1 }} onClick={() => run(() => api.post(`/care/orders/${id}/confirm`), '已确认条款')}>
                  确认条款
                </Button>
              )}
              {order.status === 'CONFIRMED' && order.role === 'PROVIDER' && (
                <Button className='pn-btn' style={{ flex: 1 }} onClick={() => run(() => api.post(`/care/orders/${id}/start`), '已开始服务')}>
                  开始服务
                </Button>
              )}
              {order.status === 'IN_PROGRESS' && (
                <Button
                  className='pn-btn'
                  style={{ flex: 1 }}
                  onClick={() =>
                    run(
                      () => api.post(`/care/orders/${id}/visits`, { scheduledAt: new Date().toISOString() }, { idempotencyKey: newIdempotencyKey('visit') }),
                      '已记录一次上门',
                    )
                  }
                >
                  记录上门
                </Button>
              )}
              {order.status === 'IN_PROGRESS' && order.role === 'PROVIDER' && (
                <Button
                  className='pn-btn'
                  style={{ flex: 1, marginLeft: '16px' }}
                  onClick={() =>
                    run(
                      () => api.post(`/care/orders/${id}/complete`, undefined, { idempotencyKey: lastKey }),
                      '已提交完成',
                    )
                  }
                >
                  提交完成
                </Button>
              )}
              {order.status === 'COMPLETION_SUBMITTED' && order.role === 'REQUESTER' && (
                <Button
                  className='pn-btn pn-btn--accent'
                  style={{ flex: 1 }}
                  onClick={() =>
                    run(
                      () => api.post(`/care/orders/${id}/complete`, undefined, { idempotencyKey: newIdempotencyKey('confirm-done') }),
                      '已确认完成',
                    )
                  }
                >
                  确认完成
                </Button>
              )}
              {['PENDING_CONFIRMATION', 'CONFIRMED', 'IN_PROGRESS'].includes(order.status) && (
                <Button
                  className='pn-btn pn-btn--ghost'
                  style={{ flex: 1, marginLeft: '16px' }}
                  onClick={async () => {
                    const ok = await platform.modal.confirm({ title: '取消订单', content: '将按取消规则处理并记录原因' });
                    if (ok) await run(() => api.post(`/care/orders/${id}/cancel`, { reasonCode: 'OTHER', note: '客户端取消' }), '已提交取消');
                  }}
                >
                  取消
                </Button>
              )}
            </View>
          </View>

          <View className='pn-card'>
            <Text className='pn-card__title'>上门记录（{order.visits?.length ?? 0}）</Text>
            {(order.visits ?? []).map((visit) => (
              <View key={visit.id} className='pn-row'>
                <Text>
                  第 {visit.seq} 次 · {visit.status}
                  {visit.notes ? `（${visit.notes}）` : ''}
                </Text>
                {visit.status === 'SCHEDULED' && order.role === 'PROVIDER' && (
                  <Text
                    className='pn-tag'
                    onClick={() => run(() => api.patch(`/care/orders/${id}/visits/${visit.id}`, { action: 'COMPLETE' }), '该次上门已完成')}
                  >
                    标记完成
                  </Text>
                )}
              </View>
            ))}
            {(order.visits ?? []).length === 0 && <Text className='pn-card__desc'>暂无上门记录</Text>}
          </View>

          {order.status === 'IN_PROGRESS' && (
            <Button
              className='pn-btn pn-btn--ghost'
              onClick={async () => {
                const ok = await platform.modal.confirm({ title: '发起纠纷', content: '将创建纠纷工单，平台介入处理' });
                if (ok) await run(() => api.post(`/care/orders/${id}/disputes`, { reasonCode: 'OTHER', description: '客户端发起纠纷请求平台介入' }), '纠纷工单已创建');
              }}
            >
              发起纠纷
            </Button>
          )}

          {order.status === 'COMPLETED' && (
            <Button
              className='pn-btn pn-btn--accent'
              onClick={() =>
                run(
                  () => api.post(`/care/orders/${id}/reviews`, { rating: 5, content: '交易顺利，邻居很靠谱' }, { idempotencyKey: newIdempotencyKey('review') }),
                  '评价已提交',
                )
              }
            >
              五星好评 TA
            </Button>
          )}

          <Button className='pn-btn pn-btn--ghost' onClick={() => platform.share.share(`互助订单 ${order.orderNo}`, `/pages/care-order/index?id=${order.id}`)}>
            分享订单
          </Button>
        </View>
      )}
      {!order && <View className='pn-empty'>加载中…</View>}
    </View>
  );
}
