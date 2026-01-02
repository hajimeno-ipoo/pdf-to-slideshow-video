const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);

const getExtLower = (name) => {
  if (!name) return '';
  const m = String(name).toLowerCase().match(/\.([a-z0-9]+)$/i);
  return m ? m[1] : '';
};

const isPdfLike = (f) => {
  const type = (f && typeof f.type === 'string') ? f.type : '';
  if (type === 'application/pdf') return true;
  const ext = getExtLower(f && f.name);
  return ext === 'pdf';
};

const isImageLike = (f) => {
  const type = (f && typeof f.type === 'string') ? f.type : '';
  if (type.startsWith('image/')) return true;
  const ext = getExtLower(f && f.name);
  return IMAGE_EXTS.has(ext);
};

/**
 * @typedef {{ name?: string, type?: string }} FileLike
 * @typedef {{ kind: 'pdf', pdfFile: FileLike } | { kind: 'images', imageFiles: FileLike[] } | { kind: 'error', message: string }} UploadSelection
 */

/**
 * @param {ArrayLike<FileLike> | null | undefined} filesLike
 * @returns {UploadSelection}
 */
export const classifyUploadFiles = (filesLike) => {
  const files = filesLike ? Array.from(filesLike) : [];
  if (files.length === 0) return { kind: 'error', message: 'ファイルが選ばれてないよ。' };

  const pdfs = files.filter(isPdfLike);
  const images = files.filter(isImageLike);
  const others = files.filter((f) => !isPdfLike(f) && !isImageLike(f));

  if (others.length > 0) return { kind: 'error', message: 'PDFか画像（PNG/JPEG/GIF/WebP）を選んでね。' };
  if (pdfs.length > 0 && images.length > 0) return { kind: 'error', message: 'PDFと画像は一緒に選べないよ。どっちかだけにしてね。' };
  if (pdfs.length > 1) return { kind: 'error', message: 'PDFは1つだけ選んでね。' };
  if (pdfs.length === 1) return { kind: 'pdf', pdfFile: pdfs[0] };
  if (images.length > 0) return { kind: 'images', imageFiles: images };

  return { kind: 'error', message: '対応してないファイルっぽい…。' };
};

