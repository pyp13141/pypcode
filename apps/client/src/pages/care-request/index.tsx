import { useLoad, useRouter } from '@tarojs/taro';
import { useState } from 'react';
import { View, Text, Textarea, Button } from '@tarojs/components';
import { platform } from '../../adapters';
import { api, fetchPaged } from '../../services/api-client';
import { ensureAuth } from '../../services/auth';
import './index.scss';

interface RequestDetail {
  id: string;
  serviceType: string;
  title: string;
  description: string;
  areaCode: string;
  startAt: string;
  endAt: string;
  frequency: string | null;
  pricingType: string;
  priceMinor: number | null;
  status: string;
  pets: { id: string; name: string; species: string }[];
  requester: { id: string; nickname: string };
  isOwner: boolean;
}

interface Application {
  id: string;
  applicant: { id: string; nickname: string };
  message: string;
  proposedPriceMinor: number | null;
  status: string;
  careOrderId: string | null;
  createdAt: string;
}

const PRICING_LABEL: Record<string, string> = { FREE: '免费互助', NEGOTIABLE: '面议', BARTER: '以物换' };
const STATUS_LABEL: Record<string, string> = {
  PUBLISHED: '征集协助中',
  MATCHED: '已匹配',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  EXPIRED: '已过期',
};
const APP_LABEL: Record<string, string> = { PENDING: '待回应', ACCEPTED: '已接受', REJECTED: '已婉拒', EXPIRED: '已失效', WITHDRAWN: '已撤回' };

const SPECIES_EMOJI: Record<string, string> = { CAT: '🐱', DOG: '🐶', BIRD: '🐦' };

export default function CareRequestPage() {
  const router = useRouter();
  const id = router.params.id ?? '';
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [message, setMessage] = useState('');
  const [price, setPrice] = useState('');
  const [loadError, setLoadError] = useState('');

  const load = () => {
    api
      .get<RequestDetail>(`/care/requests/${id}`)
      .then((detail) => {
        setDetail(detail);
        setLoadError('');
        if (detail.isOwner) {
          fetchPaged<Application>(`/care/requests/${id}/applications?pageSize=50`)
            .then((res) => setApplications(res.items))
            .catch(() => setApplications([]));
        }
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : '加载失败'));
  };

  useLoad(() => {
    load();
  });

  async function apply() {
    if (!ensureAuth('申请协助')) return;
    if (message.trim().length < 2) {
      platform.toast.error('先写一句自我介绍/方案吧');
      return;
    }
    try {
      await api.post(`/care/requests/${id}/applications`, {
        message: message.trim(),
        ...(price ? { proposedPriceMinor: Math.round((Number(price) || 0) * 100) } : {}),
      });
      platform.toast.success('已提交申请，等需求方回应');
      setMessage('');
      setPrice('');
    } catch (error) {
      platform.toast.error(error instanceof Error ? error.message : '申请失败');
    }
  }

  async function decide(applicationId: string, action: 'accept' | 'reject') {
    try {
      // accept 用固定幂等键（按申请一份）：双击/重试重放返回同一订单，不会重复建单
      const res = await api.post<{ orderId: string }>(
        `/care/applications/${applicationId}/${action}`,
        action === 'reject' ? {} : undefined,
        { idempotencyKey: `req-accept-${applicationId}` },
      );
      platform.toast.success(action === 'accept' ? '已接受，订单已创建' : '已婉拒');
      if (action === 'accept' && res?.orderId) {
        platform.navigation.to(`/pages/care-order/index?id=${res.orderId}`);
      }
      load();
    } catch (error) {
      platform.toast.error(error instanceof Error ? error.message : '操作失败');
    }
  }

  if (loadError) {
    return (
      <View className='pn-page'>
        <View className='pn-empty'>加载失败：{loadError}</View>
      </View>
    );
  }
  if (!detail) {
    return (
      <View className='pn-page'>
        <View className='pn-empty'>加载中…</View>
      </View>
    );
  }

  const open = detail.status === 'PUBLISHED';

  return (
    <View className='pn-page'>
      <View className='pn-hero pn-hero--compact'>
        <Text className='pn-hero__title'>{detail.title}</Text>
        <View className='pn-hero__slogan'>
          {detail.requester.nickname} · {detail.areaCode} ·{' '}
          {detail.priceMinor === null ? PRICING_LABEL[detail.pricingType] ?? '面议' : `¥${detail.priceMinor / 100}`} ·{' '}
          {STATUS_LABEL[detail.status] ?? detail.status}
        </View>
      </View>

      <View className='pn-card'>
        <Text className='pn-card__title'>需求说明</Text>
        <Text className='pn-card__desc'>{detail.description}</Text>
        <View className='pn-item__body' style={{ marginTop: '16px' }}>
          {detail.pets.map((p) => (
            <Text key={p.id} className='pn-tag pn-tag--muted'>
              {SPECIES_EMOJI[p.species] ?? '🐾'} {p.name}
            </Text>
          ))}
          <Text className='pn-tag pn-tag--muted'>
            时间窗 {detail.startAt.slice(5, 16).replace('T', ' ')} ~ {detail.endAt.slice(5, 16).replace('T', ' ')}
          </Text>
          {detail.frequency && <Text className='pn-tag pn-tag--muted'>{detail.frequency}</Text>}
        </View>
      </View>

      {!detail.isOwner && open && (
        <View className='pn-card'>
          <Text className='pn-card__title'>申请协助</Text>
          <Text className='pn-card__desc'>留言介绍你的经验与方案；双方确认后生成订单，地址在订单确认后可见。</Text>
          <Textarea className='pn-textarea' placeholder='例如：养猫五年，住附近，可以每天上门两次' value={message} onInput={(e) => setMessage(e.detail.value)} />
          {detail.pricingType === 'NEGOTIABLE' && (
            <Textarea className='pn-textarea' placeholder='你的报价（元，可选）' value={price} onInput={(e) => setPrice(e.detail.value)} />
          )}
          <Button className='pn-btn' onClick={apply}>
            提交申请
          </Button>
        </View>
      )}

      {!detail.isOwner && !open && (
        <View className='pn-card'>
          <Text className='pn-card__desc'>该需求当前状态为「{STATUS_LABEL[detail.status] ?? detail.status}」，暂时不能申请。</Text>
        </View>
      )}

      {detail.isOwner && (
        <View className='pn-card'>
          <Text className='pn-card__title'>收到的申请（{applications.length}）</Text>
          {applications.length === 0 && <Text className='pn-card__desc'>还没有邻居申请。可以把需求详情分享给认识的邻居。</Text>}
          {applications.map((app) => (
            <View key={app.id} className='pn-item pn-item--flat'>
              <View className='pn-item__head'>
                <View className='pn-avatar'>{app.applicant.nickname.slice(0, 1)}</View>
                <View style={{ flex: 1 }}>
                  <Text className='pn-item__title'>{app.applicant.nickname}</Text>
                  <Text className='pn-item__meta'>
                    {APP_LABEL[app.status] ?? app.status}
                    {app.proposedPriceMinor !== null ? ` · 报价 ¥${app.proposedPriceMinor / 100}` : ''}
                  </Text>
                </View>
              </View>
              <Text className='pn-item__body'>{app.message}</Text>
              {app.status === 'PENDING' && (
                <View className='pn-row'>
                  <Button className='pn-btn' style={{ flex: 1, marginTop: 0 }} onClick={() => decide(app.id, 'accept')}>
                    接受（创建订单）
                  </Button>
                  <Button className='pn-btn pn-btn--danger' style={{ flex: 1, marginLeft: '16px', marginTop: 0 }} onClick={() => decide(app.id, 'reject')}>
                    婉拒
                  </Button>
                </View>
              )}
              {app.status === 'ACCEPTED' && app.careOrderId && (
                <Button
                  className='pn-btn pn-btn--ghost'
                  onClick={() => platform.navigation.to(`/pages/care-order/index?id=${app.careOrderId}`)}
                >
                  查看订单 ›
                </Button>
              )}
            </View>
          ))}
        </View>
      )}

      <Button className='pn-btn pn-btn--ghost' onClick={() => platform.share.share(detail.title, `/pages/care-request/index?id=${detail.id}`)}>
        分享给朋友
      </Button>
    </View>
  );
}
