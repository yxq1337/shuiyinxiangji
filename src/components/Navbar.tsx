import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Camera, User, Crown, Home, Grid3X3, MessageCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const { user } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bg-transparent sticky top-0 z-50 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link to="/" className="flex items-center space-x-2">
              <img src="/yaobox-icon.svg" alt="YaoBox" className="w-9 h-9 shrink-0" />
              <span className="font-bold text-xl tracking-tight text-gray-900">YaoBox</span>
            </Link>
            <div className="hidden md:flex items-center space-x-1">
              <Link
                to="/"
                className={`text-sm font-medium transition-all flex items-center gap-1.5 px-3 py-1.5 rounded-full ${
                  isActive('/') ? 'bg-white/60 text-gray-900' : 'text-gray-600 hover:text-gray-900 hover:bg-white/40'
                }`}
              >
                <Home className="w-4 h-4" />
                首页
              </Link>
              <Link
                to="/camera"
                className={`text-sm font-medium transition-all flex items-center gap-1.5 px-3 py-1.5 rounded-full ${
                  isActive('/camera') ? 'bg-white/60 text-gray-900' : 'text-gray-600 hover:text-gray-900 hover:bg-white/40'
                }`}
              >
                <Camera className="w-4 h-4" />
                水印相机
              </Link>
              <Link
                to="/tools"
                className={`text-sm font-medium transition-all flex items-center gap-1.5 px-3 py-1.5 rounded-full ${
                  location.pathname.startsWith('/tool') || isActive('/tools') ? 'bg-white/60 text-gray-900' : 'text-gray-600 hover:text-gray-900 hover:bg-white/40'
                }`}
              >
                <Grid3X3 className="w-4 h-4" />
                全部工具
              </Link>
              {user && (
                <Link
                  to="/my"
                  className={`text-sm font-medium transition-all px-3 py-1.5 rounded-full ${
                    isActive('/my') ? 'bg-white/60 text-gray-900' : 'text-gray-600 hover:text-gray-900 hover:bg-white/40'
                  }`}
                >
                  个人中心
                </Link>
              )}
              {user?.isAdmin && (
                <Link
                  to="/admin"
                  className={`text-sm font-medium transition-all px-3 py-1.5 rounded-full ${
                    isActive('/admin') ? 'bg-white/60 text-gray-900' : 'text-gray-600 hover:text-gray-900 hover:bg-white/40'
                  }`}
                >
                  管理后台
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Link
              to="/customer-service"
              className="flex items-center gap-1 text-gray-500 hover:text-gray-700 transition-colors px-2 py-1.5 rounded-full hover:bg-white/40"
            >
              <MessageCircle className="w-5 h-5" />
              <span className="text-xs font-medium hidden sm:inline">客服</span>
            </Link>
            {user ? (
              <div className="flex items-center space-x-2">
                {user.isVip && (
                  <div className="flex items-center space-x-1 text-yellow-600 bg-yellow-50/80 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs">
                    <Crown className="w-3.5 h-3.5" />
                    <span className="font-medium">VIP</span>
                  </div>
                )}
                <Link to="/my" className="flex items-center gap-1 text-gray-600 hover:text-gray-900 transition-colors px-2 py-1.5 rounded-full hover:bg-white/40" title="个人中心（退出登录在个人中心内）">
                  <User className="w-5 h-5" />
                  <span className="text-xs font-medium sm:hidden">我的</span>
                  <span className="text-sm text-gray-700 hidden sm:inline">{user.phone}</span>
                </Link>
              </div>
            ) : (
              <Link
                to="/login"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                登录
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
