# 支付系统实际收款改造 — 虎皮椒 H5 支付集成

**创建日期**: 2026-07-12
**主题**: 将模拟支付替换为虎皮椒（xunhupay）真实支付
**状态**: 待实现

---

## 一、背景与目标

### 当前状态
- 前端点击"立即购买"后，2 秒模拟支付完成，后端直接标记为 `success` 并激活 VIP。
- 无真实资金流转，无法商业化上线。
- 参见 [`src/pages/Pricing.tsx:52-79`](src/pages/Pricing.tsx#L52-L79)（模拟支付逻辑）与 [`worker/index.ts` `/api/payments`](worker/index.ts) 接口。

### 目标
- 接入**虎皮椒免签约版**（xunhupay.com），实现真实的支付宝/微信 H5 支付。
- 用户在**手机浏览器**上完成支付；桌面端可给出"手机打开"提示（后续可扩展扫码）。
- 支付失败/回调延迟时，前端主动轮询兜底，保证订单状态最终一致。
- 现有的普通用户手机号登录、管理员密码登录、Cloudflare Workers + D1 后端、Pages 前端 —— 全部保留。

### 非目标（本次不做）
- 桌面 PC 网页扫码支付（先只做 H5，扩展留给下一版）
- 微信内 JSAPI 支付（H5 已能覆盖大部分场景）
- 自定义域名（暂用 `workers.dev`，先跑通再升级；预留切换路径）
- OCR 截图审核（虎皮椒 API 直接回调支付结果，无需截图）
- 年度会员套餐（先只上线现有 `single` 和 `monthly` 两档）

---

## 二、总体架构

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│  浏览器 H5  │────▶│  Worker API  │────▶│  虎皮椒 API   │
│  (Pages)    │◀────│  (D1 DB)     │◀────│  xunhupay.com │
└─────────────┘     └──────────────┘     └───────────────┘
      ▲                    ▲                    │
      │  轮询 (3s)         │  回调通知           │
      └────────────────────┴────────────────────┘
```

### 请求流程
1. **用户下单** → 前端 → Worker `/api/payments/create`
2. Worker **生成订单** → D1 存储（status = `pending`）
3. Worker **签名后调用虎皮椒** `doPayment.html` 接口
4. 虎皮椒返回**支付链接 URL** (`url_qrcode` 或 `url`) → Worker → 前端
5. 前端**打开支付链接**（手机端跳转到支付宝/微信）
6. 用户完成支付 → 虎皮椒**回调**（notify）→ Worker `/api/payments/notify`
7. Worker **验签** → 更新订单为 `success` → 激活 VIP
8. 前端**每 3 秒轮询** `/api/payments/status/:orderId` → 拿到 `success` → 显示成功
9. 兜底：如果轮询发现订单还在 `pending`，Worker 主动调用虎皮椒 `queryOrder` 接口拉取最新状态

---

## 三、数据库变化

### `payments` 表结构升级

现有字段：
```sql
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,           -- 'single' | 'monthly'
  amount REAL NOT NULL,
  timestamp TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success',
  phone TEXT NOT NULL
);
```

**新增字段：**
```sql
ALTER TABLE payments ADD COLUMN order_id TEXT;              -- 商户订单号（唯一）
ALTER TABLE payments ADD COLUMN provider TEXT DEFAULT 'xunhupay';  -- 支付网关
ALTER TABLE payments ADD COLUMN provider_order_id TEXT;     -- 虎皮椒返回的交易号
ALTER TABLE payments ADD COLUMN pay_method TEXT;            -- 'wechat' | 'alipay'
ALTER TABLE payments ADD COLUMN pay_url TEXT;               -- 支付链接（H5）
ALTER TABLE payments ADD COLUMN paid_at TEXT;               -- 实际支付完成时间
ALTER TABLE payments ADD COLUMN raw_notify TEXT;            -- 原始回调 JSON（调试用）

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
```

### 订单状态机
```
pending → success   (支付成功，激活 VIP)
pending → failed    (支付失败或订单超时 30 分钟)
pending → cancelled (用户主动取消)
```

### `settings` 表新增字段
```sql
ALTER TABLE settings ADD COLUMN xunhupay_appid TEXT DEFAULT '';
ALTER TABLE settings ADD COLUMN xunhupay_secret TEXT DEFAULT '';
```

**注意：** `xunhupay_appid` 和 `xunhupay_secret` 也可以存到 Cloudflare Secret（通过 `wrangler secret put`），但存 D1 便于管理员在后台配置。推荐**同时支持两种方式**（环境变量优先）。

---

## 四、后端 API 变化

### 4.1 新增接口

#### `POST /api/payments/create`
**用途：** 创建订单 + 调用虎皮椒生成支付链接

**请求体：**
```json
{
  "type": "monthly",       // 'single' | 'monthly'
  "phone": "13800138000"   // 用户手机号
}
```

**处理逻辑：**
1. 校验用户和 `type`
2. 从 `settings` 表读取当前价格
3. 生成 `order_id = "SYX" + timestamp + random4`（如 `SYX1720780800A3F2`）
4. 插入 `payments` 表，`status = 'pending'`
5. 构建虎皮椒请求参数：
   ```
   version: '1.1'
   appid: <secret>
   trade_order_id: order_id
   total_fee: 价格
   title: '水印相机 - 月度会员'
   notify_url: 'https://<worker_domain>/api/payments/notify'
   return_url: 'https://<pages_domain>/payment/callback?order_id={order_id}'
   type: 'WAP'            // WAP 支付（H5）
   wap_url: 'https://<pages_domain>'
   wap_name: '水印相机 Pro'
   plugins: 'xunhupay'
   time: unix时间戳
   nonce_str: 随机字符串
   ```
6. 生成 MD5 签名（按字典序拼接 + secret）
7. POST 请求虎皮椒 `https://api.xunhupay.com/payment/do.html`（新版接口 v1.1）
8. 返回给前端：
   ```json
   {
     "success": true,
     "order_id": "SYX1720780800A3F2",
     "pay_url": "https://xunhupay.com/wappay?openid=xxx"
   }
   ```

#### `POST /api/payments/notify`
**用途：** 接收虎皮椒回调（服务器到服务器）

**处理逻辑：**
1. 解析虎皮椒 POST 过来的表单参数
2. 验签（去掉 `sign` 字段 + 字典序拼接 + secret + md5）
3. 找到对应的 `order_id`，若已是 `success` → 直接返回 `success`（防重放）
4. 校验 `total_fee` 与订单金额一致
5. 更新订单为 `success`，记录 `provider_order_id`、`paid_at`、`raw_notify`
6. 如是 `monthly` → 更新 `users` 表激活/延长 VIP
7. **响应必须返回纯字符串 `success`**（否则虎皮椒会重试）

#### `GET /api/payments/status/:orderId`
**用途：** 前端轮询查询订单状态

**处理逻辑：**
1. 从 D1 读取订单
2. 如果 `status = 'pending'` 且订单创建超过 20 秒 → 主动调用虎皮椒 `queryOrder` 接口
3. 拉取虎皮椒最新状态 → 更新本地订单
4. 返回：
   ```json
   {
     "success": true,
     "order_id": "SYX...",
     "status": "pending" | "success" | "failed",
     "paid_at": "2026-07-12T10:30:00Z"
   }
   ```

### 4.2 修改现有接口

#### `POST /api/payments`（旧接口）
- 保留但**标记为 deprecated**，只允许管理员手动创建订单（用于测试或手工补单）
- 生产流量走 `/api/payments/create`

#### `GET /api/admin/payments`
- 返回字段增加：`order_id`, `provider`, `pay_method`, `paid_at`
- 前端管理后台可根据 `provider_order_id` 到虎皮椒后台核对

---

## 五、前端流程变化

### 5.1 `Pricing.tsx` 页面改造

**新的用户流程：**

```
[选套餐] → [立即购买]
       ↓
   前端调用 /api/payments/create
       ↓
   拿到 pay_url + order_id
       ↓
   ┌─────────────┴─────────────┐
   │手机浏览器   │  桌面浏览器  │
   ├─────────────┼─────────────┤
   │直接跳转     │  显示提示：  │
   │pay_url      │  "请用手机   │
   │(微信/支付宝)│  浏览器打开" │
   │             │  + 二维码    │
   └─────────────┴─────────────┘
       ↓
   用户完成支付 → 跳回 return_url
       ↓
   进入 /payment/callback?order_id=XXX
       ↓
   前端每 3 秒轮询 /api/payments/status/:orderId
   (最多轮询 60 次，即 3 分钟)
       ↓
   status === 'success' → 显示"支付成功" → 3 秒后跳转到 /my
   status === 'failed'  → 显示"支付失败" → 允许重试
```

### 5.2 新增页面 `PaymentCallback.tsx`

**URL：** `/payment/callback?order_id=SYX...`

**功能：**
- 显示"正在确认支付..."
- 每 3 秒调用 `/api/payments/status/:orderId`
- 支付成功 → 显示 ✅ + 3 秒后跳转到 `/my`
- 3 分钟仍 pending → 显示"支付未确认，如已付款请稍后到个人中心查看" + 联系客服链接

### 5.3 设备类型判断

在前端用 `navigator.userAgent` 简单判断：
```typescript
const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);
```

**桌面场景**：直接把 `pay_url` 用 `qrcode.js` 生成二维码，用户用手机扫码打开。

---

## 六、错误处理与边界情况

| 场景 | 处理 |
|---|---|
| 虎皮椒 API 超时 | 前端显示"网络繁忙，请重试"，订单保持 pending |
| 虎皮椒返回错误码 | Worker 记录 error 到日志，前端展示友好提示 |
| 用户支付后关闭浏览器 | 回调仍会激活 VIP，用户下次登录自动看到 VIP 状态 |
| 回调签名验证失败 | 拒绝请求，返回 `fail` |
| 重复回调 | 幂等处理：若订单已 success，直接返回 `success` |
| 订单金额被篡改 | 回调校验 `total_fee`，不一致则拒绝 |
| 用户创建多个订单 | 允许，但 UI 只让用户看到最新一个 |
| 支付 30 分钟仍未完成 | 定时任务（暂缺，先手动清理）标记为 `failed` |
| 前端轮询失败 | 每 3 秒重试，超过 60 次显示"未确认"提示 |

---

## 七、安全考量

1. **签名密钥 `xunhupay_secret`**
   - 存储位置优先级：`env.XUNHUPAY_SECRET` > `settings.xunhupay_secret`（D1）
   - 部署时用 `wrangler secret put XUNHUPAY_SECRET` 存 Cloudflare Secret
   - **不写在代码中**，不提交到 GitHub

2. **回调防伪造**
   - 所有回调必须验签，签名错误一律拒绝
   - 校验 `total_fee` 与订单金额一致（防止 0.01 元付款激活 VIP）

3. **回调幂等**
   - 用 `order_id` 唯一约束
   - 已 `success` 状态直接返回，不重复激活 VIP

4. **前端参数不可信**
   - 后端从 D1 读价格，不接受前端传入的 `amount`
   - 后端从 `phone`（认证过的用户）关联订单

5. **CORS**
   - 回调接口无需 CORS（虎皮椒直接 POST）
   - 前端接口保持现有 CORS 配置

---

## 八、部署配置

### `wrangler.toml` 环境变量新增
```toml
[vars]
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "VIP1337"
# XUNHUPAY_APPID 和 XUNHUPAY_SECRET 用 secret 存储
```

### 部署时执行
```bash
# 存密钥（不进入 git）
npx wrangler secret put XUNHUPAY_APPID
npx wrangler secret put XUNHUPAY_SECRET

# 数据库表升级
npx wrangler d1 execute shuiyinxiangji-db --file=worker/schema-migrate-v2.sql --remote

# 部署 Worker
npm run deploy:worker

# 部署 Pages
npm run deploy:pages
```

### 前端环境变量
`.env.production` 已配置：
```
VITE_API_BASE=https://shuiyinxiangji-api.yxq1337.workers.dev
```

---

## 九、测试计划

### 单元测试（可选，先跳过）
- MD5 签名生成
- 签名验证
- 订单状态机

### 手动测试清单
1. ✅ 未登录用户点击购买 → 跳到登录页
2. ✅ 已登录用户下单 → 后端返回订单号 + pay_url
3. ✅ 手机浏览器打开 pay_url → 唤起微信/支付宝
4. ✅ 支付完成 → 跳回 callback 页面
5. ✅ 前端轮询到 success → 显示成功 + 跳转到 /my
6. ✅ /my 页面显示 VIP 已激活 + 到期日期
7. ✅ 管理后台能看到订单记录（`order_id`, `provider_order_id`, `paid_at`）
8. ✅ 重复回调只激活 VIP 一次
9. ✅ 桌面浏览器打开 → 显示"请用手机打开"提示
10. ✅ 支付 1 分钱测试单能走通全流程（虎皮椒测试模式）

---

## 十、未来演进（下一版）

1. **绑定自定义域名**
   - 买域名 → 加到 Cloudflare → 绑定到 Worker（`api.你的域名.com`）和 Pages（`www.你的域名.com`）
   - 修改 `notify_url` 和 `return_url` 到自定义域名
   - 更新 `.env.production` 的 `VITE_API_BASE`
   - 国内访问稳定性大幅提升

2. **PC 端二维码支付**
   - 桌面用户直接展示二维码，无需跳转到手机
   - 需要额外的定时轮询 UX 优化

3. **年度会员**
   - 数据库 `type` 增加 `yearly`
   - `settings` 增加 `yearlyPrice`
   - `handlePayment` 中的 VIP 延期逻辑增加 365 天分支

4. **退款流程**
   - 后台增加"退款"按钮
   - 调用虎皮椒退款 API

5. **对账系统**
   - 每日定时任务：比对本地订单和虎皮椒后台记录
   - 补单/补 VIP

6. **多支付渠道**
   - 后端抽象 `PaymentProvider` 接口
   - 支持切换到其他聚合支付（码支付、YunGouOS 等）

---

## 十一、里程碑

| 阶段 | 内容 | 交付物 |
|---|---|---|
| M1 | 后端：D1 表升级 + 3 个新接口 + 签名工具 | Worker 部署，能生成订单和回调 |
| M2 | 前端：Pricing 改造 + PaymentCallback 页面 + 轮询 | 完整 H5 支付流程 |
| M3 | 测试：本地跑通 + 生产 1 分钱测试单 | 一份测试日志 + 截图 |
| M4 | 文档：README 更新 + admin 后台配置 | 用户能自助配置 appid/secret |

---

## 十二、开放问题

1. 虎皮椒**免签约版**用的是**新接口 v1.1**（`https://api.xunhupay.com/payment/do.html`）还是**老接口**（`https://pay.xunhupay.com/v1/Payment/doPayment.html`）？
   - **决定**：先尝试 v1.1 新接口，如果测试失败再回退到老接口
2. 是否需要在支付前弹一个**用户协议 / 隐私政策**确认？
   - **决定**：本次先不做，后续商业化时补上
3. 是否要发送**邮件收据**或**短信收据**给用户？
   - **决定**：本次不做，用户在个人中心能查到订单

---

## 附录 A：虎皮椒接口参考

- **官网**：https://www.xunhupay.com
- **API 文档**：https://www.xunhupay.com/doc/
- **免签约版本要求**：个人实名认证（身份证 + 手机号）
- **费率**：约 2%（不同类型略有差异）
- **回调必须返回**：纯字符串 `success`（不带引号）

## 附录 B：签名算法（关键）

```typescript
function generateSign(params: Record<string, any>, secret: string): string {
  const sorted = Object.keys(params).sort()
    .filter(k => params[k] !== '' && params[k] != null && k !== 'sign')
    .map(k => `${k}=${params[k]}`)
    .join('&');
  const signStr = sorted + secret;
  return md5(signStr).toLowerCase();
}
```
