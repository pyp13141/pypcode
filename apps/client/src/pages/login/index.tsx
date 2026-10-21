import { useState } from 'react';
import { View, Text, Input, Button } from '@tarojs/components';
import { platform } from '../../adapters';
import { loginWithEmail, loginWithWechat, sendEmailCode } from '../../services/auth';
import './index.scss';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState(0);

  function startCountdown() {
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown((v) => {
        if (v <= 1) {
          clearInterval(timer);
          return 0;
        }
        return v - 1;
      });
    }, 1000);
  }

  async function handleSendCode() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      platform.toast.error('请输入正确的邮箱');
      return;
    }
    if (countdown > 0) return;
    setBusy(true);
    try {
      const devCode = await sendEmailCode(email.trim());
      startCountdown();
      if (devCode) {
        setCode(devCode);
        platform.toast.success(`开发模式：验证码 ${devCode} 已自动填入（未接邮件供应商）`);
      } else {
        platform.toast.success('验证码已发送，请查收邮箱');
      }
    } catch (error) {
      platform.toast.error(error instanceof Error ? error.message : '发送失败');
    } finally {
      setBusy(false);
    }
  }

  async function handleEmailLogin() {
    if (code.trim().length !== 6) {
      platform.toast.error('请输入 6 位验证码');
      return;
    }
    setBusy(true);
    try {
      await loginWithEmail(email.trim(), code.trim());
      platform.toast.success('登录成功');
      platform.navigation.switchTab('/pages/home/index');
    } catch (error) {
      platform.toast.error(error instanceof Error ? error.message : '登录失败');
    } finally {
      setBusy(false);
    }
  }

  async function handleWechat() {
    setBusy(true);
    try {
      await loginWithWechat();
      platform.toast.success('登录成功');
      platform.navigation.switchTab('/pages/home/index');
    } catch (error) {
      platform.toast.error(error instanceof Error ? error.message : '登录失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className='pn-page'>
      <View className='pn-hero'>
        <Text className='pn-hero__title'>🐾 宠邻</Text>
        <View className='pn-hero__slogan'>登录后即可发布、沟通、预约与评价</View>
      </View>

      <View className='pn-card'>
        <Text className='pn-card__title'>邮箱验证码登录</Text>
        <Text className='pn-card__desc'>新邮箱将自动注册；登录即完成邮箱验证</Text>

        <View className='pn-field'>
          <Text className='pn-field__label'>邮箱</Text>
          <Input
            className='pn-input'
            type='text'
            placeholder='you@example.com'
            value={email}
            onInput={(e) => setEmail(e.detail.value)}
          />
        </View>

        <View className='pn-field'>
          <Text className='pn-field__label'>验证码</Text>
          <View className='pn-code-row'>
            <Input
              className='pn-input pn-code-input'
              type='number'
              maxlength={6}
              placeholder='6 位数字'
              value={code}
              onInput={(e) => setCode(e.detail.value)}
            />
            <Button
              className={`pn-btn pn-btn--ghost pn-btn--sm${countdown > 0 || busy ? ' pn-btn--disabled' : ''}`}
              disabled={busy || countdown > 0}
              onClick={handleSendCode}
            >
              {countdown > 0 ? `${countdown}s 后重发` : '获取验证码'}
            </Button>
          </View>
        </View>

        <Button className='pn-btn pn-btn--block' disabled={busy} onClick={handleEmailLogin}>
          登录 / 注册
        </Button>
      </View>

      <View className='pn-card'>
        <Text className='pn-card__title'>其他方式</Text>
        <Text className='pn-card__desc'>微信一键登录（内测环境为模拟凭证，正式版需微信 App 内使用）</Text>
        <Button className='pn-btn pn-btn--ghost pn-btn--block' disabled={busy} onClick={handleWechat}>
          微信一键登录
        </Button>
      </View>
    </View>
  );
}
