# CloudBase 迁移快速开始

## 📋 已完成的工作

✅ 设计文档：`docs/superpowers/specs/2026-07-17-cloudbase-migration-design.md`
✅ CloudBase 配置：`cloudbaserc.json`
✅ 云函数代码：`cloudfunctions/api/index.js`（已集成数据库）
✅ 部署指南：`CLOUDBASE_DEPLOY.md`
✅ 数据库初始化脚本：`cloudfunctions/api/init-db.js`
✅ 更新了 README

## 🚀 5 分钟快速部署

### 1. 准备工作

- 注册腾讯云账号
- 开通云开发服务
- 安装 CloudBase CLI：`npm install -g @cloudbase/cli`

### 2. 创建环境并配置

1. 在腾讯云控制台创建云开发环境（按量付费）
2. 复制环境 ID
3. 编辑 `cloudbaserc.json`，将 `envId` 替换为你的环境 ID

### 3. 设置数据库

1. 在云开发控制台开启数据库
2. 创建三个集合：`users`、`payments`、`settings`
3. 在 `settings` 集合中添加初始数据：
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

### 4. 部署云函数

```bash
# 登录
tcb login

# 安装云函数依赖
cd cloudfunctions/api
npm install
cd ../..

# 部署
tcb functions:deploy api
```

### 5. 配置 HTTP 触发

1. 云开发控制台 -> 云函数 -> api -> 触发管理
2. 添加 HTTP 访问服务
3. 路径配置为 `/api`
4. 记录访问地址

### 6. 更新前端

编辑 `src/lib/api.ts`，将 `API_BASE` 改为云函数地址

### 7. 测试

访问健康检查：`https://你的envid.ap-shanghai.tcb.qcloud.la/api/health`

## 📖 详细文档

- 完整部署指南：[CLOUDBASE_DEPLOY.md](./CLOUDBASE_DEPLOY.md)
- 设计文档：[docs/superpowers/specs/2026-07-17-cloudbase-migration-design.md](./docs/superpowers/specs/2026-07-17-cloudbase-migration-design.md)

## 💡 提示

- 默认管理员账号：admin / vip1337
- 可在云函数环境变量中修改
- 数据库安全规则建议设为：`{ "read": false, "write": false }`（只通过云函数访问）
