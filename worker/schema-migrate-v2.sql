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
