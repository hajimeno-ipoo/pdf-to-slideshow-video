
import { Slide, AspectRatio, Resolution, VideoSettings, EffectType, Overlay, BgmTimeRange, FadeOptions, TokenUsage, TransitionType, DuckingOptions } from '../types';
import { PDFDocumentProxy, PDFPageProxy, PDFJSStatic } from '../types/pdfTypes';
import { generateSlideScript, wait } from './geminiService';
import { fileToBase64 } from '../utils/fileUtils';
import { VIDEO_WORKER_CODE } from './videoWorkerScript';
import { safeRandomUUID } from '../utils/uuid';

declare const pdfjsLib: PDFJSStatic;

// Easing Functions
const easeOutBack = (x: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

const easeInBack = (x: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return c3 * x * x * x - c1 * x * x;
};

export const initPdfJs = () => {
  if (typeof pdfjsLib === 'undefined') {
    return;
  }
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
};

interface PageBound {
  x: number; y: number; width: number; height: number; originalWidth: number; originalHeight: number; pageIndex: number;
}

const analyzePageContent = async (page: PDFPageProxy, pageIndex: number): Promise<PageBound> => {
  const scale = 0.5;
  const viewport = page.getViewport({ scale });
  const originalViewport = page.getViewport({ scale: 1.0 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width; canvas.height = viewport.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas context creation failed");
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
  let hasContent = false;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4;
      if (data[i] < 252 || data[i+1] < 252 || data[i+2] < 252) {
        if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
        hasContent = true;
      }
    }
  }
  const fullWidth = originalViewport.width;
  const fullHeight = originalViewport.height;
  if (!hasContent) return { x: 0, y: 0, width: fullWidth, height: fullHeight, originalWidth: fullWidth, originalHeight: fullHeight, pageIndex };
  let detectedW = maxX - minX; let detectedH = maxY - minY;
  if ((detectedW * detectedH) < (canvas.width * canvas.height * 0.03)) return { x: 0, y: 0, width: fullWidth, height: fullHeight, originalWidth: fullWidth, originalHeight: fullHeight, pageIndex };
  const padding = 10;
  minX = Math.max(0, minX - padding); minY = Math.max(0, minY - padding);
  maxX = Math.min(canvas.width, maxX + padding); maxY = Math.min(canvas.height, maxY + padding);
  return { x: minX / scale, y: minY / scale, width: (maxX - minX) / scale, height: (maxY - minY) / scale, originalWidth: fullWidth, originalHeight: fullHeight, pageIndex };
};

const generateThumbnail = async (pdf: PDFDocumentProxy, bound: PageBound): Promise<string> => {
  const targetThumbWidth = 300;
  const scale = targetThumbWidth / bound.width;
  const page = await pdf.getPage(bound.pageIndex);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = bound.width * scale; canvas.height = bound.height * scale;
  const ctx = canvas.getContext('2d'); if (!ctx) return "";
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = viewport.width; tempCanvas.height = viewport.height;
  const tempCtx = tempCanvas.getContext('2d'); if (!tempCtx) return "";
  tempCtx.fillStyle = 'white'; tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
  const renderContext = {
      canvasContext: tempCtx,
      viewport: viewport,
      transform: [1, 0, 0, 1, -bound.x * scale, -bound.y * scale] // Apply negative translation for crop
  };
  await page.render(renderContext).promise;
  ctx.drawImage(tempCanvas, 0, 0); 
  return canvas.toDataURL('image/jpeg', 0.8);
};

const getWrappedLines = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
    const paragraphs = text.split('\n');
    const lines: string[] = [];
    paragraphs.forEach(paragraph => {
        if (paragraph === '') { lines.push(''); return; }
        let currentLine = '';
        const chars = paragraph.split('');
        for (let i = 0; i < chars.length; i++) {
            const char = chars[i];
            const testLine = currentLine + char;
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && i > 0) { lines.push(currentLine); currentLine = char; } else { currentLine = testLine; }
        }
        lines.push(currentLine);
    });
    return lines;
};

const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image(); img.crossOrigin = "anonymous"; img.onload = () => resolve(img); img.onerror = reject; img.src = src;
    });
};

export const drawOverlays = async (ctx: CanvasRenderingContext2D, overlays: Overlay[], canvasWidth: number, canvasHeight: number, currentTime?: number, slideDuration?: number, imageCache?: Map<string, HTMLImageElement>, transitionDuration: number = 0) => {
  if (!overlays || overlays.length === 0) return;
  const baseDuration = 1.0;
  const contentDuration = Math.max(0, (slideDuration || 0) - transitionDuration);
  const animationDuration = (contentDuration < 2.0) ? Math.min(baseDuration, contentDuration / 2) : baseDuration;
  const OFFSET_RATIO = 0.2; 
  const shadowScale = canvasHeight / 500;

  for (const overlay of overlays) {
    ctx.save();
    let alpha = overlay.opacity !== undefined ? overlay.opacity : 1.0;
    let offsetX = 0; let offsetY = 0; let scale = 1; let rotation = overlay.rotation || 0; let typewriterProgress = 1.0;
    let clipProgress = 1.0; let clipDirection: 'right' | 'down' | null = null;

    if (currentTime !== undefined && slideDuration !== undefined) {
        if (overlay.animationIn && overlay.animationIn !== 'none') {
            const progress = Math.min(1, Math.max(0, currentTime / animationDuration));
            const easeOut = 1 - Math.pow(1 - progress, 3);
            switch (overlay.animationIn) {
                case 'fade': alpha *= easeOut; break;
                case 'pop': scale = easeOutBack(progress); alpha *= Math.min(1, progress * 2); break;
                case 'slide-up': offsetY += (1 - easeOut) * (canvasHeight * OFFSET_RATIO); alpha *= easeOut; break;
                case 'slide-down': offsetY -= (1 - easeOut) * (canvasHeight * OFFSET_RATIO); alpha *= easeOut; break;
                case 'slide-left': offsetX -= (1 - easeOut) * (canvasWidth * OFFSET_RATIO); alpha *= easeOut; break;
                case 'slide-right': offsetX += (1 - easeOut) * (canvasWidth * OFFSET_RATIO); alpha *= easeOut; break;
                case 'zoom': scale = easeOut; alpha *= easeOut; break;
                case 'rotate-cw': rotation += (1 - easeOut) * -180; alpha *= easeOut; break;
                case 'rotate-ccw': rotation += (1 - easeOut) * 180; alpha *= easeOut; break;
                case 'wipe-right': clipProgress = easeOut; clipDirection = 'right'; break;
                case 'wipe-down': clipProgress = easeOut; clipDirection = 'down'; break;
                case 'typewriter': typewriterProgress = progress; break;
            }
        }
        if (overlay.animationOut && overlay.animationOut !== 'none') {
            const startTime = contentDuration - animationDuration;
            if (currentTime > startTime) {
                const progress = Math.min(1, Math.max(0, (currentTime - startTime) / animationDuration));
                const easeIn = Math.pow(progress, 3);
                switch (overlay.animationOut) {
                    case 'fade': alpha *= (1 - easeIn); break;
                    case 'pop': scale = easeInBack(1 - progress); alpha *= (1 - progress); break;
                    case 'slide-up': offsetY -= easeIn * (canvasHeight * OFFSET_RATIO); alpha *= (1 - easeIn); break;
                    case 'slide-down': offsetY += easeIn * (canvasHeight * OFFSET_RATIO); alpha *= (1 - easeIn); break;
                    case 'slide-left': offsetX -= easeIn * (canvasWidth * OFFSET_RATIO); alpha *= (1 - easeIn); break;
                    case 'slide-right': offsetX += easeIn * (canvasWidth * OFFSET_RATIO); alpha *= (1 - easeIn); break;
                    case 'zoom': scale = 1 + easeIn * 0.5; alpha *= (1 - easeIn); break;
                    case 'rotate-cw': rotation += easeIn * 180; alpha *= (1 - easeIn); break;
                    case 'rotate-ccw': rotation += easeIn * -180; alpha *= (1 - easeIn); break;
                    case 'wipe-right': clipProgress = 1 - easeIn; clipDirection = 'right'; break;
                    case 'wipe-down': clipProgress = 1 - easeIn; clipDirection = 'down'; break;
                }
            }
        }
    }

    const x = overlay.x * canvasWidth + offsetX;
    const y = overlay.y * canvasHeight + offsetY;
    ctx.translate(x, y);
    if (scale !== 1) ctx.scale(scale, scale);
    if (rotation !== 0) ctx.rotate((rotation * Math.PI) / 180);
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

    let textInfo = null;
    if (overlay.type === 'text' && overlay.text) {
        const fontSizePx = (overlay.fontSize || 5) / 100 * canvasHeight;
        const fontFamily = overlay.fontFamily || 'Noto Sans JP';
        const fontWeight = overlay.isBold ? 'bold' : 'normal';
        const fontStyle = overlay.isItalic ? 'italic' : 'normal';
        const lineHeight = fontSizePx * 1.2;
        ctx.font = `${fontStyle} ${fontWeight} ${fontSizePx}px "${fontFamily}", sans-serif`;
        let lines: string[]; let displayText = overlay.text;
        if (overlay.animationIn === 'typewriter' && typewriterProgress < 1.0) {
            const totalLength = displayText.length;
            const currentLength = Math.floor(totalLength * typewriterProgress);
            displayText = displayText.substring(0, currentLength);
        }
        let maxLineWidth = 0;
        if (overlay.width && overlay.width > 0) {
            const maxWidth = overlay.width * canvasWidth;
            lines = getWrappedLines(ctx, displayText, maxWidth);
            maxLineWidth = maxWidth;
        } else {
            lines = displayText.split('\n');
            lines.forEach(line => { const m = ctx.measureText(line); if (m.width > maxLineWidth) maxLineWidth = m.width; });
        }
        textInfo = { lines, fontSizePx, lineHeight, maxLineWidth, fontFamily, fontWeight, fontStyle };
    }

    if (clipDirection) {
        let w = 0, h = 0; let cx = 0, cy = 0;
        if (overlay.type === 'text' && textInfo) {
            const padPx = (overlay.backgroundPadding || 0) * (textInfo.fontSizePx / 5);
            w = textInfo.maxLineWidth + padPx * 2; h = textInfo.lines.length * textInfo.lineHeight + padPx * 2; cx = -w/2; cy = -h/2;
        } else {
            w = (overlay.width || 0.2) * canvasWidth; h = (overlay.height || 0.2) * canvasHeight; cx = -w/2; cy = -h/2;
        }
        ctx.beginPath();
        if (clipDirection === 'right') ctx.rect(cx, cy, w * clipProgress, h); else ctx.rect(cx, cy, w, h * clipProgress);
        ctx.clip();
    }

    if (overlay.type === 'text' && textInfo) {
        const { lines, fontSizePx, lineHeight, maxLineWidth } = textInfo;
        const textAlign = overlay.textAlign || 'center';
        ctx.textBaseline = 'middle'; ctx.textAlign = textAlign;
        const padPx = (overlay.backgroundPadding || 0) * (fontSizePx / 5);
        const totalTextHeight = lines.length * lineHeight;
        const boxWidth = maxLineWidth + padPx * 2;
        const boxHeight = totalTextHeight + padPx * 2;
        if (overlay.backgroundColor && overlay.backgroundColor !== 'transparent') {
            ctx.fillStyle = overlay.backgroundColor;
            const radius = (overlay.borderRadius || 0) * (fontSizePx / 10);
            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') ctx.roundRect(-boxWidth/2, -boxHeight/2, boxWidth, boxHeight, radius);
            else ctx.rect(-boxWidth/2, -boxHeight/2, boxWidth, boxHeight);
            ctx.fill();
        }
        const startY = -boxHeight/2 + padPx + lineHeight/2;
        let startX = 0;
        if (textAlign === 'center') startX = 0; else if (textAlign === 'left') startX = -boxWidth/2 + padPx; else if (textAlign === 'right') startX = boxWidth/2 - padPx;
        if (overlay.shadowColor && overlay.shadowColor !== 'transparent') {
            ctx.shadowColor = overlay.shadowColor; ctx.shadowBlur = (overlay.shadowBlur || 0) * shadowScale;
            ctx.shadowOffsetX = (overlay.shadowOffsetX || 0) * shadowScale; ctx.shadowOffsetY = (overlay.shadowOffsetY || 0) * shadowScale;
        }
        lines.forEach((line, index) => {
            const yOffset = startY + index * lineHeight;
            if (overlay.strokeWidth && overlay.strokeWidth > 0 && overlay.strokeColor) {
                ctx.lineWidth = overlay.strokeWidth * (canvasHeight / 500); ctx.strokeStyle = overlay.strokeColor; ctx.lineJoin = 'round'; ctx.strokeText(line, startX, yOffset);
            }
            ctx.fillStyle = overlay.color || '#ffffff'; ctx.fillText(line, startX, yOffset);
        });
    } else if (overlay.type === 'arrow') {
        const w = (overlay.width || 0.2) * canvasWidth; const h = (overlay.height || 0.05) * canvasHeight; const color = overlay.color || '#ff0000';
        const shaftThickness = (overlay.strokeWidth || 5) * (canvasHeight / 500);
        ctx.fillStyle = color;
        if (overlay.shadowColor) { ctx.shadowColor = overlay.shadowColor; ctx.shadowBlur = (overlay.shadowBlur || 0) * shadowScale; ctx.shadowOffsetX = (overlay.shadowOffsetX || 0) * shadowScale; ctx.shadowOffsetY = (overlay.shadowOffsetY || 0) * shadowScale; }
        const headHeight = h; const headLength = Math.min(w, headHeight); const shaftLength = Math.max(0, w - headLength); const shaftY = -shaftThickness / 2;
        ctx.beginPath(); ctx.rect(-w/2, shaftY, shaftLength, shaftThickness); ctx.moveTo(-w/2 + shaftLength, -headHeight/2); ctx.lineTo(w/2, 0); ctx.lineTo(-w/2 + shaftLength, headHeight/2); ctx.closePath(); ctx.fill();
    } else if (overlay.type === 'rect' || overlay.type === 'circle') {
        const w = (overlay.width || 0.2) * canvasWidth; const h = (overlay.height || 0.2) * canvasHeight;
        const strokeColor = overlay.color || '#ff0000'; const fillColor = overlay.backgroundColor || 'transparent';
        const lineWidth = (overlay.strokeWidth || 3) * (canvasHeight / 500);
        ctx.strokeStyle = strokeColor; ctx.fillStyle = fillColor; ctx.lineWidth = lineWidth;
        if (overlay.shadowColor) { ctx.shadowColor = overlay.shadowColor; ctx.shadowBlur = (overlay.shadowBlur || 0) * shadowScale; ctx.shadowOffsetX = (overlay.shadowOffsetX || 0) * shadowScale; ctx.shadowOffsetY = (overlay.shadowOffsetY || 0) * shadowScale; }
        if (overlay.type === 'rect') {
            const radius = (overlay.borderRadius || 0) * (Math.min(w, h) / 10);
            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') ctx.roundRect(-w/2, -h/2, w, h, radius); else ctx.rect(-w/2, -h/2, w, h);
        } else {
            ctx.beginPath(); ctx.ellipse(0, 0, w/2, h/2, 0, 0, 2 * Math.PI);
        }
        if (fillColor && fillColor !== 'transparent') ctx.fill();
        if (lineWidth > 0) ctx.stroke();
    } else if (overlay.type === 'line') {
        const w = (overlay.width || 0.2) * canvasWidth; const thickness = (overlay.strokeWidth || 5) * (canvasHeight / 500); const color = overlay.color || '#ff0000';
        ctx.strokeStyle = color; ctx.lineWidth = thickness; ctx.lineCap = overlay.strokeLineCap || 'butt';
        if (overlay.borderStyle === 'dashed') ctx.setLineDash([thickness * 3, thickness * 2]);
        else if (overlay.borderStyle === 'dotted') ctx.setLineDash(overlay.strokeLineCap === 'round' ? [0, thickness * 2] : [thickness, thickness]); else ctx.setLineDash([]);
        if (overlay.shadowColor) { ctx.shadowColor = overlay.shadowColor; ctx.shadowBlur = (overlay.shadowBlur || 0) * shadowScale; ctx.shadowOffsetX = (overlay.shadowOffsetX || 0) * shadowScale; ctx.shadowOffsetY = (overlay.shadowOffsetY || 0) * shadowScale; }
        ctx.beginPath(); ctx.moveTo(-w/2, 0); ctx.lineTo(w/2, 0); ctx.stroke(); ctx.setLineDash([]);
    } else if (overlay.type === 'image' && overlay.imageData) {
        try {
            let img;
            if (imageCache && imageCache.has(overlay.id)) { img = imageCache.get(overlay.id)!; } else { img = await loadImage(overlay.imageData); if (imageCache) imageCache.set(overlay.id, img); }
            const w = (overlay.width || 0.2) * canvasWidth; const h = (overlay.height || 0.2) * canvasHeight;
            if (overlay.shadowColor) { ctx.shadowColor = overlay.shadowColor; ctx.shadowBlur = (overlay.shadowBlur || 0) * shadowScale; ctx.shadowOffsetX = (overlay.shadowOffsetX || 0) * shadowScale; ctx.shadowOffsetY = (overlay.shadowOffsetY || 0) * shadowScale; }
            ctx.drawImage(img, -w/2, -h/2, w, h);
        } catch (e) { /* ignore */ }
    }
    ctx.restore();
  }
};

export const getVideoDimensions = (aspectRatio: AspectRatio, resolution: Resolution) => {
  let width = 1920; let height = 1080;
  if (resolution === '720p') { width = 1280; height = 720; }
  switch (aspectRatio) {
    case '16:9': break;
    case '4:3': width = resolution === '1080p' ? 1440 : 960; break;
    case '1:1': width = resolution === '1080p' ? 1080 : 720; break;
    case '9:16': height = resolution === '1080p' ? 1920 : 1280; width = resolution === '1080p' ? 1080 : 720; break;
  }
  if (width % 2 !== 0) width -= 1; if (height % 2 !== 0) height -= 1;
  return { width, height };
};

export const getKenBurnsParams = (id: string) => {
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const directions = ['zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'pan-up', 'pan-down'];
    const direction = directions[hash % directions.length];
    const startScale = 1.0 + ((hash % 10) / 100); const endScale = 1.15 + ((hash % 5) / 100);
    const panX = ((hash % 20) - 10) / 200; const panY = ((hash % 20) - 10) / 200;
    return { direction, startScale, endScale, panX, panY };
};

export const renderBackground = (ctx: CanvasRenderingContext2D, width: number, height: number, fill: string, bgImage: ImageBitmap | HTMLImageElement | null) => {
    if (bgImage) {
        const imgRatio = bgImage.width / bgImage.height; const canvasRatio = width / height; let drawW, drawH, offsetX, offsetY;
        if (imgRatio > canvasRatio) { drawH = height; drawW = height * imgRatio; offsetX = -(drawW - width) / 2; offsetY = 0; } else { drawW = width; drawH = width / imgRatio; offsetX = 0; offsetY = -(drawH - height) / 2; }
        ctx.drawImage(bgImage, offsetX, offsetY, drawW, drawH);
    } else { ctx.fillStyle = fill; ctx.fillRect(0, 0, width, height); }
};

export const renderSlideToImage = async (pdfDoc: PDFDocumentProxy | null, slide: Slide, targetWidth: number, targetHeight: number, settings: VideoSettings): Promise<ImageBitmap> => {
    const canvas = document.createElement('canvas'); const scaleFactor = 1.5; 
    canvas.width = targetWidth * scaleFactor; canvas.height = targetHeight * scaleFactor;
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error("Canvas context failed");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (slide.pageIndex > 0 && pdfDoc) {
        const page = await pdfDoc.getPage(slide.pageIndex);
        const crop = slide.crop;
        const tempCanvas = document.createElement('canvas');
        const tempScale = Math.min(2.0, 2000 / crop.width); 
        const viewportScaled = page.getViewport({ scale: tempScale });
        tempCanvas.width = crop.width * tempScale; tempCanvas.height = crop.height * tempScale;
        const tempCtx = tempCanvas.getContext('2d'); if (!tempCtx) throw new Error("Temp Canvas failed");
        const renderContext = { canvasContext: tempCtx, viewport: viewportScaled, transform: [1, 0, 0, 1, -crop.x * tempScale, -crop.y * tempScale] };
        await page.render(renderContext).promise;
        return createImageBitmap(tempCanvas);
    } else if (slide.customImageFile) {
        return createImageBitmap(slide.customImageFile);
    } else if (slide.backgroundColor) {
        ctx.fillStyle = slide.backgroundColor; ctx.fillRect(0, 0, canvas.width, canvas.height);
        return createImageBitmap(canvas);
    }
    return createImageBitmap(canvas);
};

export const drawSlideFrame = async (ctx: CanvasRenderingContext2D, slideImage: ImageBitmap, width: number, height: number, effectType: EffectType, kenBurns: any, progress: number, slide: Slide, settings: VideoSettings, currentTime: number, imageCache?: Map<string, HTMLImageElement>, skipOverlays: boolean = false) => {
    const slideScale = settings.slideScale / 100; const radius = settings.slideBorderRadius;
    let kbScale = 1.0; let kbX = 0; let kbY = 0;
    if (effectType === 'kenburns' && kenBurns) {
        const p = progress;
        const { direction, startScale, endScale, panX, panY } = kenBurns;
        kbScale = startScale + (endScale - startScale) * p;
        if (direction.includes('pan')) { kbX = panX * width * p; kbY = panY * height * p; }
        if (direction === 'zoom-out') { kbScale = endScale + (startScale - endScale) * p; }
    }
    const availableW = width * slideScale; const availableH = height * slideScale;
    const imgRatio = slideImage.width / slideImage.height;
    let finalW = availableW; let finalH = availableW / imgRatio;
    if (finalH > availableH) { finalH = availableH; finalW = availableH * imgRatio; }
    const centerX = width / 2; const centerY = height / 2;
    const drawW = finalW * kbScale; const drawH = finalH * kbScale;
    const drawX = centerX - (drawW / 2) + kbX; const drawY = centerY - (drawH / 2) + kbY;
    ctx.save();
    if (radius > 0) {
        const clipX = centerX - finalW/2; const clipY = centerY - finalH/2;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') { ctx.roundRect(clipX, clipY, finalW, finalH, radius); } else { ctx.rect(clipX, clipY, finalW, finalH); }
        ctx.clip();
    }
    ctx.drawImage(slideImage, drawX, drawY, drawW, drawH);
    ctx.restore();
    if (slide.overlays && !skipOverlays) {
        const slideRectX = centerX - finalW/2; const slideRectY = centerY - finalH/2;
        const transDuration = slide.transitionType === 'none' ? 0 : (slide.transitionDuration !== undefined ? slide.transitionDuration : settings.transitionDuration);
        ctx.save();
        ctx.translate(slideRectX, slideRectY);
        await drawOverlays(ctx, slide.overlays, finalW, finalH, currentTime, slide.duration, imageCache, transDuration);
        ctx.restore();
    }
};

export const renderPageOverview = async (sourceFile: File | null, slide: Slide): Promise<string> => {
    if (slide.customImageFile) { const b64 = await fileToBase64(slide.customImageFile); return `data:${slide.customImageFile.type};base64,${b64}`; }
    if (sourceFile && slide.pageIndex > 0) {
        initPdfJs(); const arrayBuffer = await sourceFile.arrayBuffer(); const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        const page = await pdf.getPage(slide.pageIndex);
        const viewport = page.getViewport({ scale: 2.0 }); 
        const canvas = document.createElement('canvas'); canvas.width = viewport.width; canvas.height = viewport.height;
        const ctx = canvas.getContext('2d'); if(!ctx) return "";
        await page.render({ canvasContext: ctx, viewport }).promise;
        return canvas.toDataURL('image/jpeg', 0.8);
    }
    if (slide.backgroundColor) {
        const canvas = document.createElement('canvas'); canvas.width = 1920; canvas.height = 1080;
        const ctx = canvas.getContext('2d'); if(ctx){ ctx.fillStyle = slide.backgroundColor; ctx.fillRect(0,0,1920,1080); }
        return canvas.toDataURL('image/jpeg', 0.8);
    }
    return "";
};

export const analyzePdf = async (
  file: File, 
  durationPerSlide: number, 
  transitionType: TransitionType,
  onProgress?: (current: number, total: number) => void,
  autoGenerateScript: boolean = false,
  onUsageUpdate?: (usage: TokenUsage) => void,
  customScriptPrompt?: string
): Promise<Slide[]> => {
  initPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
  const numPages = pdf.numPages;
  const slides: Slide[] = [];
  
  let previousContext = "";

  for (let i = 1; i <= numPages; i++) {
    if (onProgress) {
        onProgress(i, numPages);
    }
    const page = await pdf.getPage(i);
    const bound = await analyzePageContent(page, i);
    const thumbnailUrl = await generateThumbnail(pdf, bound);
    
    let narrationScript = "";
    if (autoGenerateScript) {
        try {
            const result = await generateSlideScript(thumbnailUrl, previousContext, customScriptPrompt);
            narrationScript = result.text;
            previousContext = result.text;
            if (onUsageUpdate) onUsageUpdate(result.usage);
        } catch (e) {
            console.error(`Script generation failed for page ${i}`, e);
        }
    }

    slides.push({
      id: safeRandomUUID(),
      pageIndex: i,
      thumbnailUrl,
      duration: durationPerSlide,
      width: bound.width,
      height: bound.height,
      originalWidth: bound.originalWidth,
      originalHeight: bound.originalHeight,
      crop: {
        x: bound.x,
        y: bound.y,
        width: bound.width,
        height: bound.height
      },
      transitionType: transitionType,
      effectType: 'none',
      narrationScript,
      overlays: []
    });
  }
  
  return slides;
};

export const createSlideFromImage = async (file: File, duration: number, transitionType: TransitionType): Promise<Slide> => {
    const base64 = await fileToBase64(file);
    const img = new Image();
    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = `data:${file.type};base64,${base64}`;
    });
    
    return {
        id: safeRandomUUID(),
        pageIndex: -1, 
        thumbnailUrl: `data:${file.type};base64,${base64}`,
        duration: duration,
        width: img.width,
        height: img.height,
        originalWidth: img.width,
        originalHeight: img.height,
        crop: { x: 0, y: 0, width: img.width, height: img.height },
        transitionType: transitionType,
        effectType: 'none',
        customImageFile: file,
        overlays: []
    };
};

export const createSolidColorSlide = async (color: string, duration: number, transitionType: TransitionType): Promise<Slide> => {
    const width = 1920;
    const height = 1080;
    const canvas = document.createElement('canvas');
    // 無地でもPDFと同じ見た目に揃えるため、プレビュー生成をフルHD黒背景で固定
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) { ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    
    return {
        id: safeRandomUUID(),
        pageIndex: -1,
        thumbnailUrl: canvas.toDataURL('image/jpeg'),
        duration: duration,
        width: width,
        height: height,
        originalWidth: width,
        originalHeight: height,
        crop: { x: 0, y: 0, width, height },
        transitionType: transitionType,
        effectType: 'none',
        backgroundColor: color,
        overlays: []
    };
};

export const updateThumbnail = async (sourceFile: File | null, slide: Slide): Promise<string> => {
    let canvas: HTMLCanvasElement | null = null;
    let ctx: CanvasRenderingContext2D | null = null;

    if (slide.customImageFile) {
        const bitmap = await createImageBitmap(slide.customImageFile);
        canvas = document.createElement('canvas');
        // Resize for thumbnail
        const maxDim = 640;
        let w = bitmap.width;
        let h = bitmap.height;
        if (w > maxDim || h > maxDim) {
            const ratio = w / h;
            if (w > h) { w = maxDim; h = maxDim / ratio; }
            else { h = maxDim; w = maxDim * ratio; }
        }
        canvas.width = w;
        canvas.height = h;
        
        ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(bitmap, 0, 0, w, h);
        }
        bitmap.close();
    } else if (sourceFile && slide.pageIndex > 0) {
        initPdfJs();
        const arrayBuffer = await sourceFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        const page = await pdf.getPage(slide.pageIndex);
        const scale = 300 / slide.crop.width;
        const viewport = page.getViewport({ scale });
        
        canvas = document.createElement('canvas');
        canvas.width = slide.crop.width * scale;
        canvas.height = slide.crop.height * scale;
        ctx = canvas.getContext('2d');
        
        if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            const renderContext = {
                canvasContext: ctx,
                viewport: viewport,
                transform: [1, 0, 0, 1, -slide.crop.x * scale, -slide.crop.y * scale]
            };
            await page.render(renderContext).promise;
        }
    } else if (slide.backgroundColor) {
        canvas = document.createElement('canvas'); 
        canvas.width = 320; canvas.height = 180;
        ctx = canvas.getContext('2d'); 
        if(ctx){ ctx.fillStyle = slide.backgroundColor; ctx.fillRect(0,0,320,180); }
    }

    // Draw Overlays on Thumbnail
    if (canvas && ctx && slide.overlays && slide.overlays.length > 0) {
        await drawOverlays(ctx, slide.overlays, canvas.width, canvas.height);
    }

    if (canvas) {
        return canvas.toDataURL('image/jpeg', 0.8);
    }
    return slide.thumbnailUrl;
};

export const generateVideoFromSlides = async (
  sourceFile: File | null,
  slides: Slide[],
  bgmFile: File | null,
  fadeOptions: FadeOptions,
  videoSettings: VideoSettings,
  bgmTimeRange?: BgmTimeRange,
  bgmVolume: number = 1.0,
  globalAudioFile: File | null = null,
  globalAudioVolume: number = 1.0,
  onProgress?: (current: number, total: number) => void,
  duckingOptions?: DuckingOptions
): Promise<{ url: string, extension: string }> => {
    
    // Prepare assets for Worker
    const processedSlides = await Promise.all(slides.map(async (s) => {
        let bitmap: ImageBitmap;
        let buffer: ArrayBuffer | undefined;
        let mimeType: string | undefined;

        if (s.customImageFile) {
            bitmap = await createImageBitmap(s.customImageFile);
            buffer = await s.customImageFile.arrayBuffer();
            mimeType = s.customImageFile.type;
        } else if (s.backgroundColor) {
            const canvas = document.createElement('canvas');
            canvas.width = 1920; canvas.height = 1080;
            const ctx = canvas.getContext('2d')!;
            ctx.fillStyle = s.backgroundColor; ctx.fillRect(0,0,1920,1080);
            bitmap = await createImageBitmap(canvas);
        } else if (sourceFile && s.pageIndex > 0) {
            initPdfJs();
            const arrayBuffer = await sourceFile.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            const page = await pdf.getPage(s.pageIndex);
            
            const targetW = videoSettings.resolution === '1080p' ? 1920 : 1280;
            const scale = Math.min(3.0, targetW / s.crop.width);
            
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            canvas.width = s.crop.width * scale;
            canvas.height = s.crop.height * scale;
            const ctx = canvas.getContext('2d')!;
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,canvas.width, canvas.height);
            
            const renderContext = {
                canvasContext: ctx,
                viewport: viewport,
                transform: [1, 0, 0, 1, -s.crop.x * scale, -s.crop.y * scale]
            };
            await page.render(renderContext).promise;
            bitmap = await createImageBitmap(canvas);
        } else {
            throw new Error("Invalid slide type");
        }
        
        return {
            ...s,
            bitmap, 
            customImageBuffer: buffer, 
            mimeType,
            customImageFile: undefined, 
            audioFile: undefined
        };
    }));

    // Prepare Audio Data (OfflineAudioContext)
    let finalAudioBuffer: AudioBuffer | null = null;
    if (videoSettings.format === 'mp4') {
        const totalDuration = slides.reduce((acc, s) => acc + s.duration, 0);
        // Minimum duration check for OfflineAudioContext (avoid 0 or negative)
        const safeDuration = Math.max(0.1, totalDuration);
        const offlineCtx = new OfflineAudioContext(2, Math.ceil(44100 * (safeDuration + 1)), 44100);
        
        if (bgmFile) {
            const ab = await bgmFile.arrayBuffer();
            const b = await offlineCtx.decodeAudioData(ab);
            const src = offlineCtx.createBufferSource();
            src.buffer = b;
            src.loop = true; 
            
            // Set loop range if specified
            if (bgmTimeRange && bgmTimeRange.end > bgmTimeRange.start) {
                src.loopStart = bgmTimeRange.start;
                src.loopEnd = bgmTimeRange.end;
                // Start offset calculation
                src.start(0, bgmTimeRange.start);
            } else {
                src.start(0);
            }

            // Create Gain Nodes Chain: Src -> FadeGain -> DuckingGain -> Destination
            const fadeGain = offlineCtx.createGain();
            const duckingGain = offlineCtx.createGain();
            
            src.connect(fadeGain);
            fadeGain.connect(duckingGain);
            duckingGain.connect(offlineCtx.destination);

            // 1. Apply Master Volume & Fades to fadeGain
            const FADE_DURATION = 2.0;
            
            // Fade In
            if (fadeOptions?.fadeIn) {
                fadeGain.gain.setValueAtTime(0, 0);
                fadeGain.gain.linearRampToValueAtTime(bgmVolume, Math.min(FADE_DURATION, totalDuration));
            } else {
                fadeGain.gain.setValueAtTime(bgmVolume, 0);
            }

            // Fade Out
            if (fadeOptions?.fadeOut) {
                const fadeOutStart = Math.max(0, totalDuration - FADE_DURATION);
                if (fadeOutStart > FADE_DURATION || !fadeOptions.fadeIn) {
                     fadeGain.gain.setValueAtTime(bgmVolume, fadeOutStart);
                     fadeGain.gain.linearRampToValueAtTime(0, totalDuration);
                } else {
                     // Very short video case
                     fadeGain.gain.cancelScheduledValues(fadeOutStart);
                     fadeGain.gain.setValueAtTime(bgmVolume, fadeOutStart);
                     fadeGain.gain.linearRampToValueAtTime(0, totalDuration);
                }
            }

            // 2. Apply Ducking to duckingGain
            // Default to 1.0 (pass-through)
            duckingGain.gain.value = 1.0;

            if (duckingOptions?.enabled) {
                const duckVol = duckingOptions.duckingVolume;
                let t = 0;
                slides.forEach(s => {
                    if (s.audioFile) {
                        // Start ducking
                        duckingGain.gain.setValueAtTime(1.0, t + (s.audioOffset||0));
                        duckingGain.gain.linearRampToValueAtTime(duckVol, t + (s.audioOffset||0) + 0.1);
                        
                        // NOTE: Logic to return volume to 1.0 is approximated or needs precise duration.
                        // Assuming narration duration is available, we could restore it. 
                        // Current implementation logic in previous version didn't restore it explicitly, 
                        // relying on next slide or end.
                        // Since we don't have exact duration here easily without decoding everything again 
                        // (though we might have duration in slide metadata if we passed it), 
                        // we'll leave it as per previous implementation logic but applied to correct node.
                        // Ideally, we should ramp back up after audio ends.
                    }
                    t += s.duration;
                });
            }
        }
        
        if (globalAudioFile) {
            const ab = await globalAudioFile.arrayBuffer();
            const b = await offlineCtx.decodeAudioData(ab);
            const src = offlineCtx.createBufferSource();
            src.buffer = b;
            const gain = offlineCtx.createGain();
            gain.gain.value = globalAudioVolume;
            src.connect(gain);
            gain.connect(offlineCtx.destination);
            src.start(0);
        }
        
        let cursor = 0;
        for (const s of slides) {
            if (s.audioFile) {
                const ab = await s.audioFile.arrayBuffer();
                const b = await offlineCtx.decodeAudioData(ab);
                const src = offlineCtx.createBufferSource();
                src.buffer = b;
                const gain = offlineCtx.createGain();
                gain.gain.value = s.audioVolume ?? 1.0;
                src.connect(gain);
                gain.connect(offlineCtx.destination);
                const startT = cursor + (s.audioOffset || 0);
                src.start(startT);
            }
            cursor += s.duration;
        }
        
        finalAudioBuffer = await offlineCtx.startRendering();
    }

    const workerBlob = new Blob([VIDEO_WORKER_CODE], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(workerBlob);
    const worker = new Worker(workerUrl, { type: 'module' });

    let audioDataL: Float32Array | undefined;
    let audioDataR: Float32Array | undefined;
    
    if (finalAudioBuffer) {
        audioDataL = finalAudioBuffer.getChannelData(0);
        audioDataR = finalAudioBuffer.numberOfChannels > 1 ? finalAudioBuffer.getChannelData(1) : audioDataL;
    }

    return new Promise((resolve, reject) => {
        worker.onmessage = (e) => {
            const { type, buffer, extension, current, total, message } = e.data;
            if (type === 'progress' && onProgress) {
                onProgress(current, total);
            } else if (type === 'done') {
                const blob = new Blob([buffer], { type: extension === 'gif' ? 'image/gif' : 'video/mp4' });
                const url = URL.createObjectURL(blob);
                worker.terminate();
                URL.revokeObjectURL(workerUrl);
                resolve({ url, extension });
            } else if (type === 'error') {
                worker.terminate();
                URL.revokeObjectURL(workerUrl);
                reject(new Error(message));
            }
        };

        // Prepare BG Image Buffer
        let bgImageBuffer: ArrayBuffer | undefined;
        let bgMimeType: string | undefined;

        const startWorker = async () => {
            if (videoSettings.backgroundImageFile) {
                bgImageBuffer = await videoSettings.backgroundImageFile.arrayBuffer();
                bgMimeType = videoSettings.backgroundImageFile.type;
            }

            const payload = {
                slides: processedSlides,
                videoSettings,
                bgmTimeRange,
                bgmVolume,
                globalAudioVolume,
                fadeOptions,
                duckingOptions,
                audioChannels: audioDataL ? [audioDataL, audioDataR] : null,
                bgImageBuffer,
                bgMimeType
            };

            const transferables: Transferable[] = processedSlides.map(s => s.bitmap).filter(b => !!b) as unknown as Transferable[];
            if (audioDataL) transferables.push(audioDataL.buffer);
            if (audioDataR && audioDataR !== audioDataL) transferables.push(audioDataR.buffer);
            if (bgImageBuffer) transferables.push(bgImageBuffer);

            worker.postMessage({ type: 'init', payload }, transferables);
        };
        
        startWorker();
    });
};
