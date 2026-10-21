import { useDidShow } from '@tarojs/taro';
import { useState } from 'react';
import { View, Text, Input, Button, Textarea } from '@tarojs/components';
import { platform } from '../../adapters';
import { api, fetchPaged } from '../../services/api-client';
import { ensureAuth } from '../../services/auth';
import './index.scss';

interface Offering {
  id: string;
  serviceType: string;
  title: string;
  description: string;
  areaCode: string;
  pricingType: string;
  priceMinor: number | null;
  status: string;
  provider: { id: string; nickname: string };
  trust: { phoneVerified: boolean; completedOrderCount: number; reviewCount: number };
}

interface RequestItem {
  id: string;
  serviceType: string;
  title: string;
  description: string;
  areaCode: string;
  startAt: string;
  endAt: string;
  pricingType: string;
  priceMinor: number | null;
  status: string;
  pets: { id: string; name: string; species: string }[];
  requester: { id: string; nickname: string };
  isOwner: boolean;
}

interface Order {
  id: string;
  orderNo: string;
  status: string;
  role: 'REQUESTER' | 'PROVIDER';
  priceMinor: number | null;
  requester: { nickname: string };
  provider: { nickname: string };
  createdAt: string;
}

const SERVICE_TYPES = [
  { key: 'FEED', label: '喂养' },
  { key: 'WALK', label: '遛宠' },
  { key: 'BOARD', label: '照看' },
  { key: 'OTHER', label: '其他' },
];

const SERVICE_EMOJI: Record<string, string> = { FEED: '🍚 喂养', WALK: '🐕 遛宠', BOARD: '🏠 照看', OTHER: '🐾 其他' };

const PRICING = [
  { key: 'FREE', label: '免费互助' },
  { key: 'FIXED', label: '固定价格' },
  { key: 'NEGOTIABLE', label: '面议' },
  { key: 'BARTER', label: '以物换' },
];

const PRICE_LABEL: Record<string, string> = { FREE: '免费互助', NEGOTIABLE: '面议', BARTER: '以物换' };

const ORDER_STATUS: Record<string, string> = {
  PENDING_CONFIRMATION: '待确认条款',
  CONFIRMED: '已确认',
  IN_PROGRESS: '服务中',
  COMPLETION_SUBMITTED: '待你确认完成',
  COMPLETED: '已完成',
  CANCEL_REQUESTED: '取消待确认',
  CANCELLED: '已取消',
  DISPUTED: '争议中',
};

const EMPTY_FORM = { title: '', description: '', areaCode: '440305', priceMinor: '0', serviceType: 'FEED', pricingType: 'FREE', petIds: [] as string[] };

export default function CarePage() {
  const [tab, setTab] = useState<'offerings' | 'requests' | 'orders'>('offerings');
  const [mode, setMode] = useState<'none' | 'offering' | 'request'>('none');
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [pets, setPets] = useState<{ id: string; name: string; species: string }[]>([]);

  const load = async () => {
    try {
      const [offeringRes, requestRes, orderRes] = await Promise.all([
        fetchPaged<Offering>('/care/offerings?pageSize=20'),
        fetchPaged<RequestItem>('/care/requests?pageSize=20'),
        fetchPaged<Order>('/care/orders?pageSize=20').catch(() => ({ items: [] as Order[] })),
      ]);
      setOfferings(offeringRes.items);
      setRequests(requestRes.items);
      setOrders(orderRes.items);
    } catch {
      /* 未登录亦可浏览公告与需求；订单失败忽略 */
    }
  };

  useDidShow(() => {
    void load();
    api.get<{ id: string; name: string; species: string }[]>('/pets').then(setPets).catch(() => setPets([]));
  });

  /** 打开发布表单（UX-REVIEW P0-4：切换表单必须重置，防求助内容残留进服务公告） */
  function openForm(next: 'offering' | 'request') {
    if (!ensureAuth('发布')) return;
    setForm({ ...EMPTY_FORM });
    setMode(mode === next ? 'none' : next);
  }

  async function submitOffering() {
    if (form.title.trim().length < 5) {
      platform.toast.error('标题至少 5 个字');
      return;
    }
    try {
      await api.post('/care/offerings', {
        serviceType: form.serviceType,
        title: form.title.trim(),
        description: form.description.trim() || '按需沟通',
        areaCode: form.areaCode,
        pricingType: form.pricingType,
        ...(form.pricingType === 'FIXED' ? { priceMinor: Number(form.priceMinor) || 0 } : {}),
        cancelRule: 'FREE',
        availabilities: [],
      });
      platform.toast.success('已发布服务公告');
      setMode('none');
      setForm({ ...EMPTY_FORM });
      await load();
    } catch (error) {
      platform.toast.error(error instanceof Error ? error.message : '发布失败');
    }
  }

  async function submitRequest() {
    if (form.petIds.length === 0) {
      platform.toast.error('请先选择宠物（可在「我的」建档）');
      return;
    }
    if (form.title.trim().length < 5) {
      platform.toast.error('标题至少 5 个字');
      return;
    }
    const startAt = new Date(Date.now() + 3600_000).toISOString();
    const endAt = new Date(Date.now() + 6 * 3600_000).toISOString();
    try {
      await api.post('/care/requests', {
        petIds: form.petIds,
        serviceType: form.serviceType,
        title: form.title.trim(),
        description: form.description.trim() || '按需沟通',
        areaCode: form.areaCode,
        startAt,
        endAt,
        pricingType: form.pricingType,
        ...(form.pricingType === 'FIXED' ? { priceMinor: Number(form.priceMinor) || 0 } : {}),
        cancelRule: 'FREE',
      });
      platform.toast.success('已发布求助需求');
      setMode('none');
      setForm({ ...EMPTY_FORM });
      setTab('requests');
      await load();
    } catch (error) {
      platform.toast.error(error instanceof Error ? error.message : '发布失败');
    }
  }

  return (
    <View className='pn-page'>
      <View className='pn-seg'>
        <View className={`pn-seg__item${tab === 'offerings' ? ' pn-seg__item--active' : ''}`} onClick={() => setTab('offerings')}>
          服务公告
        </View>
        <View className={`pn-seg__item${tab === 'requests' ? ' pn-seg__item--active' : ''}`} onClick={() => setTab('requests')}>
          求助需求
        </View>
        <View className={`pn-seg__item${tab === 'orders' ? ' pn-seg__item--active' : ''}`} onClick={() => setTab('orders')}>
          我的订单
        </View>
      </View>

      {tab === 'offerings' && (
        <View>
          <View className='pn-row'>
            <Button className='pn-btn pn-btn--ghost' style={{ flex: 1 }} onClick={() => openForm('offering')}>
              发布服务
            </Button>
            <Button className='pn-btn pn-btn--accent' style={{ flex: 1, marginLeft: '16px' }} onClick={() => openForm('request')}>
              发布需求
            </Button>
          </View>

          {mode !== 'none' && (
            <View className='pn-card'>
              <Text className='pn-card__title'>{mode === 'offering' ? '发布服务公告' : '发布求助需求'}</Text>
              {mode === 'request' && (
                <View className='pn-row'>
                  {pets.length === 0 && <Text className='pn-error'>还没有宠物档案，去「我的」先建档</Text>}
                  {pets.map((pet) => (
                    <Text
                      key={pet.id}
                      className={`pn-tag${form.petIds.includes(pet.id) ? '' : ' pn-tag--muted'}`}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          petIds: f.petIds.includes(pet.id) ? f.petIds.filter((id) => id !== pet.id) : [...f.petIds, pet.id],
                        }))
                      }
                    >
                      {pet.species === 'CAT' ? '🐱' : pet.species === 'DOG' ? '🐶' : pet.species === 'BIRD' ? '🐦' : '🐾'} {pet.name}
                    </Text>
                  ))}
                </View>
              )}
              <View className='pn-row'>
                {SERVICE_TYPES.map((t) => (
                  <Text key={t.key} className={`pn-tag${form.serviceType === t.key ? '' : ' pn-tag--muted'}`} onClick={() => setForm((f) => ({ ...f, serviceType: t.key }))}>
                    {t.label}
                  </Text>
                ))}
              </View>
              <Input className='pn-input' placeholder='标题（5-50 字）' value={form.title} onInput={(e) => setForm((f) => ({ ...f, title: e.detail.value }))} />
              <Textarea className='pn-textarea' placeholder='说明：时间、宠物情况、注意事项' value={form.description} onInput={(e) => setForm((f) => ({ ...f, description: e.detail.value }))} />
              <Input className='pn-input' placeholder='区域码（如 440305）' value={form.areaCode} onInput={(e) => setForm((f) => ({ ...f, areaCode: e.detail.value }))} />
              <View className='pn-row'>
                {PRICING.map((p) => (
                  <Text key={p.key} className={`pn-tag${form.pricingType === p.key ? '' : ' pn-tag--muted'}`} onClick={() => setForm((f) => ({ ...f, pricingType: p.key }))}>
                    {p.label}
                  </Text>
                ))}
              </View>
              {form.pricingType === 'FIXED' && (
                <Input className='pn-input' type='number' placeholder='价格（元）' value={form.priceMinor} onInput={(e) => setForm((f) => ({ ...f, priceMinor: e.detail.value }))} />
              )}
              <Button className='pn-btn' onClick={mode === 'offering' ? submitOffering : submitRequest}>
                确认发布
              </Button>
            </View>
          )}

          <View className='pn-list'>
            {offerings.length === 0 && <View className='pn-empty'>暂无服务公告，点上方按钮发布第一条</View>}
            {offerings.map((item) => (
              <View key={item.id} className='pn-item' onClick={() => platform.navigation.to(`/pages/care-offering/index?id=${item.id}`)}>
                <View className='pn-item__head'>
                  <View className='pn-avatar'>{item.provider.nickname.slice(0, 1)}</View>
                  <View style={{ flex: 1 }}>
                    <Text className='pn-item__title'>{item.title}</Text>
                    <Text className='pn-item__meta'>{item.provider.nickname} · {item.areaCode}</Text>
                  </View>
                  <Text className='pn-price'>{item.priceMinor === null ? PRICE_LABEL[item.pricingType] ?? '面议' : `¥${item.priceMinor / 100}`}</Text>
                </View>
                <Text className='pn-item__body'>{item.description.slice(0, 60)}</Text>
                <View style={{ display: 'flex', flexWrap: 'wrap' }}>
                  <Text className='pn-tag'>{item.trust.completedOrderCount} 单完成</Text>
                  <Text className='pn-tag pn-tag--muted'>{item.trust.reviewCount} 条评价</Text>
                  {item.trust.phoneVerified && <Text className='pn-tag pn-tag--success'>已验证</Text>}
                </View>
                <View className='pn-item__foot'>
                  <Text>{SERVICE_EMOJI[item.serviceType] ?? '🐾 其他'}</Text>
                  <Text>查看详情 ›</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {tab === 'requests' && (
        <View className='pn-list'>
          {requests.length === 0 && <View className='pn-empty'>暂无求助需求。需要帮忙时点「互助」页的「发布需求」</View>}
          {requests.map((item) => (
            <View key={item.id} className='pn-item' onClick={() => platform.navigation.to(`/pages/care-request/index?id=${item.id}`)}>
              <View className='pn-item__head'>
                <View className='pn-avatar'>{item.requester.nickname.slice(0, 1)}</View>
                <View style={{ flex: 1 }}>
                  <Text className='pn-item__title'>{item.title}</Text>
                  <Text className='pn-item__meta'>
                    {item.requester.nickname} · {item.areaCode} ·{' '}
                    {item.pets.map((p) => p.name).join('、')}
                  </Text>
                </View>
                <Text className='pn-price'>{item.priceMinor === null ? PRICE_LABEL[item.pricingType] ?? '面议' : `¥${item.priceMinor / 100}`}</Text>
              </View>
              <Text className='pn-item__body'>{item.description.slice(0, 60)}</Text>
              <View className='pn-item__foot'>
                <Text>{SERVICE_EMOJI[item.serviceType] ?? '🐾 其他'}</Text>
                <Text>{item.isOwner ? '我的需求 · 查看申请 ›' : '查看详情 ›'}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {tab === 'orders' && (
        <View className='pn-list'>
          {orders.length === 0 && <View className='pn-empty'>暂无订单。接受申请后会在这里出现</View>}
          {orders.map((order) => (
            <View key={order.id} className='pn-item' onClick={() => platform.navigation.to(`/pages/care-order/index?id=${order.id}`)}>
              <Text className='pn-item__title'>
                {ORDER_STATUS[order.status] ?? order.status}
              </Text>
              <Text className='pn-item__meta'>
                {order.role === 'REQUESTER' ? '我是需求方' : '我是服务者'} · {order.requester.nickname} ↔ {order.provider.nickname}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
