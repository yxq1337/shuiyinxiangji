import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Phone, ArrowRight, Lock, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type LoginMode = 'user' | 'admin';

export default function Login() {
  const [mode, setMode] = useState<LoginMode>('user');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, loginAdmin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      if (mode === 'admin') {
        if (!username.trim() || !password.trim()) {
          setError('请输入用户名和密码');
          setIsLoading(false);
          return;
        }
        await loginAdmin(username.trim(), password.trim());
        navigate('/admin');
      } else {
        if (!phone.trim()) {
          setError('请输入手机号');
          setIsLoading(false);
          return;
        }
        await login(phone.trim());
        navigate('/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            {mode === 'user' ? (
              <Phone className="w-8 h-8 text-blue-600" />
            ) : (
              <Lock className="w-8 h-8 text-blue-600" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {mode === 'user' ? '登录账号' : '管理员登录'}
          </h1>
          <p className="text-gray-500">
            {mode === 'user' ? '输入手机号即可登录，无需注册' : '请输入管理员用户名和密码'}
          </p>
        </div>

        {/* 模式切换 */}
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 mb-6">
          <button
            type="button"
            onClick={() => { setMode('user'); setError(''); }}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'user' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
            }`}
          >
            用户登录
          </button>
          <button
            type="button"
            onClick={() => { setMode('admin'); setError(''); }}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'admin' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
            }`}
          >
            管理员登录
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {mode === 'user' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">手机号</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="请输入手机号"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  autoComplete="tel"
                />
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">用户名</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="请输入用户名"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    autoComplete="username"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">密码</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="请输入密码"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    autoComplete="current-password"
                  />
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
          >
            <span>{isLoading ? '登录中...' : '登录'}</span>
            {!isLoading && <ArrowRight className="w-5 h-5" />}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">
            返回首页
          </Link>
        </div>

        {mode === 'user' && (
          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 text-center">
              提示：输入任意手机号即可体验
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
