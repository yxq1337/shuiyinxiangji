import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Wrench, Users, Volume2 } from 'lucide-react';
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
      id: 'tts',
      title: 'AI 语音合成',
      description: '文字转语音，支持声音克隆',
      icon: <Volume2 className="w-7 h-7" />,
      path: '/tool/tts',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      isNew: true,
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
    <div className="flex-1 bg-gray-50">
      {/* 头部横幅 */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-8 flex items-center gap-3">
          <img src="/yaobox-logo-96.png" alt="YaoBox" className="w-12 h-12 object-contain drop-shadow" />
          <div>
            <h1 className="text-2xl font-bold mb-1">YaoBox</h1>
            <p className="text-blue-100 text-sm">实用工具箱，简单高效</p>
          </div>
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
                className="flex flex-col items-center justify-center p-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-white hover:border-blue-200 hover:shadow-sm transition-all duration-200 active:scale-95 relative"
              >
                {tool.isNew && (
                  <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-medium rounded-full">
                    NEW
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

        {/* 技术讨论群 */}
        <div className="mt-4 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-4">
            <div className="bg-white p-2 rounded-lg border border-gray-200 flex-shrink-0">
              <img
                src="/wechat-tech-group.png"
                alt="YaoBox技术群二维码"
                className="w-28 h-28 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="112" height="112" viewBox="0 0 112 112"><rect fill="%23f3f4f6" width="112" height="112"/><text fill="%239ca3af" font-size="12" text-anchor="middle" x="56" y="56">群二维码</text></svg>';
                }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-gray-900">技术讨论群</h3>
              </div>
              <p className="text-xs text-gray-500">群聊：YaoBox技术群</p>
              <p className="text-xs text-gray-400 mt-1.5">
                使用问题、功能建议、新工具预告，扫码进群一起聊
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
