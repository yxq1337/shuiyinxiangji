import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Eye, Clock, Flag, Phone, X, AlertTriangle,
  ShieldCheck, Battery, Briefcase, Bike, HelpCircle, Copy, Check,
} from 'lucide-react';
import {
  getListing,
  revealContact,
  reportListing,
  getCategoryMeta,
  formatPrice,
  daysLeft,
  TRANSACTION_TIPS,
  type CommunityListing,
  type CommunityCategory,
} from '../lib/community';
import { useAuth } from '../contexts/AuthContext';

const CATEGORY_ICONS: Record<CommunityCategory, React.ReactNode> = {
  battery: <Battery className="w-4 h-4" />,
  job: <Briefcase className="w-4 h-4" />,
  usedcar: <Bike className="w-4 h-4" />,
  help: <HelpCircle className="w-4 h-4" />,
};

const REPORT_REASONS = [
  '虚假信息',
  '价格欺诈',
  '联系方式无效',
  '涉黄涉赌涉毒',
  '冒充官方/诈骗',
  '违禁品',
  '其他',
];

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === undefined || value === null || value === '' || value === false) return null;
  return (
    <div className="flex py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500 w-24 flex-shrink-0">{label}</span>
      <span className="text-sm text-gray-900 font-medium flex-1">{
        typeof value === 'boolean' ? (value ? '是' : '否') : value
      }</span>
    </div>
  );
}

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [listing, setListing] = useState<CommunityListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealedContact, setRevealedContact] = useState<string>('');
  const [revealing, setRevealing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetail, setReportDetail] = useState('');
  const [reporting, setReporting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadListing();
  }, [id]);

  async function loadListing() {
    setLoading(true);
    try {
      const data = await getListing(id!);
      setListing(data);
    } catch (e) {
      console.error('加载失败', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleReveal() {
    setRevealing(true);
    try {
      const res = await revealContact(id!);
      setRevealedContact(res.contact);
      if (listing) {
        setListing({ ...listing, contactRevealCount: listing.contactRevealCount + 1 });
      }
    } catch (e: any) {
      alert(e.message || '获取联系方式失败');
    } finally {
      setRevealing(false);
    }
  }

  async function handleReport() {
    if (!reportReason) return alert('请选择举报原因');
    setReporting(true);
    try {
      const reason = reportDetail ? `${reportReason}：${reportDetail}` : reportReason;
      await reportListing(id!, { reason, reporterId: user?.id, reporterPhone: user?.phone });
      setReportSuccess(true);
      setTimeout(() => { setShowReport(false); setReportSuccess(false); setReportReason(''); setReportDetail(''); }, 1500);
    } catch (e: any) {
      alert(e.message || '举报失败');
    } finally {
      setReporting(false);
    }
  }

  function copyContact() {
    if (!revealedContact) return;
    navigator.clipboard?.writeText(revealedContact).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">加载中...</div>;
  }

  if (!listing) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <p className="text-gray-500 mb-4">信息不存在或已下架</p>
        <button onClick={() => navigate('/community')} className="text-blue-600 text-sm font-medium">返回社区</button>
      </div>
    );
  }

  const meta = getCategoryMeta(listing.category);
  const left = daysLeft(listing.expiresAt);
  const e = listing.extra || {};

  return (
    <div className="flex-1 bg-transparent pb-8">
      <div className="max-w-2xl mx-auto px-4 pt-4">
        {/* 顶部 */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate('/community')} className="text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">返回</span>
          </button>
          <button
            onClick={() => setShowReport(true)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500 px-2.5 py-1.5 rounded-full hover:bg-red-50 transition-colors"
          >
            <Flag className="w-4 h-4" />
            举报
          </button>
        </div>

        {/* 标题区 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${meta.bgColor} ${meta.color}`}>
              {CATEGORY_ICONS[listing.category]}
              {meta.label}
            </span>
            {left != null && left > 0 && (
              <span className="text-xs text-gray-400 flex items-center gap-0.5">
                <Clock className="w-3 h-3" /> 剩 {left} 天下架
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">{listing.title}</h1>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            {listing.city && (
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {listing.city}{listing.area ? ` · ${listing.area}` : ''}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Eye className="w-4 h-4" />
              {listing.viewCount} 浏览
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100">
            <span className="text-2xl font-bold text-red-500">{formatPrice(listing.price, listing.category)}</span>
          </div>
        </div>

        {/* 详细信息 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mt-3">
          <h2 className="text-sm font-semibold text-gray-800 mb-2">详细描述</h2>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {listing.description || '暂无描述'}
          </p>

          {/* 分类专属字段 */}
          {(listing.category === 'battery' || listing.category === 'job' || listing.category === 'usedcar') && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800 mb-1">
                {listing.category === 'battery' && '电池信息'}
                {listing.category === 'job' && '招聘信息'}
                {listing.category === 'usedcar' && '车辆信息'}
              </h3>
              {listing.category === 'battery' && (
                <div>
                  <FieldRow label="品牌" value={e.brand} />
                  <FieldRow label="容量" value={e.capacity} />
                  <FieldRow label="月租" value={e.monthlyRent ? `¥${e.monthlyRent}/月` : undefined} />
                  <FieldRow label="押金" value={e.deposit ? `¥${e.deposit}` : undefined} />
                  <FieldRow label="支持换电" value={e.swappable} />
                  <FieldRow label="覆盖区域" value={e.coverageArea} />
                </div>
              )}
              {listing.category === 'job' && (
                <div>
                  <FieldRow label="平台" value={e.platform} />
                  <FieldRow label="用工类型" value={e.jobType} />
                  <FieldRow label="单价" value={e.unitPrice ? `¥${e.unitPrice}/单` : undefined} />
                  <FieldRow label="要求" value={e.requirements} />
                </div>
              )}
              {listing.category === 'usedcar' && (
                <div>
                  <FieldRow label="品牌" value={e.brand} />
                  <FieldRow label="车龄" value={e.carAge != null ? `${e.carAge} 年` : undefined} />
                  <FieldRow label="电池状况" value={e.batteryCondition} />
                  <FieldRow label="有手续" value={e.hasDocuments} />
                  <FieldRow label="有牌照" value={e.hasPlate} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* 联系方式 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mt-3">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">联系方式</h2>
          {revealedContact ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                <p className="text-xs text-green-700 mb-0.5">联系方式（已查看 {listing.contactRevealCount} 次）</p>
                <p className="text-lg font-bold text-green-800 tracking-wide">{revealedContact}</p>
              </div>
              <button
                onClick={copyContact}
                className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? '已复制' : '复制'}
              </button>
            </div>
          ) : (
            <button
              onClick={handleReveal}
              disabled={revealing}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              <Phone className="w-5 h-5" />
              {revealing ? '获取中...' : `点击查看联系方式（${listing.contact}）`}
            </button>
          )}
          <p className="text-[11px] text-gray-400 mt-2 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            联系方式点击后显示，便于记录并防止爬虫批量抓取
          </p>
        </div>

        {/* 交易提示 */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-3">
          <h3 className="text-sm font-semibold text-amber-900 flex items-center gap-1.5 mb-2">
            <AlertTriangle className="w-4 h-4" />
            交易提示（防骗必读）
          </h3>
          <ul className="space-y-1.5">
            {TRANSACTION_TIPS.map((tip, i) => (
              <li key={i} className="text-xs text-amber-800 flex items-start gap-1.5">
                <span className="text-amber-500 mt-0.5">•</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>

        {/* 免责声明 */}
        <div className="text-center mt-4">
          <p className="text-[11px] text-gray-400 leading-relaxed">
            本平台仅提供信息展示服务，不参与交易，不担保信息真实性。<br />
            交易风险由用户自行承担，如遇诈骗请立即举报并报警。
          </p>
        </div>
      </div>

      {/* 举报弹窗 */}
      {showReport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4" onClick={() => setShowReport(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            {reportSuccess ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <p className="text-gray-900 font-medium">举报已提交</p>
                <p className="text-sm text-gray-500 mt-1">我们会尽快处理，感谢反馈</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">举报信息</h3>
                  <button onClick={() => setShowReport(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mb-3">请选择举报原因（多选请在补充说明中描述）</p>
                <div className="space-y-2 mb-4">
                  {REPORT_REASONS.map((r) => (
                    <button
                      key={r}
                      onClick={() => setReportReason(r)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-sm border transition-colors ${
                        reportReason === r ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-100 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <textarea
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm resize-none min-h-[70px] outline-none focus:border-red-300"
                  value={reportDetail}
                  onChange={(e) => setReportDetail(e.target.value)}
                  placeholder="补充说明（选填）"
                />
                <button
                  onClick={handleReport}
                  disabled={reporting || !reportReason}
                  className="w-full mt-4 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 disabled:opacity-50"
                >
                  {reporting ? '提交中...' : '提交举报'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
