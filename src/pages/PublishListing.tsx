import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Battery, Briefcase, Bike, HelpCircle, AlertTriangle, CheckCircle, Shield } from 'lucide-react';
import {
  createListing,
  CATEGORIES,
  PROHIBITED_LIST,
  type CommunityCategory,
  type ListingExtra,
} from '../lib/community';
import { useAuth } from '../contexts/AuthContext';

const CATEGORY_ICONS: Record<CommunityCategory, React.ReactNode> = {
  battery: <Battery className="w-5 h-5" />,
  job: <Briefcase className="w-5 h-5" />,
  usedcar: <Bike className="w-5 h-5" />,
  help: <HelpCircle className="w-5 h-5" />,
};

const PLATFORMS = ['美团', '饿了么', '众包', '其他'] as const;
const BATTERY_CONDITIONS = ['全新', '良好', '一般', '需更换'];

const inputCls = 'w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm';
const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5';

export default function PublishListing() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const initialCategory = (location.state as any)?.category as CommunityCategory | undefined;
  const [category, setCategory] = useState<CommunityCategory>(initialCategory || 'battery');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [contact, setContact] = useState(user?.phone || '');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 分类专属字段
  const [extra, setExtra] = useState<ListingExtra>({});

  const updateExtra = (key: string, value: any) => setExtra((prev) => ({ ...prev, [key]: value }));

  const pricePlaceholder = category === 'battery' ? '月租金额（元/月）' : category === 'job' ? '单价（元/单），没有填0' : '转让价格（元）';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    if (!title.trim()) { setErrorMsg('请填写标题'); return; }
    if (!contact.trim()) { setErrorMsg('请填写联系方式'); return; }
    if (!agreed) { setErrorMsg('请先勾选并同意禁发清单与免责声明'); return; }

    setSubmitting(true);
    try {
      const payload: any = {
        category,
        title: title.trim(),
        description: description.trim(),
        city: '',
        area: '',
        price: Number(price) || 0,
        contact: contact.trim(),
        extra,
        userId: user?.id,
        userPhone: user?.phone,
      };
      const res = await createListing(payload);
      if (res.success) {
        setSuccess(true);
        setTimeout(() => navigate('/community'), 2000);
      } else {
        setErrorMsg('发布失败，请稍后重试');
      }
    } catch (err: any) {
      setErrorMsg(err.message || '网络异常，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full shadow-sm border border-gray-200">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">提交成功</h2>
          <p className="text-sm text-gray-500 mb-4">信息已提交，将在人工审核通过后展示（通常 24 小时内）</p>
          <p className="text-xs text-gray-400">2 秒后返回社区...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-transparent pb-8">
      <div className="max-w-2xl mx-auto px-4 pt-4">
        {/* 顶部 */}
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navigate('/community')} className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">发布信息</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 分类选择 */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <label className={labelCls}>选择板块</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => { setCategory(cat.key); setExtra({}); }}
                  className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                    category === cat.key
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <span className={cat.color}>{CATEGORY_ICONS[cat.key]}</span>
                  <span className="text-sm font-medium text-gray-800">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 通用字段 */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-4">
            <div>
              <label className={labelCls}>标题 <span className="text-red-500">*</span></label>
              <input
                className={inputCls}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="一句话描述，如：星恒锂电池出租，支持换电"
                maxLength={40}
                required
              />
            </div>

            <div>
              <label className={labelCls}>详细描述</label>
              <textarea
                className={inputCls + ' min-h-[90px] resize-none'}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="补充说明，如使用时长、新旧程度、交易方式等"
                maxLength={500}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>价格</label>
                <input
                  type="number"
                  className={inputCls}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder={pricePlaceholder}
                  min="0"
                />
              </div>
              <div>
                <label className={labelCls}>联系方式 <span className="text-red-500">*</span></label>
                <input
                  className={inputCls}
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="手机号 / 微信号"
                  required
                />
              </div>
            </div>
          </div>

          {/* 分类专属字段 */}
          {category === 'battery' && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <Battery className="w-4 h-4 text-emerald-600" /> 租电信息
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>品牌</label>
                  <input className={inputCls} value={(extra as any).brand || ''} onChange={(e) => updateExtra('brand', e.target.value)} placeholder="如 星恒、天能" />
                </div>
                <div>
                  <label className={labelCls}>容量</label>
                  <input className={inputCls} value={(extra as any).capacity || ''} onChange={(e) => updateExtra('capacity', e.target.value)} placeholder="如 48V20Ah" />
                </div>
                <div>
                  <label className={labelCls}>月租（元）</label>
                  <input type="number" className={inputCls} value={(extra as any).monthlyRent || ''} onChange={(e) => updateExtra('monthlyRent', Number(e.target.value))} placeholder="月租金" />
                </div>
                <div>
                  <label className={labelCls}>押金（元）</label>
                  <input type="number" className={inputCls} value={(extra as any).deposit || ''} onChange={(e) => updateExtra('deposit', Number(e.target.value))} placeholder="押金金额" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={!!(extra as any).swappable} onChange={(e) => updateExtra('swappable', e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                支持换电
              </label>
              <div>
                <label className={labelCls}>覆盖区域</label>
                <input className={inputCls} value={(extra as any).coverageArea || ''} onChange={(e) => updateExtra('coverageArea', e.target.value)} placeholder="如 浦东新区、徐汇区" />
              </div>
            </div>
          )}

          {category === 'job' && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-orange-600" /> 招聘信息
              </h3>
              <div>
                <label className={labelCls}>平台 <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-4 gap-2">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => updateExtra('platform', p)}
                      className={`py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                        (extra as any).platform === p ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-100 text-gray-600'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>用工类型</label>
                  <input className={inputCls} value={(extra as any).jobType || ''} onChange={(e) => updateExtra('jobType', e.target.value)} placeholder="如 专送/众包/兼职" />
                </div>
                <div>
                  <label className={labelCls}>单价（元/单）</label>
                  <input type="number" className={inputCls} value={(extra as any).unitPrice || ''} onChange={(e) => updateExtra('unitPrice', Number(e.target.value))} placeholder="每单价格" />
                </div>
              </div>
              <div>
                <label className={labelCls}>招聘要求</label>
                <textarea className={inputCls + ' min-h-[70px] resize-none'} value={(extra as any).requirements || ''} onChange={(e) => updateExtra('requirements', e.target.value)} placeholder="如 会骑电动车，身体健康，年龄18-50岁" />
              </div>
            </div>
          )}

          {category === 'usedcar' && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <Bike className="w-4 h-4 text-blue-600" /> 车辆信息
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>品牌</label>
                  <input className={inputCls} value={(extra as any).brand || ''} onChange={(e) => updateExtra('brand', e.target.value)} placeholder="如 雅迪、爱玛" />
                </div>
                <div>
                  <label className={labelCls}>车龄（年）</label>
                  <input type="number" className={inputCls} value={(extra as any).carAge || ''} onChange={(e) => updateExtra('carAge', Number(e.target.value))} placeholder="使用年限" min="0" step="0.5" />
                </div>
              </div>
              <div>
                <label className={labelCls}>电池状况</label>
                <div className="grid grid-cols-4 gap-2">
                  {BATTERY_CONDITIONS.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => updateExtra('batteryCondition', b)}
                      className={`py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                        (extra as any).batteryCondition === b ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-100 text-gray-600'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                  <input type="checkbox" checked={!!(extra as any).hasDocuments} onChange={(e) => updateExtra('hasDocuments', e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                  有手续（发票/合格证）
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                  <input type="checkbox" checked={!!(extra as any).hasPlate} onChange={(e) => updateExtra('hasPlate', e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                  有牌照
                </label>
              </div>
            </div>
          )}

          {category === 'help' && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-purple-600" /> 互助信息
              </h3>
              <div>
                <label className={labelCls}>求助类型</label>
                <input className={inputCls} value={(extra as any).helpType || ''} onChange={(e) => updateExtra('helpType', e.target.value)} placeholder="如 找换电柜、问路、求助" />
              </div>
            </div>
          )}

          {/* 禁发清单 & 免责声明 */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-amber-900">禁发清单 & 免责声明</h3>
                <p className="text-xs text-amber-700 mt-1">发布前请确认不包含以下内容：</p>
              </div>
            </div>
            <ul className="space-y-1 mb-3 ml-7">
              {PROHIBITED_LIST.map((item, i) => (
                <li key={i} className="text-xs text-amber-800 flex items-start gap-1">
                  <span className="text-amber-500">•</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-xs text-amber-700 leading-relaxed">
              本平台仅展示信息，不参与交易、不担保信息真实性。信息发布后需人工审核，审核通过后展示 15 天自动下架。
              违规信息将被删除并可能封号。
            </p>
            <label className="flex items-start gap-2 mt-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="w-4 h-4 rounded border-amber-300 text-amber-600 mt-0.5"
              />
              <span className="text-xs text-amber-900">我已阅读并同意以上规则，承诺信息真实有效</span>
            </label>
          </div>

          {/* 提交按钮 */}
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5 text-center">
              {errorMsg}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting || !agreed}
            className="w-full py-3.5 bg-[#246BFD] text-white rounded-xl font-semibold text-base hover:bg-[#1d57d4] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            <Shield className="w-5 h-5" />
            {submitting ? '提交中...' : '提交审核'}
          </button>
          <p className="text-center text-xs text-gray-400">提交后进入人工审核，通过后自动展示</p>
        </form>
      </div>
    </div>
  );
}
