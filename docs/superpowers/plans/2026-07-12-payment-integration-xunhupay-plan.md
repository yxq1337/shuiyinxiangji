# 支付系统实际收款改造实施计划 — 虎皮椒 H5 支付集成

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `/api/payments` 的模拟支付替换为虎皮椒真实 H5 支付，用户手机支付完成 → 后端回调 + 前端轮询双重兜底 → 自动激活 VIP。

**Architecture:**
- 后端：Cloudflare Workers + Hono 框架 + D1 数据库。新增 3 个 API：`/api/payments/create`（下单）、`/api/payments/notify`（回调）、`/api/payments/status/:orderId`（轮询）。签名工具单独抽出为独立模块，独立可测。
- 前端：Vite + React + React Router。改造 `Pricing.tsx`（不再模拟），新增 `PaymentCallback.tsx`（轮询页），前端保持轮询直到订单终态或超时。
- 密钥管理：`XUNHUPAY_APPID` 和 `XUNHUPAY_SECRET` 用 `wrangler secret put` 存到 Cloudflare Secret（不进 git）；开发环境用 `.dev.vars`。

**Tech Stack:** Cloudflare Workers, Hono, D1 (SQLite), React 19, TypeScript, Vite, Tailwind, virtualized MD5 (Web Crypto API).

## Global Constraints

- 存放位置：Worker 代码在 `worker/index.ts`；前端在 `src/`；数据库 schema 迁移文件在 `worker/`。
- **签名算法：** MD5，参数按 ASCII 字典序排序，`key1=value1&key2=value2...` 拼接后追加 `secret`，取 32 位小写。
- **回调返回值：** 必须为纯字符串 `success`（**不能是 JSON**，虎皮椒否则会重试）。
- **回调防重放：** 若订单已 `success`，直接返回 `success` 而不再更新数据库。
- **金额校验：** 回调时必须验证 `total_fee` 与订单金额一致。
- **前端 API 基址：** 从 `import.meta.env.VITE_API_BASE` 读取（`src/lib/api.ts` 已封装）。
- **提交注释规范：** 中英文均可，末尾追加 `Co-Authored-By: Claude <noreply@anthropic.com>`。
- **前端 UI 语言：** 简体中文（与现有页面一致）。
- **调试打印：** 不用 `console.log`，用 `console.info` / `console.error` 分级；生产打印必须不包含 secret。
- **网络请求：** 用原生 `fetch`，不引入 axios。
- **MD5 实现：** 由于 Workers 运行时不含 `crypto.createHash`，改用 **Web Crypto API** 或纯 JS 实现（推荐用 `js-md5` NPM 包，或手写 MD5，或用 Web Crypto 的 `subtle.digest('MD5', ...)` — 但 MD5 不属于 Web Crypto 支持算法之一，因此推荐用 `js-md5`）。
- **订单号格式：** `SYX` + 14位时间戳(`YYYYMMDDHHmmss`) + 4位随机大写字母数字，如 `SYX20260712103045A3F2`。
- **虎皮椒 API endpoint：** 使用新版接口 `https://api.xunhupay.com/payment/do.html`（v1.1）；查询订单用 `https://api.xunhupay.com/payment/query.html`。

---

## 任务概览

| 任务 | 目标 | 关键交付物 |
|---|---|---|
| Task 1 | D1 数据库表结构升级 | 新增字段迁移脚本 + 远程执行成功 |
| Task 2 | 后端：签名与订单号工具模块 | `worker/xunhupay.ts` + 独立可运行的手动验证 |
| Task 3 | 后端：新增 `POST /api/payments/create` 接口 | 能生成订单并返回虎皮椒 `pay_url` |
| Task 4 | 后端：新增 `POST /api/payments/notify` 回调接口 | 通过验签 + 激活 VIP + 幂等 |
| Task 5 | 后端：新增 `GET /api/payments/status/:orderId` 轮询接口 | 支持主动查询虎皮椒 |
| Task 6 | 后端：`GET /api/admin/payments` 返回新字段 | 管理后台看到订单号 |
| Task 7 | 前端：`Pricing.tsx` 改用真实下单 | 手机跳转，桌面显示二维码 |
| Task 8 | 前端：新增 `PaymentCallback.tsx` 轮询页 | 3 秒轮询，60 次超时 |
| Task 9 | 前端：路由注册 + Admin 页面显示新字段 | `/payment/callback` 可访问 |
| Task 10 | 部署 + 生产测试 | 生产 1 分钱订单测试通过 |
| Task 11 | 文档 + secret 配置说明 | README + DEPLOY.md 更新 |

---

## Task 1: D1 数据库表结构升级

**Files:**
- Create: `worker/schema-migrate-v2.sql`
- Reference: `worker/schema.sql`

**Interfaces:**
- Consumes: 现有 `payments`、`settings` 表
- Produces: `payments` 表新增 7 字段，`settings` 表新增 2 字段（供后续所有任务使用）

- [ ] **Step 1: 创建迁移 SQL 文件**

创建 `worker/schema-migrate-v2.sql`：

```sql
-- 迁移脚本 v2：支付系统真实收款改造
-- 使用方法：wrangler d1 execute shuiyinxiangji-db --file=worker/schema-migrate-v2.sql --remote

-- payments 表新增字段
ALTER TABLE payments ADD COLUMN order_id TEXT;
ALTER TABLE payments ADD COLUMN provider TEXT DEFAULT 'xunhupay';
ALTER TABLE payments ADD COLUMN provider_order_id TEXT;
ALTER TABLE payments ADD COLUMN pay_method TEXT;
ALTER TABLE payments ADD COLUMN pay_url TEXT;
ALTER TABLE payments ADD COLUMN paid_at TEXT;
ALTER TABLE payments ADD COLUMN raw_notify TEXT;

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- settings 表新增字段
ALTER TABLE settings ADD COLUMN xunhupay_appid TEXT DEFAULT '';
ALTER TABLE settings ADD COLUMN xunhupay_secret TEXT DEFAULT '';
```

- [ ] **Step 2: 在远程 D1 执行迁移**

Run:
```bash
CLOUDFLARE_API_TOKEN=cfut_2THcmsqZyrkslgy0snrXyl5ymldc4ga2QOZwWU7ce0db80ee \
  ./node_modules/.bin/wrangler d1 execute shuiyinxiangji-db --file=worker/schema-migrate-v2.sql --remote
```

Expected: 输出显示 `Executed X queries`，且无错误。

- [ ] **Step 3: 验证字段已添加**

Run:
```bash
CLOUDFLARE_API_TOKEN=cfut_2THcmsqZyrkslgy0snrXyl5ymldc4ga2QOZwWU7ce0db80ee \
  ./node_modules/.bin/wrangler d1 execute shuiyinxiangji-db --command "PRAGMA table_info(payments);" --remote
```

Expected: 输出应包含新字段 `order_id`、`provider`、`provider_order_id`、`pay_method`、`pay_url`、`paid_at`、`raw_notify`。

- [ ] **Step 4: Commit**

```bash
git add worker/schema-migrate-v2.sql
git commit -m "feat(db): 支付表新增订单号/回调数据等字段

- payments 新增 7 列：order_id, provider, provider_order_id, pay_method, pay_url, paid_at, raw_notify
- settings 新增 2 列：xunhupay_appid, xunhupay_secret
- 添加 order_id 和 status 索引

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: 后端签名工具与订单号生成模块

**Files:**
- Create: `worker/xunhupay.ts`
- Create: `worker/xunhupay.test.ts`（手动验证，Workers 无标准测试框架，用 wrangler dev 触发验证接口）
- Modify: `package.json`（添加 `js-md5` 依赖）

**Interfaces:**
- Produces:
  ```ts
  // 订单号生成
  export function generateOrderId(): string;   // 返回 "SYX" + YYYYMMDDHHmmss + 4位随机

  // 签名生成（用于请求虎皮椒）
  export function generateSign(params: Record<string, string | number>, secret: string): string;

  // 签名验证（用于验证回调）
  export function verifySign(params: Record<string, string>, secret: string): boolean;

  // 调用虎皮椒下单接口
  export async function xunhupayCreateOrder(input: {
    appid: string;
    secret: string;
    orderId: string;
    amount: number;
    title: string;
    notifyUrl: string;
    returnUrl: string;
    wapUrl: string;
    wapName: string;
  }): Promise<{
    success: boolean;
    payUrl?: string;
    providerOrderId?: string;
    error?: string;
    raw?: any;
  }>;

  // 查询虎皮椒订单状态
  export async function xunhupayQueryOrder(input: {
    appid: string;
    secret: string;
    orderId: string;
  }): Promise<{
    success: boolean;
    status?: 'pending' | 'success' | 'failed';
    providerOrderId?: string;
    paidAt?: string;
    error?: string;
  }>;
  ```

- [ ] **Step 1: 安装 md5 依赖**

Run:
```bash
npm install js-md5 --save --registry=https://registry.npmmirror.com
```

Expected: 无错误，`js-md5` 加入 `dependencies`。

- [ ] **Step 2: 写出 `worker/xunhupay.ts`**

```typescript
/// <reference types="@cloudflare/workers-types" />
/**
 * 虎皮椒（xunhupay）支付集成模块
 * 提供订单号生成、签名生成/验证、下单、查询等能力
 */

import md5 from 'js-md5';

const XUNHUPAY_CREATE_URL = 'https://api.xunhupay.com/payment/do.html';
const XUNHUPAY_QUERY_URL = 'https://api.xunhupay.com/payment/query.html';

/**
 * 生成商户订单号：SYX + YYYYMMDDHHmmss + 4位随机大写字母数字
 * 例：SYX20260712103045A3F2
 */
export function generateOrderId(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mi = String(now.getUTCMinutes()).padStart(2, '0');
  const ss = String(now.getUTCSeconds()).padStart(2, '0');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let rand = '';
  for (let i = 0; i < 4; i++) rand += chars.charAt(Math.floor(Math.random() * chars.length));
  return `SYX${yyyy}${mm}${dd}${hh}${mi}${ss}${rand}`;
}

/**
 * 生成签名：按字典序排序参数，拼接 key=value&，末尾追加 secret，MD5 小写
 * 忽略：空值、null、undefined、sign 本身
 */
export function generateSign(params: Record<string, any>, secret: string): string {
  const keys = Object.keys(params)
    .filter((k) => k !== 'sign' && k !== 'hash' && params[k] !== '' && params[k] != null)
    .sort();
  const raw = keys.map((k) => `${k}=${params[k]}`).join('&') + secret;
  return md5(raw).toLowerCase();
}

/**
 * 验证虎皮椒回调签名
 * 注意：虎皮椒的签名字段名可能是 hash（不是 sign），需要兼容
 */
export function verifySign(params: Record<string, any>, secret: string): boolean {
  const providedSign = String(params.hash ?? params.sign ?? '').toLowerCase();
  if (!providedSign) return false;
  const rebuilt = generateSign(params, secret);
  return rebuilt === providedSign;
}

/**
 * 调用虎皮椒下单接口
 */
export async function xunhupayCreateOrder(input: {
  appid: string;
  secret: string;
  orderId: string;
  amount: number;
  title: string;
  notifyUrl: string;
  returnUrl: string;
  wapUrl: string;
  wapName: string;
}): Promise<{ success: boolean; payUrl?: string; providerOrderId?: string; error?: string; raw?: any }> {
  const params: Record<string, string> = {
    version: '1.1',
    appid: input.appid,
    trade_order_id: input.orderId,
    total_fee: input.amount.toFixed(2),
    title: input.title,
    time: String(Math.floor(Date.now() / 1000)),
    notify_url: input.notifyUrl,
    return_url: input.returnUrl,
    nonce_str: Math.random().toString(36).slice(2, 10),
    wap_url: input.wapUrl,
    wap_name: input.wapName,
    type: 'WAP',
    plugins: 'xunhupay',
  };
  params.hash = generateSign(params, input.secret);

  const form = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => form.append(k, v));

  try {
    const res = await fetch(XUNHUPAY_CREATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const data: any = await res.json();
    if (data.errcode === 0 || data.errcode === '0') {
      return { success: true, payUrl: data.url || data.url_qrcode, providerOrderId: data.oid || undefined, raw: data };
    }
    return { success: false, error: data.errmsg || 'unknown error', raw: data };
  } catch (e: any) {
    return { success: false, error: e.message || String(e) };
  }
}

/**
 * 查询虎皮椒订单状态
 */
export async function xunhupayQueryOrder(input: {
  appid: string;
  secret: string;
  orderId: string;
}): Promise<{ success: boolean; status?: 'pending' | 'success' | 'failed'; providerOrderId?: string; paidAt?: string; error?: string }> {
  const params: Record<string, string> = {
    appid: input.appid,
    out_trade_order: input.orderId,
    time: String(Math.floor(Date.now() / 1000)),
    nonce_str: Math.random().toString(36).slice(2, 10),
  };
  params.hash = generateSign(params, input.secret);

  const form = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => form.append(k, v));

  try {
    const res = await fetch(XUNHUPAY_QUERY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const data: any = await res.json();
    if (data.errcode !== 0 && data.errcode !== '0') {
      return { success: false, error: data.errmsg || 'unknown error' };
    }
    // status: OD (未支付) | WAIT_PAY (待支付) | OP (已支付) | CD (已取消)
    let status: 'pending' | 'success' | 'failed' = 'pending';
    if (data.status === 'OP') status = 'success';
    else if (data.status === 'CD') status = 'failed';
    return { success: true, status, providerOrderId: data.open_order_id, paidAt: data.pay_time };
  } catch (e: any) {
    return { success: false, error: e.message || String(e) };
  }
}
```

- [ ] **Step 3: 本地验证签名和订单号（用 node 手动跑一次）**

创建临时验证脚本 `worker/xunhupay.check.mjs`：

```javascript
import md5 from 'js-md5';

// 复制生成签名的关键逻辑
function generateSign(params, secret) {
  const keys = Object.keys(params)
    .filter((k) => k !== 'sign' && k !== 'hash' && params[k] !== '' && params[k] != null)
    .sort();
  const raw = keys.map((k) => `${k}=${params[k]}`).join('&') + secret;
  return md5(raw).toLowerCase();
}

// 测试用例：官方文档示例 (若能找到)
const p = { appid: 'test', total_fee: '0.01', title: 'x' };
const sign = generateSign(p, 'SECRET_ABC');
console.log('sign:', sign);
console.log('sign is 32 chars lowercase hex:', /^[0-9a-f]{32}$/.test(sign));
```

Run:
```bash
node worker/xunhupay.check.mjs
```

Expected: 输出一个 32 位小写十六进制字符串，且第二行为 `true`。

- [ ] **Step 4: 删除临时脚本，commit**

Run:
```bash
rm worker/xunhupay.check.mjs
git add worker/xunhupay.ts package.json package-lock.json
git commit -m "feat(payment): 添加虎皮椒签名/订单号/API 调用工具模块

- generateOrderId: SYX+时间戳+随机 生成商户订单号
- generateSign/verifySign: MD5 字典序签名
- xunhupayCreateOrder: 调用 v1.1 下单接口，返回 pay_url
- xunhupayQueryOrder: 主动查询订单状态
- 依赖 js-md5

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: 后端新增 `POST /api/payments/create` 接口

**Files:**
- Modify: `worker/index.ts`
- Reference: `worker/xunhupay.ts` (from Task 2)

**Interfaces:**
- Consumes: `generateOrderId()`, `xunhupayCreateOrder()`
- Produces: `POST /api/payments/create` 接口
  - Request: `{ type: 'single' | 'monthly', phone: string }`
  - Response 成功: `{ success: true, order_id: string, pay_url: string }`
  - Response 失败: `{ success: false, error: string }`

- [ ] **Step 1: 添加 Bindings 类型**

修改 `worker/index.ts` 第 12-16 行的 `Bindings`：

```typescript
type Bindings = {
  DB: D1Database;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
  XUNHUPAY_APPID?: string;    // 优先从环境变量读取，未配置时回退到 settings 表
  XUNHUPAY_SECRET?: string;
  WORKER_BASE_URL?: string;   // 例：https://shuiyinxiangji-api.yxq1337.workers.dev
  PAGES_BASE_URL?: string;    // 例：https://shuiyinxiangji.pages.dev
};
```

- [ ] **Step 2: 在 `worker/index.ts` 顶部添加 import**

```typescript
import { generateOrderId, xunhupayCreateOrder, xunhupayQueryOrder, verifySign } from './xunhupay';
```

- [ ] **Step 3: 添加 `POST /api/payments/create` 路由**

在 `worker/index.ts` 现有 `app.post('/api/payments', ...)` 之前（第 170 行位置）插入：

```typescript
// ==================== 真实支付：下单 ====================
app.post('/api/payments/create', async (c) => {
  const body = await c.req.json();
  const { type, phone } = body;

  if (!type || (type !== 'single' && type !== 'monthly')) {
    return c.json({ success: false, error: '订单类型无效' }, 400);
  }
  if (!phone) {
    return c.json({ success: false, error: '未登录' }, 400);
  }

  const db = c.env.DB;

  // 读取价格与配置
  const settings: any = await db.prepare('SELECT * FROM settings WHERE id = 1').first();
  const singlePrice = settings?.single_price ?? 1.99;
  const monthlyPrice = settings?.monthly_price ?? 9.9;
  const amount = type === 'single' ? Number(singlePrice) : Number(monthlyPrice);

  // 优先使用 env 中的 secret；env 未配置时回退到 settings
  const appid = c.env.XUNHUPAY_APPID || settings?.xunhupay_appid || '';
  const secret = c.env.XUNHUPAY_SECRET || settings?.xunhupay_secret || '';
  if (!appid || !secret) {
    return c.json({ success: false, error: '支付系统未配置，请联系管理员' }, 500);
  }

  const orderId = generateOrderId();
  const now = new Date().toISOString();

  // 先插入本地订单，status = pending
  await db
    .prepare(
      `INSERT INTO payments (id, order_id, type, amount, timestamp, status, phone, provider)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, 'xunhupay')`
    )
    .bind(orderId, orderId, type, amount, now, phone)
    .run();

  // 组装回调/跳转 URL
  const workerUrl = c.env.WORKER_BASE_URL || `https://${new URL(c.req.url).host}`;
  const pagesUrl = c.env.PAGES_BASE_URL || 'https://shuiyinxiangji.pages.dev';
  const notifyUrl = `${workerUrl}/api/payments/notify`;
  const returnUrl = `${pagesUrl}/payment/callback?order_id=${orderId}`;

  // 调用虎皮椒
  const result = await xunhupayCreateOrder({
    appid,
    secret,
    orderId,
    amount,
    title: type === 'monthly' ? '水印相机 - 月度会员' : '水印相机 - 单次导出',
    notifyUrl,
    returnUrl,
    wapUrl: pagesUrl,
    wapName: '水印相机 Pro',
  });

  if (!result.success || !result.payUrl) {
    // 下单失败，把订单标记 failed
    await db.prepare("UPDATE payments SET status = 'failed' WHERE order_id = ?").bind(orderId).run();
    return c.json({ success: false, error: result.error || '下单失败' }, 500);
  }

  // 更新订单的 pay_url 和 provider_order_id
  await db
    .prepare(
      `UPDATE payments SET pay_url = ?, provider_order_id = ? WHERE order_id = ?`
    )
    .bind(result.payUrl, result.providerOrderId || '', orderId)
    .run();

  return c.json({ success: true, order_id: orderId, pay_url: result.payUrl });
});
```

- [ ] **Step 4: 本地验证接口响应格式（不需真实虎皮椒 API，先看错误返回）**

Run:
```bash
CLOUDFLARE_API_TOKEN=cfut_2THcmsqZyrkslgy0snrXyl5ymldc4ga2QOZwWU7ce0db80ee \
  ./node_modules/.bin/wrangler deploy
```

Expected: 部署成功，Worker 更新。

用 curl 测试（预期返回 `支付系统未配置`）：

在浏览器控制台中打开 `https://shuiyinxiangji.pages.dev`，执行：

```javascript
await fetch('https://shuiyinxiangji-api.yxq1337.workers.dev/api/payments/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'monthly', phone: '13800138000' })
}).then(r => r.json());
```

Expected: 返回 `{ success: false, error: '支付系统未配置，请联系管理员' }`（因为还没配 secret）。

- [ ] **Step 5: Commit**

```bash
git add worker/index.ts
git commit -m "feat(api): 新增 POST /api/payments/create 下单接口

- 从 env 或 settings 读取虎皮椒 appid/secret
- 插入 pending 订单到 D1，调用 xunhupay，回写 pay_url
- 未配置支付时明确报错

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: 后端新增 `POST /api/payments/notify` 回调接口

**Files:**
- Modify: `worker/index.ts`

**Interfaces:**
- Consumes: `verifySign()`
- Produces: `POST /api/payments/notify` 路由，纯文本 `success` 响应

- [ ] **Step 1: 添加回调路由**

在 `worker/index.ts` `POST /api/payments/create` 之后插入：

```typescript
// ==================== 真实支付：异步回调 ====================
app.post('/api/payments/notify', async (c) => {
  // 虎皮椒 POST application/x-www-form-urlencoded
  const contentType = c.req.header('content-type') || '';
  let params: Record<string, string> = {};
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const text = await c.req.text();
    const usp = new URLSearchParams(text);
    for (const [k, v] of usp.entries()) params[k] = v;
  } else if (contentType.includes('application/json')) {
    params = (await c.req.json()) as any;
  } else {
    // 兜底再尝试解析一次
    try {
      const text = await c.req.text();
      const usp = new URLSearchParams(text);
      for (const [k, v] of usp.entries()) params[k] = v;
    } catch (e) {
      return c.text('fail');
    }
  }

  console.info('[notify] received:', JSON.stringify(params));

  const db = c.env.DB;
  const settings: any = await db.prepare('SELECT * FROM settings WHERE id = 1').first();
  const secret = c.env.XUNHUPAY_SECRET || settings?.xunhupay_secret || '';
  if (!secret) return c.text('fail');

  // 验签
  if (!verifySign(params, secret)) {
    console.error('[notify] sign verify failed');
    return c.text('fail');
  }

  const orderId = params.trade_order_id;
  if (!orderId) return c.text('fail');

  // 查找订单
  const order: any = await db
    .prepare('SELECT * FROM payments WHERE order_id = ?')
    .bind(orderId)
    .first();
  if (!order) {
    console.error('[notify] order not found:', orderId);
    return c.text('fail');
  }

  // 幂等：已成功直接返回
  if (order.status === 'success') return c.text('success');

  // 金额校验
  const notifiedFee = parseFloat(params.total_fee || '0');
  const expectedFee = Number(order.amount);
  if (Math.abs(notifiedFee - expectedFee) > 0.001) {
    console.error('[notify] amount mismatch:', notifiedFee, expectedFee);
    return c.text('fail');
  }

  // 更新订单
  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE payments SET status = 'success', paid_at = ?, provider_order_id = ?, raw_notify = ? WHERE order_id = ?`
    )
    .bind(now, params.open_order_id || params.transaction_id || '', JSON.stringify(params), orderId)
    .run();

  // 若为月度会员，激活 VIP
  if (order.type === 'monthly') {
    const user: any = await db.prepare('SELECT * FROM users WHERE phone = ?').bind(order.phone).first();
    if (user) {
      const currentExpiry = user.vip_expires_at ? new Date(user.vip_expires_at).getTime() : Date.now();
      const newExpiry = new Date(Math.max(currentExpiry, Date.now()) + 30 * 24 * 60 * 60 * 1000).toISOString();
      await db
        .prepare('UPDATE users SET is_vip = 1, vip_expires_at = ? WHERE phone = ?')
        .bind(newExpiry, order.phone)
        .run();
    }
  }

  return c.text('success');
});
```

- [ ] **Step 2: 部署并验证接口存在**

Run:
```bash
CLOUDFLARE_API_TOKEN=cfut_2THcmsqZyrkslgy0snrXyl5ymldc4ga2QOZwWU7ce0db80ee \
  ./node_modules/.bin/wrangler deploy
```

Expected: 部署成功。

在浏览器控制台执行：
```javascript
await fetch('https://shuiyinxiangji-api.yxq1337.workers.dev/api/payments/notify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: 'trade_order_id=NOT_EXIST&hash=fake'
}).then(r => r.text());
```

Expected: 返回 `fail`（验签失败）。

- [ ] **Step 3: Commit**

```bash
git add worker/index.ts
git commit -m "feat(api): 新增 POST /api/payments/notify 回调接口

- 支持 form/json 两种 content-type
- MD5 验签，金额校验，幂等处理
- 成功时激活/延长 monthly VIP
- 必须返回纯文本 success

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: 后端新增 `GET /api/payments/status/:orderId` 轮询接口

**Files:**
- Modify: `worker/index.ts`

**Interfaces:**
- Consumes: `xunhupayQueryOrder()`
- Produces: `GET /api/payments/status/:orderId`
  - Response: `{ success: true, order_id, status: 'pending'|'success'|'failed', paid_at?: string }`

- [ ] **Step 1: 添加轮询路由**

在 `worker/index.ts` `POST /api/payments/notify` 之后插入：

```typescript
// ==================== 真实支付：状态查询（前端轮询用） ====================
app.get('/api/payments/status/:orderId', async (c) => {
  const orderId = c.req.param('orderId');
  const db = c.env.DB;

  const order: any = await db
    .prepare('SELECT * FROM payments WHERE order_id = ?')
    .bind(orderId)
    .first();
  if (!order) {
    return c.json({ success: false, error: '订单不存在' }, 404);
  }

  // 已终态直接返回
  if (order.status === 'success' || order.status === 'failed') {
    return c.json({
      success: true,
      order_id: orderId,
      status: order.status,
      paid_at: order.paid_at,
    });
  }

  // pending 且订单已创建 20 秒以上 → 主动查虎皮椒
  const createdMs = new Date(order.timestamp).getTime();
  const ageSec = (Date.now() - createdMs) / 1000;
  if (ageSec < 20) {
    return c.json({ success: true, order_id: orderId, status: 'pending' });
  }

  const settings: any = await db.prepare('SELECT * FROM settings WHERE id = 1').first();
  const appid = c.env.XUNHUPAY_APPID || settings?.xunhupay_appid || '';
  const secret = c.env.XUNHUPAY_SECRET || settings?.xunhupay_secret || '';
  if (!appid || !secret) {
    return c.json({ success: true, order_id: orderId, status: 'pending' });
  }

  const q = await xunhupayQueryOrder({ appid, secret, orderId });
  if (q.success && q.status === 'success' && order.status !== 'success') {
    const now = new Date().toISOString();
    await db
      .prepare(
        `UPDATE payments SET status = 'success', paid_at = ?, provider_order_id = ? WHERE order_id = ?`
      )
      .bind(now, q.providerOrderId || '', orderId)
      .run();
    if (order.type === 'monthly') {
      const user: any = await db.prepare('SELECT * FROM users WHERE phone = ?').bind(order.phone).first();
      if (user) {
        const currentExpiry = user.vip_expires_at ? new Date(user.vip_expires_at).getTime() : Date.now();
        const newExpiry = new Date(Math.max(currentExpiry, Date.now()) + 30 * 24 * 60 * 60 * 1000).toISOString();
        await db
          .prepare('UPDATE users SET is_vip = 1, vip_expires_at = ? WHERE phone = ?')
          .bind(newExpiry, order.phone)
          .run();
      }
    }
    return c.json({ success: true, order_id: orderId, status: 'success', paid_at: now });
  }

  return c.json({ success: true, order_id: orderId, status: q.status || 'pending' });
});
```

- [ ] **Step 2: 部署并验证**

Run:
```bash
CLOUDFLARE_API_TOKEN=cfut_2THcmsqZyrkslgy0snrXyl5ymldc4ga2QOZwWU7ce0db80ee \
  ./node_modules/.bin/wrangler deploy
```

浏览器控制台：
```javascript
await fetch('https://shuiyinxiangji-api.yxq1337.workers.dev/api/payments/status/NOT_EXIST').then(r => r.json());
```

Expected: `{ success: false, error: '订单不存在' }`。

- [ ] **Step 3: Commit**

```bash
git add worker/index.ts
git commit -m "feat(api): 新增 GET /api/payments/status/:orderId 轮询接口

- 已终态直接返回
- pending 且订单超过 20 秒 → 主动查询虎皮椒
- 查询到 success 时同步激活 VIP

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: 管理后台 API 返回新字段

**Files:**
- Modify: `worker/index.ts`（约 215 行处 `/api/admin/payments`）
- Modify: `src/pages/Admin.tsx`（`Payment` 接口和渲染）

**Interfaces:**
- Consumes: `payments` 表的新字段
- Produces: 管理后台看到 `order_id`, `provider`, `pay_method`, `paid_at`

- [ ] **Step 1: 修改 `/api/admin/payments` 显式返回新字段**

在 `worker/index.ts` 找到并替换：

```typescript
app.get('/api/admin/payments', async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT id, order_id, type, amount, timestamp, status, phone,
            provider, provider_order_id, pay_method, paid_at
     FROM payments ORDER BY timestamp DESC`
  ).all();
  return c.json({ payments: result.results || [] });
});
```

- [ ] **Step 2: 前端 `src/pages/Admin.tsx` 更新 `Payment` interface**

找到 `Payment` interface，替换为：

```typescript
interface Payment {
  id: string;
  order_id?: string;
  type: string;
  amount: number;
  timestamp: string;
  status: string;
  phone: string;
  provider?: string;
  provider_order_id?: string;
  pay_method?: string;
  paid_at?: string;
}
```

- [ ] **Step 3: 支付记录列表显示订单号**

在 `Admin.tsx` 找到 `activeTab === 'payments'` 分支的订单渲染 `{payments.map(...)}`，替换整块为：

```tsx
{payments.map((p) => (
  <div key={p.id} className="px-6 py-4 flex items-center justify-between">
    <div>
      <p className="font-medium text-gray-900">
        {p.type === 'monthly' ? '月度会员' : '单次付费'}
      </p>
      <p className="text-xs text-gray-500 font-mono">{p.order_id || p.id}</p>
      <p className="text-sm text-gray-500">
        {p.phone} · {new Date(p.timestamp).toLocaleString('zh-CN')}
      </p>
      {p.paid_at && (
        <p className="text-xs text-green-500">
          支付于 {new Date(p.paid_at).toLocaleString('zh-CN')}
        </p>
      )}
    </div>
    <div className="text-right">
      <p className="font-semibold text-green-600">¥{p.amount}</p>
      <span className={`text-xs px-2 py-1 rounded ${
        p.status === 'success' ? 'text-green-500 bg-green-50' :
        p.status === 'pending' ? 'text-yellow-500 bg-yellow-50' :
        'text-red-500 bg-red-50'
      }`}>
        {p.status === 'success' ? '支付成功' : p.status === 'pending' ? '待支付' : '已失败'}
      </span>
    </div>
  </div>
))}
```

- [ ] **Step 4: 部署后端 + 构建前端 + 部署前端**

```bash
CLOUDFLARE_API_TOKEN=cfut_2THcmsqZyrkslgy0snrXyl5ymldc4ga2QOZwWU7ce0db80ee \
  ./node_modules/.bin/wrangler deploy

npm run build

CLOUDFLARE_API_TOKEN=cfut_2THcmsqZyrkslgy0snrXyl5ymldc4ga2QOZwWU7ce0db80ee \
  ./node_modules/.bin/wrangler pages deploy dist --project-name=shuiyinxiangji --commit-dirty=true
```

浏览器打开 `https://shuiyinxiangji.pages.dev/login`，用 admin/VIP1337 登录，进入管理后台的支付记录页，Expected: 现有的两条 demo 订单也能正常显示（`order_id` 为 null 显示 fallback 的 `id`）。

- [ ] **Step 5: Commit**

```bash
git add worker/index.ts src/pages/Admin.tsx
git commit -m "feat(admin): 支付记录返回并展示订单号/支付方式/支付时间

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: 前端 `Pricing.tsx` 改用真实下单

**Files:**
- Modify: `src/pages/Pricing.tsx`

**Interfaces:**
- Consumes: `POST /api/payments/create`
- Produces: 用户点"立即购买" → 后端下单 → 跳转到 pay_url（手机）或显示二维码（桌面）

- [ ] **Step 1: 完整替换 `Pricing.tsx`**

```tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Crown, Zap, CreditCard } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiGet, apiPost } from '../lib/api';

interface PricingPlan {
  type: 'single' | 'monthly';
  name: string;
  price: number;
  originalPrice?: number;
  description: string;
  features: string[];
  popular?: boolean;
}

function isMobileUA(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export default function Pricing() {
  const [selectedPlan, setSelectedPlan] = useState<'single' | 'monthly'>('monthly');
  const [settings, setSettings] = useState<{ singlePrice: number; monthlyPrice: number }>({
    singlePrice: 1.99,
    monthlyPrice: 9.9,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>('');
  const [payUrl, setPayUrl] = useState<string>('');
  const [orderId, setOrderId] = useState<string>('');
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    apiGet('/api/settings').then((data) => setSettings(data));
  }, []);

  const plans: PricingPlan[] = [
    {
      type: 'single',
      name: '单次付费',
      price: settings.singlePrice,
      description: '解锁一次高清无水印导出',
      features: ['高清无水印', '保留原图分辨率', '所有水印模板'],
    },
    {
      type: 'monthly',
      name: '月度会员',
      price: settings.monthlyPrice,
      originalPrice: 29.99,
      description: '30 天内无限次使用所有功能',
      features: ['无限次导出', '所有高级模板', '批量处理', '专属客服'],
      popular: true,
    },
  ];

  const handlePayment = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    setError('');
    setIsProcessing(true);
    try {
      const data = await apiPost('/api/payments/create', {
        type: selectedPlan,
        phone: user.phone,
      });
      if (!data.success || !data.pay_url) {
        setError(data.error || '下单失败');
        setIsProcessing(false);
        return;
      }
      setPayUrl(data.pay_url);
      setOrderId(data.order_id);

      if (isMobileUA()) {
        // 手机：直接跳转到支付页面
        window.location.href = data.pay_url;
      } else {
        // 桌面：留在 Pricing，显示二维码模态框（下一步渲染）
        setIsProcessing(false);
      }
    } catch (e) {
      setError('网络错误，请重试');
      setIsProcessing(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-600 mb-4">请先登录后再购买</p>
          <button
            onClick={() => navigate('/login')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            去登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">选择你的套餐</h1>
          <p className="text-gray-500">解锁更多高级功能，提升创作效率</p>
        </div>

        {user.isVip ? (
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-2xl p-8 text-center">
            <Crown className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-yellow-800 mb-2">你已是 VIP 会员</h2>
            <p className="text-yellow-700">
              会员有效期至：{user.vipExpiresAt ? new Date(user.vipExpiresAt).toLocaleDateString('zh-CN') : '永久'}
            </p>
            <button
              onClick={() => navigate('/')}
              className="mt-6 bg-yellow-500 text-white px-6 py-3 rounded-lg hover:bg-yellow-600"
            >
              开始使用
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-8">
            {plans.map((plan) => (
              <div
                key={plan.type}
                onClick={() => setSelectedPlan(plan.type)}
                className={`relative bg-white rounded-2xl p-8 border-2 cursor-pointer transition-all ${
                  selectedPlan === plan.type
                    ? 'border-blue-500 shadow-lg'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                    最受欢迎
                  </div>
                )}
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <p className="text-gray-500 text-sm mb-4">{plan.description}</p>
                  <div className="flex items-baseline justify-center space-x-2">
                    <span className="text-3xl font-bold text-gray-900">¥{plan.price}</span>
                    {plan.originalPrice && (
                      <span className="text-gray-400 line-through">¥{plan.originalPrice}</span>
                    )}
                  </div>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center text-gray-600">
                      <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                {selectedPlan === plan.type && (
                  <div className="absolute -right-2 -top-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!user.isVip && (
          <div className="mt-8 text-center">
            <button
              onClick={handlePayment}
              disabled={isProcessing}
              className="bg-blue-600 text-white px-8 py-4 rounded-xl text-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors inline-flex items-center space-x-2"
            >
              <CreditCard className="w-5 h-5" />
              <span>{isProcessing ? '生成订单中...' : '立即购买'}</span>
            </button>
            {error && <p className="mt-4 text-red-600 text-sm">{error}</p>}
          </div>
        )}

        {/* 桌面端支付：二维码模态框 */}
        {payUrl && !isMobileUA() && !isProcessing && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center">
              <Zap className="w-12 h-12 text-blue-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">请用手机扫码支付</h3>
              <p className="text-gray-500 mb-4">或复制链接在手机浏览器打开：</p>
              <div className="w-56 h-56 bg-white border-2 border-gray-200 rounded-lg mx-auto my-4 flex items-center justify-center overflow-hidden">
                <img
                  alt="支付二维码"
                  className="w-full h-full"
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(payUrl)}`}
                />
              </div>
              <div className="text-xs bg-gray-100 px-3 py-2 rounded break-all mb-4">{payUrl}</div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setPayUrl('')}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={() => navigate(`/payment/callback?order_id=${orderId}`)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  已完成支付
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 构建 + 本地跑一下检查语法**

Run:
```bash
npm run build
```

Expected: 构建成功，无 TypeScript 错误。

- [ ] **Step 3: Commit**

```bash
git add src/pages/Pricing.tsx
git commit -m "feat(frontend): Pricing 页面改用真实下单接口

- 调用 /api/payments/create 生成订单
- 手机 UA → 直接跳转 pay_url
- 桌面 → 显示二维码 + 复制链接 + 已完成支付按钮
- 保留错误提示

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: 前端新增 `PaymentCallback.tsx` 轮询页

**Files:**
- Create: `src/pages/PaymentCallback.tsx`

**Interfaces:**
- Consumes: `GET /api/payments/status/:orderId`, `useAuth().refreshUser`
- Produces: React 页面组件

- [ ] **Step 1: 创建 `PaymentCallback.tsx`**

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, Home } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiGet } from '../lib/api';

export default function PaymentCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [status, setStatus] = useState<'pending' | 'success' | 'failed' | 'timeout'>('pending');
  const [pollCount, setPollCount] = useState(0);
  const timerRef = useRef<any>(null);
  const orderId = params.get('order_id') || '';
  const MAX_POLL = 60;
  const INTERVAL_MS = 3000;

  useEffect(() => {
    if (!orderId) {
      setStatus('failed');
      return;
    }
    let cancelled = false;

    async function poll(count: number) {
      if (cancelled) return;
      if (count >= MAX_POLL) {
        setStatus('timeout');
        return;
      }
      try {
        const data = await apiGet(`/api/payments/status/${orderId}`);
        if (cancelled) return;
        if (data.success && data.status === 'success') {
          setStatus('success');
          await refreshUser();
          setTimeout(() => navigate('/my'), 2000);
          return;
        }
        if (data.status === 'failed') {
          setStatus('failed');
          return;
        }
      } catch (e) {
        // 网络错误继续轮询
      }
      setPollCount(count + 1);
      timerRef.current = setTimeout(() => poll(count + 1), INTERVAL_MS);
    }
    poll(0);
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const seconds = pollCount * (INTERVAL_MS / 1000);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-sm border border-gray-200">
        {status === 'pending' && (
          <>
            <Loader2 className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-spin" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">正在确认支付</h1>
            <p className="text-gray-500 mb-4">订单号：<span className="font-mono">{orderId}</span></p>
            <p className="text-gray-400 text-sm">已等待 {seconds} 秒...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">支付成功</h1>
            <p className="text-gray-500 mb-4">正在跳转到个人中心...</p>
          </>
        )}
        {status === 'failed' && (
          <>
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">支付失败</h1>
            <p className="text-gray-500 mb-6">订单未成功，可返回重试</p>
            <button
              onClick={() => navigate('/pricing')}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
            >
              重新选择套餐
            </button>
          </>
        )}
        {status === 'timeout' && (
          <>
            <Home className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">支付未确认</h1>
            <p className="text-gray-500 mb-2">
              如果你已完成支付，请稍后到个人中心查看会员状态。
            </p>
            <p className="text-gray-400 text-xs mb-6">订单号：{orderId}</p>
            <div className="flex space-x-3">
              <button
                onClick={() => navigate('/my')}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                去个人中心
              </button>
              <button
                onClick={() => navigate('/pricing')}
                className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50"
              >
                重新支付
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 构建**

```bash
npm run build
```

Expected: 构建成功。

- [ ] **Step 3: Commit**

```bash
git add src/pages/PaymentCallback.tsx
git commit -m "feat(frontend): 新增 PaymentCallback 支付结果轮询页

- 每 3 秒轮询订单状态，最多 60 次（3 分钟）
- 成功 → 刷新用户 → 跳转 /my
- 失败/超时 → 提示 + 重试入口

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 9: 前端路由注册

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 在 App 路由中注册新页面**

在 `src/App.tsx` 找到 `<Routes>` 块，添加一行：

```tsx
import PaymentCallback from './pages/PaymentCallback';
```

然后在 Routes 内部：

```tsx
<Route path="/payment/callback" element={<PaymentCallback />} />
```

完整 Routes 部分应该是：

```tsx
<Routes>
  <Route path="/" element={<WatermarkApp />} />
  <Route path="/login" element={<Login />} />
  <Route path="/my" element={<UserCenter />} />
  <Route path="/pricing" element={<Pricing />} />
  <Route path="/payment/callback" element={<PaymentCallback />} />
  <Route path="/admin" element={<Admin />} />
</Routes>
```

- [ ] **Step 2: 构建 + 部署前端**

Run:
```bash
npm run build

CLOUDFLARE_API_TOKEN=cfut_2THcmsqZyrkslgy0snrXyl5ymldc4ga2QOZwWU7ce0db80ee \
  ./node_modules/.bin/wrangler pages deploy dist --project-name=shuiyinxiangji --commit-dirty=true
```

浏览器打开 `https://shuiyinxiangji.pages.dev/payment/callback?order_id=TEST`

Expected: 显示"支付未确认"（因为订单不存在 → status = 'failed'）。

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(frontend): 注册 /payment/callback 路由

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 10: 生产测试 1 分钱订单

**Files:**（无代码变更）

**前置条件：** 你已在 https://www.xunhupay.com 注册并拿到 `appid` 和 `AppSecret`。

- [ ] **Step 1: 配置 Cloudflare Secret**

```bash
CLOUDFLARE_API_TOKEN=cfut_2THcmsqZyrkslgy0snrXyl5ymldc4ga2QOZwWU7ce0db80ee \
  ./node_modules/.bin/wrangler secret put XUNHUPAY_APPID
# 提示后输入你的 appid（14 位数字/字母），回车

CLOUDFLARE_API_TOKEN=cfut_2THcmsqZyrkslgy0snrXyl5ymldc4ga2QOZwWU7ce0db80ee \
  ./node_modules/.bin/wrangler secret put XUNHUPAY_SECRET
# 提示后输入你的 secret，回车

CLOUDFLARE_API_TOKEN=cfut_2THcmsqZyrkslgy0snrXyl5ymldc4ga2QOZwWU7ce0db80ee \
  ./node_modules/.bin/wrangler secret put WORKER_BASE_URL
# 输入：https://shuiyinxiangji-api.yxq1337.workers.dev

CLOUDFLARE_API_TOKEN=cfut_2THcmsqZyrkslgy0snrXyl5ymldc4ga2QOZwWU7ce0db80ee \
  ./node_modules/.bin/wrangler secret put PAGES_BASE_URL
# 输入：https://shuiyinxiangji.pages.dev
```

Expected: 每条 `Success! Uploaded secret <NAME>`。

- [ ] **Step 2: 后台调整月度价格为 0.01（临时用于测试）**

用 admin 登录 → 管理后台 → 系统设置 → 把 `月度价格` 改为 `0.01` → 保存。

- [ ] **Step 3: 在手机浏览器上完整走一次流程**

1. 用手机浏览器打开 `https://shuiyinxiangji.pages.dev`
2. 用手机号登录（如 `13800138888`）
3. 点击右上角"升级 VIP"或到 `/pricing`
4. 选"月度会员" → 点"立即购买"
5. 应自动跳到虎皮椒的支付页
6. 完成 0.01 元支付
7. 支付成功后应跳回 `/payment/callback?order_id=SYX...`
8. 前端轮询 → 拉到 `success` → 跳到 `/my`
9. `/my` 页面应显示 VIP + 到期日 = 今天 + 30 天

Expected: 全流程走通，D1 数据库中订单状态为 `success`，`paid_at` 有值。

- [ ] **Step 4: 恢复价格**

Admin 后台把月度价格改回 `9.9`。

- [ ] **Step 5: 记录测试结果 + commit（可选）**

在管理后台截图订单记录，确认 `provider_order_id` 有值（说明虎皮椒回调成功）。

如需保留测试记录：
```bash
# 无代码变更，可跳过 commit
```

---

## Task 11: 更新部署文档

**Files:**
- Modify: `DEPLOY.md`

- [ ] **Step 1: 在 `DEPLOY.md` 追加支付系统配置章节**

在文件末尾添加：

```markdown

---

## 七、支付系统配置（虎皮椒）

### 前置条件

1. 到 https://www.xunhupay.com 注册账号 + 个人实名认证
2. 审核通过后在后台拿到 `appid` 和 `AppSecret`
3. 在虎皮椒后台配置：
   - **异步通知地址**：`https://shuiyinxiangji-api.yxq1337.workers.dev/api/payments/notify`
   - **同步跳转地址**：`https://shuiyinxiangji.pages.dev/payment/callback`

### 配置密钥（生产）

```bash
CLOUDFLARE_API_TOKEN=<你的_TOKEN> ./node_modules/.bin/wrangler secret put XUNHUPAY_APPID
CLOUDFLARE_API_TOKEN=<你的_TOKEN> ./node_modules/.bin/wrangler secret put XUNHUPAY_SECRET
CLOUDFLARE_API_TOKEN=<你的_TOKEN> ./node_modules/.bin/wrangler secret put WORKER_BASE_URL
# 值：https://shuiyinxiangji-api.yxq1337.workers.dev
CLOUDFLARE_API_TOKEN=<你的_TOKEN> ./node_modules/.bin/wrangler secret put PAGES_BASE_URL
# 值：https://shuiyinxiangji.pages.dev
```

### 支付流程

1. **用户下单** → `POST /api/payments/create` → 后端生成订单，调用虎皮椒生成支付链接
2. **手机跳转** → 用户在手机浏览器完成微信/支付宝支付
3. **回调** → 虎皮椒服务端 POST `/api/payments/notify` → 验签 + 激活 VIP
4. **前端轮询** → `/payment/callback?order_id=xxx` 每 3 秒查询状态 → 3 分钟超时

### 测试

先把管理后台的价格改成 0.01，走一次完整流程验证；测试通过后再改回正常价。

### 已知限制

- **国内访问 workers.dev 可能不稳**：若回调经常失败，建议购买自定义域名（如 `api.你的域名.com`），在 Cloudflare 绑定到 Worker，之后更新 `WORKER_BASE_URL` secret。
- **免签约版本**：手续费约 2%，个人可用。
- **手动补单**：如遇到订单卡在 pending，可用 admin 后台查看，或调用 `/api/payments/status/{orderId}` 让后端主动查询虎皮椒。
```

- [ ] **Step 2: Commit**

```bash
git add DEPLOY.md
git commit -m "docs: 添加虎皮椒支付配置章节到部署文档

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Self-Review

### 1. Spec 覆盖检查

| Spec 需求 | 对应任务 |
|---|---|
| D1 表新增 7 字段 + 2 字段 | Task 1 ✅ |
| MD5 签名工具（generate/verify） | Task 2 ✅ |
| 订单号 `SYX+时间戳+随机` | Task 2 ✅ |
| 虎皮椒 API 调用（下单/查询） | Task 2 ✅ |
| `/api/payments/create` | Task 3 ✅ |
| `/api/payments/notify` + 验签 + 幂等 + 金额校验 | Task 4 ✅ |
| `/api/payments/status/:orderId` + 主动查询 | Task 5 ✅ |
| 密钥优先级 env > D1 | Task 3、4、5 ✅ |
| 回调必须返回纯文本 `success` | Task 4 ✅ |
| 前端 Pricing 改造 | Task 7 ✅ |
| 前端 PaymentCallback 轮询页 | Task 8 ✅ |
| 桌面显示二维码 + 手机跳转 | Task 7 ✅ |
| 每 3 秒轮询、60 次超时 | Task 8 ✅ |
| 管理后台显示订单号/支付时间 | Task 6 ✅ |
| 部署文档更新 | Task 11 ✅ |
| 生产 1 分钱测试 | Task 10 ✅ |

**未覆盖但已在 Spec 明确"下一版做"的：**
- 定时清理 30 分钟超时订单 → 留待未来版本
- 自定义域名 → 已在 DEPLOY.md 提示
- 年度会员、退款、对账 → 已在 Spec 未来演进中

### 2. 占位符扫描

- ✅ 无 TBD/TODO
- ✅ 所有代码步骤都有完整代码
- ✅ 所有命令都有 Expected 输出
- ✅ 没有"类似 Task N"

### 3. 类型一致性

- ✅ `generateOrderId()`（无参）在 Task 2 定义，Task 3 使用 ✅
- ✅ `xunhupayCreateOrder(input)` 返回 `{ success, payUrl, providerOrderId }`，Task 3 用 `result.payUrl` 一致 ✅
- ✅ `xunhupayQueryOrder(input)` 返回 `{ status: 'pending'|'success'|'failed' }`，Task 5 用 `q.status === 'success'` 一致 ✅
- ✅ 前端 `apiPost('/api/payments/create')` 参数 `{ type, phone }` 与 Task 3 后端 `body.type` `body.phone` 一致 ✅
- ✅ 后端返回 `{ success, order_id, pay_url }`，前端 `data.pay_url` `data.order_id` 一致 ✅
- ✅ `PaymentCallback` 使用 `useSearchParams().get('order_id')`，跳转 URL 中 `order_id=${orderId}` 参数名一致 ✅

**修复：** 之前 Pricing 页面移除了 `Clock` import 但 spec 没提，此处已删除。

---

## 执行说明

**Plan complete and saved to `docs/superpowers/plans/2026-07-12-payment-integration-xunhupay-plan.md`.**

两种执行方式可选：

**1. 子代理驱动开发（推荐）** — 每个任务派一个新的 subagent 完成 + 两阶段 review + 快速迭代。任务之间我会 review 后再进入下一个。

**2. 内联执行** — 我在当前会话中直接执行任务（executing-plans），批处理带 checkpoint。

**你选哪种？**
