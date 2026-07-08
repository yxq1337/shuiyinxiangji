-- Cloudflare D1 数据库初始化脚本
-- 使用方法: wrangler d1 execute shuiyinxiangji-db --file=schema.sql

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  is_vip INTEGER NOT NULL DEFAULT 0,
  vip_expires_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- 支付记录表
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  timestamp TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success',
  phone TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_phone ON payments(phone);
CREATE INDEX IF NOT EXISTS idx_payments_timestamp ON payments(timestamp);

-- 系统设置表（单行）
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  single_price REAL NOT NULL DEFAULT 1.99,
  monthly_price REAL NOT NULL DEFAULT 9.90,
  payment_account TEXT DEFAULT '',
  alipay_qr_code TEXT DEFAULT '',
  wechat_qr_code TEXT DEFAULT ''
);

-- 插入默认设置行
INSERT OR IGNORE INTO settings (id, single_price, monthly_price, payment_account)
VALUES (1, 1.99, 9.90, 'admin@example.com');

-- 插入 demo 用户（可选，用于测试）
INSERT OR IGNORE INTO users (id, phone, is_vip, vip_expires_at, created_at) VALUES
  ('u1', '13800138000', 0, NULL, datetime('now', '-1 day')),
  ('u2', '13900139000', 1, datetime('now', '+29 days'), datetime('now', '-1 hour'));

-- 插入 demo 支付记录
INSERT OR IGNORE INTO payments (id, type, amount, timestamp, status, phone) VALUES
  ('demo1', 'single', 1.99, datetime('now', '-1 day'), 'success', '13800138000'),
  ('demo2', 'monthly', 9.90, datetime('now', '-1 hour'), 'success', '13900139000');
