import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Plus, ChevronDown, Battery, Briefcase, Bike, HelpCircle, Filter, Eye, Clock, X } from 'lucide-react';
import Reveal from '../components/Reveal';
import {
  listListings,
  CATEGORIES,
  getCategoryMeta,
  formatPrice,
  daysLeft,
  type CommunityListing,
  type CommunityCategory,
  type ListListingsParams,
} from '../lib/community';

const CATEGORY_ICONS: Record<CommunityCategory, React.ReactNode> = {
  battery: <Battery className="w-6 h-6" />,
  job: <Briefcase className="w-6 h-6" />,
  usedcar: <Bike className="w-6 h-6" />,
  help: <HelpCircle className="w-6 h-6" />,
};

/** 分类专属的关键信息标签 */
function getCategoryTags(listing: CommunityListing): string[] {
  const e = (listing.extra || {}) as Record<string, any>;
  switch (listing.category) {
    case 'battery':
      return [
        e.brand ? `${e.brand}` : '',
        e.capacity ? `${e.capacity}` : '',
        e.swappable ? '支持换电' : '',
      ].filter(Boolean);
    case 'job':
      return [e.platform || '', e.jobType || ''].filter(Boolean);
    case 'usedcar':
      return [
        e.brand || '',
        e.carAge != null ? `${e.carAge}年车龄` : '',
        e.hasPlate ? '有牌照' : '',
        e.hasDocs ? '手续齐全' : '',
      ].filter(Boolean);
    default:
      return [];
  }
}

function ListingCard({ listing }: { listing: CommunityListing }) {
  const navigate = useNavigate();
  const meta = getCategoryMeta(listing.category);
  const left = daysLeft(listing.expiresAt);
  const tags = useMemo(() => getCategoryTags(listing), [listing]);

  return (
    <div
      onClick={() => navigate(`/community/listing/${listing.id}`)}
      className="card card-press p-5 cursor-pointer"
    >
      {/* 第一行：类型标签 + 地区（左），价格（右） */}
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`px-2 py-0.5 rounded-lg text-[11px] font-medium ${meta.bgColor} ${meta.color} flex-shrink-0`}>
            {meta.label}
          </span>
          {listing.city && (
            <span className="text-xs text-ink-3 flex items-center gap-0.5 min-w-0">
              <MapPin className="w-3 h-3 flex-shrink-0" strokeWidth={1.75} />
              <span className="truncate">{listing.city}{listing.area ? `·${listing.area}` : ''}</span>
            </span>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xl font-bold text-rose leading-tight tracking-lux">{formatPrice(listing.price, listing.category)}</div>
        </div>
      </div>

      {/* 第二行：标题 + 缩略图 */}
      <div className="flex gap-3 mb-2">
        <h3 className="text-base font-medium text-ink line-clamp-2 flex-1 leading-snug tracking-lux">{listing.title}</h3>
        {listing.images && listing.images.length > 0 && (
          <img
            src={listing.images[0]}
            alt=""
            loading="lazy"
            className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
          />
        )}
      </div>

      {/* 第三行：关键信息标签 */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {tags.map((t, i) => (
            <span key={i} className="tag-soft">
              {t}
            </span>
          ))}
        </div>
      )}

      {/* 第四行：描述 */}
      <p className="text-sm text-ink-3 line-clamp-2 leading-relaxed mb-3">{listing.description}</p>

      {/* 第五行：浏览量 + 有效期 */}
      <div className="flex items-center gap-4 text-[11px] text-ink-4">
        <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" strokeWidth={1.75} />{listing.viewCount}</span>
        {left != null && (
          <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" strokeWidth={1.75} />剩{left}天</span>
        )}
      </div>
    </div>
  );
}

export default function Community() {
  const navigate = useNavigate();
  const [category, setCategory] = useState<CommunityCategory | ''>('');
  const [priceRange, setPriceRange] = useState<string>('');
  const [showFilter, setShowFilter] = useState(false);
  const [showPublishSheet, setShowPublishSheet] = useState(false);
  const [listings, setListings] = useState<CommunityListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadListings();
  }, [category, priceRange]);

  async function loadListings() {
    setLoading(true);
    try {
      const params: ListListingsParams = {};
      if (category) params.category = category;
      if (priceRange) {
        const [min, max] = priceRange.split('-').map(Number);
        if (!isNaN(min)) params.minPrice = min;
        if (!isNaN(max)) params.maxPrice = max;
      }
      const data = await listListings(params);
      setListings(data);
    } catch (e) {
      console.error('加载信息失败', e);
    } finally {
      setLoading(false);
    }
  }

  const priceRanges = [
    { label: '不限', value: '' },
    { label: '500以下', value: '0-500' },
    { label: '500-1000', value: '500-1000' },
    { label: '1000-2000', value: '1000-2000' },
    { label: '2000以上', value: '2000-999999' },
  ];

  const publishOptions: { key: CommunityCategory; label: string; desc: string; icon: React.ReactNode; color: string }[] = [
    { key: 'job', label: '招聘信息', desc: '发布骑手招聘岗位', icon: <Briefcase className="w-5 h-5" strokeWidth={1.75} />, color: 'text-amber-ink bg-amber-soft' },
    { key: 'battery', label: '电池租赁', desc: '发布电池出租信息', icon: <Battery className="w-5 h-5" strokeWidth={1.75} />, color: 'text-eco bg-eco-soft' },
    { key: 'usedcar', label: '二手车交易', desc: '发布电动车转让', icon: <Bike className="w-5 h-5" strokeWidth={1.75} />, color: 'text-slate-ink bg-slate-soft' },
    { key: 'help', label: '求助互助', desc: '发布求助或互助信息', icon: <HelpCircle className="w-5 h-5" strokeWidth={1.75} />, color: 'text-plum-ink bg-plum-soft' },
  ];

  return (
    <div className="flex-1 bg-transparent pb-24">
      <div className="max-w-6xl mx-auto px-4 pt-4">
        {/* 顶部标题 */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-[22px] font-semibold tracking-lux text-ink">嘉兴骑手社区</h1>
        </div>

        {/* 五宫格分类入口 */}
        <div className="card p-3.5 mb-3">
          <div className="grid grid-cols-5 gap-1">
            <button
              onClick={() => setCategory('')}
              className={`flex flex-col items-center gap-1 py-2 rounded-xl transition-colors ${
                category === '' ? 'bg-brand-soft' : 'hover:bg-brand-soft'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                category === '' ? 'bg-white text-ink' : 'bg-brand-soft text-ink-3'
              }`}>
                <span className="text-base">🏠</span>
              </div>
              <span className={`text-[11px] ${category === '' ? 'font-semibold text-ink' : 'font-medium text-ink-3'}`}>全部</span>
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setCategory(cat.key)}
                className={`flex flex-col items-center gap-1 py-2 rounded-xl transition-colors ${
                  category === cat.key ? 'bg-brand-soft' : 'hover:bg-brand-soft'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                  category === cat.key ? cat.bgColor + ' ' + cat.color : 'bg-brand-soft text-ink-3'
                }`}>
                  {CATEGORY_ICONS[cat.key]}
                </div>
                <span className={`text-[11px] ${category === cat.key ? 'font-semibold ' + cat.color : 'font-medium text-ink-3'}`}>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 筛选栏 */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-ink-3">
            共 <span className="font-semibold text-ink">{listings.length}</span> 条信息
          </span>
          <button
            onClick={() => setShowFilter(!showFilter)}
            className="card card-press flex items-center gap-1 px-3.5 py-1.5 text-xs font-medium text-ink-2"
          >
            <Filter className="w-3.5 h-3.5" strokeWidth={1.75} />
            价格
            <ChevronDown className={`w-3 h-3 transition-transform ${showFilter ? 'rotate-180' : ''}`} strokeWidth={1.75} />
          </button>
        </div>

        {/* 价格筛选展开 */}
        {showFilter && (
          <div className="card p-3.5 mb-3">
            <div className="flex flex-wrap gap-2">
              {priceRanges.map((r) => (
                <button
                  key={r.value}
                  onClick={() => { setPriceRange(r.value); setShowFilter(false); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    priceRange === r.value ? 'bg-brand text-white' : 'bg-brand-soft text-ink-2 hover:bg-line'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 列表 */}
        <div className="space-y-3.5">
          {loading ? (
            <div className="text-center py-12 text-ink-4 text-sm">加载中...</div>
          ) : listings.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-white rounded-full border border-line flex items-center justify-center mx-auto mb-3">
                <Bike className="w-7 h-7 text-ink-4" strokeWidth={1.5} />
              </div>
              <p className="text-ink-4 text-sm">暂无信息，点击右下角发布第一条吧</p>
            </div>
          ) : (
            listings.map((l, i) => (
              <Reveal key={l.id} delay={Math.min(i, 6) * 55}>
                <ListingCard listing={l} />
              </Reveal>
            ))
          )}
        </div>

        {/* 免责声明 */}
        <div className="mt-6 bg-gold-soft border border-gold-line rounded-2xl p-4">
          <p className="text-[11px] text-[#8a6d3b] leading-relaxed">
            <strong>免责声明：</strong>本社区仅提供信息展示，不参与交易，不担保信息真实性。
            请务必当面验车、验手续，切勿提前转账大额押金。如遇诈骗请立即举报。
          </p>
        </div>
      </div>

      {/* 悬浮发布按钮 */}
      <button
        onClick={() => setShowPublishSheet(true)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-8 w-14 h-14 bg-brand text-white rounded-full shadow-float hover:opacity-90 active:scale-95 transition-all flex items-center justify-center z-30"
        aria-label="发布信息"
      >
        <Plus className="w-6 h-6" strokeWidth={1.75} />
      </button>

      {/* 发布类型选择底部面板 */}
      {showPublishSheet && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center" onClick={() => setShowPublishSheet(false)}>
          <div className="bg-white w-full max-w-md rounded-t-2xl pb-[env(safe-area-inset-bottom)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-line">
              <h3 className="font-medium text-ink tracking-lux">发布信息</h3>
              <button onClick={() => setShowPublishSheet(false)} className="text-ink-3 hover:text-ink transition-colors">
                <X className="w-5 h-5" strokeWidth={1.75} />
              </button>
            </div>
            <div className="p-4 space-y-1.5">
              {publishOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => {
                    setShowPublishSheet(false);
                    navigate('/community/publish', { state: { category: opt.key } });
                  }}
                  className="w-full flex items-center gap-3 p-3.5 rounded-xl hover:bg-brand-soft transition-colors text-left"
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${opt.color}`}>
                    {opt.icon}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-ink">{opt.label}</div>
                    <div className="text-xs text-ink-4">{opt.desc}</div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-ink-4 -rotate-90" strokeWidth={1.75} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
