import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Camera, Volume2, ScanText, ArrowUpRight, PhoneCall, QrCode } from 'lucide-react';

interface ToolEntry {
  name: string;
  desc: string;
  icon: React.ReactNode;
  /** 站内路由 */
  path?: string;
  /** 外部链接（新标签打开） */
  href?: string;
  isNew?: boolean;
  /** 每个工具的配色：图标底块 + 悬停描边 */
  tint: { tile: string; hover: string };
}

export default function OtherTools() {
  const navigate = useNavigate();

  const availableTools: ToolEntry[] = [
    {
      name: '水印相机',
      desc: '自定义时间地点天气水印',
      icon: <Camera className="w-[18px] h-[18px]" strokeWidth={1.5} />,
      path: '/camera',
      tint: { tile: 'bg-[#EAF2FE] border-[#D6E4FB] text-[#3B6FD4]', hover: 'hover:border-[#C9D9F2]' },
    },
    {
      name: '晨会签到',
      desc: '划定区域 · 微信扫码填写真实姓名 · 统计到场人员',
      icon: <QrCode className="w-[18px] h-[18px]" strokeWidth={1.5} />,
      path: '/tool/checkin',
      isNew: true,
      tint: { tile: 'bg-[#E6F4F5] border-[#D0EAEB] text-[#2F8F94]', hover: 'hover:border-[#B9E0E2]' },
    },
    {
      name: 'AI 语音合成',
      desc: '文字转语音，支持声音克隆',
      icon: <Volume2 className="w-[18px] h-[18px]" strokeWidth={1.5} />,
      path: '/tool/tts',
      isNew: true,
      tint: { tile: 'bg-[#F1EDFB] border-[#E3DAF6] text-[#6F5BB5]', hover: 'hover:border-[#D5C8EF]' },
    },
    {
      name: '夸克扫描王',
      desc: 'OCR 识别 · 扫描增强 · 转 Word / PDF',
      icon: <ScanText className="w-[18px] h-[18px]" strokeWidth={1.5} />,
      path: '/tool/quark-scan',
      tint: { tile: 'bg-[#FDF1E6] border-[#F8E3CF] text-[#C2762F]', hover: 'hover:border-[#F2D4B6]' },
    },
    {
      name: 'AI 电话外呼',
      desc: 'DeepSeek 生成话术 · 阿里云线路外呼',
      icon: <PhoneCall className="w-[18px] h-[18px]" strokeWidth={1.5} />,
      path: '/tool/ai-call',
      isNew: true,
      tint: { tile: 'bg-[#FBECEA] border-[#F6DAD6] text-[#B85C4E]', hover: 'hover:border-[#F0C9C3]' },
    },
  ];

  return (
    <div className="relative flex-1 overflow-hidden">
      {/* 顶部彩色光晕 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-48"
        style={{
          background:
            'radial-gradient(55% 100% at 18% 0%, #e8f0fe 0%, rgba(232,240,254,0) 62%), radial-gradient(50% 100% at 82% 0%, #f4ecfd 0%, rgba(244,236,253,0) 58%), radial-gradient(40% 90% at 50% 0%, #fdf3e7 0%, rgba(253,243,231,0) 55%)',
        }}
      />
      <div className="relative max-w-5xl mx-auto px-5 py-8">
        {/* 可用工具 */}
        <div className="card p-6 mb-5">
          <span className="mb-2 block h-1 w-10 rounded-full bg-gradient-to-r from-[#5B8DEF] via-[#A78BFA] to-[#F6B26B]" />
          <h1 className="text-lg font-semibold text-ink mb-5 tracking-lux">全部工具</h1>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5">
            {availableTools.map((tool) => {
              const body = (
                <>
                  {tool.isNew && (
                    <span className="absolute top-4 right-4 flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-gold" />
                      <span className="text-[9px] font-bold tracking-[0.12em] text-gold">NEW</span>
                    </span>
                  )}
                  {tool.href && (
                    <ArrowUpRight
                      className="absolute top-4 right-4 w-3.5 h-3.5 text-ink-4"
                      strokeWidth={1.75}
                    />
                  )}
                  <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${tool.tint.tile}`}>
                    {tool.icon}
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[15px] font-medium text-ink">{tool.name}</span>
                    <span className="block text-xs text-ink-3 mt-1.5 leading-relaxed">{tool.desc}</span>
                  </div>
                </>
              );

              return tool.href ? (
                <a
                  key={tool.name}
                  href={tool.href}
                  target="_blank"
                  rel="noreferrer"
                  className={`card card-press relative flex flex-col items-start gap-3.5 p-5 text-left ${tool.tint.hover}`}
                >
                  {body}
                </a>
              ) : (
                <button
                  key={tool.name}
                  onClick={() => tool.path && navigate(tool.path)}
                  className={`card card-press relative flex flex-col items-start gap-3.5 p-5 text-left ${tool.tint.hover}`}
                >
                  {body}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
