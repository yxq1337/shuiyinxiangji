# 水印相机后端迁移到腾讯云开发 CloudBase 设计文档

**日期：** 2026-07-17
**版本：** 1.0
**作者：** Claude Code

---

## 1. 概述

### 1.1 背景
水印相机应用后端当前使用 Express + 内存存储，计划部署到 Cloudflare Workers。由于国内访问速度问题，需要迁移到腾讯云开发 CloudBase。

### 1.2 目标
- ✅ 解决国内访问速度问题
- ✅ 使用腾讯云托管数据库，数据持久化
- ✅ 保持前端不变，最小化改动
- ✅ 保留现有的手动支付审核流程

### 1.3 范围
仅迁移后端，前端继续放在原位置。

---

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                     前端（保持不变）                     │
│              React + Vite + React Router                │
└────────────────────────────┬────────────────────────────┘
                             │ HTTP 请求
                             ↓
┌─────────────────────────────────────────────────────────┐
│           腾讯云 CloudBase HTTP 触发                    │
└────────────────────────────┬────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────┐
│              云函数（Node.js 16+）                      │
│         ┌───────────────────────────────────┐          │
│         │  路由分发 + 业务逻辑处理          │          │
│         └───────────────────────────────────┘          │
└────────────────────────────┬────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────┐
│               云开发数据库（文档型）                     │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐            │
│  │  users   │  │ payments  │  │ settings │            │
│  └──────────┘  └───────────┘  └──────────┘            │
└─────────────────────────────────────────────────────────┘
```

### 2.2 技术选型

| 组件 | 技术 |
|---|---|
| 后端运行时 | 腾讯云 CloudBase 云函数 |
| 数据库 | 腾讯云开发数据库（文档型 NoSQL） |
| 运行环境 | Node.js 16+ |
| 触发方式 | HTTP 访问服务 |

---

## 3. 数据库设计

### 3.1 users 集合（用户表）

```javascript
{
  _id: "string",           // 用户ID，主键
  phone: "string",         // 手机号，唯一索引
  isVip: boolean,          // 是否VIP
  vipExpiresAt: "string?", // VIP过期时间（ISO 8601），永久VIP为null
  createdAt: "string",     // 创建时间（ISO 8601）
  updatedAt: "string"      // 更新时间（ISO 8601）
}
```

**索引设计：**
- `_id`：主键
- `phone`：唯一索引

---

### 3.2 payments 集合（支付订单表）

```javascript
{
  _id: "string",                // 内部ID
  orderId: "string",            // 订单号（SYXXXXX格式），唯一索引
  provider: "string",           // 支付提供商，固定为 "manual"
  type: "string",               // 套餐类型："single" | "monthly" | "yearly" | "permanent"
  amount: number,               // 金额
  status: "string",             // 状态："created" | "pending_review" | "success" | "rejected"
  phone: "string",              // 用户手机号
  userEmail: "string?",         // 用户邮箱（可选）
  proofBase64: "string?",       // 支付凭证图片 base64
  proofUploadedAt: "string?",   // 凭证上传时间
  rejectReason: "string?",      // 拒绝原因（当status=rejected时）
  paidAt: "string?",            // 支付成功时间
  reviewedAt: "string?",        // 审核时间
  reviewedBy: "string?",        // 审核人
  createdAt: "string"           // 创建时间
}
```

**索引设计：**
- `_id`：主键
- `orderId`：唯一索引
- `phone`：普通索引
- `status`：普通索引
- `createdAt`：降序索引

---

### 3.3 settings 集合（系统配置表）

```javascript
{
  _id: "settings",             // 固定ID
  singlePrice: number,         // 单次价格
  monthlyPrice: number,        // 月度价格
  yearlyPrice: number,         // 年度价格
  permanentPrice: number,      // 永久价格
  paymentAccount: "string",    // 收款账号
  alipayQrCode: "string",      // 支付宝二维码
  wechatQrCode: "string",      // 微信二维码
  wechatQrUrl: "string",       // 微信二维码URL
  adminEmail: "string",        // 管理员邮箱
  resendApiKey: "string"       // Resend API Key
}
```

**初始化数据：**
```javascript
{
  _id: "settings",
  singlePrice: 1.99,
  monthlyPrice: 9.99,
  yearlyPrice: 19.99,
  permanentPrice: 29.99,
  paymentAccount: "admin@example.com",
  alipayQrCode: "",
  wechatQrCode: "",
  wechatQrUrl: "",
  adminEmail: "",
  resendApiKey: ""
}
```

---

## 4. API 接口设计

API 接口保持与原 Express 版本完全一致，确保前端无需改动。

### 4.1 健康检查

**GET** `/api/health`

**响应：**
```json
{
  "status": "ok"
}
```

---

### 4.2 认证接口

#### POST `/api/auth/login`

**请求体：**
```json
{
  "phone": "13800138000",
  "username": "admin",    // 可选，管理员登录
  "password": "vip1337"    // 可选，管理员登录
}
```

**响应（成功）：**
```json
{
  "success": true,
  "user": {
    "id": "用户ID",
    "phone": "手机号",
    "isVip": true,
    "vipExpiresAt": "2026-08-17T00:00:00.000Z",
    "createdAt": "2026-07-17T00:00:00.000Z",
    "isAdmin": false  // 仅管理员返回true
  }
}
```

---

#### GET `/api/auth/me/:id`

**路径参数：** `id` - 用户ID

**响应：** 同登录接口

---

### 4.3 系统配置接口

#### GET `/api/settings`

**响应：**
```json
{
  "singlePrice": 1.99,
  "monthlyPrice": 9.99,
  "yearlyPrice": 19.99,
  "permanentPrice": 29.99,
  "paymentAccount": "admin@example.com",
  "alipayQrCode": "",
  "wechatQrCode": ""
}
```

---

#### POST `/api/settings`

**请求体：**
```json
{
  "singlePrice": 1.99,
  "monthlyPrice": 9.99,
  "yearlyPrice": 19.99,
  "permanentPrice": 29.99,
  "paymentAccount": "admin@example.com",
  "alipayQrCode": "...base64...",
  "wechatQrCode": "...base64..."
}
```

**响应：**
```json
{
  "success": true,
  "settings": { ... }
}
```

---

### 4.4 订单接口

#### POST `/api/orders/create`

**请求体：**
```json
{
  "type": "monthly",       // "single" | "monthly" | "yearly" | "permanent"
  "phone": "13800138000",
  "email": "user@example.com"  // 可选
}
```

**响应：**
```json
{
  "success": true,
  "orderId": "SY260717123456AB",
  "amount": 9.99,
  "title": "水印相机 - 月度会员",
  "qrUrl": "...",
  "instructions": "请扫码支付 ¥9.99，付款时请在备注填写订单号：SY260717123456AB"
}
```

---

#### POST `/api/orders/:id/upload-proof`

**路径参数：** `id` - 订单ID

**请求体：**
```json
{
  "proofBase64": "data:image/png;base64,..."
}
```

**响应：**
```json
{
  "success": true,
  "status": "pending_review"
}
```

---

#### GET `/api/orders/:id/status`

**路径参数：** `id` - 订单ID

**响应：**
```json
{
  "success": true,
  "orderId": "SY260717123456AB",
  "status": "pending_review",
  "rejectReason": null,
  "paidAt": null,
  "type": "monthly",
  "amount": 9.99
}
```

---

### 4.5 支付接口

#### POST `/api/payments`

**请求体：**
```json
{
  "type": "monthly",
  "amount": 9.99,
  "timestamp": "2026-07-17T00:00:00.000Z",  // 可选
  "phone": "13800138000"
}
```

**响应：**
```json
{
  "success": true,
  "payment": { ... }
}
```

---

### 4.6 管理后台接口

#### GET `/api/admin/users`

**响应：**
```json
{
  "users": [
    {
      "id": "...",
      "phone": "13800138000",
      "isVip": true,
      "vipExpiresAt": "...",
      "createdAt": "..."
    }
  ]
}
```

---

#### GET `/api/admin/payments`

**响应：**
```json
{
  "payments": [ ... ]
}
```

---

#### GET `/api/admin/stats`

**响应：**
```json
{
  "totalRevenue": "999.00",
  "totalOrders": 100,
  "monthlyOrders": 50,
  "yearlyOrders": 30,
  "permanentOrders": 10,
  "singleOrders": 10,
  "totalUsers": 200,
  "activeVips": 150
}
```

---

#### GET `/api/admin/orders/pending`

**响应：**
```json
{
  "orders": [
    {
      "orderId": "SY...",
      "phone": "13800138000",
      "type": "monthly",
      "amount": 9.99,
      "timestamp": "...",
      "proofUploadedAt": "...",
      "proofBase64": "...",
      "userEmail": "..."
    }
  ]
}
```

---

#### GET `/api/admin/orders/pending-count`

**响应：**
```json
{
  "count": 5
}
```

---

#### POST `/api/admin/orders/:id/approve`

**路径参数：** `id` - 订单ID

**响应：**
```json
{
  "success": true
}
```

---

#### POST `/api/admin/orders/:id/reject`

**路径参数：** `id` - 订单ID

**请求体：**
```json
{
  "reason": "未看到支付凭证"
}
```

**响应：**
```json
{
  "success": true
}
```

---

## 5. 云函数实现

### 5.1 项目结构

```
shuiyinxiangji/
├── cloudbaserc.json                    # CloudBase 配置
├── cloudfunctions/
│   └── api/
│       ├── index.js                    # 云函数入口
│       ├── package.json                # 依赖配置
│       └── config.json                 # 权限配置
├── src/                                # 前端（保持不变）
│   ├── lib/
│   │   └── api.ts                      # 仅需修改 API_BASE
│   └── ...
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-07-17-cloudbase-migration-design.md
```

---

### 5.2 cloudbaserc.json

```json
{
  "version": "2.0",
  "envId": "{{YOUR_ENV_ID}}",
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

---

### 5.3 cloudfunctions/api/package.json

```json
{
  "name": "shuiyinxiangji-api",
  "version": "1.0.0",
  "description": "水印相机API云函数",
  "main": "index.js",
  "dependencies": {
    "@cloudbase/node-sdk": "^2.0.0"
  },
  "engines": {
    "node": ">=16"
  }
}
```

---

### 5.4 云函数主逻辑 (index.js)

核心流程：

1. 初始化 CloudBase SDK
2. 解析 HTTP 事件（method, path, body）
3. 路由分发到对应处理函数
4. 处理业务逻辑，读写数据库
5. 返回响应（带 CORS 头）

**关键功能模块：**
- 用户认证
- 订单管理
- 支付审核
- 系统配置

---

## 6. 前端改动

仅需修改一个文件：`src/lib/api.ts`

```typescript
// 修改前
const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'https://shuiyinxiangji-api.yxq1337.workers.dev';

// 修改后
const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'https://{{YOUR_ENV_ID}}.ap-shanghai.tcb.qcloud.la/api';
```

---

## 7. 部署步骤

### 7.1 前置准备

1. 注册腾讯云账号
2. 开通云开发 CloudBase 服务
3. 创建云开发环境
4. 安装 CloudBase CLI：`npm install -g @cloudbase/cli`

---

### 7.2 数据库初始化

1. 在 CloudBase 控制台开通云开发数据库
2. 创建三个集合：`users`, `payments`, `settings`
3. 在 `settings` 集合中插入初始化数据

---

### 7.3 云函数部署

```bash
# 1. 登录
tcb login

# 2. 修改 cloudbaserc.json 中的 envId

# 3. 部署云函数
tcb functions:deploy api

# 或使用 framework 部署
tcb deploy
```

---

### 7.4 配置 HTTP 触发

1. 进入 CloudBase 控制台 → 云函数 → api → 触发管理
2. 添加 HTTP 触发
3. 配置路径为 `/api`
4. 开启 CORS，配置允许的域名（前端域名）

---

### 7.5 配置环境变量

在云函数配置中添加：
- `ADMIN_USERNAME`: 管理员用户名
- `ADMIN_PASSWORD`: 管理员密码

---

### 7.6 前端更新

修改 `src/lib/api.ts` 中的 `API_BASE` 为云函数 HTTP 访问地址。

---

### 7.7 测试

1. 测试健康检查接口
2. 测试用户登录
3. 测试创建订单
4. 测试支付凭证上传
5. 测试管理员审核流程

---

## 8. 安全考虑

### 8.1 认证安全

- 管理员密码存储在云函数环境变量中，不在代码中
- 普通用户仅通过手机号登录，无需密码

### 8.2 CORS 配置

- 仅允许前端域名访问
- 生产环境禁用 `*` 通配符

### 8.3 数据库权限

- 云函数使用最小权限原则
- 数据库访问权限仅开放给云函数

### 8.4 输入验证

- 验证所有用户输入
- 验证 base64 图片格式和大小
- 验证订单号格式

---

## 9. 运维监控

### 9.1 日志

- 云函数日志自动记录到 CloudBase 日志服务
- 关键操作添加日志记录

### 9.2 监控

- 监控云函数调用次数
- 监控错误率
- 监控数据库读/写次数

### 9.3 备份

- 利用 CloudBase 数据库自动备份功能
- 定期导出重要数据

---

## 10. 回滚计划

如果迁移后出现问题：

1. 修改前端 `API_BASE` 回退到原地址
2. 云函数保持运行但不接收流量
3. 分析问题后决定是否重新迁移

---

## 11. 附录

### 11.1 订单号生成规则

```
格式：SY + YYMMDD + HHMM + 4位随机字符
示例：SY260717123456AB
```

### 11.2 API 响应格式

所有 API 统一响应格式：

```json
{
  "success": true/false,
  "error": "错误信息（失败时）",
  ...其他数据
}
```

### 11.3 状态流转

订单状态流转图：

```
created → pending_review → success
                      ↘
                        rejected
```

---

**文档结束**
