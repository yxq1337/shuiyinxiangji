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
  const url = apiUrl(path);
  console.log('GET', url);
  const res = await fetch(url);
  console.log('Response status:', res.status);

  const text = await res.text();
  console.log('Response:', text.substring(0, 200));

  try {
    return JSON.parse(text);
  } catch (e) {
    console.error('JSON parse error:', e);
    throw new Error(`Invalid JSON response: ${text.substring(0, 50)}`);
  }
}

export async function apiPost<T = any>(path: string, body?: any): Promise<T> {
  const url = apiUrl(path);
  console.log('POST', url, body);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  console.log('Response status:', res.status);

  const text = await res.text();
  console.log('Response:', text.substring(0, 200));

  try {
    return JSON.parse(text);
  } catch (e) {
    console.error('JSON parse error:', e);
    throw new Error(`Invalid JSON response: ${text.substring(0, 50)}`);
  }
}
