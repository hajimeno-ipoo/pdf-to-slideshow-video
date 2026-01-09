const SUPPORTED_FONT_EXTS = ['woff2', 'woff', 'ttf', 'otf'];

export const getFontFileExtension = (fileName) => {
  if (typeof fileName !== 'string') return '';
  const base = fileName.split('/').pop() || '';
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return '';
  return base.slice(dot + 1).toLowerCase();
};

export const isSupportedFontFile = (file) => {
  const ext = getFontFileExtension(file?.name || '');
  return SUPPORTED_FONT_EXTS.includes(ext);
};

export const normalizeFontDisplayName = (fileName) => {
  if (typeof fileName !== 'string') return 'Custom Font';
  const base = fileName.split('/').pop() || '';
  const dot = base.lastIndexOf('.');
  const withoutExt = dot > 0 ? base.slice(0, dot) : (dot === 0 ? '' : base);
  const cleaned = withoutExt
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || 'Custom Font';
};

export const buildUniqueFontFamily = (existingFamilies, preferredFamily) => {
  const base = String(preferredFamily || '').trim() || 'Custom Font';
  const existing = existingFamilies instanceof Set
    ? existingFamilies
    : new Set(Array.isArray(existingFamilies) ? existingFamilies : []);

  if (!existing.has(base)) return base;
  for (let i = 2; i <= 999; i++) {
    const candidate = `${base} ${i}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${base} ${Date.now()}`;
};
