/**
 * API 请求配置
 * - 开发环境：请求走 Vite 代理，转发到本地 Express (localhost:3000)
 * - 生产环境（Cloudflare Pages）：请求发到 Workers（通过环境变量配置）
 * - 生产环境（腾讯云 CloudBase）：将 API_BASE 改为云函数地址
 */

// 优先使用环境变量，其次使用腾讯云 CloudBase 云函数
const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'https://shuiyinxiangji-d2gbpqs4wea28beb5-1415424323.ap-shanghai.app.tcloudbase.com';

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

  let res: Response;
  try {
    // 先尝试 POST 请求
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (postError) {
    console.log('POST failed, trying GET as fallback');
    // POST 失败，尝试用 GET 请求作为备选方案
    const getUrl = new URL(url);
    if (body) {
      Object.entries(body).forEach(([key, value]) => {
        getUrl.searchParams.set(key, String(value));
      });
    }
    res = await fetch(getUrl.toString(), {
      method: 'GET',
    });
  }

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
