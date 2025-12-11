import React, { useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import ColorPickerPopover from '../ColorPickerPopover';

interface InlineColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
  className?: string;
}

/**
 * 小さめのスウォッチボタンで ColorPickerPopover を開く共通部品。
 * ボタンの位置に追従してポータル表示するよ。
 */
const InlineColorPicker: React.FC<InlineColorPickerProps> = ({ value, onChange, className }) => {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const portalPos = useMemo(() => {
    if (!btnRef.current) return { top: 40, left: 40 };
    const rect = btnRef.current.getBoundingClientRect();
    const width = 320;
    const left = Math.min(window.innerWidth - width - 8, Math.max(8, rect.left));
    const top = rect.bottom + 8;
    return { top, left };
  }, [open]);

  return (
    <div className={className}>
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className="h-10 w-full rounded border border-slate-600 bg-slate-800/50 shadow-inner overflow-hidden"
      >
        <span className="block w-full h-full" style={{ backgroundColor: value || '#000000' }} />
      </button>
      {open && btnRef.current && ReactDOM.createPortal(
        <div style={{ position: 'fixed', top: portalPos.top, left: portalPos.left, zIndex: 9999 }}>
          <ColorPickerPopover value={value} onChange={onChange} onClose={() => setOpen(false)} />
        </div>,
        document.body
      )}
    </div>
  );
};

export default InlineColorPicker;
