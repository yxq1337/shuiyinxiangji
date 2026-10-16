/**
 * 骑手社区 - 共享类型定义与 API 封装
 */
import { apiGet, apiPost } from './api';

// ==================== 类型定义 ====================

// 板块分类
export type CommunityCategory = 'battery' | 'job' | 'usedcar' | 'help';

// 信息状态
export type ListingStatus = 'pending' | 'approved' | 'rejected' | 'offline';

// 租电专属字段
export interface BatteryExtra {
  brand: string;          // 品牌
  capacity: string;       // 容量 如 48V20Ah
  monthlyRent: number;    // 月租
  deposit: number;        // 押金
  swappable: boolean;     // 是否支持换电
  coverageArea: string;   // 覆盖区域
}

// 找工作专属字段
export interface JobExtra {
  platform: '美团' | '饿了么' | '众包' | '其他';
  jobType?: string;       // 专送/众包/兼职
  unitPrice?: number;     // 单价
  requirements?: string;  // 要求
}

// 二手车专属字段
export interface UsedCarExtra {
  brand: string;              // 品牌
  carAge: number;             // 车龄（年）
  batteryCondition: string;   // 电池状况
  hasDocuments: boolean;      // 有无手续
  hasPlate: boolean;          // 有无牌照
}

// 求助互助专属字段
export interface HelpExtra {
  helpType?: string;
}

export type ListingExtra = BatteryExtra | JobExtra | UsedCarExtra | HelpExtra | Record<string, any>;

// 社区信息
export interface CommunityListing {
  id: string;
  category: CommunityCategory;
  title: string;
  description: string;
  city: string;
  area: string;
  price: number;
  contact: string;            // 脱敏后的联系方式（列表/详情默认显示脱敏）
  extra: ListingExtra;
  images: string[];           // 图片 base64 数组
  userId: string;
  userPhone: string;
  status: ListingStatus;
  rejectReason?: string;
  viewCount: number;
  contactRevealCount: number;
  reportCount: number;
  createdAt: string;
  approvedAt?: string;
  expiresAt?: string;
}

// 创建信息请求
export interface CreateListingPayload {
  category: CommunityCategory;
  title: string;
  description: string;
  city: string;
  area: string;
  price: number;
  contact: string;
  extra: ListingExtra;
  images?: string[];
  userId?: string;
  userPhone?: string;
}

// 列表查询参数
export interface ListListingsParams {
  category?: CommunityCategory;
  city?: string;
  area?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  pageSize?: number;
}

// 举报请求
export interface ReportPayload {
  reason: string;
  reporterId?: string;
  reporterPhone?: string;
}

// 板块元信息
export interface CategoryMeta {
  key: CommunityCategory;
  label: string;
  desc: string;
  color: string;
  bgColor: string;
}

export const CATEGORIES: CategoryMeta[] = [
  { key: 'battery', label: '租电', desc: '电池租赁 / 换电', color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
  { key: 'job', label: '找工作', desc: '骑手招聘', color: 'text-orange-600', bgColor: 'bg-orange-50' },
  { key: 'usedcar', label: '二手车', desc: '电动车转让', color: 'text-blue-600', bgColor: 'bg-blue-50' },
  { key: 'help', label: '求助互助', desc: '骑手互帮', color: 'text-purple-600', bgColor: 'bg-purple-50' },
];

export function getCategoryMeta(key: CommunityCategory): CategoryMeta {
  return CATEGORIES.find((c) => c.key === key) || CATEGORIES[0];
}

// 禁发清单（前端提示用）
export const PROHIBITED_LIST: string[] = [
  '违法违禁品、管制刀具、毒品等',
  '虚假招聘、传销、刷单诈骗信息',
  '涉黄、涉赌、涉毒内容',
  '冒充平台官方或工作人员',
  '未经证实的理财、贷款、套现信息',
  '侵犯他人隐私或肖像权的内容',
];

// 交易提示
export const TRANSACTION_TIPS: string[] = [
  '当面验车、验电池，核对手续和牌照',
  '切勿提前转账大额押金，走平台担保或当面交易',
  '要求查看卖家身份证，保留聊天和转账记录',
  '价格明显低于市场价的要提高警惕',
  '交易完成后及时删除或标记信息',
];

// ==================== API 封装 ====================

export async function listListings(params: ListListingsParams = {}): Promise<CommunityListing[]> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') query.set(k, String(v));
  });
  const data = await apiGet<{ listings: CommunityListing[] }>(`/api/community/listings?${query.toString()}`);
  return data.listings || [];
}

export async function getListing(id: string): Promise<CommunityListing> {
  const data = await apiGet<{ listing: CommunityListing }>(`/api/community/listings/${id}`);
  return data.listing;
}

export async function createListing(payload: CreateListingPayload): Promise<{ success: boolean; id: string }> {
  return apiPost<{ success: boolean; id: string }>('/api/community/listings', payload);
}

// 点击查看联系方式（会记录并计数）
export async function revealContact(id: string): Promise<{ contact: string }> {
  return apiPost<{ contact: string }>(`/api/community/listings/${id}/reveal-contact`);
}

export async function reportListing(id: string, payload: ReportPayload): Promise<{ success: boolean }> {
  return apiPost<{ success: boolean }>(`/api/community/listings/${id}/report`, payload);
}

// 管理后台
export async function listPendingListings(): Promise<CommunityListing[]> {
  const data = await apiGet<{ listings: CommunityListing[] }>('/api/admin/community/pending');
  return data.listings || [];
}

export async function approveListing(id: string): Promise<{ success: boolean }> {
  return apiPost<{ success: boolean }>(`/api/admin/community/${id}/approve`);
}

export async function rejectListing(id: string, reason: string): Promise<{ success: boolean }> {
  return apiPost<{ success: boolean }>(`/api/admin/community/${id}/reject`, { reason });
}

// ==================== 工具函数 ====================

// 手机号脱敏
export function maskPhone(phone: string): string {
  if (!phone) return '';
  const s = String(phone);
  if (s.length <= 7) return s.replace(/./g, '*');
  return s.slice(0, 3) + '****' + s.slice(-4);
}

// 压缩图片为 base64（最大边 800px，JPEG 质量 0.7）
export function compressImage(file: File, maxSize = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        } else if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(''); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 格式化价格
export function formatPrice(price: number, category: CommunityCategory): string {
  if (category === 'job') return price > 0 ? `¥${price}/单` : '面议';
  if (category === 'battery') return price > 0 ? `¥${price}/月` : '面议';
  return price > 0 ? `¥${price}` : '面议';
}

// 剩余天数
export function daysLeft(expiresAt?: string): number | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}
