/// <reference types="@cloudflare/workers-types" />

/**
 * Cloudflare Workers 后端 API
 * 使用 D1 数据库替代内存存储
 * 使用 Hono 框架处理路由
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { generateOrderId, validateBase64Image, orderTitle } from './orders';
import { notifyAdminNewOrder, notifyUserOrderApproved, notifyUserOrderRejected } from './email';
import {
  evaluateSign,
  normalizeCheckinCode,
  parseAddress,
  parseLatLng,
  parseRadius,
  parseTitle,
  randomCheckinCode,
} from '../shared/checkin';

type Bindings = {
  DB: D1Database;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
  RESEND_API_KEY?: string;
  ADMIN_EMAIL?: string;
  FISH_API_KEY?: string;
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

// ==================== Fish Audio TTS 代理 ====================
app.post('/api/tts', async (c) => {
  const apiKey = c.env.FISH_API_KEY;
  if (!apiKey) {
    return c.json({ error: '服务未配置 Fish Audio API Key' }, 500);
  }

  const body = await c.req.json<{
    text: string;
    format?: string;
    speed_factor?: number;
    reference_id?: string;
    model?: string;
  }>();

  if (!body.text || !body.text.trim()) {
    return c.json({ error: 'text 不能为空' }, 400);
  }

  const model = body.model || 's2.1-pro-free';
  const fishBody: Record<string, unknown> = {
    text: body.text.trim(),
    format: body.format || 'mp3',
    speed_factor: body.speed_factor ?? 1.0,
  };
  if (body.reference_id) {
    fishBody.reference_id = body.reference_id;
  }

  const resp = await fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      model,
    },
    body: JSON.stringify(fishBody),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    return c.json(
      { error: `Fish Audio 错误 (${resp.status}): ${errText.slice(0, 300)}` },
      resp.status as ContentfulStatusCode,
    );
  }

  // 透传音频流
  const contentType = resp.headers.get('content-type') || 'audio/mpeg';
  return new Response(resp.body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
    },
  });
});

// ==================== Fish Audio 声音克隆 ====================
app.post('/api/tts/clone', async (c) => {
  const apiKey = c.env.FISH_API_KEY;
  if (!apiKey) {
    return c.json({ error: '服务未配置 Fish Audio API Key' }, 500);
  }

  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json({ error: '请求格式错误，请使用 multipart/form-data 上传音频' }, 400);
  }
  const audioFile = formData.get('audio') as File | null;
  const title = (formData.get('title') as string) || '我的克隆音色';

  if (!audioFile) {
    return c.json({ error: '请上传音频文件' }, 400);
  }
  if (audioFile.size > 25 * 1024 * 1024) {
    return c.json({ error: '音频文件不能超过 25MB' }, 400);
  }

  const fishForm = new FormData();
  fishForm.append('type', 'tts');
  fishForm.append('train_mode', 'fast');
  fishForm.append('visibility', 'private');
  fishForm.append('title', title);
  fishForm.append('voices', audioFile, audioFile.name);
  fishForm.append('enhance_audio_quality', 'true');
  fishForm.append('generate_sample', 'true');

  const resp = await fetch('https://api.fish.audio/model', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: fishForm,
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    return c.json(
      { error: `克隆失败 (${resp.status}): ${errText.slice(0, 300)}` },
      resp.status as ContentfulStatusCode,
    );
  }

  const data = await resp.json<{ _id?: string; id?: string; title?: string }>();
  const modelId = data?._id || data?.id || '';
  return c.json({
    success: true,
    reference_id: modelId,
    title: data?.title || title,
    model_id: modelId,
  });
});

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

// ==================== 骑手社区 API ====================

const COMMUNITY_EXPIRE_DAYS = 15;

function maskContact(contact: string): string {
  const s = String(contact || '');
  if (s.length <= 7) return s.replace(/./g, '*');
  return s.slice(0, 3) + '****' + s.slice(-4);
}

function mapListing(row: any, reveal = false) {
  let extra: any = {};
  try { extra = row.extra ? JSON.parse(row.extra) : {}; } catch {}
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    description: row.description,
    city: row.city,
    area: row.area,
    price: Number(row.price || 0),
    contact: reveal ? String(row.contact || '') : maskContact(String(row.contact || '')),
    extra,
    userId: row.user_id,
    userPhone: row.user_phone,
    status: row.status,
    rejectReason: row.reject_reason,
    viewCount: Number(row.view_count || 0),
    contactRevealCount: Number(row.contact_reveal_count || 0),
    reportCount: Number(row.report_count || 0),
    createdAt: row.created_at,
    approvedAt: row.approved_at,
    expiresAt: row.expires_at,
  };
}

// 信息列表（仅返回已上架且未过期的）
app.get('/api/community/listings', async (c) => {
  const { category, city, area, minPrice, maxPrice, page = '1', pageSize = '20' } = c.req.query();
  const db = c.env.DB;
  const now = new Date().toISOString();

  const conditions = ["status = 'approved'", "(expires_at IS NULL OR expires_at > ?)"];
  const binds: any[] = [now];
  if (category) { conditions.push('category = ?'); binds.push(category); }
  if (city) { conditions.push('city = ?'); binds.push(city); }
  if (area) { conditions.push('area = ?'); binds.push(area); }
  if (minPrice) { conditions.push('price >= ?'); binds.push(Number(minPrice)); }
  if (maxPrice) { conditions.push('price <= ?'); binds.push(Number(maxPrice)); }

  const limit = Math.min(Number(pageSize) || 20, 100);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;
  binds.push(limit, offset);

  const sql = `SELECT * FROM community_listings WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  const result = await db.prepare(sql).bind(...binds).all();
  return c.json({ listings: (result.results || []).map((r) => mapListing(r)) });
});

// 信息详情（不返回真实联系方式，需单独调用 reveal）
app.get('/api/community/listings/:id', async (c) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare('SELECT * FROM community_listings WHERE id = ?').bind(id).first();
  if (!row) return c.json({ success: false, error: '信息不存在' }, 404);
  // 浏览量 +1
  await c.env.DB.prepare('UPDATE community_listings SET view_count = view_count + 1 WHERE id = ?').bind(id).run();
  return c.json({ listing: mapListing({ ...row, view_count: Number(row.view_count || 0) + 1 }) });
});

// 发布信息（默认待审核）
app.post('/api/community/listings', async (c) => {
  const body = await c.req.json();
  const { category, title, description, city, area, price, contact, extra, userId, userPhone } = body;
  if (!category || !title || !contact) {
    return c.json({ success: false, error: '分类、标题、联系方式不能为空' }, 400);
  }
  if (!['battery', 'job', 'usedcar', 'help'].includes(category)) {
    return c.json({ success: false, error: '无效的分类' }, 400);
  }

  const id = 'cl' + Date.now() + Math.random().toString(36).slice(2, 6);
  const now = new Date().toISOString();
  const extraStr = extra ? JSON.stringify(extra) : '{}';

  await c.env.DB
    .prepare(
      `INSERT INTO community_listings (id, category, title, description, city, area, price, contact, extra, user_id, user_phone, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
    )
    .bind(id, category, title, description || '', city || '', area || '', Number(price || 0), contact, extraStr, userId || '', userPhone || '', now)
    .run();

  return c.json({ success: true, id, message: '发布成功，等待人工审核' });
});

// 点击查看联系方式（记录次数，防爬）
app.post('/api/community/listings/:id/reveal-contact', async (c) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare('SELECT contact FROM community_listings WHERE id = ? AND status = ?').bind(id, 'approved').first();
  if (!row) return c.json({ success: false, error: '信息不存在或未上架' }, 404);
  await c.env.DB.prepare('UPDATE community_listings SET contact_reveal_count = contact_reveal_count + 1 WHERE id = ?').bind(id).run();
  return c.json({ contact: String(row.contact || '') });
});

// 举报
app.post('/api/community/listings/:id/report', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const reason = String(body.reason || '').trim();
  if (!reason) return c.json({ success: false, error: '请填写举报原因' }, 400);

  const reportId = 'rp' + Date.now() + Math.random().toString(36).slice(2, 6);
  const now = new Date().toISOString();
  await c.env.DB
    .prepare('INSERT INTO community_reports (id, listing_id, reason, reporter_id, reporter_phone, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(reportId, id, reason, body.reporterId || '', body.reporterPhone || '', now)
    .run();
  await c.env.DB.prepare('UPDATE community_listings SET report_count = report_count + 1 WHERE id = ?').bind(id).run();

  return c.json({ success: true, message: '举报已提交，我们会尽快处理' });
});

// -------- 社区管理后台 --------

// 待审核列表
app.get('/api/admin/community/pending', async (c) => {
  const result = await c.env.DB
    .prepare("SELECT * FROM community_listings WHERE status = 'pending' ORDER BY created_at DESC")
    .all();
  return c.json({ listings: (result.results || []).map((r) => mapListing(r, true)) });
});

// 审核通过（设置 15 天后过期）
app.post('/api/admin/community/:id/approve', async (c) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare('SELECT * FROM community_listings WHERE id = ?').bind(id).first();
  if (!row) return c.json({ success: false, error: '信息不存在' }, 404);
  if (row.status !== 'pending') return c.json({ success: false, error: '该信息不处于待审核状态' }, 400);

  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + COMMUNITY_EXPIRE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await c.env.DB
    .prepare("UPDATE community_listings SET status = 'approved', approved_at = ?, expires_at = ? WHERE id = ?")
    .bind(now, expiresAt, id)
    .run();
  return c.json({ success: true });
});

// 审核驳回
app.post('/api/admin/community/:id/reject', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const reason = String(body.reason || '内容不符合规范');
  const row = await c.env.DB.prepare('SELECT * FROM community_listings WHERE id = ?').bind(id).first();
  if (!row) return c.json({ success: false, error: '信息不存在' }, 404);

  await c.env.DB
    .prepare("UPDATE community_listings SET status = 'rejected', reject_reason = ? WHERE id = ?")
    .bind(reason, id)
    .run();
  return c.json({ success: true });
});

// ==================== 扫描签到 ====================

let checkinSchemaReady: Promise<void> | null = null;

function ensureCheckinSchema(db: D1Database) {
  if (!checkinSchemaReady) {
    checkinSchemaReady = (async () => {
      await db.prepare(`CREATE TABLE IF NOT EXISTS checkin_events (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        address TEXT NOT NULL DEFAULT '',
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        radius_meters INTEGER NOT NULL,
        owner_id TEXT NOT NULL,
        owner_phone TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'open',
        created_at TEXT NOT NULL
      )`).run();
      await db.prepare('CREATE INDEX IF NOT EXISTS idx_checkin_events_owner ON checkin_events(owner_id)').run();
      await db.prepare(`CREATE TABLE IF NOT EXISTS checkin_records (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        real_name TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        distance_meters INTEGER NOT NULL,
        created_at TEXT NOT NULL
      )`).run();
      await db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_checkin_records_name ON checkin_records(event_id, real_name)').run();
    })().catch((err) => {
      checkinSchemaReady = null;
      throw err;
    });
  }
  return checkinSchemaReady;
}

function mapCheckinRow(row: Record<string, unknown>, count: number, withCenter: boolean) {
  return {
    code: row.code,
    title: row.title,
    address: row.address || '',
    radiusMeters: Number(row.radius_meters),
    status: row.status,
    count,
    ...(withCenter
      ? {
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
          createdAt: row.created_at,
        }
      : {}),
  };
}

app.post('/api/checkin/events', async (c) => {
  const db = c.env.DB;
  await ensureCheckinSchema(db);
  const body = await c.req.json().catch(() => ({}));
  const title = parseTitle(body.title);
  const center = parseLatLng(body.latitude, body.longitude);
  const radius = parseRadius(body.radiusMeters);
  const ownerId = String(body.ownerId || '').trim();
  if (!title) return c.json({ success: false, error: '请填写 1-40 字的签到名称' }, 400);
  if (!center) return c.json({ success: false, error: '请先定位签到区域' }, 400);
  if (!radius) return c.json({ success: false, error: '签到半径需在 50 米到 5 公里之间' }, 400);
  if (!ownerId) return c.json({ success: false, error: '请先登录' }, 400);

  let code = randomCheckinCode();
  for (let i = 0; i < 8; i++) {
    const taken = await db.prepare('SELECT id FROM checkin_events WHERE code = ?').bind(code).first();
    if (!taken) break;
    code = randomCheckinCode(i === 7 ? 8 : 6);
  }

  const id = 'ce' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO checkin_events (id, code, title, address, latitude, longitude, radius_meters, owner_id, owner_phone, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`
  ).bind(id, code, title, parseAddress(body.address), center.latitude, center.longitude, radius, ownerId, String(body.ownerPhone || '').slice(0, 20), now).run();

  return c.json({
    success: true,
    event: {
      code,
      title,
      address: parseAddress(body.address),
      radiusMeters: radius,
      status: 'open',
      count: 0,
      latitude: center.latitude,
      longitude: center.longitude,
      createdAt: now,
    },
  });
});

app.get('/api/checkin/mine', async (c) => {
  const db = c.env.DB;
  await ensureCheckinSchema(db);
  const ownerId = String(c.req.query('ownerId') || '').trim();
  if (!ownerId) return c.json({ success: false, error: '缺少创建者' }, 400);
  const result = await db.prepare(
    `SELECT e.*, (SELECT COUNT(*) FROM checkin_records r WHERE r.event_id = e.id) AS total
     FROM checkin_events e WHERE e.owner_id = ? ORDER BY e.created_at DESC`
  ).bind(ownerId).all();
  const events = (result.results || []).map((row) => mapCheckinRow(row, Number(row.total || 0), true));
  return c.json({ success: true, events });
});

app.get('/api/checkin/events/:code/roster', async (c) => {
  const db = c.env.DB;
  await ensureCheckinSchema(db);
  const code = normalizeCheckinCode(c.req.param('code'));
  const row = await db.prepare('SELECT * FROM checkin_events WHERE code = ?').bind(code).first();
  if (!row) return c.json({ success: false, error: '签到不存在' }, 404);
  const ownerId = String(c.req.query('ownerId') || '').trim();
  if (!ownerId || ownerId !== row.owner_id) {
    return c.json({ success: false, error: '只有创建者可以查看签到人员' }, 403);
  }
  const people = await db.prepare(
    'SELECT real_name, distance_meters, created_at FROM checkin_records WHERE event_id = ? ORDER BY created_at ASC'
  ).bind(row.id).all();
  const records = (people.results || []).map((item) => ({
    realName: item.real_name,
    distanceMeters: Number(item.distance_meters),
    createdAt: item.created_at,
  }));
  return c.json({ success: true, event: mapCheckinRow(row, records.length, true), records });
});

app.get('/api/checkin/events/:code', async (c) => {
  const db = c.env.DB;
  await ensureCheckinSchema(db);
  const code = normalizeCheckinCode(c.req.param('code'));
  const row = await db.prepare(
    `SELECT e.*, (SELECT COUNT(*) FROM checkin_records r WHERE r.event_id = e.id) AS total
     FROM checkin_events e WHERE e.code = ?`
  ).bind(code).first();
  if (!row) return c.json({ success: false, error: '签到不存在' }, 404);
  return c.json({ success: true, event: mapCheckinRow(row, Number(row.total || 0), false) });
});

app.post('/api/checkin/events/:code/sign', async (c) => {
  const db = c.env.DB;
  await ensureCheckinSchema(db);
  const code = normalizeCheckinCode(c.req.param('code'));
  const row = await db.prepare('SELECT * FROM checkin_events WHERE code = ?').bind(code).first();
  if (!row) return c.json({ success: false, error: '签到不存在' }, 404);
  const body = await c.req.json().catch(() => ({}));
  const decision = evaluateSign({
    eventStatus: String(row.status),
    centerLat: Number(row.latitude),
    centerLng: Number(row.longitude),
    radiusMeters: Number(row.radius_meters),
    realName: body.realName,
    latitude: body.latitude,
    longitude: body.longitude,
    accuracy: body.accuracy,
  });
  if (decision.ok === false) {
    return c.json({
      success: false,
      error: decision.error,
      distanceMeters: decision.distanceMeters,
      radiusMeters: decision.radiusMeters,
    }, decision.status);
  }

  const existing = await db.prepare(
    'SELECT real_name, distance_meters, created_at FROM checkin_records WHERE event_id = ? AND real_name = ?'
  ).bind(row.id, decision.realName).first();
  if (existing) {
    return c.json({
      success: true,
      already: true,
      record: {
        realName: existing.real_name,
        distanceMeters: Number(existing.distance_meters),
        createdAt: existing.created_at,
      },
    });
  }

  const id = 'cr' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const now = new Date().toISOString();
  try {
    await db.prepare(
      `INSERT INTO checkin_records (id, event_id, real_name, latitude, longitude, distance_meters, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, row.id, decision.realName, decision.latitude, decision.longitude, decision.distanceMeters, now).run();
  } catch {
    const again = await db.prepare(
      'SELECT real_name, distance_meters, created_at FROM checkin_records WHERE event_id = ? AND real_name = ?'
    ).bind(row.id, decision.realName).first();
    if (again) {
      return c.json({
        success: true,
        already: true,
        record: {
          realName: again.real_name,
          distanceMeters: Number(again.distance_meters),
          createdAt: again.created_at,
        },
      });
    }
    return c.json({ success: false, error: '签到保存失败' }, 500);
  }

  return c.json({
    success: true,
    record: { realName: decision.realName, distanceMeters: decision.distanceMeters, createdAt: now },
  });
});

app.post('/api/checkin/events/:code/close', async (c) => {
  const db = c.env.DB;
  await ensureCheckinSchema(db);
  const code = normalizeCheckinCode(c.req.param('code'));
  const row = await db.prepare('SELECT * FROM checkin_events WHERE code = ?').bind(code).first();
  if (!row) return c.json({ success: false, error: '签到不存在' }, 404);
  const body = await c.req.json().catch(() => ({}));
  const ownerId = String(body.ownerId || '').trim();
  if (!ownerId || ownerId !== row.owner_id) {
    return c.json({ success: false, error: '只有创建者可以结束签到' }, 403);
  }
  await db.prepare("UPDATE checkin_events SET status = 'closed' WHERE id = ?").bind(row.id).run();
  return c.json({ success: true, event: mapCheckinRow({ ...row, status: 'closed' }, Number(row.total || 0), true) });
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
