import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  PhoneCall,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  ListChecks,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiAuthGet, apiAuthPost } from '../lib/api';

interface AiCallStatus {
  deepseekConfigured: boolean;
  deepseekModel: string;
  aliyunConfigured: boolean;
  aliyunAction: string;
  aliyunCallerNumber: string;
}

interface AiCallResult {
  number: string;
  ok: boolean | null;
  message: string;
}

interface AiCallTask {
  id: string;
  numbers: string[];
  script: string;
  status: string;
  results: AiCallResult[];
  createdAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending_config: '待开通线路',
  dry_run: '演练完成',
  submitted: '已提交外呼',
  partial_failed: '部分失败',
  failed: '全部失败',
};

export default function AICallPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState<AiCallStatus | null>(null);
  const [requirement, setRequirement] = useState('');
  const [script, setScript] = useState('');
  const [numbersText, setNumbersText] = useState('');
  const [dryRun, setDryRun] = useState(true);
  const [tasks, setTasks] = useState<AiCallTask[]>([]);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const validNumbers = useMemo(() => {
    const list = numbersText
      .split(/[\s,，;；]+/)
      .map((n) => n.replace(/\D/g, ''))
      .filter((n) => /^1[3-9]\d{9}$/.test(n));
    return Array.from(new Set(list));
  }, [numbersText]);

  const loadStatus = async () => {
    try {
      const res = await apiAuthGet<{ success: boolean; data?: AiCallStatus; error?: string }>('/ai-call/status');
      if (res.success && res.data) {
        setStatus(res.data);
      } else if (!res.success) {
        setMessage({ type: 'err', text: res.error || '读取配置状态失败' });
      }
    } catch {
      setMessage({ type: 'err', text: '无法连接服务端，请稍后重试' });
    }
  };

  const loadTasks = async () => {
    try {
      const res = await apiAuthGet<{ success: boolean; data?: AiCallTask[]; error?: string }>('/ai-call/tasks');
      if (res.success && res.data) {
        setTasks(res.data);
      }
    } catch {
      // 列表加载失败不打断主流程
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!user.isAdmin) {
      navigate('/');
      return;
    }
    void loadStatus();
    void loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const generateScript = async () => {
    if (!requirement.trim()) {
      setMessage({ type: 'err', text: '请先填写外呼需求' });
      return;
    }
    setGenerating(true);
    setMessage(null);
    try {
      const res = await apiAuthPost<{ success: boolean; data?: { script: string }; error?: string }>(
        '/ai-call/script',
        { requirement }
      );
      if (res.success && res.data) {
        setScript(res.data.script);
        setMessage({ type: 'ok', text: '话术已生成，可直接编辑后使用' });
      } else {
        setMessage({ type: 'err', text: res.error || '生成失败' });
      }
    } catch {
      setMessage({ type: 'err', text: '网络异常，请稍后重试' });
    } finally {
      setGenerating(false);
    }
  };

  const submitTask = async () => {
    if (!script.trim()) {
      setMessage({ type: 'err', text: '请先生成或填写话术' });
      return;
    }
    if (!validNumbers.length) {
      setMessage({ type: 'err', text: '请填写至少一个有效手机号' });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await apiAuthPost<{ success: boolean; data?: AiCallTask; error?: string }>('/ai-call/tasks', {
        numbers: validNumbers,
        script,
        requirement,
        dryRun,
      });
      if (res.success) {
        setMessage({
          type: 'ok',
          text: dryRun || !status?.aliyunConfigured ? '任务已创建（演练模式，未真实拨打）' : '外呼任务已提交',
        });
        void loadTasks();
      } else {
        setMessage({ type: 'err', text: res.error || '任务创建失败' });
      }
    } catch {
      setMessage({ type: 'err', text: '网络异常，请稍后重试' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1">
      <div className="max-w-4xl mx-auto px-5 py-8">
        <Link
          to="/tools"
          className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
          返回工具
        </Link>

        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-10 h-10 rounded-xl bg-[#F5F5F5] border border-[#EEEEEE] text-ink-2 flex items-center justify-center">
            <PhoneCall className="w-[18px] h-[18px]" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-ink tracking-lux">AI 电话外呼</h1>
            <p className="text-xs text-ink-3 mt-0.5">DeepSeek 生成话术 · 阿里云线路外呼 · 仅管理员可用</p>
          </div>
        </div>

        {/* 配置状态 */}
        <div className="card p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-ink tracking-lux">服务配置</h2>
            <button
              onClick={() => {
                void loadStatus();
                void loadTasks();
              }}
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-ink-3 hover:text-ink transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.75} />
              刷新
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-line">
              <div>
                <p className="text-sm text-ink">DeepSeek 对话模型</p>
                <p className="text-xs text-ink-4 mt-0.5">{status?.deepseekModel || 'deepseek-chat'}</p>
              </div>
              <span
                className={`text-[11px] font-bold tracking-wider px-2 py-1 rounded-full ${
                  status?.deepseekConfigured ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
                }`}
              >
                {status?.deepseekConfigured ? '已配置' : '未配置'}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-line">
              <div>
                <p className="text-sm text-ink">阿里云外呼线路</p>
                <p className="text-xs text-ink-4 mt-0.5">
                  {status?.aliyunConfigured
                    ? `${status.aliyunAction} · ${status.aliyunCallerNumber}`
                    : '待企业实名 + 号码报备后配置'}
                </p>
              </div>
              <span
                className={`text-[11px] font-bold tracking-wider px-2 py-1 rounded-full ${
                  status?.aliyunConfigured ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
                }`}
              >
                {status?.aliyunConfigured ? '已配置' : '未配置'}
              </span>
            </div>
          </div>
        </div>

        {/* 话术生成 */}
        <div className="card p-5 mb-4">
          <h2 className="text-sm font-medium text-ink tracking-lux mb-3">1. AI 生成外呼话术</h2>
          <textarea
            value={requirement}
            onChange={(e) => setRequirement(e.target.value)}
            placeholder="例如：通知骑手明天上午 9 点到站点开晨会，请准时参加，迟到扣绩效。"
            rows={3}
            className="w-full px-3 py-2.5 border border-line rounded-xl text-sm text-ink outline-none focus:border-ink-4 transition-colors resize-y"
          />
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-ink-4">模型：{status?.deepseekModel || 'deepseek-chat'}</span>
            <button
              onClick={() => void generateScript()}
              disabled={generating}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-ink text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />
              ) : (
                <Sparkles className="w-4 h-4" strokeWidth={1.75} />
              )}
              生成话术
            </button>
          </div>
          <textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder="生成的话术会出现在这里，也可以手动编辑"
            rows={5}
            className="w-full mt-3 px-3 py-2.5 border border-line rounded-xl text-sm text-ink outline-none focus:border-ink-4 transition-colors resize-y"
          />
        </div>

        {/* 发起外呼 */}
        <div className="card p-5 mb-4">
          <h2 className="text-sm font-medium text-ink tracking-lux mb-3">2. 发起外呼</h2>
          <textarea
            value={numbersText}
            onChange={(e) => setNumbersText(e.target.value)}
            placeholder={'每行一个手机号，支持逗号/空格分隔，自动去重\n13800000000\n13900000000'}
            rows={4}
            className="w-full px-3 py-2.5 border border-line rounded-xl text-sm text-ink outline-none focus:border-ink-4 transition-colors resize-y font-mono"
          />
          <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
            <div className="flex items-center gap-4">
              <span className="text-xs text-ink-3">有效号码：{validNumbers.length} 个</span>
              <label className="inline-flex items-center gap-2 text-xs text-ink-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                  className="accent-black"
                />
                演练模式（不真实拨打）
              </label>
            </div>
            <button
              onClick={() => void submitTask()}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gold text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />
              ) : (
                <PhoneCall className="w-4 h-4" strokeWidth={1.75} />
              )}
              发起外呼
            </button>
          </div>
          {!status?.aliyunConfigured && (
            <p className="flex items-start gap-1.5 text-xs text-amber-600 mt-3 leading-relaxed">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" strokeWidth={1.75} />
              阿里云外呼线路未配置，当前只能创建演练任务。开通指引见 docs/ai-call/README.md。
            </p>
          )}
        </div>

        {message && (
          <div
            className={`px-4 py-3 rounded-xl text-sm mb-4 ${
              message.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* 任务列表 */}
        <div className="card p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <ListChecks className="w-4 h-4 text-ink-3" strokeWidth={1.75} />
            <h2 className="text-sm font-medium text-ink tracking-lux">外呼任务记录</h2>
          </div>
          {tasks.length === 0 ? (
            <p className="text-xs text-ink-4 py-4 text-center">暂无任务</p>
          ) : (
            <div className="space-y-2.5">
              {tasks.map((task) => (
                <div key={task.id} className="px-4 py-3 rounded-xl border border-line">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-ink-3">
                      {new Date(task.createdAt).toLocaleString('zh-CN')}
                    </span>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#F5F5F5] text-ink-2">
                      {STATUS_LABELS[task.status] || task.status}
                    </span>
                  </div>
                  <p className="text-sm text-ink mt-1.5 line-clamp-2">{task.script}</p>
                  <p className="text-xs text-ink-4 mt-1">
                    {task.numbers.length} 个号码
                    {task.results && task.results.length > 0 && task.results[0].message
                      ? ` · ${task.results[0].message}`
                      : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 合规提示 */}
        <div className="card p-5">
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-ink-3 mt-0.5 shrink-0" strokeWidth={1.75} />
            <p className="text-xs text-ink-3 leading-relaxed">
              合规提示：商业营销外呼需提前报备号码与话术模板；禁止对非同意用户进行骚扰性或诈骗性外呼。
              阿里云线路要求企业实名认证并完成号码报备，个人账号通常无法开通。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
