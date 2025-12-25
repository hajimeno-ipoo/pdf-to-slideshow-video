
import React, { useRef, useState, useEffect } from 'react';
import { Slide, Overlay, OverlayType, TokenUsage } from '../types';
import { renderPageOverview, updateThumbnail } from '../services/pdfVideoService';
import { useEditor } from './slideEditor/SlideEditorContext';
import ColorSettingsPanel from './cropModal/ColorSettingsPanel';
import AudioSettingsPanel from './cropModal/AudioSettingsPanel';
import ImageSettingsPanel from './cropModal/ImageSettingsPanel';
import OverlaySettingsPanel from './cropModal/OverlaySettingsPanel';
import { safeRandomUUID } from '../utils/uuid';
import { deleteOverlayById, nudgeOverlayById, reorderOverlaysById, toggleOverlayHidden, toggleOverlayLocked } from '../utils/overlayUtils';
import { getCroppedImageLayoutPx } from '../utils/cropPreviewUtils';

interface SlideInspectorProps {
  slide: Slide;
  onUpdate: (updatedSlide: Slide) => void;
  onUsageUpdate?: (usage: TokenUsage) => void;
  aiEnabled: boolean;
  sourceFile: File | null;
  onClose?: () => void; // Added for mobile
}

type ResizeHandleType = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
type ToolType = 'move' | 'rotate' | ResizeHandleType;

// --- Helper Functions ---
const getCursorStyle = (handle: ResizeHandleType, rotation: number = 0): string => {
    let baseAngle = 0;
    switch (handle) {
        case 'n': baseAngle = 0; break;
        case 'ne': baseAngle = 45; break;
        case 'e': baseAngle = 90; break;
        case 'se': baseAngle = 135; break;
        case 's': baseAngle = 180; break;
        case 'sw': baseAngle = 225; break;
        case 'w': baseAngle = 270; break;
        case 'nw': baseAngle = 315; break;
    }
    const totalAngle = (baseAngle + rotation) % 360;
    const normalizedAngle = totalAngle < 0 ? totalAngle + 360 : totalAngle;

    if ((normalizedAngle >= 337.5 || normalizedAngle < 22.5) || (normalizedAngle >= 157.5 && normalizedAngle < 202.5)) return 'ns-resize';
    if ((normalizedAngle >= 22.5 && normalizedAngle < 67.5) || (normalizedAngle >= 202.5 && normalizedAngle < 247.5)) return 'nesw-resize';
    if ((normalizedAngle >= 67.5 && normalizedAngle < 112.5) || (normalizedAngle >= 247.5 && normalizedAngle < 292.5)) return 'ew-resize';
    return 'nwse-resize';
};

const SOLID_PREVIEW_WIDTH = 400; // 無地スライド用のデフォルト描画幅

const SlideInspector: React.FC<SlideInspectorProps> = ({ slide, onUpdate, onUsageUpdate, aiEnabled, sourceFile, onClose }) => {
  const { videoSettings } = useEditor(); // Get global settings
  const SLIDE_TOKEN = '__SLIDE__';
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [stageSize, setStageSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  
  const [activeTab, setActiveTab] = useState<'crop' | 'overlay' | 'image' | 'color' | 'audio'>('crop');
  const [overviewImage, setOverviewImage] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Local state for editing
  const [crop, setCrop] = useState(slide.crop);
  const [overlays, setOverlays] = useState<Overlay[]>(slide.overlays || []);
  const [layerOrder, setLayerOrder] = useState<string[]>(slide.layerOrder || [SLIDE_TOKEN, ...(slide.overlays || []).map(o => o.id)]);
  const [slideLayout, setSlideLayout] = useState<{ x: number; y: number; w: number } | null>(slide.layout || null);
  const [solidColor, setSolidColor] = useState<string>(slide.backgroundColor || '#000000');
  const [audioFile, setAudioFile] = useState<File | undefined>(slide.audioFile);
  const [audioVolume, setAudioVolume] = useState<number>(slide.audioVolume ?? 1.0);
  const [localDuration, setLocalDuration] = useState<number>(slide.duration);
  
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);

  // Selection state
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null); // overlay id or '__SLIDE__'
  const [draggingLayerOverlayId, setDraggingLayerOverlayId] = useState<string | null>(null);
  const [dragOverLayerOverlayId, setDragOverLayerOverlayId] = useState<string | null>(null);
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const [dragModeCrop, setDragModeCrop] = useState<'move' | 'nw' | 'ne' | 'sw' | 'se' | null>(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [startCrop, setStartCrop] = useState(slide.crop);
  const [isDraggingOverlay, setIsDraggingOverlay] = useState(false);
  const [activeOverlayTool, setActiveOverlayTool] = useState<ToolType | null>(null);
  const [startOverlayState, setStartOverlayState] = useState<{ x: number, y: number, w: number, h: number, rot: number, fontSize: number }>({ x: 0, y: 0, w: 0, h: 0, rot: 0, fontSize: 0 });
  const [startMouseAngle, setStartMouseAngle] = useState(0);
  // Store the screen dimensions at the start of the drag to prevent skewing when moving outside/resizing
  const [startScreenRect, setStartScreenRect] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [isDraggingSlide, setIsDraggingSlide] = useState(false);
  const [slideDragMode, setSlideDragMode] = useState<'move' | 'se' | null>(null);
  const [startSlideLayout, setStartSlideLayout] = useState<{ x: number; y: number; w: number }>({ x: 0, y: 0, w: 0 });
  const [startSlideRect, setStartSlideRect] = useState<{ x: number; y: number; w: number; h: number }>({ x: 0, y: 0, w: 0, h: 0 });

  // Placement Mode State
  const [pendingAddType, setPendingAddType] = useState<OverlayType | null>(null);

  const isCanvasMode = activeTab !== 'crop';
  const isSolidSlide = !!slide.backgroundColor;
  const hasCanvasLayout =
      !!slideLayout ||
      !!slide.layout ||
      !!slide.layerOrder ||
      overlays.some(o => (o.space || 'slide') === 'canvas');
  const showCanvasStage = activeTab !== 'crop' && (isCanvasMode || hasCanvasLayout);

  // プレビュー縮尺に応じて角丸をスケールする
  const getScaledRadiusPx = () => {
      const baseW = slide.width || slide.originalWidth || 1920;
      const baseH = slide.height || slide.originalHeight || 1080;
      const dispW = imageSize.width || baseW;
      const dispH = imageSize.height || baseH;
      const ratio = Math.min(dispW / baseW, dispH / baseH);
      return videoSettings.slideBorderRadius * ratio;
  };

  // Sync with prop changes
  useEffect(() => {
      setCrop(slide.crop);
      setOverlays(slide.overlays || []);
      setLayerOrder(slide.layerOrder || [SLIDE_TOKEN, ...(slide.overlays || []).map(o => o.id)]);
      setSlideLayout(slide.layout || null);
      setSolidColor(slide.backgroundColor || '#000000');
      setAudioFile(slide.audioFile);
      setAudioVolume(slide.audioVolume ?? 1.0);
      setLocalDuration(slide.duration);
      setSelectedOverlayId(null);
      setSelectedLayerId(null);
      setPendingAddType(null);
      setImageSize({ width: 0, height: 0 });
      setIsDraggingSlide(false);
      setSlideDragMode(null);

      // Load Overview Image
      const loadOverview = async () => {
          try {
              const url = await renderPageOverview(sourceFile, slide);
              setOverviewImage(url);
          } catch(e) { console.error(e); }
      };
      loadOverview();
  }, [slide, sourceFile]); // Depend on full slide object to sync Undo/Redo/External changes

  // Stage size tracking (canvas mode)
  useEffect(() => {
      if (!stageRef.current) return;
      if (!showCanvasStage) return;
      const el = stageRef.current;
      const update = () => {
          const rect = el.getBoundingClientRect();
          setStageSize({ width: rect.width, height: rect.height });
      };
      update();
      const observer = new ResizeObserver(update);
      observer.observe(el);
      window.addEventListener('resize', update);
      return () => {
          observer.disconnect();
          window.removeEventListener('resize', update);
      };
  }, [showCanvasStage]);

  // Keep layerOrder in sync with overlays
  useEffect(() => {
      setLayerOrder(prev => {
          const ids = overlays.map(o => o.id);
          let next = Array.isArray(prev) ? [...prev] : [];
          if (!next.includes(SLIDE_TOKEN)) next.unshift(SLIDE_TOKEN);
          next = next.filter(id => id === SLIDE_TOKEN || ids.includes(id));
          for (const id of ids) if (!next.includes(id)) next.push(id);
          return next;
      });
  }, [overlays]);

  // Audio Preview & Duration Sync Logic
  useEffect(() => {
      if (audioFile) {
          const url = URL.createObjectURL(audioFile);
          setAudioPreviewUrl(url);
          const audio = new Audio(url);
          audio.onloadedmetadata = () => { 
              if (isFinite(audio.duration)) {
                  setAudioDuration(audio.duration);
                  // Automatically update duration if the audio file has changed (is new)
                  if (audioFile !== slide.audioFile) {
                      setLocalDuration(Math.max(1.0, parseFloat(audio.duration.toFixed(1))));
                  }
              }
          };
          return () => { URL.revokeObjectURL(url); setAudioPreviewUrl(null); setAudioDuration(0); };
      } else { 
          setAudioPreviewUrl(null); 
          setAudioDuration(0); 
      }
  }, [audioFile, slide.audioFile]);

  // Global Event Listeners for Dragging
  useEffect(() => {
      if (isDraggingCrop || isDraggingOverlay || isDraggingSlide) {
          const handleGlobalMove = (e: MouseEvent) => {
              handleMouseMove(e as unknown as React.MouseEvent);
          };
          const handleGlobalUp = () => {
              handleMouseUp();
          };
          window.addEventListener('mousemove', handleGlobalMove);
          window.addEventListener('mouseup', handleGlobalUp);
          return () => {
              window.removeEventListener('mousemove', handleGlobalMove);
              window.removeEventListener('mouseup', handleGlobalUp);
          };
      }
  }, [isDraggingCrop, isDraggingOverlay, isDraggingSlide, dragModeCrop, activeOverlayTool, slideDragMode, startPos, startCrop, startOverlayState, startScreenRect, startSlideLayout, startSlideRect, activeTab, isCanvasMode, stageSize.width, stageSize.height, videoSettings.slideScale]);

  // Cancel pending add on Escape
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'Escape' && pendingAddType) {
              setPendingAddType(null);
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingAddType]);

  // Key controls for overlays (delete / arrow nudge)
  useEffect(() => {
      if (!selectedOverlayId) return;
      if (activeTab === 'crop') return;
      const handleKeyDown = (e: KeyboardEvent) => {
          const target = e.target as HTMLElement;
          if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || (target as any).isContentEditable)) return;
          const selected = overlays.find(o => o.id === selectedOverlayId);
          if (!selected) return;

          if (e.key === 'Delete' || e.key === 'Backspace') {
              e.preventDefault();
              if (selected.locked) return;
              setOverlays(prev => deleteOverlayById(prev, selectedOverlayId));
              setSelectedOverlayId(null);
              setSelectedLayerId(null);
              return;
          }

          if (e.key.startsWith('Arrow')) {
              e.preventDefault();
              if (selected.locked) return;
              const step = e.shiftKey ? 0.05 : 0.002;
              let dx = 0;
              let dy = 0;
              switch (e.key) {
                  case 'ArrowUp': dy = -step; break;
                  case 'ArrowDown': dy = step; break;
                  case 'ArrowLeft': dx = -step; break;
                  case 'ArrowRight': dx = step; break;
              }
              setOverlays(prev => nudgeOverlayById(prev, selectedOverlayId, dx, dy));
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, overlays, selectedOverlayId]);

  // Apply Changes Logic
  const handleApplyChanges = async () => {
      setIsUpdating(true);
      const updatedSlide = {
          ...slide,
          crop,
          overlays,
          layout: slideLayout || undefined,
          layerOrder: layerOrder || undefined,
          backgroundColor: isSolidSlide ? solidColor : undefined,
          audioFile,
          audioVolume,
          duration: localDuration,
          // IMPORTANT: Keep customImageFile to ensure we can re-render clean background later
          customImageFile: slide.customImageFile 
      };
      
      try {
          // Generate thumbnail with baked-in overlays for grid view
          const newThumb = await updateThumbnail(sourceFile, updatedSlide, videoSettings);
          updatedSlide.thumbnailUrl = newThumb;
          onUpdate(updatedSlide);
      } catch(e) { console.error("Update failed", e); }
      setIsUpdating(false);
  };

  // --- Input Handlers (Crop, Overlay, etc.) ---
  
  const getScreenRect = () => {
    const aspect = slide.width && slide.height ? slide.width / slide.height : 16 / 9;
    const fallbackWidth = SOLID_PREVIEW_WIDTH;
    const fallbackHeight = fallbackWidth / aspect;
    const refWidth = imageSize.width || imageRef.current?.clientWidth || imageRef.current?.naturalWidth || 0;
    const refHeight = imageSize.height || imageRef.current?.clientHeight || imageRef.current?.naturalHeight || 0;

    if (refWidth > 0 && refHeight > 0) {
        const scaleX = refWidth / slide.originalWidth;
        const scaleY = refHeight / slide.originalHeight;
        return {
          x: crop.x * scaleX, y: crop.y * scaleY,
          width: crop.width * scaleX, height: crop.height * scaleY
        };
    }

    // fallback when ref size not ready
    const scaleX = fallbackWidth / slide.width;
    const scaleY = fallbackHeight / slide.height;
    return {
        x: crop.x * scaleX,
        y: crop.y * scaleY,
        width: crop.width * scaleX,
        height: crop.height * scaleY
    };
  };

  const getCanvasStageRect = () => {
      return { x: 0, y: 0, width: stageSize.width, height: stageSize.height };
  };

  const getSlideAspect = () => {
      if (slide.crop && slide.crop.width && slide.crop.height) return slide.crop.width / slide.crop.height;
      if (slide.width && slide.height) return slide.width / slide.height;
      return 16 / 9;
  };

  const getDefaultSlideRectPx = () => {
      const stageW = stageSize.width;
      const stageH = stageSize.height;
      const scale = videoSettings.slideScale / 100;
      const availableW = stageW * scale;
      const availableH = stageH * scale;
      const aspect = getSlideAspect();
      let w = availableW;
      let h = w / aspect;
      if (h > availableH) { h = availableH; w = h * aspect; }
      const x = (stageW / 2) - (w / 2);
      const y = (stageH / 2) - (h / 2);
      return { x, y, w, h };
  };

  const getSlideRectPx = () => {
      const stageW = stageSize.width;
      const stageH = stageSize.height;
      const aspect = getSlideAspect();
      if (!stageW || !stageH) return { x: 0, y: 0, w: 0, h: 0 };
      if (!slideLayout || !Number.isFinite(slideLayout.x) || !Number.isFinite(slideLayout.y) || !Number.isFinite(slideLayout.w)) {
          return getDefaultSlideRectPx();
      }
      let w = slideLayout.w * stageW;
      let h = w / aspect;
      if (h > stageH) { h = stageH; w = h * aspect; }
      const x = slideLayout.x * stageW;
      const y = slideLayout.y * stageH;
      return { x, y, w, h };
  };

  const ensureSlideLayout = () => {
      if (slideLayout) return slideLayout;
      const stageW = stageSize.width;
      const stageH = stageSize.height;
      const rect = getDefaultSlideRectPx();
      const next = { x: stageW > 0 ? rect.x / stageW : 0, y: stageH > 0 ? rect.y / stageH : 0, w: stageW > 0 ? rect.w / stageW : 0.8 };
      setSlideLayout(next);
      return next;
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (!pendingAddType) return;

	      if (isCanvasMode) {
	          if (!stageRef.current) return;
	          if (stageSize.width === 0 || stageSize.height === 0) return;

	          const stageRectDom = stageRef.current.getBoundingClientRect();
	          const mouseX = e.clientX - stageRectDom.left;
	          const mouseY = e.clientY - stageRectDom.top;

	          const relativeX = mouseX / stageSize.width;
	          const relativeY = mouseY / stageSize.height;
	          if (!Number.isFinite(relativeX) || !Number.isFinite(relativeY)) return;

	          const type = pendingAddType;
	          const newOverlay: Overlay = {
	              id: safeRandomUUID(),
              type,
              x: relativeX,
              y: relativeY,
              rotation: 0,
              opacity: 1,
	              startTime: 0,
	              duration: localDuration,
	              animationOut: 'fade',
	              space: 'canvas',
	              text: type === 'text' ? 'テキスト' : undefined,
	              fontSize: type === 'text' ? 8 : undefined,
	              color: type === 'text' ? '#ffffff' : (type === 'arrow' || type === 'rect' || type === 'circle' || type === 'line' ? '#ef4444' : undefined),
	              width: type === 'text' ? undefined : 0.2,
	              height: type === 'rect' || type === 'circle' ? 0.2 : (type === 'arrow' || type === 'line' ? 0.05 : undefined),
              strokeWidth: type === 'text' ? 0 : 5,
              backgroundColor: type === 'text' ? undefined : (type === 'rect' || type === 'circle' ? 'transparent' : undefined),
              borderStyle: type === 'line' ? 'solid' : undefined,
              strokeLineCap: type === 'line' ? 'butt' : undefined,
          };

          setOverlays(prev => [...prev, newOverlay]);
          setSelectedOverlayId(newOverlay.id);
          setSelectedLayerId(newOverlay.id);
          setActiveTab(type === 'image' ? 'image' : 'overlay');
          setPendingAddType(null);
          return;
      }

      if (!containerRef.current) return;

      const screenRect = getScreenRect();
      if (screenRect.width === 0 || screenRect.height === 0) return;

      const scale = activeTab === 'crop' ? 1 : videoSettings.slideScale / 100;
      const contRect = containerRef.current.getBoundingClientRect();
      
      const centerX = contRect.left + contRect.width / 2;
      const centerY = contRect.top + contRect.height / 2;
      
      const dxScreen = e.clientX - centerX;
      const dyScreen = e.clientY - centerY;
      
      const dxUnscaled = dxScreen / scale;
      const dyUnscaled = dyScreen / scale;
      
      const containerW = contRect.width / scale;
      const containerH = contRect.height / scale;
      
      const mouseX = (containerW / 2) + dxUnscaled;
      const mouseY = (containerH / 2) + dyUnscaled;
      
      if (
          mouseX < screenRect.x || 
          mouseX > screenRect.x + screenRect.width || 
          mouseY < screenRect.y || 
          mouseY > screenRect.y + screenRect.height
      ) {
          return;
      }

      const relativeX = (mouseX - screenRect.x) / screenRect.width;
      const relativeY = (mouseY - screenRect.y) / screenRect.height;

      const type = pendingAddType;
      const newOverlay: Overlay = { 
            id: safeRandomUUID(), 
        type: type, 
        x: relativeX, 
        y: relativeY, 
        rotation: 0, 
        opacity: 1, 
        startTime: 0,
        duration: localDuration, // Default to full slide duration
        animationOut: 'fade',
        text: type === 'text' ? 'テキスト' : undefined, 
        fontSize: type === 'text' ? 8 : undefined, 
        color: type === 'text' ? '#ffffff' : (type === 'arrow' || type === 'rect' || type === 'circle' || type === 'line' ? '#ef4444' : undefined), 
        width: type === 'text' ? undefined : 0.2, 
        height: type === 'rect' || type === 'circle' || type === 'image' ? 0.2 : (type === 'arrow' || type === 'line' ? 0.05 : undefined), 
        strokeWidth: type === 'text' ? 0 : 5, 
        backgroundColor: type === 'text' ? undefined : (type === 'rect' || type === 'circle' ? 'transparent' : undefined), 
        borderStyle: type === 'line' ? 'solid' : undefined, 
        strokeLineCap: type === 'line' ? 'butt' : undefined, 
      };

      setOverlays(prev => [...prev, newOverlay]);
      setSelectedOverlayId(newOverlay.id);
      setSelectedLayerId(newOverlay.id);
      setActiveTab('overlay');
      setPendingAddType(null); // Reset pending state
  };

  const handleMouseDownCrop = (e: React.MouseEvent, mode: 'move' | 'nw' | 'ne' | 'sw' | 'se') => {
    e.preventDefault(); e.stopPropagation();
    setIsDraggingCrop(true); setDragModeCrop(mode);
    setStartPos({ x: e.clientX, y: e.clientY });
    setStartCrop({ ...crop });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      // Crop Dragging (No scale correction needed as transform is 'none')
      if (activeTab === 'crop' && isDraggingCrop && dragModeCrop && imageRef.current) {
          const dxScreen = e.clientX - startPos.x;
          const dyScreen = e.clientY - startPos.y;
          const scaleX = slide.originalWidth / imageRef.current.width;
          const scaleY = slide.originalHeight / imageRef.current.height;
          const dx = dxScreen * scaleX; const dy = dyScreen * scaleY;
          let newCrop = { ...startCrop };

          if (dragModeCrop === 'move') { newCrop.x = startCrop.x + dx; newCrop.y = startCrop.y + dy; }
          else if (dragModeCrop === 'se') { newCrop.width = Math.max(10, startCrop.width + dx); newCrop.height = Math.max(10, startCrop.height + dy); }
          else if (dragModeCrop === 'sw') { newCrop.x = Math.min(startCrop.x + startCrop.width - 10, startCrop.x + dx); newCrop.width = Math.max(10, startCrop.width - dx); newCrop.height = Math.max(10, startCrop.height + dy); }
          else if (dragModeCrop === 'ne') { newCrop.y = Math.min(startCrop.y + startCrop.height - 10, startCrop.y + dy); newCrop.width = Math.max(10, startCrop.width + dx); newCrop.height = Math.max(10, startCrop.height - dy); }
          else if (dragModeCrop === 'nw') { newCrop.x = Math.min(startCrop.x + startCrop.width - 10, startCrop.x + dx); newCrop.y = Math.min(startCrop.y + startCrop.height - 10, startCrop.y + dy); newCrop.width = Math.max(10, startCrop.width - dx); newCrop.height = Math.max(10, startCrop.height - dy); }

          if (newCrop.x < 0) newCrop.x = 0; if (newCrop.y < 0) newCrop.y = 0;
          const maxWidth = slide.originalWidth; const maxHeight = slide.originalHeight;
          if (newCrop.x + newCrop.width > maxWidth) { if (dragModeCrop === 'move') newCrop.x = maxWidth - newCrop.width; else newCrop.width = maxWidth - newCrop.x; }
          if (newCrop.y + newCrop.height > maxHeight) { if (dragModeCrop === 'move') newCrop.y = maxHeight - newCrop.height; else newCrop.height = maxHeight - newCrop.y; }
          setCrop(newCrop);
      }

      // Slide dragging (Canvas mode)
      if (isCanvasMode && isDraggingSlide && slideDragMode && stageSize.width > 0 && stageSize.height > 0) {
          const dxPx = e.clientX - startPos.x;
          const dyPx = e.clientY - startPos.y;
          const aspect = getSlideAspect();
          if (slideDragMode === 'move') {
              const wNorm = startSlideLayout.w;
              const wPx = wNorm * stageSize.width;
              const hPx = wPx / aspect;
              const maxX = Math.max(0, 1 - (wPx / stageSize.width));
              const maxY = Math.max(0, 1 - (hPx / stageSize.height));
              const x = Math.min(maxX, Math.max(0, startSlideLayout.x + (dxPx / stageSize.width)));
              const y = Math.min(maxY, Math.max(0, startSlideLayout.y + (dyPx / stageSize.height)));
              setSlideLayout({ x, y, w: wNorm });
          } else if (slideDragMode === 'se') {
              const minWpx = 50;
              let newWpx = Math.max(minWpx, startSlideRect.w + dxPx);
              newWpx = Math.min(newWpx, stageSize.width - startSlideRect.x);
              let newHpx = newWpx / aspect;
              if (newHpx > stageSize.height - startSlideRect.y) {
                  newHpx = stageSize.height - startSlideRect.y;
                  newWpx = newHpx * aspect;
              }
              const w = stageSize.width > 0 ? (newWpx / stageSize.width) : startSlideLayout.w;
              setSlideLayout({ x: startSlideLayout.x, y: startSlideLayout.y, w });
          }
      }
      
      // Overlay Dragging
      if (activeTab !== 'crop' && isDraggingOverlay && selectedOverlayId && activeOverlayTool) {
          // Use the startScreenRect captured at mouseDown to ensure consistent coordinate system during drag
          const screenRect = startScreenRect;
          if (screenRect.width === 0 || screenRect.height === 0) return;
          const target = overlays.find(t => t.id === selectedOverlayId);
          if (!target) return;
          const mouseX = e.clientX; const mouseY = e.clientY;

          // Apply scale correction because the container is transformed (scaled)
          const currentScale = isCanvasMode ? 1 : (videoSettings.slideScale / 100);
          const dxRaw = mouseX - startPos.x;
          const dyRaw = mouseY - startPos.y;
          const dx = dxRaw / currentScale;
	          const dy = dyRaw / currentScale;

	          if (activeOverlayTool === 'move') {
	              updateSelectedOverlay({ x: startOverlayState.x + (dx / screenRect.width), y: startOverlayState.y + (dy / screenRect.height) });
	          } else if (activeOverlayTool === 'rotate') {
              // Rotation logic
              const cx = screenRect.x + (target.x * screenRect.width);
              const cy = screenRect.y + (target.y * screenRect.height);
              
              const deltaAngle = (mouseX - startPos.x) * 0.5; // Drag right to rotate clockwise
              let newRot = (startOverlayState.rot + deltaAngle) % 360;
              if (e.shiftKey) newRot = Math.round(newRot / 15) * 15;
              updateSelectedOverlay({ rotation: newRot });
          } else if (['n','s','e','w','ne','nw','se','sw'].includes(activeOverlayTool)) {
              // Resizing Logic - Strict check for handles
              const rad = -(startOverlayState.rot * Math.PI) / 180;
              const localDxPx = dx * Math.cos(rad) - dy * Math.sin(rad);
              const localDyPx = dx * Math.sin(rad) + dy * Math.cos(rad);
              const localDx = localDxPx / screenRect.width; const localDy = localDyPx / screenRect.height;
              
              let newW = startOverlayState.w; let newH = startOverlayState.h;
              let centerXOffset = 0; let centerYOffset = 0;
              const handle = activeOverlayTool as ResizeHandleType;
              
              if (handle.includes('e')) { newW = Math.max(0.01, startOverlayState.w + localDx); centerXOffset = (newW - startOverlayState.w) / 2; }
              else if (handle.includes('w')) { newW = Math.max(0.01, startOverlayState.w - localDx); centerXOffset = -(newW - startOverlayState.w) / 2; }
              if (handle.includes('s')) { newH = Math.max(0.01, startOverlayState.h + localDy); centerYOffset = (newH - startOverlayState.h) / 2; }
              else if (handle.includes('n')) { newH = Math.max(0.01, startOverlayState.h - localDy); centerYOffset = -(newH - startOverlayState.h) / 2; }
              
              let shouldKeepRatio = e.shiftKey;
              if (target.type === 'image') {
                  shouldKeepRatio = !e.shiftKey;
              }

              if (shouldKeepRatio && startOverlayState.h > 0) { 
                  const ratio = startOverlayState.w / startOverlayState.h; 
                  if (handle.includes('e') || handle.includes('w')) {
                      newH = newW / ratio;
                      if (handle.includes('s')) centerYOffset = (newH - startOverlayState.h) / 2;
                      else if (handle.includes('n')) centerYOffset = -(newH - startOverlayState.h) / 2;
                  } 
                  else if ((handle === 'n' || handle === 's')) {
                      newW = newH * ratio;
                  }
              }
              
              if (target.type === 'text') {
                  const scaleFactor = Math.max(0.1, newW / startOverlayState.w);
                  updateSelectedOverlay({ fontSize: Math.max(1, startOverlayState.fontSize * scaleFactor), });
                  if (target.width) updateSelectedOverlay({ width: newW });
              } else {
                  const updates: Partial<Overlay> = {};
                  updates.width = newW; updates.height = newH;
                  const centerRotRad = (startOverlayState.rot * Math.PI) / 180;
                  const pxOffsetX = centerXOffset * screenRect.width; const pxOffsetY = centerYOffset * screenRect.height;
                  const rotatedPxOffsetX = pxOffsetX * Math.cos(centerRotRad) - pxOffsetY * Math.sin(centerRotRad);
                  const rotatedPxOffsetY = pxOffsetX * Math.sin(centerRotRad) + pxOffsetY * Math.cos(centerRotRad);
                  updates.x = startOverlayState.x + (rotatedPxOffsetX / screenRect.width);
                  updates.y = startOverlayState.y + (rotatedPxOffsetY / screenRect.height);
                  updateSelectedOverlay(updates);
              }
          }
      }
  };

  const handleMouseUp = () => {
      setIsDraggingCrop(false); setDragModeCrop(null);
      // Drop: if a slide-space overlay is released outside the slide in canvas mode, promote it to canvas-space.
      if (activeTab !== 'crop' && isCanvasMode && isDraggingOverlay && selectedOverlayId && stageSize.width > 0 && stageSize.height > 0) {
          const target = overlays.find(t => t.id === selectedOverlayId);
          if (target && (target.space || 'slide') !== 'canvas') {
              const margin = 0.02;
              const isOutside = (target.x < -margin || target.x > 1 + margin || target.y < -margin || target.y > 1 + margin);
              if (isOutside) {
                  const slideRect = getSlideRectPx();
                  if (slideRect.w > 0 && slideRect.h > 0) {
                      const absX = slideRect.x + (target.x * slideRect.w);
                      const absY = slideRect.y + (target.y * slideRect.h);
                      const xCanvas = Math.min(1, Math.max(0, absX / stageSize.width));
                      const yCanvas = Math.min(1, Math.max(0, absY / stageSize.height));
                      const wCanvas = target.width !== undefined ? (target.width * slideRect.w) / stageSize.width : target.width;
                      const hCanvas = target.height !== undefined ? (target.height * slideRect.h) / stageSize.height : target.height;
                      const scaleY = slideRect.h / stageSize.height;

                      setOverlays(prev => prev.map(o => {
                          if (o.id !== selectedOverlayId) return o;
                          return {
                              ...o,
                              space: 'canvas',
                              x: xCanvas,
                              y: yCanvas,
                              width: wCanvas,
                              height: hCanvas,
                              fontSize: o.fontSize !== undefined ? o.fontSize * scaleY : o.fontSize,
                              strokeWidth: o.strokeWidth !== undefined ? o.strokeWidth * scaleY : o.strokeWidth,
                              shadowBlur: o.shadowBlur !== undefined ? o.shadowBlur * scaleY : o.shadowBlur,
                              shadowOffsetX: o.shadowOffsetX !== undefined ? o.shadowOffsetX * scaleY : o.shadowOffsetX,
                              shadowOffsetY: o.shadowOffsetY !== undefined ? o.shadowOffsetY * scaleY : o.shadowOffsetY,
                              borderRadius: o.borderRadius !== undefined ? o.borderRadius * scaleY : o.borderRadius,
                          };
                      }));
                  }
              }
          }
      }

      setIsDraggingOverlay(false); setActiveOverlayTool(null);
      setIsDraggingSlide(false); setSlideDragMode(null);
  };

  const handleAddOverlay = (type: OverlayType, imageData?: string) => { 
		    if (type === 'image' && imageData) { 
		        const newOverlay: Overlay = {
		            id: safeRandomUUID(), 
		            type: 'image', 
		            x: 0.5, 
		            y: 0.5, 
	            rotation: 0, 
	            opacity: 1, 
	            startTime: 0,
		            duration: localDuration,
		            animationOut: 'fade',
		            imageData: imageData,
		            width: 0.3,
		            height: 0.3,
		            space: isCanvasMode ? 'canvas' : undefined
		        };

        const img = new Image(); 
	        img.onload = () => { 
	            const imageAspect = img.width / img.height; 
		            const rect = getScreenRect();
		            const slideAspect = (rect.width > 0 && rect.height > 0) ? rect.width / rect.height : (slide.width / slide.height || 16/9);
		            const canvasAspect = stageSize.width > 0 && stageSize.height > 0 ? (stageSize.width / stageSize.height) : (16/9);
		            const baseAspect = (newOverlay.space === 'canvas') ? canvasAspect : slideAspect;
		            newOverlay.height = (0.3 * baseAspect) / imageAspect; 
		            setOverlays([...overlays, newOverlay]); 
		            setSelectedOverlayId(newOverlay.id); 
		            setSelectedLayerId(newOverlay.id);
		            setActiveTab('image'); 
		        }; 
        img.src = imageData; 
	    } else { 
	        if (pendingAddType === type) {
	            setPendingAddType(null);
	            return;
	        }
	        setPendingAddType(type);
	        setSelectedOverlayId(null); 
	        setSelectedLayerId(null);
	    }
	  };

  const handleMouseDownSlide = (e: React.MouseEvent, mode: 'move' | 'se') => {
      e.preventDefault();
      e.stopPropagation();
      if (!isCanvasMode) return;
      if (stageSize.width === 0 || stageSize.height === 0) return;
      const layout = ensureSlideLayout();
      const rect = getSlideRectPx();
      setSelectedLayerId(SLIDE_TOKEN);
      setSelectedOverlayId(null);
      setIsDraggingSlide(true);
      setSlideDragMode(mode);
      setStartPos({ x: e.clientX, y: e.clientY });
      setStartSlideLayout(layout);
      setStartSlideRect({ x: rect.x, y: rect.y, w: rect.w, h: rect.h });
  };
  
  const updateSelectedOverlay = (updates: Partial<Overlay>) => { if (!selectedOverlayId) return; setOverlays(prev => prev.map(t => t.id === selectedOverlayId ? { ...t, ...updates } : t)); };
  const handleDeleteOverlay = () => {
      if (!selectedOverlayId) return;
      const target = overlays.find(t => t.id === selectedOverlayId);
      if (target?.locked) return;
      setOverlays(prev => deleteOverlayById(prev, selectedOverlayId));
      setSelectedOverlayId(null);
      setSelectedLayerId(null);
  };
  type OverlayReorderAction = 'front' | 'back' | 'forward' | 'backward';
  const reorderSelectedOverlay = (action: OverlayReorderAction) => {
      if (!selectedOverlayId) return;
      setOverlays(prev => {
          const index = prev.findIndex(t => t.id === selectedOverlayId);
          if (index < 0) return prev;

          const next = [...prev];
          const [item] = next.splice(index, 1);

          if (action === 'front') next.push(item);
          else if (action === 'back') next.unshift(item);
          else if (action === 'forward') next.splice(Math.min(next.length, index + 1), 0, item);
          else next.splice(Math.max(0, index - 1), 0, item);

          return next;
      });
  };

	  const handleMouseDownOverlay = (e: React.MouseEvent, id: string, tool: ToolType) => { 
	    e.stopPropagation(); 
	    e.preventDefault(); 
	    setSelectedOverlayId(id); 
	    setSelectedLayerId(id);
	    const locked = overlays.find(t => t.id === id)?.locked;
	    if (locked) return;
    setActiveOverlayTool(tool); 
    setIsDraggingOverlay(true); 
    setStartPos({ x: e.clientX, y: e.clientY }); 

    const getOverlayBaseRect = (ov?: Overlay) => {
        if (!isCanvasMode) return getScreenRect();
        const slideRect = getSlideRectPx();
        const stageRect = getCanvasStageRect();
        if (ov && (ov.space || 'slide') === 'canvas') return stageRect;
        return { x: slideRect.x, y: slideRect.y, width: slideRect.w, height: slideRect.h };
    };

    const target = overlays.find(t => t.id === id); 
    const rect = getOverlayBaseRect(target);
    setStartScreenRect(rect);
    if (target) { 
        const el = document.getElementById(`overlay-${id}`);
        let currentW = target.width || 0;
        let currentH = target.height || 0;
        
        if (el && rect.width > 0 && rect.height > 0 && (currentW === 0 || currentH === 0)) {
            currentW = el.offsetWidth / rect.width;
            currentH = el.offsetHeight / rect.height;
        }

        setStartOverlayState({ x: target.x, y: target.y, w: currentW, h: currentH, rot: target.rotation, fontSize: target.fontSize || 0 }); 
        if (tool === 'rotate') { 
            const cx = rect.x + (target.x * rect.width); 
            const cy = rect.y + (target.y * rect.height); 
            const angle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI); 
            setStartMouseAngle(angle); 
        } 
        
        if (target.type === 'image') {
            if (activeTab !== 'image') setActiveTab('image'); 
        } else {
            if (activeTab !== 'overlay') setActiveTab('overlay'); 
        }
    }
  };

  const handleContainerMouseDown = (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
          setSelectedOverlayId(null);
          setSelectedLayerId(null);
      }
  };

  const handleResetCrop = () => { setCrop({ x: 0, y: 0, width: slide.originalWidth, height: slide.originalHeight }); };

  const screenRect = getScreenRect();
  const selectedOverlay = overlays.find(t => t.id === selectedOverlayId);
  const selectedOverlayIndex = selectedOverlayId ? overlays.findIndex(t => t.id === selectedOverlayId) : -1;
  const canMoveOverlayForward = selectedOverlayIndex >= 0 && selectedOverlayIndex < overlays.length - 1;
  const canMoveOverlayBackward = selectedOverlayIndex > 0;
  const visibleOverlays = overlays.filter(o => !o.hidden);

  const getOverlayLabel = (ov: Overlay) => {
      if (ov.type === 'image') return '画像';
      if (ov.type === 'text') return ov.text ? `テキスト: ${ov.text}` : 'テキスト';
      if (ov.type === 'line') return '線';
      if (ov.type === 'arrow') return '矢印';
      if (ov.type === 'rect') return '四角';
      if (ov.type === 'circle') return '丸';
      return ov.type;
  };

  // インスペクタの周囲背景は常に動画設定の塗りに従う（黒基調）
  const getBackgroundColor = () => {
      if (videoSettings.backgroundFill === 'white') return '#ffffff';
      if (videoSettings.backgroundFill === 'black') return '#000000';
      return '#0f172a'; 
  };

  const renderOverlayForCanvas = (ov: Overlay, baseW: number, baseH: number) => {
      const isSelected = ov.id === selectedOverlayId;
      const interactive = isCanvasMode && activeTab !== 'crop';
      const baseStyle: React.CSSProperties = {
          position: 'absolute',
          left: `${ov.x * 100}%`,
          top: `${ov.y * 100}%`,
          transform: `translate(-50%, -50%) rotate(${ov.rotation || 0}deg)`,
          cursor: interactive ? 'move' : 'default',
          opacity: ov.opacity ?? 1,
          userSelect: 'none',
          pointerEvents: interactive ? 'auto' : 'none'
      };
      const strokeWidthPx = (ov.strokeWidth || 0) * (baseH / 500);
      const shadowScale = baseH / 500;

      return (
          <div
              key={ov.id}
              id={`overlay-${ov.id}`}
              style={baseStyle}
              onMouseDown={interactive ? ((e) => handleMouseDownOverlay(e, ov.id, 'move')) : undefined}
          >
              {ov.type === 'text' && (
                  <div style={{
                      position: 'relative',
                      fontSize: `${(ov.fontSize || 5) / 100 * baseH}px`,
                      fontFamily: `"${ov.fontFamily}", sans-serif`,
                      fontWeight: ov.isBold ? 'bold' : 'normal',
                      fontStyle: ov.isItalic ? 'italic' : 'normal',
                      textAlign: ov.textAlign || 'center',
                      whiteSpace: ov.width ? 'normal' : 'pre',
                      width: ov.width ? `${ov.width * 100}%` : 'auto',
                      minWidth: ov.width ? `${ov.width * baseW}px` : 'auto',
                      backgroundColor: ov.backgroundColor,
                      padding: ov.backgroundColor ? `${(ov.backgroundPadding||0) * ((ov.fontSize||5)/500 * baseH)}px` : undefined,
                      borderRadius: `${(ov.borderRadius||0)}px`,
                      filter: ov.shadowColor ? `drop-shadow(${(ov.shadowOffsetX||0)*shadowScale}px ${(ov.shadowOffsetY||0)*shadowScale}px ${(ov.shadowBlur||0)*shadowScale}px ${ov.shadowColor})` : undefined
                  }}>
                      {strokeWidthPx > 0 && (
                          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, WebkitTextStroke: `${Math.max(1, strokeWidthPx)}px ${ov.strokeColor || 'transparent'}`, color: 'transparent', zIndex: 0, pointerEvents: 'none', padding: ov.backgroundColor ? `${(ov.backgroundPadding||0) * ((ov.fontSize||5)/500 * baseH)}px` : undefined }}>{ov.text}</div>
                      )}
                      <div style={{ position: 'relative', zIndex: 1, color: ov.color }}>{ov.text}</div>
                  </div>
              )}
              {ov.type === 'image' && ov.imageData && (
                  <img src={ov.imageData} alt="overlay" style={{ width: `${(ov.width||0.2) * baseW}px`, height: `${(ov.height||0.2) * baseH}px`, objectFit: 'fill', maxWidth: 'none', maxHeight: 'none', filter: `drop-shadow(${(ov.shadowOffsetX||0)*shadowScale}px ${(ov.shadowOffsetY||0)*shadowScale}px ${(ov.shadowBlur||0)*shadowScale}px ${ov.shadowColor||'transparent'})` }} draggable={false} />
              )}
              {(ov.type === 'rect' || ov.type === 'circle') && (
                  <div style={{ width: `${(ov.width||0.2) * baseW}px`, height: `${(ov.height||0.2) * baseH}px`, border: `${strokeWidthPx}px solid ${ov.color}`, backgroundColor: ov.backgroundColor || 'transparent', borderRadius: ov.type === 'circle' ? '50%' : `${(ov.borderRadius||0)}px`, boxShadow: `${(ov.shadowOffsetX||0)*shadowScale}px ${(ov.shadowOffsetY||0)*shadowScale}px ${(ov.shadowBlur||0)*shadowScale}px ${ov.shadowColor||'transparent'}` }} />
              )}
              {ov.type === 'line' && (
                  <svg width={`${(ov.width||0.2) * baseW}`} height={`${Math.max(20, strokeWidthPx * 2)}`} style={{ overflow: 'visible', filter: ov.shadowColor ? `drop-shadow(${(ov.shadowOffsetX||0)*shadowScale}px ${(ov.shadowOffsetY||0)*shadowScale}px ${(ov.shadowBlur||0)*shadowScale}px ${ov.shadowColor})` : undefined }}>
                      <line x1="0" y1="50%" x2="100%" y2="50%" stroke={ov.color} strokeWidth={strokeWidthPx} strokeLinecap={ov.strokeLineCap || 'butt'} strokeDasharray={ ov.borderStyle === 'dashed' ? `${strokeWidthPx * 3},${strokeWidthPx * 2}` : ov.borderStyle === 'dotted' ? (ov.strokeLineCap === 'round' ? `0,${strokeWidthPx * 2}` : `${strokeWidthPx},${strokeWidthPx}`) : undefined } />
                  </svg>
              )}
              {ov.type === 'arrow' && (
                  (() => {
                      const w = (ov.width || 0.2) * baseW;
                      const h = (ov.height || 0.05) * baseH;
                      const headHeight = h;
                      const headLength = Math.min(w, headHeight);
                      const shaftHeight = (ov.strokeWidth || 5) * (baseH / 500);
                      const shaftY = (h - shaftHeight) / 2;
                      return (
                          <svg width={w} height={h} style={{ filter: `drop-shadow(${(ov.shadowOffsetX||0)*shadowScale}px ${(ov.shadowOffsetY||0)*shadowScale}px ${(ov.shadowBlur||0)*shadowScale}px ${ov.shadowColor||'transparent'})`, overflow: 'visible' }}>
                              <rect x="0" y={shaftY} width={Math.max(0, w - headLength)} height={shaftHeight} fill={ov.color} />
                              <polygon points={`${w},${h/2} ${w-headLength},0 ${w-headLength},${h}`} fill={ov.color} />
                          </svg>
                      );
                  })()
              )}

              {isSelected && interactive && !ov.locked && (
                  <div className="absolute inset-0 border border-emerald-400 pointer-events-none" style={{ margin: '-4px' }}>
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-6 h-6 bg-white rounded-full shadow border border-slate-400 flex items-center justify-center cursor-grab pointer-events-auto hover:bg-emerald-50" onMouseDown={(e) => handleMouseDownOverlay(e, ov.id, 'rotate')}>↻</div>
                      {ov.type !== 'line' && (
                          <>
                              <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-emerald-500 pointer-events-auto" style={{ cursor: getCursorStyle('nw', ov.rotation) }} onMouseDown={(e) => handleMouseDownOverlay(e, ov.id, 'nw')} />
                              <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-emerald-500 pointer-events-auto" style={{ cursor: getCursorStyle('ne', ov.rotation) }} onMouseDown={(e) => handleMouseDownOverlay(e, ov.id, 'ne')} />
                              <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-emerald-500 pointer-events-auto" style={{ cursor: getCursorStyle('sw', ov.rotation) }} onMouseDown={(e) => handleMouseDownOverlay(e, ov.id, 'sw')} />
                              <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-emerald-500 pointer-events-auto" style={{ cursor: getCursorStyle('se', ov.rotation) }} onMouseDown={(e) => handleMouseDownOverlay(e, ov.id, 'se')} />
                              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border border-emerald-500 pointer-events-auto" style={{ cursor: getCursorStyle('n', ov.rotation) }} onMouseDown={(e) => handleMouseDownOverlay(e, ov.id, 'n')} />
                              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border border-emerald-500 pointer-events-auto" style={{ cursor: getCursorStyle('s', ov.rotation) }} onMouseDown={(e) => handleMouseDownOverlay(e, ov.id, 's')} />
                              <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-white border border-emerald-500 pointer-events-auto" style={{ cursor: getCursorStyle('e', ov.rotation) }} onMouseDown={(e) => handleMouseDownOverlay(e, ov.id, 'e')} />
                              <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 bg-white border border-emerald-500 pointer-events-auto" style={{ cursor: getCursorStyle('w', ov.rotation) }} onMouseDown={(e) => handleMouseDownOverlay(e, ov.id, 'w')} />
                          </>
                      )}
                      {ov.type === 'line' && (
                          <>
                              <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-white border border-emerald-500 pointer-events-auto" style={{ cursor: getCursorStyle('e', ov.rotation) }} onMouseDown={(e) => handleMouseDownOverlay(e, ov.id, 'e')} />
                              <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 bg-white border border-emerald-500 pointer-events-auto" style={{ cursor: getCursorStyle('w', ov.rotation) }} onMouseDown={(e) => handleMouseDownOverlay(e, ov.id, 'w')} />
                          </>
                      )}
                  </div>
              )}
          </div>
      );
  };

  return (
    <div className="flex flex-col h-full bg-transparent border-l border-white/10 idle-sidebar-typography">
      {/* 1. Header & Tabs */}
      <div className="flex-none p-3 border-b border-white/10 bg-transparent z-10 flex flex-col gap-3">
          <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                  {onClose && (
                      <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white transition-colors flex items-center text-xs font-bold gap-1 px-1 py-1 rounded hover:bg-slate-800">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" /></svg>
                          閉じる
                      </button>
                  )}
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">スライド編集</h3>
              </div>
              <button 
                  onClick={handleApplyChanges}
                  disabled={isUpdating}
                  className="px-3 py-1.5 idle-btn-primary rounded text-xs font-bold transition-colors shadow-sm flex items-center gap-2"
              >
                  {isUpdating ? <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 1010 10A10 10 0 0012 2zm0 18a8 8 0 118-8 8 8 0 01-8 8z" className="opacity-25" /><path fill="currentColor" d="M12 4a8 8 0 018 8V2a10 10 0 00-10 10z" className="opacity-75" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                  {isUpdating ? '更新中' : '適用'}
              </button>
          </div>
          <div className="flex bg-black/15 rounded p-0.5 overflow-x-auto border border-white/10">
              <button onClick={() => setActiveTab('crop')} className={`flex-1 px-3 py-1.5 rounded text-[10px] whitespace-nowrap transition-colors ${activeTab === 'crop' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>トリミング</button>
              <button onClick={() => setActiveTab('overlay')} className={`flex-1 px-3 py-1.5 rounded text-[10px] whitespace-nowrap transition-colors ${activeTab === 'overlay' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>装飾</button>
              <button onClick={() => setActiveTab('image')} className={`flex-1 px-3 py-1.5 rounded text-[10px] whitespace-nowrap transition-colors ${activeTab === 'image' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>画像</button>
              <button onClick={() => setActiveTab('audio')} className={`flex-1 px-3 py-1.5 rounded text-[10px] whitespace-nowrap transition-colors ${activeTab === 'audio' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>音声</button>
          </div>
	          <div className="flex justify-end" />
	      </div>

      <div className="flex-1 flex flex-col landscape:flex-row lg:!flex-col overflow-hidden">
          
          {/* 2. Visual Editor (Canvas) */}
	          <div className="relative bg-transparent flex items-center justify-center p-4 
                          border-b border-slate-800
                          landscape:border-b-0 landscape:border-r lg:!border-b lg:!border-r-0
                          overflow-hidden select-none group/canvas flex-shrink-0
                          
                          min-h-[250px] max-h-[40%]
                          landscape:w-1/2 landscape:h-full landscape:max-h-full landscape:min-h-0
                          lg:!w-full lg:!h-auto lg:!max-h-[40%] lg:!min-h-[250px]
                          "
               style={{ backgroundColor: getBackgroundColor() }}
          >
              {pendingAddType && isCanvasMode && (
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[11px] px-2.5 py-1 rounded-full shadow-lg z-50 pointer-events-none animate-bounce">
                      ダブルクリックして配置
                  </div>
              )}
              {showCanvasStage && (
                  <div
                      ref={stageRef}
                      className="relative w-full max-w-full border border-slate-800 rounded-lg overflow-hidden"
                      style={{ aspectRatio: videoSettings.aspectRatio.replace(':', '/'), backgroundColor: getBackgroundColor() }}
                      onDoubleClick={isCanvasMode ? handleDoubleClick : undefined}
                      onMouseDown={(e) => {
                          if (e.target === e.currentTarget) {
                              setSelectedOverlayId(null);
                              setSelectedLayerId(null);
                          }
                      }}
                  >
	                      {(() => {
	                          const slideRect = getSlideRectPx();
	                          const overlayById = new Map(overlays.map(o => [o.id, o]));
	                          const draggingOverlay = (isCanvasMode && isDraggingOverlay && selectedOverlayId) ? overlayById.get(selectedOverlayId) : null;
	                          const draggingIsSlideSpace = !!draggingOverlay && ((draggingOverlay.space || 'slide') !== 'canvas');
	                          const slideOverlayIds = layerOrder
	                              .filter(id => id !== SLIDE_TOKEN && overlayById.get(id) && ((overlayById.get(id)!.space || 'slide') !== 'canvas') && !overlayById.get(id)!.hidden)
	                              .filter(id => !(draggingIsSlideSpace && id === selectedOverlayId));

	                          const toCanvasPreview = (ov: Overlay) => {
	                              if (stageSize.width <= 0 || stageSize.height <= 0) return null;
	                              if (slideRect.w <= 0 || slideRect.h <= 0) return null;
	                              const absX = slideRect.x + (ov.x * slideRect.w);
	                              const absY = slideRect.y + (ov.y * slideRect.h);
	                              const xCanvas = absX / stageSize.width;
	                              const yCanvas = absY / stageSize.height;
	                              const wCanvas = ov.width !== undefined ? (ov.width * slideRect.w) / stageSize.width : ov.width;
	                              const hCanvas = ov.height !== undefined ? (ov.height * slideRect.h) / stageSize.height : ov.height;
	                              const scaleY = slideRect.h / stageSize.height;
	                              return {
	                                  ...ov,
	                                  space: 'canvas' as const,
	                                  x: xCanvas,
	                                  y: yCanvas,
	                                  width: wCanvas,
	                                  height: hCanvas,
	                                  fontSize: ov.fontSize !== undefined ? ov.fontSize * scaleY : ov.fontSize,
	                                  strokeWidth: ov.strokeWidth !== undefined ? ov.strokeWidth * scaleY : ov.strokeWidth,
	                                  shadowBlur: ov.shadowBlur !== undefined ? ov.shadowBlur * scaleY : ov.shadowBlur,
	                                  shadowOffsetX: ov.shadowOffsetX !== undefined ? ov.shadowOffsetX * scaleY : ov.shadowOffsetX,
	                                  shadowOffsetY: ov.shadowOffsetY !== undefined ? ov.shadowOffsetY * scaleY : ov.shadowOffsetY,
	                                  borderRadius: ov.borderRadius !== undefined ? ov.borderRadius * scaleY : ov.borderRadius,
	                              };
	                          };

	                          const dragPreviewOverlay = (draggingIsSlideSpace && draggingOverlay && !draggingOverlay.hidden)
	                              ? toCanvasPreview(draggingOverlay)
	                              : null;

	                          const elements = layerOrder.map(id => {
		                              if (id === SLIDE_TOKEN) {
		                                  const cropW = crop?.width || slide.crop?.width || slide.width || 1;
		                                  const cropH = crop?.height || slide.crop?.height || slide.height || 1;
	                                  const cropX = crop?.x || slide.crop?.x || 0;
	                                  const cropY = crop?.y || slide.crop?.y || 0;
	                                  const originalW = slide.originalWidth || slide.width || cropW;
	                                  const originalH = slide.originalHeight || slide.height || cropH;
	                                  const cropLayout = getCroppedImageLayoutPx({
	                                      originalWidth: originalW,
	                                      originalHeight: originalH,
	                                      crop: { x: cropX, y: cropY, width: cropW, height: cropH },
	                                      targetWidth: slideRect.w,
	                                      targetHeight: slideRect.h,
	                                  });
	                                  return (
	                                      <div
	                                          key={id}
	                                          style={{
	                                              position: 'absolute',
                                              left: slideRect.x,
                                              top: slideRect.y,
                                              width: slideRect.w,
                                              height: slideRect.h,
                                              borderRadius: `${videoSettings.slideBorderRadius}px`,
                                              overflow: 'hidden',
                                              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
                                              border: selectedLayerId === SLIDE_TOKEN ? '2px solid rgba(16,185,129,0.8)' : '1px solid rgba(255,255,255,0.15)',
	                                              cursor: isCanvasMode ? 'move' : 'default',
	                                          }}
	                                          onMouseDown={(e) => {
	                                              if (!isCanvasMode) return;
	                                              handleMouseDownSlide(e, 'move');
	                                          }}
	                                      >
	                                          {overviewImage ? (
	                                              <img
	                                                  src={overviewImage}
	                                                  alt="Slide"
	                                                  draggable={false}
	                                                  className="absolute pointer-events-none select-none"
	                                                  style={{
	                                                      left: cropLayout.left,
	                                                      top: cropLayout.top,
	                                                      width: cropLayout.width,
	                                                      height: cropLayout.height,
	                                                      borderRadius: `${videoSettings.slideBorderRadius}px`,
	                                                  }}
	                                              />
	                                          ) : (
	                                              <img
	                                                  src={slide.thumbnailUrl}
	                                                  alt="Slide"
	                                                  draggable={false}
	                                                  className="w-full h-full object-cover pointer-events-none"
	                                                  style={{ borderRadius: `${videoSettings.slideBorderRadius}px` }}
	                                              />
	                                          )}
	                                          <div className="absolute inset-0" style={{ pointerEvents: 'auto' }}>
	                                              {slideOverlayIds.map(oid => {
	                                                  const ov = overlayById.get(oid);
	                                                  if (!ov) return null;
                                                  return renderOverlayForCanvas(ov, slideRect.w, slideRect.h);
                                              })}
                                          </div>
	                                          {selectedLayerId === SLIDE_TOKEN && isCanvasMode && (
	                                              <div
	                                                  className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-emerald-500 cursor-se-resize"
	                                                  onMouseDown={(e) => {
	                                                      if (!isCanvasMode) return;
	                                                      handleMouseDownSlide(e, 'se');
	                                                  }}
	                                              />
	                                          )}
	                                      </div>
	                                  );
	                              }

		                              const ov = overlayById.get(id);
		                              if (!ov || ov.hidden) return null;
		                              if ((ov.space || 'slide') !== 'canvas') return null;
		                              return renderOverlayForCanvas(ov, stageSize.width, stageSize.height);
	                          });

	                          if (dragPreviewOverlay) {
	                              elements.push(
	                                  <div key="__DRAG_PREVIEW__" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
	                                      {renderOverlayForCanvas(dragPreviewOverlay, stageSize.width, stageSize.height)}
	                                  </div>
	                              );
	                          }

	                          return elements;
	                      })()}
	                  </div>
	              )}

              {!showCanvasStage && (
              <div className="relative inline-block shadow-2xl" ref={containerRef}
                   onDoubleClick={handleDoubleClick}
                   style={{ 
                       transform: activeTab === 'crop' ? 'none' : `scale(${videoSettings.slideScale / 100})`,
                       overflow: 'visible',
                       boxShadow: videoSettings.slideScale < 100 && activeTab !== 'crop' ? '0 10px 15px -3px rgba(0, 0, 0, 0.5)' : 'none',
                       cursor: pendingAddType ? 'crosshair' : 'default'
                   }}
              >
                  {/* Content Wrapper for clipping */}
                  <div style={{
                      borderRadius: activeTab === 'crop' ? '0px' : `${getScaledRadiusPx()}px`,
                      overflow: 'hidden',
                      position: 'relative'
                  }}>
                      <img 
                        ref={imageRef} 
                        src={overviewImage || slide.thumbnailUrl} 
                        alt="Slide" 
                        className="max-h-[260px] w-auto max-w-full object-contain pointer-events-none block" 
                        draggable={false} 
                        style={{ backgroundColor: 'transparent', borderRadius: activeTab === 'crop' ? '0px' : `${getScaledRadiusPx()}px` }}
                        onLoad={() => {
                          if (!imageRef.current) return;
                          setImageSize({
                            width: imageRef.current.clientWidth || imageRef.current.naturalWidth || 0,
                            height: imageRef.current.clientHeight || imageRef.current.naturalHeight || 0,
                          });
                        }}
                      />
                  </div>

                  {/* Crop Overlay */}
                  {activeTab === 'crop' && (
                    <>
                      <div className="absolute inset-0 bg-black/50 pointer-events-none">
                         <div className="w-full h-full" style={{ clipPath: `polygon(0% 0%, 0% 100%, ${screenRect.x}px 100%, ${screenRect.x}px ${screenRect.y}px, ${screenRect.x + screenRect.width}px ${screenRect.y}px, ${screenRect.x + screenRect.width}px ${screenRect.y + screenRect.height}px, ${screenRect.x}px ${screenRect.y + screenRect.height}px, ${screenRect.x}px 100%, 100% 100%, 100% 0%)` }} />
                      </div>
                      <div className="absolute border border-emerald-400 shadow-[0_0_0_1px_rgba(16,185,129,0.5)] touch-none" style={{ left: screenRect.x, top: screenRect.y, width: screenRect.width, height: screenRect.height, cursor: 'move' }} onMouseDown={(e) => handleMouseDownCrop(e, 'move')}>
                        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-20"><div className="border-r border-b border-white"></div><div className="border-r border-b border-white"></div><div className="border-b border-white"></div><div className="border-r border-b border-white"></div><div className="border-r border-b border-white"></div><div className="border-b border-white"></div><div className="border-r border-white"></div><div className="border-r border-white"></div></div>
                        <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-emerald-500 border border-white cursor-nw-resize z-10" onMouseDown={(e) => handleMouseDownCrop(e, 'nw')} />
                        <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-emerald-500 border border-white cursor-ne-resize z-10" onMouseDown={(e) => handleMouseDownCrop(e, 'ne')} />
                        <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-emerald-500 border border-white cursor-sw-resize z-10" onMouseDown={(e) => handleMouseDownCrop(e, 'sw')} />
                        <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-emerald-500 border border-white cursor-se-resize z-10" onMouseDown={(e) => handleMouseDownCrop(e, 'se')} />
                      </div>
                    </>
                  )}

                  {/* Overlays */}
                  {(activeTab === 'overlay' || activeTab === 'image' || activeTab === 'audio') && (
                      <div 
                        className="absolute z-10" 
                        style={{ left: screenRect.x, top: screenRect.y, width: screenRect.width, height: screenRect.height, border: '1px dashed rgba(255,255,255,0.2)' }} 
                        onMouseDown={handleContainerMouseDown}
                      >
                        {visibleOverlays.map(ov => {
                          const isSelected = ov.id === selectedOverlayId;
                          const baseStyle: React.CSSProperties = { position: 'absolute', left: `${ov.x * 100}%`, top: `${ov.y * 100}%`, transform: `translate(-50%, -50%) rotate(${ov.rotation || 0}deg)`, cursor: 'move', opacity: ov.opacity ?? 1, userSelect: 'none', pointerEvents: 'auto' };
                          const strokeWidthPx = (ov.strokeWidth || 0) * (screenRect.height / 500);
                          const shadowScale = screenRect.height / 500;

                          return (
                            <div key={ov.id} id={`overlay-${ov.id}`} style={baseStyle} onMouseDown={(e) => handleMouseDownOverlay(e, ov.id, 'move')}>
                                {ov.type === 'text' && (
                                    <div style={{ 
                                        position: 'relative', 
                                        fontSize: `${(ov.fontSize || 5) / 100 * screenRect.height}px`, 
                                        fontFamily: `"${ov.fontFamily}", sans-serif`, 
                                        fontWeight: ov.isBold ? 'bold' : 'normal', 
                                        fontStyle: ov.isItalic ? 'italic' : 'normal', 
                                        textAlign: ov.textAlign || 'center', 
                                        whiteSpace: ov.width ? 'normal' : 'pre', 
                                        width: ov.width ? `${ov.width * 100}%` : 'auto', 
                                        minWidth: ov.width ? `${ov.width * screenRect.width}px` : 'auto', 
                                        backgroundColor: ov.backgroundColor, 
                                        padding: ov.backgroundColor ? `${(ov.backgroundPadding||0) * ((ov.fontSize||5)/500 * screenRect.height)}px` : undefined, 
                                        borderRadius: `${(ov.borderRadius||0)}px`, 
                                        filter: ov.shadowColor ? `drop-shadow(${(ov.shadowOffsetX||0)*shadowScale}px ${(ov.shadowOffsetY||0)*shadowScale}px ${(ov.shadowBlur||0)*shadowScale}px ${ov.shadowColor})` : undefined 
                                    }}>
                                        {strokeWidthPx > 0 && (<div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, WebkitTextStroke: `${strokeWidthPx}px ${ov.strokeColor || 'transparent'}`, color: 'transparent', zIndex: 0, pointerEvents: 'none', padding: ov.backgroundColor ? `${(ov.backgroundPadding||0) * ((ov.fontSize||5)/500 * screenRect.height)}px` : undefined }}>{ov.text}</div>)}
                                        <div style={{ position: 'relative', zIndex: 1, color: ov.color }}>{ov.text}</div>
                                    </div>
                                )}
                                {ov.type === 'image' && ov.imageData && (<img src={ov.imageData} alt="overlay" style={{ width: `${(ov.width||0.2) * screenRect.width}px`, height: `${(ov.height||0.2) * screenRect.height}px`, objectFit: 'fill', maxWidth: 'none', maxHeight: 'none', filter: `drop-shadow(${(ov.shadowOffsetX||0)*shadowScale}px ${(ov.shadowOffsetY||0)*shadowScale}px ${(ov.shadowBlur||0)*shadowScale}px ${ov.shadowColor||'transparent'})` }} draggable={false} />)}
                                {(ov.type === 'rect' || ov.type === 'circle') && (<div style={{ width: `${(ov.width||0.2) * screenRect.width}px`, height: `${(ov.height||0.2) * screenRect.height}px`, border: `${strokeWidthPx}px solid ${ov.color}`, backgroundColor: ov.backgroundColor || 'transparent', borderRadius: ov.type === 'circle' ? '50%' : `${(ov.borderRadius||0)}px`, boxShadow: `${(ov.shadowOffsetX||0)*shadowScale}px ${(ov.shadowOffsetY||0)*shadowScale}px ${(ov.shadowBlur||0)*shadowScale}px ${ov.shadowColor||'transparent'}` }} />)}
                                
                                {ov.type === 'line' && (
                                    <svg width={`${(ov.width||0.2) * screenRect.width}`} height={`${Math.max(20, strokeWidthPx * 2)}`} style={{ overflow: 'visible', filter: ov.shadowColor ? `drop-shadow(${(ov.shadowOffsetX||0)*shadowScale}px ${(ov.shadowOffsetY||0)*shadowScale}px ${(ov.shadowBlur||0)*shadowScale}px ${ov.shadowColor})` : undefined }}>
                                        <line x1="0" y1="50%" x2="100%" y2="50%" stroke={ov.color} strokeWidth={strokeWidthPx} strokeLinecap={ov.strokeLineCap || 'butt'} strokeDasharray={ ov.borderStyle === 'dashed' ? `${strokeWidthPx * 3},${strokeWidthPx * 2}` : ov.borderStyle === 'dotted' ? (ov.strokeLineCap === 'round' ? `0,${strokeWidthPx * 2}` : `${strokeWidthPx},${strokeWidthPx}`) : undefined } />
                                    </svg>
                                )}
                                
                                {ov.type === 'arrow' && (
                                    (() => { 
                                        const w = (ov.width || 0.2) * screenRect.width; 
                                        const h = (ov.height || 0.05) * screenRect.height; 
                                        const headHeight = h; 
                                        const headLength = Math.min(w, headHeight); 
                                        const shaftHeight = (ov.strokeWidth || 5) * (screenRect.height / 500); 
                                        const shaftY = (h - shaftHeight) / 2; 
                                        return ( 
                                            <svg width={w} height={h} style={{ filter: `drop-shadow(${(ov.shadowOffsetX||0)*shadowScale}px ${(ov.shadowOffsetY||0)*shadowScale}px ${(ov.shadowBlur||0)*shadowScale}px ${ov.shadowColor||'transparent'})`, overflow: 'visible' }}> 
                                                <rect x="0" y={shaftY} width={Math.max(0, w - headLength)} height={shaftHeight} fill={ov.color} /> 
                                                <polygon points={`${w},${h/2} ${w-headLength},0 ${w-headLength},${h}`} fill={ov.color} /> 
                                            </svg> 
                                        ); 
                                    })()
                                )}

                                {isSelected && (
                                    <div className="absolute inset-0 border border-emerald-400 pointer-events-none" style={{ margin: '-4px' }}>
                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-6 h-6 bg-white rounded-full shadow border border-slate-400 flex items-center justify-center cursor-grab pointer-events-auto hover:bg-emerald-50" onMouseDown={(e) => handleMouseDownOverlay(e, ov.id, 'rotate')}>↻</div>
                                        {ov.type !== 'line' && (
                                            <><div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-emerald-500 pointer-events-auto" style={{ cursor: getCursorStyle('nw', ov.rotation) }} onMouseDown={(e) => handleMouseDownOverlay(e, ov.id, 'nw')} /><div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-emerald-500 pointer-events-auto" style={{ cursor: getCursorStyle('ne', ov.rotation) }} onMouseDown={(e) => handleMouseDownOverlay(e, ov.id, 'ne')} /><div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-emerald-500 pointer-events-auto" style={{ cursor: getCursorStyle('sw', ov.rotation) }} onMouseDown={(e) => handleMouseDownOverlay(e, ov.id, 'sw')} /><div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-emerald-500 pointer-events-auto" style={{ cursor: getCursorStyle('se', ov.rotation) }} onMouseDown={(e) => handleMouseDownOverlay(e, ov.id, 'se')} /><div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border border-emerald-500 pointer-events-auto" style={{ cursor: getCursorStyle('n', ov.rotation) }} onMouseDown={(e) => handleMouseDownOverlay(e, ov.id, 'n')} /><div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border border-emerald-500 pointer-events-auto" style={{ cursor: getCursorStyle('s', ov.rotation) }} onMouseDown={(e) => handleMouseDownOverlay(e, ov.id, 's')} /><div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-white border border-emerald-500 pointer-events-auto" style={{ cursor: getCursorStyle('e', ov.rotation) }} onMouseDown={(e) => handleMouseDownOverlay(e, ov.id, 'e')} /><div className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 bg-white border border-emerald-500 pointer-events-auto" style={{ cursor: getCursorStyle('w', ov.rotation) }} onMouseDown={(e) => handleMouseDownOverlay(e, ov.id, 'w')} /></>
                                        )}
                                        {ov.type === 'line' && (
                                            <><div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-white border border-emerald-500 pointer-events-auto" style={{ cursor: getCursorStyle('e', ov.rotation) }} onMouseDown={(e) => handleMouseDownOverlay(e, ov.id, 'e')} /><div className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 bg-white border border-emerald-500 pointer-events-auto" style={{ cursor: getCursorStyle('w', ov.rotation) }} onMouseDown={(e) => handleMouseDownOverlay(e, ov.id, 'w')} /></>
                                        )}
                                    </div>
                                )}
                            </div>
                          );
                        })}
                      </div>
                  )}
              </div>
              )}
          </div>

          {/* 3. Property Editor (Scrollable) */}
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-transparent landscape:w-1/2 lg:!w-full">
              {activeTab !== 'crop' && (showCanvasStage ? layerOrder.length > 0 : overlays.length > 0) && (
                  <div className="p-4 pb-3 border-b border-slate-800">
                      <div className="flex items-center justify-between">
                          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">要素一覧</div>
                          {isCanvasMode ? (
                              <div className="text-[10px] text-slate-500">ドラッグで並び替え（上ほど手前）</div>
                          ) : (
                              <div className="text-[10px] text-slate-500">表示は反映済み（編集OFF）</div>
                          )}
                      </div>
                      <div className="mt-2 space-y-1">
                          {showCanvasStage ? (
                              [...layerOrder].reverse().map(id => {
                                  const isSlide = id === SLIDE_TOKEN;
                                  const ov = isSlide ? null : overlays.find(o => o.id === id);
                                  const isSelected = isSlide ? (selectedLayerId === SLIDE_TOKEN) : (ov?.id === selectedOverlayId);
                                  const label = isSlide ? 'スライド' : (ov ? getOverlayLabel(ov) : '');
                                  const icon = isSlide ? 'SLD' : (ov?.type === 'text' ? 'T' : ov?.type === 'image' ? 'IMG' : ov?.type === 'line' ? '—' : ov?.type === 'arrow' ? '→' : ov?.type === 'rect' ? '▭' : ov?.type === 'circle' ? '○' : '●');
                                  const spaceLabel = !isSlide && ov ? ((ov.space || 'slide') === 'canvas' ? '背景' : 'スライド') : '';

                                  return (
                                      <div
                                          key={id}
                                          role="button"
                                          tabIndex={0}
                                          draggable={isCanvasMode}
                                          onDragStart={(e) => {
                                              if (!isCanvasMode) return;
                                              setDraggingLayerOverlayId(id);
                                              setDragOverLayerOverlayId(id);
                                              try { e.dataTransfer.setData('text/plain', id); } catch (_) {}
                                              e.dataTransfer.effectAllowed = 'move';
                                          }}
                                          onDragOver={(e) => {
                                              if (!isCanvasMode) return;
                                              if (!draggingLayerOverlayId) return;
                                              e.preventDefault();
                                              if (dragOverLayerOverlayId !== id) setDragOverLayerOverlayId(id);
                                              try { e.dataTransfer.dropEffect = 'move'; } catch (_) {}
                                          }}
                                          onDragLeave={() => {
                                              if (dragOverLayerOverlayId === id) setDragOverLayerOverlayId(null);
                                          }}
                                          onDrop={(e) => {
                                              if (!isCanvasMode) return;
                                              e.preventDefault();
                                              const fromId = draggingLayerOverlayId || (() => { try { return e.dataTransfer.getData('text/plain'); } catch (_) { return ''; } })();
                                              const toId = id;
                                              if (!fromId || fromId === toId) {
                                                  setDraggingLayerOverlayId(null);
                                                  setDragOverLayerOverlayId(null);
                                                  return;
                                              }
                                              const reorder = (arr: string[], from: string, to: string) => {
                                                  const fromIndex = arr.indexOf(from);
                                                  const toIndex = arr.indexOf(to);
                                                  if (fromIndex < 0 || toIndex < 0) return arr;
                                                  const next = [...arr];
                                                  const [moved] = next.splice(fromIndex, 1);
                                                  next.splice(toIndex, 0, moved);
                                                  return next;
                                              };
                                              const nextOrder = reorder(layerOrder, fromId, toId);
                                              setLayerOrder(nextOrder);
                                              const slideIndex = nextOrder.indexOf(SLIDE_TOKEN);
                                              if (slideIndex >= 0 && stageSize.width > 0 && stageSize.height > 0) {
                                                  const slideRect = getSlideRectPx();
                                                  setOverlays(prev => prev.map(o => {
                                                      const idx = nextOrder.indexOf(o.id);
                                                      if (idx >= 0 && idx < slideIndex && (o.space || 'slide') !== 'canvas') {
                                                          const x = (slideRect.x + (o.x * slideRect.w)) / stageSize.width;
                                                          const y = (slideRect.y + (o.y * slideRect.h)) / stageSize.height;
                                                          const w = o.width !== undefined ? (o.width * slideRect.w) / stageSize.width : o.width;
                                                          const h = o.height !== undefined ? (o.height * slideRect.h) / stageSize.height : o.height;
                                                          const scaleY = slideRect.h / stageSize.height;
                                                          return {
                                                              ...o,
                                                              space: 'canvas',
                                                              x,
                                                              y,
                                                              width: w,
                                                              height: h,
                                                              fontSize: o.fontSize !== undefined ? o.fontSize * scaleY : o.fontSize,
                                                              strokeWidth: o.strokeWidth !== undefined ? o.strokeWidth * scaleY : o.strokeWidth,
                                                              shadowBlur: o.shadowBlur !== undefined ? o.shadowBlur * scaleY : o.shadowBlur,
                                                              shadowOffsetX: o.shadowOffsetX !== undefined ? o.shadowOffsetX * scaleY : o.shadowOffsetX,
                                                              shadowOffsetY: o.shadowOffsetY !== undefined ? o.shadowOffsetY * scaleY : o.shadowOffsetY,
                                                              borderRadius: o.borderRadius !== undefined ? o.borderRadius * scaleY : o.borderRadius,
                                                          };
                                                      }
                                                      return o;
                                                  }));
                                              }
                                              setDraggingLayerOverlayId(null);
                                              setDragOverLayerOverlayId(null);
                                          }}
                                          onDragEnd={() => {
                                              setDraggingLayerOverlayId(null);
                                              setDragOverLayerOverlayId(null);
                                          }}
                                          onClick={() => {
                                              if (isSlide) {
                                                  setSelectedLayerId(SLIDE_TOKEN);
                                                  setSelectedOverlayId(null);
                                              } else if (ov) {
                                                  setSelectedOverlayId(ov.id);
                                                  setSelectedLayerId(ov.id);
                                                  if (ov.type === 'image') setActiveTab('image');
                                                  else setActiveTab('overlay');
                                              }
                                              setPendingAddType(null);
                                          }}
                                          className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded border text-left transition-colors ${
                                              isSelected ? 'bg-slate-800 border-emerald-500/60' : 'bg-slate-900/30 border-slate-800 hover:bg-slate-800/60'
                                          } ${
                                              dragOverLayerOverlayId === id && draggingLayerOverlayId && draggingLayerOverlayId !== id ? 'ring-1 ring-emerald-500/60' : ''
                                          }`}
                                      >
                                          <div className={`flex items-center gap-2 min-w-0 ${ov?.hidden ? 'opacity-50' : ''}`}>
                                              <span className="w-9 h-6 flex items-center justify-center text-[10px] font-bold bg-slate-800 border border-slate-700 rounded text-slate-200 flex-shrink-0">{icon}</span>
                                              <span className="text-xs text-slate-200 truncate">{label}</span>
                                              {!isSlide && <span className="text-[10px] text-slate-500 flex-shrink-0">{spaceLabel}</span>}
                                              {!isSlide && ov?.locked && <span className="text-[10px] text-slate-500 flex-shrink-0">🔒</span>}
                                          </div>
                                          {!isSlide && ov && (
                                              <div className="flex items-center gap-1 flex-shrink-0">
                                                  <button
                                                      type="button"
                                                      onClick={(e) => { e.stopPropagation(); setOverlays(prev => toggleOverlayHidden(prev, ov.id)); }}
                                                      draggable={false}
                                                      className="px-2 py-1 text-[10px] rounded bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700"
                                                      title={ov.hidden ? '表示する' : '非表示にする'}
                                                  >
                                                      {ov.hidden ? '表示' : '非表示'}
                                                  </button>
                                                  <button
                                                      type="button"
                                                      onClick={(e) => { e.stopPropagation(); setOverlays(prev => toggleOverlayLocked(prev, ov.id)); }}
                                                      draggable={false}
                                                      className="px-2 py-1 text-[10px] rounded bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700"
                                                      title={ov.locked ? 'ロック解除' : 'ロック'}
                                                  >
                                                      {ov.locked ? '解除' : 'ロック'}
                                                  </button>
                                              </div>
                                          )}
                                      </div>
                                  );
                              })
                          ) : (
                              [...overlays].reverse().map(ov => {
                                  const isSelected = ov.id === selectedOverlayId;
                                  const label = getOverlayLabel(ov);
                                  const icon = ov.type === 'text' ? 'T' : ov.type === 'image' ? 'IMG' : ov.type === 'line' ? '—' : ov.type === 'arrow' ? '→' : ov.type === 'rect' ? '▭' : ov.type === 'circle' ? '○' : '●';
                                  return (
                                      <div
                                          key={ov.id}
                                          role="button"
                                          tabIndex={0}
                                          draggable
                                          onDragStart={(e) => {
                                              setDraggingLayerOverlayId(ov.id);
                                              setDragOverLayerOverlayId(ov.id);
                                              try { e.dataTransfer.setData('text/plain', ov.id); } catch (_) {}
                                              e.dataTransfer.effectAllowed = 'move';
                                          }}
                                          onDragOver={(e) => {
                                              if (!draggingLayerOverlayId) return;
                                              e.preventDefault();
                                              if (dragOverLayerOverlayId !== ov.id) setDragOverLayerOverlayId(ov.id);
                                              try { e.dataTransfer.dropEffect = 'move'; } catch (_) {}
                                          }}
                                          onDragLeave={() => {
                                              if (dragOverLayerOverlayId === ov.id) setDragOverLayerOverlayId(null);
                                          }}
                                          onDrop={(e) => {
                                              e.preventDefault();
                                              const fromId = draggingLayerOverlayId || (() => { try { return e.dataTransfer.getData('text/plain'); } catch (_) { return ''; } })();
                                              const toId = ov.id;
                                              if (!fromId || fromId === toId) {
                                                  setDraggingLayerOverlayId(null);
                                                  setDragOverLayerOverlayId(null);
                                                  return;
                                              }
                                              setOverlays(prev => reorderOverlaysById([...prev].reverse(), fromId, toId).reverse());
                                              setDraggingLayerOverlayId(null);
                                              setDragOverLayerOverlayId(null);
                                          }}
                                          onDragEnd={() => {
                                              setDraggingLayerOverlayId(null);
                                              setDragOverLayerOverlayId(null);
                                          }}
                                          onClick={() => {
                                              setSelectedOverlayId(ov.id);
                                              setSelectedLayerId(ov.id);
                                              if (ov.type === 'image') setActiveTab('image');
                                              else setActiveTab('overlay');
                                              setPendingAddType(null);
                                          }}
                                          className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded border text-left transition-colors ${
                                              isSelected ? 'bg-slate-800 border-emerald-500/60' : 'bg-slate-900/30 border-slate-800 hover:bg-slate-800/60'
                                          } ${
                                              dragOverLayerOverlayId === ov.id && draggingLayerOverlayId && draggingLayerOverlayId !== ov.id ? 'ring-1 ring-emerald-500/60' : ''
                                          }`}
                                      >
                                          <div className={`flex items-center gap-2 min-w-0 ${ov.hidden ? 'opacity-50' : ''}`}>
                                              <span className="w-9 h-6 flex items-center justify-center text-[10px] font-bold bg-slate-800 border border-slate-700 rounded text-slate-200 flex-shrink-0">{icon}</span>
                                              <span className="text-xs text-slate-200 truncate">{label}</span>
                                              {ov.locked && <span className="text-[10px] text-slate-500 flex-shrink-0">🔒</span>}
                                          </div>
                                          <div className="flex items-center gap-1 flex-shrink-0">
                                              <button
                                                  type="button"
                                                  onClick={(e) => { e.stopPropagation(); setOverlays(prev => toggleOverlayHidden(prev, ov.id)); }}
                                                  draggable={false}
                                                  className="px-2 py-1 text-[10px] rounded bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700"
                                                  title={ov.hidden ? '表示する' : '非表示にする'}
                                              >
                                                  {ov.hidden ? '表示' : '非表示'}
                                              </button>
                                              <button
                                                  type="button"
                                                  onClick={(e) => { e.stopPropagation(); setOverlays(prev => toggleOverlayLocked(prev, ov.id)); }}
                                                  draggable={false}
                                                  className="px-2 py-1 text-[10px] rounded bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700"
                                                  title={ov.locked ? 'ロック解除' : 'ロック'}
                                              >
                                                  {ov.locked ? '解除' : 'ロック'}
                                              </button>
                                          </div>
                                      </div>
                                  );
                              })
                          )}
                      </div>
                  </div>
              )}
              {activeTab === 'crop' && (
                 <div className="p-4 space-y-4">
                    <div className="text-xs text-slate-400">プレビューの枠をドラッグして、表示範囲を指定してください。</div>
                    <button onClick={handleResetCrop} className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 text-xs">範囲リセット</button>
                 </div>
              )}
	              {activeTab === 'audio' && (
	                  <AudioSettingsPanel 
	                      audioFile={audioFile}
	                      audioVolume={audioVolume}
	                      audioDuration={audioDuration}
	                      audioPreviewUrl={audioPreviewUrl}
	                      onAudioFileChange={setAudioFile}
	                      onVolumeChange={setAudioVolume}
	                      imageUrl={overviewImage || slide.thumbnailUrl}
	                      initialScript={slide.narrationScript}
	                      onUsageUpdate={onUsageUpdate}
	                      aiEnabled={aiEnabled}
	                  />
	              )}
	              {activeTab === 'image' && (
	                 <ImageSettingsPanel 
	                    onAddImage={(img) => handleAddOverlay('image', img)}
	                    selectedOverlay={selectedOverlay}
	                    onUpdateOverlay={updateSelectedOverlay}
	                    onDeleteOverlay={handleDeleteOverlay}
	                    onUsageUpdate={onUsageUpdate}
	                    onReorderOverlay={reorderSelectedOverlay}
	                    canMoveForward={canMoveOverlayForward}
	                    canMoveBackward={canMoveOverlayBackward}
	                    slideDuration={localDuration}
	                    aiEnabled={aiEnabled}
	                 />
	              )}
              {activeTab === 'overlay' && (
                <OverlaySettingsPanel 
                    selectedOverlay={selectedOverlay}
                    onAddOverlay={handleAddOverlay}
                    onUpdateOverlay={updateSelectedOverlay}
                    onDeleteOverlay={handleDeleteOverlay}
                    pendingAddType={pendingAddType}
                    onReorderOverlay={reorderSelectedOverlay}
                    canMoveForward={canMoveOverlayForward}
                    canMoveBackward={canMoveOverlayBackward}
                    slideDuration={localDuration}
                />
              )}
          </div>
      </div>
    </div>
  );
};

export default SlideInspector;
