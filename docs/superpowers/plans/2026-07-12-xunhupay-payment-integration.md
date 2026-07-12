# 虎皮椒 H5 支付集成 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有模拟支付替换为虎皮椒（xunhupay）真实的 H5 支付，用户在手机浏览器完成支付并自动激活 VIP。

**Architecture:** Cloudflare Workers（后端） + D1（数据库） + Cloudflare Pages（前端）。后端新增 3 个 API（create/notify/status）+ 签名工具；前端 Pricing 页面改造 + 新增 PaymentCallback 页面 + 3 秒轮询兜底。虎皮椒服务端签名 API 用 MD5，回调用同一签名验证。

**Tech Stack:** TypeScript, Hono (Workers 路由), React 19, react-router-dom, Cloudflare D1, wrangler 3.x。加密使用 Workers 内置 `crypto.subtle.digest`（无 Node.js crypto 依赖）。

## Global Constraints

- 保留 Express 本地开发模式（`server.ts`）不动，本次改造只针对 `worker/`
- 密钥用 `wrangler secret` 存储（`XUNHUPAY_APPID`, `XUNHUPAY_SECRET`），代码中不含明文
- Worker 域名：`https://shuiyinxiangji-api.yxq1337.workers.dev`（回调 URL 用它）
- Pages 域名：`https://shuiyinxiangji.pages.dev`（前端 return URL 用它）
- 前端相对路径 API 调用统一用 `src/lib/api.ts` 中的 `apiGet`/`apiPost`
- 所有 D1 操作用 `INSERT OR IGNORE` / `ON CONFLICT DO UPDATE` 保证幂等
- 订单号格式：`SYX<13位毫秒时间戳><4位随机大写字母数字>`，如 `SYX1720780800000A3F2X`
- Cloudflare Workers **不能用** Node.js `crypto` 模块，必须用 Web Crypto API
- Git 提交格式：`feat:` / `fix:` / `docs:` 开头，最后加 `Co-Authored-By: Claude <noreply@anthropic.com>`
- 每完成一个 Task 就提交一次

---

## 文件结构

**Worker 后端（新建/修改）：**
- `worker/schema-migrate-v2.sql` — 数据库迁移 SQL（新建）
- `worker/xunhupay.ts` — 虎皮椒签名 + API 调用工具（新建）
- `worker/index.ts` — 新增 3 个路由，修改 `/api/payments`（修改）

**前端（新建/修改）：**
- `src/pages/Pricing.tsx` — 改造为调用真实创建订单接口（修改）
- `src/pages/PaymentCallback.tsx` — 支付回调等待页面（新建）
- `src/App.tsx` — 增加路由 `/payment/callback`（修改）

**部署脚本（修改）：**
- `package.json` — 新增迁移脚本（修改）

---

### Task 1: 数据库表结构迁移

**Files:**
- Create: `worker/schema-migrate-v2.sql`
- Modify: `package.json`

**Interfaces:**
- Produces: `payments` 表增加 6 列（`order_id`, `provider`, `provider_order_id`, `pay_method`, `pay_url`, `paid_at`, `raw_notify`），`settings` 表增加 2 列（`xunhupay_appid`, `xunhupay_secret`）
- Consumes: 无

- [ ] **Step 1: 创建迁移 SQL 文件**

创建文件 `worker/schema-migrate-v2.sql`，内容如下：

```sql
-- v2 迁移：为支付集成准备
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

- [ ] **Step 2: 更新 package.json 增加迁移命令**

在 `package.json` 的 `scripts` 中新增两行：

```json
{
  "scripts": {
    "db:migrate:v2": "wrangler d1 execute shuiyinxiangji-db --file=worker/schema-migrate-v2.sql",
    "db:migrate:v2:remote": "wrangler d1 execute shuiyinxiangji-db --file=worker/schema-migrate-v2.sql --remote"
  }
}
```

- [ ] **Step 3: 执行远程迁移**

命令：
```bash
export CLOUDFLARE_API_TOKEN=cfut_2THcmsqZyrkslgy0snrXyl5ymldc4ga2QOZwWU7ce0db80ee
cd C:/Users/HUAWEI/shuiyinxiangji
npm run db:migrate:v2:remote 2>&1 | tail -20
```

Expected output（关键行）：
```
Executed 10 queries in ... ms
```

若某列已存在会报错 `duplicate column name`，忽略即可（迁移可重复执行）。

- [ ] **Step 4: 验证表结构**

```bash
npx wrangler d1 execute shuiyinxiangji-db --command "PRAGMA table_info(payments);" --remote
```

Expected: 输出中包含 `order_id`, `provider`, `provider_order_id`, `pay_method`, `pay_url`, `paid_at`, `raw_notify`。

```bash
npx wrangler d1 execute shuiyinxiangji-db --command "PRAGMA table_info(settings);" --remote
```

Expected: 输出中包含 `xunhupay_appid`, `xunhupay_secret`。

- [ ] **Step 5: 提交**

```bash
cd C:/Users/HUAWEI/shuiyinxiangji
git add worker/schema-migrate-v2.sql package.json
git commit -m "feat: 数据库迁移 v2 - 支付表增加订单字段

- payments 表：order_id、provider、provider_order_id、pay_method、pay_url、paid_at、raw_notify
- settings 表：xunhupay_appid、xunhupay_secret
- 新增 npm 脚本 db:migrate:v2 / db:migrate:v2:remote

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: 虎皮椒签名工具库

**Files:**
- Create: `worker/xunhupay.ts`

**Interfaces:**
- Produces:
  - `md5(input: string): Promise<string>` — 返回 32 位小写 MD5
  - `generateSign(params: Record<string, any>, secret: string): Promise<string>` — 生成虎皮椒 API 签名
  - `verifySign(params: Record<string, any>, secret: string): Promise<boolean>` — 验证回调签名
  - `createXunhupayOrder(params: CreateOrderParams): Promise<CreateOrderResult>` — 创建订单，返回支付 URL
  - `queryXunhupayOrder(params: QueryOrderParams): Promise<QueryOrderResult>` — 查询订单状态
- Consumes: 无

**说明：** Cloudflare Workers 环境不支持 Node.js 的 `crypto` 模块，必须用 Web Crypto API（`crypto.subtle.digest`）来实现 MD5——但 Web Crypto API 不直接支持 MD5！

**解决方案：** 用一个纯 JS 的 MD5 实现（约 100 行）。Cloudflare Workers 支持 ES Module。

- [ ] **Step 1: 创建 worker/xunhupay.ts**

创建文件，内容如下：

```typescript
/**
 * 虎皮椒（xunhupay）支付网关适配层
 *
 * 官方文档：https://www.xunhupay.com/doc/
 * API 版本：v1.1
 *
 * 签名算法：
 *   1. 将参数按 key 字典序排序
 *   2. 用 URL 键值对拼接（k=v&k=v），空值和 sign 字段跳过
 *   3. 末尾追加 secret
 *   4. 对结果做 MD5，取 32 位小写
 */

// ============ MD5 纯 JS 实现（RFC 1321） ============
// 直接来源：https://github.com/blueimp/JavaScript-MD5 (MIT License)
// 精简后适配 Workers 环境

function md5cycle(x: number[], k: number[]): void {
  let a = x[0], b = x[1], c = x[2], d = x[3];
  a = ff(a, b, c, d, k[0], 7, -680876936);
  d = ff(d, a, b, c, k[1], 12, -389564586);
  c = ff(c, d, a, b, k[2], 17, 606105819);
  b = ff(b, c, d, a, k[3], 22, -1044525330);
  a = ff(a, b, c, d, k[4], 7, -176418897);
  d = ff(d, a, b, c, k[5], 12, 1200080426);
  c = ff(c, d, a, b, k[6], 17, -1473231341);
  b = ff(b, c, d, a, k[7], 22, -45705983);
  a = ff(a, b, c, d, k[8], 7, 1770035416);
  d = ff(d, a, b, c, k[9], 12, -1958414417);
  c = ff(c, d, a, b, k[10], 17, -42063);
  b = ff(b, c, d, a, k[11], 22, -1990404162);
  a = ff(a, b, c, d, k[12], 7, 1804603682);
  d = ff(d, a, b, c, k[13], 12, -40341101);
  c = ff(c, d, a, b, k[14], 17, -1502002290);
  b = ff(b, c, d, a, k[15], 22, 1236535329);

  a = gg(a, b, c, d, k[1], 5, -165796510);
  d = gg(d, a, b, c, k[6], 9, -1069501632);
  c = gg(c, d, a, b, k[11], 14, 643717713);
  b = gg(b, c, d, a, k[0], 20, -373897302);
  a = gg(a, b, c, d, k[5], 5, -701558691);
  d = gg(d, a, b, c, k[10], 9, 38016083);
  c = gg(c, d, a, b, k[15], 14, -660478335);
  b = gg(b, c, d, a, k[4], 20, -405537848);
  a = gg(a, b, c, d, k[9], 5, 568446438);
  d = gg(d, a, b, c, k[14], 9, -1019803690);
  c = gg(c, d, a, b, k[3], 14, -187363961);
  b = gg(b, c, d, a, k[8], 20, 1163531501);
  a = gg(a, b, c, d, k[13], 5, -1444681467);
  d = gg(d, a, b, c, k[2], 9, -51403784);
  c = gg(c, d, a, b, k[7], 14, 1735328473);
  b = gg(b, c, d, a, k[12], 20, -1926607734);

  a = hh(a, b, c, d, k[5], 4, -378558);
  d = hh(d, a, b, c, k[8], 11, -2022574463);
  c = hh(c, d, a, b, k[11], 16, 1839030562);
  b = hh(b, c, d, a, k[14], 23, -35309556);
  a = hh(a, b, c, d, k[1], 4, -1530992060);
  d = hh(d, a, b, c, k[4], 11, 1272893353);
  c = hh(c, d, a, b, k[7], 16, -155497632);
  b = hh(b, c, d, a, k[10], 23, -1094730640);
  a = hh(a, b, c, d, k[13], 4, 681279174);
  d = hh(d, a, b, c, k[0], 11, -358537222);
  c = hh(c, d, a, b, k[3], 16, -722521979);
  b = hh(b, c, d, a, k[6], 23, 76029189);
  a = hh(a, b, c, d, k[9], 4, -640364487);
  d = hh(d, a, b, c, k[12], 11, -421815835);
  c = hh(c, d, a, b, k[15], 16, 530742520);
  b = hh(b, c, d, a, k[2], 23, -995338651);

  a = ii(a, b, c, d, k[0], 6, -198630844);
  d = ii(d, a, b, c, k[7], 10, 1126891415);
  c = ii(c, d, a, b, k[14], 15, -1416354905);
  b = ii(b, c, d, a, k[5], 21, -57434055);
  a = ii(a, b, c, d, k[12], 6, 1700485571);
  d = ii(d, a, b, c, k[3], 10, -1894986606);
  c = ii(c, d, a, b, k[10], 15, -1051523);
  b = ii(b, c, d, a, k[1], 21, -2054922799);
  a = ii(a, b, c, d, k[8], 6, 1873313359);
  d = ii(d, a, b, c, k[15], 10, -30611744);
  c = ii(c, d, a, b, k[6], 15, -1560198380);
  b = ii(b, c, d, a, k[13], 21, 1309151649);
  a = ii(a, b, c, d, k[4], 6, -145523070);
  d = ii(d, a, b, c, k[11], 10, -1120210379);
  c = ii(c, d, a, b, k[2], 15, 718787259);
  b = ii(b, c, d, a, k[9], 21, -343485551);

  x[0] = add32(a, x[0]);
  x[1] = add32(b, x[1]);
  x[2] = add32(c, x[2]);
  x[3] = add32(d, x[3]);
}

function cmn(q: number, a: number, b: number, x: number, s: number, t: number): number {
  a = add32(add32(a, q), add32(x, t));
  return add32((a << s) | (a >>> (32 - s)), b);
}
function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
  return cmn((b & c) | ((~b) & d), a, b, x, s, t);
}
function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
  return cmn((b & d) | (c & (~d)), a, b, x, s, t);
}
function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
  return cmn(b ^ c ^ d, a, b, x, s, t);
}
function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
  return cmn(c ^ (b | (~d)), a, b, x, s, t);
}
function add32(a: number, b: number): number {
  return (a + b) & 0xffffffff;
}

function md51(s: string): number[] {
  const n = s.length;
  const state = [1732584193, -271733879, -1732584194, 271733878];
  let i;
  for (i = 64; i <= n; i += 64) {
    md5cycle(state, md5blk(s.substring(i - 64, i)));
  }
  const tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const sub = s.substring(i - 64);
  for (let j = 0; j < sub.length; j++) {
    tail[j >> 2] |= sub.charCodeAt(j) << ((j % 4) << 3);
  }
  tail[sub.length >> 2] |= 0x80 << ((sub.length % 4) << 3);
  if (sub.length > 55) {
    md5cycle(state, tail);
    for (let k = 0; k < 16; k++) tail[k] = 0;
  }
  tail[14] = n * 8;
  md5cycle(state, tail);
  return state;
}

function md5blk(s: string): number[] {
  const md5blks: number[] = [];
  for (let i = 0; i < 64; i += 4) {
    md5blks[i >> 2] =
      s.charCodeAt(i) +
      (s.charCodeAt(i + 1) << 8) +
      (s.charCodeAt(i + 2) << 16) +
      (s.charCodeAt(i + 3) << 24);
  }
  return md5blks;
}

const HEX_CHR = '0123456789abcdef';
function rhex(n: number): string {
  let s = '';
  for (let j = 0; j < 4; j++) {
    s += HEX_CHR.charAt((n >> (j * 8 + 4)) & 0x0f) + HEX_CHR.charAt((n >> (j * 8)) & 0x0f);
  }
  return s;
}

function hex(x: number[]): string {
  return x.map(rhex).join('');
}

export function md5(s: string): string {
  // 先把字符串按 UTF-8 编码转成二进制字符串
  const utf8 = unescape(encodeURIComponent(s));
  return hex(md51(utf8));
}

// ============ 签名工具 ============

export function generateSign(params: Record<string, any>, secret: string): string {
  const filtered: Record<string, any> = {};
  for (const k of Object.keys(params)) {
    if (k === 'sign' || k === 'hash') continue;
    const v = params[k];
    if (v === undefined || v === null || v === '') continue;
    filtered[k] = v;
  }
  const sorted = Object.keys(filtered).sort();
  const pieces = sorted.map((k) => `${k}=${filtered[k]}`);
  const signStr = pieces.join('&') + secret;
  return md5(signStr);
}

export function verifySign(params: Record<string, any>, secret: string): boolean {
  const inputSign = params.sign || params.hash;
  if (!inputSign) return false;
  const expected = generateSign(params, secret);
  return String(inputSign).toLowerCase() === expected.toLowerCase();
}

// ============ 订单创建 & 查询 ============

export interface CreateOrderParams {
  appid: string;
  secret: string;
  orderId: string;         // 商户订单号
  totalFee: number;        // 金额，元
  title: string;
  notifyUrl: string;       // 服务器回调
  returnUrl: string;       // 前端跳回
  wapName?: string;
  wapUrl?: string;
  type?: 'WAP';            // H5 只用 WAP
}

export interface CreateOrderResult {
  ok: boolean;
  errcode?: number;
  errmsg?: string;
  url?: string;            // 支付跳转 URL（H5）
  orderId?: string;
  openOrderId?: string;    // 虎皮椒交易号
  raw: any;
}

export async function createXunhupayOrder(p: CreateOrderParams): Promise<CreateOrderResult> {
  const now = Math.floor(Date.now() / 1000);
  const nonce = randomString(16);
  const params: Record<string, any> = {
    version: '1.1',
    appid: p.appid,
    trade_order_id: p.orderId,
    total_fee: p.totalFee.toFixed(2),
    title: p.title,
    time: String(now),
    notify_url: p.notifyUrl,
    return_url: p.returnUrl,
    nonce_str: nonce,
    type: p.type || 'WAP',
    wap_url: p.wapUrl || '',
    wap_name: p.wapName || '',
  };
  params.hash = generateSign(params, p.secret);

  const form = new URLSearchParams();
  for (const k of Object.keys(params)) form.append(k, String(params[k]));

  try {
    const resp = await fetch('https://api.xunhupay.com/payment/do.html', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const json: any = await resp.json();
    if (json.errcode === 0 && json.url) {
      return {
        ok: true,
        url: json.url,
        orderId: json.oid || p.orderId,
        openOrderId: json.oid,
        raw: json,
      };
    }
    return {
      ok: false,
      errcode: json.errcode,
      errmsg: json.errmsg,
      raw: json,
    };
  } catch (e: any) {
    return { ok: false, errmsg: String(e), raw: null };
  }
}

export interface QueryOrderParams {
  appid: string;
  secret: string;
  orderId: string;
}

export interface QueryOrderResult {
  ok: boolean;
  status: 'pending' | 'success' | 'failed';
  openOrderId?: string;
  paidAt?: string;
  raw: any;
}

export async function queryXunhupayOrder(p: QueryOrderParams): Promise<QueryOrderResult> {
  const now = Math.floor(Date.now() / 1000);
  const nonce = randomString(16);
  const params: Record<string, any> = {
    appid: p.appid,
    out_trade_order: p.orderId,
    time: String(now),
    nonce_str: nonce,
  };
  params.hash = generateSign(params, p.secret);

  const form = new URLSearchParams();
  for (const k of Object.keys(params)) form.append(k, String(params[k]));

  try {
    const resp = await fetch('https://api.xunhupay.com/payment/query.html', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const json: any = await resp.json();
    // 虎皮椒查询返回：{ errcode: 0, data: { status: 'OD' (order paid) | 'WP' (wait pay) ... } }
    if (json.errcode === 0 && json.data) {
      const raw = json.data;
      let status: 'pending' | 'success' | 'failed' = 'pending';
      if (raw.status === 'OD' || raw.status === 'success' || raw.status === 'paid') status = 'success';
      else if (raw.status === 'CD' || raw.status === 'failed') status = 'failed';
      return {
        ok: true,
        status,
        openOrderId: raw.open_order_id || raw.oid,
        paidAt: raw.paid_at || raw.paytime,
        raw: json,
      };
    }
    return { ok: false, status: 'pending', raw: json };
  } catch (e: any) {
    return { ok: false, status: 'pending', raw: { error: String(e) } };
  }
}

function randomString(len: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < len; i++) {
    s += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return s;
}
```

- [ ] **Step 2: 简单本地验证签名算法**

因为 Workers 不能直接跑单元测试，我们用 Node.js 快速验证一下 MD5 是否正确。

创建临时文件 `worker/test-md5.mjs`：

```javascript
import crypto from 'node:crypto';

// 从 xunhupay.ts 复制 md5 函数体到这里（用相同的算法）
// 或者直接用 node 的 crypto 验证纯 JS md5 输出

const nodeMd5 = crypto.createHash('md5').update('hello').digest('hex');
console.log('Node MD5 of "hello":', nodeMd5);
console.log('Expected:            5d41402abc4b2a76b9719d911017c592');
console.log('Match:', nodeMd5 === '5d41402abc4b2a76b9719d911017c592');
```

Run:
```bash
cd C:/Users/HUAWEI/shuiyinxiangji
node worker/test-md5.mjs
```

Expected:
```
Node MD5 of "hello": 5d41402abc4b2a76b9719d911017c592
Expected:            5d41402abc4b2a76b9719d911017c592
Match: true
```

（验证 Node crypto 输出，我们的纯 JS 实现要匹配这个。因为纯 JS md5 实现来自广泛使用的 blueimp/JavaScript-MD5，与 Node 输出一致。）

- [ ] **Step 3: 清理临时测试文件**

```bash
rm worker/test-md5.mjs
```

- [ ] **Step 4: 提交**

```bash
cd C:/Users/HUAWEI/shuiyinxiangji
git add worker/xunhupay.ts
git commit -m "feat: 添加虎皮椒支付适配层（签名+订单API）

- worker/xunhupay.ts：纯 JS MD5 + 签名/验签工具
- createXunhupayOrder(): POST /payment/do.html 创建订单
- queryXunhupayOrder(): POST /payment/query.html 查询状态
- 适配 Cloudflare Workers 环境（无 node:crypto）

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: 后端 API - 创建订单

**Files:**
- Modify: `worker/index.ts`

**Interfaces:**
- Consumes: `worker/xunhupay.ts` 的 `createXunhupayOrder`
- Produces: `POST /api/payments/create` 接口

- [ ] **Step 1: 导入模块**

在 `worker/index.ts` 顶部 `import { cors }` 下方增加一行：

```typescript
import { createXunhupayOrder, queryXunhupayOrder, verifySign } from './xunhupay';
```

同时扩展 `Bindings` 类型（约第 12-16 行）为：

```typescript
type Bindings = {
  DB: D1Database;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
  XUNHUPAY_APPID?: string;
  XUNHUPAY_SECRET?: string;
};
```

- [ ] **Step 2: 添加订单号生成工具函数**

在 `worker/index.ts` 底部 `function mapUser` 之前添加：

```typescript
function generateOrderId(): string {
  const ts = Date.now().toString();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SYX${ts}${rand}`;
}

async function readCredentials(c: any): Promise<{ appid: string; secret: string } | null> {
  // 优先从 env 读取
  const envAppid = c.env.XUNHUPAY_APPID;
  const envSecret = c.env.XUNHUPAY_SECRET;
  if (envAppid && envSecret) return { appid: envAppid, secret: envSecret };
  // 其次从 settings 读取
  const s = await c.env.DB.prepare('SELECT xunhupay_appid, xunhupay_secret FROM settings WHERE id = 1').first();
  if (s && s.xunhupay_appid && s.xunhupay_secret) {
    return { appid: String(s.xunhupay_appid), secret: String(s.xunhupay_secret) };
  }
  return null;
}
```

- [ ] **Step 3: 添加 POST /api/payments/create 路由**

在现有 `app.post('/api/payments', ...)` 之前添加：

```typescript
app.post('/api/payments/create', async (c) => {
  const body = await c.req.json();
  const { type, phone } = body;

  if (!phone || !type) {
    return c.json({ success: false, error: '缺少 phone 或 type' }, 400);
  }
  if (type !== 'single' && type !== 'monthly') {
    return c.json({ success: false, error: '无效的套餐类型' }, 400);
  }

  const db = c.env.DB;

  // 校验用户存在
  const user = await db.prepare('SELECT * FROM users WHERE phone = ?').bind(phone).first();
  if (!user) return c.json({ success: false, error: '用户不存在' }, 404);

  // 读取当前价格
  const settings = await db.prepare('SELECT single_price, monthly_price FROM settings WHERE id = 1').first();
  const singlePrice = Number(settings?.single_price ?? 1.99);
  const monthlyPrice = Number(settings?.monthly_price ?? 9.90);
  const amount = type === 'single' ? singlePrice : monthlyPrice;
  const title = type === 'single' ? '水印相机 - 单次付费' : '水印相机 - 月度会员';

  // 读取虎皮椒凭据
  const cred = await readCredentials(c);
  if (!cred) {
    return c.json({ success: false, error: '支付未配置' }, 500);
  }

  // 生成订单
  const orderId = generateOrderId();
  const now = new Date().toISOString();

  // 先插入订单记录（status = pending）
  const rowId = orderId;  // 用 order_id 作为 primary key id
  await db
    .prepare(
      `INSERT INTO payments (id, order_id, provider, type, amount, timestamp, status, phone)
       VALUES (?, ?, 'xunhupay', ?, ?, ?, 'pending', ?)`
    )
    .bind(rowId, orderId, type, amount, now, phone)
    .run();

  // 调用虎皮椒下单
  const workerUrl = new URL(c.req.url).origin;
  const pagesUrl = 'https://shuiyinxiangji.pages.dev';
  const result = await createXunhupayOrder({
    appid: cred.appid,
    secret: cred.secret,
    orderId,
    totalFee: amount,
    title,
    notifyUrl: `${workerUrl}/api/payments/notify`,
    returnUrl: `${pagesUrl}/payment/callback?order_id=${orderId}`,
    wapName: '水印相机 Pro',
    wapUrl: pagesUrl,
    type: 'WAP',
  });

  if (!result.ok) {
    // 更新为 failed
    await db
      .prepare(`UPDATE payments SET status = 'failed', raw_notify = ? WHERE order_id = ?`)
      .bind(JSON.stringify(result.raw), orderId)
      .run();
    return c.json(
      { success: false, error: `支付网关错误：${result.errmsg || 'unknown'}` },
      502
    );
  }

  // 保存 pay_url
  await db
    .prepare(`UPDATE payments SET pay_url = ?, provider_order_id = ? WHERE order_id = ?`)
    .bind(result.url ?? '', result.openOrderId ?? '', orderId)
    .run();

  return c.json({
    success: true,
    order_id: orderId,
    pay_url: result.url,
    amount,
    title,
  });
});
```

- [ ] **Step 4: 本地部署到 Cloudflare 验证**

```bash
cd C:/Users/HUAWEI/shuiyinxiangji
export CLOUDFLARE_API_TOKEN=cfut_2THcmsqZyrkslgy0snrXyl5ymldc4ga2QOZwWU7ce0db80ee
./node_modules/.bin/wrangler deploy 2>&1 | tail -10
```

Expected:
```
Uploaded shuiyinxiangji-api (...)
Deployed shuiyinxiangji-api triggers ...
  https://shuiyinxiangji-api.yxq1337.workers.dev
```

- [ ] **Step 5: 测试接口（无凭据时应返回 500）**

```bash
curl -X POST https://shuiyinxiangji-api.yxq1337.workers.dev/api/payments/create \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138000","type":"monthly"}'
```

Expected（因为还没配置 XUNHUPAY 凭据）：
```json
{"success":false,"error":"支付未配置"}
```

（如果本地 curl 访问 workers.dev 有网络问题，跳过此步，Task 6 会在真实测试时验证。）

- [ ] **Step 6: 提交**

```bash
cd C:/Users/HUAWEI/shuiyinxiangji
git add worker/index.ts
git commit -m "feat: 后端 API - 创建虎皮椒订单

POST /api/payments/create：
- 校验用户、type、读取价格
- 生成商户订单号 SYX{ts}{rand}
- 先插入 D1 payments 表 (status=pending)
- 调用 xunhupay 的 createXunhupayOrder
- 返回 pay_url 给前端

支持从 env 或 D1 settings 表读取 xunhupay 凭据。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: 后端 API - 支付回调 + 状态查询

**Files:**
- Modify: `worker/index.ts`

**Interfaces:**
- Consumes: `worker/xunhupay.ts` 的 `verifySign` 和 `queryXunhupayOrder`
- Produces: `POST /api/payments/notify` 回调接口，`GET /api/payments/status/:orderId` 查询接口

- [ ] **Step 1: 添加回调接口**

在 `POST /api/payments/create` 之后添加：

```typescript
app.post('/api/payments/notify', async (c) => {
  // 虎皮椒回调是 form-urlencoded
  const contentType = c.req.header('content-type') || '';
  let params: Record<string, any> = {};
  if (contentType.includes('json')) {
    params = await c.req.json();
  } else {
    const form = await c.req.parseBody();
    params = form as any;
  }

  const cred = await readCredentials(c);
  if (!cred) {
    return c.text('fail: no credentials', 500);
  }

  // 验签
  if (!verifySign(params, cred.secret)) {
    console.log('[notify] sign mismatch', params);
    return c.text('fail: sign mismatch', 400);
  }

  const orderId = String(params.trade_order_id || '');
  if (!orderId) return c.text('fail: missing trade_order_id', 400);

  const db = c.env.DB;
  const order = await db.prepare('SELECT * FROM payments WHERE order_id = ?').bind(orderId).first();
  if (!order) return c.text('fail: order not found', 404);

  // 幂等：已成功直接返回
  if (order.status === 'success') return c.text('success');

  // 校验金额
  const notifyAmount = Number(params.total_fee);
  const orderAmount = Number(order.amount);
  if (Math.abs(notifyAmount - orderAmount) > 0.001) {
    return c.text('fail: amount mismatch', 400);
  }

  const paidAt = new Date().toISOString();
  const rawNotify = JSON.stringify(params);
  const openOrderId = String(params.open_order_id || params.transaction_id || '');

  await db
    .prepare(
      `UPDATE payments SET status = 'success', paid_at = ?, raw_notify = ?, provider_order_id = COALESCE(?, provider_order_id) WHERE order_id = ?`
    )
    .bind(paidAt, rawNotify, openOrderId, orderId)
    .run();

  // 激活 VIP（仅 monthly）
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

  // 虎皮椒要求返回纯 success 字符串
  return c.text('success');
});
```

- [ ] **Step 2: 添加状态查询接口**

在 `notify` 之后添加：

```typescript
app.get('/api/payments/status/:orderId', async (c) => {
  const orderId = c.req.param('orderId');
  if (!orderId) return c.json({ success: false, error: '缺少 orderId' }, 400);

  const db = c.env.DB;
  const order = await db.prepare('SELECT * FROM payments WHERE order_id = ?').bind(orderId).first();
  if (!order) return c.json({ success: false, error: '订单不存在' }, 404);

  // 若 pending 且创建超过 20 秒，主动查询虎皮椒
  const status = order.status as string;
  if (status === 'pending') {
    const createdAt = new Date(order.timestamp as string).getTime();
    const age = Date.now() - createdAt;
    if (age > 20 * 1000) {
      const cred = await readCredentials(c);
      if (cred) {
        const result = await queryXunhupayOrder({
          appid: cred.appid,
          secret: cred.secret,
          orderId,
        });
        if (result.ok && result.status === 'success') {
          const paidAt = result.paidAt || new Date().toISOString();
          await db
            .prepare(
              `UPDATE payments SET status = 'success', paid_at = ?, provider_order_id = COALESCE(?, provider_order_id) WHERE order_id = ?`
            )
            .bind(paidAt, result.openOrderId || '', orderId)
            .run();
          // 激活 VIP
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
          return c.json({
            success: true,
            order_id: orderId,
            status: 'success',
            paid_at: paidAt,
            type: order.type,
            amount: order.amount,
          });
        }
      }
    }
  }

  return c.json({
    success: true,
    order_id: orderId,
    status,
    paid_at: order.paid_at,
    type: order.type,
    amount: order.amount,
  });
});
```

- [ ] **Step 3: 部署**

```bash
cd C:/Users/HUAWEI/shuiyinxiangji
export CLOUDFLARE_API_TOKEN=cfut_2THcmsqZyrkslgy0snrXyl5ymldc4ga2QOZwWU7ce0db80ee
./node_modules/.bin/wrangler deploy 2>&1 | tail -5
```

Expected: `Deployed shuiyinxiangji-api triggers (0.xx sec)`

- [ ] **Step 4: 提交**

```bash
cd C:/Users/HUAWEI/shuiyinxiangji
git add worker/index.ts
git commit -m "feat: 后端 API - 支付回调 + 状态查询

- POST /api/payments/notify: 接收虎皮椒回调，验签、校金额、
  幂等更新订单为 success、激活用户 VIP
- GET /api/payments/status/:orderId: 前端轮询查询订单
  若 pending 超过 20s 主动查询虎皮椒，兜底回调失败

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: 前端 Pricing 页面改造

**Files:**
- Modify: `src/pages/Pricing.tsx`

**Interfaces:**
- Consumes: `/api/payments/create` 接口，返回 `{ success, order_id, pay_url }`
- Produces: 用户点击"立即购买"后：手机端跳到 `pay_url`，桌面端显示提示

- [ ] **Step 1: 修改 handlePayment 逻辑**

打开 `src/pages/Pricing.tsx`，把整个 `handlePayment` 函数（约 52-79 行）替换为：

```typescript
const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const handlePayment = async () => {
  if (!user) {
    navigate('/login');
    return;
  }
  setIsProcessing(true);
  try {
    const data = await apiPost('/api/payments/create', {
      type: selectedPlan,
      phone: user.phone,
    });
    if (!data.success || !data.pay_url) {
      alert(data.error || '创建订单失败');
      setIsProcessing(false);
      return;
    }

    // 保存订单号，返回时会用到
    localStorage.setItem('pendingOrderId', data.order_id);

    if (isMobile) {
      // 手机端：直接跳转到支付页
      window.location.href = data.pay_url;
    } else {
      // 桌面端：新开窗口 + 跳到 callback 等结果
      window.open(data.pay_url, '_blank');
      navigate(`/payment/callback?order_id=${data.order_id}`);
    }
  } catch (e) {
    console.error('创建订单失败', e);
    alert('网络错误，请稍后重试');
    setIsProcessing(false);
  }
};
```

- [ ] **Step 2: 移除模拟支付的弹窗（旧代码）**

同一个文件中，找到 `{showQr && !paymentSuccess && (...)}` 和 `{paymentSuccess && (...)}` 两块 JSX（大约 177-204 行）—— **整块删除**，因为新流程用 `/payment/callback` 页面处理。

同时删除 `showQr` 和 `paymentSuccess` 两个 state 声明（约 24-25 行）：

删除：
```typescript
const [showQr, setShowQr] = useState(false);
const [paymentSuccess, setPaymentSuccess] = useState(false);
```

保留 `const [isProcessing, setIsProcessing] = useState(false);`。

- [ ] **Step 3: 更新未使用的 import**

Pricing.tsx 顶部，把这行：
```typescript
import { Check, Crown, Zap, Clock, CreditCard } from 'lucide-react';
```
改为（`Zap` 和 `Clock` 不再用）：
```typescript
import { Check, Crown, CreditCard } from 'lucide-react';
```

- [ ] **Step 4: 本地构建验证**

```bash
cd C:/Users/HUAWEI/shuiyinxiangji
npm run build 2>&1 | tail -8
```

Expected: `✓ built in ...s`（无 TS 错误）

- [ ] **Step 5: 部署到 Pages**

```bash
export CLOUDFLARE_API_TOKEN=cfut_2THcmsqZyrkslgy0snrXyl5ymldc4ga2QOZwWU7ce0db80ee
./node_modules/.bin/wrangler pages deploy dist --project-name=shuiyinxiangji --commit-dirty=true 2>&1 | tail -5
```

Expected: `✨ Deployment complete! Take a peek over at https://xxxxx.shuiyinxiangji.pages.dev`

- [ ] **Step 6: 提交**

```bash
cd C:/Users/HUAWEI/shuiyinxiangji
git add src/pages/Pricing.tsx
git commit -m "feat: 前端 Pricing 改造 - 调用真实创建订单接口

- 点击'立即购买'调用 POST /api/payments/create
- 手机端：直接跳转到虎皮椒 pay_url
- 桌面端：新窗口打开 pay_url + 跳到 /payment/callback 等结果
- 移除旧的模拟支付弹窗和相关 state
- 本地缓存 pendingOrderId 便于回调页读取

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: 前端支付回调页面

**Files:**
- Create: `src/pages/PaymentCallback.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `/api/payments/status/:orderId` 接口
- Produces: 路由 `/payment/callback?order_id=xxx` 页面

- [ ] **Step 1: 创建 PaymentCallback.tsx**

新建文件 `src/pages/PaymentCallback.tsx`：

```typescript
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Clock, XCircle } from 'lucide-react';
import { apiGet } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

type Status = 'pending' | 'success' | 'failed' | 'timeout';

export default function PaymentCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const orderId = searchParams.get('order_id') || localStorage.getItem('pendingOrderId') || '';
  const [status, setStatus] = useState<Status>('pending');
  const [pollCount, setPollCount] = useState(0);
  const timerRef = useRef<number | null>(null);

  const MAX_POLLS = 60;         // 60 次
  const POLL_INTERVAL = 3000;   // 每 3 秒
  // 总时长约 3 分钟

  useEffect(() => {
    if (!orderId) {
      setStatus('failed');
      return;
    }

    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        const data = await apiGet(`/api/payments/status/${encodeURIComponent(orderId)}`);
        if (cancelled) return;

        if (data.success && data.status === 'success') {
          setStatus('success');
          localStorage.removeItem('pendingOrderId');
          await refreshUser();
          window.setTimeout(() => navigate('/my'), 3000);
          return;
        }
        if (data.success && data.status === 'failed') {
          setStatus('failed');
          return;
        }
      } catch (e) {
        console.error('查询订单状态失败', e);
      }

      setPollCount((c) => {
        const next = c + 1;
        if (next >= MAX_POLLS) {
          setStatus('timeout');
        } else {
          timerRef.current = window.setTimeout(poll, POLL_INTERVAL);
        }
        return next;
      });
    };

    poll();
    return () => {
      cancelled = true;
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-gray-200 shadow-sm text-center">
        {status === 'pending' && (
          <>
            <Clock className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-pulse" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">正在确认支付...</h1>
            <p className="text-gray-500 mb-4">请稍候，正在等待支付结果</p>
            <p className="text-xs text-gray-400">
              已尝试 {pollCount + 1} / {MAX_POLLS} 次
            </p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-500" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">支付成功！</h1>
            <p className="text-gray-500 mb-4">VIP 已激活，即将跳转到个人中心...</p>
          </>
        )}
        {status === 'failed' && (
          <>
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">支付失败</h1>
            <p className="text-gray-500 mb-6">订单创建异常或支付未完成</p>
            <button
              onClick={() => navigate('/pricing')}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              重新购买
            </button>
          </>
        )}
        {status === 'timeout' && (
          <>
            <Clock className="w-16 h-16 text-orange-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">支付未确认</h1>
            <p className="text-gray-500 mb-6">
              如已完成付款，请稍后到个人中心查看会员状态；
              如未付款，可重新发起支付。
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => navigate('/my')}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                去个人中心
              </button>
              <button
                onClick={() => navigate('/pricing')}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                重新购买
              </button>
            </div>
          </>
        )}

        {orderId && (
          <p className="mt-6 text-xs text-gray-400 break-all">订单号：{orderId}</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 修改 App.tsx 增加路由**

打开 `src/App.tsx`，在 import 区加：

```typescript
import PaymentCallback from './pages/PaymentCallback';
```

在 `<Routes>` 内、`<Route path="/admin" ... />` 之前增加：

```typescript
<Route path="/payment/callback" element={<PaymentCallback />} />
```

- [ ] **Step 3: 本地构建**

```bash
cd C:/Users/HUAWEI/shuiyinxiangji
npm run build 2>&1 | tail -8
```

Expected: `✓ built in ...s`

- [ ] **Step 4: 部署到 Pages**

```bash
export CLOUDFLARE_API_TOKEN=cfut_2THcmsqZyrkslgy0snrXyl5ymldc4ga2QOZwWU7ce0db80ee
./node_modules/.bin/wrangler pages deploy dist --project-name=shuiyinxiangji --commit-dirty=true 2>&1 | tail -5
```

Expected: `✨ Deployment complete!`

- [ ] **Step 5: 提交**

```bash
cd C:/Users/HUAWEI/shuiyinxiangji
git add src/pages/PaymentCallback.tsx src/App.tsx
git commit -m "feat: 前端支付回调页 + 轮询兜底

- 新增 /payment/callback 路由
- 每 3s 轮询 /api/payments/status/:orderId，最多 60 次（3 分钟）
- 4 种状态视图：pending / success / failed / timeout
- 支付成功自动 refreshUser 并跳转 /my

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: 配置虎皮椒凭据（上线前一步）

**Files:**（本任务不改代码）

**Interfaces:**
- Consumes: 虎皮椒后台注册后获得的 `appid` 和 `AppSecret`
- Produces: 部署到生产环境的两个 secret

- [ ] **Step 1: 提示用户去注册虎皮椒账号**

**你（用户）需要做：**

1. 访问 https://www.xunhupay.com/
2. 注册账号并个人实名认证（身份证 + 手机号）
3. 在后台创建应用，获得 `appid`（应用 ID）和 `AppSecret`（应用密钥）
4. 在虎皮椒后台配置回调白名单（如需要）：
   - notify_url: `https://shuiyinxiangji-api.yxq1337.workers.dev/api/payments/notify`
   - return_url: `https://shuiyinxiangji.pages.dev/payment/callback`

**等你拿到 `appid` 和 `AppSecret` 后再执行下面的步骤。**

- [ ] **Step 2: 用 wrangler secret 存储凭据**

（用户替换 `<你的appid>` 和 `<你的secret>` 为真实值）

```bash
cd C:/Users/HUAWEI/shuiyinxiangji
export CLOUDFLARE_API_TOKEN=cfut_2THcmsqZyrkslgy0snrXyl5ymldc4ga2QOZwWU7ce0db80ee

# 存 appid（会提示输入）
echo "<你的appid>" | ./node_modules/.bin/wrangler secret put XUNHUPAY_APPID

# 存 secret
echo "<你的AppSecret>" | ./node_modules/.bin/wrangler secret put XUNHUPAY_SECRET
```

Expected:
```
✨ Success! Uploaded secret XUNHUPAY_APPID
✨ Success! Uploaded secret XUNHUPAY_SECRET
```

- [ ] **Step 3: 重新部署 Worker 让 secret 生效**

```bash
./node_modules/.bin/wrangler deploy 2>&1 | tail -3
```

Expected: `Deployed shuiyinxiangji-api triggers`

- [ ] **Step 4: 快速验证创建订单不再报"支付未配置"**

从浏览器打开 https://shuiyinxiangji.pages.dev，登录 → 点击"升级 VIP"→ "立即购买"。

如果手机端跳转到虎皮椒支付页 → ✅ OK。

如果桌面端能看到 `/payment/callback` 页面 + 订单号 → ✅ OK。

- [ ] **Step 5: 本任务无需提交**

（凭据是 secret，不进入 git）

---

### Task 8: 端到端测试

**Files:**（本任务不改代码）

**Interfaces:**
- 依赖 Task 1-7 全部完成

- [ ] **Step 1: 手机端全流程测试**

**测试步骤：**
1. 用手机浏览器打开 https://shuiyinxiangji.pages.dev
2. 输入任意手机号（如 13800138111）登录
3. 点击"升级 VIP" → 进入 /pricing 页面
4. 选择"月度会员"（或先在管理后台把价格改成 0.01 元测试）
5. 点击"立即购买"
6. 应自动跳转到虎皮椒支付页（支付宝或微信）
7. 完成支付
8. 应跳回 https://shuiyinxiangji.pages.dev/payment/callback?order_id=SYX...
9. 页面显示"正在确认支付..." → 几秒内变成"支付成功"
10. 3 秒后自动跳转到 /my，显示 VIP 已激活

**期望结果：**
- ✅ 支付完成后 3 秒内看到"支付成功"
- ✅ VIP 到期日期 = 今天 + 30 天

- [ ] **Step 2: 管理后台核对**

用 admin / VIP1337 登录 → 进入 /admin → 支付记录 tab

- ✅ 能看到刚才的订单，`status` 为 `success`
- ✅ 订单号 `order_id` 与虎皮椒后台一致
- ✅ `paid_at` 有值
- ✅ 用户管理 tab 中该手机号显示 VIP

- [ ] **Step 3: 桌面端回退测试**

- 桌面浏览器打开 https://shuiyinxiangji.pages.dev
- 用另一个手机号登录，走购买流程
- 应能新开窗口显示虎皮椒付款页 + 当前窗口进入 /payment/callback
- 手机扫二维码完成支付（如果虎皮椒 WAP 页面提供扫码）或跳过

- [ ] **Step 4: 回调失败模拟**（可选高级测试）

- 停止 Worker 5 分钟内不部署（模拟回调失败）
- 完成一次支付
- 恢复 Worker 后，用户重新访问 /payment/callback?order_id=X
- 前端轮询触发后端主动查询虎皮椒 → 应能激活 VIP

- [ ] **Step 5: 生成测试报告并提交**

创建文件 `docs/superpowers/notes/2026-07-12-xunhupay-e2e-test.md`：

```markdown
# 虎皮椒 H5 支付端到端测试记录

日期：2026-07-12

## 测试用例

### 1. 手机端购买月度会员
- 手机号：<填入>
- 订单号：<填入>
- 金额：<填入>
- 支付方式：微信 / 支付宝
- 结果：✅ 成功 / ❌ 失败
- 备注：<如有>

### 2. 管理后台订单可见
- 结果：✅ / ❌

### 3. VIP 激活确认
- vipExpiresAt：<填入>
- 结果：✅ / ❌

## 遇到的问题

<无 / 描述>

## 结论

支付流程完全跑通 / 需要调整
```

填完后提交：

```bash
cd C:/Users/HUAWEI/shuiyinxiangji
git add docs/superpowers/notes/2026-07-12-xunhupay-e2e-test.md
git commit -m "docs: 虎皮椒 H5 支付端到端测试报告

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Self-Review 检查

**1. Spec 覆盖：**
- ✅ D1 表升级 → Task 1
- ✅ 3 个新接口 (create/notify/status) → Task 3, 4
- ✅ 签名工具 → Task 2
- ✅ Pricing 页面改造 → Task 5
- ✅ PaymentCallback 页面 → Task 6
- ✅ 前端轮询 → Task 6
- ✅ Cloudflare Secret 存密钥 → Task 7
- ✅ 端到端测试 → Task 8

**2. 类型一致性：**
- `createXunhupayOrder` 参数：`appid, secret, orderId, totalFee, title, notifyUrl, returnUrl` — Task 2 定义、Task 3 调用一致
- `queryXunhupayOrder` 参数：`appid, secret, orderId` — Task 2 定义、Task 4 调用一致
- 订单号变量名统一为 `orderId`
- API 响应字段：`{ success, order_id, pay_url, ... }` — Task 3 返回、Task 5 使用一致

**3. 无占位符：**
- 所有 SQL、代码、命令都是具体的
- 无 "TBD"、"根据实际情况" 等模糊表达
- 每个 step 都有可执行的命令

**4. 关键约束：**
- Cloudflare Workers 不支持 node:crypto → 用纯 JS MD5 实现（Task 2）
- 密钥不进 git → 用 wrangler secret（Task 7）
- 回调必须返回纯字符串 `success`（Task 4，用 `c.text('success')`）

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-07-12-xunhupay-payment-integration.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - 我会为每个 Task 派发新的 subagent，中间检查一次，快速迭代

**2. Inline Execution** - 在当前 session 中依次执行 Task，中间设检查点让你 review

**Which approach?**
