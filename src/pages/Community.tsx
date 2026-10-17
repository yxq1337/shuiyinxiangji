import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Plus, ChevronDown, Battery, Briefcase, Bike, HelpCircle, Filter, Eye, Clock, X } from 'lucide-react';
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
  const e = listing.extra || {};
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
      className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-[0.99]"
    >
      {/* 第一行：类型标签 + 地区（左），价格（右） */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${meta.bgColor} ${meta.color} flex-shrink-0`}>
            {meta.label}
          </span>
          {listing.city && (
            <span className="text-xs text-gray-400 flex items-center gap-0.5 min-w-0">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{listing.city}{listing.area ? `·${listing.area}` : ''}</span>
            </span>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xl font-bold text-[#F04452] leading-tight">{formatPrice(listing.price, listing.category)}</div>
        </div>
      </div>

      {/* 第二行：标题 + 缩略图 */}
      <div className="flex gap-3 mb-1.5">
        <h3 className="text-base font-semibold text-[#172033] line-clamp-2 flex-1">{listing.title}</h3>
        {listing.images && listing.images.length > 0 && (
          <img
            src={listing.images[0]}
            alt=""
            className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
          />
        )}
      </div>

      {/* 第三行：关键信息标签 */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map((t, i) => (
            <span key={i} className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[11px] font-medium">
              {t}
            </span>
          ))}
        </div>
      )}

      {/* 第四行：描述 */}
      <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed mb-2.5">{listing.description}</p>

      {/* 第五行：浏览量 + 有效期 */}
      <div className="flex items-center gap-4 text-[11px] text-gray-400">
        <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" />{listing.viewCount}</span>
        {left != null && (
          <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />剩{left}天</span>
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
    { key: 'job', label: '招聘信息', desc: '发布骑手招聘岗位', icon: <Briefcase className="w-5 h-5" />, color: 'text-orange-600 bg-orange-50' },
    { key: 'battery', label: '电池租赁', desc: '发布电池出租信息', icon: <Battery className="w-5 h-5" />, color: 'text-emerald-600 bg-emerald-50' },
    { key: 'usedcar', label: '二手车交易', desc: '发布电动车转让', icon: <Bike className="w-5 h-5" />, color: 'text-blue-600 bg-blue-50' },
    { key: 'help', label: '求助互助', desc: '发布求助或互助信息', icon: <HelpCircle className="w-5 h-5" />, color: 'text-purple-600 bg-purple-50' },
  ];

  return (
    <div className="flex-1 bg-transparent pb-24">
      <div className="max-w-6xl mx-auto px-4 pt-4">
        {/* 顶部标题 */}
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-[#172033]">嘉兴骑手社区</h1>
        </div>

        {/* 五宫格分类入口 */}
        <div className="bg-white rounded-2xl p-3 mb-3 shadow-sm">
          <div className="grid grid-cols-5 gap-1">
            <button
              onClick={() => setCategory('')}
              className={`flex flex-col items-center gap-1 py-2 rounded-xl transition-all ${
                category === '' ? 'bg-blue-50' : 'hover:bg-gray-50'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                category === '' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
              }`}>
                <span className="text-base">🏠</span>
              </div>
              <span className={`text-[11px] font-medium ${category === '' ? 'text-blue-600' : 'text-gray-600'}`}>全部</span>
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setCategory(cat.key)}
                className={`flex flex-col items-center gap-1 py-2 rounded-xl transition-all ${
                  category === cat.key ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  category === cat.key ? cat.bgColor + ' ' + cat.color : 'bg-gray-100 text-gray-500'
                }`}>
                  {CATEGORY_ICONS[cat.key]}
                </div>
                <span className={`text-[11px] font-medium ${category === cat.key ? cat.color : 'text-gray-600'}`}>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 筛选栏 */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-500">
            共 <span className="font-semibold text-gray-800">{listings.length}</span> 条信息
          </span>
          <button
            onClick={() => setShowFilter(!showFilter)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-white text-gray-600 border border-gray-200 shadow-sm"
          >
            <Filter className="w-3.5 h-3.5" />
            价格
            <ChevronDown className={`w-3 h-3 transition-transform ${showFilter ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* 价格筛选展开 */}
        {showFilter && (
          <div className="bg-white rounded-2xl p-3 mb-3 shadow-sm">
            <div className="flex flex-wrap gap-2">
              {priceRanges.map((r) => (
                <button
                  key={r.value}
                  onClick={() => { setPriceRange(r.value); setShowFilter(false); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    priceRange === r.value ? 'bg-[#246BFD] text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 列表 */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-12 text-gray-400 text-sm">加载中...</div>
          ) : listings.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Bike className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-gray-400 text-sm">暂无信息，点击右下角发布第一条吧</p>
            </div>
          ) : (
            listings.map((l) => <ListingCard key={l.id} listing={l} />)
          )}
        </div>

        {/* 免责声明 */}
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-3">
          <p className="text-[11px] text-amber-800 leading-relaxed">
            <strong>免责声明：</strong>本社区仅提供信息展示，不参与交易，不担保信息真实性。
            请务必当面验车、验手续，切勿提前转账大额押金。如遇诈骗请立即举报。
          </p>
        </div>
      </div>

      {/* 悬浮发布按钮 */}
      <button
        onClick={() => setShowPublishSheet(true)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-8 w-14 h-14 bg-[#246BFD] text-white rounded-full shadow-lg hover:bg-[#1d57d4] active:scale-95 transition-all flex items-center justify-center z-30"
        aria-label="发布信息"
      >
        <Plus className="w-7 h-7" />
      </button>

      {/* 发布类型选择底部面板 */}
      {showPublishSheet && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center" onClick={() => setShowPublishSheet(false)}>
          <div className="bg-white w-full max-w-md rounded-t-2xl pb-[env(safe-area-inset-bottom)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">发布信息</h3>
              <button onClick={() => setShowPublishSheet(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-2">
              {publishOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => {
                    setShowPublishSheet(false);
                    navigate('/community/publish', { state: { category: opt.key } });
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-left"
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${opt.color}`}>
                    {opt.icon}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{opt.label}</div>
                    <div className="text-xs text-gray-400">{opt.desc}</div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-300 -rotate-90" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
