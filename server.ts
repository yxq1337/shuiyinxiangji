import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

// In-memory database for demo purposes
const payments: any[] = [
  { id: 'demo1', type: 'single', amount: 1.99, timestamp: new Date(Date.now() - 86400000).toISOString(), status: 'success', phone: '13800138000' },
  { id: 'demo2', type: 'monthly', amount: 9.90, timestamp: new Date(Date.now() - 3600000).toISOString(), status: 'success', phone: '13900139000' }
];

const users: any[] = [
  { id: 'u1', phone: '13800138000', isVip: false, vipExpiresAt: null, createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'u2', phone: '13900139000', isVip: true, vipExpiresAt: new Date(Date.now() + 29 * 86400000).toISOString(), createdAt: new Date(Date.now() - 3600000).toISOString() }
];

let appSettings = {
  singlePrice: 1.99,
  monthlyPrice: 9.90,
  paymentAccount: 'admin@example.com',
  alipayQrCode: '',
  wechatQrCode: ''
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Auth API
  app.post("/api/auth/login", (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone required' });
    
    let user = users.find(u => u.phone === phone);
    if (!user) {
      user = { 
        id: 'u' + Date.now(), 
        phone, 
        isVip: false, 
        vipExpiresAt: null, 
        createdAt: new Date().toISOString() 
      };
      users.push(user);
    }
    res.json({ success: true, user });
  });

  // Settings API
  app.get("/api/settings", (req, res) => {
    res.json(appSettings);
  });

  app.post("/api/settings", (req, res) => {
    const { singlePrice, monthlyPrice, paymentAccount, alipayQrCode, wechatQrCode } = req.body;
    if (singlePrice !== undefined) appSettings.singlePrice = Number(singlePrice);
    if (monthlyPrice !== undefined) appSettings.monthlyPrice = Number(monthlyPrice);
    if (paymentAccount !== undefined) appSettings.paymentAccount = paymentAccount;
    if (alipayQrCode !== undefined) appSettings.alipayQrCode = alipayQrCode;
    if (wechatQrCode !== undefined) appSettings.wechatQrCode = wechatQrCode;
    res.json({ success: true, settings: appSettings });
  });

  // Record a new payment
  app.post("/api/payments", (req, res) => {
    const { type, amount, timestamp, phone } = req.body;
    const payment = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      amount,
      timestamp: timestamp || new Date().toISOString(),
      status: 'success',
      phone
    };
    payments.push(payment);

    // Update user VIP status if monthly
    if (phone && type === 'monthly') {
      const user = users.find(u => u.phone === phone);
      if (user) {
        user.isVip = true;
        const currentExpiry = user.vipExpiresAt ? new Date(user.vipExpiresAt).getTime() : Date.now();
        const newExpiry = Math.max(currentExpiry, Date.now()) + 30 * 24 * 60 * 60 * 1000;
        user.vipExpiresAt = new Date(newExpiry).toISOString();
      }
    }

    res.json({ success: true, payment });
  });

  // Admin API: Get Users
  app.get("/api/admin/users", (req, res) => {
    res.json({ users });
  });

  // Get all payments for admin
  app.get("/api/admin/payments", (req, res) => {
    const sortedPayments = [...payments].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    res.json({ payments: sortedPayments });
  });

  // Get stats for admin
  app.get("/api/admin/stats", (req, res) => {
    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalOrders = payments.length;
    const monthlyOrders = payments.filter(p => p.type === 'monthly').length;
    const singleOrders = payments.filter(p => p.type === 'single').length;
    
    const totalUsers = users.length;
    const activeVips = users.filter(u => u.isVip && (!u.vipExpiresAt || new Date(u.vipExpiresAt).getTime() > Date.now())).length;

    res.json({ 
      totalRevenue: totalRevenue.toFixed(2), 
      totalOrders,
      monthlyOrders,
      singleOrders,
      totalUsers,
      activeVips
    });
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
