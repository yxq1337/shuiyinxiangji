import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Wrench, ArrowLeft, Sparkles, Camera, Volume2, ScanText, ArrowUpRight } from 'lucide-react';

interface ToolEntry {
  name: string;
  desc: string;
  icon: React.ReactNode;
  /** 站内路由 */
  path?: string;
  /** 外部链接（新标签打开） */
  href?: string;
  isNew?: boolean;
}

export default function OtherTools() {
  const navigate = useNavigate();

  const availableTools: ToolEntry[] = [
    {
      name: '水印相机',
      desc: '自定义时间地点天气水印',
      icon: <Camera className="w-[18px] h-[18px]" strokeWidth={1.5} />,
      path: '/camera',
    },
    {
      name: 'AI 语音合成',
      desc: '文字转语音，支持声音克隆',
      icon: <Volume2 className="w-[18px] h-[18px]" strokeWidth={1.5} />,
      path: '/tool/tts',
      isNew: true,
    },
    {
      name: '夸克扫描王',
      desc: 'OCR 识别 · 文件扫描 · 转 Office · 证件照生成',
      icon: <ScanText className="w-[18px] h-[18px]" strokeWidth={1.5} />,
      href: 'https://scan.quark.cn/business',
    },
  ];

  const comingSoonTools = [
    { name: '图片压缩', desc: '无损压缩，减小体积' },
    { name: '证件照换底', desc: '一键更换背景色' },
    { name: '图片转文字', desc: 'OCR文字识别' },
    { name: '图片增强', desc: 'AI修复老照片' },
    { name: '格式转换', desc: 'JPG/PNG/WebP互转' },
    { name: '尺寸调整', desc: '批量调整图片大小' },
  ];

  return (
    <div className="flex-1">
      <div className="max-w-5xl mx-auto px-5 py-8">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
          返回首页
        </Link>

        {/* 可用工具 */}
        <div className="card p-6 mb-5">
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
                  <div className="w-11 h-11 rounded-xl bg-[#F5F5F5] border border-[#EEEEEE] text-ink-2 flex items-center justify-center">
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
                  className="card card-press relative flex flex-col items-start gap-3.5 p-5 text-left"
                >
                  {body}
                </a>
              ) : (
                <button
                  key={tool.name}
                  onClick={() => tool.path && navigate(tool.path)}
                  className="card card-press relative flex flex-col items-start gap-3.5 p-5 text-left"
                >
                  {body}
                </button>
              );
            })}
          </div>
        </div>

        {/* 敬请期待 */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Wrench className="w-4 h-4 text-ink-3" strokeWidth={1.75} />
            <h2 className="text-sm font-medium text-ink tracking-lux">更多工具开发中</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5">
            {comingSoonTools.map((tool) => (
              <div key={tool.name} className="p-4 rounded-xl border border-line">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-ink-4" strokeWidth={1.75} />
                  <span className="text-sm font-medium text-ink-2">{tool.name}</span>
                </div>
                <p className="text-xs text-ink-4">{tool.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
