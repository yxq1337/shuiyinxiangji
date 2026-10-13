import React from 'react';
import { Link } from 'react-router-dom';
import { Wrench, ArrowLeft, Sparkles } from 'lucide-react';

export default function OtherTools() {
  const comingSoonTools = [
    { name: '图片压缩', desc: '无损压缩，减小体积' },
    { name: '证件照换底', desc: '一键更换背景色' },
    { name: '图片转文字', desc: 'OCR文字识别' },
    { name: '图片增强', desc: 'AI修复老照片' },
    { name: '格式转换', desc: 'JPG/PNG/WebP互转' },
    { name: '尺寸调整', desc: '批量调整图片大小' },
  ];

  return (
    <div className="flex-1 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-6">
          <ArrowLeft className="w-4 h-4" />
          返回首页
        </Link>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Wrench className="w-8 h-8 text-gray-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">更多工具开发中</h1>
          <p className="text-gray-500 text-sm mb-6">以下工具正在紧锣密鼓地开发中，敬请期待</p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-lg mx-auto">
            {comingSoonTools.map((tool) => (
              <div
                key={tool.name}
                className="p-3 bg-gray-50 rounded-xl border border-gray-100"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-gray-300" />
                  <span className="text-sm font-medium text-gray-700">{tool.name}</span>
                </div>
                <p className="text-xs text-gray-400">{tool.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
