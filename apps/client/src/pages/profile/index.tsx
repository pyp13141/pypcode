import { useDidShow } from '@tarojs/taro';
import { useState } from 'react';
import { View, Text, Input, Button } from '@tarojs/components';
import { platform } from '../../adapters';
import { api, auth } from '../../services/api-client';
import { fetchMe, logout, type MeView } from '../../services/auth';
import './index.scss';

interface PetView {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  visibility: string;
}

const SPECIES: Record<string, string> = { CAT: '猫', DOG: '狗', BIRD: '鸟', SMALL_ANIMAL: '小动物', OTHER: '其他' };

export default function ProfilePage() {
  const [me, setMe] = useState<MeView | null>(null);
  const [pets, setPets] = useState<PetView[]>([]);
  const [petName, setPetName] = useState('');
  const [petSpecies, setPetSpecies] = useState('CAT');
  const loggedIn = Boolean(auth.token());

  const load = async () => {
    if (!auth.token()) return;
    try {
      const [profile, petList] = await Promise.all([fetchMe(), api.get<PetView[]>('/pets')]);
      setMe(profile);
      setPets(petList);
    } catch {
      // 401 由 api-client 统一处理
    }
  };

  useDidShow(() => {
    void load();
  });

  async function addPet() {
    if (petName.trim().length < 1) {
      platform.toast.error('请填写宠物名字');
      return;
    }
    try {
      await api.post('/pets', { name: petName.trim(), species: petSpecies, visibility: 'PRIVATE' });
      setPetName('');
      platform.toast.success('已建档');
      await load();
    } catch (error) {
      platform.toast.error(error instanceof Error ? error.message : '建档失败');
    }
  }

  async function removePet(id: string) {
    const ok = await platform.modal.confirm({ title: '删除档案', content: '删除后不再展示（已参与订单的快照不受影响）' });
    if (!ok) return;
    await api.delete(`/pets/${id}`);
    await load();
  }

  async function handleLogout() {
    await logout();
    setMe(null);
    setPets([]);
    platform.navigation.switchTab('/pages/home/index');
  }

  if (!loggedIn) {
    return (
      <View className='pn-page'>
        <View className='pn-card'>
          <Text className='pn-card__title'>未登录</Text>
          <Text className='pn-card__desc'>登录后管理宠物档案、订单与交易</Text>
          <Button className='pn-btn' onClick={() => platform.navigation.to('/pages/login/index')}>
            去登录
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View className='pn-page'>
      <View className='pn-card' style={{ display: 'flex', alignItems: 'center' }}>
        <View className='pn-avatar' style={{ width: '104px', height: '104px', fontSize: '44px' }}>
          {(me?.nickname ?? '宠').slice(0, 1)}
        </View>
        <View style={{ flex: 1 }}>
          <Text className='pn-card__title'>{me?.nickname ?? '我的'}</Text>
          <Text className='pn-card__desc'>
            {me?.emailVerified ? `邮箱已验证 ${me.emailMasked ?? ''}` : me?.phoneVerified ? `手机号已验证 ${me.phoneMasked ?? ''}` : '邮箱未验证（登录邮箱即验证）'}
          </Text>
          <Text className='pn-card__desc'>宠物档案 {pets.length} 只 · {me?.areaCode ?? '未设置区域'}</Text>
        </View>
      </View>

      <View className='pn-card'>
        <Text className='pn-card__title'>宠物档案（{pets.length}）</Text>
        {pets.map((pet) => (
          <View key={pet.id} className='pn-row'>
            <Text>
              {pet.name} · {SPECIES[pet.species] ?? pet.species}
              {pet.breed ? ` · ${pet.breed}` : ''}
            </Text>
            <Text className='pn-tag pn-tag--muted' onClick={() => removePet(pet.id)}>
              删除
            </Text>
          </View>
        ))}
        <Input className='pn-input' placeholder='宠物名字' value={petName} onInput={(e) => setPetName(e.detail.value)} />
        <View className='pn-row'>
          {Object.keys(SPECIES).map((key) => (
            <Text key={key} className={`pn-tag${petSpecies === key ? '' : ' pn-tag--muted'}`} onClick={() => setPetSpecies(key)}>
              {SPECIES[key]}
            </Text>
          ))}
        </View>
        <Button className='pn-btn pn-btn--ghost' onClick={addPet}>
          新增宠物档案
        </Button>
      </View>

      <View className='pn-card' onClick={() => platform.navigation.to('/pages/notifications/index')}>
        <Text className='pn-card__title'>通知中心</Text>
        <Text className='pn-card__desc'>订单、交易与互动的提醒</Text>
      </View>

      <Button className='pn-btn pn-btn--ghost' onClick={handleLogout}>
        退出登录
      </Button>
    </View>
  );
}
