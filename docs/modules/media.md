# 模块：media（媒体管线）

> 二级契约：docs/API.md §5 媒体段。实现先行于 M4（集市图片依赖，D-012）；存储适配器 D-007。

## 职责

短时授权直传 → finalize 登记 → 签名读取。**对象 key 不可预测且不出现在 URL**；桶（目录）禁止公开写入；
原始文件名不落盘（不用用户姓名/手机号，产品 7.5）。

## 设计要点

| 项 | 方案 | 为什么 |
|---|---|---|
| 存储 | `MediaStorageService` 本地盘适配器（`/var/lib/petn-media`，env `MEDIA_DIR` 可覆盖） | 与 S3 兼容形状，上线换 COS 只替换实现（D-007） |
| 上传 | 授权端点签发 HMAC 短时 token（10 分钟）→ `PUT .../upload` 直传 | 客户端不持有凭证；服务端按 purpose 限制类型/大小 |
| 读取 | 业务授权校验后签发 5 分钟签名地址 | 读写都过授权，密钥可轮换 |
| 审核 | finalize 后 `PENDING`；REJECTED 一律 404 | 机审/人审接入点在 M4 后台 |

## 代码位置

```
apps/api/src/modules/media/
├── media.module.ts
├── media-state.ts            # purpose 白名单/大小上限/频控常量
├── media-storage.service.ts  # 本地盘适配器（put/get/exists/delete）
└── endpoints/
    ├── upload-authorizations/  # POST 授权
    ├── media-blob/             # PUT 直传 + GET 字节读取
    ├── media-finalize/         # POST 登记
    └── media-url/              # GET 读取签名（业务授权 + 审计）
```

## 接口清单

| 方法 | 路径 | 契约 | 状态 |
|---|---|---|---|
| POST | /api/v1/media/upload-authorizations | [upload-authorizations](media/upload-authorizations.md) | ✅ |
| PUT/GET | /api/v1/media/:mediaId/upload · /file | [media-blob](media/media-blob.md) | ✅ |
| POST | /api/v1/media/:mediaId/finalize | [media-finalize](media/media-finalize.md) | ✅ |
| GET | /api/v1/media/:mediaId/url | [media-url](media/media-url.md) | ✅ |

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `MEDIA_DIR` | `/var/lib/petn-media` | 本地盘根目录（生产 750 权限；上线换 COS 后废弃） |
| `PUBLIC_API_ORIGIN` | 空 | 配置后上传/读取返回绝对 URL（如 `http://YOUR_SERVER_IP/petn`） |

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-10 | 模块建立（M3）；note：pets/users 的头像字段接入媒体替换为 M5 客户端联调事项 |
