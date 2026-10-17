import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Crown, History, Settings, ArrowRight, Calendar, CheckCircle, MessageCircle, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Reveal from '../components/Reveal';

export default function UserCenter() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-ink-2 mb-4">请先登录</p>
          <button onClick={() => navigate('/login')} className="btn-primary px-6 py-2.5 text-sm">
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
    {
      icon: MessageCircle,
      title: '联系客服',
      description: '遇到问题？找客服帮忙',
      to: '/customer-service',
    },
  ];

  // 管理员可见：后台管理入口
  if (user.isAdmin) {
    menuItems.push({
      icon: Shield,
      title: '后台管理',
      description: '管理用户、订单、社区审核',
      to: '/admin',
    });
  }

  return (
    <div className="flex-1 py-8 px-5">
      <div className="max-w-3xl mx-auto">
        {/* 用户信息卡 */}
        <Reveal>
          <div className="card p-6 mb-5">
            <div className="flex items-center space-x-4">
              <div className="w-[68px] h-[68px] rounded-full bg-brand-soft border border-line flex items-center justify-center flex-shrink-0">
                <User className="w-8 h-8 text-ink-2" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-semibold text-ink tracking-lux truncate">{user.phone}</h1>
                <p className="text-sm text-ink-3 mt-1">
                  注册时间：{new Date(user.createdAt).toLocaleDateString('zh-CN')}
                </p>
              </div>
              {user.isVip ? (
                <div className="flex items-center space-x-1.5 bg-gold-soft border border-gold-line text-gold px-3.5 py-1.5 rounded-full flex-shrink-0">
                  <Crown className="w-4 h-4" strokeWidth={1.75} />
                  <span className="text-sm font-medium">VIP会员</span>
                </div>
              ) : (
                <button
                  onClick={() => navigate('/pricing')}
                  className="bg-gold text-white px-5 py-2 rounded-full text-sm font-medium hover:opacity-90 active:scale-[0.985] transition-all flex-shrink-0"
                >
                  开通VIP
                </button>
              )}
            </div>

            {user.isVip && user.vipExpiresAt && (
              <div className="mt-5 p-4 bg-gold-soft rounded-xl border border-gold-line flex items-center space-x-3">
                <Calendar className="w-4 h-4 text-gold flex-shrink-0" strokeWidth={1.75} />
                <span className="text-[13px] text-[#8a6d3b]">
                  会员有效期至：{new Date(user.vipExpiresAt).toLocaleDateString('zh-CN')}
                </span>
              </div>
            )}
          </div>
        </Reveal>

        {/* 功能菜单 */}
        <div className="space-y-3">
          {menuItems.map((item, idx) => (
            <Reveal key={idx} delay={60 + idx * 45}>
              <Link
                to={item.to}
                className={`card card-press block p-5 ${
                  item.highlight ? 'border-gold-line' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${item.highlight ? 'bg-gold-soft' : 'bg-brand-soft'}`}>
                      <item.icon className={`w-5 h-5 ${item.highlight ? 'text-gold' : 'text-ink-2'}`} strokeWidth={1.75} />
                    </div>
                    <div>
                      <h3 className="font-medium text-ink tracking-lux">{item.title}</h3>
                      <p className="text-[13px] text-ink-3 mt-0.5">{item.description}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-ink-4" strokeWidth={1.75} />
                </div>
              </Link>
            </Reveal>
          ))}
        </div>

        {/* 使用小贴士 */}
        <Reveal delay={260}>
          <div className="card mt-6 p-6">
            <h2 className="text-sm font-medium text-ink mb-4 tracking-lux">使用小贴士</h2>
            <ul className="space-y-3">
              <li className="flex items-start space-x-3">
                <CheckCircle className="w-4 h-4 text-eco flex-shrink-0 mt-0.5" strokeWidth={1.75} />
                <span className="text-[13px] text-ink-2 leading-relaxed">VIP会员可无限次使用高清无水印导出</span>
              </li>
              <li className="flex items-start space-x-3">
                <CheckCircle className="w-4 h-4 text-eco flex-shrink-0 mt-0.5" strokeWidth={1.75} />
                <span className="text-[13px] text-ink-2 leading-relaxed">支持批量处理多张图片，大幅提升效率</span>
              </li>
              <li className="flex items-start space-x-3">
                <CheckCircle className="w-4 h-4 text-eco flex-shrink-0 mt-0.5" strokeWidth={1.75} />
                <span className="text-[13px] text-ink-2 leading-relaxed">所有生成的图片都会保留原始分辨率</span>
              </li>
            </ul>
          </div>
        </Reveal>

        <div className="mt-8 text-center">
          <button onClick={logout} className="text-ink-3 hover:text-ink-2 text-sm transition-colors">
            退出登录
          </button>
        </div>
      </div>
    </div>
  );
}
