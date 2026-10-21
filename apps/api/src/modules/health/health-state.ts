/** health 模块枚举（API §2 尾段 + ERD §5 + 产品 6.5） */
export const HEALTH_LOG_TYPES = ['WEIGHT', 'DIET', 'WATER', 'ACTIVITY', 'EVENT'] as const;
export const HEALTH_SOURCES = ['MANUAL', 'DEVICE', 'VET'] as const;
/** 情绪观察标签白名单（主观可观察行为，非诊断） */
export const MOOD_TAGS = ['平静', '活跃', '紧张', '躲藏', '食欲变化', '异常叫声'] as const;

/** 客户端提示就医的紧急症状（6.5：服务端不做判定，仅随响应下发提醒文案供前端展示） */
export const EMERGENCY_HINT =
  '若出现呼吸困难、持续呕吐、抽搐、严重外伤等紧急情况，请尽快联系当地兽医或急诊；本模块仅作日常记录，不构成诊断或治疗建议。';
