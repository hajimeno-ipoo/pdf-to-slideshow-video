import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import ColorPickerPopover from './ColorPickerPopover';
import { GlassPrefs } from '../utils/glassPrefs';

interface Props {
  open: boolean;
  prefs: GlassPrefs;
  onChange: (next: GlassPrefs) => void;
  onReset: () => void;
  onClose: () => void;
}

const GlassSettingsModal: React.FC<Props> = ({ open, prefs, onChange, onReset, onClose }) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) setShowColorPicker(false);
  }, [open]);

  const handleBackdropPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // ポータル（カラーピッカー）内の操作でも React 的にはバブルしてくるので、
    // “本当に背景を押した時だけ”閉じるようにするよ。
    if (e.target !== e.currentTarget) return;
    onClose();
  };

  const portalPos = useMemo(() => {
    if (!colorBtnRef.current) return { top: 40, left: 40 };
    const rect = colorBtnRef.current.getBoundingClientRect();
    const width = 340;
    const left = Math.min(window.innerWidth - width - 8, Math.max(8, rect.left));
    const top = rect.bottom + 8;
    return { top, left };
  }, [showColorPicker]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 px-4 glass-settings-overlay"
      onPointerDown={handleBackdropPointerDown}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-md p-5 space-y-4 glass-settings-panel glass-strong idle-sidebar-typography"
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

        <div className="space-y-2">
          <div className="text-xs text-slate-200 font-bold">ガラスの色</div>
          <div className="flex items-center gap-3">
            <button
              ref={colorBtnRef}
              onClick={() => setShowColorPicker((v) => !v)}
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

      {showColorPicker && colorBtnRef.current && ReactDOM.createPortal(
        <div style={{ position: 'fixed', top: portalPos.top, left: portalPos.left, zIndex: 9999 }}>
          <ColorPickerPopover
            value={prefs.tintHex}
            onChange={(hex) => onChange({ ...prefs, tintHex: hex })}
            onClose={() => setShowColorPicker(false)}
          />
        </div>,
        document.body
      )}
    </div>
  );
};

export default GlassSettingsModal;
