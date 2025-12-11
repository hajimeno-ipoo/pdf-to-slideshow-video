
import React, { useRef, useState, useEffect } from 'react';
import { Slide, Overlay, OverlayType, TokenUsage } from '../types';
import { renderPageOverview, updateThumbnail } from '../services/pdfVideoService';
import { useEditor } from './slideEditor/SlideEditorContext';
import ColorSettingsPanel from './cropModal/ColorSettingsPanel';
import AudioSettingsPanel from './cropModal/AudioSettingsPanel';
import ImageSettingsPanel from './cropModal/ImageSettingsPanel';
import OverlaySettingsPanel from './cropModal/OverlaySettingsPanel';

interface SlideInspectorProps {
  slide: Slide;
  onUpdate: (updatedSlide: Slide) => void;
  onUsageUpdate?: (usage: TokenUsage) => void;
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

const SlideInspector: React.FC<SlideInspectorProps> = ({ slide, onUpdate, onUsageUpdate, sourceFile, onClose }) => {
  const { videoSettings } = useEditor(); // Get global settings
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const solidRef = useRef<HTMLDivElement>(null);
  
  const [activeTab, setActiveTab] = useState<'crop' | 'overlay' | 'image' | 'color' | 'audio'>('crop');
  const [overviewImage, setOverviewImage] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Local state for editing
  const [crop, setCrop] = useState(slide.crop);
  const [overlays, setOverlays] = useState<Overlay[]>(slide.overlays || []);
  const [solidColor, setSolidColor] = useState<string>(slide.backgroundColor || '#000000');
  const [audioFile, setAudioFile] = useState<File | undefined>(slide.audioFile);
  const [audioVolume, setAudioVolume] = useState<number>(slide.audioVolume ?? 1.0);
  const [localDuration, setLocalDuration] = useState<number>(slide.duration);
  
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);

  // Selection state
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
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

  // Placement Mode State
  const [pendingAddType, setPendingAddType] = useState<OverlayType | null>(null);

  const isSolidSlide = !!slide.backgroundColor;

  // Sync with prop changes
  useEffect(() => {
      setCrop(slide.crop);
      setOverlays(slide.overlays || []);
      setSolidColor(slide.backgroundColor || '#000000');
      setAudioFile(slide.audioFile);
      setAudioVolume(slide.audioVolume ?? 1.0);
      setLocalDuration(slide.duration);
      setSelectedOverlayId(null);
      setPendingAddType(null);
      
      if (slide.backgroundColor && activeTab === 'crop') setActiveTab('color'); // Switch to color if crop is invalid for solid
      if (!slide.backgroundColor && activeTab === 'color') setActiveTab('crop');

      // Load Overview Image
      const loadOverview = async () => {
          try {
              const url = await renderPageOverview(sourceFile, slide);
              setOverviewImage(url);
          } catch(e) { console.error(e); }
      };
      loadOverview();
  }, [slide, sourceFile]); // Depend on full slide object to sync Undo/Redo/External changes

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
      if (isDraggingCrop || isDraggingOverlay) {
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
  }, [isDraggingCrop, isDraggingOverlay, dragModeCrop, activeOverlayTool, startPos, startCrop, startOverlayState, startScreenRect, activeTab, videoSettings.slideScale]);

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

  // Apply Changes Logic
  const handleApplyChanges = async () => {
      setIsUpdating(true);
      const updatedSlide = {
          ...slide,
          crop,
          overlays,
          backgroundColor: isSolidSlide ? solidColor : undefined,
          audioFile,
          audioVolume,
          duration: localDuration,
          // IMPORTANT: Keep customImageFile to ensure we can re-render clean background later
          customImageFile: slide.customImageFile 
      };
      
      try {
          // Generate thumbnail with baked-in overlays for grid view
          const newThumb = await updateThumbnail(sourceFile, updatedSlide);
          updatedSlide.thumbnailUrl = newThumb;
          onUpdate(updatedSlide);
      } catch(e) { console.error("Update failed", e); }
      setIsUpdating(false);
  };

  // --- Input Handlers (Crop, Overlay, etc.) ---
  
  const getScreenRect = () => {
    if (isSolidSlide) {
        if (!solidRef.current) return { x: 0, y: 0, width: 0, height: 0 };
        return { x: 0, y: 0, width: solidRef.current.clientWidth, height: solidRef.current.clientHeight }
    } else {
        if (!imageRef.current || !slide) return { x: 0, y: 0, width: 0, height: 0 };
        const img = imageRef.current;
        const scaleX = img.width / slide.originalWidth;
        const scaleY = img.height / slide.originalHeight;
        return {
          x: crop.x * scaleX, y: crop.y * scaleY,
          width: crop.width * scaleX, height: crop.height * scaleY
        };
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (!containerRef.current || !pendingAddType) return;

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
        id: crypto.randomUUID(), 
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
      
      // Overlay Dragging
      if (activeTab !== 'crop' && isDraggingOverlay && selectedOverlayId && activeOverlayTool) {
          // Use the startScreenRect captured at mouseDown to ensure consistent coordinate system during drag
          const screenRect = startScreenRect;
          if (screenRect.width === 0 || screenRect.height === 0) return;
          const target = overlays.find(t => t.id === selectedOverlayId);
          if (!target) return;
          const mouseX = e.clientX; const mouseY = e.clientY;

          // Apply scale correction because the container is transformed (scaled)
          const currentScale = videoSettings.slideScale / 100;
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
      setIsDraggingOverlay(false); setActiveOverlayTool(null);
  };

  const handleAddOverlay = (type: OverlayType, imageData?: string) => { 
    if (type === 'image' && imageData) { 
        const newOverlay: Overlay = { 
            id: crypto.randomUUID(), 
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
            height: 0.3
        };

        const img = new Image(); 
        img.onload = () => { 
            const imageAspect = img.width / img.height; 
            const rect = getScreenRect();
            const slideAspect = (rect.width > 0 && rect.height > 0) ? rect.width / rect.height : (slide.width / slide.height || 16/9);
            newOverlay.height = (0.3 * slideAspect) / imageAspect; 
            setOverlays([...overlays, newOverlay]); 
            setSelectedOverlayId(newOverlay.id); 
            setActiveTab('image'); 
        }; 
        img.src = imageData; 
    } else { 
        setPendingAddType(type);
        setSelectedOverlayId(null); 
    }
  };
  
  const updateSelectedOverlay = (updates: Partial<Overlay>) => { if (!selectedOverlayId) return; setOverlays(prev => prev.map(t => t.id === selectedOverlayId ? { ...t, ...updates } : t)); };
  const handleDeleteOverlay = () => { if (!selectedOverlayId) return; setOverlays(prev => prev.filter(t => t.id !== selectedOverlayId)); setSelectedOverlayId(null); };

  const handleMouseDownOverlay = (e: React.MouseEvent, id: string, tool: ToolType) => { 
    e.stopPropagation(); 
    e.preventDefault(); 
    setSelectedOverlayId(id); 
    setActiveOverlayTool(tool); 
    setIsDraggingOverlay(true); 
    setStartPos({ x: e.clientX, y: e.clientY }); 
    
    const rect = getScreenRect();
    setStartScreenRect(rect);

    const target = overlays.find(t => t.id === id); 
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
      }
  };

  const handleResetCrop = () => { setCrop({ x: 0, y: 0, width: slide.originalWidth, height: slide.originalHeight }); };

  const screenRect = getScreenRect();
  const selectedOverlay = overlays.find(t => t.id === selectedOverlayId);

  const getBackgroundColor = () => {
      if (videoSettings.backgroundFill === 'white') return '#ffffff';
      if (videoSettings.backgroundFill === 'black') return '#000000';
      return '#0f172a'; 
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800">
      {/* 1. Header & Tabs */}
      <div className="flex-none p-3 border-b border-slate-800 bg-slate-900 z-10 flex flex-col gap-3">
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
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold transition-colors shadow-sm flex items-center gap-2"
              >
                  {isUpdating ? <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 1010 10A10 10 0 0012 2zm0 18a8 8 0 118-8 8 8 0 01-8 8z" className="opacity-25" /><path fill="currentColor" d="M12 4a8 8 0 018 8V2a10 10 0 00-10 10z" className="opacity-75" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                  {isUpdating ? '更新中' : '適用'}
              </button>
          </div>
          <div className="flex bg-slate-800 rounded p-0.5 overflow-x-auto">
              {!isSolidSlide && <button onClick={() => setActiveTab('crop')} className={`flex-1 px-3 py-1.5 rounded text-[10px] whitespace-nowrap transition-colors ${activeTab === 'crop' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>トリミング</button>}
              {isSolidSlide && <button onClick={() => setActiveTab('color')} className={`flex-1 px-3 py-1.5 rounded text-[10px] whitespace-nowrap transition-colors ${activeTab === 'color' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>背景色</button>}
              <button onClick={() => setActiveTab('overlay')} className={`flex-1 px-3 py-1.5 rounded text-[10px] whitespace-nowrap transition-colors ${activeTab === 'overlay' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>装飾</button>
              <button onClick={() => setActiveTab('image')} className={`flex-1 px-3 py-1.5 rounded text-[10px] whitespace-nowrap transition-colors ${activeTab === 'image' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>画像</button>
              <button onClick={() => setActiveTab('audio')} className={`flex-1 px-3 py-1.5 rounded text-[10px] whitespace-nowrap transition-colors ${activeTab === 'audio' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>音声</button>
          </div>
      </div>

      <div className="flex-1 flex flex-col landscape:flex-row lg:!flex-col overflow-hidden">
          
          {/* 2. Visual Editor (Canvas) */}
          <div className="relative bg-slate-950 flex items-center justify-center p-4 
                          border-b border-slate-800
                          landscape:border-b-0 landscape:border-r lg:!border-b lg:!border-r-0
                          overflow-hidden select-none group/canvas flex-shrink-0
                          
                          min-h-[250px] max-h-[40%]
                          landscape:w-1/2 landscape:h-full landscape:max-h-full landscape:min-h-0
                          lg:!w-full lg:!h-auto lg:!max-h-[40%] lg:!min-h-[250px]
                          "
               style={{ backgroundColor: getBackgroundColor() }}
          >
              {pendingAddType && (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-full shadow-lg z-50 pointer-events-none animate-bounce">
                      場所をダブルクリックして配置
                  </div>
              )}
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
                      borderRadius: activeTab === 'crop' ? '0px' : `${videoSettings.slideBorderRadius}px`,
                      overflow: 'hidden',
                      position: 'relative'
                  }}>
                      {isSolidSlide ? (
                          <div ref={solidRef} style={{ backgroundColor: solidColor, width: '100%', maxWidth: '400px', aspectRatio: `${slide.width}/${slide.height}` }} className="shadow-lg border border-white/10" />
                      ) : (
                          <img ref={imageRef} src={overviewImage || slide.thumbnailUrl} alt="Slide" className="max-h-[220px] w-auto max-w-full object-contain pointer-events-none block" draggable={false} />
                      )}
                  </div>

                  {/* Crop Overlay */}
                  {activeTab === 'crop' && !isSolidSlide && (
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
                        {overlays.map(ov => {
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
          </div>

          {/* 3. Property Editor (Scrollable) */}
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-900 landscape:w-1/2 lg:!w-full">
              {activeTab === 'crop' && (
                 <div className="p-4 space-y-4">
                    <div className="text-xs text-slate-400">プレビューの枠をドラッグして、表示範囲を指定してください。</div>
                    <button onClick={handleResetCrop} className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 text-xs">範囲リセット</button>
                 </div>
              )}
              {activeTab === 'color' && <ColorSettingsPanel color={solidColor} onChange={setSolidColor} />}
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
                  />
              )}
              {activeTab === 'image' && (
                 <ImageSettingsPanel 
                    onAddImage={(img) => handleAddOverlay('image', img)}
                    selectedOverlay={selectedOverlay}
                    onUpdateOverlay={updateSelectedOverlay}
                    onDeleteOverlay={handleDeleteOverlay}
                    onUsageUpdate={onUsageUpdate}
                    slideDuration={localDuration}
                 />
              )}
              {activeTab === 'overlay' && (
                <OverlaySettingsPanel 
                    selectedOverlay={selectedOverlay}
                    onAddOverlay={handleAddOverlay}
                    onUpdateOverlay={updateSelectedOverlay}
                    onDeleteOverlay={handleDeleteOverlay}
                    pendingAddType={pendingAddType}
                    slideDuration={localDuration}
                />
              )}
          </div>
      </div>
    </div>
  );
};

export default SlideInspector;
