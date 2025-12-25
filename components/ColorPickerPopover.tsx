import React, { useEffect, useMemo, useRef, useState } from 'react';

type Mode = 'hex' | 'hsl' | 'rgb';

interface Props {
  value: string;              // hex string (#rrggbb)
  onChange: (hex: string) => void;
  onClose?: () => void;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

// ---------- Conversions ----------
const hexToRgb = (hex: string) => {
  const m = hex.replace('#', '');
  if (m.length !== 6) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(m.slice(0, 2), 16),
    g: parseInt(m.slice(2, 4), 16),
    b: parseInt(m.slice(4, 6), 16),
  };
};

const rgbToHex = (r: number, g: number, b: number) => {
  const toHex = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const rgbToHsl = (r: number, g: number, b: number) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
};

const hslToRgb = (h: number, s: number, l: number) => {
  s /= 100; l /= 100;
  const C = (1 - Math.abs(2 * l - 1)) * s;
  const X = C * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - C / 2;
  let r1 = 0, g1 = 0, b1 = 0;
  if (0 <= h && h < 60) { r1 = C; g1 = X; b1 = 0; }
  else if (60 <= h && h < 120) { r1 = X; g1 = C; b1 = 0; }
  else if (120 <= h && h < 180) { r1 = 0; g1 = C; b1 = X; }
  else if (180 <= h && h < 240) { r1 = 0; g1 = X; b1 = C; }
  else if (240 <= h && h < 300) { r1 = X; g1 = 0; b1 = C; }
  else { r1 = C; g1 = 0; b1 = X; }
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
};

// ---------- Component ----------
const ColorPickerPopover: React.FC<Props> = ({ value, onChange, onClose }) => {
  const initialHex = value || '#ffffff';
  const initialHsl = useMemo(() => {
    const { r, g, b } = hexToRgb(initialHex);
    return rgbToHsl(r, g, b);
  }, [initialHex]);

  const wheelRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(initialHsl.h);
  const [s, setS] = useState(initialHsl.s);
  const [l, setL] = useState(initialHsl.l);
  const [mode, setMode] = useState<Mode>('hex');
  const [hexInput, setHexInput] = useState(initialHex);
  const [supportEyeDropper, setSupportEyeDropper] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 32, y: 32 });
  const draggingRef = useRef(false);
  const offsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    setSupportEyeDropper(typeof (window as any).EyeDropper !== 'undefined');
  }, []);

  // 初回に中央へ配置
  useEffect(() => {
    const w = popoverRef.current?.offsetWidth ?? 320;
    const hPx = popoverRef.current?.offsetHeight ?? 420;
    const cx = (window.innerWidth - w) / 2;
    const cy = (window.innerHeight - hPx) / 3;
    setPos({ x: Math.max(16, cx), y: Math.max(16, cy) });
  }, []);

  // ドラッグイベント
  const onDrag = (e: MouseEvent) => {
    if (!draggingRef.current) return;
    const w = popoverRef.current?.offsetWidth ?? 320;
    const hPx = popoverRef.current?.offsetHeight ?? 420;
    const nextX = e.clientX - offsetRef.current.x;
    const nextY = e.clientY - offsetRef.current.y;
    setPos({
      x: clamp(nextX, 0, Math.max(0, window.innerWidth - w)),
      y: clamp(nextY, 0, Math.max(0, window.innerHeight - hPx)),
    });
  };

  const stopDrag = () => { draggingRef.current = false; };

  useEffect(() => {
    const move = (e: MouseEvent) => onDrag(e);
    const up = () => stopDrag();
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  });

  const startDrag = (e: React.MouseEvent) => {
    draggingRef.current = true;
    offsetRef.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  };

  // propagate color
  useEffect(() => {
    const { r, g, b } = hslToRgb(h, s, l);
    const hex = rgbToHex(r, g, b);
    setHexInput(hex);
    onChange(hex);
  }, [h, s, l]);

  const handleHexChange = (v: string) => {
    const normalized = v.startsWith('#') ? v : `#${v}`;
    if (/^#?[0-9a-fA-F]{6}$/.test(normalized.replace('#', ''))) {
      const { r, g, b } = hexToRgb(normalized);
      const hsl = rgbToHsl(r, g, b);
      setH(hsl.h); setS(hsl.s); setL(hsl.l);
    }
    setHexInput(normalized);
  };

  const handleRgbChange = (r: number, g: number, b: number) => {
    const hsl = rgbToHsl(r, g, b);
    setH(hsl.h); setS(hsl.s); setL(hsl.l);
  };

  const handleEyeDrop = async () => {
    if (!(window as any).EyeDropper) return;
    try {
      const eye = new (window as any).EyeDropper();
      const res = await eye.open();
      handleHexChange(res.sRGBHex);
    } catch (e) {
      // canceled
    }
  };

  // positions for hue wheel pointer
  // 角度は「上0°, 時計回り」に統一
  // ポインタはホイール上でカーソル位置に重なるよう、リング中央半径で描画
  const radiusPx = 95; // outer radius 106px, ring幅約22px → 中央付近
  const center = 106; // 212pxコンテナの中心
  const theta = (h - 90) * (Math.PI / 180); // 上を0°にし時計回り
  const pointerX = radiusPx * Math.cos(theta) + center;
  const pointerY = radiusPx * Math.sin(theta) + center;

  const handleHuePointer = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    let deg = (Math.atan2(dy, dx) * 180) / Math.PI; // -180..180, 0=右
    deg = (deg + 450) % 360; // 上を0°, 時計回りに
    setH(deg);
  };

  return (
    <div
      ref={popoverRef}
      className="rounded-2xl bg-white/20 border border-white/25 shadow-2xl w-[320px] p-3 space-y-3 fixed backdrop-blur-xl backdrop-saturate-150 text-slate-900"
      style={{ left: pos.x, top: pos.y }}
    >
        <div
          className="cp-header flex items-center justify-between text-sm font-bold text-slate-900 select-none cursor-move"
          onMouseDown={startDrag}
        >
          <div className="flex items-center gap-2">
            <span>Color Picker</span>
            {supportEyeDropper && (
              <button
                onClick={handleEyeDrop}
                className="p-2 rounded bg-white/20 hover:bg-white/30 border border-white/25 text-slate-800"
                title="スポイト"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M21 3a3 3 0 0 0-5.12-2.12l-1.7 1.71-1.18-1.18a1 1 0 0 0-1.41 1.41l1.18 1.18-8.3 8.31A2 2 0 0 0 4 14.66V17a1 1 0 0 0 1 1h2.34a2 2 0 0 0 1.41-.59l8.31-8.31 1.18 1.18a1 1 0 1 0 1.41-1.41l-1.18-1.18L21 5.12A3 3 0 0 0 21 3Z"/>
                </svg>
              </button>
            )}
          </div>
          {onClose && (
            <button onClick={onClose} className="text-slate-500 hover:text-slate-900">✕</button>
          )}
        </div>

      <div className="flex justify-center">
        <div
          ref={wheelRef}
          className="relative w-[212px] h-[212px]"
          onMouseDown={(e) => handleHuePointer(e)}
          onMouseMove={(e) => e.buttons === 1 && handleHuePointer(e)}
        >
          <div
            className="absolute inset-0 rounded-full"
            style={{ background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }}
          />
          <div className="absolute inset-[22px] rounded-full" style={{
            background: `linear-gradient(180deg, #fff, hsl(${h}, ${s}%, ${l}%))`
          }} />
          <div className="absolute inset-[22px] rounded-full mix-blend-multiply" style={{
            background: `radial-gradient(circle at 50% 50%, rgba(0,0,0,${1 - l / 100}), transparent 70%)`
          }} />
          <div
            className="absolute w-3 h-3 rounded-full border-2 border-white shadow"
            style={{ left: pointerX, top: pointerY, transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}
            aria-hidden
          />
          {/* キーボード操作用の非表示レンジ。クリックは独自ハンドラで極座標計算 */}
          <input
            type="range"
            min={0}
            max={360}
            value={h}
            step={0.1}
            onChange={(e) => setH(parseFloat(e.target.value))}
            className="absolute inset-0 opacity-0 pointer-events-none"
            aria-label="Hue"
          />
        </div>
      </div>

      <div className="space-y-4">
        <Slider label="S" value={s} max={100} onChange={setS} gradient={`linear-gradient(90deg, hsl(${h},0%,${l}%), hsl(${h},100%,${l}%))`} />
        <Slider label="L" value={l} max={100} onChange={setL} gradient={`linear-gradient(90deg, black, hsl(${h},${s}%,50%), white)`} />
      </div>

      <div className="flex gap-1 text-xs font-semibold text-slate-700">
        {(['hex', 'hsl', 'rgb'] as Mode[]).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-1 rounded ${mode === m ? 'bg-white/75 text-slate-900 shadow-sm' : 'bg-white/20 text-slate-600 hover:text-slate-900 hover:bg-white/30'}`}
          >
            {m.toUpperCase()}
          </button>
        ))}
      </div>

      {mode === 'hex' && (
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full border border-black/10 shadow-inner" style={{ backgroundColor: hexInput }} />
          <input
            className="flex-1 bg-white/20 border border-white/25 rounded px-2 py-2 text-slate-900 uppercase"
            value={hexInput.replace('#', '').toUpperCase()}
            onChange={(e) => handleHexChange(e.target.value)}
            maxLength={6}
          />
        </div>
      )}

      {mode === 'hsl' && (
        <div className="grid grid-cols-3 gap-2 text-slate-900 text-xs">
          <NumberInput label="H" value={h} min={0} max={360} onChange={(v) => setH(clamp(v, 0, 360))} />
          <NumberInput label="S" value={s} min={0} max={100} onChange={(v) => setS(clamp(v, 0, 100))} />
          <NumberInput label="L" value={l} min={0} max={100} onChange={(v) => setL(clamp(v, 0, 100))} />
        </div>
      )}

      {mode === 'rgb' && (() => {
        const { r, g, b } = hslToRgb(h, s, l);
        return (
          <div className="grid grid-cols-3 gap-2 text-slate-900 text-xs">
            <NumberInput label="R" value={r} min={0} max={255} onChange={(v) => handleRgbChange(clamp(v, 0, 255), g, b)} />
            <NumberInput label="G" value={g} min={0} max={255} onChange={(v) => handleRgbChange(r, clamp(v, 0, 255), b)} />
            <NumberInput label="B" value={b} min={0} max={255} onChange={(v) => handleRgbChange(r, g, clamp(v, 0, 255))} />
          </div>
        );
      })()}
    </div>
  );
};

const Slider = ({ label, value, max, onChange, gradient }: { label: string; value: number; max: number; onChange: (v: number) => void; gradient: string; }) => (
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-600 w-6 text-right">{label}</span>
        <div className="flex-1 h-3 rounded-full relative" style={{ background: gradient }}>
          <input
            type="range"
            min={0}
            max={max}
            value={value}
            step={0.1}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            aria-label={label}
          />
          <div className="absolute top-1/2 w-3 h-3 rounded-full bg-white shadow border border-slate-300" style={{ left: `${(value / max) * 100}%`, transform: 'translate(-50%, -50%)', pointerEvents: 'none' }} />
    </div>
    <span className="text-xs text-slate-600 w-10 text-right">{Math.round(value)}</span>
  </div>
);

const NumberInput = ({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; }) => (
  <label className="flex flex-col gap-1 bg-white/20 border border-white/25 rounded px-2 py-1">
    <span className="text-[10px] text-slate-600">{label}</span>
    <input
      type="number"
      value={Number(value.toFixed(1))}
      min={min}
      max={max}
      step={0.1}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="bg-transparent text-slate-900 text-sm focus:outline-none"
    />
  </label>
);

export default ColorPickerPopover;
