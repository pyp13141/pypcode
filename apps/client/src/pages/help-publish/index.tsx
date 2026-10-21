import { useState } from 'react';
import { View, Text, Input, Textarea, Button } from '@tarojs/components';
import { platform } from '../../adapters';
import { api } from '../../services/api-client';
import { ensureAuth } from '../../services/auth';
import './index.scss';

const CATEGORIES = [
  { key: 'PET_CARE', label: '宠物相关（借猫砂铲/拼车遛狗…）' },
  { key: 'NEIGHBOR', label: '邻里小事（借工具/代收快递…）' },
];

export default function HelpPublishPage() {
  const [category, setCategory] = useState('PET_CARE');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  async function publish() {
    if (!ensureAuth('发布求助帖')) return;
    if (title.trim().length < 5) {
      platform.toast.error('标题至少 5 个字');
      return;
    }
    try {
      const created = await api.post<{ id: string }>('/community/help-posts', {
        category,
        title: title.trim(),
        content: content.trim() || '详见标题，评论区沟通',
        deadlineAt: new Date(Date.now() + 3 * 86400_000).toISOString(),
      });
      platform.toast.success('已发布');
      platform.navigation.back();
      void created;
    } catch (error) {
      platform.toast.error(error instanceof Error ? error.message : '发布失败');
    }
  }

  return (
    <View className='pn-page'>
      <View className='pn-card'>
        <Text className='pn-card__title'>发布邻里求助帖</Text>
        <Text className='pn-card__desc'>轻量求助，无订单机制；评论/站内响应。跑腿、代办等商业类目暂不开放。</Text>
        <View className='pn-row'>
          {CATEGORIES.map((item) => (
            <Text key={item.key} className={`pn-tag${category === item.key ? '' : ' pn-tag--muted'}`} onClick={() => setCategory(item.key)}>
              {item.label}
            </Text>
          ))}
        </View>
        <Input className='pn-input' placeholder='标题（5-50 字）' value={title} onInput={(e) => setTitle(e.detail.value)} />
        <Textarea className='pn-textarea' placeholder='说明（≤1000 字）' value={content} onInput={(e) => setContent(e.detail.value)} />
        <Button className='pn-btn' onClick={publish}>
          发布求助
        </Button>
      </View>
    </View>
  );
}
