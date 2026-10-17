import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Camera, User, Crown, Home, Grid3X3, MessageCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const { user } = useAuth();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const itemCls = (active: boolean) =>
    `text-sm font-medium transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-full ${
      active ? 'text-ink bg-brand-soft' : 'text-ink-2 hover:text-ink hover:bg-brand-soft'
    }`;

  return (
    <nav
      className={`sticky top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300 ${
        scrolled ? 'glass' : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-5">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link to="/" className="flex items-center space-x-2.5">
              <img src="/yaobox-icon.svg" alt="YaoBox" className="w-8 h-8 shrink-0" />
              <span className="font-semibold text-lg tracking-lux text-ink">YaoBox</span>
            </Link>
            <div className="hidden md:flex items-center space-x-0.5">
              <Link to="/" className={itemCls(isActive('/'))}>
                <Home className="w-4 h-4" strokeWidth={1.75} />
                首页
              </Link>
              <Link to="/camera" className={itemCls(isActive('/camera'))}>
                <Camera className="w-4 h-4" strokeWidth={1.75} />
                水印相机
              </Link>
              <Link
                to="/tools"
                className={itemCls(location.pathname.startsWith('/tool') || isActive('/tools'))}
              >
                <Grid3X3 className="w-4 h-4" strokeWidth={1.75} />
                全部工具
              </Link>
              {user && (
                <Link to="/my" className={itemCls(isActive('/my'))}>
                  个人中心
                </Link>
              )}
              {user?.isAdmin && (
                <Link to="/admin" className={itemCls(isActive('/admin'))}>
                  管理后台
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-1.5">
            <Link
              to="/customer-service"
              className="flex items-center gap-1 text-ink-3 hover:text-ink transition-colors px-2 py-1.5 rounded-full hover:bg-brand-soft"
            >
              <MessageCircle className="w-5 h-5" strokeWidth={1.75} />
              <span className="text-xs font-medium hidden sm:inline">客服</span>
            </Link>
            {user ? (
              <div className="flex items-center space-x-2">
                {user.isVip && (
                  <div className="flex items-center space-x-1 text-gold bg-gradient-to-b from-gold-soft to-white px-2.5 py-1 rounded-full text-xs border border-gold-line/70">
                    <Crown className="w-3.5 h-3.5" strokeWidth={1.5} />
                    <span className="font-medium tracking-wide">VIP</span>
                  </div>
                )}
                <Link
                  to="/my"
                  className="flex items-center gap-1 text-ink-2 hover:text-ink transition-colors px-2 py-1.5 rounded-full hover:bg-brand-soft"
                  title="个人中心（退出登录在个人中心内）"
                >
                  <User className="w-5 h-5" strokeWidth={1.75} />
                  <span className="text-xs font-medium sm:hidden">我的</span>
                  <span className="text-sm text-ink-2 hidden sm:inline">{user.phone}</span>
                </Link>
              </div>
            ) : (
              <Link to="/login" className="btn-primary px-4 py-2 text-sm">
                登录
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
