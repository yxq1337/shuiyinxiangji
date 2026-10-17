import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Users, Volume2, Plus } from 'lucide-react';
import Reveal from '../components/Reveal';

interface ToolItem {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  tile: string;
  isNew?: boolean;
}

export default function Home() {
  const navigate = useNavigate();

  const tools: ToolItem[] = [
    {
      id: 'watermark',
      title: '水印相机',
      description: '自定义时间地点天气水印',
      icon: <Camera className="w-5 h-5" strokeWidth={1.75} />,
      path: '/camera',
      tile: 'bg-slate-soft text-slate-ink',
    },
    {
      id: 'tts',
      title: 'AI 语音合成',
      description: '文字转语音，支持声音克隆',
      icon: <Volume2 className="w-5 h-5" strokeWidth={1.75} />,
      path: '/tool/tts',
      tile: 'bg-plum-soft text-plum-ink',
      isNew: true,
    },
  ];

  return (
    <div className="flex-1">
      {/* 首屏 Hero：大面积留白 + 极简排版 */}
      <Reveal>
        <section className="max-w-3xl mx-auto px-6 pt-14 pb-12 md:pt-24 md:pb-20 text-center">
          <p className="text-[11px] uppercase tracking-[0.28em] text-ink-4 mb-5">
            YaoBox Studio
          </p>
          <h1 className="text-[30px] leading-tight md:text-5xl font-semibold tracking-lux text-ink">
            极简数字工具箱
          </h1>
          <p className="mt-4 text-sm md:text-base text-ink-2 max-w-md mx-auto leading-relaxed">
            为骑手与创作者打磨的轻量工具 · 所有处理均在本地完成，隐私无忧
          </p>
        </section>
      </Reveal>

      {/* 工具区 */}
      <div className="max-w-5xl mx-auto px-5 pb-10">
        <Reveal delay={80}>
          <h2 className="text-sm font-medium text-ink-3 mb-4 tracking-lux">全部工具</h2>
        </Reveal>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5">
          {tools.map((tool, idx) => (
            <Reveal key={tool.id} delay={120 + idx * 60}>
              <button
                onClick={() => navigate(tool.path)}
                className="card card-press relative flex flex-col items-start gap-3 w-full p-5 text-left h-full"
              >
                {tool.isNew && (
                  <span className="tag-soft absolute top-3 right-3 bg-brand-soft">
                    NEW
                  </span>
                )}
                <div className={`w-11 h-11 rounded-xl ${tool.tile} flex items-center justify-center`}>
                  {tool.icon}
                </div>
                <div className="min-w-0">
                  <span className="block text-[15px] font-medium text-ink">{tool.title}</span>
                  <span className="block text-xs text-ink-3 mt-1 leading-relaxed">
                    {tool.description}
                  </span>
                </div>
              </button>
            </Reveal>
          ))}

          <Reveal delay={120 + tools.length * 60}>
            <button
              onClick={() => navigate('/tools')}
              className="flex flex-col items-center justify-center gap-2 w-full h-full min-h-[132px] p-5 rounded-2xl border-2 border-dashed border-line bg-white/50 hover:bg-white transition-colors active:scale-[0.985]"
            >
              <div className="w-11 h-11 rounded-xl bg-brand-soft text-ink-3 flex items-center justify-center">
                <Plus className="w-5 h-5" strokeWidth={1.75} />
              </div>
              <span className="text-xs text-ink-3 font-medium">更多工具即将上线</span>
            </button>
          </Reveal>
        </div>

        {/* 技术讨论群 */}
        <Reveal delay={200}>
          <div className="card mt-6 p-5">
            <div className="flex items-center gap-5">
              <div className="bg-white p-1.5 rounded-xl border border-line flex-shrink-0">
                <img
                  src="/wechat-tech-group.png"
                  alt="YaoBox技术群二维码"
                  loading="lazy"
                  className="w-28 h-28 object-contain rounded-lg"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect fill="%23f5f5f5" width="128" height="128"/><text fill="%23b5b5b5" font-size="12" text-anchor="middle" x="64" y="64">群二维码</text></svg>';
                  }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <Users className="w-4 h-4 text-ink-2" strokeWidth={1.75} />
                  <h3 className="text-sm font-medium text-ink">技术讨论群</h3>
                </div>
                <p className="text-xs text-ink-3 mb-1">群聊：YaoBox技术群</p>
                <p className="text-xs text-ink-4 leading-relaxed">
                  使用问题 · 功能建议 · 新工具预告
                </p>
                <p className="text-[11px] text-ink-3 mt-2 font-medium">
                  长按二维码识别 · 或截图保存后扫码
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
