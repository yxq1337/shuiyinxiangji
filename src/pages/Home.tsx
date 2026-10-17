import React from 'react';
import Reveal from '../components/Reveal';

export default function Home() {
  return (
    <div className="flex-1">
      <div className="max-w-3xl mx-auto px-5 pt-6 pb-10 md:pt-9">
        {/* 技术讨论群 */}
        <Reveal>
          <div className="card bg-canvas p-5">
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
