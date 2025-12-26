import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import ColorPickerPopover from './ColorPickerPopover';
import { GlassPrefs, GLASS_PREFS_STORAGE_KEY, DEFAULT_GLASS_PREFS } from '../utils/glassPrefs';

interface Props {
  open: boolean;
  prefs: GlassPrefs;
  onChange: (next: GlassPrefs) => void;
  onReset: () => void;
  onClose: () => void;
}

const MAX_BG_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB

const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

type Point = { x: number; y: number };

type PreviewGesture =
  | { mode: 'none' }
  | { mode: 'drag'; startX: number; startY: number; startPosX: number; startPosY: number }
  | { mode: 'pinch'; startCenterX: number; startCenterY: number; startPosX: number; startPosY: number; startScale: number; startDistance: number };

const GlassSettingsModal: React.FC<Props> = ({ open, prefs, onChange, onReset, onClose }) => {
  const [showTintPicker, setShowTintPicker] = useState(false);
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);
  const [previewInteracting, setPreviewInteracting] = useState(false);
  const tintBtnRef = useRef<HTMLButtonElement>(null);
  const bgColorBtnRef = useRef<HTMLButtonElement>(null);
  const bgImageInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const previewPointersRef = useRef<Map<number, Point>>(new Map());
  const previewGestureRef = useRef<PreviewGesture>({ mode: 'none' });
  const [bgImageErrorText, setBgImageErrorText] = useState('');
  const opacityRangeRef = useRef<HTMLInputElement>(null);
  const blurRangeRef = useRef<HTMLInputElement>(null);
  const bgScaleRangeRef = useRef<HTMLInputElement>(null);
  const bgPosXRangeRef = useRef<HTMLInputElement>(null);
  const bgPosYRangeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setShowTintPicker(false);
      setShowBgColorPicker(false);
      setPreviewInteracting(false);
      previewPointersRef.current.clear();
      previewGestureRef.current = { mode: 'none' };
      setBgImageErrorText('');
    }
  }, [open]);

  const updateIdleRangeProgress = (range: HTMLInputElement | null) => {
    if (!range) return;
    const min = Number(range.min || '0');
    const max = Number(range.max || '100');
    const value = Number(range.value);

    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min || !Number.isFinite(value)) {
      range.style.setProperty('--idle-range-progress', '0%');
      return;
    }

    const clampedValue = Math.min(max, Math.max(min, value));
    const progressPercent = ((clampedValue - min) / (max - min)) * 100;
    range.style.setProperty('--idle-range-progress', `${progressPercent}%`);
  };

	  useEffect(() => {
	    // Reactのstate更新（例: デフォルトへ戻す）だと "input" イベントが発火しないので、
	    // ここで明示的に進捗色を更新しておくよ。
	    updateIdleRangeProgress(opacityRangeRef.current);
	    updateIdleRangeProgress(blurRangeRef.current);
	    updateIdleRangeProgress(bgScaleRangeRef.current);
	    updateIdleRangeProgress(bgPosXRangeRef.current);
	    updateIdleRangeProgress(bgPosYRangeRef.current);
	  }, [open, prefs.opacity, prefs.blur, prefs.backgroundMode, prefs.backgroundImageDisplay, prefs.backgroundImageScale, prefs.backgroundImagePositionX, prefs.backgroundImagePositionY]);

  const handleBackdropPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // ポータル（カラーピッカー）内の操作でも React 的にはバブルしてくるので、
    // “本当に背景を押した時だけ”閉じるようにするよ。
    if (e.target !== e.currentTarget) return;
    onClose();
  };

  const tintPortalPos = useMemo(() => {
    if (!tintBtnRef.current) return { top: 40, left: 40 };
    const rect = tintBtnRef.current.getBoundingClientRect();
    const width = 340;
    const left = Math.min(window.innerWidth - width - 8, Math.max(8, rect.left));
    const top = rect.bottom + 8;
    return { top, left };
  }, [showTintPicker]);

  const bgColorPortalPos = useMemo(() => {
    if (!bgColorBtnRef.current) return { top: 40, left: 40 };
    const rect = bgColorBtnRef.current.getBoundingClientRect();
    const width = 340;
    const left = Math.min(window.innerWidth - width - 8, Math.max(8, rect.left));
    const top = rect.bottom + 8;
    return { top, left };
  }, [showBgColorPicker]);

  const handleBgModeChange = (mode: GlassPrefs['backgroundMode']) => {
    setBgImageErrorText('');
    onChange({ ...prefs, backgroundMode: mode });
  };

  const handleBgImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBgImageErrorText('');
    const file = e.target.files && e.target.files.length > 0 ? e.target.files[0] : null;
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setBgImageErrorText('画像ファイルを選んでね。');
      if (bgImageInputRef.current) bgImageInputRef.current.value = '';
      return;
    }
    if (file.size > MAX_BG_IMAGE_BYTES) {
      setBgImageErrorText('画像が大きすぎるよ。2MBまでにしてね。');
      if (bgImageInputRef.current) bgImageInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl.startsWith('data:image/')) {
        setBgImageErrorText('画像の読み込みに失敗したかも…もう一回やってみて！');
        if (bgImageInputRef.current) bgImageInputRef.current.value = '';
        return;
      }

      const nextPrefs: GlassPrefs = { ...prefs, backgroundMode: 'image', backgroundImageDataUrl: dataUrl };
      try {
        localStorage.setItem(GLASS_PREFS_STORAGE_KEY, JSON.stringify(nextPrefs));
      } catch {
        setBgImageErrorText('保存できなかったかも…容量がいっぱいっぽい！小さめ画像で試してね。');
        if (bgImageInputRef.current) bgImageInputRef.current.value = '';
        return;
      }
      onChange(nextPrefs);
      if (bgImageInputRef.current) bgImageInputRef.current.value = '';
    };
    reader.onerror = () => {
      setBgImageErrorText('画像の読み込みに失敗したかも…もう一回やってみて！');
      if (bgImageInputRef.current) bgImageInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleBgImageClear = () => {
    setBgImageErrorText('');
    if (bgImageInputRef.current) bgImageInputRef.current.value = '';
    onChange({ ...prefs, backgroundMode: 'color', backgroundImageDataUrl: null });
  };

  const canTransformBgImage =
    prefs.backgroundMode === 'image' &&
    !!prefs.backgroundImageDataUrl &&
    prefs.backgroundImageDisplay !== 'fit';

  const getPreviewSize = () => {
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return null;
    if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width <= 0 || rect.height <= 0) return null;
    return { width: rect.width, height: rect.height };
  };

  const getFirstTwoPointers = (pointers: Map<number, Point>) => {
    const it = pointers.values();
    const a = it.next().value as Point | undefined;
    const b = it.next().value as Point | undefined;
    if (!a || !b) return null;
    return { a, b };
  };

  const handlePreviewPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canTransformBgImage) return;
    if (e.button !== 0) return;
    e.preventDefault();

    const el = e.currentTarget;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    previewPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pointers = previewPointersRef.current;

    if (pointers.size === 1) {
      previewGestureRef.current = {
        mode: 'drag',
        startX: e.clientX,
        startY: e.clientY,
        startPosX: prefs.backgroundImagePositionX,
        startPosY: prefs.backgroundImagePositionY,
      };
      setPreviewInteracting(true);
      return;
    }

    if (pointers.size === 2) {
      const pair = getFirstTwoPointers(pointers);
      if (!pair) return;
      const centerX = (pair.a.x + pair.b.x) / 2;
      const centerY = (pair.a.y + pair.b.y) / 2;
      const dist = Math.hypot(pair.a.x - pair.b.x, pair.a.y - pair.b.y);
      previewGestureRef.current = {
        mode: 'pinch',
        startCenterX: centerX,
        startCenterY: centerY,
        startPosX: prefs.backgroundImagePositionX,
        startPosY: prefs.backgroundImagePositionY,
        startScale: prefs.backgroundImageScale,
        startDistance: Math.max(1, dist),
      };
      setPreviewInteracting(true);
    }
  };

  const handlePreviewPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canTransformBgImage) return;
    if (!previewPointersRef.current.has(e.pointerId)) return;
    e.preventDefault();

    previewPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const size = getPreviewSize();
    if (!size) return;

    const pointers = previewPointersRef.current;
    const gesture = previewGestureRef.current;

    if (gesture.mode === 'drag' && pointers.size === 1) {
      const dx = e.clientX - gesture.startX;
      const dy = e.clientY - gesture.startY;
      const nextX = clampNumber(gesture.startPosX - (dx / size.width) * 100, 0, 100);
      const nextY = clampNumber(gesture.startPosY - (dy / size.height) * 100, 0, 100);
      onChange({ ...prefs, backgroundImagePositionX: Math.round(nextX), backgroundImagePositionY: Math.round(nextY) });
      return;
    }

    if (gesture.mode === 'pinch' && pointers.size >= 2) {
      const pair = getFirstTwoPointers(pointers);
      if (!pair) return;
      const centerX = (pair.a.x + pair.b.x) / 2;
      const centerY = (pair.a.y + pair.b.y) / 2;
      const dist = Math.hypot(pair.a.x - pair.b.x, pair.a.y - pair.b.y);
      const ratio = dist / Math.max(1, gesture.startDistance);
      const nextScale = clampNumber(Math.round(gesture.startScale * ratio), 50, 200);

      const dx = centerX - gesture.startCenterX;
      const dy = centerY - gesture.startCenterY;
      const nextX = clampNumber(gesture.startPosX - (dx / size.width) * 100, 0, 100);
      const nextY = clampNumber(gesture.startPosY - (dy / size.height) * 100, 0, 100);

      onChange({
        ...prefs,
        backgroundImageScale: nextScale,
        backgroundImagePositionX: Math.round(nextX),
        backgroundImagePositionY: Math.round(nextY),
      });
    }
  };

  const endPreviewGestureIfNeeded = () => {
    if (previewPointersRef.current.size === 0) {
      previewGestureRef.current = { mode: 'none' };
      setPreviewInteracting(false);
    }
  };

  const handlePreviewPointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!previewPointersRef.current.has(e.pointerId)) return;
    previewPointersRef.current.delete(e.pointerId);

    const pointers = previewPointersRef.current;
    if (pointers.size === 1) {
      const remaining = pointers.values().next().value as Point | undefined;
      if (remaining) {
        previewGestureRef.current = {
          mode: 'drag',
          startX: remaining.x,
          startY: remaining.y,
          startPosX: prefs.backgroundImagePositionX,
          startPosY: prefs.backgroundImagePositionY,
        };
        setPreviewInteracting(true);
        return;
      }
    }

    endPreviewGestureIfNeeded();
  };

  const handlePreviewWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!canTransformBgImage) return;
    e.preventDefault();

    const delta = e.deltaY;
    if (!Number.isFinite(delta) || delta === 0) return;
    const zoom = Math.exp(-delta * 0.002);
    const nextScale = clampNumber(Math.round(prefs.backgroundImageScale * zoom), 50, 200);
    if (nextScale === prefs.backgroundImageScale) return;
    onChange({ ...prefs, backgroundImageScale: nextScale });
  };

  const handlePreviewDoubleClick = () => {
    if (prefs.backgroundMode !== 'image') return;
    onChange({
      ...prefs,
      backgroundImageScale: DEFAULT_GLASS_PREFS.backgroundImageScale,
      backgroundImagePositionX: DEFAULT_GLASS_PREFS.backgroundImagePositionX,
      backgroundImagePositionY: DEFAULT_GLASS_PREFS.backgroundImagePositionY,
    });
  };

  const handleResetBackgroundSection = () => {
    setBgImageErrorText('');
    setShowBgColorPicker(false);
    onChange({
      ...prefs,
      backgroundMode: DEFAULT_GLASS_PREFS.backgroundMode,
      backgroundColorHex: DEFAULT_GLASS_PREFS.backgroundColorHex,
      backgroundImageDisplay: DEFAULT_GLASS_PREFS.backgroundImageDisplay,
      backgroundImageScale: DEFAULT_GLASS_PREFS.backgroundImageScale,
      backgroundImagePositionX: DEFAULT_GLASS_PREFS.backgroundImagePositionX,
      backgroundImagePositionY: DEFAULT_GLASS_PREFS.backgroundImagePositionY,
    });
  };

  const handleResetGlassSection = () => {
    setShowTintPicker(false);
    onChange({
      ...prefs,
      tintHex: DEFAULT_GLASS_PREFS.tintHex,
      opacity: DEFAULT_GLASS_PREFS.opacity,
      blur: DEFAULT_GLASS_PREFS.blur,
    });
  };

  if (!open) return null;

	  return (
	    <div
	      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 px-4 glass-settings-overlay"
	      onPointerDown={handleBackdropPointerDown}
	    >
	      <div
	        className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-2xl p-5 space-y-4 glass-settings-panel glass-strong idle-sidebar-typography"
	      >
	        <div className="flex items-center justify-between">
	          <h3 className="text-slate-200 font-bold text-lg">ガラス設定</h3>
	          <button
            onClick={onClose}
            className="rounded-full p-2 border border-white/15 bg-white/10 text-slate-200 hover:bg-white/20 hover:text-white active:bg-white/30 transition-colors"
            aria-label="閉じる"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

	        <div className="text-[11px] text-slate-300 leading-relaxed">
	          この端末だけに保存されるよ。変えたらすぐ反映するよ。
	        </div>

		        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
		          {/* 左：背景 */}
		          <div className="space-y-4">
		            <div className="space-y-2 md:sticky md:top-0 md:z-10">
		              <div className="flex items-center justify-between">
		                <div className="text-xs text-slate-200 font-bold">プレビュー</div>
		                {prefs.backgroundMode === 'image' && (
		                  <div className="text-[10px] text-slate-400">
		                    ダブルクリックでリセット
		                  </div>
		                )}
		              </div>
		              <div
		                ref={previewRef}
		                className={`relative w-full aspect-video rounded-xl border border-white/15 overflow-hidden select-none ${canTransformBgImage ? (previewInteracting ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'}`}
		                style={{
		                  backgroundColor: 'var(--idle-bg-color)',
		                  backgroundImage: 'var(--idle-bg-image)',
		                  backgroundPosition: 'var(--idle-bg-position)',
		                  backgroundSize: 'var(--idle-bg-size)',
		                  backgroundRepeat: 'var(--idle-bg-repeat)',
		                  touchAction: 'none',
		                }}
		                onPointerDown={handlePreviewPointerDown}
		                onPointerMove={handlePreviewPointerMove}
		                onPointerUp={handlePreviewPointerUpOrCancel}
		                onPointerCancel={handlePreviewPointerUpOrCancel}
		                onWheel={handlePreviewWheel}
		                onDoubleClick={handlePreviewDoubleClick}
		              >
		                <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/10 via-transparent to-black/10" />
		                <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
		                  <div className="glass rounded-xl px-4 py-3 w-full max-w-[260px]">
		                    <div className="text-sm font-bold text-slate-200">ガラス</div>
		                    <div className="text-[10px] text-slate-400">ここで見え方を確認できるよ。</div>
		                  </div>
		                </div>
		              </div>
		              <div className="text-[10px] text-slate-400 leading-relaxed">
		                {canTransformBgImage
		                  ? (prefs.backgroundImageDisplay === 'tile'
		                    ? 'ドラッグでタイルをずらす／ホイール・ピンチで大きさ／ダブルクリックでリセット。'
		                    : 'ドラッグで移動／ホイール・ピンチでズーム／ダブルクリックでリセット。')
		                  : '画像モード（自由/タイル）でドラッグやズームが使えるよ。'}
		              </div>
		            </div>

		            <div className="space-y-2">
		              <div className="flex items-center justify-between">
		                <div className="text-xs text-slate-200 font-bold">背景</div>
		                <button
		                  onClick={handleResetBackgroundSection}
		                  className="px-2 py-1 text-[11px] rounded border transition-colors idle-btn-glass"
		                >
		                  リセット
		                </button>
		              </div>
		            <div className="grid grid-cols-3 gap-2 text-[11px]">
		              <button
		                onClick={() => handleBgModeChange('default')}
		                className={`py-2 rounded border transition-colors ${prefs.backgroundMode === 'default' ? 'idle-btn-primary' : 'idle-btn-glass'}`}
		              >
	                デフォルト
	              </button>
	              <button
	                onClick={() => handleBgModeChange('color')}
	                className={`py-2 rounded border transition-colors ${prefs.backgroundMode === 'color' ? 'idle-btn-primary' : 'idle-btn-glass'}`}
	              >
	                色
	              </button>
	              <button
	                onClick={() => handleBgModeChange('image')}
	                className={`py-2 rounded border transition-colors ${prefs.backgroundMode === 'image' ? 'idle-btn-primary' : 'idle-btn-glass'}`}
	              >
	                画像
	              </button>
	            </div>

	            {prefs.backgroundMode === 'default' ? (
	              <div className="text-[10px] text-slate-400">
	                いまの背景画像（固定）を使うよ。
	              </div>
	            ) : (
	              <div className="space-y-2">
	                <div className="text-[11px] text-slate-300">背景の色</div>
	                <div className="flex items-center gap-3">
	                  <button
	                    ref={bgColorBtnRef}
	                    onClick={() => setShowBgColorPicker((v) => !v)}
	                    className="w-12 h-10 rounded-md border border-slate-700 bg-slate-800/50 shadow-inner overflow-hidden"
	                    title="背景の色"
	                    aria-label="背景の色"
	                  >
	                    <span className="block w-full h-full" style={{ backgroundColor: prefs.backgroundColorHex || '#ffffff' }} />
	                  </button>
	                  <div className="text-xs font-mono text-slate-200">{(prefs.backgroundColorHex || '#ffffff').toUpperCase()}</div>
	                </div>
	              </div>
	            )}

		            {prefs.backgroundMode === 'image' && (
		              <div className="space-y-3">
		                <div className="space-y-2">
		                  <div className="text-[11px] text-slate-300">表示</div>
		                  <div className="grid grid-cols-3 gap-2 text-[11px]">
	                    <button
	                      onClick={() => onChange({ ...prefs, backgroundImageDisplay: 'custom' })}
	                      className={`py-2 rounded border transition-colors ${prefs.backgroundImageDisplay === 'custom' ? 'idle-btn-primary' : 'idle-btn-glass'}`}
	                    >
	                      自由
	                    </button>
	                    <button
	                      onClick={() => onChange({ ...prefs, backgroundImageDisplay: 'fit' })}
	                      className={`py-2 rounded border transition-colors ${prefs.backgroundImageDisplay === 'fit' ? 'idle-btn-primary' : 'idle-btn-glass'}`}
	                    >
	                      画面フィット
	                    </button>
	                    <button
	                      onClick={() => onChange({ ...prefs, backgroundImageDisplay: 'tile' })}
	                      className={`py-2 rounded border transition-colors ${prefs.backgroundImageDisplay === 'tile' ? 'idle-btn-primary' : 'idle-btn-glass'}`}
	                    >
	                      タイル
	                    </button>
	                  </div>
	                </div>

		                {prefs.backgroundImageDisplay === 'fit' ? (
		                  <div className="text-[10px] text-slate-400">画面フィットは、画像がぜんぶ見えるよ。</div>
		                ) : (
		                  <>
		                    <div className="space-y-2">
		                      <div className="flex items-center justify-between">
		                        <div className="text-xs text-slate-200 font-bold">{prefs.backgroundImageDisplay === 'tile' ? 'タイルの大きさ' : '画像の大きさ'}</div>
		                        <div className="text-[11px] text-slate-300 font-mono">{prefs.backgroundImageScale}%</div>
		                      </div>
	                      <input
	                        ref={bgScaleRangeRef}
	                        type="range"
	                        min="50"
	                        max="200"
	                        step="1"
	                        value={prefs.backgroundImageScale}
	                        onChange={(e) => onChange({ ...prefs, backgroundImageScale: parseInt(e.target.value, 10) })}
	                        className="w-full idle-range h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
	                        aria-label={prefs.backgroundImageDisplay === 'tile' ? 'タイルの大きさ' : '画像の大きさ'}
	                      />
	                      <div className="text-[10px] text-slate-400">
	                        {prefs.backgroundImageDisplay === 'tile'
	                          ? 'タイルが大きく/小さくなるよ。'
	                          : '大きくするとズーム、小さくすると全体が見えるよ。'}
	                      </div>
		                    </div>

		                    <div className="space-y-2">
		                      <div className="flex items-center justify-between">
		                        <div className="text-xs text-slate-200 font-bold">{prefs.backgroundImageDisplay === 'tile' ? 'タイルのずれ（左右）' : '位置（左右）'}</div>
		                        <div className="text-[11px] text-slate-300 font-mono">{prefs.backgroundImagePositionX}%</div>
		                      </div>
		                      <input
		                        ref={bgPosXRangeRef}
	                        type="range"
	                        min="0"
	                        max="100"
	                        step="1"
	                        value={prefs.backgroundImagePositionX}
	                        onChange={(e) => onChange({ ...prefs, backgroundImagePositionX: parseInt(e.target.value, 10) })}
	                        className="w-full idle-range h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
		                        aria-label={prefs.backgroundImageDisplay === 'tile' ? 'タイルのずれ（左右）' : '画像の位置（左右）'}
		                      />
		                    </div>

		                    <div className="space-y-2">
		                      <div className="flex items-center justify-between">
		                        <div className="text-xs text-slate-200 font-bold">{prefs.backgroundImageDisplay === 'tile' ? 'タイルのずれ（上下）' : '位置（上下）'}</div>
		                        <div className="text-[11px] text-slate-300 font-mono">{prefs.backgroundImagePositionY}%</div>
		                      </div>
		                      <input
		                        ref={bgPosYRangeRef}
	                        type="range"
	                        min="0"
	                        max="100"
	                        step="1"
	                        value={prefs.backgroundImagePositionY}
	                        onChange={(e) => onChange({ ...prefs, backgroundImagePositionY: parseInt(e.target.value, 10) })}
	                        className="w-full idle-range h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
		                        aria-label={prefs.backgroundImageDisplay === 'tile' ? 'タイルのずれ（上下）' : '画像の位置（上下）'}
		                      />
		                    </div>
		                  </>
		                )}

	                <div className="flex items-center justify-between">
	                  <div className="text-[11px] text-slate-300">背景の画像</div>
	                  {prefs.backgroundImageDataUrl && (
	                    <button onClick={handleBgImageClear} className="text-[10px] text-red-300 hover:text-red-200 hover:underline">
	                      削除
	                    </button>
	                  )}
	                </div>
	                <input type="file" accept="image/*" ref={bgImageInputRef} onChange={handleBgImageSelect} className="hidden" />
	                <div className="flex items-center gap-3">
	                  <button
	                    onClick={() => bgImageInputRef.current?.click()}
	                    className="px-3 py-2 text-sm rounded border transition-colors idle-btn-glass"
	                  >
	                    画像を選ぶ
	                  </button>
	                  <div className="flex items-center gap-2">
	                    <div
	                      className="w-10 h-7 rounded border border-white/20 bg-white/10 overflow-hidden"
	                      style={{
	                        backgroundImage: prefs.backgroundImageDataUrl ? `url(${prefs.backgroundImageDataUrl})` : 'none',
	                        backgroundSize: 'cover',
	                        backgroundPosition: 'center',
	                      }}
	                    />
	                    <div className="text-[10px] text-slate-400">
	                      {prefs.backgroundImageDataUrl ? '設定済み' : '未設定'}
	                    </div>
	                  </div>
	                </div>
	                {bgImageErrorText && (
	                  <div className="text-[10px] text-red-300">{bgImageErrorText}</div>
	                )}
	              </div>
		            )}
		            </div>
		          </div>

		          {/* 右：ガラス */}
		          <div className="space-y-3">
		            <div className="flex items-center justify-between">
		              <div className="text-xs text-slate-200 font-bold">ガラス</div>
		              <button
		                onClick={handleResetGlassSection}
		                className="px-2 py-1 text-[11px] rounded border transition-colors idle-btn-glass"
		              >
		                リセット
		              </button>
		            </div>
		            <div className="space-y-2">
		              <div className="text-xs text-slate-200 font-bold">ガラスの色</div>
		              <div className="flex items-center gap-3">
	                <button
	                  ref={tintBtnRef}
	                  onClick={() => setShowTintPicker((v) => !v)}
	                  className="w-12 h-10 rounded-md border border-slate-700 bg-slate-800/50 shadow-inner overflow-hidden"
	                  title="ガラスの色"
	                  aria-label="ガラスの色"
	                >
	                  <span className="block w-full h-full" style={{ backgroundColor: prefs.tintHex || '#ffffff' }} />
	                </button>
	                <div className="text-xs font-mono text-slate-200">{(prefs.tintHex || '#ffffff').toUpperCase()}</div>
	              </div>
	            </div>

	            <div className="space-y-2">
	              <div className="flex items-center justify-between">
	                <div className="text-xs text-slate-200 font-bold">透明度（うすさ）</div>
	                <div className="text-[11px] text-slate-300 font-mono">{prefs.opacity}%</div>
	              </div>
	              <input
	                ref={opacityRangeRef}
	                type="range"
	                min="0"
	                max="30"
	                step="1"
	                value={prefs.opacity}
	                onChange={(e) => onChange({ ...prefs, opacity: parseInt(e.target.value, 10) })}
	                className="w-full idle-range h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
	                aria-label="透明度"
	              />
	              <div className="text-[10px] text-slate-400">0%でほぼ透明、30%でしっかり白ガラスくらい。</div>
	            </div>

	            <div className="space-y-2">
	              <div className="flex items-center justify-between">
	                <div className="text-xs text-slate-200 font-bold">ぼかし（ブラー）</div>
	                <div className="text-[11px] text-slate-300 font-mono">{prefs.blur}px</div>
	              </div>
	              <input
	                ref={blurRangeRef}
	                type="range"
	                min="0"
	                max="30"
	                step="1"
	                value={prefs.blur}
	                onChange={(e) => onChange({ ...prefs, blur: parseInt(e.target.value, 10) })}
	                className="w-full idle-range h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
	                aria-label="ぼかし"
	              />
	              <div className="text-[10px] text-slate-400">0pxでぼかし無し、30pxでかなりぼけるよ（重くなるかも）。</div>
	            </div>
	          </div>
	        </div>

		        <div className="flex justify-between items-center">
		          <button
		            onClick={onReset}
	            className="px-3 py-2 text-sm rounded border transition-colors idle-btn-glass"
          >
            デフォルトに戻す
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded border transition-colors bg-blue-600 text-white border-blue-500/40 hover:bg-blue-500 idle-btn-primary"
          >
            閉じる
          </button>
        </div>
	      </div>

	      {showTintPicker && tintBtnRef.current && ReactDOM.createPortal(
	        <div style={{ position: 'fixed', top: tintPortalPos.top, left: tintPortalPos.left, zIndex: 9999 }}>
	          <ColorPickerPopover
	            value={prefs.tintHex}
	            onChange={(hex) => onChange({ ...prefs, tintHex: hex })}
	            onClose={() => setShowTintPicker(false)}
	          />
	        </div>,
	        document.body
	      )}

	      {showBgColorPicker && bgColorBtnRef.current && ReactDOM.createPortal(
	        <div style={{ position: 'fixed', top: bgColorPortalPos.top, left: bgColorPortalPos.left, zIndex: 9999 }}>
	          <ColorPickerPopover
	            value={prefs.backgroundColorHex}
	            onChange={(hex) => onChange({ ...prefs, backgroundColorHex: hex })}
	            onClose={() => setShowBgColorPicker(false)}
	          />
	        </div>,
	        document.body
	      )}
	    </div>
	  );
};

export default GlassSettingsModal;
