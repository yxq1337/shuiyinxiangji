import { apiGet, apiPost } from './api';
import { parseRealName } from '../../shared/checkin';

export { parseRealName };

export interface CheckinEventSummary {
  code: string;
  title: string;
  address: string;
  radiusMeters: number;
  status: 'open' | 'closed';
  count: number;
  createdAt?: string;
  latitude?: number;
  longitude?: number;
}

export interface CheckinPerson {
  realName: string;
  distanceMeters: number;
  createdAt: string;
}

export interface CheckinRoster {
  event: CheckinEventSummary;
  records: CheckinPerson[];
}

export interface SignResult {
  success: boolean;
  already?: boolean;
  error?: string;
  distanceMeters?: number;
  radiusMeters?: number;
  record?: CheckinPerson;
}

export async function createCheckinEvent(body: {
  title: string;
  address: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  ownerId: string;
  ownerPhone: string;
}): Promise<CheckinEventSummary> {
  const data = await apiPost<{ success: boolean; error?: string; event?: CheckinEventSummary }>(
    '/api/checkin/events',
    body
  );
  if (!data.success || !data.event) throw new Error(data.error || '创建签到失败');
  return data.event;
}

export async function listMyCheckins(ownerId: string): Promise<CheckinEventSummary[]> {
  const data = await apiGet<{ success: boolean; events?: CheckinEventSummary[] }>(
    `/api/checkin/mine?ownerId=${encodeURIComponent(ownerId)}`
  );
  return data.events || [];
}

export async function getPublicCheckin(code: string): Promise<CheckinEventSummary> {
  const data = await apiGet<{ success: boolean; error?: string; event?: CheckinEventSummary }>(
    `/api/checkin/events/${encodeURIComponent(code)}`
  );
  if (!data.success || !data.event) throw new Error(data.error || '签到不存在');
  return data.event;
}

export async function getCheckinRoster(code: string, ownerId: string): Promise<CheckinRoster> {
  const data = await apiGet<{ success: boolean; error?: string; event?: CheckinEventSummary; records?: CheckinPerson[] }>(
    `/api/checkin/events/${encodeURIComponent(code)}/roster?ownerId=${encodeURIComponent(ownerId)}`
  );
  if (!data.success || !data.event) throw new Error(data.error || '无法查看签到统计');
  return { event: data.event, records: data.records || [] };
}

export async function signCheckin(code: string, body: {
  realName: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
}): Promise<SignResult> {
  return apiPost<SignResult>(`/api/checkin/events/${encodeURIComponent(code)}/sign`, body);
}

export async function closeCheckin(code: string, ownerId: string): Promise<void> {
  const data = await apiPost<{ success: boolean; error?: string }>(
    `/api/checkin/events/${encodeURIComponent(code)}/close`,
    { ownerId }
  );
  if (!data.success) throw new Error(data.error || '结束签到失败');
}

export async function deleteCheckin(code: string, ownerId: string): Promise<void> {
  const data = await apiPost<{ success: boolean; error?: string }>(
    `/api/checkin/events/${encodeURIComponent(code)}/delete`,
    { ownerId }
  );
  if (!data.success) throw new Error(data.error || '删除签到失败');
}
