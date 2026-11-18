import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Copy, Loader2, MapPin, QrCode } from 'lucide-react';
import { toDataURL } from 'qrcode';
import { useAuth } from '../contexts/AuthContext';
import {
  CheckinEventSummary,
  CheckinPerson,
  closeCheckin,
  createCheckinEvent,
  getCheckinRoster,
  listMyCheckins,
} from '../lib/checkin';
import { apiGet } from '../lib/api';

const RADII = [100, 200, 500, 1000, 2000];

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function CheckinManage() {
  const { user, isLoading } = useAuth();
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [radius, setRadius] = useState(200);
  const [center, setCenter] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateMsg, setLocateMsg] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [events, setEvents] = useState<CheckinEventSummary[]>([]);
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [people, setPeople] = useState<CheckinPerson[]>([]);
  const [rosterReady, setRosterReady] = useState(false);
  const [rosterError, setRosterError] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [copied, setCopied] = useState<'link' | 'list' | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    document.title = '晨会签到';
  }, []);

  useEffect(() => {
    if (!user) return;
    let stop = false;
    listMyCheckins(user.id)
      .then((list) => {
        if (stop) return;
        setEvents(list);
        setActiveCode((current) => current || list[0]?.code || null);
      })
      .catch(() => {
        if (!stop) setFormError('签到列表加载失败');
      });
    return () => {
      stop = true;
    };
  }, [user]);

  const active = useMemo(
    () => events.find((item) => item.code === activeCode) || null,
    [events, activeCode]
  );

  const signLink = active ? `${window.location.origin}/checkin/${active.code}` : '';

  useEffect(() => {
    if (!signLink) {
      setQrUrl('');
      return;
    }
    let stop = false;
    toDataURL(signLink, {
      margin: 1,
      width: 280,
      color: { dark: '#1a1a1a', light: '#ffffff' },
    }).then((url) => {
      if (!stop) setQrUrl(url);
    }).catch(() => {
      if (!stop) setQrUrl('');
    });
    return () => {
      stop = true;
    };
  }, [signLink]);

  useEffect(() => {
    if (!user || !activeCode) return;
    let stop = false;
    setRosterReady(false);
    const load = () => {
      getCheckinRoster(activeCode, user.id)
        .then((data) => {
          if (stop) return;
          setPeople(data.records);
          setRosterReady(true);
          setRosterError('');
          setEvents((prev) => prev.map((item) => (item.code === data.event.code ? { ...item, ...data.event } : item)));
        })
        .catch((err: unknown) => {
          if (!stop) {
            setRosterReady(true);
            setRosterError(err instanceof Error ? err.message : '统计加载失败');
          }
        });
    };
    load();
    const timer = window.setInterval(load, 8000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [user, activeCode]);

  const locate = () => {
    if (locating) return;
    if (!navigator.geolocation) {
      setLocateMsg('当前浏览器不支持定位');
      return;
    }
    setLocating(true);
    setLocateMsg('正在获取当前位置…');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;
        setCenter({ latitude, longitude });
        setLocateMsg('已把当前位置设为签到中心');
        setLocating(false);
        try {
          const res = await apiGet<{ success: boolean; data?: { address: string } }>(
            `/api/geo/reverse?latitude=${latitude}&longitude=${longitude}`
          );
          if (res.success && res.data?.address) setAddress(res.data.address);
        } catch {
          // 逆地址失败时仍可手填区域名称
        }
      },
      (err) => {
        setLocating(false);
        setLocateMsg(
          err.code === err.PERMISSION_DENIED
            ? '定位权限被拒绝，请允许浏览器使用位置'
            : '定位失败，请到信号较好的地方重试'
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || creating) return;
    setFormError('');
    const name = title.trim();
    if (!name) {
      setFormError('请填写签到名称');
      return;
    }
    if (!center) {
      setFormError('请先定位，设置允许签到的区域');
      return;
    }
    setCreating(true);
    try {
      const event = await createCheckinEvent({
        title: name,
        address: address.trim(),
        latitude: center.latitude,
        longitude: center.longitude,
        radiusMeters: radius,
        ownerId: user.id,
        ownerPhone: user.phone,
      });
      setEvents((prev) => [event, ...prev.filter((item) => item.code !== event.code)]);
      setActiveCode(event.code);
      setPeople([]);
      setTitle('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setCreating(false);
    }
  };

  const copyText = async (text: string, kind: 'link' | 'list') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setFormError('复制失败，请长按链接手动复制');
    }
  };

  const endEvent = async () => {
    if (!user || !active || active.status !== 'open' || closing) return;
    if (!window.confirm(`结束「${active.title}」后，将不能再签到。已签到的名单仍会保留。`)) return;
    setClosing(true);
    try {
      await closeCheckin(active.code, user.id);
      setEvents((prev) => prev.map((item) => (item.code === active.code ? { ...item, status: 'closed' } : item)));
    } catch (err) {
      setRosterError(err instanceof Error ? err.message : '结束失败');
    } finally {
      setClosing(false);
    }
  };

  if (isLoading) return null;

  if (!user) {
    return (
      <div className="flex-1">
        <div className="max-w-lg mx-auto px-5 py-10">
          <Link to="/tools" className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink mb-6">
            <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
            返回工具
          </Link>
          <div className="card p-6">
            <h1 className="text-lg font-semibold text-ink tracking-lux">晨会签到</h1>
            <p className="text-sm text-ink-3 mt-2 leading-relaxed">
              登录后可以划定签到区域、生成微信扫码，并查看填写了真实姓名的到场人员。
            </p>
            <Link to="/login" state={{ from: '/tool/checkin' }} className="btn-primary mt-5 px-5 py-2.5 text-sm">
              登录后创建
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const localOnly = signLink.startsWith('http://localhost') || signLink.startsWith('http://127.');

  return (
    <div className="flex-1">
      <div className="max-w-3xl mx-auto px-5 py-8">
        <Link to="/tools" className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink mb-6">
          <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
          返回工具
        </Link>

        <form onSubmit={create} className="card p-6 mb-5">
          <div className="flex items-center gap-2 mb-1">
            <QrCode className="w-4 h-4 text-ink-2" strokeWidth={1.75} />
            <h1 className="text-lg font-semibold text-ink tracking-lux">晨会签到</h1>
          </div>
          <p className="text-sm text-ink-3 mb-5 leading-relaxed">
            先定位签到中心并设置半径。微信扫码后必须填写真实姓名，人在区域外无法签到。
          </p>

          <label className="block text-sm font-medium text-ink mb-1.5" htmlFor="checkin-title">
            签到名称
          </label>
          <input
            id="checkin-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={40}
            placeholder="例如：周一晨会"
            className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-sm text-ink outline-none focus:border-ink/30"
          />

          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-ink">签到区域</span>
            <button
              type="button"
              onClick={locate}
              disabled={locating}
              className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink disabled:opacity-50"
            >
              {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" strokeWidth={1.75} />}
              {center ? '重新定位' : '定位当前位置'}
            </button>
          </div>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            maxLength={80}
            placeholder="区域名称，例如：一楼大厅"
            className="mt-2 w-full rounded-xl border border-line bg-white px-3.5 py-3 text-sm text-ink outline-none focus:border-ink/30"
          />
          <p className={`mt-2 text-xs ${center ? 'text-eco' : 'text-ink-4'}`}>
            {locateMsg || (center ? '已设置签到中心' : '尚未设置签到中心，区域外的人无法签到')}
          </p>

          <p className="mt-4 text-sm font-medium text-ink mb-2">允许半径</p>
          <div className="flex flex-wrap gap-2">
            {RADII.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setRadius(item)}
                className={`px-3 py-1.5 rounded-full text-sm border ${
                  radius === item ? 'bg-brand text-white border-brand' : 'border-line text-ink-2'
                }`}
              >
                {item >= 1000 ? `${item / 1000} 公里` : `${item} 米`}
              </button>
            ))}
          </div>

          {formError && (
            <p role="alert" className="mt-4 text-sm text-rose">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={creating || !center}
            className="btn-primary mt-5 w-full py-3 text-sm disabled:opacity-50"
          >
            {creating ? '正在创建…' : '生成签到二维码'}
          </button>
        </form>

        {events.length > 0 && (
          <div className="card p-6 mb-5">
            <h2 className="text-sm font-medium text-ink mb-3">我的签到</h2>
            <div className="flex flex-col gap-2">
              {events.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => setActiveCode(item.code)}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left ${
                    item.code === activeCode ? 'border-ink bg-brand-soft' : 'border-line'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink truncate">{item.title}</span>
                    <span className="block text-xs text-ink-3 mt-0.5">
                      {item.radiusMeters} 米内 · {item.status === 'open' ? '进行中' : '已结束'}
                    </span>
                  </span>
                  <span className="text-sm font-semibold text-ink shrink-0">{item.count} 人</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {active && (
          <div className="card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-ink">{active.title}</h2>
                <p className="text-xs text-ink-3 mt-1">
                  {active.address || '未填写区域名称'} · {active.radiusMeters} 米内
                  {active.status === 'closed' ? ' · 已结束' : ''}
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-semibold text-ink leading-none">{people.length || active.count}</div>
                <div className="text-[11px] text-ink-3 mt-1">已签到</div>
              </div>
            </div>

            {active.status === 'open' && qrUrl && (
              <div className="mt-5 flex flex-col items-center">
                <img src={qrUrl} alt={`${active.title}签到二维码`} className="w-52 h-52 rounded-xl border border-line" />
                <p className="mt-3 text-xs text-ink-3 text-center leading-relaxed max-w-sm">
                  {localOnly
                    ? '当前二维码指向本机，手机微信打不开。部署到线上后，微信扫码即可填写真实姓名并签到。'
                    : '用微信扫一扫。对方必须填写真实姓名，并且人在上面的区域内才能签到。'}
                </p>
                <button
                  type="button"
                  onClick={() => copyText(signLink, 'link')}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink"
                >
                  {copied === 'link' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied === 'link' ? '链接已复制' : '复制签到链接'}
                </button>
                <p className="mt-2 text-[11px] text-ink-4 break-all text-center">{signLink}</p>
              </div>
            )}

            <div className="mt-6 flex items-center justify-between">
              <h3 className="text-sm font-medium text-ink">签到人员</h3>
              <div className="flex items-center gap-3">
                {people.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const lines = [`${active.title} 签到名单（${people.length}人）`];
                      people.forEach((person, index) => {
                        lines.push(`${index + 1}. ${person.realName}  ${formatWhen(person.createdAt)}  ${person.distanceMeters}米`);
                      });
                      copyText(lines.join('\n'), 'list');
                    }}
                    className="text-xs text-ink-2 hover:text-ink"
                  >
                    {copied === 'list' ? '名单已复制' : '复制名单'}
                  </button>
                )}
                {active.status === 'open' && (
                  <button type="button" onClick={endEvent} disabled={closing} className="text-xs text-ink-3 hover:text-ink">
                    {closing ? '正在结束…' : '结束签到'}
                  </button>
                )}
              </div>
            </div>

            {rosterError && (
              <p role="alert" className="mt-3 text-sm text-rose">
                {rosterError}
              </p>
            )}

            {!rosterReady ? (
              <p className="mt-4 text-sm text-ink-4">正在读取签到名单…</p>
            ) : people.length === 0 ? (
              <p className="mt-4 text-sm text-ink-4">还没有人签到。名单会自动刷新。</p>
            ) : (
              <ul className="mt-2">
                {people.map((person, index) => (
                  <li key={`${person.realName}-${person.createdAt}`} className="flex items-center justify-between gap-3 py-3 border-b border-line last:border-b-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">
                        {index + 1}. {person.realName}
                      </p>
                      <p className="text-xs text-ink-3 mt-0.5">{formatWhen(person.createdAt)}</p>
                    </div>
                    <span className="text-xs text-ink-3 shrink-0">距中心 {person.distanceMeters} 米</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
