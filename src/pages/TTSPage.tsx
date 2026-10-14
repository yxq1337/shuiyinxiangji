import React, { useState, useRef } from 'react';
import { ArrowLeft, Volume2, Download, Settings, Mic, Loader2, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';

type Mode = 'server' | 'custom';

export default function TTSPage() {
  const [mode, setMode] = useState<Mode>('server');
  const [showSettings, setShowSettings] = useState(false);
  const [customKey, setCustomKey] = useState<string>(
    () => localStorage.getItem('yaobox_fish_api_key') || '',
  );
  const [keySaved, setKeySaved] = useState(false);

  const [text, setText] = useState('你好，欢迎使用 YaoBox AI 语音合成工具。');
  const [referenceId, setReferenceId] = useState('');
  const [model, setModel] = useState('s2.1-pro-free');
  const [format, setFormat] = useState<'mp3' | 'wav' | 'opus'>('mp3');
  const [speed, setSpeed] = useState(1.0);

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleSaveCustomKey = () => {
    localStorage.setItem('yaobox_fish_api_key', customKey.trim());
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 1500);
  };

  const handleGenerate = async () => {
    if (!text.trim()) {
      setError('请输入要合成的文字');
      return;
    }
    if (mode === 'custom' && !customKey.trim()) {
      setError('自定义模式下请填入 API Key');
      setShowSettings(true);
      return;
    }

    setError(null);
    setIsGenerating(true);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }

    try {
      const body: Record<string, unknown> = {
        text: text.trim(),
        format,
        speed_factor: speed,
        model,
      };
      if (referenceId.trim()) {
        body.reference_id = referenceId.trim();
      }

      const url = mode === 'server' ? 'https://shuiyinxiangji-api.yxq1337.workers.dev/api/tts' : 'https://api.fish.audio/v1/tts';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (mode === 'custom') {
        headers['Authorization'] = `Bearer ${customKey.trim()}`;
        headers['model'] = model;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || `合成失败 (${res.status})`);
        }
        const errText = await res.text().catch(() => '');
        throw new Error(`合成失败 (${res.status})${errText ? ': ' + errText.slice(0, 200) : ''}`);
      }

      const blob = await res.blob();
      const url_obj = URL.createObjectURL(blob);
      setAudioUrl(url_obj);
    } catch (e) {
      setError(e instanceof Error ? e.message : '合成失败');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `yaobox-tts-${Date.now()}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="flex-1 bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-6">
          <ArrowLeft className="w-4 h-4" />
          返回首页
        </Link>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                <Volume2 className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">AI 语音合成</h1>
                <p className="text-xs text-gray-500">
                  由 Fish Audio 驱动 ·{' '}
                  {mode === 'server' ? (
                    <span className="inline-flex items-center gap-0.5 text-green-600">
                      <Shield className="w-3 h-3" />
                      服务端代理
                    </span>
                  ) : (
                    <span className="text-orange-600">自定义 Key</span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg transition-colors ${
                showSettings ? 'bg-purple-50 text-purple-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
              aria-label="设置"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>

          {/* 设置面板 */}
          {showSettings && (
            <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">合成模式</h3>
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setMode('server')}
                  className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg border transition-colors ${
                    mode === 'server'
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  服务端代理（推荐）
                </button>
                <button
                  onClick={() => setMode('custom')}
                  className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg border transition-colors ${
                    mode === 'custom'
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  自定义 API Key
                </button>
              </div>

              {mode === 'server' && (
                <p className="text-[11px] text-gray-500">
                  通过 YaoBox 服务端调用 Fish Audio API，无需配置 Key，直接使用。
                </p>
              )}

              {mode === 'custom' && (
                <>
                  <label className="block text-xs text-gray-500 mb-1.5">Fish Audio API Key</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="password"
                      value={customKey}
                      onChange={(e) => setCustomKey(e.target.value)}
                      placeholder="填入你的 API Key"
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
                    />
                    <button
                      onClick={handleSaveCustomKey}
                      className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      {keySaved ? '已保存' : '保存'}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Key 仅保存在本地浏览器中。
                    <a
                      href="https://fish.audio/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-600 hover:text-purple-700 ml-1"
                    >
                      去获取 →
                    </a>
                  </p>
                </>
              )}
            </div>
          )}

          {/* 文本输入 */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-700 mb-1.5">合成文本</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder="输入要转换为语音的文字…"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 resize-none"
            />
            <p className="text-[11px] text-gray-400 mt-1 text-right">{text.length} 字</p>
          </div>

          {/* 参数行 */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">模型</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 bg-white"
              >
                <option value="s2.1-pro-free">s2.1-pro-free（免费）</option>
                <option value="s2.1-pro">s2.1-pro（付费）</option>
                <option value="s2-pro">s2-pro</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">语速</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  className="flex-1 accent-purple-600"
                />
                <span className="text-xs text-gray-500 w-10 text-right">{speed.toFixed(1)}x</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">格式</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as 'mp3' | 'wav' | 'opus')}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 bg-white"
              >
                <option value="mp3">MP3</option>
                <option value="wav">WAV</option>
                <option value="opus">Opus</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                <span className="flex items-center gap-1">
                  <Mic className="w-3.5 h-3.5" />
                  音色 ID（可选）
                </span>
              </label>
              <input
                type="text"
                value={referenceId}
                onChange={(e) => setReferenceId(e.target.value)}
                placeholder="reference_id"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
              />
            </div>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
              {error}
            </div>
          )}

          {/* 生成按钮 */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                正在合成…
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4" />
                开始合成
              </>
            )}
          </button>

          {/* 结果区 */}
          {audioUrl && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-800">合成结果</h3>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  下载
                </button>
              </div>
              <audio ref={audioRef} src={audioUrl} controls className="w-full" />
            </div>
          )}
        </div>

        <p className="text-[11px] text-gray-400 text-center mt-4">
          音频由 Fish Audio 生成 · 请勿用于违法违规用途
        </p>
      </div>
    </div>
  );
}
