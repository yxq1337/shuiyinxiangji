'use strict';

const cloud = require('@cloudbase/node-sdk');
const https = require('https');
const crypto = require('crypto');

// 初始化 CloudBase SDK
const app = cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = app.database();
const _ = db.command;

// 集合引用
const usersCollection = db.collection('users');
const paymentsCollection = db.collection('payments');
const settingsCollection = db.collection('settings');
const communityListingsCollection = db.collection('community_listings');
const communityReportsCollection = db.collection('community_reports');
const aiCallTasksCollection = db.collection('ai_call_tasks');

// 工具函数
function generateOrderId() {
  const now = new Date();
  const YY = String(now.getFullYear() % 100).padStart(2, '0');
  const MM = String(now.getMonth() + 1).padStart(2, '0');
  const DD = String(now.getDate()).padStart(2, '0');
  const HH = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let rand = '';
  for (let i = 0; i < 4; i++) rand += chars.charAt(Math.floor(Math.random() * chars.length));
  return `SY${YY}${MM}${DD}${HH}${mm}${rand}`;
}

function validateBase64Image(data) {
  if (!data.startsWith('data:image/')) {
    return { ok: false, error: '仅支持图片格式' };
  }
  const sizeBytes = (data.length * 3) / 4;
  if (sizeBytes > 900 * 1024) {
    return { ok: false, error: '图片过大，请压缩后重传' };
  }
  return { ok: true };
}

function orderTitle(type) {
  if (type === 'monthly') return '水印相机 - 月度会员';
  if (type === 'yearly') return '水印相机 - 年度会员';
  if (type === 'permanent') return '水印相机 - 永久会员';
  return '水印相机 - 单次付费';
}

function mapUser(doc) {
  return {
    id: doc._id,
    phone: doc.phone,
    isVip: !!doc.isVip,
    vipExpiresAt: doc.vipExpiresAt,
    createdAt: doc.createdAt
  };
}

// 初始化设置（如果不存在）
async function ensureSettings() {
  const result = await settingsCollection.doc('settings').get();
  if (!result.data.length) {
    // 不创建，直接返回默认值
    return {
      singlePrice: 1.99,
      monthlyPrice: 9.90,
      yearlyPrice: 19.90,
      permanentPrice: 29.90,
      paymentAccount: 'admin@example.com',
      alipayQrCode: '',
      wechatQrCode: '',
      wechatQrUrl: '',
      adminEmail: '',
      resendApiKey: ''
    };
  }
  return result.data[0];
}

// 获取设置
async function getSettings() {
  const result = await settingsCollection.doc('settings').get();
  if (!result.data.length) {
    return ensureSettings();
  }
  return result.data[0];
}

// 更新设置
async function updateSettings(updates) {
  const now = new Date().toISOString();
  await settingsCollection.doc('settings').update({
    ...updates,
    updatedAt: now
  });
  return getSettings();
}

// 根据手机号获取或创建用户
async function getOrCreateUser(phone) {
  const result = await usersCollection.where({ phone }).get();
  if (result.data.length) {
    return result.data[0];
  }

  const now = new Date().toISOString();
  const newUser = {
    phone,
    isVip: false,
    vipExpiresAt: null,
    createdAt: now,
    updatedAt: now
  };

  const addResult = await usersCollection.add(newUser);
  return { ...newUser, _id: addResult.id };
}

// 根据ID获取用户
async function getUserById(id) {
  const result = await usersCollection.doc(id).get();
  if (!result.data.length) {
    return null;
  }
  return result.data[0];
}

// ==================== 夸克扫描王（第三方 AI 文档处理） ====================
const QUARK_API_HOST = 'scan-business.quark.cn';
const QUARK_API_PATH = '/vision';
// 调用方平台标识，仅作上报用，可用环境变量覆盖
const QUARK_PLATFORM = process.env.QUARK_PLATFORM || 'community';

/**
 * 调用夸克扫描王开放接口
 * 请求体：aiApiKey / dataType / scene / dataBase64 / inputConfigs?
 * 响应体：{ code, message, data }，成功码为 "00000"
 */
function callQuarkVision(payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = https.request(
      {
        hostname: QUARK_API_HOST,
        path: QUARK_API_PATH,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          'X-Appbuilder-From': QUARK_PLATFORM
        },
        timeout: 120000
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw));
          } catch (e) {
            reject(new Error(`夸克接口返回非 JSON（HTTP ${res.statusCode}）`));
          }
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('夸克接口请求超时')));
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ==================== AI 电话外呼（DeepSeek 话术 + 阿里云外呼线路） ====================

function getRequestHeader(event, name) {
  const headerMap = event.headers || {};
  const key = Object.keys(headerMap).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? headerMap[key] : undefined;
}

// 管理员令牌：登录时签发，HMAC-SHA256 签名，12 小时有效
function adminTokenSecret() {
  return process.env.ADMIN_TOKEN_SECRET || process.env.ADMIN_PASSWORD || 'yaobox-admin';
}

function signAdminToken(ttlMs = 12 * 60 * 60 * 1000) {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + ttlMs })).toString('base64url');
  const signature = crypto.createHmac('sha256', adminTokenSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifyAdminToken(event) {
  const raw = getRequestHeader(event, 'authorization') || '';
  const token = raw.replace(/^Bearer\s+/i, '').trim();
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  const expected = crypto.createHmac('sha256', adminTokenSecret()).update(payload).digest('base64url');
  if (expected !== signature) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof exp === 'number' && exp > Date.now();
  } catch {
    return false;
  }
}

function aiCallEnv() {
  return {
    deepseekKey: process.env.DEEPSEEK_API_KEY || '',
    deepseekModel: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    deepseekBase: process.env.DEEPSEEK_BASE || 'https://api.deepseek.com',
    aliyunAccessKeyId: process.env.ALIYUN_ACCESS_KEY_ID || '',
    aliyunAccessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET || '',
    aliyunEndpoint: process.env.ALIYUN_CALL_ENDPOINT || 'dyvmsapi.aliyuncs.com',
    aliyunVersion: process.env.ALIYUN_CALL_VERSION || '2017-05-25',
    aliyunAction: process.env.ALIYUN_CALL_ACTION || 'SingleCallByTts',
    aliyunCallerNumber: process.env.ALIYUN_CALLER_NUMBER || '',
    aliyunTtsCode: process.env.ALIYUN_TTS_CODE || '',
    aliyunTtsContentKey: process.env.ALIYUN_TTS_CONTENT_KEY || 'content',
    aliyunRegionId: process.env.ALIYUN_REGION_ID || 'cn-hangzhou',
  };
}

function isAliyunConfigured(cfg) {
  return Boolean(cfg.aliyunAccessKeyId && cfg.aliyunAccessKeySecret && cfg.aliyunCallerNumber && cfg.aliyunTtsCode);
}

// 阿里云 RPC 签名规范（SignatureVersion 1.0 / HMAC-SHA1）
function percentEncode(value) {
  return encodeURIComponent(String(value))
    .replace(/\+/g, '%20')
    .replace(/\*/g, '%2A')
    .replace(/%7E/g, '~');
}

/**
 * 通用阿里云 RPC 调用。
 * 产品接口可通过环境变量配置（ALIYUN_CALL_ENDPOINT / VERSION / ACTION），
 * 默认走语音服务 dyvmsapi 的 SingleCallByTts（语音通知外呼，需已审核的 TtsCode 模板）。
 */
async function aliyunRpc(cfg, action, params) {
  const commonParams = {
    Action: action,
    Format: 'JSON',
    Version: cfg.aliyunVersion,
    AccessKeyId: cfg.aliyunAccessKeyId,
    SignatureMethod: 'HMAC-SHA1',
    SignatureVersion: '1.0',
    SignatureNonce: crypto.randomUUID(),
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    RegionId: cfg.aliyunRegionId,
  };
  const allParams = { ...commonParams, ...params };
  const canonical = Object.keys(allParams)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(allParams[key])}`)
    .join('&');
  const stringToSign = `POST&${percentEncode('/')}&${percentEncode(canonical)}`;
  const signature = crypto
    .createHmac('sha1', `${cfg.aliyunAccessKeySecret}&`)
    .update(stringToSign)
    .digest('base64');

  const res = await fetch(`https://${cfg.aliyunEndpoint}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `Signature=${percentEncode(signature)}&${canonical}`,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 500) };
  }
  // 阿里云错误响应带 Code 字段
  return { ok: res.ok && !data.Code, status: res.status, data };
}

async function deepseekChat(cfg, messages, options = {}) {
  const res = await fetch(`${cfg.deepseekBase}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.deepseekKey}`,
    },
    body: JSON.stringify({
      model: cfg.deepseekModel,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1200,
    }),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`DeepSeek 返回非 JSON（HTTP ${res.status}）`);
  }
  if (!res.ok || data.error) {
    throw new Error((data.error && data.error.message) || `DeepSeek 请求失败（HTTP ${res.status}）`);
  }
  return (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
}

async function ensureAiCallCollection() {
  try {
    await aiCallTasksCollection.limit(1).get();
  } catch (err) {
    const message = String((err && err.message) || '');
    const code = String((err && err.code) || '');
    if (message.includes('not exist') || code.includes('COLLECTION_NOT_EXIST')) {
      await db.createCollection('ai_call_tasks');
    } else {
      throw err;
    }
  }
}

async function placeOutboundCall(cfg, number, script) {
  const params = {
    CalledNumber: number,
    CalledShowNumber: cfg.aliyunCallerNumber,
    TtsCode: cfg.aliyunTtsCode,
  };
  if (script) {
    const content = String(script).replace(/\s+/g, ' ').slice(0, 200);
    params.TtsParam = JSON.stringify({ [cfg.aliyunTtsContentKey]: content });
  }
  return aliyunRpc(cfg, cfg.aliyunAction, params);
}

exports.main = async (event, context) => {
  console.log('=== RAW EVENT ===', JSON.stringify(event, null, 2));

  // 解析 HTTP 方法
  const httpMethod = event.httpMethod || event.requestContext?.http?.method || 'GET';

  // 解析路径
  let path = event.path || event.rawPath || '/';

  // 解析 body
  let body = event.body;
  let isBase64Encoded = event.isBase64Encoded;

  // 如果是 base64 编码的 body，先解码
  if (isBase64Encoded && typeof body === 'string') {
    try {
      body = Buffer.from(body, 'base64').toString('utf8');
      console.log('=== Decoded base64 body ===', body);
    } catch (e) {
      console.error('=== Failed to decode base64 body ===', e);
    }
  }

  // 如果 body 是字符串，尝试解析为 JSON
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === 'object') {
        body = parsed;
        console.log('=== Parsed JSON body ===', body);
      }
    } catch (e) {
      console.log('=== Body is not JSON, keeping as string ===', body);
    }
  }

  // 如果 body 还是不存在，尝试从 event 的其他位置获取
  if (!body || typeof body !== 'object') {
    const possibleBodyFields = ['phone', 'username', 'password', 'type', 'reason', 'singlePrice', 'monthlyPrice', 'yearlyPrice', 'permanentPrice', 'paymentAccount', 'alipayQrCode', 'wechatQrCode', 'proof_base64', 'email'];
    let hasBodyFields = false;
    const extractedBody = {};
    for (const field of possibleBodyFields) {
      if (event[field] !== undefined) {
        extractedBody[field] = event[field];
        hasBodyFields = true;
      }
    }
    if (hasBodyFields) {
      body = extractedBody;
      console.log('=== Extracted body from event fields ===', body);
    }
  }

  // CloudBase HTTP 触发可能会带上 /api 前缀，需要处理
  // 使用 while 兼容历史前端构建出的双前缀（/api/api/...），逐段剥离到真实路由
  while (path.startsWith('/api')) {
    path = path.slice(4);
  }
  if (!path.startsWith('/')) {
    path = '/' + path;
  }

  console.log('=== Final parsed ===', { httpMethod, path, body });

  // 设置CORS头
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // 处理OPTIONS预检请求
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // ==================== 调试端点 ====================
    if (path === '/debug') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          httpMethod,
          path,
          eventKeys: Object.keys(event),
          event,
          hasBody: !!body,
          bodyType: typeof body,
          body,
          bodyIsString: typeof body === 'string',
          parsedBody: typeof body === 'string' ? (() => { try { return JSON.parse(body); } catch(e) { return String(e); } })() : null
        })
      };
    }

    // ==================== 健康检查 ====================
    if (httpMethod === 'GET' && path === '/health') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: 'ok' })
      };
    }

    // ==================== 夸克扫描王：OCR / 扫描增强 / 格式转换 ====================
    if (httpMethod === 'POST' && path === '/quark-scan') {
      const apiKey = process.env.SCAN_WEBSERVICE_KEY;
      if (!apiKey) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ code: 'NO_API_KEY', message: '服务端未配置夸克扫描王 API Key' })
        };
      }

      const scene = body && body.scene;
      const image = body && body.imageBase64;
      if (!scene || !image) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ code: 'INVALID_INPUT', message: '缺少 scene 或 imageBase64' })
        };
      }

      // 去掉 data URL 前缀，只留纯 base64
      const base64Content = String(image).includes(';base64,')
        ? String(image).split(';base64,')[1]
        : String(image);

      // 夸克接口单文件上限 5MB（base64 长度换算回字节）
      if ((base64Content.length * 3) / 4 > 5 * 1024 * 1024) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ code: 'FILE_TOO_LARGE', message: '图片超过 5MB，请压缩后重试' })
        };
      }

      const payload = {
        aiApiKey: apiKey,
        dataType: 'image',
        scene: String(scene),
        dataBase64: base64Content
      };
      if (body.inputConfigs) payload.inputConfigs = body.inputConfigs;

      try {
        const result = await callQuarkVision(payload);
        return { statusCode: 200, headers, body: JSON.stringify(result) };
      } catch (e) {
        console.error('=== Quark scan failed ===', e);
        return {
          statusCode: 502,
          headers,
          body: JSON.stringify({ code: 'UPSTREAM_ERROR', message: e.message || '夸克接口调用失败' })
        };
      }
    }

    // 确保设置存在（健康检查之后）
    await ensureSettings();

    // 确保社区集合存在（首次访问自动创建）
    try { await db.createCollection('community_listings'); } catch (e) {}
    try { await db.createCollection('community_reports'); } catch (e) {}

    // ==================== 认证 API ====================

    // 支持 GET 和 POST 两种方式
    if ((httpMethod === 'POST' || httpMethod === 'GET') && path === '/auth/login') {
      // 优先从 body 取，其次从 query 取（event.queryStringParameters 或 event.query）
      const params = { ...(body || {}), ...(event.queryStringParameters || {}), ...(event.query || {}) };
      const { phone, username, password } = params;

      console.log('Login params:', { phone: phone ? '***' : undefined, username, password: password ? '***' : undefined });

      // 管理员密码登录
      if (username && password) {
        const adminUser = process.env.ADMIN_USERNAME || 'admin';
        const adminPass = process.env.ADMIN_PASSWORD || 'vip1337';
        if (username === adminUser && password === adminPass) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              adminToken: signAdminToken(),
              user: {
                id: 'admin',
                phone: 'admin',
                isVip: true,
                vipExpiresAt: null,
                createdAt: new Date().toISOString(),
                isAdmin: true
              }
            })
          };
        }
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ success: false, error: '用户名或密码错误' })
        };
      }

      // 普通用户手机号登录
      if (!phone) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: '请输入手机号', debug: { hasBody: !!body, bodyType: typeof body, eventKeys: Object.keys(event) } })
        };
      }

      const user = await getOrCreateUser(phone);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, user: mapUser(user) })
      };
    }

    // 根据 ID 获取用户
    if (httpMethod === 'GET' && path.startsWith('/auth/me/')) {
      const id = path.split('/auth/me/')[1];
      if (id === 'admin') {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            user: {
              id: 'admin',
              phone: 'admin',
              isVip: true,
              vipExpiresAt: null,
              createdAt: new Date().toISOString(),
              isAdmin: true
            }
          })
        };
      }

      const user = await getUserById(id);
      if (!user) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ success: false, error: '用户不存在' })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, user: mapUser(user) })
      };
    }

    // ==================== 系统设置 API ====================
    if (httpMethod === 'GET' && path === '/settings') {
      const settings = await getSettings();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          singlePrice: settings.singlePrice,
          monthlyPrice: settings.monthlyPrice,
          yearlyPrice: settings.yearlyPrice,
          permanentPrice: settings.permanentPrice,
          paymentAccount: settings.paymentAccount,
          alipayQrCode: settings.alipayQrCode,
          wechatQrCode: settings.wechatQrCode
        })
      };
    }

    if (httpMethod === 'POST' && path === '/settings') {
      const { singlePrice, monthlyPrice, yearlyPrice, permanentPrice, paymentAccount, alipayQrCode, wechatQrCode } = body || {};
      const updates = {};
      if (singlePrice !== undefined) updates.singlePrice = Number(singlePrice);
      if (monthlyPrice !== undefined) updates.monthlyPrice = Number(monthlyPrice);
      if (yearlyPrice !== undefined) updates.yearlyPrice = Number(yearlyPrice);
      if (permanentPrice !== undefined) updates.permanentPrice = Number(permanentPrice);
      if (paymentAccount !== undefined) updates.paymentAccount = paymentAccount;
      if (alipayQrCode !== undefined) updates.alipayQrCode = alipayQrCode;
      if (wechatQrCode !== undefined) updates.wechatQrCode = wechatQrCode;

      const settings = await updateSettings(updates);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, settings })
      };
    }

    // ==================== 订单 API ====================

    if ((httpMethod === 'POST' || httpMethod === 'GET') && path.startsWith('/orders/') && path.endsWith('/create')) {
      // 优先从 body 取，其次从 query 取（event.queryStringParameters 或 event.query）
      const params = { ...(body || {}), ...(event.queryStringParameters || {}), ...(event.query || {}) };
      const { type, phone, email } = params;

      console.log('Create order params:', { type, phone, email: email ? '***' : undefined });

      if (!phone || !type) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: '缺少 phone 或 type', debug: { hasBody: !!body, bodyType: typeof body, eventKeys: Object.keys(event) } })
        };
      }

      if (!['single', 'monthly', 'yearly', 'permanent'].includes(type)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: '无效的套餐类型' })
        };
      }

      const user = await getOrCreateUser(phone);
      const settings = await getSettings();

      let amount;
      switch (type) {
        case 'single':
          amount = settings.singlePrice;
          break;
        case 'monthly':
          amount = settings.monthlyPrice;
          break;
        case 'yearly':
          amount = settings.yearlyPrice;
          break;
        case 'permanent':
          amount = settings.permanentPrice;
          break;
        default:
          amount = settings.monthlyPrice;
      }

      const qrUrl = settings.wechatQrUrl || '/wechat-pay-qr.png';
      const orderId = generateOrderId();
      const now = new Date().toISOString();

      const payment = {
        orderId,
        provider: 'manual',
        type,
        amount,
        status: 'created',
        phone,
        userEmail: email || null,
        createdAt: now,
        updatedAt: now
      };

      await paymentsCollection.add(payment);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          orderId,
          order_id: orderId,
          amount,
          title: orderTitle(type),
          qrUrl,
          qr_url: qrUrl,
          instructions: `请扫码支付 ¥${amount.toFixed(2)}，付款时请在备注填写订单号：${orderId}`
        })
      };
    }

    // 上传凭证
    if (httpMethod === 'POST' && path.match(/^\/orders\/[^/]+\/upload-proof$/)) {
      const orderId = path.split('/')[2];
      const { proof_base64 } = body || {};
      const proof = String(proof_base64 || '');

      const validation = validateBase64Image(proof);
      if (!validation.ok) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: validation.error })
        };
      }

      const orderResult = await paymentsCollection.where({ orderId }).get();
      if (!orderResult.data.length) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ success: false, error: '订单不存在' })
        };
      }

      const order = orderResult.data[0];
      if (order.status !== 'created' && order.status !== 'pending_review') {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: `订单当前状态不允许审核：${order.status}` })
        };
      }

      const now = new Date().toISOString();
      await paymentsCollection.doc(order._id).update({
        status: 'pending_review',
        proofBase64: proof,
        proofUploadedAt: now,
        updatedAt: now
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, status: 'pending_review' })
      };
    }

    // 查询订单状态
    if (httpMethod === 'GET' && path.match(/^\/orders\/[^/]+\/status$/)) {
      const orderId = path.split('/')[2];
      const orderResult = await paymentsCollection.where({ orderId }).get();
      if (!orderResult.data.length) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ success: false, error: '订单不存在' })
        };
      }

      const order = orderResult.data[0];

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          orderId: order.orderId,
          order_id: order.orderId,
          status: order.status,
          rejectReason: order.rejectReason,
          reject_reason: order.rejectReason,
          paidAt: order.paidAt,
          paid_at: order.paidAt,
          type: order.type,
          amount: order.amount
        })
      };
    }

    // ==================== 支付 API ====================
    if (httpMethod === 'POST' && path === '/payments') {
      const { type, amount, timestamp, phone } = body || {};
      const now = new Date().toISOString();
      const payment = {
        orderId: generateOrderId(),
        provider: 'manual',
        type,
        amount: Number(amount),
        status: 'success',
        phone,
        createdAt: timestamp || now,
        paidAt: now,
        updatedAt: now
      };

      await paymentsCollection.add(payment);

      if (phone) {
        const user = await getOrCreateUser(phone);
        const nowTime = Date.now();
        let updates = { isVip: true, updatedAt: now };

        if (type === 'permanent') {
          updates.vipExpiresAt = null;
        } else {
          const currentExpiry = user.vipExpiresAt ? new Date(user.vipExpiresAt).getTime() : nowTime;
          let newExpiry;
          if (type === 'monthly') {
            newExpiry = Math.max(currentExpiry, nowTime) + 30 * 24 * 60 * 60 * 1000;
          } else if (type === 'yearly') {
            newExpiry = Math.max(currentExpiry, nowTime) + 365 * 24 * 60 * 60 * 1000;
          } else {
            newExpiry = Math.max(currentExpiry, nowTime) + 30 * 24 * 60 * 60 * 1000;
          }
          updates.vipExpiresAt = new Date(newExpiry).toISOString();
        }

        await usersCollection.doc(user._id).update(updates);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, payment })
      };
    }

    // ==================== 管理后台 API ====================
    if (httpMethod === 'GET' && path === '/admin/users') {
      const result = await usersCollection.orderBy('createdAt', 'desc').get();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ users: result.data.map(mapUser) })
      };
    }

    if (httpMethod === 'GET' && path === '/admin/payments') {
      const result = await paymentsCollection.orderBy('createdAt', 'desc').get();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ payments: result.data })
      };
    }

    if (httpMethod === 'GET' && path === '/admin/stats') {
      const paymentsResult = await paymentsCollection.get();
      const usersResult = await usersCollection.get();

      const payments = paymentsResult.data;
      const users = usersResult.data;

      const totalRevenue = payments.filter(p => p.status === 'success').reduce((sum, p) => sum + p.amount, 0);
      const totalOrders = payments.length;
      const monthlyOrders = payments.filter(p => p.type === 'monthly').length;
      const yearlyOrders = payments.filter(p => p.type === 'yearly').length;
      const permanentOrders = payments.filter(p => p.type === 'permanent').length;
      const singleOrders = payments.filter(p => p.type === 'single').length;

      const totalUsers = users.length;
      const now = new Date().toISOString();
      const activeVips = users.filter(u => u.isVip && (!u.vipExpiresAt || u.vipExpiresAt > now)).length;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          totalRevenue: totalRevenue.toFixed(2),
          totalOrders,
          monthlyOrders,
          yearlyOrders,
          permanentOrders,
          singleOrders,
          totalUsers,
          activeVips
        })
      };
    }

    // -------- 订单审核 API --------

    if (httpMethod === 'GET' && path === '/admin/orders/pending') {
      const result = await paymentsCollection.where({ status: 'pending_review' }).orderBy('proofUploadedAt', 'desc').get();

      const pendingOrders = result.data.map(p => ({
        orderId: p.orderId,
        phone: p.phone,
        type: p.type,
        amount: p.amount,
        timestamp: p.createdAt,
        proofUploadedAt: p.proofUploadedAt,
        proofBase64: p.proofBase64,
        userEmail: p.userEmail
      }));

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ orders: pendingOrders })
      };
    }

    if (httpMethod === 'GET' && path === '/admin/orders/pending-count') {
      const result = await paymentsCollection.where({ status: 'pending_review' }).get();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ count: result.data.length })
      };
    }

    if (httpMethod === 'POST' && path.match(/^\/admin\/orders\/[^/]+\/approve$/)) {
      const orderId = path.split('/')[3];
      const orderResult = await paymentsCollection.where({ orderId }).get();

      if (!orderResult.data.length) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ success: false, error: '订单不存在' })
        };
      }

      const order = orderResult.data[0];
      if (order.status !== 'pending_review') {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: `订单当前状态不允许审核：${order.status}` })
        };
      }

      const now = new Date().toISOString();
      await paymentsCollection.doc(order._id).update({
        status: 'success',
        paidAt: now,
        reviewedAt: now,
        reviewedBy: 'admin',
        updatedAt: now
      });

      if (order.phone) {
        const user = await getOrCreateUser(order.phone);
        const nowTime = Date.now();
        let updates = { isVip: true, updatedAt: now };

        if (order.type === 'permanent') {
          updates.vipExpiresAt = null;
        } else {
          const currentExpiry = user.vipExpiresAt ? new Date(user.vipExpiresAt).getTime() : nowTime;
          let newExpiry;
          if (order.type === 'monthly') {
            newExpiry = Math.max(currentExpiry, nowTime) + 30 * 24 * 60 * 60 * 1000;
          } else if (order.type === 'yearly') {
            newExpiry = Math.max(currentExpiry, nowTime) + 365 * 24 * 60 * 60 * 1000;
          } else {
            newExpiry = Math.max(currentExpiry, nowTime) + 30 * 24 * 60 * 60 * 1000;
          }
          updates.vipExpiresAt = new Date(newExpiry).toISOString();
        }

        await usersCollection.doc(user._id).update(updates);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true })
      };
    }

    if (httpMethod === 'POST' && path.match(/^\/admin\/orders\/[^/]+\/reject$/)) {
      const orderId = path.split('/')[3];
      const { reason } = body || {};
      const rejectReason = String(reason || '未提供原因');

      const orderResult = await paymentsCollection.where({ orderId }).get();
      if (!orderResult.data.length) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ success: false, error: '订单不存在' })
        };
      }

      const order = orderResult.data[0];
      if (order.status !== 'pending_review') {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: `订单当前状态不允许审核：${order.status}` })
        };
      }

      const now = new Date().toISOString();
      await paymentsCollection.doc(order._id).update({
        status: 'rejected',
        rejectReason,
        reviewedAt: now,
        reviewedBy: 'admin',
        updatedAt: now
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true })
      };
    }

    // -------- 手动设置用户 VIP --------
    if ((httpMethod === 'POST' || httpMethod === 'GET') && path.match(/^\/admin\/users\/[^/]+\/set-vip$/)) {
      const userId = path.split('/')[3];
      const params = { ...(body || {}), ...(event.queryStringParameters || {}), ...(event.query || {}) };
      const isVip = !!params.isVip;
      const vipDays = Number(params.vipDays || 30);

      console.log('Set VIP:', { userId, isVip, vipDays });

      const userResult = await usersCollection.doc(userId).get();
      if (!userResult.data.length) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ success: false, error: '用户不存在' })
        };
      }

      const user = userResult.data[0];
      let vipExpiresAt = null;

      if (isVip) {
        const currentExpiry = user.vipExpiresAt ? new Date(user.vipExpiresAt).getTime() : Date.now();
        vipExpiresAt = new Date(Math.max(currentExpiry, Date.now()) + vipDays * 24 * 60 * 60 * 1000).toISOString();
        await usersCollection.doc(userId).update({
          isVip: true,
          vipExpiresAt,
          updatedAt: new Date().toISOString()
        });
      } else {
        await usersCollection.doc(userId).update({
          isVip: false,
          vipExpiresAt: null,
          updatedAt: new Date().toISOString()
        });
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true })
      };
    }

    // ==================== 骑手社区 ====================

    // 手机号脱敏
    function maskPhone(phone) {
      if (!phone) return '';
      const s = String(phone);
      if (s.length <= 7) return s.replace(/./g, '*');
      return s.slice(0, 3) + '****' + s.slice(-4);
    }

    // 将 CloudBase 文档映射为前端期望的 CommunityListing
    function mapListing(doc, maskContact) {
      return {
        id: doc._id,
        category: doc.category,
        title: doc.title,
        description: doc.description || '',
        city: doc.city || '',
        area: doc.area || '',
        price: doc.price || 0,
        contact: maskContact === false ? doc.contact : maskPhone(doc.contact),
        extra: doc.extra || {},
        images: doc.images || [],
        userId: doc.userId || '',
        userPhone: doc.userPhone || '',
        status: doc.status || 'pending',
        rejectReason: doc.rejectReason,
        viewCount: doc.viewCount || 0,
        contactRevealCount: doc.contactRevealCount || 0,
        reportCount: doc.reportCount || 0,
        createdAt: doc.createdAt,
        approvedAt: doc.approvedAt,
        expiresAt: doc.expiresAt,
      };
    }

    // -------- 社区列表 --------
    if (httpMethod === 'GET' && path === '/community/listings') {
      const q = event.queryStringParameters || {};
      const now = new Date().toISOString();
      let query = communityListingsCollection.where({
        status: 'approved',
        expiresAt: _.gte(now),
      });
      if (q.category) query = query.where({ category: q.category });
      if (q.city) query = query.where({ city: q.city });
      const result = await query.orderBy('createdAt', 'desc').limit(100).get();
      let listings = result.data.map((d) => mapListing(d, true));
      if (q.minPrice !== undefined) {
        const min = Number(q.minPrice);
        listings = listings.filter((l) => l.price >= min);
      }
      if (q.maxPrice !== undefined) {
        const max = Number(q.maxPrice);
        listings = listings.filter((l) => l.price <= max);
      }
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ listings }),
      };
    }

    // -------- 社区详情 --------
    if (httpMethod === 'GET' && path.match(/^\/community\/listings\/[^/]+$/)) {
      const id = path.split('/')[3];
      const result = await communityListingsCollection.doc(id).get();
      if (!result.data.length) {
        return { statusCode: 404, headers, body: JSON.stringify({ success: false, error: '信息不存在' }) };
      }
      // 浏览量 +1
      try { await communityListingsCollection.doc(id).update({ viewCount: _.inc(1) }); } catch (e) {}
      const doc = result.data[0];
      doc.viewCount = (doc.viewCount || 0) + 1;
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ listing: mapListing(doc, true) }),
      };
    }

    // -------- 发布信息 --------
    if (httpMethod === 'POST' && path === '/community/listings') {
      const b = body || {};
      if (!b.category || !b.title || !b.contact) {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: '缺少必填字段' }) };
      }
      const now = new Date().toISOString();
      const res = await communityListingsCollection.add({
        category: b.category,
        title: String(b.title),
        description: String(b.description || ''),
        city: String(b.city || ''),
        area: String(b.area || ''),
        price: Number(b.price) || 0,
        contact: String(b.contact),
        extra: b.extra || {},
        images: Array.isArray(b.images) ? b.images : [],
        userId: b.userId || '',
        userPhone: b.userPhone || '',
        status: 'pending',
        viewCount: 0,
        contactRevealCount: 0,
        reportCount: 0,
        createdAt: now,
      });
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, id: res.id, message: '发布成功，等待人工审核' }),
      };
    }

    // -------- 查看联系方式（脱敏→真实） --------
    if (httpMethod === 'POST' && path.match(/^\/community\/listings\/[^/]+\/reveal-contact$/)) {
      const id = path.split('/')[3];
      const result = await communityListingsCollection.doc(id).get();
      if (!result.data.length) {
        return { statusCode: 404, headers, body: JSON.stringify({ success: false, error: '信息不存在' }) };
      }
      try { await communityListingsCollection.doc(id).update({ contactRevealCount: _.inc(1) }); } catch (e) {}
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ contact: result.data[0].contact }),
      };
    }

    // -------- 举报 --------
    if (httpMethod === 'POST' && path.match(/^\/community\/listings\/[^/]+\/report$/)) {
      const id = path.split('/')[3];
      const b = body || {};
      const now = new Date().toISOString();
      await communityReportsCollection.add({
        listingId: id,
        reason: b.reason || '',
        remark: b.remark || '',
        reporterId: b.reporterId || '',
        reporterPhone: b.reporterPhone || '',
        createdAt: now,
      });
      try { await communityListingsCollection.doc(id).update({ reportCount: _.inc(1) }); } catch (e) {}
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true }),
      };
    }

    // -------- 管理：待审核列表 --------
    if (httpMethod === 'GET' && path === '/admin/community/pending') {
      const result = await communityListingsCollection
        .where({ status: 'pending' })
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();
      const listings = result.data.map((d) => mapListing(d, false));
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ listings }),
      };
    }

    // -------- 管理：审核通过 --------
    if (httpMethod === 'POST' && path.match(/^\/admin\/community\/[^/]+\/approve$/)) {
      const id = path.split('/')[3];
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString();
      await communityListingsCollection.doc(id).update({
        status: 'approved',
        approvedAt: now.toISOString(),
        expiresAt,
      });
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // -------- 管理：审核驳回 --------
    if (httpMethod === 'POST' && path.match(/^\/admin\/community\/[^/]+\/reject$/)) {
      const id = path.split('/')[3];
      const b = body || {};
      await communityListingsCollection.doc(id).update({
        status: 'rejected',
        rejectReason: b.reason || '',
      });
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // ==================== AI 电话外呼 ====================
    if (path.startsWith('/ai-call/') || path === '/ai-call') {
      const aiRespond = (statusCode, payload) => ({
        statusCode,
        headers,
        body: JSON.stringify(payload),
      });
      const denied = () =>
        verifyAdminToken(event)
          ? null
          : aiRespond(401, { success: false, error: '需要管理员令牌，请重新以管理员身份登录' });

      // 配置状态
      if (httpMethod === 'GET' && path === '/ai-call/status') {
        const d = denied();
        if (d) return d;
        const cfg = aiCallEnv();
        return aiRespond(200, {
          success: true,
          data: {
            deepseekConfigured: Boolean(cfg.deepseekKey),
            deepseekModel: cfg.deepseekModel,
            aliyunConfigured: isAliyunConfigured(cfg),
            aliyunAction: cfg.aliyunAction,
            aliyunCallerNumber: cfg.aliyunCallerNumber
              ? cfg.aliyunCallerNumber.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2')
              : '',
          },
        });
      }

      // DeepSeek 生成外呼话术
      if (httpMethod === 'POST' && path === '/ai-call/script') {
        const d = denied();
        if (d) return d;
        const cfg = aiCallEnv();
        if (!cfg.deepseekKey) {
          return aiRespond(503, {
            success: false,
            error: 'DeepSeek 未配置：请在云函数环境变量中设置 DEEPSEEK_API_KEY',
          });
        }
        const { requirement, tone } = body || {};
        if (!requirement || !String(requirement).trim()) {
          return aiRespond(400, { success: false, error: '请填写外呼需求' });
        }
        try {
          const content = await deepseekChat(
            cfg,
            [
              {
                role: 'system',
                content:
                  '你是电话外呼话术专家。根据用户给出的外呼需求，生成一段可以直接由 AI 语音机器人朗读的电话话术。' +
                  '要求：1) 开场自报身份；2) 口语化、简短，整段控制在 60 秒内；3) 覆盖关键信息点；' +
                  '4) 结尾礼貌收尾；5) 只输出话术正文，不要标题、编号或解释。',
              },
              {
                role: 'user',
                content: `外呼需求：${String(requirement).trim()}${tone ? `\n语气要求：${tone}` : ''}`,
              },
            ],
            { temperature: 0.6, maxTokens: 800 }
          );
          return aiRespond(200, { success: true, data: { script: content.trim() } });
        } catch (err) {
          return aiRespond(502, { success: false, error: `话术生成失败：${err.message}` });
        }
      }

      // 创建外呼任务
      if (httpMethod === 'POST' && path === '/ai-call/tasks') {
        const d = denied();
        if (d) return d;
        const cfg = aiCallEnv();
        const b = body || {};
        const rawNumbers = Array.isArray(b.numbers) ? b.numbers : [];
        const cleaned = Array.from(
          new Set(
            rawNumbers
              .map((n) => String(n).replace(/\D/g, ''))
              .filter((n) => /^1[3-9]\d{9}$/.test(n))
          )
        );
        if (!cleaned.length) {
          return aiRespond(400, { success: false, error: '请提供至少一个有效手机号（11 位）' });
        }
        if (cleaned.length > 50) {
          return aiRespond(400, { success: false, error: '单次最多 50 个号码，请分批创建' });
        }
        const script = b.script ? String(b.script).trim() : '';
        if (!script) {
          return aiRespond(400, { success: false, error: '缺少外呼话术，可先用 AI 生成' });
        }

        await ensureAiCallCollection();

        const configured = isAliyunConfigured(cfg);
        const simulate = Boolean(b.dryRun) || !configured;
        const results = [];

        if (simulate) {
          for (const number of cleaned) {
            results.push({
              number,
              ok: null,
              message: configured ? '演练模式：未真实拨打' : '未配置阿里云外呼密钥：未真实拨打',
            });
          }
        } else {
          for (const number of cleaned) {
            try {
              const r = await placeOutboundCall(cfg, number, script);
              results.push({
                number,
                ok: r.ok,
                callId: r.data && (r.data.CallId || r.data.RequestId),
                message: r.ok
                  ? '已提交外呼'
                  : (r.data && (r.data.Message || r.data.Code)) || `HTTP ${r.status}`,
              });
            } catch (err) {
              results.push({ number, ok: false, message: err.message });
            }
          }
        }

        const now = new Date().toISOString();
        const succeeded = results.filter((r) => r.ok).length;
        const doc = {
          numbers: cleaned,
          script,
          requirement: b.requirement ? String(b.requirement).slice(0, 500) : '',
          scenario: b.scenario ? String(b.scenario).slice(0, 100) : '',
          status: simulate
            ? configured
              ? 'dry_run'
              : 'pending_config'
            : succeeded === cleaned.length
              ? 'submitted'
              : succeeded === 0
                ? 'failed'
                : 'partial_failed',
          results,
          createdAt: now,
          updatedAt: now,
        };
        const addResult = await aiCallTasksCollection.add(doc);
        return aiRespond(200, { success: true, data: { id: addResult.id, ...doc } });
      }

      // 任务列表
      if (httpMethod === 'GET' && path === '/ai-call/tasks') {
        const d = denied();
        if (d) return d;
        await ensureAiCallCollection();
        const result = await aiCallTasksCollection.orderBy('createdAt', 'desc').limit(50).get();
        return aiRespond(200, {
          success: true,
          data: result.data.map((item) => ({ id: item._id, ...item })),
        });
      }

      // 任务详情
      if (httpMethod === 'GET' && path.match(/^\/ai-call\/tasks\/[^/]+$/)) {
        const d = denied();
        if (d) return d;
        const id = path.split('/').pop();
        const result = await aiCallTasksCollection.doc(id).get();
        if (!result.data.length) {
          return aiRespond(404, { success: false, error: '任务不存在' });
        }
        return aiRespond(200, { success: true, data: { id, ...result.data[0] } });
      }

      // 服务商回调（预留）：阿里云外呼结果回调入口
      // TODO 账号开通后按阿里云文档在此处增加回调签名校验（防止伪造状态）
      if (httpMethod === 'POST' && path === '/ai-call/callback') {
        const b = body || {};
        if (!b.taskId) {
          return aiRespond(400, { success: false, error: '缺少 taskId' });
        }
        await ensureAiCallCollection();
        const now = new Date().toISOString();
        await aiCallTasksCollection.doc(String(b.taskId)).update({
          lastCallback: {
            number: b.number || '',
            status: b.status || '',
            callId: b.callId || '',
            duration: b.duration || 0,
            at: now,
          },
          updatedAt: now,
        });
        return aiRespond(200, { success: true });
      }

      return aiRespond(404, { success: false, error: 'API not found', path });
    }

    // 404
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ success: false, error: 'API not found', path })
    };

  } catch (error) {
    console.error('API Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Internal server error', message: error.message })
    };
  }
};
