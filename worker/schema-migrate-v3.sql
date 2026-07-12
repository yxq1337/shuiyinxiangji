-- v3 迁移：截图审核支付方案

-- payments 表新增审核字段
ALTER TABLE payments ADD COLUMN proof_uploaded_at TEXT;
ALTER TABLE payments ADD COLUMN reviewed_at TEXT;
ALTER TABLE payments ADD COLUMN reviewed_by TEXT;
ALTER TABLE payments ADD COLUMN reject_reason TEXT;
ALTER TABLE payments ADD COLUMN user_email TEXT;

-- settings 表新增支付配置字段
ALTER TABLE settings ADD COLUMN wechat_qr_url TEXT DEFAULT '';
ALTER TABLE settings ADD COLUMN admin_email TEXT DEFAULT '';
ALTER TABLE settings ADD COLUMN resend_api_key TEXT DEFAULT '';
