# GET /api/v1/market/categories

> 契约同 [API §4](../../API.md#4-本地集市market--媒体m3)。

## 语义

公开分类字典（种子 10 类；管理端 `PUT /admin/categories` 可调）。`riskLevel=HIGH`（宠物食品/药品）
发布即 `PENDING_REVIEW` 人工审核（D-012）。客户端发布表单的分类选择器数据源。

## 响应 200

`CategoryView[] { code, name, riskLevel }` — 例：`[{ code: "PET_FOOD", name: "宠物食品", riskLevel: "HIGH" }, ...]`

## 错误

| 码 | HTTP | 条件 |
|---|---:|---|
| `RESOURCE_NOT_FOUND` | 404 | 分类未配置（种子缺失） |

## 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-11 | 首版：客户端分类选择器数据源（此前硬编码 OTHER，HIGH 类目人审永不触发，UX-REVIEW P1） |
