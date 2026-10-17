import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Volume2, Plus, ArrowRight } from 'lucide-react';
import Reveal from '../components/Reveal';

interface ToolItem {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  isNew?: boolean;
}

export default function Home() {
  const navigate = useNavigate();

  const tools: ToolItem[] = [
    {
      id: 'watermark',
      title: '水印相机',
      description: '自定义时间地点天气水印',
      icon: <Camera className="w-[18px] h-[18px]" strokeWidth={1.5} />,
      path: '/camera',
    },
    {
      id: 'tts',
      title: 'AI 语音合成',
      description: '文字转语音，支持声音克隆',
      icon: <Volume2 className="w-[18px] h-[18px]" strokeWidth={1.5} />,
      path: '/tool/tts',
      isNew: true,
    },
  ];

  return (
    <div className="flex-1">
      {/* 首屏 Hero：大面积留白 + 极简排版 */}
      <Reveal>
        <section className="max-w-2xl mx-auto px-6 pt-16 pb-14 md:pt-24 md:pb-20 text-center">
          <p className="text-[10px] md:text-[11px] uppercase tracking-[0.28em] text-[#B0B0B0] mb-6">
            YaoBox Studio
          </p>
          <h1 className="text-[30px] leading-tight md:text-5xl font-semibold tracking-lux text-ink">
            极简数字工具箱
          </h1>
          <p className="mt-4 text-[13px] md:text-sm text-ink-3 max-w-md mx-auto leading-relaxed">
            为骑手与创作者打磨的轻量工具 · 所有处理均在本地完成，隐私无忧
          </p>
        </section>
      </Reveal>

      {/* 工具区 */}
      <div className="max-w-3xl mx-auto px-5 pb-10">
        <Reveal delay={80}>
          <h2 className="text-xs font-medium text-ink-3 mb-4 tracking-[0.14em] uppercase">工具</h2>
        </Reveal>

        <div className="grid grid-cols-2 gap-3.5">
          {tools.map((tool, idx) => (
            <Reveal key={tool.id} delay={120 + idx * 60}>
              <button
                onClick={() => navigate(tool.path)}
                className="card card-press relative flex flex-col items-start gap-3.5 w-full p-5 text-left h-full"
              >
                {tool.isNew && (
                  <span className="absolute top-4 right-4 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-gold" />
                    <span className="text-[9px] font-bold tracking-[0.12em] text-gold">NEW</span>
                  </span>
                )}
                <div className="w-11 h-11 rounded-xl bg-[#F5F5F5] border border-[#EEEEEE] text-ink-2 flex items-center justify-center">
                  {tool.icon}
                </div>
                <div className="min-w-0">
                  <span className="block text-[15px] font-medium text-ink">{tool.title}</span>
                  <span className="block text-xs text-ink-3 mt-1.5 leading-relaxed">
                    {tool.description}
                  </span>
                </div>
              </button>
            </Reveal>
          ))}
        </div>

        {/* 更多工具：全宽横向条目 */}
        <Reveal delay={220}>
          <button
            onClick={() => navigate('/tools')}
            className="card card-press mt-3.5 flex items-center justify-between w-full px-5 py-4"
          >
            <span className="flex items-center gap-3">
              <Plus className="w-4 h-4 text-ink-4" strokeWidth={1.5} />
              <span className="text-[13px] text-ink-3">更多工具开发中 · 敬请期待</span>
            </span>
            <ArrowRight className="w-4 h-4 text-ink-4" strokeWidth={1.5} />
          </button>
        </Reveal>

        {/* 技术讨论群 */}
        <Reveal delay={280}>
          <div className="card bg-canvas mt-4 p-5">
            <div className="flex items-center gap-5">
              <div className="bg-white p-2 rounded-xl border border-line flex-shrink-0">
                <img
                  src="/wechat-tech-group.png"
                  alt="YaoBox技术群二维码"
                  loading="lazy"
                  className="w-24 h-24 object-contain rounded-md"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect fill="%23f5f5f5" width="128" height="128"/><text fill="%23b5b5b5" font-size="12" text-anchor="middle" x="64" y="64">群二维码</text></svg>';
                  }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-ink tracking-lux">技术讨论群</h3>
                <p className="text-xs text-ink-4 mt-1 leading-relaxed">
                  YaoBox 技术交流 · 使用问题与功能建议
                </p>
                <p className="text-[11px] text-ink-4 mt-3">
                  长按二维码识别 · 或截图后扫码
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
