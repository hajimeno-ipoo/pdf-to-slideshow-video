
import { Slide, AspectRatio, Resolution, VideoSettings, EffectType, Overlay, BgmTimeRange, FadeOptions, TokenUsage, TransitionType, DuckingOptions } from '../types';
import { PDFDocumentProxy, PDFPageProxy, PDFJSStatic } from '../types/pdfTypes';
import { generateSlideScript, wait } from './geminiService';
import { fileToBase64 } from '../utils/fileUtils';
import { buildDuckingIntervals } from '../utils/duckingSchedule';
import { VIDEO_WORKER_CODE } from './videoWorkerScript';
import { safeRandomUUID } from '../utils/uuid';
import { patchMp4AvcColorToBt709TvInPlace } from '../utils/mp4AvcColorPatch';

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

const generateThumbnail = async (page: PDFPageProxy, bound: PageBound): Promise<string> => {
  const targetThumbWidth = 300;
  const scale = targetThumbWidth / bound.width;
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
    if (overlay.hidden) continue;
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
            const strokeRaw = (overlay.strokeWidth || 0) * (canvasHeight / 500);
            const strokeWidthPx = strokeRaw > 0 ? Math.max(1, strokeRaw) : 0;
            if (strokeWidthPx > 0 && overlay.strokeColor) {
                ctx.lineWidth = strokeWidthPx; ctx.strokeStyle = overlay.strokeColor; ctx.lineJoin = 'round'; ctx.strokeText(line, startX, yOffset);
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
    const SLIDE_TOKEN = '__SLIDE__';
    const slideScale = settings.slideScale / 100; const radius = settings.slideBorderRadius;
    let kbScale = 1.0; let kbX = 0; let kbY = 0;
    if (effectType === 'kenburns' && kenBurns) {
        const p = progress;
        const { direction, startScale, endScale, panX, panY } = kenBurns;
        kbScale = startScale + (endScale - startScale) * p;
        if (direction.includes('pan')) { kbX = panX * p; kbY = panY * p; }
        if (direction === 'zoom-out') { kbScale = endScale + (startScale - endScale) * p; }
    }
    const availableW = width * slideScale; const availableH = height * slideScale;
    const imgRatio = slideImage.width / slideImage.height;
    let rectW = availableW; let rectH = availableW / imgRatio;
    if (rectH > availableH) { rectH = availableH; rectW = availableH * imgRatio; }
    let rectX = (width / 2) - (rectW / 2);
    let rectY = (height / 2) - (rectH / 2);
    if (slide.layout && Number.isFinite(slide.layout.w) && Number.isFinite(slide.layout.x) && Number.isFinite(slide.layout.y)) {
        rectW = slide.layout.w * width;
        rectH = rectW / imgRatio;
        if (rectH > height) { rectH = height; rectW = rectH * imgRatio; }
        rectX = slide.layout.x * width;
        rectY = slide.layout.y * height;
    }

    const drawSlide = () => {
        const centerX = rectX + rectW / 2;
        const centerY = rectY + rectH / 2;
        const drawW = rectW * kbScale;
        const drawH = rectH * kbScale;
        const drawX = centerX - (drawW / 2) + (kbX * rectW);
        const drawY = centerY - (drawH / 2) + (kbY * rectH);

        ctx.save();
        if (radius > 0) {
            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') ctx.roundRect(rectX, rectY, rectW, rectH, radius);
            else ctx.rect(rectX, rectY, rectW, rectH);
            ctx.clip();
        }
        ctx.drawImage(slideImage, drawX, drawY, drawW, drawH);
        ctx.restore();
    };

    if (!slide.overlays || skipOverlays) {
        drawSlide();
        return;
    }

    const overlays = slide.overlays || [];
    const overlayIds = overlays.map(o => o.id);
    let layerOrder: string[] = Array.isArray(slide.layerOrder) ? [...slide.layerOrder] : [SLIDE_TOKEN, ...overlayIds];
    if (!layerOrder.includes(SLIDE_TOKEN)) layerOrder.unshift(SLIDE_TOKEN);
    for (const id of overlayIds) if (!layerOrder.includes(id)) layerOrder.push(id);
    layerOrder = layerOrder.filter(id => id === SLIDE_TOKEN || overlayIds.includes(id));

    const transDuration = slide.transitionType === 'none' ? 0 : (slide.transitionDuration !== undefined ? slide.transitionDuration : settings.transitionDuration);

    for (const id of layerOrder) {
        if (id === SLIDE_TOKEN) {
            drawSlide();
            continue;
        }
        const ov = overlays.find(o => o.id === id);
        if (!ov) continue;
        const space = ov.space || 'slide';
        if (space === 'canvas') {
            await drawOverlays(ctx, [ov], width, height, currentTime, slide.duration, imageCache, transDuration);
        } else {
            ctx.save();
            ctx.translate(rectX, rectY);
            if (radius > 0) {
                ctx.beginPath();
                if (typeof ctx.roundRect === 'function') ctx.roundRect(0, 0, rectW, rectH, radius);
                else ctx.rect(0, 0, rectW, rectH);
                ctx.clip();
            }
            await drawOverlays(ctx, [ov], rectW, rectH, currentTime, slide.duration, imageCache, transDuration);
            ctx.restore();
        }
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
  const baseTotalUnits = numPages;
  const totalUnits = baseTotalUnits + (autoGenerateScript ? numPages : 0);
  let doneUnits = 0;

  const report = () => {
    if (!onProgress) return;
    const current = totalUnits > 0 ? (doneUnits / totalUnits) * numPages : 0;
    onProgress(current, numPages);
  };

  const pageResults: Array<{ bound: PageBound; thumbnailUrl: string } | null> = new Array(numPages).fill(null);
  const concurrency = 2;
  let nextIndex = 1;

  const worker = async () => {
    while (true) {
      const i = nextIndex;
      nextIndex += 1;
      if (i > numPages) return;
      const page = await pdf.getPage(i);
      const bound = await analyzePageContent(page, i);
      const thumbnailUrl = await generateThumbnail(page, bound);
      pageResults[i - 1] = { bound, thumbnailUrl };
      doneUnits += 1;
      report();
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, numPages) }, () => worker()));

  let previousContext = "";
  for (let i = 1; i <= numPages; i++) {
    const result = pageResults[i - 1];
    if (!result) continue;
    const { bound, thumbnailUrl } = result;

    let narrationScript = "";
    if (autoGenerateScript) {
      try {
        const gen = await generateSlideScript(thumbnailUrl, previousContext, customScriptPrompt);
        narrationScript = gen.text;
        previousContext = gen.text;
        if (onUsageUpdate) onUsageUpdate(gen.usage);
      } catch (e) {
        console.error(`Script generation failed for page ${i}`, e);
      } finally {
        doneUnits += 1;
        report();
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
    if (ctx) { ctx.fillStyle = color || '#000000'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    
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

let thumbnailPdfFile: File | null = null;
let thumbnailPdfDoc: PDFDocumentProxy | null = null;
let thumbnailPdfDocPromise: Promise<PDFDocumentProxy> | null = null;

const THUMBNAIL_PAGE_BITMAP_CACHE_LIMIT = 8;
const thumbnailPageBitmapCache = new Map<string, ImageBitmap>();

export const updateThumbnail = async (sourceFile: File | null, slide: Slide, settings?: VideoSettings): Promise<string> => {
    // サムネ生成を本番描画パイプラインに寄せて、装飾反映漏れを防ぐ
    const canvas = document.createElement('canvas');
    // 16:9 前提サムネ。少し解像度高めでアウトライン潰れを防止
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    if (!ctx) return slide.thumbnailUrl;

    // 背景画像または solid を bitmap にする
    let slideImage: ImageBitmap | null = null;
    let shouldCloseSlideImage = false;
    try {
        if (slide.customImageFile) {
            slideImage = await createImageBitmap(slide.customImageFile);
            shouldCloseSlideImage = true;
        } else if (sourceFile && slide.pageIndex > 0) {
            initPdfJs();
            if (thumbnailPdfFile !== sourceFile) {
                try { thumbnailPdfDoc?.destroy?.(); } catch (_) {}
                thumbnailPdfFile = sourceFile;
                thumbnailPdfDoc = null;
                thumbnailPdfDocPromise = null;
                for (const bmp of thumbnailPageBitmapCache.values()) {
                    try { bmp.close?.(); } catch (_) {}
                }
                thumbnailPageBitmapCache.clear();
            }
            if (!thumbnailPdfDoc) {
                if (!thumbnailPdfDocPromise) {
                    thumbnailPdfDocPromise = sourceFile.arrayBuffer().then((ab) => pdfjsLib.getDocument(ab).promise);
                }
                thumbnailPdfDoc = await thumbnailPdfDocPromise;
            }
            const page = await thumbnailPdfDoc.getPage(slide.pageIndex);
            const targetW = 640; // サムネ用
            const scale = Math.min(3.0, targetW / slide.crop.width);
            const cacheKey = `${slide.pageIndex}:${Math.round(scale * 1000)}:${slide.crop.x},${slide.crop.y},${slide.crop.width},${slide.crop.height}`;
            const cached = thumbnailPageBitmapCache.get(cacheKey);
            if (cached) {
                // LRU bump
                thumbnailPageBitmapCache.delete(cacheKey);
                thumbnailPageBitmapCache.set(cacheKey, cached);
                slideImage = cached;
            } else {
            const viewport = page.getViewport({ scale });
            const tmp = document.createElement('canvas');
            tmp.width = slide.crop.width * scale;
            tmp.height = slide.crop.height * scale;
            const tctx = tmp.getContext('2d');
            if (tctx) {
                tctx.fillStyle = '#ffffff';
                tctx.fillRect(0, 0, tmp.width, tmp.height);
                const renderContext = {
                    canvasContext: tctx,
                    viewport,
                    transform: [1, 0, 0, 1, -slide.crop.x * scale, -slide.crop.y * scale]
                };
                await page.render(renderContext).promise;
            }
                const bmp = await createImageBitmap(tmp);
                thumbnailPageBitmapCache.set(cacheKey, bmp);
                while (thumbnailPageBitmapCache.size > THUMBNAIL_PAGE_BITMAP_CACHE_LIMIT) {
                    const oldestKey = thumbnailPageBitmapCache.keys().next().value as string | undefined;
                    if (!oldestKey) break;
                    const oldest = thumbnailPageBitmapCache.get(oldestKey);
                    if (oldest) {
                        try { oldest.close?.(); } catch (_) {}
                    }
                    thumbnailPageBitmapCache.delete(oldestKey);
                }
                slideImage = bmp;
            }
        } else {
            // solid 色スライド
            const tmp = document.createElement('canvas');
            tmp.width = 640; tmp.height = 360;
            const tctx = tmp.getContext('2d');
            if (tctx) { tctx.fillStyle = slide.backgroundColor || '#000'; tctx.fillRect(0,0,tmp.width,tmp.height); }
            slideImage = await createImageBitmap(tmp);
            shouldCloseSlideImage = true;
        }
    } catch (e) {
        console.error('updateThumbnail: slide bitmap failed', e);
    }

    // スライドフレーム＋装飾を描画
    try {
        const vs: VideoSettings = settings || {
            resolution: '1080p',
            aspectRatio: '16:9',
            format: 'mp4',
            frameRate: 30,
            transitionDuration: 0.5,
            slideScale: 100,
            slideBorderRadius: 0,
            bgColor: '#000000',
            motionBlur: false,
            audioFade: true,
        } as unknown as VideoSettings;

        if (slideImage) {
            await drawSlideFrame(
                ctx,
                slideImage,
                canvas.width,
                canvas.height,
                slide.effectType,
                slide.effectType === 'kenburns' ? getKenBurnsParams(slide.id) : null,
                0,
                slide,
                vs,
                0,
                undefined,
                false // skipOverlays=false → オーバーレイを描画
            );
        } else {
            // bitmap 化に失敗したときのフォールバック：背景を塗ってオーバーレイだけ描画
            ctx.fillStyle = slide.backgroundColor || '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            await drawOverlays(ctx, slide.overlays || [], canvas.width, canvas.height);
        }
    } catch (e) {
        console.error('updateThumbnail: drawSlideFrame failed', e);
        // フォールバック：背景＋オーバーレイのみ
        ctx.fillStyle = slide.backgroundColor || '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        try { await drawOverlays(ctx, slide.overlays || [], canvas.width, canvas.height); } catch (_) {}
    }

    if (shouldCloseSlideImage) {
        try { slideImage?.close?.(); } catch (_) {}
    }
    // JPEG だと透明部分が黒に潰れて「黒帯が焼き込み」されるので、PNG で透明を保持する
    return canvas.toDataURL('image/png');
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
	    if (videoSettings.format === 'mp4' || videoSettings.format === 'mov') {
	        const totalDuration = slides.reduce((acc, s) => acc + s.duration, 0);
	        // Minimum duration check for OfflineAudioContext (avoid 0 or negative)
	        const safeDuration = Math.max(0.1, totalDuration);
	        const offlineCtx = new OfflineAudioContext(2, Math.ceil(44100 * (safeDuration + 1)), 44100);
	        const renderEndTime = offlineCtx.length / offlineCtx.sampleRate;
	        const narrationSegments: { start: number; end: number }[] = [];
        
        // Ducking Gain is shared between BGM and narration scheduling
        let duckingGain: GainNode | null = null;

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
            duckingGain = offlineCtx.createGain();
            
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

            // 2. Apply Ducking to duckingGain (schedule is set later when narration buffers are decoded)
            duckingGain.gain.setValueAtTime(1.0, 0);
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
            narrationSegments.push({ start: 0, end: b.duration });
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
                narrationSegments.push({ start: startT, end: startT + b.duration });
            }
            cursor += s.duration;
        }

        // Schedule ducking once (merge close narration segments for smoother BGM in/out)
        if (duckingGain && duckingOptions?.enabled && narrationSegments.length > 0) {
            const duckVol = duckingOptions.duckingVolume;
            const attack = 0.25;
            const release = 0.6;
            const lead = 0.05;
            const tail = 0.15;

            const intervals = buildDuckingIntervals(narrationSegments, renderEndTime, {
                lead,
                tail,
                mergeGap: release
            });

            if (intervals.length > 0) {
                duckingGain.gain.cancelScheduledValues(0);
                duckingGain.gain.setValueAtTime(1.0, 0);

                for (const { start, end } of intervals) {
                    const downEnd = Math.min(start + attack, end);
                    const upEnd = Math.min(end + release, renderEndTime);

                    duckingGain.gain.setValueAtTime(1.0, start);
                    if (downEnd > start) {
                        duckingGain.gain.linearRampToValueAtTime(duckVol, downEnd);
                    } else {
                        duckingGain.gain.setValueAtTime(duckVol, start);
                    }
                    duckingGain.gain.setValueAtTime(duckVol, end);
                    if (upEnd > end) {
                        duckingGain.gain.linearRampToValueAtTime(1.0, upEnd);
                    } else {
                        duckingGain.gain.setValueAtTime(1.0, end);
                    }
                }
            }
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
        worker.onmessage = async (e) => {
            try {
                const { type, buffer, extension, current, total, message } = e.data;
                if (type === 'progress' && onProgress) {
                    onProgress(current, total);
                } else if (type === 'done') {
                    let url: string;
                    const mimeType = extension === 'mov' ? 'video/quicktime' : 'video/mp4';
                    if (extension === 'mp4') {
                        try {
                            patchMp4AvcColorToBt709TvInPlace(buffer);
                        } catch (_) {}
                    }
                    const blob = new Blob([buffer], { type: mimeType });
                    url = URL.createObjectURL(blob);
                    worker.terminate();
                    URL.revokeObjectURL(workerUrl);
                    resolve({ url, extension });
                } else if (type === 'error') {
                    worker.terminate();
                    URL.revokeObjectURL(workerUrl);
                    reject(new Error(message));
                }
            } catch (err: any) {
                worker.terminate();
                URL.revokeObjectURL(workerUrl);
                reject(err instanceof Error ? err : new Error(err?.message || String(err)));
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
