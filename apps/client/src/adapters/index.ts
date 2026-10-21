import type { PlatformAdapter } from './types';

/**
 * 平台适配唯一出口：业务代码 `import { platform } from '../../adapters'`。
 * 铁律（apps/client/README）：页面不得直接写 TARO_ENV 或平台 API 判断。
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const isWeapp = process.env.TARO_ENV === 'weapp';

// 动态选择实现（webpack DefinePlugin 会在编译期折叠常量）
import { h5Adapter } from './h5';
import { weappAdapter } from './weapp';

export const platform: PlatformAdapter = isWeapp ? weappAdapter : h5Adapter;
export type { PlatformAdapter } from './types';
