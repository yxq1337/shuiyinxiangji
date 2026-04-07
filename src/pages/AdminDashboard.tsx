import React, { useEffect, useState } from 'react';
import { BarChart3, Users, CreditCard, ArrowUpRight, Clock, ShieldCheck, Settings, Save, Upload, UserCheck } from 'lucide-react';

interface Payment {
  id: string;
  type: 'single' | 'monthly';
  amount: number;
  timestamp: string;
  status: string;
}

interface Stats {
  totalRevenue: string;
  totalOrders: number;
  monthlyOrders: number;
  singleOrders: number;
}

interface User {
  id: string;
  phone: string;
  isVip: boolean;
  vipExpiresAt: string | null;
  createdAt: string;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'settings'>('overview');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [settings, setSettings] = useState({ singlePrice: 1.99, monthlyPrice: 9.90, paymentAccount: '', alipayQrCode: '', wechatQrCode: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const timestamp = Date.now();
        const [statsRes, paymentsRes, settingsRes, usersRes] = await Promise.all([
          fetch(`/api/admin/stats?t=${timestamp}`),
          fetch(`/api/admin/payments?t=${timestamp}`),
          fetch(`/api/settings?t=${timestamp}`),
          fetch(`/api/admin/users?t=${timestamp}`)
        ]);
        
        const statsData = await statsRes.json();
        const paymentsData = await paymentsRes.json();
        const settingsData = await settingsRes.json();
        const usersData = await usersRes.json();
        
        setStats(statsData);
        setPayments(paymentsData.payments);
        setUsers(usersData.users);
        
        // Only update settings if we aren't currently typing/saving
        setSettings(prev => ({
          ...prev,
          singlePrice: settingsData.singlePrice,
          monthlyPrice: settingsData.monthlyPrice,
          paymentAccount: settingsData.paymentAccount || prev.paymentAccount,
          alipayQrCode: settingsData.alipayQrCode || prev.alipayQrCode,
          wechatQrCode: settingsData.wechatQrCode || prev.wechatQrCode
        }));
      } catch (error) {
        console.error("Failed to fetch admin data", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    
    // Refresh every 10 seconds
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      setSaveMessage('保存成功');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error("Failed to save settings", error);
      setSaveMessage('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleQrUpload = (type: 'alipay' | 'wechat', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setSettings(prev => ({
          ...prev,
          [type === 'alipay' ? 'alipayQrCode' : 'wechatQrCode']: event.target?.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <ShieldCheck className="w-8 h-8 text-blue-600" />
              管理后台
            </h1>
            <p className="text-gray-500 mt-2">水印相机订单与营收数据概览</p>
          </div>
          <a href="/" className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            返回应用
          </a>
        </header>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'overview' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            数据概览
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'users' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            账号管理
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'settings' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            系统设置
          </button>
        </div>

        {activeTab === 'overview' && (
          <React.Fragment>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                    <BarChart3 className="w-6 h-6" />
                  </div>
                  <span className="flex items-center text-sm font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                    <ArrowUpRight className="w-4 h-4 mr-1" />
                    实时
                  </span>
                </div>
                <h3 className="text-gray-500 text-sm font-medium">总营收 (元)</h3>
                <p className="text-3xl font-bold text-gray-900 mt-1">¥{stats?.totalRevenue}</p>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
                    <Users className="w-6 h-6" />
                  </div>
                </div>
                <h3 className="text-gray-500 text-sm font-medium">总注册用户</h3>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats?.totalUsers || 0}</p>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-yellow-50 text-yellow-600 rounded-xl flex items-center justify-center">
                    <UserCheck className="w-6 h-6" />
                  </div>
                </div>
                <h3 className="text-gray-500 text-sm font-medium">当前有效 VIP</h3>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats?.activeVips || 0}</p>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
                    <CreditCard className="w-6 h-6" />
                  </div>
                </div>
                <h3 className="text-gray-500 text-sm font-medium">总订单数</h3>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats?.totalOrders}</p>
              </div>
            </div>

            {/* Recent Orders Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">最近订单记录</h2>
                <span className="text-sm text-gray-500">自动刷新</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-sm">
                      <th className="px-6 py-4 font-medium">订单号</th>
                      <th className="px-6 py-4 font-medium">用户手机号</th>
                      <th className="px-6 py-4 font-medium">类型</th>
                      <th className="px-6 py-4 font-medium">金额</th>
                      <th className="px-6 py-4 font-medium">状态</th>
                      <th className="px-6 py-4 font-medium">时间</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {payments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                          暂无订单数据
                        </td>
                      </tr>
                    ) : (
                      payments.map((payment) => (
                        <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 text-sm font-mono text-gray-600">
                            {payment.id.toUpperCase()}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {payment.phone || '-'}
                          </td>
                          <td className="px-6 py-4">
                            {payment.type === 'monthly' ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                包月 VIP
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                单次使用
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">
                            ¥{payment.amount.toFixed(2)}
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              支付成功
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {new Date(payment.timestamp).toLocaleString('zh-CN')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </React.Fragment>
        )}

        {/* Settings Section */}
        {activeTab === 'settings' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Settings className="w-5 h-5 text-gray-500" />
              系统设置
            </h2>
            {saveMessage && (
              <span className={`text-sm ${saveMessage === '保存成功' ? 'text-green-600' : 'text-red-600'}`}>
                {saveMessage}
              </span>
            )}
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">单次使用价格 (元)</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={settings.singlePrice}
                  onChange={(e) => setSettings({...settings, singlePrice: parseFloat(e.target.value) || 0})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">包月 VIP 价格 (元)</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={settings.monthlyPrice}
                  onChange={(e) => setSettings({...settings, monthlyPrice: parseFloat(e.target.value) || 0})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">收款账户 (支付宝/微信)</label>
                <input 
                  type="text" 
                  value={settings.paymentAccount}
                  onChange={(e) => setSettings({...settings, paymentAccount: e.target.value})}
                  placeholder="例如: admin@example.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">微信收款码</label>
                <div className="flex items-center gap-4">
                  <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden relative bg-gray-50 flex items-center justify-center">
                    {settings.wechatQrCode ? (
                      <img src={settings.wechatQrCode} alt="WeChat QR" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-gray-400 flex flex-col items-center">
                        <Upload className="w-6 h-6 mb-1" />
                        <span className="text-xs">上传图片</span>
                      </div>
                    )}
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => handleQrUpload('wechat', e)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                  <div className="text-sm text-gray-500">
                    <p>建议上传正方形的收款码图片</p>
                    <p className="mt-1">支持 JPG, PNG 格式</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">支付宝收款码</label>
                <div className="flex items-center gap-4">
                  <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden relative bg-gray-50 flex items-center justify-center">
                    {settings.alipayQrCode ? (
                      <img src={settings.alipayQrCode} alt="Alipay QR" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-gray-400 flex flex-col items-center">
                        <Upload className="w-6 h-6 mb-1" />
                        <span className="text-xs">上传图片</span>
                      </div>
                    )}
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => handleQrUpload('alipay', e)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                  <div className="text-sm text-gray-500">
                    <p>建议上传正方形的收款码图片</p>
                    <p className="mt-1">支持 JPG, PNG 格式</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button 
                onClick={handleSaveSettings}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? '保存中...' : '保存设置'}
              </button>
            </div>
          </div>
        </div>
        )}

        {activeTab === 'users' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-500" />
              账号列表
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-sm border-b border-gray-100">
                  <th className="px-6 py-4 font-medium">用户 ID</th>
                  <th className="px-6 py-4 font-medium">手机号码</th>
                  <th className="px-6 py-4 font-medium">VIP 状态</th>
                  <th className="px-6 py-4 font-medium">VIP 到期时间</th>
                  <th className="px-6 py-4 font-medium">注册时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user) => {
                  const isVipValid = user.isVip && (!user.vipExpiresAt || new Date(user.vipExpiresAt).getTime() > Date.now());
                  return (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-500 font-mono">{user.id}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium">{user.phone}</td>
                      <td className="px-6 py-4">
                        {isVipValid ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            VIP 会员
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            普通用户
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {user.vipExpiresAt ? new Date(user.vipExpiresAt).toLocaleString() : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(user.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      暂无用户数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
