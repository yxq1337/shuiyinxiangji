import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, CreditCard, TrendingUp, Settings, DollarSign, UserPlus, Calendar, Edit2, Check, XCircle, Image as ImageIcon, Save, UserCog } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiGet, apiPost } from '../lib/api';

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

interface PendingOrder {
  order_id: string;
  phone: string;
  type: string;
  amount: number;
  timestamp: string;
  proof_uploaded_at: string;
  proof_base64: string;
  user_email: string | null;
}

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [reviewLoading, setReviewLoading] = useState<string | null>(null);
  const [enlargedImg, setEnlargedImg] = useState<string | null>(null);
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'review' | 'users' | 'payments' | 'settings'>('dashboard');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editVipForm, setEditVipForm] = useState({ isVip: false, vipDays: 30 });
  const [savingUser, setSavingUser] = useState(false);

  useEffect(() => {
    if (!user?.isAdmin) {
      navigate('/');
      return;
    }
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes, paymentsRes, settingsRes, pendingRes, countRes] = await Promise.all([
        apiGet('/api/admin/stats'),
        apiGet('/api/admin/users'),
        apiGet('/api/admin/payments'),
        apiGet('/api/settings'),
        apiGet('/api/admin/orders/pending'),
        apiGet('/api/admin/orders/pending-count'),
      ]);
      setStats(statsRes);
      setUsers(usersRes.users);
      setPayments(paymentsRes.payments);
      setSettings(settingsRes);
      setPendingOrders(pendingRes.orders || []);
      setPendingCount(countRes.count || 0);
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
      await apiPost('/api/settings', updatedSettings);
      setSettings(updatedSettings);
      setIsEditingSettings(false);
    } catch (e) {
      console.error('保存设置失败', e);
    }
  };

  const handleApprove = async (orderId: string) => {
    if (!confirm(`确定通过订单 ${orderId}？`)) return;
    setReviewLoading(orderId);
    try {
      const r = await apiPost(`/api/admin/orders/${orderId}/approve`);
      if (r.success) {
        await loadData();
      } else {
        alert(r.error || '操作失败');
      }
    } finally {
      setReviewLoading(null);
    }
  };

  const handleReject = async (orderId: string) => {
    const reason = prompt('请填写拒绝原因：');
    if (!reason) return;
    setReviewLoading(orderId);
    try {
      const r = await apiPost(`/api/admin/orders/${orderId}/reject`, { reason });
      if (r.success) {
        await loadData();
      } else {
        alert(r.error || '操作失败');
      }
    } finally {
      setReviewLoading(null);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditVipForm({
      isVip: user.isVip,
      vipDays: 30,
    });
  };

  const handleSaveUserVip = async () => {
    if (!editingUser) return;
    setSavingUser(true);
    try {
      const r = await apiPost(`/api/admin/users/${editingUser.id}/set-vip`, {
        isVip: editVipForm.isVip,
        vipDays: editVipForm.vipDays,
      });
      if (r.success) {
        await loadData();
        setEditingUser(null);
      } else {
        alert(r.error || '操作失败');
      }
    } finally {
      setSavingUser(false);
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
    { id: 'dashboard', label: '仪表盘', icon: TrendingUp, badge: undefined },
    { id: 'review', label: '支付审核', icon: Check, badge: pendingCount },
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
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors relative ${
                activeTab === tab.id
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="ml-1 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {tab.badge}
                </span>
              )}
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

        {activeTab === 'review' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">待审核订单 ({pendingOrders.length})</h3>
              <button
                onClick={loadData}
                className="text-sm text-blue-600 hover:underline"
              >
                刷新
              </button>
            </div>
            {pendingOrders.length === 0 ? (
              <div className="bg-white rounded-xl p-12 border border-gray-200 text-center text-gray-500">
                暂无待审核订单
              </div>
            ) : (
              pendingOrders.map((order) => (
                <div key={order.order_id} className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-1">订单号</p>
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded">{order.order_id}</code>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">金额</p>
                          <p className="font-semibold text-green-600">¥{order.amount}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">类型</p>
                          <p>{order.type === 'monthly' ? '月度会员' : '单次付费'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">手机号</p>
                          <p>{order.phone}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">上传时间</p>
                          <p className="text-sm">{new Date(order.proof_uploaded_at).toLocaleString('zh-CN')}</p>
                        </div>
                      </div>
                      {order.user_email && (
                        <div className="mb-4">
                          <p className="text-xs text-gray-500 mb-1">用户邮箱</p>
                          <p className="text-sm">{order.user_email}</p>
                        </div>
                      )}
                      <div className="flex gap-3">
                        <button
                          disabled={reviewLoading === order.order_id}
                          onClick={() => handleApprove(order.order_id)}
                          className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center"
                        >
                          <Check className="w-4 h-4 mr-1" /> 通过
                        </button>
                        <button
                          disabled={reviewLoading === order.order_id}
                          onClick={() => handleReject(order.order_id)}
                          className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center"
                        >
                          <XCircle className="w-4 h-4 mr-1" /> 拒绝
                        </button>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-2">付款截图</p>
                      {order.proof_base64 ? (
                        <img
                          src={order.proof_base64}
                          alt="付款截图"
                          className="w-full rounded-lg border cursor-pointer hover:opacity-90"
                          onClick={() => setEnlargedImg(order.proof_base64)}
                        />
                      ) : (
                        <div className="bg-gray-100 rounded-lg p-8 text-center text-gray-400">
                          <ImageIcon className="w-8 h-8 mx-auto" /> 无截图
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}

            {enlargedImg && (
              <div
                className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4"
                onClick={() => setEnlargedImg(null)}
              >
                <img src={enlargedImg} alt="放大" className="max-w-full max-h-full rounded" />
              </div>
            )}
          </div>
        )}

        {editingUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">编辑用户会员</h3>
                <button
                  onClick={() => setEditingUser(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">手机号</p>
                  <p className="font-medium text-gray-900">{editingUser.phone}</p>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={editVipForm.isVip}
                      onChange={(e) => setEditVipForm({ ...editVipForm, isVip: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-gray-700">设为 VIP 会员</span>
                  </label>

                  {editVipForm.isVip && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        会员时长（天）
                      </label>
                      <input
                        type="number"
                        value={editVipForm.vipDays}
                        onChange={(e) => setEditVipForm({ ...editVipForm, vipDays: parseInt(e.target.value) || 30 })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        min="1"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        从今天开始计算，{editVipForm.vipDays} 天后到期
                      </p>
                    </div>
                  )}

                  {editingUser.isVip && editingUser.vipExpiresAt && (
                    <div className="bg-yellow-50 rounded-lg p-4">
                      <p className="text-sm text-yellow-800">
                        当前到期时间：{new Date(editingUser.vipExpiresAt).toLocaleDateString('zh-CN')}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setEditingUser(null)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSaveUserVip}
                    disabled={savingUser}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
                  >
                    {savingUser ? (
                      <span>保存中...</span>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        保存
                      </>
                    )}
                  </button>
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
                    <button
                      onClick={() => handleEditUser(u)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <UserCog className="w-5 h-5" />
                    </button>
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
