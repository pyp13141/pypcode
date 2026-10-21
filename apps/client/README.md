# 宠邻客户端（apps/client）

Taro 4.3 + React 18，一套代码编译**微信小程序**与**H5**。页面清单与视觉规范见 [产品文档](../../docs/PRODUCT_DESIGN.md) 4/13 节。

## 目录

```
src/
├── app.ts / app.config.ts / app.scss   # 入口、导航(5 Tab)、设计 Token
├── index.html                          # H5 模板（缺失则 H5 不产出 index.html）
├── pages/                              # 页面：home / care / market / community / profile
│   └── <page>/index.tsx + index.config.ts + index.scss
├── services/                           # API 请求封装（M1 起：api-client 等）
├── adapters/                           # 平台差异只允许出现在这里
│   ├── weapp/                          #   小程序实现
│   └── h5/                             #   H5 实现
├── components/                         # 跨页面复用组件（PetCard/ListingCard…见 13.2）
├── features/                           # 按业务域组织的逻辑块（M1 起）
└── types/                              # 共享类型
```

**铁律**：业务页面不得直接写 `process.env.TARO_ENV` 或平台 API 判断；平台差异封装成 Provider 接口（示例见产品文档 14.2）放进 `adapters/`。

## 构建

```bash
pnpm dev:h5        # H5 开发服 :10086
pnpm build:h5      # H5 产物 → dist/h5（publicPath=/petn/，basename=/petn）
pnpm build:weapp   # 小程序产物 → dist/weapp（微信开发者工具打开本目录）
```

## 已知构建坑（已修复，勿回退）

1. `compiler` 必须写成**对象** `{ type: 'webpack5', prebundle: { enable: false } }`，字符串写法会导致 H5 构建崩溃。
2. webpack 锁定 **5.91.0**（Taro 4.3 只兼容此版本，升级会触发 ProgressPlugin schema 错误）。
3. H5 必须有 `src/index.html` 模板，否则不生成入口文件。
4. 需要 `@babel/preset-react` 显式在 devDependencies（pnpm 不会自动带上 peer）。

## 微信小程序上线前配置

`project.config.json` 的 `appid` 目前是 `touristappid`（测试号）；拿到正式 AppID 后替换，并在微信公众平台配置 request/upload/download 合法域名（需备案域名）。
