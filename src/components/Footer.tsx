import React, { useState, useEffect } from 'react';
import { X, MessageCircle, Github } from 'lucide-react';

export default function Footer() {
  const [showQr, setShowQr] = useState(false);

  // ESC 关闭二维码弹窗
  useEffect(() => {
    if (!showQr) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowQr(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showQr]);

  return (
    <>
      <footer className="mt-10 py-8 border-t border-line">
        <div className="max-w-6xl mx-auto px-5 text-center space-y-2">
          <p className="text-[11px] text-ink-4">
            网页问题{' '}
            <button
              onClick={() => setShowQr(true)}
              className="text-ink-3 hover:text-ink underline underline-offset-2 decoration-line hover:decoration-ink-3 transition-colors"
            >
              请联系客服人员
            </button>
            {' '}·{' '}
            <a
              href="https://github.com/yxq1337/shuiyinxiangji"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 text-ink-4 hover:text-ink-2 align-middle transition-colors"
            >
              <Github className="w-3 h-3" strokeWidth={1.75} />
              GitHub
            </a>
          </p>
          <p className="text-[10px] text-ink-4">
            © {new Date().getFullYear()} YaoBox · 所有工具均在本地处理，保护您的隐私
          </p>
          <p className="text-[10px] text-ink-4">
            <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer" className="hover:text-ink-3 transition-colors">
              浙ICP备2024XXXXXX号
            </a>
          </p>
        </div>
      </footer>

      {/* 客服二维码弹窗 */}
      {showQr && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowQr(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-xs w-full text-center relative shadow-card-hover"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowQr(false)}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-ink-3 hover:text-ink rounded-full hover:bg-brand-soft transition-colors"
              aria-label="关闭"
            >
              <X className="w-5 h-5" strokeWidth={1.75} />
            </button>

            <div className="w-14 h-14 bg-eco-soft rounded-full flex items-center justify-center mx-auto mb-3">
              <MessageCircle className="w-7 h-7 text-eco" strokeWidth={1.75} />
            </div>
            <h3 className="text-base font-medium text-ink mb-1 tracking-lux">联系客服</h3>
            <p className="text-xs text-ink-3 mb-4">扫二维码，添加我为朋友</p>

            <div className="bg-white p-2 rounded-xl border border-line inline-block">
              <img
                src="/wechat-customer-service.png"
                alt="微信客服二维码"
                loading="lazy"
                className="w-44 h-44 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>

            <p className="text-[11px] text-ink-4 mt-4">
              工作时间 9:00 - 22:00 · 添加请备注「YaoBox」
            </p>
          </div>
        </div>
      )}
    </>
  );
}
