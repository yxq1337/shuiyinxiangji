/**
 * Resend 邮件发送工具
 * 官方文档：https://resend.com/docs/api-reference/emails/send-email
 *
 * 使用免费额度：3000 封/月，用 `onboarding@resend.dev` 发件
 * 未配置 API Key 时降级为不发邮件（返回 false）
 */

export async function sendEmail(
  apiKey: string,
  to: string,
  subject: string,
  html: string,
  from: string = 'Shuiyinxiangji <onboarding@resend.dev>'
): Promise<boolean> {
  if (!apiKey || !to) return false;
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!resp.ok) {
      console.log('[email] resend error', resp.status, await resp.text());
      return false;
    }
    return true;
  } catch (e) {
    console.log('[email] fetch error', String(e));
    return false;
  }
}

interface OrderInfo {
  order_id: string;
  amount: number;
  type: string;
  phone: string;
  user_email?: string | null;
}

async function readEmailConfig(env: any): Promise<{ apiKey: string; adminEmail: string }> {
  const envKey = env.RESEND_API_KEY;
  const envAdmin = env.ADMIN_EMAIL;
  if (envKey || envAdmin) {
    return { apiKey: envKey || '', adminEmail: envAdmin || '' };
  }
  const row = await env.DB.prepare('SELECT resend_api_key, admin_email FROM settings WHERE id = 1').first();
  return {
    apiKey: String(row?.resend_api_key || ''),
    adminEmail: String(row?.admin_email || ''),
  };
}

export async function notifyAdminNewOrder(env: any, order: OrderInfo): Promise<void> {
  const { apiKey, adminEmail } = await readEmailConfig(env);
  if (!apiKey || !adminEmail) return;
  const html = `
    <p>你有一笔新的待审核订单：</p>
    <ul>
      <li>订单号：<strong>${order.order_id}</strong></li>
      <li>金额：¥${order.amount}</li>
      <li>类型：${order.type === 'monthly' ? '月度会员' : '单次付费'}</li>
      <li>用户手机：${order.phone}</li>
    </ul>
    <p>请登录管理后台审核：<a href="https://shuiyinxiangji.pages.dev/admin">进入后台</a></p>
  `;
  await sendEmail(apiKey, adminEmail, `[水印相机] 新订单待审核：${order.order_id}`, html);
}

export async function notifyUserOrderApproved(env: any, order: OrderInfo): Promise<void> {
  if (!order.user_email) return;
  const { apiKey } = await readEmailConfig(env);
  if (!apiKey) return;
  const html = `
    <p>您的订单已审核通过，VIP 会员已激活！</p>
    <ul>
      <li>订单号：${order.order_id}</li>
      <li>金额：¥${order.amount}</li>
    </ul>
    <p>登录查看：<a href="https://shuiyinxiangji.pages.dev/my">个人中心</a></p>
  `;
  await sendEmail(apiKey, order.user_email, '[水印相机] 会员已激活', html);
}

export async function notifyUserOrderRejected(env: any, order: OrderInfo, reason: string): Promise<void> {
  if (!order.user_email) return;
  const { apiKey } = await readEmailConfig(env);
  if (!apiKey) return;
  const html = `
    <p>很抱歉，您的订单审核未通过：</p>
    <ul>
      <li>订单号：${order.order_id}</li>
      <li>金额：¥${order.amount}</li>
      <li>原因：${reason}</li>
    </ul>
    <p>如有疑问，请重新支付或联系客服。</p>
  `;
  await sendEmail(apiKey, order.user_email, '[水印相机] 订单审核未通过', html);
}
