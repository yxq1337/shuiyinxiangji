import React from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, ArrowLeft, Copy, Check } from 'lucide-react';
import { useState } from 'react';

export default function CustomerService() {
  const [copied, setCopied] = useState(false);
  const wechatId = 'YaoBoxKF';

  const handleCopy = () => {
    navigator.clipboard.writeText(wechatId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex-1 bg-transparent">
      <div className="max-w-md mx-auto px-4 py-6">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-6">
          <ArrowLeft className="w-4 h-4" />
          返回首页
        </Link>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="w-8 h-8 text-green-600" />
          </div>

          <h1 className="text-xl font-bold text-gray-900 mb-1">联系客服</h1>
          <p className="text-gray-500 text-sm mb-6">扫码添加微信客服，随时为您解答</p>

          {/* 二维码图片 */}
          <div className="bg-white p-3 rounded-xl border border-gray-200 inline-block mb-6">
            <img
              src="/wechat-customer-service.png"
              alt="微信客服二维码"
              className="w-48 h-48 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192"><rect fill="%23f3f4f6" width="192" height="192"/><text fill="%239ca3af" font-size="14" text-anchor="middle" x="96" y="96">客服二维码</text></svg>';
              }}
            />
          </div>

          <div className="bg-transparent rounded-xl p-4 mb-4">
            <p className="text-xs text-gray-500 mb-2">微信号</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-lg font-semibold text-gray-800">{wechatId}</span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-200 rounded-md text-xs text-gray-600 hover:bg-gray-100 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-green-500" />
                    已复制
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    复制
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="text-left space-y-2">
            <p className="text-xs text-gray-400 flex items-start gap-2">
              <span className="text-green-500 flex-shrink-0">●</span>
              <span>工作时间：周一至周日 9:00 - 22:00</span>
            </p>
            <p className="text-xs text-gray-400 flex items-start gap-2">
              <span className="text-green-500 flex-shrink-0">●</span>
              <span>添加时请备注「YaoBox」</span>
            </p>
            <p className="text-xs text-gray-400 flex items-start gap-2">
              <span className="text-green-500 flex-shrink-0">●</span>
              <span>通常 5 分钟内回复，请耐心等待</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
