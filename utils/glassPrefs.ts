export interface GlassPrefs {
  tintHex: string; // '#RRGGBB'
  opacity: number; // 0-30 (%), 14 = alpha 0.14
  blur: number; // 0-30 (px), 8 = 8px
}

export const GLASS_PREFS_STORAGE_KEY = 'pdfVideo_glassPrefs_v1';

export const DEFAULT_GLASS_PREFS: GlassPrefs = {
  tintHex: '#ffffff',
  opacity: 14,
  blur: 8,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalizeHex = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!/^#?[0-9a-fA-F]{6}$/.test(v)) return null;
  return (v.startsWith('#') ? v : `#${v}`).toLowerCase();
};

const parseHexToRgb = (hex: string) => {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return { r, g, b };
};

export const normalizeGlassPrefs = (input: unknown): GlassPrefs => {
  const obj = (input && typeof input === 'object') ? (input as any) : {};
  const tintHex = normalizeHex(obj.tintHex) ?? DEFAULT_GLASS_PREFS.tintHex;

  const opacityRaw = typeof obj.opacity === 'number' ? obj.opacity : Number(obj.opacity);
  const opacity = Number.isFinite(opacityRaw) ? clamp(opacityRaw, 0, 30) : DEFAULT_GLASS_PREFS.opacity;

  const blurRaw = typeof obj.blur === 'number' ? obj.blur : Number(obj.blur);
  const blur = Number.isFinite(blurRaw) ? clamp(blurRaw, 0, 30) : DEFAULT_GLASS_PREFS.blur;

  return { tintHex, opacity, blur };
};

export const loadGlassPrefsFromLocalStorage = (): GlassPrefs | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(GLASS_PREFS_STORAGE_KEY);
    if (!raw) return null;
    return normalizeGlassPrefs(JSON.parse(raw));
  } catch {
    return null;
  }
};

export const saveGlassPrefsToLocalStorage = (prefs: GlassPrefs) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(GLASS_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
};

const roundAlpha = (a: number) => Math.round(a * 1000) / 1000;

export const computeIdleGlassCssVars = (prefs: GlassPrefs): Record<string, string> => {
  const rgb = parseHexToRgb(prefs.tintHex);
  if (!rgb) return {};

  const base = clamp(prefs.opacity / 100, 0, 0.3);
  const thin = clamp(base * 0.7, 0, 0.95);
  const strong = clamp(base * 1.3, 0, 0.95);

  const blurBase = clamp(prefs.blur, 0, 30);
  const blurThin = clamp(Math.round(blurBase * 0.75), 0, 60);
  const blurStrong = clamp(Math.round(blurBase * 1.25), 0, 60);

  const rgba = (a: number) => `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${roundAlpha(a)})`;

  return {
    '--idle-glass-bg-thin': rgba(thin),
    '--idle-glass-bg': rgba(base),
    '--idle-glass-bg-strong': rgba(strong),
    '--idle-glass-blur-thin': `${blurThin}px`,
    '--idle-glass-blur': `${Math.round(blurBase)}px`,
    '--idle-glass-blur-strong': `${blurStrong}px`,
  };
};
