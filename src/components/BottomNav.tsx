import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Grid3X3, Users, User } from 'lucide-react';

/**
 * 底部四标签导航：首页 / 工具 / 社区 / 我的
 * 移动端固定底部展示，桌面端隐藏（顶部导航已覆盖）
 */
export default function BottomNav() {
  const location = useLocation();

  const tabs = [
    { key: 'home', label: '首页', to: '/', icon: Home, match: (p: string) => p === '/' },
    { key: 'tools', label: '工具', to: '/tools', icon: Grid3X3, match: (p: string) => p.startsWith('/tool') || p === '/camera' },
    { key: 'community', label: '社区', to: '/community', icon: Users, match: (p: string) => p.startsWith('/community') },
    { key: 'my', label: '我的', to: '/my', icon: User, match: (p: string) => p === '/my' || p.startsWith('/my') },
  ];

  return (
    <nav className="md:hidden fixed top-16 left-0 right-0 z-40 bg-white border-b border-gray-100">
      <div className="flex justify-around items-center h-14 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const active = tab.match(location.pathname);
          return (
            <Link
              key={tab.key}
              to={tab.to}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                active ? 'text-[#246BFD]' : 'text-gray-400'
              }`}
            >
              <tab.icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
              <span className="text-[10px] mt-0.5 font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
