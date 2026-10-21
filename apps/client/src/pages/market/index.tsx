import { useDidShow } from '@tarojs/taro';
import { useState } from 'react';
import { View, Text, Input, Button, Textarea } from '@tarojs/components';
import { platform } from '../../adapters';
import { api, fetchPaged } from '../../services/api-client';
import { ensureAuth } from '../../services/auth';
import { uploadImages } from '../../services/media';
import './index.scss';

interface Listing {
  id: string;
  listingType: string;
  title: string;
  priceMinor: number | null;
  areaCode: string;
  status: string;
  seller: { nickname: string };
  imageMediaIds: string[];
  favoriteCount: number;
}

interface Deal {
  id: string;
  status: string;
  role: 'BUYER' | 'SELLER';
  listing: { title: string };
}

interface Category {
  code: string;
  name: string;
  riskLevel: string;
}

const TYPE_LABEL: Record<string, string> = { GIFT: '赠送', SWAP: '交换', SALE: '出售', WANTED: '求购' };
const TYPE_EMOJI: Record<string, string> = { GIFT: '🎁', SWAP: '🔄', SALE: '🏷️', WANTED: '🔍' };
const DEAL_LABEL: Record<string, string> = {
  CONTACTED: '已联系',
  AGREEMENT_PENDING: '约定中',
  AGREED: '已约定',
  HANDED_OVER: '已交接待确认',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  DISPUTED: '争议中',
};
const CONDITION_LABEL: Record<string, string> = { NEW: '全新', GOOD: '九成新', USED: '明显使用' };

const EMPTY_FORM = { listingType: 'GIFT', categoryCode: 'OTHER', title: '', description: '', areaCode: '440305', priceYuan: '0', condition: 'GOOD' };

function priceText(item: { listingType: string; priceMinor: number | null }): string {
  if (item.listingType === 'GIFT') return '免费赠送';
  if (item.listingType === 'WANTED') return '求购';
  if (item.priceMinor === null) return '面议';
  return `¥${item.priceMinor / 100}`;
}

export default function MarketPage() {
  const [tab, setTab] = useState<'listings' | 'deals'>('listings');
  const [listings, setListings] = useState<Listing[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const load = async () => {
    try {
      const [listingRes, dealRes] = await Promise.all([
        fetchPaged<Listing>('/market/listings?pageSize=20'),
        fetchPaged<Deal>('/market/deals?pageSize=20').catch(() => ({ items: [] as Deal[] })),
      ]);
      setListings(listingRes.items);
      setDeals(dealRes.items);
    } catch {
      /* ignore */
    }
  };

  useDidShow(() => {
    void load();
    api.get<Category[]>('/market/categories').then(setCategories).catch(() => setCategories([]));
  });

  function toggleForm() {
    if (!showForm && !ensureAuth('发布闲置')) return;
    if (!showForm) setForm({ ...EMPTY_FORM });
    setShowForm((v) => !v);
  }

  async function publish() {
    if (form.title.trim().length < 5) {
      platform.toast.error('标题至少 5 个字');
      return;
    }
    try {
      platform.toast.info('请选择 1 张物品照片');
      const uploads = await uploadImages('LISTING_IMAGE', 1);
      if (uploads.length === 0) {
        platform.toast.error('需要 1 张物品照片才能发布');
        return;
      }
      const category = categories.find((c) => c.code === form.categoryCode);
      await api.post('/market/listings', {
        listingType: form.listingType,
        categoryCode: form.categoryCode,
        title: form.title.trim(),
        description: form.description.trim() || '同城自取，细节私聊',
        condition: form.condition,
        areaCode: form.areaCode,
        ...(form.listingType === 'SALE' ? { priceMinor: Math.round((Number(form.priceYuan) || 0) * 100) } : {}),
        images: uploads.map((u) => u.mediaId),
      });
      platform.toast.success(category?.riskLevel === 'HIGH' ? '已提交，食品/药品类目需人工审核后上架' : '已发布');
      setShowForm(false);
      setForm({ ...EMPTY_FORM });
      await load();
    } catch (error) {
      platform.toast.error(error instanceof Error ? error.message : '发布失败');
    }
  }

  return (
    <View className='pn-page'>
      <View className='pn-seg'>
        <View className={`pn-seg__item${tab === 'listings' ? ' pn-seg__item--active' : ''}`} onClick={() => setTab('listings')}>
          逛集市
        </View>
        <View className={`pn-seg__item${tab === 'deals' ? ' pn-seg__item--active' : ''}`} onClick={() => setTab('deals')}>
          我的交易
        </View>
      </View>

      {tab === 'listings' && (
        <View>
          <Button className='pn-btn pn-btn--accent' onClick={toggleForm}>
            {showForm ? '收起' : '发布闲置'}
          </Button>
          {showForm && (
            <View className='pn-card'>
              <View className='pn-row'>
                {Object.keys(TYPE_LABEL).map((key) => (
                  <Text key={key} className={`pn-tag${form.listingType === key ? '' : ' pn-tag--muted'}`} onClick={() => setForm((f) => ({ ...f, listingType: key }))}>
                    {TYPE_LABEL[key]}
                  </Text>
                ))}
              </View>
              <View className='pn-row pn-row--wrap'>
                {(categories.length ? categories : [{ code: 'OTHER', name: '其他', riskLevel: 'MEDIUM' }]).map((c) => (
                  <Text key={c.code} className={`pn-tag${form.categoryCode === c.code ? '' : ' pn-tag--muted'}`} onClick={() => setForm((f) => ({ ...f, categoryCode: c.code }))}>
                    {c.name}
                    {c.riskLevel === 'HIGH' ? ' ⓘ' : ''}
                  </Text>
                ))}
              </View>
              <Input className='pn-input' placeholder='标题（5-50 字）' value={form.title} onInput={(e) => setForm((f) => ({ ...f, title: e.detail.value }))} />
              <Textarea className='pn-textarea' placeholder='描述物品状态、交接方式' value={form.description} onInput={(e) => setForm((f) => ({ ...f, description: e.detail.value }))} />
              <Input className='pn-input' placeholder='区域码（如 440305）' value={form.areaCode} onInput={(e) => setForm((f) => ({ ...f, areaCode: e.detail.value }))} />
              <View className='pn-row'>
                {Object.keys(CONDITION_LABEL).map((key) => (
                  <Text key={key} className={`pn-tag${form.condition === key ? '' : ' pn-tag--muted'}`} onClick={() => setForm((f) => ({ ...f, condition: key }))}>
                    {CONDITION_LABEL[key]}
                  </Text>
                ))}
              </View>
              {form.listingType === 'SALE' && (
                <Input className='pn-input' type='number' placeholder='价格（元）' value={form.priceYuan} onInput={(e) => setForm((f) => ({ ...f, priceYuan: e.detail.value }))} />
              )}
              <Button className='pn-btn' onClick={publish}>
                发布（含 1 张照片）
              </Button>
            </View>
          )}
          <View className='pn-list'>
            {listings.length === 0 && <View className='pn-empty'>暂无闲置，发布第一条吧</View>}
            {listings.map((item) => (
              <View key={item.id} className='pn-item' onClick={() => platform.navigation.to(`/pages/market-listing/index?id=${item.id}`)}>
                <View className='pn-item__head'>
                  <View className='pn-thumb'>{TYPE_EMOJI[item.listingType] ?? '📦'}</View>
                  <View style={{ flex: 1 }}>
                    <View style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Text className='pn-item__title'>{item.title}</Text>
                      {item.status !== 'PUBLISHED' && <Text className='pn-badge pn-badge--muted'>{item.status === 'SOLD' ? '已送出/售出' : item.status === 'PENDING_REVIEW' ? '审核中' : item.status}</Text>}
                    </View>
                    <Text className='pn-item__meta'>{item.areaCode} · {item.seller.nickname}</Text>
                    <View className='pn-item__foot' style={{ borderTop: 'none', paddingTop: 0, marginTop: '10px' }}>
                      <Text className='pn-price'>{priceText(item)}</Text>
                      <Text>♡ {item.favoriteCount}</Text>
                    </View>
                  </View>
                </View>
                <Text className={`pn-tag${item.status === 'SOLD' ? ' pn-tag--muted' : ' pn-tag--accent'}`}>{TYPE_LABEL[item.listingType]}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {tab === 'deals' && (
        <View className='pn-list'>
          {deals.length === 0 && <View className='pn-empty'>暂无交易。在物品详情页发起交易</View>}
          {deals.map((deal) => (
            <View key={deal.id} className='pn-item' onClick={() => platform.navigation.to(`/pages/market-deal/index?id=${deal.id}`)}>
              <Text className='pn-item__title'>{deal.listing.title}</Text>
              <Text className='pn-item__meta'>
                {deal.role === 'BUYER' ? '我是买家' : '我是卖家'} · {DEAL_LABEL[deal.status] ?? deal.status}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
