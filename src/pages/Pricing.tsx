import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Crown, CreditCard, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiGet, apiPost } from '../lib/api';

interface PricingPlan {
  type: 'monthly' | 'yearly' | 'permanent';
  name: string;
  price: number;
  originalPrice?: number;
  description: string;
  features: string[];
  popular?: boolean;
}

export default function Pricing() {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly' | 'permanent'>('monthly');
  const [settings, setSettings] = useState<{ singlePrice: number; monthlyPrice: number }>({
    singlePrice: 1.99,
    monthlyPrice: 9.99,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await apiGet('/api/settings');
        if (data && typeof data.monthlyPrice === 'number') {
          setSettings(data);
        }
      } catch (error) {
        console.error('加载配置失败:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  const plans: PricingPlan[] = [
    {
      type: 'monthly',
      name: '月度会员',
      price: settings.monthlyPrice,
      originalPrice: 29.99,
      description: '30天内无限次使用所有功能',
      features: ['无限次导出', '所有高级模板', '批量处理', '专属客服'],
      popular: true,
    },
    {
      type: 'yearly',
      name: '年度会员',
      price: settings.monthlyPrice * 10,
      originalPrice: settings.monthlyPrice * 12,
      description: '365天内无限次使用所有功能',
      features: ['无限次导出', '所有高级模板', '批量处理', '专属客服', '优先支持'],
    },
    {
      type: 'permanent',
      name: '永久会员',
      price: settings.monthlyPrice * 30,
      originalPrice: settings.monthlyPrice * 50,
      description: '永久无限次使用所有功能',
      features: ['无限次导出', '所有高级模板', '批量处理', '专属客服', '优先支持', '永久更新'],
    },
  ];

  const handlePayment = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    setIsProcessing(true);
    try {
      const data = await apiPost('/api/orders/create', {
        type: selectedPlan,
        phone: user.phone,
      });
      if (!data.success || !data.order_id) {
        alert(data.error || '创建订单失败');
        setIsProcessing(false);
        return;
      }
      navigate(`/payment/pending?order_id=${data.order_id}`);
    } catch (e) {
      console.error('创建订单失败', e);
      alert('网络错误，请稍后重试');
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-600 mb-4">请先登录后再购买</p>
          <button
            onClick={() => navigate('/login')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            去登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">选择你的套餐</h1>
          <p className="text-gray-500">解锁更多高级功能，提升创作效率</p>
        </div>

        {user.isVip ? (
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-2xl p-8 text-center">
            <Crown className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-yellow-800 mb-2">你已是VIP会员</h2>
            <p className="text-yellow-700">
              会员有效期至：{user.vipExpiresAt ? new Date(user.vipExpiresAt).toLocaleDateString('zh-CN') : '永久'}
            </p>
            <button
              onClick={() => navigate('/')}
              className="mt-6 bg-yellow-500 text-white px-6 py-3 rounded-lg hover:bg-yellow-600"
            >
              开始使用
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan) => (
              <div
                key={plan.type}
                onClick={() => setSelectedPlan(plan.type)}
                className={`relative bg-white rounded-2xl p-8 border-2 cursor-pointer transition-all ${
                  selectedPlan === plan.type
                    ? 'border-blue-500 shadow-lg'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                    最受欢迎
                  </div>
                )}
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <p className="text-gray-500 text-sm mb-4">{plan.description}</p>
                  <div className="flex items-baseline justify-center space-x-2">
                    <span className="text-3xl font-bold text-gray-900">¥{plan.price}</span>
                    {plan.originalPrice && (
                      <span className="text-gray-400 line-through">¥{plan.originalPrice}</span>
                    )}
                  </div>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center text-gray-600">
                      <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                {selectedPlan === plan.type && (
                  <div className="absolute -right-2 -top-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!user.isVip && (
          <div className="mt-8 text-center">
            <button
              onClick={handlePayment}
              disabled={isProcessing}
              className="bg-blue-600 text-white px-8 py-4 rounded-xl text-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors inline-flex items-center space-x-2"
            >
              <CreditCard className="w-5 h-5" />
              <span>{isProcessing ? '支付中...' : '立即购买'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
