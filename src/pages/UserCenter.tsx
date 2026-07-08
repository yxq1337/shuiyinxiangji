import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Crown, History, Settings, ArrowRight, Calendar, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function UserCenter() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-600 mb-4">请先登录</p>
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

  const menuItems = [
    {
      icon: Crown,
      title: '会员中心',
      description: user.isVip ? '查看会员权益' : '升级VIP会员',
      to: '/pricing',
      highlight: !user.isVip,
    },
    {
      icon: History,
      title: '使用记录',
      description: '查看历史操作记录',
      to: '#',
    },
    {
      icon: Settings,
      title: '账号设置',
      description: '修改个人资料和偏好',
      to: '#',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl p-6 mb-6 shadow-sm border border-gray-200">
          <div className="flex items-center space-x-4">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <User className="w-10 h-10 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">{user.phone}</h1>
              <p className="text-gray-500 mt-1">
                注册时间：{new Date(user.createdAt).toLocaleDateString('zh-CN')}
              </p>
            </div>
            {user.isVip ? (
              <div className="flex items-center space-x-2 bg-yellow-50 text-yellow-700 px-4 py-2 rounded-lg">
                <Crown className="w-5 h-5" />
                <span className="font-medium">VIP会员</span>
              </div>
            ) : (
              <button
                onClick={() => navigate('/pricing')}
                className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-6 py-2 rounded-lg hover:from-yellow-600 hover:to-orange-600 font-medium"
              >
                开通VIP
              </button>
            )}
          </div>

          {user.isVip && user.vipExpiresAt && (
            <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200 flex items-center space-x-3">
              <Calendar className="w-5 h-5 text-yellow-600" />
              <span className="text-yellow-800">
                会员有效期至：{new Date(user.vipExpiresAt).toLocaleDateString('zh-CN')}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {menuItems.map((item, idx) => (
            <Link
              key={idx}
              to={item.to}
              className={`block bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:border-gray-300 transition-colors ${
                item.highlight ? 'ring-2 ring-yellow-400' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`p-3 rounded-lg ${item.highlight ? 'bg-yellow-100' : 'bg-gray-100'}`}>
                    <item.icon className={`w-6 h-6 ${item.highlight ? 'text-yellow-600' : 'text-gray-600'}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{item.title}</h3>
                    <p className="text-sm text-gray-500">{item.description}</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400" />
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-8 bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">使用小贴士</h2>
          <ul className="space-y-3">
            <li className="flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <span className="text-gray-600">VIP会员可无限次使用高清无水印导出</span>
            </li>
            <li className="flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <span className="text-gray-600">支持批量处理多张图片，大幅提升效率</span>
            </li>
            <li className="flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <span className="text-gray-600">所有生成的图片都会保留原始分辨率</span>
            </li>
          </ul>
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={logout}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            退出登录
          </button>
        </div>
      </div>
    </div>
  );
}
