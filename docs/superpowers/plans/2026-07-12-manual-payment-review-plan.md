# 半自动截图审核支付 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用固定微信收款码 + 上传截图 + 管理员审核的方式实现零成本收款。

**Architecture:** 用户下单 → 显示收款码 + 订单号 → 上传截图 → 状态 pending_review → 管理员在后台审核 → success 激活 VIP。截图 base64 存 D1，通过 Resend 发邮件通知管理员和用户。

**Tech Stack:** TypeScript、Hono (Workers)、React 19、Cloudflare D1、Resend API。前端用 Canvas 压缩截图。

## Global Constraints

- 保留 Express 本地开发模式（`server.ts`）不动，本次改造只针对 `worker/`
- Cloudflare Workers 不能用 Node.js 模块，只能用 Web 标准 API
- 密钥 `RESEND_API_KEY` 用 `wrangler secret put` 存储，可选（未配置时降级为不发邮件）
- Worker 域名：`https://shuiyinxiangji-api.yxq1337.workers.dev`
- Pages 域名：`https://shuiyinxiangji.pages.dev`
- 前端 API 调用统一用 `src/lib/api.ts` 的 `apiGet`/`apiPost`
- 订单号格式：`SYX<YY><MM><DD><HH><mm><4位随机大写字母数字>`，如 `SYX26071214A3F2`
- 状态机：`created` → `pending_review` → `success` / `rejected`
- 截图 base64 存 `payments.raw_notify` 字段（复用现有字段）
- 前端上传前用 Canvas 压缩至长边 ≤ 800px、JPEG 0.75 质量
- `provider` 字段填字符串 `manual`
- Git 提交格式：`feat:` / `fix:` / `docs:` 开头，最后加 `Co-Authored-By: Claude <noreply@anthropic.com>`
- 每完成一个 Task 就提交一次
- wrangler 二进制：`./node_modules/.bin/wrangler`（不用 `npx wrangler`）
- Cloudflare API Token 环境变量：`export CLOUDFLARE_API_TOKEN=cfut_2THcmsqZyrkslgy0snrXyl5ymldc4ga2QOZwWU7ce0db80ee`

---

## 文件结构

**Worker 后端（新建/修改）：**
- `worker/schema-migrate-v3.sql` — 数据库迁移（新建）
- `worker/email.ts` — Resend 邮件工具（新建）
- `worker/orders.ts` — 订单业务逻辑辅助函数（新建）
- `worker/index.ts` — 新增 6 个路由（修改）

**前端（新建/修改）：**
- `public/wechat-pay-qr.png` — 收款码图片（用户放入，占位 placeholder）
- `src/pages/Pricing.tsx` — 改为创建订单后跳转（修改）
- `src/pages/PaymentPending.tsx` — 新增，付款等待页面（新建）
- `src/pages/Admin.tsx` — 新增"支付审核"tab + 红点计数（修改）
- `src/App.tsx` — 新增路由 `/payment/pending`（修改）
- `src/lib/imageCompress.ts` — Canvas 压缩工具（新建）

**部署脚本：**
- `package.json` — 新增迁移脚本（修改）

---

### Task 1: 数据库迁移 v3

**Files:**
- Create: `worker/schema-migrate-v3.sql`
- Modify: `package.json`

**Interfaces:**
- Produces:
  - `payments` 表新增 5 列：`proof_uploaded_at`, `reviewed_at`, `reviewed_by`, `reject_reason`, `user_email`
  - `settings` 表新增 3 列：`wechat_qr_url`, `admin_email`, `resend_api_key`
- Consumes: 无（v2 迁移已完成）

- [ ] **Step 1: 创建迁移 SQL 文件**

创建 `worker/schema-migrate-v3.sql`：

```sql
-- v3 迁移：截图审核支付方案

-- payments 表新增审核字段
ALTER TABLE payments ADD COLUMN proof_uploaded_at TEXT;
ALTER TABLE payments ADD COLUMN reviewed_at TEXT;
ALTER TABLE payments ADD COLUMN reviewed_by TEXT;
ALTER TABLE payments ADD COLUMN reject_reason TEXT;
ALTER TABLE payments ADD COLUMN user_email TEXT;

-- settings 表新增支付配置字段
ALTER TABLE settings ADD COLUMN wechat_qr_url TEXT DEFAULT '';
ALTER TABLE settings ADD COLUMN admin_email TEXT DEFAULT '';
ALTER TABLE settings ADD COLUMN resend_api_key TEXT DEFAULT '';
```

- [ ] **Step 2: 更新 package.json 增加迁移脚本**

在 `"scripts"` 中新增（放到 `db:migrate:v2:remote` 后面）：

```json
"db:migrate:v3": "wrangler d1 execute shuiyinxiangji-db --file=worker/schema-migrate-v3.sql",
"db:migrate:v3:remote": "wrangler d1 execute shuiyinxiangji-db --file=worker/schema-migrate-v3.sql --remote",
```

- [ ] **Step 3: 执行远程迁移**

```bash
cd C:/Users/HUAWEI/shuiyinxiangji
export CLOUDFLARE_API_TOKEN=cfut_2THcmsqZyrkslgy0snrXyl5ymldc4ga2QOZwWU7ce0db80ee
./node_modules/.bin/wrangler d1 execute shuiyinxiangji-db --file=worker/schema-migrate-v3.sql --remote 2>&1 | tail -20
```

Expected: `Executed 8 queries` 或类似。如某列已存在报 `duplicate column name`，忽略即可。

- [ ] **Step 4: 验证表结构**

```bash
./node_modules/.bin/wrangler d1 execute shuiyinxiangji-db --command "PRAGMA table_info(payments);" --remote
./node_modules/.bin/wrangler d1 execute shuiyinxiangji-db --command "PRAGMA table_info(settings);" --remote
```

期望：
- `payments` 表包含 `proof_uploaded_at`, `reviewed_at`, `reviewed_by`, `reject_reason`, `user_email`
- `settings` 表包含 `wechat_qr_url`, `admin_email`, `resend_api_key`

- [ ] **Step 5: 提交**

```bash
cd C:/Users/HUAWEI/shuiyinxiangji
git add worker/schema-migrate-v3.sql package.json
git commit -m "feat: 数据库迁移 v3 - 截图审核支付方案

- payments 表：proof_uploaded_at、reviewed_at、reviewed_by、reject_reason、user_email
- settings 表：wechat_qr_url、admin_email、resend_api_key
- 新增 npm 脚本 db:migrate:v3 / db:migrate:v3:remote

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: 邮件工具库（Resend）

**Files:**
- Create: `worker/email.ts`

**Interfaces:**
- Produces:
  - `sendEmail(apiKey: string, to: string, subject: string, html: string): Promise<boolean>` — 通过 Resend 发送单封邮件
  - `notifyAdminNewOrder(env, order): Promise<void>` — 通知管理员有新订单
  - `notifyUserOrderApproved(env, order): Promise<void>` — 通知用户订单通过
  - `notifyUserOrderRejected(env, order, reason): Promise<void>` — 通知用户订单拒绝
- Consumes: 无

- [ ] **Step 1: 创建 worker/email.ts**

创建文件，内容：

```typescript
/**
 * Resend 邮件发送工具
 * 官方文档：https://resend.com/docs/api-reference/emails/send-email
 *
 * 使用免费额度：3000 封/月，用 `onboarding@resend.dev` 发件
 * 未配置 API Key 时降级为不发邮件（返回 false）
 */

export async function sendEmail(
  apiKey: string,
  to: string,
  subject: string,
  html: string,
  from: string = 'Shuiyinxiangji <onboarding@resend.dev>'
): Promise<boolean> {
  if (!apiKey || !to) return false;
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!resp.ok) {
      console.log('[email] resend error', resp.status, await resp.text());
      return false;
    }
    return true;
  } catch (e) {
    console.log('[email] fetch error', String(e));
    return false;
  }
}

interface OrderInfo {
  order_id: string;
  amount: number;
  type: string;
  phone: string;
  user_email?: string | null;
}

async function readEmailConfig(env: any): Promise<{ apiKey: string; adminEmail: string }> {
  // env 优先
  const envKey = env.RESEND_API_KEY;
  const envAdmin = env.ADMIN_EMAIL;
  if (envKey || envAdmin) {
    return { apiKey: envKey || '', adminEmail: envAdmin || '' };
  }
  // 否则从 settings 读
  const row = await env.DB.prepare('SELECT resend_api_key, admin_email FROM settings WHERE id = 1').first();
  return {
    apiKey: String(row?.resend_api_key || ''),
    adminEmail: String(row?.admin_email || ''),
  };
}

export async function notifyAdminNewOrder(env: any, order: OrderInfo): Promise<void> {
  const { apiKey, adminEmail } = await readEmailConfig(env);
  if (!apiKey || !adminEmail) return;
  const html = `
    <p>你有一笔新的待审核订单：</p>
    <ul>
      <li>订单号：<strong>${order.order_id}</strong></li>
      <li>金额：¥${order.amount}</li>
      <li>类型：${order.type === 'monthly' ? '月度会员' : '单次付费'}</li>
      <li>用户手机：${order.phone}</li>
    </ul>
    <p>请登录管理后台审核：<a href="https://shuiyinxiangji.pages.dev/admin">进入后台</a></p>
  `;
  await sendEmail(apiKey, adminEmail, `[水印相机] 新订单待审核：${order.order_id}`, html);
}

export async function notifyUserOrderApproved(env: any, order: OrderInfo): Promise<void> {
  if (!order.user_email) return;
  const { apiKey } = await readEmailConfig(env);
  if (!apiKey) return;
  const html = `
    <p>您的订单已审核通过，VIP 会员已激活！</p>
    <ul>
      <li>订单号：${order.order_id}</li>
      <li>金额：¥${order.amount}</li>
    </ul>
    <p>登录查看：<a href="https://shuiyinxiangji.pages.dev/my">个人中心</a></p>
  `;
  await sendEmail(apiKey, order.user_email, '[水印相机] 会员已激活', html);
}

export async function notifyUserOrderRejected(env: any, order: OrderInfo, reason: string): Promise<void> {
  if (!order.user_email) return;
  const { apiKey } = await readEmailConfig(env);
  if (!apiKey) return;
  const html = `
    <p>很抱歉，您的订单审核未通过：</p>
    <ul>
      <li>订单号：${order.order_id}</li>
      <li>金额：¥${order.amount}</li>
      <li>原因：${reason}</li>
    </ul>
    <p>如有疑问，请重新支付或联系客服。</p>
  `;
  await sendEmail(apiKey, order.user_email, '[水印相机] 订单审核未通过', html);
}
```

- [ ] **Step 2: 提交**

```bash
cd C:/Users/HUAWEI/shuiyinxiangji
git add worker/email.ts
git commit -m "feat: 添加 Resend 邮件通知工具

- sendEmail(apiKey, to, subject, html)：基础发件函数
- notifyAdminNewOrder：新订单通知管理员
- notifyUserOrderApproved：审核通过通知用户
- notifyUserOrderRejected：审核拒绝通知用户
- 支持 env 或 D1 settings 表读取 API Key
- 未配置时降级为不发邮件

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: 后端 - 订单业务逻辑辅助 + 3 个用户接口

**Files:**
- Create: `worker/orders.ts`
- Modify: `worker/index.ts`

**Interfaces:**
- Consumes: `worker/email.ts`
- Produces:
  - `POST /api/orders/create` — 创建订单
  - `POST /api/orders/:id/upload-proof` — 上传截图
  - `GET /api/orders/:id/status` — 查询状态

- [ ] **Step 1: 创建 worker/orders.ts**

```typescript
/**
 * 订单相关工具函数
 */

export function generateOrderId(): string {
  const now = new Date();
  const YY = String(now.getFullYear() % 100).padStart(2, '0');
  const MM = String(now.getMonth() + 1).padStart(2, '0');
  const DD = String(now.getDate()).padStart(2, '0');
  const HH = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let rand = '';
  for (let i = 0; i < 4; i++) rand += chars.charAt(Math.floor(Math.random() * chars.length));
  return `SYX${YY}${MM}${DD}${HH}${mm}${rand}`;
}

export function validateBase64Image(data: string): { ok: boolean; error?: string } {
  if (!data.startsWith('data:image/')) {
    return { ok: false, error: '仅支持图片格式' };
  }
  // Base64 长度粗略估算（每字节 4/3 → 1 MB 大约 1.4M 字符）
  const sizeBytes = (data.length * 3) / 4;
  if (sizeBytes > 900 * 1024) {
    return { ok: false, error: '图片过大，请压缩后重传（当前接近 1MB 限制）' };
  }
  return { ok: true };
}

export function orderTitle(type: string): string {
  return type === 'monthly' ? '水印相机 - 月度会员' : '水印相机 - 单次付费';
}
```

- [ ] **Step 2: 修改 worker/index.ts**

先在文件顶部（import 区）加入：

```typescript
import { generateOrderId, validateBase64Image, orderTitle } from './orders';
import { notifyAdminNewOrder, notifyUserOrderApproved, notifyUserOrderRejected } from './email';
```

在 Bindings 类型中加入 optional 的字段：

```typescript
type Bindings = {
  DB: D1Database;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
  RESEND_API_KEY?: string;
  ADMIN_EMAIL?: string;
};
```

- [ ] **Step 3: 添加 POST /api/orders/create**

在 `app.post('/api/payments', ...)` 之前添加：

```typescript
app.post('/api/orders/create', async (c) => {
  const body = await c.req.json();
  const { type, phone, email } = body;
  if (!phone || !type) return c.json({ success: false, error: '缺少 phone 或 type' }, 400);
  if (type !== 'single' && type !== 'monthly') {
    return c.json({ success: false, error: '无效的套餐类型' }, 400);
  }

  const db = c.env.DB;
  const user = await db.prepare('SELECT * FROM users WHERE phone = ?').bind(phone).first();
  if (!user) return c.json({ success: false, error: '用户不存在' }, 404);

  const settings = await db.prepare('SELECT single_price, monthly_price, wechat_qr_url FROM settings WHERE id = 1').first();
  const singlePrice = Number(settings?.single_price ?? 1.99);
  const monthlyPrice = Number(settings?.monthly_price ?? 9.90);
  const amount = type === 'single' ? singlePrice : monthlyPrice;
  const qrUrl = String(settings?.wechat_qr_url || '/wechat-pay-qr.png');

  const orderId = generateOrderId();
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO payments (id, order_id, provider, type, amount, timestamp, status, phone, user_email)
       VALUES (?, ?, 'manual', ?, ?, ?, 'created', ?, ?)`
    )
    .bind(orderId, orderId, type, amount, now, phone, email || null)
    .run();

  return c.json({
    success: true,
    order_id: orderId,
    amount,
    title: orderTitle(type),
    qr_url: qrUrl,
    instructions: `请扫码支付 ¥${amount.toFixed(2)}，付款时请在备注中填写订单号：${orderId}`,
  });
});
```

- [ ] **Step 4: 添加 POST /api/orders/:id/upload-proof**

```typescript
app.post('/api/orders/:id/upload-proof', async (c) => {
  const orderId = c.req.param('id');
  const body = await c.req.json();
  const proof = String(body.proof_base64 || '');

  const validation = validateBase64Image(proof);
  if (!validation.ok) {
    return c.json({ success: false, error: validation.error }, 400);
  }

  const db = c.env.DB;
  const order = await db.prepare('SELECT * FROM payments WHERE order_id = ?').bind(orderId).first();
  if (!order) return c.json({ success: false, error: '订单不存在' }, 404);
  if (order.status !== 'created' && order.status !== 'pending_review') {
    return c.json({ success: false, error: `订单当前状态不允许上传：${order.status}` }, 400);
  }

  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE payments SET status = 'pending_review', raw_notify = ?, proof_uploaded_at = ? WHERE order_id = ?`
    )
    .bind(proof, now, orderId)
    .run();

  // 发邮件通知管理员（不阻塞响应）
  c.executionCtx.waitUntil(
    notifyAdminNewOrder(c.env, {
      order_id: String(order.order_id),
      amount: Number(order.amount),
      type: String(order.type),
      phone: String(order.phone),
    })
  );

  return c.json({ success: true, status: 'pending_review' });
});
```

- [ ] **Step 5: 添加 GET /api/orders/:id/status**

```typescript
app.get('/api/orders/:id/status', async (c) => {
  const orderId = c.req.param('id');
  const order = await c.env.DB
    .prepare('SELECT order_id, status, reject_reason, paid_at, type, amount FROM payments WHERE order_id = ?')
    .bind(orderId)
    .first();
  if (!order) return c.json({ success: false, error: '订单不存在' }, 404);
  return c.json({
    success: true,
    order_id: order.order_id,
    status: order.status,
    reject_reason: order.reject_reason,
    paid_at: order.paid_at,
    type: order.type,
    amount: order.amount,
  });
});
```

- [ ] **Step 6: 部署 Worker**

```bash
cd C:/Users/HUAWEI/shuiyinxiangji
export CLOUDFLARE_API_TOKEN=cfut_2THcmsqZyrkslgy0snrXyl5ymldc4ga2QOZwWU7ce0db80ee
./node_modules/.bin/wrangler deploy 2>&1 | tail -5
```

Expected: `Deployed shuiyinxiangji-api triggers`。

- [ ] **Step 7: 提交**

```bash
cd C:/Users/HUAWEI/shuiyinxiangji
git add worker/orders.ts worker/index.ts
git commit -m "feat: 后端 3 个用户订单接口

- POST /api/orders/create: 创建订单，返回收款码 URL + 说明
- POST /api/orders/:id/upload-proof: 上传截图 base64，状态改 pending_review，异步邮件通知管理员
- GET /api/orders/:id/status: 前端轮询查订单状态
- worker/orders.ts: 订单号生成、base64 校验、标题辅助

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: 后端 - 4 个管理员审核接口

**Files:**
- Modify: `worker/index.ts`

**Interfaces:**
- Consumes: `worker/email.ts`（notifyUserOrderApproved/Rejected）
- Produces:
  - `GET /api/admin/orders/pending` — 待审核订单列表（含截图）
  - `GET /api/admin/orders/pending-count` — 待审核数量
  - `POST /api/admin/orders/:id/approve` — 通过审核
  - `POST /api/admin/orders/:id/reject` — 拒绝审核

- [ ] **Step 1: 添加 GET /api/admin/orders/pending**

放在现有 `app.get('/api/admin/payments'...)` 之后：

```typescript
app.get('/api/admin/orders/pending', async (c) => {
  const result = await c.env.DB
    .prepare(
      `SELECT order_id, phone, type, amount, timestamp, proof_uploaded_at, raw_notify, user_email
       FROM payments WHERE status = 'pending_review'
       ORDER BY proof_uploaded_at DESC`
    )
    .all();
  const orders = (result.results || []).map((r: any) => ({
    order_id: r.order_id,
    phone: r.phone,
    type: r.type,
    amount: r.amount,
    timestamp: r.timestamp,
    proof_uploaded_at: r.proof_uploaded_at,
    proof_base64: r.raw_notify,
    user_email: r.user_email,
  }));
  return c.json({ orders });
});
```

- [ ] **Step 2: 添加 GET /api/admin/orders/pending-count**

```typescript
app.get('/api/admin/orders/pending-count', async (c) => {
  const row = await c.env.DB
    .prepare(`SELECT COUNT(*) as cnt FROM payments WHERE status = 'pending_review'`)
    .first();
  return c.json({ count: Number(row?.cnt || 0) });
});
```

- [ ] **Step 3: 添加 POST /api/admin/orders/:id/approve**

```typescript
app.post('/api/admin/orders/:id/approve', async (c) => {
  const orderId = c.req.param('id');
  const db = c.env.DB;
  const order = await db.prepare('SELECT * FROM payments WHERE order_id = ?').bind(orderId).first();
  if (!order) return c.json({ success: false, error: '订单不存在' }, 404);
  if (order.status !== 'pending_review') {
    return c.json({ success: false, error: `订单当前状态不允许审核：${order.status}` }, 400);
  }

  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE payments SET status = 'success', paid_at = ?, reviewed_at = ?, reviewed_by = 'admin' WHERE order_id = ?`
    )
    .bind(now, now, orderId)
    .run();

  // 激活 VIP（monthly）
  if (order.type === 'monthly' && order.phone) {
    const user = await db.prepare('SELECT * FROM users WHERE phone = ?').bind(order.phone).first();
    if (user) {
      const currentExpiry = user.vip_expires_at ? new Date(user.vip_expires_at as string).getTime() : Date.now();
      const newExpiry = new Date(Math.max(currentExpiry, Date.now()) + 30 * 24 * 60 * 60 * 1000).toISOString();
      await db
        .prepare('UPDATE users SET is_vip = 1, vip_expires_at = ? WHERE phone = ?')
        .bind(newExpiry, order.phone)
        .run();
    }
  }

  c.executionCtx.waitUntil(
    notifyUserOrderApproved(c.env, {
      order_id: String(order.order_id),
      amount: Number(order.amount),
      type: String(order.type),
      phone: String(order.phone),
      user_email: order.user_email as string | null,
    })
  );

  return c.json({ success: true });
});
```

- [ ] **Step 4: 添加 POST /api/admin/orders/:id/reject**

```typescript
app.post('/api/admin/orders/:id/reject', async (c) => {
  const orderId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const reason = String(body.reason || '未提供原因');

  const db = c.env.DB;
  const order = await db.prepare('SELECT * FROM payments WHERE order_id = ?').bind(orderId).first();
  if (!order) return c.json({ success: false, error: '订单不存在' }, 404);
  if (order.status !== 'pending_review') {
    return c.json({ success: false, error: `订单当前状态不允许审核：${order.status}` }, 400);
  }

  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE payments SET status = 'rejected', reject_reason = ?, reviewed_at = ?, reviewed_by = 'admin' WHERE order_id = ?`
    )
    .bind(reason, now, orderId)
    .run();

  c.executionCtx.waitUntil(
    notifyUserOrderRejected(
      c.env,
      {
        order_id: String(order.order_id),
        amount: Number(order.amount),
        type: String(order.type),
        phone: String(order.phone),
        user_email: order.user_email as string | null,
      },
      reason
    )
  );

  return c.json({ success: true });
});
```

- [ ] **Step 5: 部署**

```bash
cd C:/Users/HUAWEI/shuiyinxiangji
export CLOUDFLARE_API_TOKEN=cfut_2THcmsqZyrkslgy0snrXyl5ymldc4ga2QOZwWU7ce0db80ee
./node_modules/.bin/wrangler deploy 2>&1 | tail -5
```

- [ ] **Step 6: 提交**

```bash
cd C:/Users/HUAWEI/shuiyinxiangji
git add worker/index.ts
git commit -m "feat: 后端 4 个管理员审核接口

- GET /api/admin/orders/pending: 获取待审核列表（含截图 base64）
- GET /api/admin/orders/pending-count: 待审核数量（前端红点用）
- POST /api/admin/orders/:id/approve: 通过审核 + 激活 VIP + 邮件通知用户
- POST /api/admin/orders/:id/reject: 拒绝审核（附原因）+ 邮件通知用户

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: 前端 - Pricing 页面改造 + 图片压缩工具

**Files:**
- Create: `src/lib/imageCompress.ts`
- Modify: `src/pages/Pricing.tsx`

**Interfaces:**
- Produces:
  - `compressImage(file: File, maxSize?: number, quality?: number): Promise<string>` — 返回压缩后 base64
- Consumes: `/api/orders/create` 接口

- [ ] **Step 1: 创建 src/lib/imageCompress.ts**

```typescript
/**
 * 用 Canvas 压缩图片，返回 base64 dataURL
 *
 * @param file 输入图片文件
 * @param maxSize 长边最大像素（默认 800）
 * @param quality JPEG 质量 0-1（默认 0.75）
 */
export async function compressImage(
  file: File,
  maxSize: number = 800,
  quality: number = 0.75
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        } else if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('无法创建 canvas'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}
```

- [ ] **Step 2: 改造 src/pages/Pricing.tsx**

在文件里，把整个 `handlePayment` 函数体（约第 52-79 行）替换为：

```typescript
const handlePayment = async () => {
  if (!user) {
    navigate('/login');
    return;
  }
  setIsProcessing(true);
  try {
    const data = await apiPost('/api/orders/create', {
      type: selectedPlan,
      phone: user.phone,
    });
    if (!data.success || !data.order_id) {
      alert(data.error || '创建订单失败');
      setIsProcessing(false);
      return;
    }
    // 跳转到付款等待页
    navigate(`/payment/pending?order_id=${data.order_id}`);
  } catch (e) {
    console.error('创建订单失败', e);
    alert('网络错误，请稍后重试');
    setIsProcessing(false);
  }
};
```

同时**删除**旧的两块模拟支付 JSX：找到并删除 `{showQr && !paymentSuccess && (...)}` 和 `{paymentSuccess && (...)}` 两大块（约 177-204 行）。

并且**删除 state 声明**（约 24-25 行）：
```typescript
const [showQr, setShowQr] = useState(false);
const [paymentSuccess, setPaymentSuccess] = useState(false);
```

保留 `isProcessing` state。

顶部 import 也精简（`Zap`, `Clock` 不再用）：
```typescript
import { Check, Crown, CreditCard } from 'lucide-react';
```

- [ ] **Step 3: 本地构建验证**

```bash
cd C:/Users/HUAWEI/shuiyinxiangji
npm run build 2>&1 | tail -8
```

Expected: `✓ built in ...s`（无 TS 错误）。

- [ ] **Step 4: 提交**

```bash
cd C:/Users/HUAWEI/shuiyinxiangji
git add src/lib/imageCompress.ts src/pages/Pricing.tsx
git commit -m "feat: 前端 Pricing 改造 - 调用创建订单接口 + 图片压缩工具

- Pricing 点购买后调用 POST /api/orders/create，跳转 /payment/pending
- 删除旧的模拟支付弹窗和 state
- 新增 src/lib/imageCompress.ts：Canvas 压缩截图工具

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: 前端 - PaymentPending 页面 + 路由

**Files:**
- Create: `src/pages/PaymentPending.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `/api/orders/:id/status`, `/api/orders/:id/upload-proof`, `compressImage`
- Produces: 路由 `/payment/pending?order_id=...`

- [ ] **Step 1: 创建 PaymentPending.tsx**

```typescript
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Clock, XCircle, Upload, Copy } from 'lucide-react';
import { apiGet, apiPost } from '../lib/api';
import { compressImage } from '../lib/imageCompress';
import { useAuth } from '../contexts/AuthContext';

type Status = 'created' | 'pending_review' | 'success' | 'rejected';

interface OrderInfo {
  order_id: string;
  amount: number;
  title: string;
  qr_url: string;
  instructions: string;
}

export default function PaymentPending() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();

  const orderId = searchParams.get('order_id') || '';
  const [status, setStatus] = useState<Status>('created');
  const [rejectReason, setRejectReason] = useState<string>('');
  const [orderInfo, setOrderInfo] = useState<OrderInfo | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number | null>(null);

  // 初次加载：拿到订单基本信息（从 localStorage 或再调 API）
  useEffect(() => {
    if (!orderId) {
      setError('缺少订单号');
      return;
    }
    // 先尝试从 localStorage 恢复
    const cached = localStorage.getItem(`order_info_${orderId}`);
    if (cached) {
      try {
        setOrderInfo(JSON.parse(cached));
      } catch {
        // ignore
      }
    }
    fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  // 轮询：pending_review 状态时每 15 秒查一次
  useEffect(() => {
    if (status !== 'pending_review') return;
    timerRef.current = window.setInterval(() => {
      fetchStatus();
    }, 15000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // success 时刷新 user 并跳转
  useEffect(() => {
    if (status === 'success') {
      refreshUser();
      const t = window.setTimeout(() => navigate('/my'), 3000);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function fetchStatus() {
    try {
      const data = await apiGet(`/api/orders/${encodeURIComponent(orderId)}/status`);
      if (data.success) {
        setStatus(data.status as Status);
        if (data.reject_reason) setRejectReason(data.reject_reason);
        // 补齐 orderInfo（如果 localStorage 没有）
        if (!orderInfo && data.amount) {
          setOrderInfo({
            order_id: data.order_id,
            amount: data.amount,
            title: data.type === 'monthly' ? '水印相机 - 月度会员' : '水印相机 - 单次付费',
            qr_url: '/wechat-pay-qr.png',
            instructions: `请扫码支付 ¥${data.amount.toFixed(2)}，付款时请在备注中填写订单号：${data.order_id}`,
          });
        }
      }
    } catch (e) {
      console.error('查询订单状态失败', e);
    }
  }

  async function handleFileChoose(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const base64 = await compressImage(file, 800, 0.75);
      const data = await apiPost(`/api/orders/${encodeURIComponent(orderId)}/upload-proof`, {
        proof_base64: base64,
      });
      if (data.success) {
        setStatus('pending_review');
      } else {
        setError(data.error || '上传失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function copyOrderId() {
    navigator.clipboard.writeText(orderId).then(
      () => alert('订单号已复制'),
      () => alert('复制失败，请手动选择')
    );
  }

  if (!orderId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-gray-200 text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <p className="text-gray-700 mb-4">订单信息缺失</p>
          <button
            onClick={() => navigate('/pricing')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            返回选择套餐
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-md mx-auto bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
        {status === 'created' && (
          <>
            <h1 className="text-xl font-bold text-gray-900 text-center mb-2">扫码支付</h1>
            <p className="text-center text-gray-500 mb-6">用微信扫下方二维码完成支付</p>
            <div className="bg-gray-50 rounded-lg p-6 text-center mb-6">
              <img
                src={orderInfo?.qr_url || '/wechat-pay-qr.png'}
                alt="收款码"
                className="w-full max-w-xs mx-auto rounded-lg"
              />
              <p className="mt-4 text-2xl font-bold text-red-600">
                ¥ {orderInfo?.amount?.toFixed(2) || '...'}
              </p>
              <p className="text-sm text-gray-600 mt-1">{orderInfo?.title || '会员'}</p>
            </div>

            <div className="bg-yellow-50 rounded-lg p-4 mb-6 border border-yellow-200">
              <p className="text-sm text-yellow-900 mb-2">
                <strong>⚠️ 重要：</strong>付款时请在<strong>备注</strong>栏填写以下订单号：
              </p>
              <div className="flex items-center bg-white rounded p-2 border">
                <code className="flex-1 text-sm break-all">{orderId}</code>
                <button
                  onClick={copyOrderId}
                  className="ml-2 flex items-center text-blue-600 text-sm px-2 py-1 rounded hover:bg-blue-50"
                >
                  <Copy className="w-4 h-4 mr-1" /> 复制
                </button>
              </div>
            </div>

            <div className="border-t pt-6">
              <p className="text-center text-sm text-gray-600 mb-3">支付完成后，上传截图以便审核</p>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileChoose}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
              >
                <Upload className="w-5 h-5 mr-2" />
                {uploading ? '上传中...' : '上传付款截图'}
              </button>
              {error && <p className="text-red-500 text-sm mt-2 text-center">{error}</p>}
            </div>
          </>
        )}

        {status === 'pending_review' && (
          <div className="text-center py-8">
            <Clock className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-pulse" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">审核中</h1>
            <p className="text-gray-600 mb-2">通常几分钟内完成，最长 24 小时</p>
            <p className="text-sm text-gray-400 mt-4 break-all">订单号：{orderId}</p>
            <button
              onClick={() => navigate('/my')}
              className="mt-6 text-sm text-blue-600 hover:underline"
            >
              先返回个人中心，稍后再看
            </button>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-500" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">支付成功！</h1>
            <p className="text-gray-500">VIP 已激活，即将跳转...</p>
          </div>
        )}

        {status === 'rejected' && (
          <div className="text-center py-8">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">审核未通过</h1>
            <p className="text-gray-600 mb-4">{rejectReason || '请重新支付或联系客服'}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => navigate('/pricing')}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                重新购买
              </button>
              <button
                onClick={() => navigate('/my')}
                className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50"
              >
                个人中心
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 修改 App.tsx 增加路由**

在 import 部分加：
```typescript
import PaymentPending from './pages/PaymentPending';
```

在 `<Routes>` 中，`<Route path="/admin" ... />` 之前加：
```typescript
<Route path="/payment/pending" element={<PaymentPending />} />
```

- [ ] **Step 3: 添加占位收款码图片**

创建一个 placeholder 文件，稍后 Task 8 时用户替换成真实图片：

```bash
# 用户已经提供了微信收款码图片，这里先建一个占位提醒
cat > public/wechat-pay-qr.png.PLACEHOLDER.md <<'EOF'
用户请把微信收款码图片重命名为 wechat-pay-qr.png 放到本目录。
EOF
```

- [ ] **Step 4: 本地构建**

```bash
cd C:/Users/HUAWEI/shuiyinxiangji
npm run build 2>&1 | tail -8
```

Expected: `✓ built in`

- [ ] **Step 5: 提交**

```bash
cd C:/Users/HUAWEI/shuiyinxiangji
git add src/pages/PaymentPending.tsx src/App.tsx public/wechat-pay-qr.png.PLACEHOLDER.md
git commit -m "feat: 前端 PaymentPending 页面 + 路由

- /payment/pending 页面 4 种状态：
  - created: 显示收款码 + 订单号 + 上传按钮
  - pending_review: 审核中，15s 轮询
  - success: 支付成功，3s 跳转 /my
  - rejected: 显示拒绝原因，提供重新购买入口
- 前端用 imageCompress 工具把截图压到 <500KB
- 支持一键复制订单号

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: 前端 - 管理后台"支付审核"tab

**Files:**
- Modify: `src/pages/Admin.tsx`

**Interfaces:**
- Consumes:
  - `/api/admin/orders/pending`
  - `/api/admin/orders/pending-count`
  - `/api/admin/orders/:id/approve`
  - `/api/admin/orders/:id/reject`

- [ ] **Step 1: 修改 src/pages/Admin.tsx**

**a. import 区加入图标：**

在 lucide-react 的 import 里加 `Check`, `XCircle`, `Image`（如果已有跳过）：

```typescript
import { Users, CreditCard, TrendingUp, Settings, DollarSign, UserPlus, Calendar, Edit2, Check, XCircle, Image as ImageIcon } from 'lucide-react';
```

**b. 新增 state：**

在其他 state 声明附近（如 `const [loading, setLoading]` 之前）添加：

```typescript
const [pendingOrders, setPendingOrders] = useState<any[]>([]);
const [pendingCount, setPendingCount] = useState<number>(0);
const [reviewLoading, setReviewLoading] = useState<string | null>(null);
const [enlargedImg, setEnlargedImg] = useState<string | null>(null);
```

并把 `activeTab` 的类型加上 `'review'`：
```typescript
const [activeTab, setActiveTab] = useState<'dashboard' | 'review' | 'users' | 'payments' | 'settings'>('dashboard');
```

**c. loadData 里加载待审核订单：**

在 `loadData` 函数中，`Promise.all` 的数组末尾加两项：

```typescript
const [statsRes, usersRes, paymentsRes, settingsRes, pendingRes, countRes] = await Promise.all([
  apiGet('/api/admin/stats'),
  apiGet('/api/admin/users'),
  apiGet('/api/admin/payments'),
  apiGet('/api/settings'),
  apiGet('/api/admin/orders/pending'),
  apiGet('/api/admin/orders/pending-count'),
]);
setStats(statsRes);
setUsers(usersRes.users);
setPayments(paymentsRes.payments);
setSettings(settingsRes);
setPendingOrders(pendingRes.orders || []);
setPendingCount(countRes.count || 0);
```

**d. tabs 数组加"支付审核"：**

找到 `const tabs = [...]`，改为：

```typescript
const tabs = [
  { id: 'dashboard', label: '仪表盘', icon: TrendingUp },
  { id: 'review', label: '支付审核', icon: Check, badge: pendingCount },
  { id: 'users', label: '用户管理', icon: Users },
  { id: 'payments', label: '支付记录', icon: CreditCard },
  { id: 'settings', label: '系统设置', icon: Settings },
];
```

**e. tabs 渲染代码加上红点显示：**

找到 tabs 的 `.map` 渲染，改为：

```typescript
{tabs.map((tab) => (
  <button
    key={tab.id}
    onClick={() => setActiveTab(tab.id as any)}
    className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors relative ${
      activeTab === tab.id
        ? 'bg-blue-50 text-blue-600'
        : 'text-gray-600 hover:text-gray-900'
    }`}
  >
    <tab.icon className="w-4 h-4" />
    <span>{tab.label}</span>
    {tab.badge !== undefined && tab.badge > 0 && (
      <span className="ml-1 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
        {tab.badge}
      </span>
    )}
  </button>
))}
```

**f. 添加审核 tab 内容：**

在 `{activeTab === 'dashboard' && ...}` 之后、`{activeTab === 'users' && ...}` 之前添加：

```typescript
{activeTab === 'review' && (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <h3 className="text-lg font-semibold text-gray-900">待审核订单（{pendingOrders.length}）</h3>
      <button
        onClick={loadData}
        className="text-sm text-blue-600 hover:underline"
      >
        刷新
      </button>
    </div>
    {pendingOrders.length === 0 ? (
      <div className="bg-white rounded-xl p-12 border border-gray-200 text-center text-gray-500">
        暂无待审核订单
      </div>
    ) : (
      pendingOrders.map((order) => (
        <div key={order.order_id} className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-1">订单号</p>
                <code className="text-sm bg-gray-100 px-2 py-1 rounded">{order.order_id}</code>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">金额</p>
                  <p className="font-semibold text-green-600">¥{order.amount}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">类型</p>
                  <p>{order.type === 'monthly' ? '月度会员' : '单次付费'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">手机号</p>
                  <p>{order.phone}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">上传时间</p>
                  <p className="text-sm">{new Date(order.proof_uploaded_at).toLocaleString('zh-CN')}</p>
                </div>
              </div>
              {order.user_email && (
                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-1">用户邮箱</p>
                  <p className="text-sm">{order.user_email}</p>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  disabled={reviewLoading === order.order_id}
                  onClick={async () => {
                    if (!confirm(`确定通过订单 ${order.order_id}？`)) return;
                    setReviewLoading(order.order_id);
                    try {
                      const r = await apiPost(`/api/admin/orders/${order.order_id}/approve`);
                      if (r.success) {
                        await loadData();
                      } else {
                        alert(r.error || '操作失败');
                      }
                    } finally {
                      setReviewLoading(null);
                    }
                  }}
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center"
                >
                  <Check className="w-4 h-4 mr-1" /> 通过
                </button>
                <button
                  disabled={reviewLoading === order.order_id}
                  onClick={async () => {
                    const reason = prompt('请填写拒绝原因：');
                    if (!reason) return;
                    setReviewLoading(order.order_id);
                    try {
                      const r = await apiPost(`/api/admin/orders/${order.order_id}/reject`, { reason });
                      if (r.success) {
                        await loadData();
                      } else {
                        alert(r.error || '操作失败');
                      }
                    } finally {
                      setReviewLoading(null);
                    }
                  }}
                  className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center"
                >
                  <XCircle className="w-4 h-4 mr-1" /> 拒绝
                </button>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-2">付款截图</p>
              {order.proof_base64 ? (
                <img
                  src={order.proof_base64}
                  alt="付款截图"
                  className="w-full rounded-lg border cursor-pointer hover:opacity-90"
                  onClick={() => setEnlargedImg(order.proof_base64)}
                />
              ) : (
                <div className="bg-gray-100 rounded-lg p-8 text-center text-gray-400">
                  <ImageIcon className="w-8 h-8 mx-auto" /> 无截图
                </div>
              )}
            </div>
          </div>
        </div>
      ))
    )}

    {enlargedImg && (
      <div
        className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4"
        onClick={() => setEnlargedImg(null)}
      >
        <img src={enlargedImg} alt="放大" className="max-w-full max-h-full rounded" />
      </div>
    )}
  </div>
)}
```

- [ ] **Step 2: 本地构建**

```bash
cd C:/Users/HUAWEI/shuiyinxiangji
npm run build 2>&1 | tail -8
```

Expected: `✓ built in`

- [ ] **Step 3: 提交**

```bash
cd C:/Users/HUAWEI/shuiyinxiangji
git add src/pages/Admin.tsx
git commit -m "feat: 管理后台增加'支付审核'tab

- 新增 review tab，显示待审核订单卡片
- Tab 上带红点显示待审核数量
- 每张订单卡片：订单号、金额、类型、手机、邮箱、截图缩略图
- 点击截图放大预览
- 一键'通过'/'拒绝'（拒绝需填原因）

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 8: 部署 + 配置 Resend + 上传收款码

**Files:**
- Add: `public/wechat-pay-qr.png`（用户上传）
- Remove: `public/wechat-pay-qr.png.PLACEHOLDER.md`

**Interfaces:**
- 依赖 Task 1-7 完成

- [ ] **Step 1: 用户放入收款码图片**

**你（用户）需要做：**
1. 把之前发的微信收款码图片保存为 PNG
2. 重命名为 `wechat-pay-qr.png`
3. 放到 `C:/Users/HUAWEI/shuiyinxiangji/public/wechat-pay-qr.png`
4. 删除 placeholder 文件：`rm public/wechat-pay-qr.png.PLACEHOLDER.md`

**如果无法完成这步**：先跳过，后续在生产用管理员后台的"系统设置"上传（未来功能，本版还没做）。

- [ ] **Step 2: 部署前端 Pages**

```bash
cd C:/Users/HUAWEI/shuiyinxiangji
export CLOUDFLARE_API_TOKEN=cfut_2THcmsqZyrkslgy0snrXyl5ymldc4ga2QOZwWU7ce0db80ee
npm run build && ./node_modules/.bin/wrangler pages deploy dist --project-name=shuiyinxiangji --commit-dirty=true 2>&1 | tail -5
```

Expected: `✨ Deployment complete!`

- [ ] **Step 3:（可选）配置 Resend 邮件**

**你（用户）需要做（如果想启用邮件）：**
1. 去 https://resend.com 注册（免费）
2. 邮箱验证后，到 API Keys 页面创建一个 Key
3. 复制 Key（形如 `re_xxxxxxxxxxxx`）

然后：
```bash
cd C:/Users/HUAWEI/shuiyinxiangji
export CLOUDFLARE_API_TOKEN=cfut_2THcmsqZyrkslgy0snrXyl5ymldc4ga2QOZwWU7ce0db80ee
# 设置 API Key
echo "<你的 Resend API Key>" | ./node_modules/.bin/wrangler secret put RESEND_API_KEY
# 设置管理员邮箱（你想接收通知的邮箱，必须是你在 Resend 注册的邮箱本人）
echo "<你的邮箱>" | ./node_modules/.bin/wrangler secret put ADMIN_EMAIL
# 重新部署
./node_modules/.bin/wrangler deploy 2>&1 | tail -3
```

**跳过此步：** 邮件功能就不启用，但系统正常运行（管理员进后台看红点即可）。

- [ ] **Step 4: 端到端测试**

**测试用例：**

1. 手机浏览器打开 `https://shuiyinxiangji.pages.dev`
2. 用手机号登录（如 13800138123）
3. 点击"升级 VIP" → 进 `/pricing`
4. 选月度会员 → 点"立即购买"
5. 跳转到 `/payment/pending` → 显示收款码 + 订单号
6. 长按订单号 → 复制
7. 微信扫收款码 → 输入 ¥9.9 → 备注粘贴订单号 → 完成支付
8. 回到网站点"上传付款截图" → 选图 → 上传成功
9. 页面变为"审核中"
10. **邮件测试**（如已配置）：管理员邮箱应收到通知
11. 用 admin/VIP1337 登录 → 进 `/admin`
12. 顶部 tab 应看到"支付审核 (1)" 带红点
13. 点进 tab → 看到订单卡片 + 截图 → 点"通过"
14. 用户端 `/payment/pending` 15 秒内变成"支付成功"
15. 3 秒后跳 `/my` 显示 VIP 已激活

- [ ] **Step 5: 记录测试报告**

创建 `docs/superpowers/notes/2026-07-12-manual-payment-review-e2e.md`：

```markdown
# 半自动截图审核 端到端测试报告

日期：2026-07-12

## 测试结果

| # | 测试用例 | 结果 | 备注 |
|---|---|---|---|
| 1 | 用户下单 | ✅/❌ | |
| 2 | 显示收款码 + 订单号 | ✅/❌ | |
| 3 | 复制订单号 | ✅/❌ | |
| 4 | 上传截图 | ✅/❌ | |
| 5 | 状态变 pending_review | ✅/❌ | |
| 6 | 管理员收邮件通知 | ✅/❌/未配置 | |
| 7 | 管理后台红点显示 | ✅/❌ | |
| 8 | 审核通过 | ✅/❌ | |
| 9 | VIP 激活 | ✅/❌ | |
| 10 | 用户端轮询到 success | ✅/❌ | |

## 遇到的问题

<无 / 描述>

## 结论

<可上线 / 需修复>
```

填完后提交：

```bash
cd C:/Users/HUAWEI/shuiyinxiangji
git add docs/superpowers/notes/2026-07-12-manual-payment-review-e2e.md
# 如果上传了收款码：
git add public/wechat-pay-qr.png
git rm -f public/wechat-pay-qr.png.PLACEHOLDER.md
git commit -m "feat(deploy): 添加收款码，完成半自动审核方案上线

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Self-Review 检查

**1. Spec 覆盖：**
- ✅ 数据库迁移 → Task 1
- ✅ 邮件工具 → Task 2
- ✅ 3 个用户接口 → Task 3
- ✅ 4 个管理员接口 → Task 4
- ✅ 图片压缩 + Pricing 改造 → Task 5
- ✅ PaymentPending 页面 → Task 6
- ✅ 管理后台 review tab + 红点 → Task 7
- ✅ 部署 + Resend 配置 + 收款码 + 测试 → Task 8

**2. 类型一致性：**
- `generateOrderId()` 定义在 Task 3、Task 3 用一致
- `compressImage(file, maxSize, quality)` 定义在 Task 5、Task 6 用一致
- API 路径 `/api/orders/create`, `/api/orders/:id/upload-proof`, `/api/orders/:id/status`, `/api/admin/orders/pending`, `/api/admin/orders/pending-count`, `/api/admin/orders/:id/approve`, `/api/admin/orders/:id/reject` — 前后端一致

**3. 无占位符：**
- 所有 SQL、代码、命令都完整
- 无 "TBD" 或"根据实际情况"

**4. 关键约束：**
- 截图 base64 存 `raw_notify` 字段（Task 3-4 code 里明确）
- provider 字段填 `manual`（Task 3 create 里明确）
- Resend 未配置时降级不发邮件（Task 2 sendEmail 检查 apiKey 空返回 false）
- executionCtx.waitUntil 用于异步邮件发送（不阻塞响应）
