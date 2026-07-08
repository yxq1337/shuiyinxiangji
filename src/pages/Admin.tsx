import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, CreditCard, TrendingUp, Settings, DollarSign, UserPlus, Calendar, Edit2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Stats {
  totalRevenue: string;
  totalOrders: number;
  monthlyOrders: number;
  singleOrders: number;
  totalUsers: number;
  activeVips: number;
}

interface User {
  id: string;
  phone: string;
  isVip: boolean;
  vipExpiresAt: string | null;
  createdAt: string;
}

interface Payment {
  id: string;
  type: string;
  amount: number;
  timestamp: string;
  status: string;
  phone: string;
}

interface AppSettings {
  singlePrice: number;
  monthlyPrice: number;
  paymentAccount: string;
  alipayQrCode: string;
  wechatQrCode: string;
}

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'payments' | 'settings'>('dashboard');

  useEffect(() => {
    if (user?.phone !== 'admin') {
      navigate('/');
      return;
    }
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes, paymentsRes, settingsRes] = await Promise.all([
        fetch('/api/admin/stats').then((r) => r.json()),
        fetch('/api/admin/users').then((r) => r.json()),
        fetch('/api/admin/payments').then((r) => r.json()),
        fetch('/api/settings').then((r) => r.json()),
      ]);
      setStats(statsRes);
      setUsers(usersRes.users);
      setPayments(paymentsRes.payments);
      setSettings(settingsRes);
    } catch (e) {
      console.error('加载数据失败', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const updatedSettings = {
      singlePrice: parseFloat(formData.get('singlePrice') as string),
      monthlyPrice: parseFloat(formData.get('monthlyPrice') as string),
      paymentAccount: formData.get('paymentAccount') as string,
      alipayQrCode: formData.get('alipayQrCode') as string,
      wechatQrCode: formData.get('wechatQrCode') as string,
    };
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings),
      });
      setSettings(updatedSettings);
      setIsEditingSettings(false);
    } catch (e) {
      console.error('保存设置失败', e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  const tabs = [
    { id: 'dashboard', label: '仪表盘', icon: TrendingUp },
    { id: 'users', label: '用户管理', icon: Users },
    { id: 'payments', label: '支付记录', icon: CreditCard },
    { id: 'settings', label: '系统设置', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">管理后台</h1>
            <p className="text-gray-500">管理用户、订单和系统配置</p>
          </div>
        </div>

        <div className="flex space-x-1 bg-white rounded-xl p-1 border border-gray-200 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {activeTab === 'dashboard' && stats && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-xl p-6 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">总营收</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">¥{stats.totalRevenue}</p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-lg">
                    <DollarSign className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">总订单数</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalOrders}</p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <CreditCard className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">用户数</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalUsers}</p>
                  </div>
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <Users className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">VIP会员</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{stats.activeVips}</p>
                  </div>
                  <div className="p-3 bg-yellow-100 rounded-lg">
                    <UserPlus className="w-6 h-6 text-yellow-600" />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl p-6 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">最近用户</h3>
                <div className="space-y-3">
                  {users.slice(0, 5).map((u) => (
                    <div key={u.id} className="flex items-center justify-between py-2">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gray-200 rounded-full" />
                        <div>
                          <p className="font-medium text-gray-900">{u.phone}</p>
                          <p className="text-sm text-gray-500">
                            {new Date(u.createdAt).toLocaleDateString('zh-CN')}
                          </p>
                        </div>
                      </div>
                      {u.isVip && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                          VIP
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">最近订单</h3>
                <div className="space-y-3">
                  {payments.slice(0, 5).map((p) => (
                    <div key={p.id} className="flex items-center justify-between py-2">
                      <div>
                        <p className="font-medium text-gray-900">
                          {p.type === 'monthly' ? '月度会员' : '单次付费'}
                        </p>
                        <p className="text-sm text-gray-500">{p.phone}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">¥{p.amount}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(p.timestamp).toLocaleDateString('zh-CN')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">用户列表</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {users.map((u) => (
                <div key={u.id} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gray-200 rounded-full" />
                    <div>
                      <p className="font-medium text-gray-900">{u.phone}</p>
                      <p className="text-sm text-gray-500">
                        注册于 {new Date(u.createdAt).toLocaleDateString('zh-CN')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    {u.isVip ? (
                      <div className="text-right">
                        <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-sm rounded-full">
                          VIP会员
                        </span>
                        {u.vipExpiresAt && (
                          <p className="text-xs text-gray-500 mt-1">
                            至 {new Date(u.vipExpiresAt).toLocaleDateString('zh-CN')}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">普通用户</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">支付记录</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {payments.map((p) => (
                <div key={p.id} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      {p.type === 'monthly' ? '月度会员' : '单次付费'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {p.phone} · {new Date(p.timestamp).toLocaleString('zh-CN')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-600">¥{p.amount}</p>
                    <span className="text-xs text-green-500 bg-green-50 px-2 py-1 rounded">
                      支付成功
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'settings' && settings && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">系统设置</h3>
              <button
                onClick={() => setIsEditingSettings(!isEditingSettings)}
                className="flex items-center space-x-2 text-blue-600 hover:text-blue-700"
              >
                <Edit2 className="w-4 h-4" />
                <span>{isEditingSettings ? '取消' : '编辑'}</span>
              </button>
            </div>

            {isEditingSettings ? (
              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">单次价格 (¥)</label>
                  <input
                    type="number"
                    name="singlePrice"
                    step="0.01"
                    defaultValue={settings.singlePrice}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">月度会员价格 (¥)</label>
                  <input
                    type="number"
                    name="monthlyPrice"
                    step="0.01"
                    defaultValue={settings.monthlyPrice}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">收款账户</label>
                  <input
                    type="text"
                    name="paymentAccount"
                    defaultValue={settings.paymentAccount}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                >
                  保存设置
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between py-3 border-b border-gray-100">
                  <span className="text-gray-600">单次价格</span>
                  <span className="font-semibold text-gray-900">¥{settings.singlePrice}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-gray-100">
                  <span className="text-gray-600">月度会员价格</span>
                  <span className="font-semibold text-gray-900">¥{settings.monthlyPrice}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-gray-100">
                  <span className="text-gray-600">收款账户</span>
                  <span className="font-semibold text-gray-900">{settings.paymentAccount}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
