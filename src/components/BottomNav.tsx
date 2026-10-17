import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Grid3X3, Users, User } from 'lucide-react';

/**
 * 顶部标签导航：首页 / 工具 / 嘉兴骑手 / 我的
 * 移动端固定在品牌栏下方，桌面端隐藏（顶部导航已覆盖）
 * 激活态：纯黑图标 + 极小圆点指示器，保持克制
 */
export default function BottomNav() {
  const location = useLocation();

  const tabs = [
    { key: 'home', label: '首页', to: '/', icon: Home, match: (p: string) => p === '/' },
    { key: 'tools', label: '工具', to: '/tools', icon: Grid3X3, match: (p: string) => p.startsWith('/tool') || p === '/camera' },
    { key: 'community', label: '嘉兴骑手', to: '/community', icon: Users, match: (p: string) => p.startsWith('/community') },
    { key: 'my', label: '我的', to: '/my', icon: User, match: (p: string) => p === '/my' || p.startsWith('/my') },
  ];

  return (
    <nav className="md:hidden fixed top-16 left-0 right-0 z-40 glass border-b border-black/5">
      <div className="flex justify-around items-center h-14 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const active = tab.match(location.pathname);
          return (
            <Link
              key={tab.key}
              to={tab.to}
              className={`relative flex flex-col items-center justify-center flex-1 h-full transition-colors duration-200 ${
                active ? 'text-ink' : 'text-ink-3'
              }`}
            >
              <tab.icon className="w-5 h-5" strokeWidth={active ? 2 : 1.75} />
              <span className={`text-[10px] mt-0.5 ${active ? 'font-semibold' : 'font-medium'}`}>
                {tab.label}
              </span>
              <span
                className={`absolute bottom-1.5 w-1 h-1 rounded-full bg-ink transition-opacity duration-200 ${
                  active ? 'opacity-100' : 'opacity-0'
                }`}
                aria-hidden
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
