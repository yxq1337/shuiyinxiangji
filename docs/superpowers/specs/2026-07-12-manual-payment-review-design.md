# 支付系统实际收款改造 — 半自动截图审核方案

**创建日期**: 2026-07-12
**主题**: 用户扫固定收款码支付 + 上传截图 + 管理员人工审核
**取代方案**: 之前的虎皮椒 API 集成（因需 88+ 开户费）
**状态**: 待实现

---

## 一、背景

### 决策依据
虎皮椒需要 ¥88-118 开户费 + 官方 0.6% + 平台 1-2%（还需预充值），不符合"零成本启动"目标。改用**半自动截图审核**：

- ✅ **零开户费**（用你的个人微信收款码）
- ✅ **零手续费**（个人对个人转账）
- ✅ **无第三方依赖**
- ⚠️ 需要人工审核（Task 3 会加邮件通知降低响应门槛）

### 当前状态
- Task 1（v2 数据库迁移）已完成，`payments` 表已有 `order_id`、`provider`、`pay_url`、`paid_at`、`raw_notify`、`status` 等字段
- 前端仍是模拟支付（Pricing.tsx 里 setTimeout 直接标记 success）
- 后端 `POST /api/payments` 是旧的模拟支付接口

### 目标
- 用户下单 → 显示固定微信收款码 + 订单号（需填备注）→ 上传截图 → 管理员审核 → 激活 VIP
- 后台增加"支付审核"tab，管理员一键通过/拒绝
- 每次有新待审核订单，通过 Resend 发邮件给管理员
- 审核通过时通过 Resend 发邮件给用户（如果用户有邮箱）

### 非目标（本版不做）
- OCR 自动识别金额
- 全自动审核
- 多种收款码（先只支持微信一张）
- 用户催单/加急
- 退款流程
- 用户注册时收集邮箱（如果用户没提供邮箱，只发管理员那份）

---

## 二、总体架构

```
┌─────────────┐     ┌──────────────┐
│   浏览器    │────▶│  Worker API  │
│  (Pages)    │◀────│  (D1 DB)     │
└─────────────┘     └──────────────┘
                        │      │
                        │      ▼
                        │  ┌────────────┐
                        │  │ Resend API │
                        │  │  (邮件)     │
                        │  └────────────┘
                        ▼
                    ┌────────────┐
                    │ Cloudflare │  ← 存截图
                    │  R2 或 D1  │
                    └────────────┘
```

### 请求流程

**用户下单：**
1. 用户在 `/pricing` 选套餐 → 点"立即购买"
2. 前端调用 `POST /api/orders/create` → 后端生成订单号（如 `SYX26071204ABCD`）
3. 后端返回订单号 + 金额 + 收款码 URL
4. 前端跳转到 `/payment/pending?order_id=SYX...`
5. 页面显示：收款码 + 订单号 + 金额 + "我已支付，上传截图"按钮

**用户上传截图：**
6. 用户点上传按钮 → 选图 → 前端读为 base64 → `POST /api/orders/:id/upload-proof`
7. 后端存储截图（base64 存 D1，见 § 六决策）→ 订单状态改为 `pending_review`
8. 后端调用 Resend 发邮件给管理员："有新的待审核订单"
9. 前端显示："审核中，通常几分钟内完成，最长 24 小时"

**管理员审核：**
10. 管理员登录 `/admin` → 顶部 tab 看到"支付审核 (3)" 红点
11. 点进去看到订单列表 + 截图 + 金额 + 备注（无法自动识别的字段留空）
12. 管理员核对无误 → 点"通过"→ `POST /api/admin/orders/:id/approve`
13. 后端更新订单为 `success` + 激活 VIP + 发邮件给用户（如有邮箱）
14. 或管理员点"拒绝"→ `POST /api/admin/orders/:id/reject`（可填拒绝原因）

**用户查看结果：**
15. 用户回到 `/payment/pending` 页面（保留了 order_id）→ 前端每 15 秒轮询 `/api/orders/:id/status`
16. `success` → 显示"支付成功"→ 3 秒跳 `/my`
17. `rejected` → 显示拒绝原因 + 联系客服
18. 或用户下次登录自动看到 VIP 状态

---

## 三、数据库变化

### `payments` 表新增字段

`payments` 表已经在 Task 1 加了 `order_id`, `provider`, `pay_url`, `paid_at`, `raw_notify`, `provider_order_id`, `pay_method`。这次改造：

- **复用现有字段：**
  - `provider` → 存字符串 `'manual'`（本方案的名字）
  - `raw_notify` → 存截图 base64（复用现有字段，避免加太多列）
  - `paid_at` → 审核通过时间
- **新增字段：**

```sql
ALTER TABLE payments ADD COLUMN proof_uploaded_at TEXT;    -- 用户上传截图时间
ALTER TABLE payments ADD COLUMN reviewed_at TEXT;          -- 管理员审核时间
ALTER TABLE payments ADD COLUMN reviewed_by TEXT;          -- 审核人（暂固定 'admin'）
ALTER TABLE payments ADD COLUMN reject_reason TEXT;        -- 拒绝原因
ALTER TABLE payments ADD COLUMN user_email TEXT;           -- 用户联系邮箱（可选）
```

### 订单状态机

```
created            (刚下单，未上传截图)
    ↓ 用户上传截图
pending_review     (待管理员审核)
    ↓ 管理员通过        ↓ 管理员拒绝
  success            rejected
```

之前的 `pending` 状态在本方案里改为 `created`。审核后是 `success` 或 `rejected`。

### `settings` 表变化

**新增字段：**

```sql
ALTER TABLE settings ADD COLUMN wechat_qr_url TEXT DEFAULT '';        -- 微信收款码图片 URL（现阶段用相对路径）
ALTER TABLE settings ADD COLUMN admin_email TEXT DEFAULT '';           -- 管理员接收邮件的地址
ALTER TABLE settings ADD COLUMN resend_api_key TEXT DEFAULT '';        -- Resend API Key（也可以用 env）
```

**注意：** `xunhupay_appid` 和 `xunhupay_secret` 保留在数据库里但不使用（未来可能再启用）。

---

## 四、后端 API 变化

### 4.1 新增接口

#### `POST /api/orders/create`
**请求：**
```json
{ "type": "monthly", "phone": "13800138000", "email": "u@example.com" }
```
（email 可选）

**逻辑：**
1. 校验 user、type
2. 读价格
3. 生成 order_id：`SYX<YYMMDDHHmm><4位大写字母数字>`
4. INSERT payments 记录，status=`created`, provider=`manual`, user_email=email
5. 返回：
```json
{
  "success": true,
  "order_id": "SYX26071214AB3F",
  "amount": 9.90,
  "title": "月度会员",
  "qr_url": "/wechat-pay-qr.png",
  "instructions": "请扫码支付 ¥9.90，付款时请在备注中填写订单号：SYX26071214AB3F"
}
```

#### `POST /api/orders/:id/upload-proof`
**请求：**
```json
{ "proof_base64": "data:image/png;base64,iVBOR..." }
```

**逻辑：**
1. 校验订单存在，status 必须是 `created`
2. base64 大小限制（约 2 MB）
3. 更新 `raw_notify = proof_base64`, `proof_uploaded_at = now`, `status = 'pending_review'`
4. 调 Resend 发邮件给 admin：包含订单号、金额、用户手机号
5. 返回 `{ success: true, status: 'pending_review' }`

#### `GET /api/orders/:id/status`
**逻辑：**
1. 从 D1 读订单
2. 只返回**必要字段**（不含 base64，避免每次轮询浪费流量）：
```json
{
  "success": true,
  "order_id": "SYX...",
  "status": "created" | "pending_review" | "success" | "rejected",
  "reject_reason": "...",
  "paid_at": "..."
}
```

### 4.2 管理员接口

#### `GET /api/admin/orders/pending`
返回所有 `pending_review` 状态的订单，含截图 base64。

```json
{
  "orders": [
    {
      "order_id": "SYX...",
      "phone": "138...",
      "type": "monthly",
      "amount": 9.9,
      "proof_uploaded_at": "...",
      "proof_base64": "data:image/png;base64,...",
      "user_email": "..."
    }
  ]
}
```

#### `POST /api/admin/orders/:id/approve`
**逻辑：**
1. 校验管理员身份
2. 订单 status 改为 `success`, `paid_at = now`, `reviewed_at = now`, `reviewed_by = 'admin'`
3. 激活/延长用户 VIP（monthly 加 30 天）
4. 如果 user_email 非空，发邮件给用户"会员已激活"

#### `POST /api/admin/orders/:id/reject`
**请求：** `{ "reason": "金额不对" }`

**逻辑：**
1. 校验管理员身份
2. status 改为 `rejected`, `reject_reason = reason`, `reviewed_at = now`
3. 发邮件给用户"审核未通过：xxx"

#### `GET /api/admin/orders/pending-count`
用于顶部 tab 红点：

```json
{ "count": 3 }
```

### 4.3 修改现有接口

- 保留旧的 `POST /api/payments`（已废弃但不删，避免破坏 admin 的历史查询）
- `GET /api/admin/payments` 增加返回 `proof_uploaded_at`, `reviewed_at`, `reviewed_by`, `reject_reason` 字段（管理员查历史用）

---

## 五、前端流程变化

### 5.1 `Pricing.tsx` 改造

替换现有的 `handlePayment` 模拟支付逻辑：

```
点击"立即购买"
    ↓
调用 POST /api/orders/create
    ↓
拿到 order_id 后 → navigate(`/payment/pending?order_id=${order_id}`)
```

### 5.2 新增页面 `PaymentPending.tsx`

**路由：** `/payment/pending?order_id=SYX...`

**四种状态视图：**

**状态 A - `created`（未上传截图）：**
- 显示大幅收款码图 + 金额 + 订单号
- "已完成支付？上传截图"按钮 → 点击弹出文件选择器
- 上传后转 base64 调 API

**状态 B - `pending_review`（待审核）：**
- 显示 loading 动画 + "审核中，通常几分钟内完成，最长 24 小时"
- 每 15 秒轮询状态

**状态 C - `success`：**
- 显示 ✅ "支付成功！VIP 已激活" → 3 秒跳 `/my`

**状态 D - `rejected`：**
- 显示 ❌ "审核未通过：<原因>"
- 按钮：重新购买 / 联系客服

### 5.3 管理后台改造

**在 `Admin.tsx` 里新增 tab "支付审核"，位置在原本"支付记录"前：**

- Tab 标签显示红点数：`支付审核 (3)`
- 内容：待审核订单列表卡片：
  - 每张卡显示：订单号、金额、类型、手机号、上传时间、截图（缩略图，点击放大）
  - 两个按钮："✓ 通过" 和 "✗ 拒绝"（拒绝弹输入框填原因）

**顶部菜单如果保留原始位置：**
- 加载 `/api/admin/orders/pending-count` 每 30 秒轮询
- Tab 标题旁 badge 显示 count（如 0 则不显示）

---

## 六、关键设计决策

### 6.1 截图存哪里？

**决策：先存 D1（base64 存 raw_notify 字段），后续可迁移到 R2**

理由：
- D1 免费额度 500MB 存储，每张截图约 200-500KB base64，可存约 1000-2500 张
- 早期订单少，D1 完全够用
- 迁移到 R2 只需 3 行代码修改（返回 URL 代替 base64）

**风险：** 单条 D1 记录不能超过 1MB。前端限制上传文件 ≤ 500KB（拒绝更大的，或压缩）。

### 6.2 邮件用什么？

**决策：Resend**

理由：
- 每月 3000 封免费邮件
- 通过 API 直接发送（不需要 SMTP）
- Cloudflare Workers 直接 fetch 即可
- 需要在 Resend 后台绑定发件邮箱域名（或用他们的默认 `onboarding@resend.dev`）

**默认域名限制：** `onboarding@resend.dev` 只能发到你 Resend 注册的邮箱本人。这足够管理员通知用。**用户通知邮件先延后**（需要绑定自己的域名）。

**降级：** 如果 Resend 未配置（api_key 为空），不发邮件，只在 UI 提示。

### 6.3 用户如何在支付时填订单号？

微信收款只能扫码 → 弹出输入金额 + 备注框。用户需**手动**填订单号到"备注"栏。

**产品文案：** "请扫码支付 ¥9.90，付款时请**长按订单号复制** → 粘贴到微信'备注'栏"

**风险：** 用户可能忘记填备注 → 管理员看截图时看不到备注 → 只能靠**金额 + 时间**匹配（如果同金额多单，容易乱）。

**缓解：**
- UI 上大字提示"备注要填订单号"
- 订单金额加个 1-99 分钱的"随机尾数"（如 `9.90 → 9.87`），让每张订单金额都独一无二
- 管理员看不到备注时依然能靠金额精准匹配

### 6.4 前端如何限制截图大小？

**用 Canvas 压缩：**
- 读取原图 → 如超过 800px 长边 → 缩到 800px
- 用 `canvas.toDataURL('image/jpeg', 0.75)` 输出
- 结果通常 200KB 左右

### 6.5 是否加"金额随机尾数"？

**决策：本版不做，保持简单**

后续如果重复订单多，再加。

---

## 七、安全考量

1. **管理员认证：** 现有 `isAdmin` 判断（`user.isAdmin === true`）保留。所有 admin 接口在 Worker 里再验一次（TBD：现在管理员接口没验证，见 § 十一 开放问题）。
2. **上传截图接口：** 校验 order_id 存在且 status = `created`，防止重复上传或对陌生订单上传。
3. **base64 内容：** 只接受 `data:image/*;base64,` 开头，其他拒绝。
4. **接口限流：** 早期不做，业务量上来后再加。

---

## 八、部署配置

### 环境变量新增

用 wrangler secret：
```bash
npx wrangler secret put RESEND_API_KEY   # 从 Resend 后台复制
```

或者存 D1 settings 表（管理员在后台配置）。**代码优先级：env > D1**。

### 静态资源

微信收款码放到 `public/wechat-pay-qr.png`（用户已经提供图片）。前端直接引用 `/wechat-pay-qr.png`。

---

## 九、测试计划

### 手动测试清单

1. ✅ 未登录用户点购买 → 跳登录
2. ✅ 已登录用户下单 → 生成订单号 → 跳到 pending 页面
3. ✅ Pending 页面显示收款码 + 订单号 + 金额
4. ✅ 上传一张 PNG 图（小的）→ 状态变 pending_review
5. ✅ 上传太大的图（>500KB） → 前端压缩后成功
6. ✅ 管理员登录 → 顶部 tab 显示红点 (1)
7. ✅ 管理员点进审核 tab → 看到订单和截图
8. ✅ 点"通过" → 订单变 success，VIP 激活
9. ✅ 前端 pending 页面轮询发现 success → 跳转 /my
10. ✅ 测试"拒绝"路径
11. ✅ Resend 未配置时不报错，只是不发邮件
12. ✅ 管理后台"支付记录"能看到通过和拒绝的历史订单

---

## 十、里程碑

| 阶段 | 内容 | 交付物 |
|---|---|---|
| M1 | 数据库迁移 v3 | schema-migrate-v3.sql + npm 脚本 |
| M2 | 后端 API：创建订单、上传截图、查状态 | 3 个新路由 |
| M3 | 后端 API：管理员审核、通过、拒绝、计数 | 4 个新路由 |
| M4 | 后端：Resend 邮件工具 | worker/email.ts |
| M5 | 前端：Pricing 改造 + PaymentPending 页面 | 2 个前端改动 |
| M6 | 前端：Admin 加"支付审核" tab + 红点 | 1 个前端改动 |
| M7 | 静态资源 + 部署配置 | 收款码放进仓库 + Resend 配置说明 |
| M8 | 端到端测试 + 文档 | 测试报告 |

---

## 十一、开放问题

1. **管理员接口安全性**
   - 当前管理员接口没有做服务端认证（只靠前端 `isAdmin`）
   - **决定：** 本版继续维持现状，因为 admin 密码在 Worker env（`ADMIN_PASSWORD`）里，前端没有直接 API 认证机制。后续加 JWT / session 时统一改。
   - **风险：** 有人知道 API 路径直接 POST 也能审核。因为业务量小、URL 不公开，暂可接受。

2. **用户没填备注怎么办？**
   - **决定：** 管理员通过金额匹配。产品文案强调"务必填备注"。

3. **同金额多用户同时下单会不会冲突？**
   - **决定：** 本版不加金额随机尾数，管理员通过截图时间 + 备注综合判断。业务量上来后再加。

4. **收款码更换？**
   - **决定：** 存到 `settings.wechat_qr_url` 字段，管理员在后台上传（本版 M7 时手动放到 public/，后续可以做后台上传功能）。

---

## 附录 A：Resend 使用示例

```typescript
async function sendEmail(apiKey: string, to: string, subject: string, html: string) {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'onboarding@resend.dev',
      to,
      subject,
      html,
    }),
  });
  return resp.ok;
}
```

## 附录 B：订单号格式

`SYX` + YY(2) + MM(2) + DD(2) + HH(2) + mm(2) + 4位随机大写字母数字

示例：`SYX26071214A3F2` = 2026-07-12 14:xx 生成的订单

**优点：**
- 人肉可读，管理员一眼看出日期
- 不需要数据库自增，Worker 里直接生成
- 4 位随机 = 36^4 ≈ 168万，同分钟不易撞
