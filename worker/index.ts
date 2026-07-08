/// <reference types="@cloudflare/workers-types" />

/**
 * Cloudflare Workers 后端 API
 * 使用 D1 数据库替代内存存储
 * 使用 Hono 框架处理路由
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
  DB: D1Database;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
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
