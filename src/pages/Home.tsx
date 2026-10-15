import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Users, Volume2, Shield, Plus } from 'lucide-react';

interface ToolItem {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  color: string;
  bgColor: string;
  isNew?: boolean;
}

export default function Home() {
  const navigate = useNavigate();

  const tools: ToolItem[] = [
    {
      id: 'watermark',
      title: '水印相机',
      description: '自定义时间地点天气水印',
      icon: <Camera className="w-6 h-6" />,
      path: '/camera',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      id: 'tts',
      title: 'AI 语音合成',
      description: '文字转语音，支持声音克隆',
      icon: <Volume2 className="w-6 h-6" />,
      path: '/tool/tts',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      isNew: true,
    },
  ];

  return (
    <div className="flex-1 bg-gray-50">
      {/* 精简横幅：无 LOGO（导航栏已有），只留标语 + 隐私卖点 */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-5">
          <h1 className="text-xl font-bold mb-0.5">YaoBox</h1>
          <p className="text-blue-100 text-sm mb-2">实用工具箱，简单高效</p>
          <p className="flex items-center gap-1.5 text-blue-100/90 text-xs">
            <Shield className="w-3.5 h-3.5" />
            所有工具均在本地处理，保护您的隐私
          </p>
        </div>
      </div>

      {/* 工具区 */}
      <div className="max-w-6xl mx-auto px-4 -mt-3">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">常用工具</h2>

          {/* 两列大卡片 */}
          <div className="grid grid-cols-2 gap-3">
            {tools.map((tool) => (
              <button
                key={tool.id}
                onClick={() => navigate(tool.path)}
                className="relative flex items-start gap-3 p-3.5 rounded-xl border border-gray-100 bg-gray-50 hover:bg-white hover:border-blue-200 hover:shadow-md transition-all duration-200 active:scale-[0.97] text-left"
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
                  <span className="block text-sm font-semibold text-gray-900">{tool.title}</span>
                  <span className="block text-xs text-gray-500 mt-0.5 leading-snug">
                    {tool.description}
                  </span>
                </div>
              </button>
            ))}

            {/* 敬请期待虚线卡片 */}
            <button
              onClick={() => navigate('/tools')}
              className="flex flex-col items-center justify-center p-3.5 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 active:scale-[0.97] text-center gap-1.5"
            >
              <div className="w-11 h-11 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center">
                <Plus className="w-5 h-5" />
              </div>
              <span className="text-xs text-gray-400 font-medium">更多工具即将上线</span>
            </button>
          </div>
        </div>

        {/* 技术讨论群 */}
        <div className="mt-4 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-4">
            <div className="bg-white p-2 rounded-lg border border-gray-200 flex-shrink-0">
              <img
                src="/wechat-tech-group.png"
                alt="YaoBox技术群二维码"
                className="w-32 h-32 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect fill="%23f3f4f6" width="128" height="128"/><text fill="%239ca3af" font-size="12" text-anchor="middle" x="64" y="64">群二维码</text></svg>';
                }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-gray-900">技术讨论群</h3>
              </div>
              <p className="text-xs text-gray-500 mb-1">群聊：YaoBox技术群</p>
              <p className="text-xs text-gray-400 leading-relaxed">
                使用问题、功能建议、新工具预告
              </p>
              <p className="text-[11px] text-blue-500 mt-1.5 font-medium">
                长按二维码识别 · 或截图保存后扫码
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
