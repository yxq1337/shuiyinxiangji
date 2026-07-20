import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

// 本地内存存储
interface Payment {
  id: string;
  order_id: string;
  provider: string;
  type: string;
  amount: number;
  timestamp: string;
  status: string;
  phone: string;
  user_email?: string | null;
  raw_notify?: string | null;
  proof_uploaded_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  reject_reason?: string | null;
  paid_at?: string | null;
}

interface User {
  id: string;
  phone: string;
  is_vip: number;
  vip_expires_at?: string | null;
  created_at: string;
}

let payments: Payment[] = [];
let users: User[] = [
  { id: 'demo1', phone: '13800138000', is_vip: 0, created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: 'demo2', phone: '13900139000', is_vip: 1, vip_expires_at: new Date(Date.now() + 30 * 86400000).toISOString(), created_at: new Date(Date.now() - 3600000).toISOString() }
];

let appSettings = {
  singlePrice: 1.99,
  monthlyPrice: 9.90,
  yearlyPrice: 19.90,
  permanentPrice: 29.90,
  paymentAccount: 'admin@example.com',
  alipayQrCode: '',
  wechatQrCode: '',
  wechat_qr_url: '',
  admin_email: '',
  resend_api_key: ''
};

// 工具函数
function generateOrderId(): string {
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

function validateBase64Image(data: string): { ok: boolean; error?: string } {
  if (!data.startsWith('data:image/')) {
    return { ok: false, error: '仅支持图片格式' };
  }
  const sizeBytes = (data.length * 3) / 4;
  if (sizeBytes > 900 * 1024) {
    return { ok: false, error: '图片过大，请压缩后重传' };
  }
  return { ok: true };
}

function orderTitle(type: string): string {
  if (type === 'monthly') return '水印相机 - 月度会员';
  if (type === 'yearly') return '水印相机 - 年度会员';
  if (type === 'permanent') return '水印相机 - 永久会员';
  return '水印相机 - 单次付费';
}

function mapUser(row: any): any {
  return {
    id: row.id,
    phone: row.phone,
    isVip: !!row.is_vip,
    vipExpiresAt: row.vip_expires_at,
    createdAt: row.created_at,
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // ==================== 健康检查 ====================
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // ==================== 认证 API ====================

  app.post("/api/auth/login", (req, res) => {
    const { phone, username, password } = req.body;

    // 管理员密码登录
    if (username && password) {
      const adminUser = process.env.ADMIN_USERNAME || 'admin';
      const adminPass = process.env.ADMIN_PASSWORD || 'vip1337';
      if (username === adminUser && password === adminPass) {
        return res.json({
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
      return res.status(401).json({ success: false, error: '用户名或密码错误' });
    }

    // 普通用户手机号登录
    if (!phone) return res.status(400).json({ success: false, error: '请输入手机号' });

    let user = users.find(u => u.phone === phone);
    if (!user) {
      user = {
        id: 'u' + Date.now(),
        phone,
        is_vip: 0,
        created_at: new Date().toISOString()
      };
      users.push(user);
    }
    res.json({ success: true, user: mapUser(user) });
  });

  // 根据 ID 获取用户
  app.get("/api/auth/me/:id", (req, res) => {
    const { id } = req.params;
    if (id === 'admin') {
      return res.json({
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
    const user = users.find(u => u.id === id);
    if (!user) return res.status(404).json({ success: false, error: '用户不存在' });
    res.json({ success: true, user: mapUser(user) });
  });

  // ==================== 系统设置 API ====================
  app.get("/api/settings", (req, res) => {
    res.json({
      singlePrice: appSettings.singlePrice,
      monthlyPrice: appSettings.monthlyPrice,
      yearlyPrice: appSettings.yearlyPrice,
      permanentPrice: appSettings.permanentPrice,
      paymentAccount: appSettings.paymentAccount,
      alipayQrCode: appSettings.alipayQrCode,
      wechatQrCode: appSettings.wechatQrCode,
    });
  });

  app.post("/api/settings", (req, res) => {
    const { singlePrice, monthlyPrice, yearlyPrice, permanentPrice, paymentAccount, alipayQrCode, wechatQrCode } = req.body;
    if (singlePrice !== undefined) appSettings.singlePrice = Number(singlePrice);
    if (monthlyPrice !== undefined) appSettings.monthlyPrice = Number(monthlyPrice);
    if (yearlyPrice !== undefined) appSettings.yearlyPrice = Number(yearlyPrice);
    if (permanentPrice !== undefined) appSettings.permanentPrice = Number(permanentPrice);
    if (paymentAccount !== undefined) appSettings.paymentAccount = paymentAccount;
    if (alipayQrCode !== undefined) appSettings.alipayQrCode = alipayQrCode;
    if (wechatQrCode !== undefined) appSettings.wechatQrCode = wechatQrCode;
    res.json({ success: true, settings: appSettings });
  });

  // ==================== 订单 API ====================

  app.post('/api/orders/create', (req, res) => {
    const { type, phone, email } = req.body;
    if (!phone || !type) return res.status(400).json({ success: false, error: '缺少 phone 或 type' });
    if (!['single', 'monthly', 'yearly', 'permanent'].includes(type)) {
      return res.status(400).json({ success: false, error: '无效的套餐类型' });
    }

    const user = users.find(u => u.phone === phone);
    if (!user) return res.status(404).json({ success: false, error: '用户不存在' });

    let amount;
    switch (type) {
      case 'single':
        amount = appSettings.singlePrice;
        break;
      case 'monthly':
        amount = appSettings.monthlyPrice;
        break;
      case 'yearly':
        amount = appSettings.yearlyPrice;
        break;
      case 'permanent':
        amount = appSettings.permanentPrice;
        break;
      default:
        amount = appSettings.monthlyPrice;
    }
    const qrUrl = appSettings.wechat_qr_url || '/wechat-pay-qr.png';

    const orderId = generateOrderId();
    const now = new Date().toISOString();

    const payment: Payment = {
      id: orderId,
      order_id: orderId,
      provider: 'manual',
      type,
      amount,
      timestamp: now,
      status: 'created',
      phone,
      user_email: email || null,
    };
    payments.push(payment);

    res.json({
      success: true,
      order_id: orderId,
      amount,
      title: orderTitle(type),
      qr_url: qrUrl,
      instructions: `请扫码支付 ¥${amount.toFixed(2)}，付款时请在备注填写订单号：${orderId}`,
    });
  });

  app.post('/api/orders/:id/upload-proof', (req, res) => {
    const orderId = req.params.id;
    const { proof_base64 } = req.body;
    const proof = String(proof_base64 || '');

    const validation = validateBase64Image(proof);
    if (!validation.ok) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const order = payments.find(p => p.order_id === orderId);
    if (!order) return res.status(404).json({ success: false, error: '订单不存在' });
    if (order.status !== 'created' && order.status !== 'pending_review') {
      return res.status(400).json({ success: false, error: `订单当前状态不允许审核：${order.status}` });
    }

    const now = new Date().toISOString();
    order.status = 'pending_review';
    order.raw_notify = proof;
    order.proof_uploaded_at = now;

    res.json({ success: true, status: 'pending_review' });
  });

  app.get('/api/orders/:id/status', (req, res) => {
    const orderId = req.params.id;
    const order = payments.find(p => p.order_id === orderId);
    if (!order) return res.status(404).json({ success: false, error: '订单不存在' });
    res.json({
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
  app.post("/api/payments", (req, res) => {
    const { type, amount, timestamp, phone } = req.body;
    const payment = {
      id: Math.random().toString(36).substring(2, 9),
      order_id: generateOrderId(),
      provider: 'manual',
      type,
      amount: Number(amount),
      timestamp: timestamp || new Date().toISOString(),
      status: 'success',
      phone,
    };
    payments.push(payment);

    if (phone) {
      const user = users.find(u => u.phone === phone);
      if (user) {
        user.is_vip = 1;
        const currentExpiry = user.vip_expires_at ? new Date(user.vip_expires_at).getTime() : Date.now();
        let newExpiry;
        if (type === 'monthly') {
          newExpiry = Math.max(currentExpiry, Date.now()) + 30 * 24 * 60 * 60 * 1000;
        } else if (type === 'yearly') {
          newExpiry = Math.max(currentExpiry, Date.now()) + 365 * 24 * 60 * 60 * 1000;
        } else if (type === 'permanent') {
          user.vip_expires_at = null;
        } else {
          newExpiry = Math.max(currentExpiry, Date.now()) + 30 * 24 * 60 * 60 * 1000;
        }
        if (type !== 'permanent') {
          user.vip_expires_at = new Date(newExpiry).toISOString();
        }
      }
    }

    res.json({ success: true, payment });
  });

  // ==================== 管理后台 API ====================
  app.get("/api/admin/users", (req, res) => {
    res.json({ users: users.map(mapUser).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) });
  });

  app.get("/api/admin/payments", (req, res) => {
    const sortedPayments = [...payments].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    res.json({ payments: sortedPayments });
  });

  app.get("/api/admin/stats", (req, res) => {
    const totalRevenue = payments.filter(p => p.status === 'success').reduce((sum, p) => sum + p.amount, 0);
    const totalOrders = payments.length;
    const monthlyOrders = payments.filter(p => p.type === 'monthly').length;
    const yearlyOrders = payments.filter(p => p.type === 'yearly').length;
    const permanentOrders = payments.filter(p => p.type === 'permanent').length;
    const singleOrders = payments.filter(p => p.type === 'single').length;

    const totalUsers = users.length;
    const now = new Date().toISOString();
    const activeVips = users.filter(u => u.is_vip && (!u.vip_expires_at || u.vip_expires_at > now)).length;

    res.json({
      totalRevenue: totalRevenue.toFixed(2),
      totalOrders,
      monthlyOrders,
      yearlyOrders,
      permanentOrders,
      singleOrders,
      totalUsers,
      activeVips
    });
  });

  // -------- 订单审核 API --------

  app.get('/api/admin/orders/pending', (req, res) => {
    const pendingOrders = payments
      .filter(p => p.status === 'pending_review')
      .sort((a, b) => {
        const aTime = a.proof_uploaded_at ? new Date(a.proof_uploaded_at).getTime() : 0;
        const bTime = b.proof_uploaded_at ? new Date(b.proof_uploaded_at).getTime() : 0;
        return bTime - aTime;
      })
      .map(p => ({
        order_id: p.order_id,
        phone: p.phone,
        type: p.type,
        amount: p.amount,
        timestamp: p.timestamp,
        proof_uploaded_at: p.proof_uploaded_at,
        proof_base64: p.raw_notify,
        user_email: p.user_email,
      }));
    res.json({ orders: pendingOrders });
  });

  app.get('/api/admin/orders/pending-count', (req, res) => {
    const count = payments.filter(p => p.status === 'pending_review').length;
    res.json({ count });
  });

  app.post('/api/admin/orders/:id/approve', (req, res) => {
    const orderId = req.params.id;
    const order = payments.find(p => p.order_id === orderId);
    if (!order) return res.status(404).json({ success: false, error: '订单不存在' });
    if (order.status !== 'pending_review') {
      return res.status(400).json({ success: false, error: `订单当前状态不允许审核：${order.status}` });
    }

    const now = new Date().toISOString();
    order.status = 'success';
    order.paid_at = now;
    order.reviewed_at = now;
    order.reviewed_by = 'admin';

    // 激活 VIP
    if (order.phone) {
      const user = users.find(u => u.phone === order.phone);
      if (user) {
        user.is_vip = 1;
        const currentExpiry = user.vip_expires_at ? new Date(user.vip_expires_at).getTime() : Date.now();
        let newExpiry;
        if (order.type === 'monthly') {
          newExpiry = Math.max(currentExpiry, Date.now()) + 30 * 24 * 60 * 60 * 1000;
        } else if (order.type === 'yearly') {
          newExpiry = Math.max(currentExpiry, Date.now()) + 365 * 24 * 60 * 60 * 1000;
        } else if (order.type === 'permanent') {
          user.vip_expires_at = null;
        } else {
          newExpiry = Math.max(currentExpiry, Date.now()) + 30 * 24 * 60 * 60 * 1000;
        }
        if (order.type !== 'permanent') {
          user.vip_expires_at = new Date(newExpiry).toISOString();
        }
      }
    }

    res.json({ success: true });
  });

  app.post('/api/admin/orders/:id/reject', (req, res) => {
    const orderId = req.params.id;
    const { reason } = req.body;
    const rejectReason = String(reason || '未提供原因');

    const order = payments.find(p => p.order_id === orderId);
    if (!order) return res.status(404).json({ success: false, error: '订单不存在' });
    if (order.status !== 'pending_review') {
      return res.status(400).json({ success: false, error: `订单当前状态不允许审核：${order.status}` });
    }

    const now = new Date().toISOString();
    order.status = 'rejected';
    order.reject_reason = rejectReason;
    order.reviewed_at = now;
    order.reviewed_by = 'admin';

    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
