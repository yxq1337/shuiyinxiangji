/*!
 * Gallery Heading — ThreeUI Community
 * Source: https://threeui.com/component/gallery-heading
 * MIT License (c) Meng To / Design+Code
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import GalleryHeading from '../shaders/neuform-isolated/GalleryHeading';
import { VARIANTS } from '../shaders/neuform-isolated/variants';
import type { GalleryVariant } from '../shaders/neuform-isolated/variants';

const ORDER: GalleryVariant[] = [
  'rising-diagonal',
  'falling-diagonal',
  'horizontal-sweep',
  'vertical-loop',
];

export default function GalleryHeadingPage() {
  const [variant, setVariant] = useState<GalleryVariant>('rising-diagonal');

  return (
    <div className="flex-1 flex flex-col">
      <div className="max-w-5xl w-full mx-auto px-5 pt-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/tools"
          className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink transition-colors"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
          返回工具
        </Link>
        <div className="flex flex-wrap gap-1.5">
          {ORDER.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setVariant(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                key === variant
                  ? 'bg-ink text-white border-ink'
                  : 'border-line text-ink-3 hover:text-ink'
              }`}
            >
              {VARIANTS[key].label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative flex-1 min-h-[65vh] mx-4 my-4 md:mx-6 md:my-5 rounded-2xl overflow-hidden border border-line bg-black">
        <div key={variant} className="absolute inset-0">
          <GalleryHeading variant={variant} className="absolute inset-0" />
        </div>
        <p className="absolute bottom-3 inset-x-0 text-center text-[11px] tracking-wide text-white/40 pointer-events-none">
          悬停画面开始环绕 · 12 块 4:3 色板 · 程序化噪点场
        </p>
      </div>
    </div>
  );
}
