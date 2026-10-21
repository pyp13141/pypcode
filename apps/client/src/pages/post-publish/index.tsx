import { useState } from 'react';
import { View, Text, Textarea, Button } from '@tarojs/components';
import { platform } from '../../adapters';
import { api } from '../../services/api-client';
import { ensureAuth } from '../../services/auth';
import { uploadImages } from '../../services/media';
import './index.scss';

export default function PostPublishPage() {
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);

  async function pickImages() {
    try {
      const uploads = await uploadImages('POST_IMAGE', 3);
      setImages((prev) => [...prev, ...uploads.map((u) => u.mediaId)].slice(0, 9));
    } catch (error) {
      platform.toast.error(error instanceof Error ? error.message : '选图失败');
    }
  }

  async function publish() {
    if (!ensureAuth('发布动态')) return;
    if (content.trim().length === 0) {
      platform.toast.error('写点什么吧');
      return;
    }
    try {
      const post = await api.post<{ moderationStatus: string; id: string }>('/community/posts', {
        content: content.trim(),
        ...(images.length > 0 ? { images } : {}),
      });
      platform.toast.success(post.moderationStatus === 'PENDING' ? '已提交，等待人工审核' : '发布成功');
      platform.navigation.back();
    } catch (error) {
      platform.toast.error(error instanceof Error ? error.message : '发布失败');
    }
  }

  return (
    <View className='pn-page'>
      <View className='pn-card'>
        <Textarea className='pn-textarea' placeholder='分享宠物日常 / 邻里见闻（≤2000 字）' value={content} onInput={(e) => setContent(e.detail.value)} />
        <Button className='pn-btn pn-btn--ghost' onClick={pickImages}>
          添加图片（{images.length}/9）
        </Button>
        <Text className='pn-card__desc'>新账号或含联系方式/转账字样的内容会先经人工审核。</Text>
        <Button className='pn-btn' onClick={publish}>
          发布
        </Button>
      </View>
    </View>
  );
}
