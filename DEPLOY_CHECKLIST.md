# 部署检查清单

## 部署前检查

- [ ] 已注册腾讯云账号
- [ ] 已开通云开发 CloudBase 服务
- [ ] 已安装 CloudBase CLI: `npm install -g @cloudbase/cli`
- [ ] 已登录 CloudBase: `tcb login`

## 环境创建

- [ ] 在云开发控制台创建按量付费环境
- [ ] 已记录环境 ID
- [ ] 已更新 `cloudbaserc.json` 中的 envId

## 数据库设置

- [ ] 在云开发控制台开启数据库服务
- [ ] 已创建集合 `users`
- [ ] 已创建集合 `payments`
- [ ] 已创建集合 `settings`
- [ ] 已在 `settings` 集合中添加初始数据：
  ```json
  {
    "_id": "settings",
    "singlePrice": 1.99,
    "monthlyPrice": 9.9,
    "yearlyPrice": 19.9,
    "permanentPrice": 29.9,
    "paymentAccount": "admin@example.com",
    "alipayQrCode": "",
    "wechatQrCode": "",
    "wechatQrUrl": "",
    "adminEmail": "",
    "resendApiKey": ""
  }
  ```
- [ ] 已配置数据库安全规则（建议设为 `{ "read": false, "write": false }`）

## 云函数部署

- [ ] 已安装云函数依赖：
  ```bash
  cd cloudfunctions/api
  npm install
  ```
- [ ] 已部署云函数：`tcb functions:deploy api`
- [ ] 已在云函数配置中添加环境变量：
  - `ADMIN_USERNAME`: admin (或自定义)
  - `ADMIN_PASSWORD`: vip1337 (或自定义)

## HTTP 触发配置

- [ ] 已在云函数触发管理中添加 HTTP 访问服务
- [ ] 路径已配置为 `/api`（或 `/`）
- [ ] 鉴权类型设为免鉴权
- [ ] 已记录访问地址（格式：`https://env-id.region.tcb.qcloud.la`）
- [ ] 已配置 CORS 允许前端域名（或临时设为 `*` 测试）

## 前端配置

- [ ] 已更新 `src/lib/api.ts` 中的 `API_BASE`：
  ```typescript
  const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'https://你的envid.ap-shanghai.tcb.qcloud.la';
  ```

## 测试验证

- [ ] 测试健康检查：
  ```bash
  curl https://你的envid.ap-shanghai.tcb.qcloud.la/api/health
  ```
- [ ] 前端可以正常访问
- [ ] 用户登录功能正常
- [ ] 可以创建订单
- [ ] 可以上传支付凭证
- [ ] 管理员可以登录
- [ ] 管理员可以查看订单
- [ ] 管理员可以审核订单
- [ ] 审核通过后用户 VIP 状态正确更新

## 上线前检查

- [ ] 已修改默认管理员密码
- [ ] CORS 已配置为只允许前端域名
- [ ] 数据库安全规则已正确配置
- [ ] 已测试所有关键功能
- [ ] 已配置监控和告警（可选）

## 回滚方案

如果需要回滚到 Cloudflare Workers：
- [ ] 恢复前端 `src/lib/api.ts` 中的 API_BASE 为原 Worker 地址
- [ ] 重新部署 Cloudflare Worker

## 参考文档

- 快速开始：[QUICKSTART.md](./QUICKSTART.md)
- 完整部署指南：[CLOUDBASE_DEPLOY.md](./CLOUDBASE_DEPLOY.md)
- 设计文档：[docs/superpowers/specs/2026-07-17-cloudbase-migration-design.md](./docs/superpowers/specs/2026-07-17-cloudbase-migration-design.md)
