import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Wrench, ArrowLeft, Sparkles, Camera, Volume2 } from 'lucide-react';

export default function OtherTools() {
  const navigate = useNavigate();

  const availableTools = [
    {
      name: '水印相机',
      desc: '自定义时间地点天气水印',
      icon: <Camera className="w-6 h-6" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      path: '/camera',
    },
    {
      name: 'AI 语音合成',
      desc: '文字转语音，支持声音克隆',
      icon: <Volume2 className="w-6 h-6" />,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      path: '/tool/tts',
      isNew: true,
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
    <div className="flex-1 bg-transparent">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-6">
          <ArrowLeft className="w-4 h-4" />
          返回首页
        </Link>

        {/* 可用工具 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-4">
          <h1 className="text-lg font-bold text-gray-900 mb-4">全部工具</h1>
          <div className="grid grid-cols-2 gap-3">
            {availableTools.map((tool) => (
              <button
                key={tool.name}
                onClick={() => navigate(tool.path)}
                className="relative flex items-start gap-3 p-3.5 rounded-xl border border-gray-100 bg-white hover:border-blue-200 hover:shadow-md transition-all duration-200 active:scale-[0.97] text-left"
              >
                {tool.isNew && (
                  <span className="absolute top-1.5 right-1.5 px-1 py-px bg-red-500 text-white text-[8px] font-semibold rounded">
                    NEW
                  </span>
                )}
                <div className={`w-11 h-11 rounded-xl ${tool.bgColor} ${tool.color} flex items-center justify-center flex-shrink-0`}>
                  {tool.icon}
                </div>
                <div className="min-w-0">
                  <span className="block text-sm font-semibold text-gray-900">{tool.name}</span>
                  <span className="block text-xs text-gray-500 mt-0.5 leading-snug">{tool.desc}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 敬请期待 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Wrench className="w-5 h-5 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">更多工具开发中</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {comingSoonTools.map((tool) => (
              <div
                key={tool.name}
                className="p-3 bg-transparent rounded-xl border border-gray-100"
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
