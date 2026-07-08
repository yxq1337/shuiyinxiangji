import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Camera, User, Crown, Settings, LogOut } from 'lucide-react';
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
              <Camera className="w-8 h-8 text-blue-600" />
              <span className="font-bold text-xl text-gray-900">水印相机 Pro</span>
            </Link>
            <div className="hidden md:flex items-center space-x-6">
              <Link
                to="/"
                className={`text-sm font-medium transition-colors ${
                  isActive('/') ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                水印工具
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
              {user?.phone === 'admin' && (
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
          <div className="flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-4">
                {user.isVip && (
                  <div className="flex items-center space-x-1 text-yellow-600 bg-yellow-50 px-3 py-1 rounded-full text-sm">
                    <Crown className="w-4 h-4" />
                    <span className="font-medium">VIP会员</span>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <User className="w-5 h-5 text-gray-500" />
                  <span className="text-sm text-gray-700">{user.phone}</span>
                </div>
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
