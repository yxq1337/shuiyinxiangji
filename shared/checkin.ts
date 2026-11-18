/** 扫描签到的区域与姓名规则。本地服务和 Workers 共用，云函数里有一份相同判断。 */

export const CHECKIN_GPS_TOLERANCE_M = 20;
export const CHECKIN_MIN_RADIUS_M = 50;
export const CHECKIN_MAX_RADIUS_M = 5000;

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomCheckinCode(length = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const earth = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * earth * Math.asin(Math.min(1, Math.sqrt(a))));
}

/** 真实姓名：2-20 个汉字，间隔号 · 可用于少数民族姓名。 */
export function parseRealName(raw: unknown): string | null {
  const name = String(raw ?? '').trim().replace(/\s+/g, '');
  if (!/^[\u4e00-\u9fa5·]{2,20}$/.test(name)) return null;
  if (name.replace(/·/g, '').length < 2) return null;
  return name;
}

export function parseTitle(raw: unknown): string | null {
  const title = String(raw ?? '').trim();
  if (!title || title.length > 40) return null;
  return title;
}

export function parseAddress(raw: unknown): string {
  return String(raw ?? '').trim().slice(0, 80);
}

export function parseRadius(raw: unknown): number | null {
  const radius = Number(raw);
  if (!Number.isFinite(radius)) return null;
  const rounded = Math.round(radius);
  if (rounded < CHECKIN_MIN_RADIUS_M || rounded > CHECKIN_MAX_RADIUS_M) return null;
  return rounded;
}

export function parseLatLng(latRaw: unknown, lngRaw: unknown): { latitude: number; longitude: number } | null {
  const latitude = Number(latRaw);
  const longitude = Number(lngRaw);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

export function normalizeCheckinCode(raw: unknown): string {
  return String(raw ?? '').trim().toUpperCase();
}

export interface SignOk {
  ok: true;
  realName: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
}

export interface SignFail {
  ok: false;
  status: 400 | 403;
  error: string;
  distanceMeters?: number;
  radiusMeters?: number;
}

/** 判断这次定位能否签到。精度太差或超出半径（含少量 GPS 抖动容差）都会拒绝。 */
export function evaluateSign(args: {
  eventStatus: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  realName: unknown;
  latitude: unknown;
  longitude: unknown;
  accuracy: unknown;
}): SignOk | SignFail {
  if (args.eventStatus !== 'open') {
    return { ok: false, status: 403, error: '签到已结束' };
  }

  const realName = parseRealName(args.realName);
  if (!realName) {
    return { ok: false, status: 400, error: '请填写真实姓名（2-20 个汉字）' };
  }

  const point = parseLatLng(args.latitude, args.longitude);
  if (!point) {
    return { ok: false, status: 400, error: '无法读取位置，请允许定位后重试' };
  }

  const accuracy = Number(args.accuracy);
  if (Number.isFinite(accuracy) && accuracy > Math.max(args.radiusMeters, 100)) {
    return {
      ok: false,
      status: 400,
      error: `定位不够精确（误差约 ${Math.round(accuracy)} 米），请打开手机定位或走到窗边后重试`,
    };
  }

  const distance = distanceMeters(args.centerLat, args.centerLng, point.latitude, point.longitude);
  if (distance > args.radiusMeters + CHECKIN_GPS_TOLERANCE_M) {
    return {
      ok: false,
      status: 403,
      error: `不在签到区域内：距离签到点 ${distance} 米，仅限 ${args.radiusMeters} 米内`,
      distanceMeters: distance,
      radiusMeters: args.radiusMeters,
    };
  }

  return {
    ok: true,
    realName,
    latitude: point.latitude,
    longitude: point.longitude,
    distanceMeters: distance,
  };
}
