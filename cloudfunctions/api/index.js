'use strict';

const cloud = require('@cloudbase/node-sdk');

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

// 主函数
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
  if (path.startsWith('/api')) {
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

    // 确保设置存在（健康检查之后）
    await ensureSettings();

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

    if (httpMethod === 'POST' && path.startsWith('/orders/') && path.endsWith('/create')) {
      const { type, phone, email } = body || {};
      if (!phone || !type) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: '缺少 phone 或 type' })
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
          amount,
          title: orderTitle(type),
          qrUrl,
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
          status: order.status,
          rejectReason: order.rejectReason,
          paidAt: order.paidAt,
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
