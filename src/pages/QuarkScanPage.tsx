import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Upload, Loader2, Download, Copy, AlertCircle } from 'lucide-react';
import { apiPost } from '../lib/api';
import { compressImage } from '../lib/imageCompress';

interface Scene {
  id: string;
  name: string;
}

interface SceneGroup {
  label: string;
  scenes: Scene[];
}

/** 场景名与参数均取自夸克扫描王开放接口，见官方 CLI 包 yescan */
const SCENE_GROUPS: SceneGroup[] = [
  {
    label: '文字识别',
    scenes: [
      { id: 'general-ocr', name: '通用文字识别' },
      { id: 'handwritten-ocr', name: '手写文字识别' },
      { id: 'table-ocr', name: '表格识别' },
      { id: 'business-license-ocr', name: '营业执照识别' },
      { id: 'idcard-ocr', name: '身份证识别' },
      { id: 'vat-invoice-ocr', name: '增值税发票识别' },
      { id: 'train-ticket-ocr', name: '火车票识别' },
      { id: 'driver-license-ocr', name: '驾驶证识别' },
      { id: 'vehicle-license-ocr', name: '行驶证识别' },
      { id: 'formula-ocr', name: '公式识别' },
    ],
  },
  {
    label: '扫描增强',
    scenes: [
      { id: 'scan-document', name: '文档扫描' },
      { id: 'scan-contract', name: '合同高清' },
      { id: 'image-hd-enhance', name: '高清增强' },
      { id: 'remove-watermark', name: '去除水印' },
      { id: 'remove-handwriting', name: '去除手写' },
      { id: 'remove-shadow', name: '去除阴影' },
      { id: 'remove-screen-pattern', name: '去除摩尔纹' },
      { id: 'remove-background-color', name: '去除背景色' },
      { id: 'image-crop-rectify', name: '裁切矫正' },
      { id: 'exam-enhance', name: '试卷增强' },
    ],
  },
  {
    label: '格式转换',
    scenes: [
      { id: 'image-to-word', name: '转 Word' },
      { id: 'image-to-pdf', name: '转 PDF' },
      { id: 'image-to-excel', name: '转 Excel' },
    ],
  },
  {
    label: '证件照',
    scenes: [{ id: 'id-photo', name: '照片转证件照' }],
  },
];

/** 返回图片类场景 */
const IMAGE_SCENES = new Set([
  'pic-translate',
  'exam-enhance',
  'image-hd-enhance',
  'certificate-enhance',
  'remove-handwriting',
  'remove-watermark',
  'remove-shadow',
  'remove-screen-pattern',
  'remove-background-color',
  'image-crop-rectify',
  'sketch-drawing',
  'extract-lineart',
  'scan-document',
  'scan-contract',
  'id-photo',
]);

const DOCUMENT_TYPES: Record<string, { ext: string; mime: string }> = {
  'image-to-word': { ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  'image-to-excel': { ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  'image-to-pdf': { ext: 'pdf', mime: 'application/pdf' },
};

const MAX_BYTES = 5 * 1024 * 1024;

function base64Size(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  const raw = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return (raw.length * 3) / 4;
}

/** 按文件头判断图片真实格式，避免把 PNG 存成 .jpg */
function sniffImage(base64: string): { mime: string; ext: string } {
  if (base64.startsWith('/9j/')) return { mime: 'image/jpeg', ext: 'jpg' };
  if (base64.startsWith('iVBOR')) return { mime: 'image/png', ext: 'png' };
  if (base64.startsWith('R0lGOD')) return { mime: 'image/gif', ext: 'gif' };
  if (base64.startsWith('UklGR')) return { mime: 'image/webp', ext: 'webp' };
  return { mime: 'image/jpeg', ext: 'jpg' };
}

function downloadBase64(base64: string, filename: string, mime: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function QuarkScanPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [scene, setScene] = useState('general-ocr');
  const [background, setBackground] = useState('white');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setFile(picked);
    setPreview(URL.createObjectURL(picked));
    setResult(null);
    setError('');
  };

  const run = async () => {
    if (!file || busy) return;
    setBusy(true);
    setError('');
    setResult(null);

    try {
      // 长边 2000 起步，超过 5MB 再降一档重压
      let dataUrl = await compressImage(file, 2000, 0.85);
      if (base64Size(dataUrl) > MAX_BYTES) {
        dataUrl = await compressImage(file, 1400, 0.7);
      }
      if (base64Size(dataUrl) > MAX_BYTES) {
        setError('图片压缩后仍超过 5MB，请换一张更小的图片');
        return;
      }

      const body: any = { scene, imageBase64: dataUrl };
      if (scene === 'id-photo') {
        body.inputConfigs = JSON.stringify({
          style_type: 'origin',
          style_fuse_level: 0,
          retouch: { enhance: 3 },
          change_background: { need_change_background: true, background_color: background },
        });
      }

      const res = await apiPost('/quark-scan', body);
      if (!res || res.code !== '00000') {
        setError(res?.message || `处理失败（${res?.code || '未知错误'}）`);
        return;
      }
      setResult(res);
    } catch (e: any) {
      setError(e?.message || '处理失败，请稍后重试');
    } finally {
      setBusy(false);
    }
  };

  const imageBase64 = result?.data?.ImageInfo?.[0]?.ImageBase64;
  const docBase64 = result?.data?.TypesetInfo?.[0]?.FileBase64;
  const docType = DOCUMENT_TYPES[scene];
  const ocrText = (result?.data?.OcrInfo || [])
    .map((item: any) => item?.Text || '')
    .join('\n')
    .trim();
  const imageKind = imageBase64 ? sniffImage(imageBase64) : null;

  return (
    <div className="flex-1">
      <div className="max-w-3xl mx-auto px-5 py-8">
        <Link
          to="/tools"
          className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
          返回工具
        </Link>

        <div className="card p-6">
          <h1 className="text-lg font-semibold text-ink tracking-lux">夸克扫描王</h1>
          <p className="text-xs text-ink-3 mt-2 leading-relaxed">
            OCR 识别 · 扫描增强 · 转 Word / Excel / PDF · 证件照生成，单张图片不超过 5MB
          </p>

          {/* 场景选择 */}
          <div className="mt-5">
            <label className="block text-xs text-ink-3 mb-2">选择功能</label>
            <select
              value={scene}
              onChange={(e) => {
                setScene(e.target.value);
                setResult(null);
                setError('');
              }}
              className="w-full text-sm text-ink bg-[#FAFAFA] border border-line rounded-xl px-3.5 py-2.5 outline-none focus:border-ink-3 transition-colors"
            >
              {SCENE_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.scenes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {scene === 'id-photo' && (
            <div className="mt-4">
              <label className="block text-xs text-ink-3 mb-2">证件照底色</label>
              <div className="flex gap-2">
                {[
                  { id: 'white', name: '白底' },
                  { id: 'blue', name: '蓝底' },
                  { id: 'red', name: '红底' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setBackground(opt.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs border transition-colors ${
                      background === opt.id
                        ? 'border-ink text-ink'
                        : 'border-line text-ink-3 hover:text-ink'
                    }`}
                  >
                    {opt.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 上传 */}
          <div className="mt-5">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              onChange={onPick}
              className="hidden"
            />
            <button
              onClick={() => inputRef.current?.click()}
              className="card card-press w-full flex flex-col items-center justify-center gap-3 py-8 border border-dashed border-[#E5E5E5] bg-[#FAFAFA]"
            >
              {preview ? (
                <img
                  src={preview}
                  alt="待处理图片"
                  className="max-h-52 rounded-xl object-contain"
                />
              ) : (
                <>
                  <Upload className="w-5 h-5 text-ink-3" strokeWidth={1.5} />
                  <span className="text-xs text-ink-3">点击选择图片</span>
                </>
              )}
            </button>
            {file && <p className="text-xs text-ink-4 mt-2 truncate">{file.name}</p>}
          </div>

          <button
            onClick={run}
            disabled={!file || busy}
            className="mt-5 w-full py-3 rounded-xl text-sm font-medium bg-ink text-white disabled:opacity-40 transition-opacity"
          >
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />
                处理中
              </span>
            ) : (
              '开始处理'
            )}
          </button>

          {error && (
            <div className="mt-4 flex items-start gap-2 text-xs text-[#B85C4E] leading-relaxed">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.75} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* 结果 */}
        {result && (
          <div className="card p-6 mt-5">
            <h2 className="text-sm font-medium text-ink tracking-lux mb-4">处理结果</h2>

            {imageBase64 && imageKind && (
              <div className="flex flex-col items-start gap-4">
                <img
                  src={`data:${imageKind.mime};base64,${imageBase64}`}
                  alt="处理结果"
                  className="w-full rounded-xl border border-line"
                />
                <button
                  onClick={() =>
                    downloadBase64(imageBase64, `quark-${scene}.${imageKind.ext}`, imageKind.mime)
                  }
                  className="inline-flex items-center gap-1.5 text-xs text-ink-3 hover:text-ink transition-colors"
                >
                  <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
                  保存图片
                </button>
              </div>
            )}

            {docBase64 && docType && (
              <button
                onClick={() =>
                  downloadBase64(docBase64, `quark-${scene}.${docType.ext}`, docType.mime)
                }
                className="inline-flex items-center gap-1.5 text-xs text-ink-3 hover:text-ink transition-colors"
              >
                <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
                下载 .{docType.ext} 文件
              </button>
            )}

            {ocrText && (
              <div>
                <button
                  onClick={() => navigator.clipboard.writeText(ocrText)}
                  className="inline-flex items-center gap-1.5 text-xs text-ink-3 hover:text-ink mb-3 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" strokeWidth={1.75} />
                  复制文字
                </button>
                <pre className="text-xs text-ink-2 bg-[#FAFAFA] border border-line rounded-xl p-4 overflow-x-auto whitespace-pre-wrap break-all">
                  {ocrText}
                </pre>
                <details className="mt-3">
                  <summary className="text-xs text-ink-4 cursor-pointer">查看原始返回</summary>
                  <pre className="mt-2 text-[11px] text-ink-4 bg-[#FAFAFA] border border-line rounded-xl p-4 overflow-x-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                </details>
              </div>
            )}

            {!imageBase64 && !docBase64 && !ocrText && (
              <div>
                <button
                  onClick={() =>
                    navigator.clipboard.writeText(JSON.stringify(result.data, null, 2))
                  }
                  className="inline-flex items-center gap-1.5 text-xs text-ink-3 hover:text-ink mb-3 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" strokeWidth={1.75} />
                  复制结果
                </button>
                <pre className="text-xs text-ink-2 bg-[#FAFAFA] border border-line rounded-xl p-4 overflow-x-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
