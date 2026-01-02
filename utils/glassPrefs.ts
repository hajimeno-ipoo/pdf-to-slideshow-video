export interface GlassPrefs {
  tintHex: string; // '#RRGGBB'
  opacity: number; // 0-30 (%), 14 = alpha 0.14
  blur: number; // 0-30 (px), 8 = 8px
  backgroundMode: 'default' | 'color' | 'image';
  backgroundColorHex: string; // '#RRGGBB'
  backgroundImageDataUrl: string | null; // data:image/*
  backgroundImageDisplay: 'custom' | 'fit' | 'tile';
  backgroundImageScale: number; // 50-200 (%)
  backgroundImagePositionX: number; // 0-100 (%)
  backgroundImagePositionY: number; // 0-100 (%)
}

export const GLASS_PREFS_STORAGE_KEY = 'pdfVideo_glassPrefs_v1';
const DEFAULT_IDLE_BG_IMAGE_URL = '/Doc/IMG_9349_BG.webp';

export const DEFAULT_GLASS_PREFS: GlassPrefs = {
  tintHex: '#ffffff',
  opacity: 14,
  blur: 8,
  backgroundMode: 'default',
  backgroundColorHex: '#ffffff',
  backgroundImageDataUrl: null,
  backgroundImageDisplay: 'custom',
  backgroundImageScale: 120,
  backgroundImagePositionX: 50,
  backgroundImagePositionY: 50,
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

  const modeRaw = typeof obj.backgroundMode === 'string' ? obj.backgroundMode : '';
  const backgroundMode: GlassPrefs['backgroundMode'] =
    modeRaw === 'default' || modeRaw === 'color' || modeRaw === 'image'
      ? modeRaw
      : DEFAULT_GLASS_PREFS.backgroundMode;

  const backgroundColorHex = normalizeHex(obj.backgroundColorHex) ?? DEFAULT_GLASS_PREFS.backgroundColorHex;

  const bgUrlRaw = typeof obj.backgroundImageDataUrl === 'string' ? obj.backgroundImageDataUrl : null;
  const backgroundImageDataUrl = bgUrlRaw && bgUrlRaw.startsWith('data:image/') ? bgUrlRaw : null;

  const displayRaw = typeof obj.backgroundImageDisplay === 'string' ? obj.backgroundImageDisplay : '';
  const backgroundImageDisplay: GlassPrefs['backgroundImageDisplay'] =
    displayRaw === 'custom' || displayRaw === 'fit' || displayRaw === 'tile'
      ? displayRaw
      : DEFAULT_GLASS_PREFS.backgroundImageDisplay;

  const legacyFitRaw = typeof obj.backgroundImageFit === 'string' ? obj.backgroundImageFit : '';
  const legacyScaleFromFit = legacyFitRaw === 'cover' ? 120 : legacyFitRaw === 'contain' ? 100 : null;

  const scaleRaw = typeof obj.backgroundImageScale === 'number' ? obj.backgroundImageScale : Number(obj.backgroundImageScale);
  const backgroundImageScale = Number.isFinite(scaleRaw)
    ? clamp(scaleRaw, 50, 200)
    : (legacyScaleFromFit ?? DEFAULT_GLASS_PREFS.backgroundImageScale);

  const posXRawNum = typeof obj.backgroundImagePositionX === 'number'
    ? obj.backgroundImagePositionX
    : Number(obj.backgroundImagePositionX);
  const posXRawStr = typeof obj.backgroundImagePositionX === 'string' ? obj.backgroundImagePositionX : '';
  const legacyPosXNum = posXRawStr === 'left' ? 0 : posXRawStr === 'center' ? 50 : posXRawStr === 'right' ? 100 : null;
  const backgroundImagePositionX = Number.isFinite(posXRawNum)
    ? clamp(posXRawNum, 0, 100)
    : (legacyPosXNum ?? DEFAULT_GLASS_PREFS.backgroundImagePositionX);

  const posYRawNum = typeof obj.backgroundImagePositionY === 'number'
    ? obj.backgroundImagePositionY
    : Number(obj.backgroundImagePositionY);
  const posYRawStr = typeof obj.backgroundImagePositionY === 'string' ? obj.backgroundImagePositionY : '';
  const legacyPosYNum = posYRawStr === 'top' ? 0 : posYRawStr === 'center' ? 50 : posYRawStr === 'bottom' ? 100 : null;
  const backgroundImagePositionY = Number.isFinite(posYRawNum)
    ? clamp(posYRawNum, 0, 100)
    : (legacyPosYNum ?? DEFAULT_GLASS_PREFS.backgroundImagePositionY);

  return {
    tintHex,
    opacity,
    blur,
    backgroundMode,
    backgroundColorHex,
    backgroundImageDataUrl,
    backgroundImageDisplay,
    backgroundImageScale,
    backgroundImagePositionX,
    backgroundImagePositionY,
  };
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
    '--idle-bg-color': prefs.backgroundColorHex,
    '--idle-bg-image':
      prefs.backgroundMode === 'default'
        ? `url("${DEFAULT_IDLE_BG_IMAGE_URL}")`
        : (prefs.backgroundMode === 'image' && prefs.backgroundImageDataUrl)
          ? `url("${prefs.backgroundImageDataUrl}")`
          : 'none',
    '--idle-bg-size':
      prefs.backgroundMode === 'image'
        ? (prefs.backgroundImageDisplay === 'fit'
          ? 'contain'
          : `${clamp(prefs.backgroundImageScale, 50, 200)}% auto`)
        : 'cover',
    '--idle-bg-position':
      prefs.backgroundMode === 'image'
        ? (prefs.backgroundImageDisplay === 'fit'
          ? 'center'
          : `${clamp(prefs.backgroundImagePositionX, 0, 100)}% ${clamp(prefs.backgroundImagePositionY, 0, 100)}%`)
        : 'center',
    '--idle-bg-repeat':
      (prefs.backgroundMode === 'image' && prefs.backgroundImageDisplay === 'tile')
        ? 'repeat'
        : 'no-repeat',
  };
};
