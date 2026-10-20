import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Upload, Pencil, Loader2, AlertCircle } from 'lucide-react';
import { compressImage } from '../lib/imageCompress';
import ContentEditor from '../components/ContentEditor';

/**
 * 截图标注工具
 * 用户上传自己的截图，在浏览器本地自由添加文字 / 图片标注，
 * 拖动调整位置与大小，导出 PNG / JPG。全部本地处理，不上传服务器。
 */
export default function ScreenshotAnnotate() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [background, setBackground] = useState<string | null>(null);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setFile(picked);
    setPreview(URL.createObjectURL(picked));
    setError('');
  };

  const start = async () => {
    if (!file || busy) return;
    setBusy(true);
    setError('');
    try {
      const dataUrl = await compressImage(file, 2400, 0.95);
      setBackground(dataUrl);
    } catch (e: any) {
      setError(e?.message || '图片读取失败，请换一张');
    } finally {
      setBusy(false);
    }
  };

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
          <h1 className="text-lg font-semibold text-ink tracking-lux">截图标注</h1>
          <p className="text-xs text-ink-3 mt-2 leading-relaxed">
            上传任意截图，在图片上自由添加文字、图片标注，拖动调整位置与大小，导出 PNG / JPG。
            全部在本地浏览器完成，图片不会上传到服务器。
          </p>

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
                  alt="待标注截图"
                  className="max-h-52 rounded-xl object-contain"
                />
              ) : (
                <>
                  <Upload className="w-5 h-5 text-ink-3" strokeWidth={1.5} />
                  <span className="text-xs text-ink-3">点击选择截图</span>
                </>
              )}
            </button>
            {file && <p className="text-xs text-ink-4 mt-2 truncate">{file.name}</p>}
          </div>

          <button
            onClick={start}
            disabled={!file || busy}
            className="mt-5 w-full py-3 rounded-xl text-sm font-medium bg-ink text-white disabled:opacity-40 transition-opacity"
          >
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />
                加载中
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Pencil className="w-4 h-4" strokeWidth={1.75} />
                开始标注
              </span>
            )}
          </button>

          {error && (
            <div className="mt-4 flex items-start gap-2 text-xs text-[#B85C4E] leading-relaxed">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.75} />
              <span>{error}</span>
            </div>
          )}

          <p className="mt-5 text-[11px] text-ink-4 leading-relaxed">
            提示：进入编辑器后，底部「文字 / 图片 / 添加」三个面板分别用于编辑文字、图片与新增内容；
            点选对象后可编辑、删除、加粗、复制、移动。
          </p>
        </div>
      </div>

      {background && (
        <ContentEditor
          scene="annotate"
          background={background}
          onClose={() => setBackground(null)}
        />
      )}
    </div>
  );
}
