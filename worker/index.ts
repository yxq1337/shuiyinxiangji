/// <reference types="@cloudflare/workers-types" />

/**
 * Cloudflare Workers 后端 API
 * 使用 D1 数据库替代内存存储
 * 使用 Hono 框架处理路由
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { generateOrderId, validateBase64Image, orderTitle } from './orders';
import { notifyAdminNewOrder, notifyUserOrderApproved, notifyUserOrderRejected } from './email';

type Bindings = {
  DB: D1Database;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
  RESEND_API_KEY?: string;
  ADMIN_EMAIL?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS 中间件（允许 Pages 域名访问）
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// ==================== 健康检查 ====================
app.get('/api/health', (c) => c.json({ status: 'ok' }));

// ==================== 认证 API ====================

// 普通用户手机号登录 / 管理员密码登录
app.post('/api/auth/login', async (c) => {
  const body = await c.req.json();
  const { phone, username, password } = body;

  // 情况 1: 管理员密码登录
  if (username && password) {
    const adminUser = c.env.ADMIN_USERNAME || 'admin';
    const adminPass = c.env.ADMIN_PASSWORD || 'VIP1337';
    if (username === adminUser && password === adminPass) {
      return c.json({
        success: true,
        user: {
          id: 'admin',
          phone: 'admin',
          isVip: true,
          vipExpiresAt: null,
          createdAt: new Date().toISOString(),
          isAdmin: true,
        },
      });
    }
    return c.json({ success: false, error: '用户名或密码错误' }, 401);
  }

  // 情况 2: 普通用户手机号登录
  if (!phone) {
    return c.json({ success: false, error: '请输入手机号' }, 400);
  }

  const db = c.env.DB;
  let user = await db.prepare('SELECT * FROM users WHERE phone = ?').bind(phone).first();

  if (!user) {
    // 自动注册
    const newUser = {
      id: 'u' + Date.now(),
      phone,
      is_vip: 0,
      vip_expires_at: null,
      created_at: new Date().toISOString(),
    };
    await db
      .prepare(
        'INSERT INTO users (id, phone, is_vip, vip_expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      .bind(newUser.id, newUser.phone, newUser.is_vip, newUser.vip_expires_at, newUser.created_at)
      .run();
    user = newUser as any;
  }

  return c.json({
    success: true,
    user: mapUser(user),
  });
});

// 通过 ID 刷新用户信息
app.get('/api/auth/me/:id', async (c) => {
  const id = c.req.param('id');
  if (id === 'admin') {
    return c.json({
      success: true,
      user: {
        id: 'admin',
        phone: 'admin',
        isVip: true,
        vipExpiresAt: null,
        createdAt: new Date().toISOString(),
        isAdmin: true,
      },
    });
  }
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!user) return c.json({ success: false, error: '用户不存在' }, 404);
  return c.json({ success: true, user: mapUser(user) });
});

// ==================== 系统设置 API ====================
app.get('/api/settings', async (c) => {
  const settings = await c.env.DB.prepare('SELECT * FROM settings WHERE id = 1').first();
  if (!settings) {
    return c.json({
      singlePrice: 1.99,
      monthlyPrice: 9.9,
      paymentAccount: '',
      alipayQrCode: '',
      wechatQrCode: '',
    });
  }
  return c.json({
    singlePrice: settings.single_price,
    monthlyPrice: settings.monthly_price,
    paymentAccount: settings.payment_account,
    alipayQrCode: settings.alipay_qr_code,
    wechatQrCode: settings.wechat_qr_code,
  });
});

app.post('/api/settings', async (c) => {
  const body = await c.req.json();
  const db = c.env.DB;
  const current = await db.prepare('SELECT * FROM settings WHERE id = 1').first();

  const updated = {
    single_price: body.singlePrice !== undefined ? Number(body.singlePrice) : current?.single_price ?? 1.99,
    monthly_price: body.monthlyPrice !== undefined ? Number(body.monthlyPrice) : current?.monthly_price ?? 9.9,
    payment_account: body.paymentAccount !== undefined ? body.paymentAccount : current?.payment_account ?? '',
    alipay_qr_code: body.alipayQrCode !== undefined ? body.alipayQrCode : current?.alipay_qr_code ?? '',
    wechat_qr_code: body.wechatQrCode !== undefined ? body.wechatQrCode : current?.wechat_qr_code ?? '',
  };

  await db
    .prepare(
      `INSERT INTO settings (id, single_price, monthly_price, payment_account, alipay_qr_code, wechat_qr_code)
       VALUES (1, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         single_price = excluded.single_price,
         monthly_price = excluded.monthly_price,
         payment_account = excluded.payment_account,
         alipay_qr_code = excluded.alipay_qr_code,
         wechat_qr_code = excluded.wechat_qr_code`
    )
    .bind(updated.single_price, updated.monthly_price, updated.payment_account, updated.alipay_qr_code, updated.wechat_qr_code)
    .run();

  return c.json({
    success: true,
    settings: {
      singlePrice: updated.single_price,
      monthlyPrice: updated.monthly_price,
      paymentAccount: updated.payment_account,
      alipayQrCode: updated.alipay_qr_code,
      wechatQrCode: updated.wechat_qr_code,
    },
  });
});

// ==================== 订单 API ====================

app.post('/api/orders/create', async (c) => {
  const body = await c.req.json();
  const { type, phone, email } = body;
  if (!phone || !type) return c.json({ success: false, error: '缺少 phone 或 type' }, 400);
  if (type !== 'monthly' && type !== 'yearly' && type !== 'permanent') {
    return c.json({ success: false, error: '无效的套餐类型' }, 400);
  }

  const db = c.env.DB;
  const user = await db.prepare('SELECT * FROM users WHERE phone = ?').bind(phone).first();
  if (!user) return c.json({ success: false, error: '用户不存在' }, 404);

  const settings = await db.prepare('SELECT single_price, monthly_price, wechat_qr_url FROM settings WHERE id = 1').first();
  const monthlyPrice = Number(settings?.monthly_price ?? 9.90);
  let amount = monthlyPrice;
  if (type === 'yearly') {
    amount = monthlyPrice * 10;
  } else if (type === 'permanent') {
    amount = monthlyPrice * 30;
  }
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

// ==================== 支付 API ====================
app.post('/api/payments', async (c) => {
  const body = await c.req.json();
  const { type, amount, timestamp, phone } = body;

  const payment = {
    id: Math.random().toString(36).substring(2, 9),
    type,
    amount: Number(amount),
    timestamp: timestamp || new Date().toISOString(),
    status: 'success',
    phone,
  };

  const db = c.env.DB;

  await db
    .prepare(
      'INSERT INTO payments (id, type, amount, timestamp, status, phone) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .bind(payment.id, payment.type, payment.amount, payment.timestamp, payment.status, payment.phone)
    .run();

  // 若为月度会员，更新 VIP 状态
  if (phone && type === 'monthly') {
    const user = await db.prepare('SELECT * FROM users WHERE phone = ?').bind(phone).first();
    if (user) {
      const currentExpiry = user.vip_expires_at ? new Date(user.vip_expires_at as string).getTime() : Date.now();
      const newExpiry = new Date(Math.max(currentExpiry, Date.now()) + 30 * 24 * 60 * 60 * 1000).toISOString();
      await db
        .prepare('UPDATE users SET is_vip = 1, vip_expires_at = ? WHERE phone = ?')
        .bind(newExpiry, phone)
        .run();
    }
  }

  return c.json({ success: true, payment });
});

// ==================== 管理后台 API ====================
app.get('/api/admin/users', async (c) => {
  const result = await c.env.DB.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
  return c.json({ users: (result.results || []).map(mapUser) });
});

app.get('/api/admin/payments', async (c) => {
  const result = await c.env.DB.prepare('SELECT * FROM payments ORDER BY timestamp DESC').all();
  return c.json({ payments: result.results || [] });
});

app.get('/api/admin/stats', async (c) => {
  const db = c.env.DB;

  const revenueResult = await db
    .prepare('SELECT COALESCE(SUM(amount), 0) as total FROM payments')
    .first();
  const totalRevenue = ((revenueResult?.total as number) || 0).toFixed(2);

  const ordersResult = await db.prepare('SELECT COUNT(*) as count FROM payments').first();
  const totalOrders = (ordersResult?.count as number) || 0;

  const monthlyResult = await db
    .prepare("SELECT COUNT(*) as count FROM payments WHERE type = 'monthly'")
    .first();
  const monthlyOrders = (monthlyResult?.count as number) || 0;

  const singleResult = await db
    .prepare("SELECT COUNT(*) as count FROM payments WHERE type = 'single'")
    .first();
  const singleOrders = (singleResult?.count as number) || 0;

  const usersResult = await db.prepare('SELECT COUNT(*) as count FROM users').first();
  const totalUsers = (usersResult?.count as number) || 0;

  const now = new Date().toISOString();
  const vipsResult = await db
    .prepare('SELECT COUNT(*) as count FROM users WHERE is_vip = 1 AND (vip_expires_at IS NULL OR vip_expires_at > ?)')
    .bind(now)
    .first();
  const activeVips = (vipsResult?.count as number) || 0;

  return c.json({
    totalRevenue,
    totalOrders,
    monthlyOrders,
    singleOrders,
    totalUsers,
    activeVips,
  });
});

// -------- 订单审核 API --------

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

app.get('/api/admin/orders/pending-count', async (c) => {
  const row = await c.env.DB
    .prepare(`SELECT COUNT(*) as cnt FROM payments WHERE status = 'pending_review'`)
    .first();
  return c.json({ count: Number(row?.cnt || 0) });
});

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

  // 激活 VIP
  if (order.phone) {
    const user = await db.prepare('SELECT * FROM users WHERE phone = ?').bind(order.phone).first();
    if (user) {
      let daysToAdd = 0;
      if (order.type === 'monthly') {
        daysToAdd = 30;
      } else if (order.type === 'yearly') {
        daysToAdd = 365;
      } else if (order.type === 'permanent') {
        // 永久会员，设置一个非常远的日期
        const permanentExpiry = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString();
        await db
          .prepare('UPDATE users SET is_vip = 1, vip_expires_at = ? WHERE phone = ?')
          .bind(permanentExpiry, order.phone)
          .run();
        // 永久会员直接返回，不进行后续处理
      }

      if (daysToAdd > 0) {
        const currentExpiry = user.vip_expires_at ? new Date(user.vip_expires_at as string).getTime() : Date.now();
        const newExpiry = new Date(Math.max(currentExpiry, Date.now()) + daysToAdd * 24 * 60 * 60 * 1000).toISOString();
        await db
          .prepare('UPDATE users SET is_vip = 1, vip_expires_at = ? WHERE phone = ?')
          .bind(newExpiry, order.phone)
          .run();
      }
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

// -------- 手动设置用户 VIP --------
app.post('/api/admin/users/:id/set-vip', async (c) => {
  const userId = c.req.param('id');
  const body = await c.req.json();
  const isVip = !!body.isVip;
  const vipDays = Number(body.vipDays || 30);

  const db = c.env.DB;
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
  if (!user) return c.json({ success: false, error: '用户不存在' }, 404);

  let vipExpiresAt: string | null = null;

  if (isVip) {
    const currentExpiry = user.vip_expires_at ? new Date(user.vip_expires_at as string).getTime() : Date.now();
    vipExpiresAt = new Date(Math.max(currentExpiry, Date.now()) + vipDays * 24 * 60 * 60 * 1000).toISOString();
    await db
      .prepare('UPDATE users SET is_vip = 1, vip_expires_at = ? WHERE id = ?')
      .bind(vipExpiresAt, userId)
      .run();
  } else {
    await db
      .prepare('UPDATE users SET is_vip = 0, vip_expires_at = NULL WHERE id = ?')
      .bind(userId)
      .run();
  }

  return c.json({ success: true });
});

// ==================== 工具函数 ====================
function mapUser(row: any) {
  return {
    id: row.id,
    phone: row.phone,
    isVip: !!row.is_vip,
    vipExpiresAt: row.vip_expires_at,
    createdAt: row.created_at,
  };
}

export default app;
