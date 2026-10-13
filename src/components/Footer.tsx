import React, { useState, useEffect } from 'react';
import { X, MessageCircle } from 'lucide-react';

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
      <footer className="mt-8 py-6 border-t border-gray-200">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-xs text-gray-400">
            网页问题{' '}
            <button
              onClick={() => setShowQr(true)}
              className="text-green-600 hover:text-green-700 font-medium underline underline-offset-2 decoration-green-300 hover:decoration-green-500 transition-colors"
            >
              请联系客服人员
            </button>
          </p>
          <p className="text-[10px] text-gray-300 mt-1.5">
            © {new Date().getFullYear()} YaoBox · 所有工具均在本地处理，保护您的隐私
          </p>
        </div>
      </footer>

      {/* 客服二维码弹窗 */}
      {showQr && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setShowQr(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-xs w-full text-center relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowQr(false)}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="关闭"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <MessageCircle className="w-7 h-7 text-green-600" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">联系客服</h3>
            <p className="text-xs text-gray-500 mb-4">扫二维码，添加我为朋友</p>

            <div className="bg-white p-2 rounded-xl border border-gray-200 inline-block">
              <img
                src="/wechat-customer-service.png"
                alt="微信客服二维码"
                className="w-44 h-44 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>

            <p className="text-[11px] text-gray-400 mt-4">
              工作时间 9:00 - 22:00 · 添加请备注「YaoBox」
            </p>
          </div>
        </div>
      )}
    </>
  );
}
