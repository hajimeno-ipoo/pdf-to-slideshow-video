
// This file contains the source code for the Web Worker as a string.
// We do this to avoid complex build configuration for workers in this environment.

import { createAacLcAudioSpecificConfig } from '../utils/aacAudioSpecificConfig';

const DEFAULT_AAC_DESCRIPTION = Array.from(createAacLcAudioSpecificConfig(44100, 2));

export const VIDEO_WORKER_CODE = `
import { Output, Mp4OutputFormat, MovOutputFormat, BufferTarget, CanvasSource, EncodedAudioPacketSource, EncodedPacket } from 'https://cdn.jsdelivr.net/npm/mediabunny@1.26.0/+esm';

// --- Helper Functions ---

const easeOutBack = (x) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

const easeInBack = (x) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return c3 * x * x * x - c1 * x * x;
};

const getVideoDimensions = (aspectRatio, resolution) => {
  let width = 1920;
  let height = 1080;

  if (resolution === '720p') {
    width = 1280;
    height = 720;
  }

  switch (aspectRatio) {
    case '16:9': break;
    case '4:3': width = resolution === '1080p' ? 1440 : 960; break;
    case '1:1': width = resolution === '1080p' ? 1080 : 720; break;
    case '9:16': height = resolution === '1080p' ? 1920 : 1280; width = resolution === '1080p' ? 1080 : 720; break;
  }
  
  if (width % 2 !== 0) width -= 1;
  if (height % 2 !== 0) height -= 1;

  return { width, height };
};

const getKenBurnsParams = (id) => {
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const directions = ['zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'pan-up', 'pan-down'];
    const direction = directions[hash % directions.length];
    
    const startScale = 1.0 + ((hash % 10) / 100); 
    const endScale = 1.15 + ((hash % 5) / 100);

    const panX = ((hash % 20) - 10) / 200; 
    const panY = ((hash % 20) - 10) / 200;

    return { direction, startScale, endScale, panX, panY };
};

const getWrappedLines = (ctx, text, maxWidth) => {
    const paragraphs = text.split('\\n');
    const lines = [];
    paragraphs.forEach(paragraph => {
        if (paragraph === '') { lines.push(''); return; }
        let currentLine = '';
        const chars = paragraph.split('');
        for (let i = 0; i < chars.length; i++) {
            const char = chars[i];
            const testLine = currentLine + char;
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && i > 0) {
                lines.push(currentLine);
                currentLine = char;
            } else {
                currentLine = testLine;
            }
        }
        lines.push(currentLine);
    });
    return lines;
};

// --- WebFont Loader (for OffscreenCanvas export) ---

const GOOGLE_FONTS_CSS_URLS = {
    inter: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap',
    jp: 'https://fonts.googleapis.com/css2?family=DotGothic16&family=Kaisei+Decol&family=Mochiy+Pop+One&family=Noto+Sans+JP:wght@400;700&family=Noto+Serif+JP:wght@400;700&display=swap'
};

const normalizeFontFamily = (value) => {
    if (!value) return '';
    return String(value).replace(/^['"]+|['"]+$/g, '').trim();
};

const collectUsedFontFamilies = (slides) => {
    const families = new Set();
    if (!Array.isArray(slides)) return families;
    for (const slide of slides) {
        const overlays = Array.isArray(slide?.overlays) ? slide.overlays : [];
        for (const ov of overlays) {
            if (!ov || ov.hidden) continue;
            if (ov.type !== 'text') continue;
            const family = normalizeFontFamily(ov.fontFamily || 'Noto Sans JP');
            if (family) families.add(family);
        }
    }
    return families;
};

const getGoogleFontsCssUrlsForFamilies = (families) => {
    const urls = new Set();
    if (!families || families.size === 0) return [];

    if (families.has('Inter')) urls.add(GOOGLE_FONTS_CSS_URLS.inter);

    const jpFamilies = ['DotGothic16', 'Kaisei Decol', 'Mochiy Pop One', 'Noto Sans JP', 'Noto Serif JP'];
    for (const f of jpFamilies) {
        if (families.has(f)) { urls.add(GOOGLE_FONTS_CSS_URLS.jp); break; }
    }
    return Array.from(urls);
};

const parseGoogleFontsCssFontFaces = (cssText) => {
    const results = [];
    if (!cssText) return results;
    const blocks = cssText.match(/@font-face\\s*\\{[^}]*\\}/g) || [];
    for (const block of blocks) {
        const family = block.match(/font-family:\\s*['"]?([^;'"]+)['"]?\\s*;/)?.[1];
        const src = block.match(/src:\\s*url\\(([^)]+)\\)/)?.[1];
        if (!family || !src) continue;
        const weight = block.match(/font-weight:\\s*([^;]+);/)?.[1]?.trim();
        const style = block.match(/font-style:\\s*([^;]+);/)?.[1]?.trim();
        const unicodeRange = block.match(/unicode-range:\\s*([^;]+);/)?.[1]?.trim();
        const srcUrl = String(src).trim().replace(/^['"]+|['"]+$/g, '');
        results.push({ family, srcUrl, weight, style, unicodeRange });
    }
    return results;
};

const loadGoogleFontsForFamilies = async (families) => {
    if (!families || families.size === 0) return;
    if (typeof FontFace !== 'function' || !self.fonts || typeof self.fonts.add !== 'function') return;

    const urls = getGoogleFontsCssUrlsForFamilies(families);
    if (urls.length === 0) return;

    for (const url of urls) {
        let cssText = '';
        try {
            const res = await fetch(url);
            cssText = await res.text();
        } catch (_) {
            continue;
        }

        const faces = parseGoogleFontsCssFontFaces(cssText);
        for (const face of faces) {
            if (!families.has(face.family)) continue;
            try {
                const font = new FontFace(face.family, 'url(' + face.srcUrl + ')', {
                    weight: face.weight || '400',
                    style: face.style || 'normal',
                    unicodeRange: face.unicodeRange
                });
                await font.load();
                self.fonts.add(font);
            } catch (_) {}
        }
    }
};

const loadCustomFontAssets = async (fontAssets, usedFamilies) => {
    if (!Array.isArray(fontAssets) || fontAssets.length === 0) return;
    if (typeof FontFace !== 'function' || !self.fonts || typeof self.fonts.add !== 'function') return;

    const hasUsedFamilies = usedFamilies && typeof usedFamilies.has === 'function';
    for (const asset of fontAssets) {
        const family = normalizeFontFamily(asset?.family);
        if (!family) continue;
        if (hasUsedFamilies && !usedFamilies.has(family)) continue;
        const buf = asset?.buffer;
        if (!(buf instanceof ArrayBuffer) || buf.byteLength <= 0) continue;
        try {
            const font = new FontFace(family, buf);
            await font.load();
            self.fonts.add(font);
        } catch (_) {}
    }
};

// Helper to create asset from ArrayBuffer
const loadAssetFromData = async (buffer, mimeType) => {
    try {
        if (typeof ImageDecoder !== 'undefined' && (mimeType === 'image/gif' || mimeType === 'image/png' || mimeType === 'image/webp')) {
            try {
                const bufferCopy = buffer.slice(0);
                const decoder = new ImageDecoder({ data: bufferCopy, type: mimeType });
                await decoder.tracks.ready;
                
                if (decoder.tracks.selectedTrack && decoder.tracks.selectedTrack.frameCount > 1) {
                    const track = decoder.tracks.selectedTrack;
                    const framesMetadata = [];
                    let totalDuration = 0;
                    
                    for (let i = 0; i < track.frameCount; i++) {
                        const result = await decoder.decode({ frameIndex: i });
                        const duration = result.image.duration ? result.image.duration / 1000000 : 0.1; 
                        framesMetadata.push({
                            index: i,
                            startTime: totalDuration,
                            duration: duration
                        });
                        totalDuration += duration;
                        result.image.close();
                    }
                    
                    const bufferForPlayback = buffer.slice(0);
                    return { 
                        type: 'anim', 
                        decoder: new ImageDecoder({ data: bufferForPlayback, type: mimeType }), 
                        frames: framesMetadata,
                        totalDuration: totalDuration || 1.0,
                        width: 0, height: 0 // Will be set on first decode if needed
                    };
                }
            } catch (e) {
                console.warn("ImageDecoder animation setup failed, falling back to static", e);
            }
        }
        
        const blob = new Blob([buffer], { type: mimeType });
        const bitmap = await createImageBitmap(blob);
        return { type: 'static', bitmap, width: bitmap.width, height: bitmap.height };
        
    } catch (e) {
        console.error("Failed to load image asset", e);
        return null;
    }
};

const drawOverlays = async (ctx, overlays, canvasWidth, canvasHeight, currentTime, slideDuration, overlayAssets, transitionDuration = 0) => {
  if (!overlays || overlays.length === 0) return;

  const baseDuration = 1.0;
  const OFFSET_RATIO = 0.2; 
  const shadowScale = canvasHeight / 500;

	  for (const overlay of overlays) {
	    if (overlay.hidden) continue;
	    const startTime = overlay.startTime || 0;
	    const endTime = Math.min(
	        slideDuration,
	        Math.max(
	            0,
	            typeof overlay.endTime === 'number'
	                ? overlay.endTime
	                : (typeof overlay.duration === 'number' ? startTime + overlay.duration : slideDuration)
	        )
	    );
	    const duration = Math.max(0.001, endTime - startTime);
	    if (endTime < startTime) continue;

	    // Check if visible
	    if (currentTime < startTime || currentTime > endTime) continue;

    const animDuration = (duration < 2.0) ? Math.min(baseDuration, duration / 2) : baseDuration;
    // Local time inside the overlay display period
    const timeInOverlay = currentTime - startTime;

    ctx.save();
    let alpha = overlay.opacity !== undefined ? overlay.opacity : 1.0;
    let offsetX = 0;
    let offsetY = 0;
    let scale = 1;
    let rotation = overlay.rotation || 0;
    let typewriterProgress = 1.0;
    let clipProgress = 1.0; 
    let clipDirection = null;

    if (currentTime !== undefined && slideDuration !== undefined) {
        // Animation IN
        if (overlay.animationIn && overlay.animationIn !== 'none') {
            const progress = Math.min(1, Math.max(0, timeInOverlay / animDuration));
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
        // Animation OUT
        if (overlay.animationOut && overlay.animationOut !== 'none') {
            const outStartTime = duration - animDuration;
            if (timeInOverlay > outStartTime) {
                const progress = Math.min(1, Math.max(0, (timeInOverlay - outStartTime) / animDuration));
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
	    const flipX = overlay.flipX ? -1 : 1;
	    const flipY = overlay.flipY ? -1 : 1;
	    if (flipX !== 1 || flipY !== 1) ctx.scale(flipX, flipY);
	    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

    // Text & Shapes rendering
    if (overlay.type === 'text' && overlay.text) {
        const fontSizePx = (overlay.fontSize || 5) / 100 * canvasHeight;
        const fontFamily = overlay.fontFamily || 'Noto Sans JP';
        const fontWeight = overlay.isBold ? 'bold' : 'normal';
        const fontStyle = overlay.isItalic ? 'italic' : 'normal';
        ctx.font = fontStyle + ' ' + fontWeight + ' ' + fontSizePx + 'px ' + '"' + fontFamily + '"' + ', sans-serif';

        let txt = overlay.text;
        if (overlay.animationIn === 'typewriter' && typewriterProgress < 1.0) {
            txt = txt.substring(0, Math.floor(txt.length * typewriterProgress));
        }

        const maxWidth = overlay.width ? overlay.width * canvasWidth : 9999;
        const linesWrapped = getWrappedLines(ctx, txt, maxWidth);
        const lineHeight = fontSizePx * 1.2;
        const padPx = (overlay.backgroundPadding || 0) * (fontSizePx / 5);
        const totalTextHeight = linesWrapped.length * lineHeight;
        const boxWidth = Math.max(...linesWrapped.map(l => ctx.measureText(l).width)) + padPx * 2;
        const boxHeight = totalTextHeight + padPx * 2;

        if (overlay.backgroundColor && overlay.backgroundColor !== 'transparent') {
            ctx.fillStyle = overlay.backgroundColor;
            ctx.fillRect(-boxWidth/2, -boxHeight/2, boxWidth, boxHeight);
        }
        if (overlay.shadowColor) { ctx.shadowColor=overlay.shadowColor; ctx.shadowBlur=(overlay.shadowBlur||0)*shadowScale; ctx.shadowOffsetX=(overlay.shadowOffsetX||0)*shadowScale; ctx.shadowOffsetY=(overlay.shadowOffsetY||0)*shadowScale; }

        ctx.fillStyle = overlay.color || '#ffffff';
        ctx.textAlign = overlay.textAlign || 'center';
        ctx.textBaseline = 'middle';
        const startY = -boxHeight/2 + padPx + lineHeight/2;
        const startX = overlay.textAlign === 'left' ? -boxWidth/2 + padPx : overlay.textAlign === 'right' ? boxWidth/2 - padPx : 0;
        const strokeRaw = (overlay.strokeWidth || 0) * (canvasHeight / 500);
        const strokeWidthPx = strokeRaw > 0 ? Math.max(1, strokeRaw) : 0;

        linesWrapped.forEach((l,i) => {
            const y = startY + i * lineHeight;
            if (strokeWidthPx > 0 && overlay.strokeColor) { ctx.lineWidth = strokeWidthPx; ctx.strokeStyle = overlay.strokeColor; ctx.lineJoin='round'; ctx.strokeText(l, startX, y); }
            ctx.fillText(l, startX, y);
        });
    }
        else if (overlay.type === 'rect' || overlay.type === 'circle' || overlay.type === 'arrow' || overlay.type === 'line') {
            // Shape Logic
            const w = (overlay.width||0.2)*canvasWidth; const h = (overlay.height||0.2)*canvasHeight;
            if(overlay.shadowColor){ ctx.shadowColor=overlay.shadowColor; ctx.shadowBlur=(overlay.shadowBlur||0)*shadowScale; ctx.shadowOffsetX=(overlay.shadowOffsetX||0)*shadowScale; ctx.shadowOffsetY=(overlay.shadowOffsetY||0)*shadowScale; }
        ctx.fillStyle = overlay.backgroundColor || 'transparent'; ctx.strokeStyle = overlay.color || '#ff0000'; ctx.lineWidth = (overlay.strokeWidth||3)*(canvasHeight/500);
        ctx.beginPath();
        if(overlay.type==='rect') ctx.rect(-w/2,-h/2,w,h);
        else if(overlay.type==='circle') ctx.ellipse(0,0,w/2,h/2,0,0,2*Math.PI);
        else if(overlay.type==='line') { ctx.moveTo(-w/2,0); ctx.lineTo(w/2,0); }
        else if(overlay.type==='arrow') { /*arrow path*/ ctx.rect(-w/2,-h/4,w*0.7,h/2); /*simple head*/ ctx.moveTo(w*0.2,-h/2); ctx.lineTo(w/2,0); ctx.lineTo(w*0.2,h/2); }
        if(overlay.backgroundColor) ctx.fill(); if(overlay.strokeWidth) ctx.stroke();
    }
	    else if (overlay.type === 'image' && overlay.imageData) {
	        // Image / Animated Overlay Logic
	        let img = null;
	        let frameToClose = null;
        
        if (overlayAssets && overlayAssets.has(overlay.id)) {
             const asset = overlayAssets.get(overlay.id);
             if (asset.type === 'anim') {
                 const loopTime = currentTime % asset.totalDuration;
                 let frameIndex = 0;
                 for (const f of asset.frames) {
                     if (loopTime >= f.startTime && loopTime < f.startTime + f.duration) {
                         frameIndex = f.index;
                         break;
                     }
                 }
                 const result = await asset.decoder.decode({ frameIndex });
                 img = result.image;
                 frameToClose = img;
             } else {
                 img = asset.bitmap;
             }
	        }

	        if (img) {
	            const targetW = (overlay.width || 0.2) * canvasWidth;
	            const targetH = (overlay.height || 0.2) * canvasHeight;
	            const srcW = (typeof img.displayWidth === 'number' ? img.displayWidth : img.width) || 0;
	            const srcH = (typeof img.displayHeight === 'number' ? img.displayHeight : img.height) || 0;
	            if (overlay.shadowColor) { 
	                ctx.shadowColor = overlay.shadowColor; 
	                ctx.shadowBlur = (overlay.shadowBlur || 0) * shadowScale; 
	                ctx.shadowOffsetX = (overlay.shadowOffsetX || 0) * shadowScale; 
	                ctx.shadowOffsetY = (overlay.shadowOffsetY || 0) * shadowScale; 
	            }
	            let drawW = targetW;
	            let drawH = targetH;
	            if (srcW > 0 && srcH > 0 && targetW > 0 && targetH > 0) {
	                const scale = Math.min(targetW / srcW, targetH / srcH);
	                if (Number.isFinite(scale) && scale > 0) {
	                    drawW = srcW * scale;
	                    drawH = srcH * scale;
	                }
	            }
	            ctx.drawImage(img, -drawW/2, -drawH/2, drawW, drawH);
	        }
	        if (frameToClose) frameToClose.close();
	    }
	    ctx.restore();
	  }
};

const renderBackground = async (ctx, width, height, fill, bgAsset, currentTime) => {
    if (bgAsset) {
        let img = null; let frameToClose = null;
        if (bgAsset.type === 'static') img = bgAsset.bitmap;
        else if (bgAsset.type === 'anim') {
             const loopTime = currentTime % bgAsset.totalDuration;
             let frameIndex = 0;
             for (const f of bgAsset.frames) { if (loopTime >= f.startTime && loopTime < f.startTime + f.duration) { frameIndex = f.index; break; } }
             const result = await bgAsset.decoder.decode({ frameIndex }); img = result.image; frameToClose = img;
        }
        if (img) {
            const imgRatio = img.displayWidth ? (img.displayWidth/img.displayHeight) : (img.width/img.height);
            const canvasRatio = width / height; let drawW, drawH, offsetX, offsetY;
            if (imgRatio > canvasRatio) { drawH = height; drawW = height * imgRatio; offsetX = -(drawW - width) / 2; offsetY = 0; } else { drawW = width; drawH = width / imgRatio; offsetX = 0; offsetY = -(drawH - height) / 2; }
            ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
        }
        if (frameToClose) frameToClose.close();
    } else {
        ctx.fillStyle = fill; ctx.fillRect(0, 0, width, height);
    }
};

const drawSlideFrame = async (ctx, slideAsset, width, height, effectType, kenBurns, progress, slide, settings, currentTime, overlayAssets) => {
    const SLIDE_TOKEN = '__SLIDE__';
    const slideScale = settings.slideScale / 100;
    const radius = settings.slideBorderRadius;
    let kbScale = 1.0; let kbX = 0; let kbY = 0;
    if (effectType === 'kenburns' && kenBurns) {
        const p = progress;
        const { direction, startScale, endScale, panX, panY } = kenBurns;
        kbScale = startScale + (endScale - startScale) * p;
        if (direction.includes('pan')) { kbX = panX * p; kbY = panY * p; }
        if (direction === 'zoom-out') { kbScale = endScale + (startScale - endScale) * p; }
    }
    const availableW = width * slideScale; const availableH = height * slideScale;
    let srcW = 0, srcH = 0; let drawImageSource = null; let frameToClose = null;
    if (slideAsset.type === 'anim' && slideAsset.decoder) {
        const loopTime = currentTime % slideAsset.totalDuration; let frameIndex = 0;
        for (const f of slideAsset.frames) { if (loopTime >= f.startTime && loopTime < f.startTime + f.duration) { frameIndex = f.index; break; } }
        const result = await slideAsset.decoder.decode({ frameIndex }); drawImageSource = result.image; frameToClose = result.image; srcW = result.image.displayWidth; srcH = result.image.displayHeight;
    } else { drawImageSource = slideAsset.bitmap; srcW = slideAsset.width; srcH = slideAsset.height; }
    
    let sx = 0, sy = 0, sw = srcW, sh = srcH;
    if (slideAsset.type === 'anim' || slide.customImageBuffer) { if (slide.crop) { sx = slide.crop.x; sy = slide.crop.y; sw = slide.crop.width; sh = slide.crop.height; } }
    
    const imgRatio = sw / sh;
    let rectW = availableW;
    let rectH = availableW / imgRatio;
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
        if (drawImageSource) ctx.drawImage(drawImageSource, sx, sy, sw, sh, drawX, drawY, drawW, drawH);
        if (frameToClose) frameToClose.close();
        ctx.restore();
    };

    if (!slide.overlays) {
        drawSlide();
        return;
    }

    const overlays = slide.overlays || [];
    const overlayIds = overlays.map(o => o.id);
    let layerOrder = Array.isArray(slide.layerOrder) ? [...slide.layerOrder] : [SLIDE_TOKEN, ...overlayIds];
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
            await drawOverlays(ctx, [ov], width, height, currentTime, slide.duration, overlayAssets, transDuration);
        } else {
            ctx.save();
            ctx.translate(rectX, rectY);
            if (radius > 0) {
                ctx.beginPath();
                if (typeof ctx.roundRect === 'function') ctx.roundRect(0, 0, rectW, rectH, radius);
                else ctx.rect(0, 0, rectW, rectH);
                ctx.clip();
            }
            await drawOverlays(ctx, [ov], rectW, rectH, currentTime, slide.duration, overlayAssets, transDuration);
            ctx.restore();
        }
    }
};

self.onmessage = async (e) => {
    const { type, payload } = e.data;

    if (type === 'init') {
        try {
            const { slides, videoSettings, bgmTimeRange, bgmVolume, globalAudioVolume, fadeOptions, duckingOptions, audioChannels, bgImageBuffer, bgMimeType, customFonts } = payload;
            const { width, height } = getVideoDimensions(videoSettings.aspectRatio, videoSettings.resolution);

            // Load WebFonts used by text overlays in this worker context (best-effort).
            const usedFontFamilies = collectUsedFontFamilies(slides);
            const fontsReadyPromise = Promise.all([
                loadCustomFontAssets(customFonts, usedFontFamilies),
                loadGoogleFontsForFamilies(usedFontFamilies)
            ]).catch(() => {});
            
            // 1. Prepare Slide Assets
            const slideAssets = [];
            for (const slide of slides) {
                if (slide.customImageBuffer) {
                    const asset = await loadAssetFromData(slide.customImageBuffer, slide.mimeType);
                    slideAssets.push(asset);
                } else {
                    slideAssets.push({ type: 'static', bitmap: slide.bitmap, width: slide.bitmap.width, height: slide.bitmap.height });
                }
            }

            // 2. Prepare Background Asset
            let bgAsset = null;
            if (bgImageBuffer && bgMimeType) {
                bgAsset = await loadAssetFromData(bgImageBuffer, bgMimeType);
            }

            // 3. Prepare Overlay Assets (Animated GIFs/APNGs)
            const overlayAssets = new Map();
            for (const slide of slides) {
                if (slide.overlays) {
                    for (const ov of slide.overlays) {
                        if (ov.hidden) continue;
                        if (ov.type === 'image' && ov.imageData) {
                            try {
                                const base64 = ov.imageData.split(',')[1];
                                const binary = atob(base64);
                                const len = binary.length;
                                const buffer = new Uint8Array(len);
                                for (let i = 0; i < len; i++) buffer[i] = binary.charCodeAt(i);
                                
                                const mime = ov.imageData.match(/data:([^;]+);/)?.[1] || 'image/png';
                                const asset = await loadAssetFromData(buffer.buffer, mime);
                                if (asset) overlayAssets.set(ov.id, asset);
                            } catch(e) { console.warn("Failed to load overlay asset", e); }
                        }
                    }
                }
            }

            // --- Encoding ---
            
	            const processFrames = async (videoSource, canvas, ctx) => {
	                let currentTime = 0;
	                let processedFrames = 0;
	                const fps = 30;

                for (let i = 0; i < slides.length; i++) {
                    const slide = slides[i];
                    const nextSlide = slides[i+1];
                    const asset = slideAssets[i];
                    const nextAsset = slideAssets[i+1];

                    const durationFrames = Math.round(slide.duration * fps);
                    const tDur = slide.transitionDuration !== undefined ? slide.transitionDuration : videoSettings.transitionDuration;
                    const transFrames = (slide.transitionType !== 'none' && tDur > 0) ? Math.round(Math.min(tDur, slide.duration - 0.5) * fps) : 0;
                    const staticFrames = durationFrames - transFrames;
                    const kenBurns = slide.effectType === 'kenburns' ? getKenBurnsParams(slide.id) : null;
                    const nextKenBurns = (nextSlide && nextSlide.effectType === 'kenburns') ? getKenBurnsParams(nextSlide.id) : null;

                    for (let f = 0; f < durationFrames; f++) {
                        const frameTime = f / fps;
                        await renderBackground(ctx, width, height, videoSettings.backgroundFill === 'white' ? 'white' : 'black', bgAsset, currentTime);
                        
                        if (f < staticFrames || !nextAsset) {
                            const p = Math.min(1.0, frameTime / slide.duration);
                            await drawSlideFrame(ctx, asset, width, height, slide.effectType, kenBurns, p, slide, videoSettings, frameTime, overlayAssets);
                        } else {
                            const transP = (f - staticFrames) / transFrames;
                            const curP = Math.min(1.0, frameTime / slide.duration);
                            const nextP = Math.min(1.0, (f - staticFrames) / fps / Math.max(1, nextSlide.duration));
                            
                            switch (slide.transitionType) {
                                case 'fade':
                                    await drawSlideFrame(ctx, asset, width, height, slide.effectType, kenBurns, curP, slide, videoSettings, frameTime, overlayAssets);
                                    ctx.globalAlpha = transP;
                                    await drawSlideFrame(ctx, nextAsset, width, height, nextSlide.effectType, nextKenBurns, nextP, nextSlide, videoSettings, 0, overlayAssets);
                                    ctx.globalAlpha = 1.0;
                                    break;
                                case 'slide':
                                    // Current left, Next from right
                                    ctx.save();
                                    ctx.translate(-width * transP, 0);
                                    await drawSlideFrame(ctx, asset, width, height, slide.effectType, kenBurns, curP, slide, videoSettings, frameTime, overlayAssets);
                                    ctx.restore();
                                    ctx.save();
                                    ctx.translate(width * (1 - transP), 0);
                                    await drawSlideFrame(ctx, nextAsset, width, height, nextSlide.effectType, nextKenBurns, nextP, nextSlide, videoSettings, 0, overlayAssets);
                                    ctx.restore();
                                    break;
                                case 'wipe':
                                    // Current under, Next clip in from left
                                    await drawSlideFrame(ctx, asset, width, height, slide.effectType, kenBurns, curP, slide, videoSettings, frameTime, overlayAssets);
                                    ctx.save();
                                    ctx.beginPath();
                                    ctx.rect(0, 0, width * transP, height);
                                    ctx.clip();
                                    await drawSlideFrame(ctx, nextAsset, width, height, nextSlide.effectType, nextKenBurns, nextP, nextSlide, videoSettings, 0, overlayAssets);
                                    ctx.restore();
                                    break;
                                case 'zoom':
                                    // Current fade out, Next zoom in
                                    ctx.globalAlpha = 1.0 - transP;
                                    await drawSlideFrame(ctx, asset, width, height, slide.effectType, kenBurns, curP, slide, videoSettings, frameTime, overlayAssets);
                                    ctx.globalAlpha = 1.0;
                                    ctx.save();
                                    const scaleZ = 0.5 + 0.5 * transP;
                                    ctx.translate(width/2, height/2);
                                    ctx.scale(scaleZ, scaleZ);
                                    ctx.translate(-width/2, -height/2);
                                    await drawSlideFrame(ctx, nextAsset, width, height, nextSlide.effectType, nextKenBurns, nextP, nextSlide, videoSettings, 0, overlayAssets);
                                    ctx.restore();
                                    break;
                                case 'flip':
                                    // 3D Flip sim via ScaleX
                                    if (transP < 0.5) {
                                        ctx.save();
                                        ctx.translate(width/2, height/2);
                                        ctx.scale(1 - 2 * transP, 1);
                                        ctx.translate(-width/2, -height/2);
                                        await drawSlideFrame(ctx, asset, width, height, slide.effectType, kenBurns, curP, slide, videoSettings, frameTime, overlayAssets);
                                        ctx.restore();
                                    } else {
                                        ctx.save();
                                        ctx.translate(width/2, height/2);
                                        ctx.scale(2 * (transP - 0.5), 1);
                                        ctx.translate(-width/2, -height/2);
                                        await drawSlideFrame(ctx, nextAsset, width, height, nextSlide.effectType, nextKenBurns, nextP, nextSlide, videoSettings, 0, overlayAssets);
                                        ctx.restore();
                                    }
                                    break;
                                case 'cross-zoom':
                                    // Current scale up fade out, Next scale down fade in
                                    ctx.globalAlpha = 1.0 - transP;
                                    const scaleC = 1 + transP;
                                    ctx.save();
                                    ctx.translate(width/2, height/2);
                                    ctx.scale(scaleC, scaleC);
                                    ctx.translate(-width/2, -height/2);
                                    await drawSlideFrame(ctx, asset, width, height, slide.effectType, kenBurns, curP, slide, videoSettings, frameTime, overlayAssets);
                                    ctx.restore();
                                    ctx.globalAlpha = transP;
                                    const scaleN = 1.5 - 0.5 * transP;
                                    ctx.save();
                                    ctx.translate(width/2, height/2);
                                    ctx.scale(scaleN, scaleN);
                                    ctx.translate(-width/2, -height/2);
                                    await drawSlideFrame(ctx, nextAsset, width, height, nextSlide.effectType, nextKenBurns, nextP, nextSlide, videoSettings, 0, overlayAssets);
                                    ctx.restore();
                                    ctx.globalAlpha = 1.0;
                                    break;
                                default:
                                    // Default Fade for safety if new type added but not handled
                                    await drawSlideFrame(ctx, asset, width, height, slide.effectType, kenBurns, curP, slide, videoSettings, frameTime, overlayAssets);
                                    ctx.globalAlpha = transP;
                                    await drawSlideFrame(ctx, nextAsset, width, height, nextSlide.effectType, nextKenBurns, nextP, nextSlide, videoSettings, 0, overlayAssets);
                                    ctx.globalAlpha = 1.0;
                                    break;
                            }
                        }
                        
	                        await videoSource.add(currentTime, 1/fps);
	                        
	                        currentTime += 1/fps;
                        processedFrames++;
                        if (processedFrames % 15 === 0) self.postMessage({ type: 'progress', current: i+1, total: slides.length });
                    }
                }
            };

	            {
	                const canvas = new OffscreenCanvas(width, height);
	                const ctx = canvas.getContext('2d', { alpha: false });

	                let output = null;
	                let completed = false;

	                try {
	                    const target = new BufferTarget();

	                    const extension = videoSettings.format === 'mov' ? 'mov' : 'mp4';
	                    output = new Output({
	                        format: extension === 'mov' ? new MovOutputFormat({ fastStart: false }) : new Mp4OutputFormat({ fastStart: false }),
	                        target
	                    });

                    const videoSource = new CanvasSource(canvas, {
                        codec: 'avc',
                        bitrate: 4_000_000,
                        frameRate: 30
                    });

                    output.addVideoTrack(videoSource, { frameRate: 30 });

                    let audioSource = null;
                    let audioAddChain = Promise.resolve();
                    let audioHasDecoderConfig = false;
                    let audioError = null;

                    if (audioChannels) {
                        audioSource = new EncodedAudioPacketSource('aac');
                        output.addAudioTrack(audioSource);
                    }

                    await output.start();

	                    await fontsReadyPromise;

	                    if (audioChannels && audioSource) {
	                        if (typeof AudioEncoder !== 'function') {
	                            throw new Error('このブラウザでは音つき動画が作れないよ。');
	                        }

	                        const aacDescription = new Uint8Array([${DEFAULT_AAC_DESCRIPTION.join(', ')}]); // AAC-LC, 44100Hz, Stereo
	                        const aacDecoderConfig = {
	                            codec: 'mp4a.40.2',
	                            numberOfChannels: 2,
	                            sampleRate: 44100,
	                            description: aacDescription
	                        };

	                        const audioEncoder = new AudioEncoder({
	                            output: (chunk) => {
	                                const packet = EncodedPacket.fromEncodedChunk(chunk);
	                                if (!audioHasDecoderConfig) {
	                                    audioHasDecoderConfig = true;
	                                    audioAddChain = audioAddChain.then(() => audioSource.add(packet, { decoderConfig: aacDecoderConfig }));
	                                } else {
	                                    audioAddChain = audioAddChain.then(() => audioSource.add(packet));
	                                }
	                            },
	                            error: (e) => { audioError = e; }
	                        });
                        audioEncoder.configure({ codec: 'mp4a.40.2', sampleRate: 44100, numberOfChannels: 2, bitrate: 128_000 });

                        const [audioDataL, audioDataR] = audioChannels;
	                        const lenSamples = audioDataL.length;
	                        const chunkSize = 4096;
	                        for (let i = 0; i < lenSamples; i += chunkSize) {
	                            const end = Math.min(i + chunkSize, lenSamples);
	                            const len = end - i;
	                            const data = new Float32Array(len * 2);
	                            data.set(audioDataL.subarray(i, end), 0);
	                            data.set(audioDataR.subarray(i, end), len);
	                            const frame = new AudioData({ format: 'f32-planar', sampleRate: 44100, numberOfFrames: len, numberOfChannels: 2, timestamp: Math.round((i / 44100) * 1_000_000), data });
	                            audioEncoder.encode(frame); frame.close();
	                        }

                        try {
                            await audioEncoder.flush();
                            await audioAddChain;
                        } finally {
                            try { audioEncoder.close(); } catch (_) {}
                        }
                        if (audioError) {
                            throw audioError;
                        }
                        if (!audioHasDecoderConfig) {
                            throw new Error('音声の情報が読み取れなかったよ。');
                        }
                    }

	                    await processFrames(videoSource, canvas, ctx);
	                    
	                    await output.finalize();
	                    completed = true;

	                    const buffer = target.buffer;
	                    self.postMessage({ type: 'done', buffer, extension }, [buffer]);
	                } finally {
	                    if (!completed) {
	                        try { await output?.cancel?.(); } catch (_) {}
	                    }
	                }
	            }
        } catch (e) {
            console.error(e);
            self.postMessage({ type: 'error', message: e?.message || String(e) });
        }
    }
};
`
