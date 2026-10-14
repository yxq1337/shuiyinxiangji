import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Camera, User, Crown, Settings, LogOut, Home, Grid3X3, MessageCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link to="/" className="flex items-center space-x-2">
              <img src="/yaobox-logo-96.png" alt="YaoBox" className="w-9 h-9 shrink-0 object-contain" />
              <span className="font-bold text-xl tracking-tight text-gray-900">YaoBox</span>
            </Link>
            <div className="hidden md:flex items-center space-x-6">
              <Link
                to="/"
                className={`text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  isActive('/') ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Home className="w-4 h-4" />
                首页
              </Link>
              <Link
                to="/camera"
                className={`text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  isActive('/camera') ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Camera className="w-4 h-4" />
                水印相机
              </Link>
              <Link
                to="/tools"
                className={`text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  location.pathname.startsWith('/tool') || isActive('/tools') ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Grid3X3 className="w-4 h-4" />
                全部工具
              </Link>
              {user && (
                <Link
                  to="/my"
                  className={`text-sm font-medium transition-colors ${
                    isActive('/my') ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  个人中心
                </Link>
              )}
              {user?.isAdmin && (
                <Link
                  to="/admin"
                  className={`text-sm font-medium transition-colors ${
                    isActive('/admin') ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  管理后台
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Link
              to="/customer-service"
              className="text-gray-500 hover:text-gray-700 transition-colors"
              title="联系客服"
            >
              <MessageCircle className="w-5 h-5" />
            </Link>
            {user ? (
              <div className="flex items-center space-x-3">
                {user.isVip && (
                  <div className="flex items-center space-x-1 text-yellow-600 bg-yellow-50 px-2.5 py-1 rounded-full text-xs">
                    <Crown className="w-3.5 h-3.5" />
                    <span className="font-medium">VIP</span>
                  </div>
                )}
                <Link to="/my" className="flex items-center space-x-1.5">
                  <User className="w-5 h-5 text-gray-500" />
                  <span className="text-sm text-gray-700 hidden sm:inline">{user.phone}</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  <LogOut className="w-5 h-5" />
                </button>
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
