/**
 * 订单相关工具函数
 */

export function generateOrderId(): string {
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

export function validateBase64Image(data: string): { ok: boolean; error?: string } {
  if (!data.startsWith('data:image/')) {
    return { ok: false, error: '仅支持图片格式' };
  }
  const sizeBytes = (data.length * 3) / 4;
  if (sizeBytes > 900 * 1024) {
    return { ok: false, error: '图片过大，请压缩后重传（当前接近 1MB 限制）' };
  }
  return { ok: true };
}

export function orderTitle(type: string): string {
  return type === 'monthly' ? '水印相机 - 月度会员' : '水印相机 - 单次付费';
}
