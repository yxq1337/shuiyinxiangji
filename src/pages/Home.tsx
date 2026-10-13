import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Wrench } from 'lucide-react';
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
      id: 'more1',
      title: '更多工具',
      description: '开发中，敬请期待',
      icon: <Wrench className="w-7 h-7" />,
      path: '/tools',
      color: 'text-gray-500',
      bgColor: 'bg-gray-100',
    },
    {
      id: 'more2',
      title: '更多工具',
      description: '开发中，敬请期待',
      icon: <Wrench className="w-7 h-7" />,
      path: '/tools',
      color: 'text-gray-500',
      bgColor: 'bg-gray-100',
    },
    {
      id: 'more3',
      title: '更多工具',
      description: '开发中，敬请期待',
      icon: <Wrench className="w-7 h-7" />,
      path: '/tools',
      color: 'text-gray-500',
      bgColor: 'bg-gray-100',
    },
    {
      id: 'more4',
      title: '更多工具',
      description: '开发中，敬请期待',
      icon: <Wrench className="w-7 h-7" />,
      path: '/tools',
      color: 'text-gray-500',
      bgColor: 'bg-gray-100',
    },
    {
      id: 'more5',
      title: '更多工具',
      description: '开发中，敬请期待',
      icon: <Wrench className="w-7 h-7" />,
      path: '/tools',
      color: 'text-gray-500',
      bgColor: 'bg-gray-100',
    },
  ];

  const handleToolClick = (tool: ToolItem) => {
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
                className="flex flex-col items-center justify-center p-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-white hover:border-blue-200 hover:shadow-sm transition-all duration-200 active:scale-95"
              >
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
