<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# 水印相机应用

这是一个水印相机应用，支持用户通过支付解锁高级功能。

## 部署方式

### 1. Cloudflare Workers（原版）

- 前端部署到 Cloudflare Pages
- 后端部署到 Cloudflare Workers
- 内存存储（非持久化）

### 2. 腾讯云 CloudBase（推荐用于国内）⭐

- 前端保持在原位置
- 后端部署到 CloudBase 云函数
- 使用云开发数据库（持久化存储）
- 国内访问速度更快

详细部署指南请查看 [CLOUDBASE_DEPLOY.md](./CLOUDBASE_DEPLOY.md)

## 本地开发

**前置条件:** Node.js

1. 安装依赖:
   ```bash
   npm install
   ```

2. 在 `.env.local` 中配置 `GEMINI_API_KEY`（如需要）

3. 启动开发服务器:
   ```bash
   npm run dev
   ```

应用将在 http://localhost:3000 启动

## 项目结构

```
shuiyinxiangji/
├── src/                    # 前端代码
│   ├── components/         # 组件
│   ├── contexts/          # React Context
│   ├── lib/               # 工具库（包括 API 配置）
│   ├── pages/             # 页面
│   └── main.tsx           # 入口
├── server.ts              # 本地 Express 服务器
├── cloudbaserc.json       # CloudBase 配置
├── cloudfunctions/        # CloudBase 云函数
│   └── api/
│       ├── index.js       # 云函数主代码（使用云数据库）
│       ├── package.json   # 云函数依赖
│       └── init-db.js     # 数据库初始化脚本
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-07-17-cloudbase-migration-design.md  # 详细设计文档
└── CLOUDBASE_DEPLOY.md    # CloudBase 部署指南
```

## 功能特性

- 用户登录（手机号）
- VIP 会员系统
- 支付功能（手动审核）
- 管理后台
- 水印编辑功能

## API 接口

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

## 查看 AI Studio

https://ai.studio/apps/45fd0eb4-1ce5-4b71-94b5-8438cccabbe9
