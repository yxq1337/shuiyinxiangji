import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Type,
  Palette,
  Bold,
  AlignLeft,
  AlignCenter,
  AlignRight,
  IndentIncrease,
  Outdent,
  Move,
  Pencil,
  Trash2,
  Copy,
  CheckSquare,
  Image as ImageIcon,
  Plus,
  ZoomIn,
  ZoomOut,
  Download,
} from 'lucide-react';
import { compressImage } from '../lib/imageCompress';

/**
 * 内容编辑器
 * 对齐夸克「内容编辑」：文字 / 图片 / 添加 三个面板，
 * 选中对象后长按（点击）弹出操作栏：编辑、删除、加粗、全选、复制、移动，
 * 编辑结果导出为 PNG / JPG。
 * 全部在本地浏览器完成，不上传任何数据。
 */

type Align = 'left' | 'center' | 'right';

interface BaseItem {
  id: string;
  x: number;
  y: number;
  z: number;
}

interface TextItem extends BaseItem {
  kind: 'text';
  text: string;
  w: number;
  fontSize: number;
  color: string;
  bold: boolean;
  align: Align;
  fontFamily: string;
  indent: number;
}

interface ImageItem extends BaseItem {
  kind: 'image';
  src: string;
  w: number;
  h: number;
}

type Item = TextItem | ImageItem;

interface Props {
  scene: string;
  background?: string;
  initialText?: string;
  onClose: () => void;
}

const FONTS = [
  { label: '默认', value: 'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif' },
  { label: '黑体', value: '"Heiti SC", "Microsoft YaHei", sans-serif' },
  { label: '宋体', value: '"Songti SC", SimSun, serif' },
  { label: '楷体', value: '"Kaiti SC", KaiTi, serif' },
];

const COLORS = [
  '#111111',
  '#444444',
  '#888888',
  '#B85C4E',
  '#E67E22',
  '#D4A017',
  '#1E8449',
  '#2E86C1',
  '#6C3483',
  '#FFFFFF',
];

/** OCR 类场景输出的是一份文档，用 A4 比例纸张承载 */
const PAGE_A4 = { w: 800, h: 1131 };

let seq = 0;
const uid = () => `it${Date.now().toString(36)}${(seq++).toString(36)}`;

function makeText(text: string, pageW: number, x: number, y: number): TextItem {
  return {
    id: uid(),
    kind: 'text',
    text,
    x,
    y,
    w: pageW * 0.84,
    fontSize: Math.max(22, Math.round(pageW * 0.035)),
    color: '#111111',
    bold: false,
    align: 'left',
    fontFamily: FONTS[0].value,
    indent: 0,
    z: 1,
  };
}

/** 文字块：编辑中由浏览器接管，不编辑时用命令式写入文本，避免输入时光标跳动 */
function TextBox({
  item,
  k,
  editing,
  onInput,
  onBlur,
}: {
  item: TextItem;
  k: number;
  editing: boolean;
  onInput: (text: string) => void;
  onBlur: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el && !editing && el.innerText !== item.text) el.innerText = item.text;
  }, [item.text, editing]);

  useEffect(() => {
    const el = ref.current;
    if (!editing || !el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, [editing]);

  return (
    <div
      ref={ref}
      data-textbox={item.id}
      contentEditable={editing}
      suppressContentEditableWarning
      onInput={(e) => onInput((e.currentTarget as HTMLElement).innerText)}
      onBlur={onBlur}
      style={{
        fontSize: item.fontSize * k,
        lineHeight: 1.5,
        color: item.color,
        fontWeight: item.bold ? 700 : 400,
        textAlign: item.align,
        fontFamily: item.fontFamily,
        paddingLeft: item.indent * k,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        userSelect: editing ? 'auto' : 'none',
        WebkitUserSelect: editing ? 'auto' : 'none',
        outline: 'none',
        minHeight: item.fontSize * k * 1.5,
      }}
    />
  );
}

export default function ContentEditor({ scene, background, initialText, onClose }: Props) {
  const [page, setPage] = useState(initialText ? PAGE_A4 : { w: 0, h: 0 });
  const [bg, setBg] = useState<string | null>(initialText ? null : background || null);
  const [bgNat, setBgNat] = useState<{ w: number; h: number } | null>(null);
  const [items, setItems] = useState<Item[]>(() =>
    initialText ? [makeText(initialText, PAGE_A4.w, PAGE_A4.w * 0.09, PAGE_A4.h * 0.08)] : []
  );
  const [sel, setSel] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [tab, setTab] = useState<'text' | 'image' | 'add'>('text');
  const [zoom, setZoom] = useState(1);
  const [wrapW, setWrapW] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const [toast, setToast] = useState('');

  const wrapRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    id: string;
    mode: 'move' | 'resize';
    sx: number;
    sy: number;
    ox: number;
    oy: number;
    ow: number;
    oh: number;
  } | null>(null);

  // 显示比例：先适应宽度，再乘以用户缩放
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWrapW(el.clientWidth));
    ro.observe(el);
    setWrapW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // 载入背景图，拿到原始尺寸
  useEffect(() => {
    if (!bg) {
      setBgNat(null);
      return;
    }
    const img = new window.Image();
    img.onload = () => {
      setBgNat({ w: img.naturalWidth, h: img.naturalHeight });
      setPage((p) => (p.w ? p : { w: img.naturalWidth, h: img.naturalHeight }));
    };
    img.src = bg;
  }, [bg]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const fit = page.w && wrapW ? Math.min(1, (wrapW - 24) / page.w) : 0;
  const k = fit * zoom;

  /** 背景按 contain 铺在纸面上，避免拉伸变形（html2canvas 不支持 object-fit） */
  const bgFit = useMemo(() => {
    if (!bgNat || !page.w) return null;
    const s = Math.min(page.w / bgNat.w, page.h / bgNat.h);
    const w = bgNat.w * s;
    const h = bgNat.h * s;
    return { x: (page.w - w) / 2, y: (page.h - h) / 2, w, h };
  }, [bgNat, page]);

  const selItem = items.find((i) => i.id === sel) || null;

  const update = (id: string, patch: Partial<TextItem> & Partial<ImageItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? ({ ...it, ...patch } as Item) : it)));

  const raise = (id: string) =>
    setItems((prev) => {
      const maxZ = prev.reduce((m, i) => Math.max(m, i.z), 0);
      return prev.map((i) => (i.id === id ? { ...i, z: maxZ + 1 } : i));
    });

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setSel(null);
    setEditing(null);
    setMoving(null);
  };

  const onDown = (e: React.PointerEvent, item: Item, mode: 'move' | 'resize') => {
    if (editing === item.id && mode === 'move') return; // 编辑中让位给文本选择
    e.stopPropagation();
    setSel(item.id);
    setTab(item.kind === 'text' ? 'text' : 'image');
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      id: item.id,
      mode,
      sx: e.clientX,
      sy: e.clientY,
      ox: item.x,
      oy: item.y,
      ow: item.w,
      oh: item.kind === 'image' ? item.h : 0,
    };
  };

  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || !k) return;
    const dx = (e.clientX - d.sx) / k;
    const dy = (e.clientY - d.sy) / k;
    if (d.mode === 'move') {
      update(d.id, { x: d.ox + dx, y: d.oy + dy });
      return;
    }
    const item = items.find((i) => i.id === d.id);
    if (!item) return;
    const w = Math.max(item.kind === 'text' ? 60 : 40, d.ow + dx);
    if (item.kind === 'text') update(d.id, { w });
    else update(d.id, { w, h: w * (d.oh / d.ow) });
  };

  const onUp = () => {
    dragRef.current = null;
  };

  const pickImage = (cb: (src: string, w: number, h: number) => void) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        const src = await compressImage(f, 1600, 0.9);
        const img = new window.Image();
        img.onload = () => cb(src, img.naturalWidth, img.naturalHeight);
        img.src = src;
      } catch {
        setToast('图片读取失败');
      }
    };
    input.click();
  };

  const addText = () => {
    const t = makeText('点击输入文字', page.w, page.w * 0.1, page.h * 0.1);
    t.z = items.reduce((m, i) => Math.max(m, i.z), 0) + 1;
    setItems((prev) => [...prev, t]);
    setSel(t.id);
    setEditing(t.id);
    setTab('text');
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-textbox="${t.id}"]`) as HTMLElement | null;
      if (!el) return;
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      const s = window.getSelection();
      s?.removeAllRanges();
      s?.addRange(range);
    });
  };

  const addImage = () =>
    pickImage((src, w, h) => {
      const s = Math.min((page.w * 0.6) / w, (page.h * 0.6) / h, 1);
      const iw = w * s;
      const ih = h * s;
      const item: ImageItem = {
        id: uid(),
        kind: 'image',
        src,
        x: (page.w - iw) / 2,
        y: (page.h - ih) / 2,
        w: iw,
        h: ih,
        z: items.reduce((m, i) => Math.max(m, i.z), 0) + 1,
      };
      setItems((prev) => [...prev, item]);
      setSel(item.id);
      setTab('image');
    });

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast('已复制');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        setToast('已复制');
      } catch {
        setToast('复制失败');
      }
      document.body.removeChild(ta);
    }
  };

  const selectAllText = (id: string) => {
    setEditing(id);
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-textbox="${id}"]`) as HTMLElement | null;
      if (!el) return;
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      const s = window.getSelection();
      s?.removeAllRanges();
      s?.addRange(range);
    });
  };

  const exportImage = async (mime: 'image/png' | 'image/jpeg') => {
    const el = pageRef.current;
    if (!el || !k) return;
    setMenuOpen(false);
    setSel(null);
    setEditing(null);
    setExporting(true);
    (document.activeElement as HTMLElement | null)?.blur?.();
    // 等一帧，让选中框等辅助 UI 从 DOM 上摘掉
    await new Promise((r) => setTimeout(r, 80));
    try {
      const { default: html2canvas } = await import('html2canvas');
      const base = 1 / k;
      const area = page.w * page.h;
      const limit = 12e6; // 移动端 canvas 面积上限，超出则等比降采样
      const scale = area > limit ? base * Math.sqrt(limit / area) : base;
      const canvas = await html2canvas(el, {
        scale,
        backgroundColor: '#FFFFFF',
        useCORS: true,
        logging: false,
        width: el.clientWidth,
        height: el.clientHeight,
      });
      const url = canvas.toDataURL(mime, 0.92);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${scene}-edited.${mime === 'image/png' ? 'png' : 'jpg'}`;
      a.click();
      setExported(true);
      setToast('已导出');
    } catch (e: any) {
      setToast('导出失败：' + (e?.message || '未知错误'));
    } finally {
      setExporting(false);
    }
  };

  const handleExit = () => {
    if (items.length && !exported && !window.confirm('编辑内容尚未导出，退出后修改将丢失。确定退出？')) return;
    onClose();
  };

  const renderItem = (it: Item) => {
    const isSel = sel === it.id && !exporting;
    const handle = (
      <div
        className="absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#2E86C1] border-2 border-white"
        style={{ cursor: 'nwse-resize', touchAction: 'none' }}
        onPointerDown={(e) => onDown(e, it, 'resize')}
        onPointerMove={onMove}
        onPointerUp={onUp}
      />
    );
    const frame = isSel && (
      <div
        className={`absolute inset-0 border pointer-events-none ${
          moving === it.id ? 'border-2 border-dashed border-[#2E86C1]' : 'border-[#2E86C1]'
        }`}
      />
    );

    if (it.kind === 'text') {
      return (
        <div
          key={it.id}
          style={{
            position: 'absolute',
            left: it.x * k,
            top: it.y * k,
            width: it.w * k,
            zIndex: 10 + it.z,
            touchAction: 'none',
          }}
          onPointerDown={(e) => onDown(e, it, 'move')}
          onPointerMove={onMove}
          onPointerUp={onUp}
        >
          <TextBox
            item={it}
            k={k}
            editing={editing === it.id}
            onInput={(t) => update(it.id, { text: t })}
            onBlur={() => setEditing(null)}
          />
          {frame}
          {isSel && handle}
        </div>
      );
    }

    return (
      <div
        key={it.id}
        style={{
          position: 'absolute',
          left: it.x * k,
          top: it.y * k,
          width: it.w * k,
          height: it.h * k,
          zIndex: 10 + it.z,
          touchAction: 'none',
        }}
        onPointerDown={(e) => onDown(e, it, 'move')}
        onPointerMove={onMove}
        onPointerUp={onUp}
      >
        <img src={it.src} alt="" draggable={false} style={{ width: '100%', height: '100%', display: 'block' }} />
        {frame}
        {isSel && handle}
      </div>
    );
  };

  const chip =
    'inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-line text-xs text-ink-2 hover:text-ink transition-colors disabled:opacity-35 disabled:hover:text-ink-2';
  const iconBtn = 'w-9 h-9 inline-flex items-center justify-center rounded-lg border border-line text-ink-2';
  const textItem = selItem && selItem.kind === 'text' ? selItem : null;

  const actions: { key: string; label: string; icon: any; disabled?: boolean; run: () => void }[] = selItem
    ? [
        {
          key: 'edit',
          label: '编辑',
          icon: Pencil,
          run: () => {
            if (selItem.kind === 'text') {
              setEditing(selItem.id);
            } else {
              pickImage((src, w, h) =>
                update(selItem.id, { src, h: (selItem as ImageItem).w * (h / w) })
              );
            }
          },
        },
        { key: 'del', label: '删除', icon: Trash2, run: () => removeItem(selItem.id) },
        {
          key: 'bold',
          label: '加粗',
          icon: Bold,
          disabled: !textItem,
          run: () => textItem && update(textItem.id, { bold: !textItem.bold }),
        },
        {
          key: 'all',
          label: '全选',
          icon: CheckSquare,
          disabled: !textItem,
          run: () => textItem && selectAllText(textItem.id),
        },
        {
          key: 'copy',
          label: '复制',
          icon: Copy,
          disabled: !textItem,
          run: () => textItem && copyText(textItem.text),
        },
        {
          key: 'move',
          label: '移动',
          icon: Move,
          run: () => {
            raise(selItem.id);
            setMoving((m) => (m === selItem.id ? null : selItem.id));
          },
        },
      ]
    : [];

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col">
      {/* 顶栏 */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-line shrink-0">
        <button onClick={handleExit} className="inline-flex items-center gap-1 text-sm text-ink-3">
          <X className="w-4 h-4" strokeWidth={1.75} />
          退出
        </button>
        <span className="text-sm font-medium text-ink tracking-lux">内容编辑</span>
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            disabled={exporting}
            className="inline-flex items-center gap-1 text-sm text-[#2E86C1] font-medium disabled:opacity-40"
          >
            <Download className="w-4 h-4" strokeWidth={1.75} />
            {exporting ? '导出中' : '保存'}
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-9 w-28 bg-white border border-line rounded-xl shadow-lg py-1 z-[110]">
              {(['image/png', 'image/jpeg'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => exportImage(m)}
                  className="block w-full text-left px-3 py-2 text-xs text-ink-2 hover:bg-[#FAFAFA]"
                >
                  {m === 'image/png' ? '导出 PNG' : '导出 JPG'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 纸面 */}
      <div ref={wrapRef} className="flex-1 overflow-auto bg-[#F2F2F2] px-3 py-3">
        {page.w > 0 ? (
          <div
            ref={pageRef}
            className="relative mx-auto bg-white shadow-sm"
            style={{ width: page.w * k, height: page.h * k }}
            onPointerDown={() => {
              if (exporting) return;
              setSel(null);
              setEditing(null);
              setMoving(null);
            }}
          >
            {bg && bgFit && (
              <img
                src={bg}
                alt=""
                draggable={false}
                style={{
                  position: 'absolute',
                  left: bgFit.x * k,
                  top: bgFit.y * k,
                  width: bgFit.w * k,
                  height: bgFit.h * k,
                  zIndex: 0,
                }}
              />
            )}
            {items.map(renderItem)}
          </div>
        ) : (
          <div className="text-xs text-ink-3 text-center py-10">加载中…</div>
        )}
      </div>

      {/* 缩放 */}
      <div className="shrink-0 flex items-center justify-end gap-1 px-3 py-1.5 border-t border-line">
        <button
          onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
          className={iconBtn}
          aria-label="缩小"
        >
          <ZoomOut className="w-4 h-4" strokeWidth={1.75} />
        </button>
        <span className="text-xs text-ink-3 w-10 text-center">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
          className={iconBtn}
          aria-label="放大"
        >
          <ZoomIn className="w-4 h-4" strokeWidth={1.75} />
        </button>
      </div>

      {/* 长按/选中操作栏 */}
      {selItem && !exporting && (
        <div className="shrink-0 mx-3 mb-2 flex items-center gap-1 bg-[#1F1F1F] rounded-2xl px-1.5 py-2">
          {actions.map((a) => (
            <button
              key={a.key}
              disabled={a.disabled}
              onClick={a.run}
              className="flex-1 flex flex-col items-center gap-1 text-white disabled:opacity-30"
            >
              <a.icon className="w-4 h-4" strokeWidth={1.75} />
              <span className="text-[10px]">{a.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* 底部面板 */}
      <div className="shrink-0 border-t border-line bg-white">
        <div className="min-h-[104px] px-3 py-3">
          {tab === 'text' &&
            (textItem ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-xs text-ink-3 shrink-0">
                    <Type className="w-3.5 h-3.5" strokeWidth={1.75} />
                    字体
                  </span>
                  <select
                    value={textItem.fontFamily}
                    onChange={(e) => update(textItem.id, { fontFamily: e.target.value })}
                    className="flex-1 text-xs text-ink bg-[#FAFAFA] border border-line rounded-lg px-2 py-1.5 outline-none"
                  >
                    {FONTS.map((f) => (
                      <option key={f.label} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-ink-3 shrink-0">{textItem.fontSize}</span>
                  <input
                    type="range"
                    min={12}
                    max={96}
                    step={1}
                    value={textItem.fontSize}
                    onChange={(e) => update(textItem.id, { fontSize: Number(e.target.value) })}
                    className="w-24 shrink-0"
                    aria-label="字号"
                  />
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  <Palette className="w-3.5 h-3.5 text-ink-3 shrink-0" strokeWidth={1.75} />
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => update(textItem.id, { color: c })}
                      className={`w-6 h-6 rounded-full border shrink-0 ${
                        textItem.color === c ? 'ring-2 ring-[#2E86C1] ring-offset-1' : ''
                      }`}
                      style={{ background: c, borderColor: '#E5E5E5' }}
                      aria-label={`字色 ${c}`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => update(textItem.id, { bold: !textItem.bold })}
                    className={`${chip} ${textItem.bold ? 'text-ink border-ink' : ''}`}
                  >
                    <Bold className="w-3.5 h-3.5" strokeWidth={1.75} />
                    加粗
                  </button>
                  {(
                    [
                      ['left', AlignLeft],
                      ['center', AlignCenter],
                      ['right', AlignRight],
                    ] as const
                  ).map(([a, Icon]) => (
                    <button
                      key={a}
                      onClick={() => update(textItem.id, { align: a as Align })}
                      className={`${iconBtn} ${textItem.align === a ? 'text-ink border-ink' : ''}`}
                      aria-label={`对齐 ${a}`}
                    >
                      <Icon className="w-4 h-4" strokeWidth={1.75} />
                    </button>
                  ))}
                  <button
                    onClick={() => update(textItem.id, { indent: textItem.indent + 24 })}
                    className={iconBtn}
                    aria-label="增加缩进"
                  >
                    <IndentIncrease className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                  <button
                    onClick={() => update(textItem.id, { indent: Math.max(0, textItem.indent - 24) })}
                    className={iconBtn}
                    aria-label="减少缩进"
                  >
                    <Outdent className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-start gap-3">
                <p className="text-xs text-ink-3">点选纸面上的文字，即可改字体、字色、字号、对齐</p>
                <button onClick={addText} className={chip}>
                  <Type className="w-3.5 h-3.5" strokeWidth={1.75} />
                  添加文字
                </button>
              </div>
            ))}

          {tab === 'image' && (
            <div className="flex flex-col items-start gap-3">
              <div className="flex flex-wrap gap-2">
                <button onClick={addImage} className={chip}>
                  <ImageIcon className="w-3.5 h-3.5" strokeWidth={1.75} />
                  添加图片
                </button>
                <button onClick={() => pickImage((src) => setBg(src))} className={chip}>
                  <ImageIcon className="w-3.5 h-3.5" strokeWidth={1.75} />
                  更换背景图
                </button>
                <button
                  onClick={() => selItem && selItem.kind === 'image' && removeItem(selItem.id)}
                  disabled={!selItem || selItem.kind !== 'image'}
                  className={chip}
                >
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                  删除所选图片
                </button>
              </div>
              <p className="text-xs text-ink-3">选中图片后可拖动位置、拖右下角手柄缩放</p>
            </div>
          )}

          {tab === 'add' && (
            <div className="flex flex-wrap gap-2">
              <button onClick={addText} className={chip}>
                <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
                添加文字
              </button>
              <button onClick={addImage} className={chip}>
                <ImageIcon className="w-3.5 h-3.5" strokeWidth={1.75} />
                添加图片
              </button>
              <button onClick={() => pickImage((src) => setBg(src))} className={chip}>
                <ImageIcon className="w-3.5 h-3.5" strokeWidth={1.75} />
                更换背景图
              </button>
            </div>
          )}
        </div>

        {/* 三个面板切换 */}
        <div className="flex border-t border-line">
          {(
            [
              ['text', '文字'],
              ['image', '图片'],
              ['add', '添加'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 py-3 text-xs transition-colors ${
                tab === key ? 'text-ink font-medium' : 'text-ink-3'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-32 px-3 py-1.5 rounded-full bg-[#1F1F1F] text-white text-xs z-[120]">
          {toast}
        </div>
      )}
    </div>
  );
}
