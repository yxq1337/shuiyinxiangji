-- 社区信息表 schema 迁移（v4）
-- 为骑手社区新增：信息发布表 + 举报表
-- 使用方法: wrangler d1 execute shuiyinxiangji-db --file=worker/schema-migrate-v4-community.sql

-- 社区信息发布表
-- category: battery(租电) | job(找工作) | usedcar(二手车) | help(求助互助)
-- status: pending(待审核) | approved(已上架) | rejected(已驳回) | offline(已下架/过期)
-- 信息审核通过后 15 天自动下架（expires_at）
CREATE TABLE IF NOT EXISTS community_listings (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  city TEXT DEFAULT '',
  area TEXT DEFAULT '',
  price REAL DEFAULT 0,
  contact TEXT DEFAULT '',
  -- 分类专属字段（JSON 字符串，灵活扩展）
  extra TEXT DEFAULT '{}',
  user_id TEXT DEFAULT '',
  user_phone TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  reject_reason TEXT DEFAULT '',
  view_count INTEGER NOT NULL DEFAULT 0,
  contact_reveal_count INTEGER NOT NULL DEFAULT 0,
  report_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  approved_at TEXT,
  expires_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_community_listings_category ON community_listings(category);
CREATE INDEX IF NOT EXISTS idx_community_listings_city ON community_listings(city);
CREATE INDEX IF NOT EXISTS idx_community_listings_status ON community_listings(status);
CREATE INDEX IF NOT EXISTS idx_community_listings_created ON community_listings(created_at);
CREATE INDEX IF NOT EXISTS idx_community_listings_expires ON community_listings(expires_at);

-- 社区举报表
CREATE TABLE IF NOT EXISTS community_reports (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  reporter_id TEXT DEFAULT '',
  reporter_phone TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_community_reports_listing ON community_reports(listing_id);

-- 插入几条示例数据（已审核通过，方便本地演示）
INSERT OR IGNORE INTO community_listings (id, category, title, description, city, area, price, contact, extra, user_id, user_phone, status, created_at, approved_at, expires_at) VALUES
('cl-demo-battery-1', 'battery', '星恒 48V20Ah 锂电池出租，支持换电', '星恒品牌锂电池，48V20Ah，续航约50公里，支持全城换电，押金可退。', '上海', '浦东新区', 299, '138****1234', '{"brand":"星恒","capacity":"48V20Ah","monthlyRent":299,"deposit":500,"swappable":true,"coverageArea":"浦东新区、徐汇区"}', 'demo', '13800138000', 'approved', datetime('now','-2 days'), datetime('now','-2 days'), datetime('now','+13 days')),
('cl-demo-job-1', 'job', '美团专送骑手招聘，单价高，单量稳', '美团专送，站点直招，单价7元/单起，月入8000+，提供装备和电池。', '北京', '朝阳区', 0, '139****5678', '{"platform":"美团","jobType":"专送","unitPrice":7,"requirements":"会骑电动车，身体健康"}', 'demo', '13900139000', 'approved', datetime('now','-1 day'), datetime('now','-1 day'), datetime('now','+14 days')),
('cl-demo-usedcar-1', 'usedcar', '雅迪电动车转让，9成新，手续齐全', '雅迪冠能M6，2023年购入，行驶3000公里，电池健康，有牌照有发票。', '深圳', '南山区', 1800, '137****9012', '{"brand":"雅迪","carAge":2,"batteryCondition":"良好","hasDocuments":true,"hasPlate":true}', 'demo', '13700000000', 'approved', datetime('now','-3 days'), datetime('now','-3 days'), datetime('now','+12 days'));
