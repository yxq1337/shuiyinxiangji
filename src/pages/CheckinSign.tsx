import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, Loader2, MapPin } from 'lucide-react';
import { CheckinEventSummary, CheckinPerson, getPublicCheckin, parseRealName, signCheckin } from '../lib/checkin';

export default function CheckinSign() {
  const { code = '' } = useParams();
  const [event, setEvent] = useState<CheckinEventSummary | null>(null);
  const [loadError, setLoadError] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [done, setDone] = useState<CheckinPerson | null>(null);
  const inWechat = typeof navigator !== 'undefined' && /MicroMessenger/i.test(navigator.userAgent);

  useEffect(() => {
    let stop = false;
    getPublicCheckin(code)
      .then((data) => {
        if (stop) return;
        setEvent(data);
        document.title = `${data.title} · 签到`;
      })
      .catch((err: unknown) => {
        if (!stop) setLoadError(err instanceof Error ? err.message : '签到不存在');
      });
    return () => {
      stop = true;
    };
  }, [code]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event || submitting || event.status !== 'open') return;
    const realName = parseRealName(name);
    if (!realName) {
      setFailed(true);
      setMessage('请填写真实姓名，2 到 20 个汉字');
      return;
    }
    if (!navigator.geolocation) {
      setFailed(true);
      setMessage('当前微信或浏览器不支持定位，无法确认你是否在签到区域');
      return;
    }

    setSubmitting(true);
    setFailed(false);
    setMessage('正在获取位置…');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const result = await signCheckin(event.code, {
            realName,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
          if (!result.success || !result.record) {
            setFailed(true);
            setMessage(result.error || '签到失败');
            return;
          }
          setDone(result.record);
          setFailed(false);
          setMessage(result.already ? '该姓名已经签到' : '签到成功');
          setEvent((prev) => (prev && !result.already ? { ...prev, count: prev.count + 1 } : prev));
        } catch {
          setFailed(true);
          setMessage('签到请求失败，请检查网络后重试');
        } finally {
          setSubmitting(false);
        }
      },
      (err) => {
        setSubmitting(false);
        setFailed(true);
        setMessage(
          err.code === err.PERMISSION_DENIED
            ? inWechat
              ? '需要位置权限才能签到。请点右上角菜单，允许使用位置信息后重试'
              : '定位权限被拒绝，请在浏览器设置中允许位置权限'
            : '定位失败，请到空旷或窗边后重试'
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  return (
    <div className="min-h-screen bg-canvas">
      <div className="max-w-md mx-auto px-5 pt-8 pb-16">
        <div className="flex items-center gap-2 mb-8">
          <img src="/yaobox-icon.svg" alt="" className="w-7 h-7" />
          <span className="text-sm font-medium text-ink-2">YaoBox 扫描签到</span>
        </div>

        {loadError && (
          <div className="card p-6">
            <p role="alert" className="text-sm text-rose">{loadError}</p>
          </div>
        )}

        {!loadError && !event && <p className="text-sm text-ink-3">正在打开签到…</p>}

        {event && (
          <>
            <h1 className="text-2xl font-semibold text-ink tracking-lux">{event.title}</h1>
            <p className="mt-2 text-sm text-ink-3 leading-relaxed">
              {event.address ? `${event.address} · ` : ''}
              仅限签到点 {event.radiusMeters} 米内。微信扫码后请填写本人真实姓名。
            </p>
            <p className="mt-2 text-xs text-ink-4">已有 {event.count} 人签到</p>

            {event.status !== 'open' && (
              <div className="card mt-6 p-5 text-sm text-ink-2">本次签到已结束。</div>
            )}

            {event.status === 'open' && !done && (
              <form onSubmit={submit} className="card mt-6 p-5">
                <label htmlFor="real-name" className="block text-sm font-medium text-ink">
                  真实姓名
                </label>
                <input
                  id="real-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={20}
                  autoComplete="name"
                  enterKeyHint="done"
                  placeholder="请输入真实姓名"
                  className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3.5 text-base text-ink outline-none focus:border-ink/30"
                />
                <p className="mt-2 text-xs text-ink-4 leading-relaxed">
                  {inWechat ? '你正在使用微信。' : '建议使用微信扫码打开。'}
                  签到时会读取当前位置，区域外无法提交。
                </p>
                {message && (
                  <p role="alert" className={`mt-3 text-sm ${failed ? 'text-rose' : 'text-ink-3'}`}>
                    {message}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary mt-4 w-full py-3.5 text-base disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" strokeWidth={1.75} />}
                  {submitting ? '正在签到…' : '定位并签到'}
                </button>
              </form>
            )}

            {done && (
              <div className="card mt-6 p-6">
                <div className="w-11 h-11 rounded-full bg-eco-soft text-eco flex items-center justify-center">
                  <Check className="w-5 h-5" strokeWidth={1.75} />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-ink">{message || '签到成功'}</h2>
                <p className="mt-1 text-sm text-ink-2">{done.realName}</p>
                <p className="mt-1 text-xs text-ink-4">
                  距离签到点 {done.distanceMeters} 米
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
