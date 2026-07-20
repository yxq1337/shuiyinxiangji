# 腾讯云 CloudBase 部署指南

## 前置准备

1. 注册腾讯云账号: https://cloud.tencent.com/
2. 开通云开发 CloudBase 服务: https://console.cloud.tencent.com/tcb
3. 安装 CloudBase CLI:

```bash
npm install -g @cloudbase/cli
```

## 部署步骤

### 1. 登录并创建环境

```bash
# 登录 CloudBase
tcb login
```

在腾讯云控制台创建一个按量付费的云开发环境，记录环境 ID。

### 2. 修改配置文件

编辑 `cloudbaserc.json`，填写你的 EnvID：

```json
{
  "version": "2.0",
  "envId": "你的EnvID",
  "framework": {
    "plugins": {
      "function": {
        "use": "@cloudbase/framework-plugin-function",
        "inputs": {
          "functionRootPath": "cloudfunctions",
          "functions": [
            {
              "name": "api",
              "envVariables": {
                "NODE_ENV": "production",
                "ADMIN_USERNAME": "admin",
                "ADMIN_PASSWORD": "vip1337"
              },
              "runtime": "Nodejs16",
              "timeout": 60,
              "memorySize": 512,
              "handler": "index.main"
            }
          ]
        }
      }
    }
  }
}
```

### 3. 开通云数据库

在云开发控制台：
1. 进入 "数据库"
2. 点击 "开启"
3. 创建三个集合：
   - `users`
   - `payments`
   - `settings`

### 4. 初始化设置数据

在云开发控制台的数据库中，向 `settings` 集合添加一条初始记录：

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

### 5. 部署云函数

```bash
# 先进入云函数目录安装依赖
cd cloudfunctions/api
npm install

# 返回项目根目录
cd ../..

# 部署云函数
tcb functions:deploy api

# 或使用 framework 部署
tcb deploy
```

### 6. 配置云函数 HTTP 触发

在 CloudBase 控制台：
1. 进入云函数 -> "api" -> 触发管理
2. 新增触发方式 -> "HTTP 访问服务"
3. 配置：
   - 路径: `/api`（或者也可以配置为 `/`）
   - 鉴权类型: 免鉴权
4. 保存后记录访问地址，格式类似：
   `https://你的envid.ap-shanghai.tcb.qcloud.la`

**路径说明：**
- 云函数代码会自动处理路径前缀，无论 HTTP 触发配置为 `/api` 还是 `/` 都可以正常工作
- 前端请求的完整路径应为：`https://你的envid.ap-shanghai.tcb.qcloud.la/api/xxx`

### 7. 配置 CORS

在 HTTP 访问服务配置中，确保 CORS 配置允许你的前端域名访问，或设置为 `*` 允许所有（仅用于测试）。

### 8. 修改前端 API 配置

编辑 `src/lib/api.ts`，将 API_BASE 改为你的云函数地址：

```typescript
// CloudBase 云函数地址
const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'https://你的envid.ap-shanghai.tcb.qcloud.la';
```

### 9. 测试

1. 测试健康检查:
   ```bash
   curl https://你的envid.ap-shanghai.tcb.qcloud.la/api/health
   ```

2. 在前端应用中测试登录、创建订单、管理后台等功能。

## 本地开发

### 使用本地 Express 服务器

项目保持了原有的 Express 服务器，可以继续使用：

```bash
# 安装依赖
npm install

# 启动本地开发服务器
npm run dev
```

前端会通过 Vite 代理将 API 请求转发到本地 Express。

## 数据库设计

### users 集合（用户表）

```json
{
  "_id": "用户ID",
  "phone": "手机号",
  "isVip": true/false,
  "vipExpiresAt": "过期时间ISO",
  "createdAt": "创建时间ISO",
  "updatedAt": "更新时间ISO"
}
```

### payments 集合（支付订单表）

```json
{
  "_id": "内部ID",
  "orderId": "订单号SYxxx",
  "provider": "manual",
  "type": "single/monthly/yearly/permanent",
  "amount": 9.9,
  "status": "created/pending_review/success/rejected",
  "phone": "手机号",
  "userEmail": "邮箱（可选）",
  "proofBase64": "支付凭证图片base64",
  "proofUploadedAt": "上传时间",
  "rejectReason": "拒绝原因（可选）",
  "paidAt": "支付成功时间",
  "reviewedAt": "审核时间",
  "reviewedBy": "审核人",
  "createdAt": "创建时间",
  "updatedAt": "更新时间"
}
```

### settings 集合（系统配置表）

见上方初始化数据。

## API 接口

所有接口保持与原 Express 版本一致：

| 方法 | 路径 | 功能 |
|---|---|---|
| GET | `/api/health` | 健康检查 |
| POST | `/api/auth/login` | 登录 |
| GET | `/api/auth/me/:id` | 获取用户信息 |
| GET | `/api/settings` | 获取系统配置 |
| POST | `/api/settings` | 更新系统配置 |
| POST | `/api/orders/create` | 创建订单 |
| POST | `/api/orders/:id/upload-proof` | 上传支付凭证 |
| GET | `/api/orders/:id/status` | 查询订单状态 |
| POST | `/api/payments` | 创建支付记录 |
| GET | `/api/admin/users` | 用户列表 |
| GET | `/api/admin/payments` | 支付列表 |
| GET | `/api/admin/stats` | 统计数据 |
| GET | `/api/admin/orders/pending` | 待审核订单 |
| GET | `/api/admin/orders/pending-count` | 待审核数 |
| POST | `/api/admin/orders/:id/approve` | 审核通过 |
| POST | `/api/admin/orders/:id/reject` | 审核拒绝 |

## 注意事项

1. **数据持久化**：使用云开发数据库，不再是内存存储，数据会持久保存
2. **CORS配置**：确保云函数HTTP触发配置了正确的CORS，特别是生产环境
3. **安全性**：
   - 修改默认管理员密码
   - 合理配置数据库安全规则
   - 生产环境建议配置自定义域名和HTTPS
4. **权限控制**：云函数使用了最小权限原则
5. **环境变量**：管理员账号密码通过环境变量配置，不在代码中硬编码

## 数据库安全规则

在云开发控制台 -> 数据库 -> 安全规则中，建议配置：

```json
{
  "read": false,
  "write": false
}
```

因为数据只通过云函数访问，不直接从前端读写数据库。

## 监控与日志

在云开发控制台：
- "云函数" -> "日志"：查看函数执行日志
- "数据库" -> "操作记录"：查看数据库操作记录
- "监控"：查看调用次数、错误率等指标

## 成本估算

云开发按量付费（国内环境）：
- 云函数调用：约 ¥0.00008/次
- 数据库读写：约 ¥0.0006/万次
- 存储：约 ¥0.085/GB/月
- 流量：约 ¥0.21/GB

对于中小型应用，初期成本会非常低，很多情况下在免费额度内。

## 回滚方案

如果需要回滚到 Cloudflare Workers：
1. 恢复前端 `src/lib/api.ts` 中的 API_BASE 为原 Worker 地址
2. 重新部署 Cloudflare Worker

## 故障排查

### 云函数部署失败

- 检查 Node.js 版本是否为 16.x（CloudBase 支持的版本）
- 检查是否有语法错误
- 查看 CloudBase 控制台日志
- 确认 `cloudfunctions/api/package.json` 中的依赖正确

### API 请求失败

- 检查云函数 HTTP 触发配置的路径是否为 `/api`
- 检查 CORS 配置
- 检查云函数日志
- 确认数据库集合已创建且初始化了 settings 数据

### 数据库操作报错

- 确认三个集合（users, payments, settings）都已创建
- 确认 settings 集合中有 `_id: "settings"` 的记录
- 查看云函数日志中的具体错误信息

### 前端无法访问 API

- 检查 API 地址配置是否正确（不要漏掉 `/api` 前缀）
- 检查跨域设置
- 使用浏览器开发者工具查看网络请求

## 前端部署（可选）

如果需要迁移前端到 CloudBase 静态托管：

```bash
# 在 cloudbaserc.json 中添加 hosting 配置
{
  "hosting": {
    "use": "@cloudbase/framework-plugin-website",
    "inputs": {
      "buildCommand": "npm run build",
      "outputPath": "dist",
      "cloudPath": "/"
    }
  }
}

# 部署
tcb deploy
```

## 参考文档

- CloudBase 官方文档: https://cloud.tencent.com/document/product/876
- CloudBase CLI 文档: https://cloud.tencent.com/document/product/876/41131
- 云函数开发指南: https://cloud.tencent.com/document/product/876/19363
- 数据库操作指南: https://cloud.tencent.com/document/product/876/19368
