import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Clock, XCircle, MessageCircle } from 'lucide-react';
import { apiGet } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

type Status = 'created' | 'success' | 'rejected';

interface OrderInfo {
  order_id: string;
  amount: number;
  title: string;
  qr_url: string;
  instructions: string;
}

export default function PaymentPending() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();

  const orderId = searchParams.get('order_id') || '';
  const [status, setStatus] = useState<Status>('created');
  const [rejectReason, setRejectReason] = useState<string>('');
  const [orderInfo, setOrderInfo] = useState<OrderInfo | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!orderId) {
      return;
    }
    const cached = localStorage.getItem(`order_info_${orderId}`);
    if (cached) {
      try {
        setOrderInfo(JSON.parse(cached));
      } catch {
      }
    }
    fetchStatus();
  }, [orderId]);

  useEffect(() => {
    if (status !== 'created') return;
    timerRef.current = window.setInterval(() => {
      fetchStatus();
    }, 15000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  useEffect(() => {
    if (status === 'success') {
      refreshUser();
      const t = window.setTimeout(() => navigate('/my'), 3000);
      return () => clearTimeout(t);
    }
  }, [status, refreshUser, navigate]);

  async function fetchStatus() {
    try {
      const data = await apiGet(`/api/orders/${encodeURIComponent(orderId)}/status`);
      if (data.success) {
        setStatus(data.status as Status);
        if (data.reject_reason) setRejectReason(data.reject_reason);
        if (!orderInfo && data.amount) {
          let title;
          switch (data.type) {
            case 'monthly':
              title = '水印相机 - 月度会员';
              break;
            case 'yearly':
              title = '水印相机 - 年度会员';
              break;
            case 'permanent':
              title = '水印相机 - 永久会员';
              break;
            default:
              title = '水印相机 - 单次付费';
          }
          setOrderInfo({
            order_id: data.order_id,
            amount: data.amount,
            title,
            qr_url: '/wechat-pay-qr.png',
            instructions: `请扫码支付 ¥${data.amount.toFixed(2)}`,
          });
        }
      }
    } catch (e) {
      console.error('查询订单状态失败', e);
    }
  }

  if (!orderId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-gray-200 text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">订单信息缺失</p>
          <button
            onClick={() => navigate('/pricing')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            返回选择套餐
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-md mx-auto bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
        {status === 'created' && (
          <>
            <h1 className="text-xl font-bold text-gray-900 text-center mb-2">扫码支付</h1>
            <p className="text-center text-gray-500 mb-6">用微信扫下方二维码完成支付</p>
            <div className="bg-gray-50 rounded-lg p-6 text-center mb-6">
              <img
                src={orderInfo?.qr_url || '/wechat-pay-qr.png'}
                alt="收款码"
                className="w-full max-w-xs mx-auto rounded-lg"
              />
              <p className="mt-4 text-2xl font-bold text-red-600">
                ¥{orderInfo?.amount?.toFixed(2) || '...'}
              </p>
              <p className="text-sm text-gray-600 mt-1">{orderInfo?.title || '会员'}</p>
            </div>

            <div className="bg-blue-50 rounded-lg p-6 text-center mb-6">
              <Clock className="w-12 h-12 text-blue-600 mx-auto mb-3 animate-pulse" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">等待到账</h3>
              <p className="text-sm text-gray-600 mb-2">支付后会自动激活 VIP</p>
              <p className="text-sm text-gray-500">通常几分钟内完成</p>
            </div>

            <div className="border-t pt-6">
              <div className="bg-blue-50 rounded-lg p-6 text-center">
                <MessageCircle className="w-12 h-12 text-blue-600 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-gray-900 mb-2">遇到问题？</h3>
                <p className="text-sm text-gray-600 mb-4">添加微信客服咨询</p>
                <img
                  src="/wechat-customer-service.png"
                  alt="微信客服二维码"
                  className="w-full max-w-xs mx-auto rounded-lg border border-gray-200"
                />
              </div>
            </div>
          </>
        )}

        {status === 'success' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">支付成功！</h1>
            <p className="text-gray-500">VIP 已激活，即将跳转...</p>
          </div>
        )}

        {status === 'rejected' && (
          <div className="text-center py-8">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">审核未通过</h1>
            <p className="text-gray-600 mb-4">{rejectReason || '请重新支付或联系客服'}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => navigate('/pricing')}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                重新购买
              </button>
              <button
                onClick={() => navigate('/my')}
                className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50"
              >
                个人中心
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
