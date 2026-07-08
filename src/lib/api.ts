/**
 * API 请求配置
 * - 开发环境：请求走 Vite 代理，转发到本地 Express (localhost:3000)
 * - 生产环境（Cloudflare Pages）：请求发到 Workers（通过环境变量配置）
 */

// 优先使用环境变量，其次使用相对路径（同域部署时）
const API_BASE = (import.meta as any).env?.VITE_API_BASE || '';

export function apiUrl(path: string): string {
  if (path.startsWith('http')) return path;
  return `${API_BASE}${path}`;
}

export async function apiGet<T = any>(path: string): Promise<T> {
  const res = await fetch(apiUrl(path));
  return res.json();
}

export async function apiPost<T = any>(path: string, body?: any): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}
