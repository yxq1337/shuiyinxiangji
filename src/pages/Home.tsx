import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Wrench, Sparkles, Image as ImageIcon, FileText, Wand2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface ToolItem {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  color: string;
  bgColor: string;
  isNew?: boolean;
  isVip?: boolean;
}

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isVip = user?.isVip;

  const tools: ToolItem[] = [
    {
      id: 'watermark',
      title: '水印相机',
      description: '自定义时间地点天气水印',
      icon: <Camera className="w-7 h-7" />,
      path: '/camera',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      id: 'compress',
      title: '图片压缩',
      description: '无损压缩图片体积',
      icon: <ImageIcon className="w-7 h-7" />,
      path: '/tool/compress',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      isNew: true,
    },
    {
      id: 'idphoto',
      title: '证件照换底',
      description: '一键更换证件照背景色',
      icon: <Sparkles className="w-7 h-7" />,
      path: '/tool/idphoto',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      isNew: true,
      isVip: true,
    },
    {
      id: 'ocr',
      title: '图片转文字',
      description: 'OCR识别图片文字',
      icon: <FileText className="w-7 h-7" />,
      path: '/tool/ocr',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      isVip: true,
    },
    {
      id: 'enhance',
      title: '图片增强',
      description: 'AI修复模糊老照片',
      icon: <Wand2 className="w-7 h-7" />,
      path: '/tool/enhance',
      color: 'text-pink-600',
      bgColor: 'bg-pink-50',
      isVip: true,
    },
    {
      id: 'more',
      title: '更多工具',
      description: '开发中，敬请期待',
      icon: <Wrench className="w-7 h-7" />,
      path: '/tools',
      color: 'text-gray-500',
      bgColor: 'bg-gray-100',
    },
  ];

  const handleToolClick = (tool: ToolItem) => {
    if (tool.isVip && !isVip) {
      navigate('/pricing');
      return;
    }
    navigate(tool.path);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 头部横幅 */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold mb-1">图片工具箱</h1>
          <p className="text-blue-100 text-sm">一站式图片处理工具，简单高效</p>
        </div>
      </div>

      {/* 工具网格 */}
      <div className="max-w-6xl mx-auto px-4 -mt-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">常用工具</h2>
          <div className="grid grid-cols-3 gap-3">
            {tools.map((tool) => (
              <button
                key={tool.id}
                onClick={() => handleToolClick(tool)}
                className="relative flex flex-col items-center justify-center p-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-white hover:border-blue-200 hover:shadow-sm transition-all duration-200 active:scale-95"
              >
                {tool.isNew && (
                  <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                    NEW
                  </span>
                )}
                {tool.isVip && (
                  <span className="absolute top-1 left-1 bg-yellow-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                    VIP
                  </span>
                )}
                <div className={`w-12 h-12 rounded-xl ${tool.bgColor} ${tool.color} flex items-center justify-center mb-2`}>
                  {tool.icon}
                </div>
                <span className="text-xs font-medium text-gray-800 text-center">{tool.title}</span>
                <span className="text-[10px] text-gray-400 mt-0.5 text-center line-clamp-1">
                  {tool.description}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 底部提示 */}
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-400">所有工具均在本地处理，保护您的隐私安全</p>
        </div>
      </div>
    </div>
  );
}
