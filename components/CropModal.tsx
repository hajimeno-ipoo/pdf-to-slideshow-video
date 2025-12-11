
import React, { useRef, useState, useEffect } from 'react';
import { Slide, Overlay, OverlayType, TokenUsage } from '../types';
import { FONTS } from './cropModal/constants';
import ColorSettingsPanel from './cropModal/ColorSettingsPanel';
import AudioSettingsPanel from './cropModal/AudioSettingsPanel';
import ImageSettingsPanel from './cropModal/ImageSettingsPanel';
import OverlaySettingsPanel from './cropModal/OverlaySettingsPanel';
import { useEditor } from './slideEditor/SlideEditorContext';
import { safeRandomUUID } from '../utils/uuid';

interface SlideEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newCrop: { x: number, y: number, width: number, height: number }, newOverlays?: Overlay[], newBackgroundColor?: string, newAudioFile?: File, newAudioVolume?: number, newDuration?: number) => void;
  imageUrl: string;
  slide: Slide;
  onUsageUpdate?: (usage: TokenUsage) => void;
}

type ResizeHandleType = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
type ToolType = 'move' | 'rotate' | ResizeHandleType;

// Helper: Get cursor style based on handle and rotation
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

const SlideEditModal: React.FC<SlideEditModalProps> = ({ isOpen, onClose, onSave, imageUrl, slide, onUsageUpdate }) => {
  const { videoSettings } = useEditor();
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const solidRef = useRef<HTMLDivElement>(null);
  
  const [activeTab, setActiveTab] = useState<'crop' | 'overlay' | 'image' | 'color' | 'audio'>('crop');
  
  const initialCrop = slide?.crop || { x: 0, y: 0, width: 0, height: 0 };
  const initialOverlays = slide?.overlays || [];
  const isSolidSlide = !!slide?.backgroundColor;
  
  const [crop, setCrop] = useState(initialCrop);
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const [dragModeCrop, setDragModeCrop] = useState<'move' | 'nw' | 'ne' | 'sw' | 'se' | null>(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [startCrop, setStartCrop] = useState(initialCrop);

  const [overlays, setOverlays] = useState<Overlay[]>(initialOverlays);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  
  const [isDraggingOverlay, setIsDraggingOverlay] = useState(false);
  const [activeOverlayTool, setActiveOverlayTool] = useState<ToolType | null>(null);
  const [startOverlayState, setStartOverlayState] = useState<{ x: number, y: number, w: number, h: number, rot: number, fontSize: number }>({ x: 0, y: 0, w: 0, h: 0, rot: 0, fontSize: 0 });
  const [startMouseAngle, setStartMouseAngle] = useState(0);
  const [startScreenRect, setStartScreenRect] = useState({ x: 0, y: 0, width: 0, height: 0 });

  const [solidColor, setSolidColor] = useState<string>(slide?.backgroundColor || '#000000');

  const [audioFile, setAudioFile] = useState<File | undefined>(slide?.audioFile);
  const [audioVolume, setAudioVolume] = useState<number>(slide?.audioVolume ?? 1.0);
  const [currentDuration, setCurrentDuration] = useState<number>(slide?.duration || 3.0);
  
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);

  useEffect(() => {
    if (isOpen && slide) {
      setCrop(slide.crop);
      const migratedOverlays = (slide.overlays || []).map(t => ({
          ...t,
          rotation: t.rotation ?? 0,
          opacity: t.opacity ?? 1,
      }));
      setOverlays(migratedOverlays);
      setAudioFile(slide.audioFile);
      setAudioVolume(slide.audioVolume ?? 1.0);
      setCurrentDuration(slide.duration);
      
      if (slide.backgroundColor) {
          setSolidColor(slide.backgroundColor);
          setActiveTab('color');
      } else {
          setActiveTab('crop'); 
      }
      setSelectedOverlayId(null);
    }
  }, [isOpen, slide]);

  useEffect(() => {
      if (audioFile) {
          const url = URL.createObjectURL(audioFile);
          setAudioPreviewUrl(url);
          const audio = new Audio(url);
          audio.onloadedmetadata = () => {
              if (isFinite(audio.duration)) {
                  setAudioDuration(audio.duration);
                  setCurrentDuration(Math.max(1.0, parseFloat(audio.duration.toFixed(1))));
              }
          };
          return () => {
              URL.revokeObjectURL(url);
              setAudioPreviewUrl(null);
              setAudioDuration(0);
          };
      } else {
          setAudioPreviewUrl(null);
          setAudioDuration(0);
      }
  }, [audioFile]);

  // Global Event Listeners for Dragging
  useEffect(() => {
      if (isDraggingCrop || isDraggingOverlay) {
          const handleGlobalMove = (e: MouseEvent) => {
              // Cast to React.MouseEvent compatible object or adjust handler types
              // For simple coordinate access, MouseEvent is compatible enough for our usage
              if (activeTab === 'crop') handleMouseMoveCrop(e as unknown as React.MouseEvent);
              else handleMouseMoveOverlay(e as unknown as React.MouseEvent);
          };
          const handleGlobalUp = () => {
              if (activeTab === 'crop') handleMouseUpCrop();
              else handleMouseUpOverlay();
          };
          window.addEventListener('mousemove', handleGlobalMove);
          window.addEventListener('mouseup', handleGlobalUp);
          return () => {
              window.removeEventListener('mousemove', handleGlobalMove);
              window.removeEventListener('mouseup', handleGlobalUp);
          };
      }
  }, [isDraggingCrop, isDraggingOverlay, activeTab, dragModeCrop, activeOverlayTool, startPos, startCrop, startOverlayState, startScreenRect]);

  useEffect(() => {
      if (!isOpen || !selectedOverlayId) return;
      const handleKeyDown = (e: KeyboardEvent) => {
          const target = e.target as HTMLElement;
          if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
          if (e.key === 'Delete' || e.key === 'Backspace') {
              e.preventDefault();
              handleDeleteOverlay();
          } else if (e.key.startsWith('Arrow')) {
              e.preventDefault();
              const step = e.shiftKey ? 0.05 : 0.002;
              setOverlays(prev => {
                  const target = prev.find(o => o.id === selectedOverlayId);
                  if (!target) return prev;
                  let newX = target.x;
                  let newY = target.y;
                  switch(e.key) {
                      case 'ArrowUp': newY -= step; break;
                      case 'ArrowDown': newY += step; break;
                      case 'ArrowLeft': newX -= step; break;
                      case 'ArrowRight': newX += step; break;
                  }
                  return prev.map(o => o.id === selectedOverlayId ? { ...o, x: newX, y: newY } : o);
              });
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedOverlayId]);

  if (!isOpen || !slide) return null;

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

  const handleMouseDownCrop = (e: React.MouseEvent, mode: 'move' | 'nw' | 'ne' | 'sw' | 'se') => {
    e.preventDefault(); e.stopPropagation();
    setIsDraggingCrop(true); setDragModeCrop(mode);
    setStartPos({ x: e.clientX, y: e.clientY });
    setStartCrop({ ...crop });
  };

  const handleMouseMoveCrop = (e: React.MouseEvent) => {
    if (!isDraggingCrop || !dragModeCrop || !imageRef.current || !slide) return;
    const dxScreen = e.clientX - startPos.x;
    const dyScreen = e.clientY - startPos.y;
    let scaleX = 1; let scaleY = 1;
    if (!isSolidSlide && imageRef.current && slide) {
        scaleX = slide.originalWidth / imageRef.current.width;
        scaleY = slide.originalHeight / imageRef.current.height;
    }
    const dx = dxScreen * scaleX; const dy = dyScreen * scaleY;
    let newCrop = { ...startCrop };

    if (dragModeCrop === 'move') { newCrop.x = startCrop.x + dx; newCrop.y = startCrop.y + dy; }
    else if (dragModeCrop === 'se') { newCrop.width = Math.max(10, startCrop.width + dx); newCrop.height = Math.max(10, startCrop.height + dy); }
    else if (dragModeCrop === 'sw') { newCrop.x = Math.min(startCrop.x + startCrop.width - 10, startCrop.x + dx); newCrop.width = Math.max(10, startCrop.width - dx); newCrop.height = Math.max(10, startCrop.height + dy); }
    else if (dragModeCrop === 'ne') { newCrop.y = Math.min(startCrop.y + startCrop.height - 10, startCrop.y + dy); newCrop.width = Math.max(10, startCrop.width + dx); newCrop.height = Math.max(10, startCrop.height - dy); }
    else if (dragModeCrop === 'nw') { newCrop.x = Math.min(startCrop.x + startCrop.width - 10, startCrop.x + dx); newCrop.y = Math.min(startCrop.y + startCrop.height - 10, startCrop.y + dy); newCrop.width = Math.max(10, startCrop.width - dx); newCrop.height = Math.max(10, startCrop.height - dy); }

    if (newCrop.x < 0) newCrop.x = 0; if (newCrop.y < 0) newCrop.y = 0;
    const maxWidth = isSolidSlide ? slide.width : slide.originalWidth;
    const maxHeight = isSolidSlide ? slide.height : slide.originalHeight;
    if (newCrop.x + newCrop.width > maxWidth) { if (dragModeCrop === 'move') newCrop.x = maxWidth - newCrop.width; else newCrop.width = maxWidth - newCrop.x; }
    if (newCrop.y + newCrop.height > maxHeight) { if (dragModeCrop === 'move') newCrop.y = maxHeight - newCrop.height; else newCrop.height = maxHeight - newCrop.y; }
    setCrop(newCrop);
  };

  const handleMouseUpCrop = () => { setIsDraggingCrop(false); setDragModeCrop(null); };

  const handleResetCrop = () => {
    const width = isSolidSlide ? slide.width : slide.originalWidth;
    const height = isSolidSlide ? slide.height : slide.originalHeight;
    setCrop({ x: 0, y: 0, width, height });
  };

  const handleAddOverlay = (type: OverlayType, imageData?: string) => { 
    // Prevent overlapping by adding random offset
    const rX = (Math.random() - 0.5) * 0.15;
    const rY = (Math.random() - 0.5) * 0.15;

    const newOverlay: Overlay = { 
        id: safeRandomUUID(), 
        type: type, 
        x: 0.5 + rX, 
        y: 0.5 + rY, 
        rotation: 0, 
        opacity: 1, 
        text: type === 'text' ? 'テキスト' : undefined, 
        fontSize: type === 'text' ? 8 : undefined, 
        color: type === 'text' ? '#ffffff' : (type === 'arrow' || type === 'rect' || type === 'circle' || type === 'line' ? '#ef4444' : undefined), 
        width: type === 'text' ? undefined : 0.2, 
        height: type === 'rect' || type === 'circle' || type === 'image' ? 0.2 : (type === 'arrow' || type === 'line' ? 0.05 : undefined), 
        strokeWidth: type === 'text' ? 0 : 5, 
        backgroundColor: type === 'text' ? undefined : (type === 'rect' || type === 'circle' ? 'transparent' : undefined), 
        borderStyle: type === 'line' ? 'solid' : undefined, 
        strokeLineCap: type === 'line' ? 'butt' : undefined, 
        imageData: imageData,
        animationOut: 'fade',
    };

    if (type === 'image' && imageData) { 
        const img = new Image(); 
        img.onload = () => { 
            const imageAspect = img.width / img.height; 
            const rect = getScreenRect();
            const slideAspect = (rect.width > 0 && rect.height > 0) ? rect.width / rect.height : (slide.width / slide.height || 16/9);
            newOverlay.width = 0.3; 
            newOverlay.height = (0.3 * slideAspect) / imageAspect; 
            setOverlays([...overlays, newOverlay]); 
            setSelectedOverlayId(newOverlay.id); 
            setActiveTab('image'); 
        }; 
        img.src = imageData; 
    } else { 
        setOverlays([...overlays, newOverlay]); 
        setSelectedOverlayId(newOverlay.id); 
        setActiveTab('overlay'); 
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
    
    // Capture screen dimensions at start
    const rect = getScreenRect();
    setStartScreenRect(rect);

    const target = overlays.find(t => t.id === id); 
    if (target) { 
        setStartOverlayState({ x: target.x, y: target.y, w: target.width || 0, h: target.height || 0, rot: target.rotation, fontSize: target.fontSize || 0 }); 
        if (tool === 'rotate') { 
            const cx = rect.x + (target.x * rect.width); 
            const cy = rect.y + (target.y * rect.height); 
            const angle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI); 
            setStartMouseAngle(angle); 
        } 
        if (target.type === 'image') setActiveTab('image'); else setActiveTab('overlay'); 
    }
  };

  const handleMouseMoveOverlay = (e: React.MouseEvent) => {
      if (activeTab !== 'crop' && isDraggingOverlay && selectedOverlayId && activeOverlayTool) {
          const screenRect = startScreenRect;
          if (screenRect.width === 0 || screenRect.height === 0) return;
          const target = overlays.find(t => t.id === selectedOverlayId);
          if (!target) return;
          
          const dx = e.clientX - startPos.x;
          const dy = e.clientY - startPos.y;
          
          if (activeOverlayTool === 'move') {
              updateSelectedOverlay({ x: startOverlayState.x + (dx / screenRect.width), y: startOverlayState.y + (dy / screenRect.height) });
          } else if (activeOverlayTool === 'rotate') {
              // Rotation logic
              const cx = screenRect.x + (target.x * screenRect.width);
              const cy = screenRect.y + (target.y * screenRect.height);
              
              const deltaAngle = (e.clientX - startPos.x) * 0.5; // Drag right to rotate clockwise
              let newRot = (startOverlayState.rot + deltaAngle) % 360;
              if (e.shiftKey) newRot = Math.round(newRot / 15) * 15;
              updateSelectedOverlay({ rotation: newRot });
          } else if (['n','s','e','w','ne','nw','se','sw'].includes(activeOverlayTool)) {
              // Resizing Logic
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

  const handleMouseUpOverlay = () => {
      setIsDraggingOverlay(false); setActiveOverlayTool(null);
  };

  const handleContainerMouseDown = (e: React.MouseEvent) => {
      // Only deselect if clicking the background container itself
      if (e.target === e.currentTarget) {
          setSelectedOverlayId(null);
      }
  };

  const screenRect = getScreenRect();
  const selectedOverlay = overlays.find(t => t.id === selectedOverlayId);

  // Background styling for preview area
  const getBackgroundColor = () => {
      if (videoSettings.backgroundFill === 'white') return '#ffffff';
      if (videoSettings.backgroundFill === 'black') return '#000000';
      return '#0f172a'; // Default editor background
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm sm:p-4">
      <div className="bg-slate-900 sm:rounded-2xl border border-slate-700 w-full max-w-6xl flex flex-col h-full sm:h-[90vh]">
        {/* Header */}
        <div className="flex-none p-4 border-b border-slate-700 bg-slate-900 z-10 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-bold text-white hidden sm:block">スライド編集</h3>
            <div className="flex bg-slate-800 rounded-lg p-1 overflow-x-auto">
              {!isSolidSlide && (
                <button onClick={() => setActiveTab('crop')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'crop' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>トリミング</button>
              )}
              {isSolidSlide && (
                 <button onClick={() => setActiveTab('color')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'color' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>背景色</button>
              )}
              <button onClick={() => setActiveTab('overlay')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'overlay' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>装飾</button>
              <button onClick={() => setActiveTab('image')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'image' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>画像</button>
              <button onClick={() => setActiveTab('audio')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'audio' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>音声</button>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg">キャンセル</button>
            <button onClick={() => onSave(crop, overlays, isSolidSlide ? solidColor : undefined, audioFile, audioVolume, currentDuration)} className="px-6 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-lg shadow-emerald-900/50">保存</button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">
          {/* Canvas Area - Remove direct mouse handlers, they are global now */}
          <div 
            className="flex-1 overflow-hidden p-4 flex items-center justify-center bg-slate-950 select-none relative focus:outline-none"
            tabIndex={0}
            style={{ backgroundColor: getBackgroundColor() }}
          >
            <div className="relative inline-block" ref={containerRef}>
              {isSolidSlide ? (
                  <div ref={solidRef} style={{ backgroundColor: solidColor, width: '800px', aspectRatio: `${slide.width}/${slide.height}`, maxWidth: '100%', maxHeight: '75vh' }} className="shadow-2xl" />
              ) : (
                  <img ref={imageRef} src={imageUrl} alt="Slide Overview" className="max-h-[50vh] sm:max-h-[75vh] w-auto max-w-full object-contain pointer-events-none block" draggable={false} />
              )}

              {/* Crop Overlay */}
              {activeTab === 'crop' && !isSolidSlide && (
                <>
                  <div className="absolute inset-0 bg-black/50 pointer-events-none">
                     <div className="w-full h-full" style={{ clipPath: `polygon(0% 0%, 0% 100%, ${screenRect.x}px 100%, ${screenRect.x}px ${screenRect.y}px, ${screenRect.x + screenRect.width}px ${screenRect.y}px, ${screenRect.x + screenRect.width}px ${screenRect.y + screenRect.height}px, ${screenRect.x}px ${screenRect.y + screenRect.height}px, ${screenRect.x}px 100%, 100% 100%, 100% 0%)` }} />
                  </div>
                  <div className="absolute border-2 border-emerald-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] touch-none" style={{ left: screenRect.x, top: screenRect.y, width: screenRect.width, height: screenRect.height, cursor: 'move' }} onMouseDown={(e) => handleMouseDownCrop(e, 'move')}>
                    {/* Crop Handles */}
                    <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-30"><div className="border-r border-b border-white"></div><div className="border-r border-b border-white"></div><div className="border-b border-white"></div><div className="border-r border-b border-white"></div><div className="border-r border-b border-white"></div><div className="border-b border-white"></div><div className="border-r border-white"></div><div className="border-r border-white"></div></div>
                    <div className="absolute -top-3 -left-3 w-6 h-6 bg-emerald-500/50 border border-white cursor-nw-resize z-10 rounded-full" onMouseDown={(e) => handleMouseDownCrop(e, 'nw')} />
                    <div className="absolute -top-3 -right-3 w-6 h-6 bg-emerald-500/50 border border-white cursor-ne-resize z-10 rounded-full" onMouseDown={(e) => handleMouseDownCrop(e, 'ne')} />
                    <div className="absolute -bottom-3 -left-3 w-6 h-6 bg-emerald-500/50 border border-white cursor-sw-resize z-10 rounded-full" onMouseDown={(e) => handleMouseDownCrop(e, 'sw')} />
                    <div className="absolute -bottom-3 -right-3 w-6 h-6 bg-emerald-500/50 border border-white cursor-se-resize z-10 rounded-full" onMouseDown={(e) => handleMouseDownCrop(e, 'se')} />
                  </div>
                </>
              )}

              {/* Decoration & Image Overlay Logic */}
              {(activeTab === 'overlay' || activeTab === 'image' || activeTab === 'audio') && (
                <>
                  <div className="absolute overflow-hidden" style={{ left: screenRect.x, top: screenRect.y, width: screenRect.width, height: screenRect.height, border: '1px dashed rgba(255,255,255,0.3)' }} onMouseDown={() => setSelectedOverlayId(null)}>
                    {overlays.map(ov => {
                      const isSelected = ov.id === selectedOverlayId;
                      // Styles
                      const baseStyle: React.CSSProperties = {
                          position: 'absolute',
                          left: `${ov.x * 100}%`, top: `${ov.y * 100}%`,
                          transform: `translate(-50%, -50%) rotate(${ov.rotation || 0}deg)`,
                          cursor: 'move',
                          opacity: ov.opacity ?? 1,
                          userSelect: 'none'
                      };
                      const strokeWidthPx = (ov.strokeWidth || 0) * (screenRect.height / 500);
                      return (
                        <div key={ov.id} style={baseStyle} onMouseDown={(e) => handleMouseDownOverlay(e, ov.id, 'move')}>
                            {/* Render Content Logic (Text, Image, Shape) */}
                            {ov.type === 'text' && (
                                <div style={{
                                    position: 'relative',
                                    fontSize: `${(ov.fontSize || 5) / 100 * screenRect.height}px`,
                                    fontFamily: `"${ov.fontFamily}", sans-serif`,
                                    fontWeight: ov.isBold ? 'bold' : 'normal',
                                    fontStyle: ov.isItalic ? 'italic' : 'normal',
                                    textAlign: ov.textAlign || 'center',
                                    whiteSpace: ov.width ? 'normal' : 'pre',
                                    width: ov.width ? `${ov.width * 100 * (screenRect.width/screenRect.height/ov.width*0.2)}vw` : 'auto', 
                                    minWidth: ov.width ? `${ov.width * screenRect.width}px` : 'auto',
                                    backgroundColor: ov.backgroundColor,
                                    padding: ov.backgroundColor ? `${(ov.backgroundPadding||0) * ((ov.fontSize||5)/500 * screenRect.height)}px` : undefined,
                                    borderRadius: `${(ov.borderRadius||0)}px`,
                                    filter: ov.shadowColor ? `drop-shadow(${ov.shadowOffsetX||0}px ${ov.shadowOffsetY||0}px ${ov.shadowBlur||0}px ${ov.shadowColor})` : undefined,
                                }}>
                                    {strokeWidthPx > 0 && (
                                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, WebkitTextStroke: `${strokeWidthPx}px ${ov.strokeColor || 'transparent'}`, color: 'transparent', zIndex: 0, pointerEvents: 'none', padding: ov.backgroundColor ? `${(ov.backgroundPadding||0) * ((ov.fontSize||5)/500 * screenRect.height)}px` : undefined, }}>{ov.text}</div>
                                    )}
                                    <div style={{ position: 'relative', zIndex: 1, color: ov.color }}>{ov.text}</div>
                                </div>
                            )}
                            {ov.type === 'image' && ov.imageData && (
                                <img src={ov.imageData} alt="overlay" style={{ width: `${(ov.width||0.2) * screenRect.width}px`, height: `${(ov.height||0.2) * screenRect.height}px`, objectFit: 'fill', maxWidth: 'none', maxHeight: 'none', filter: `drop-shadow(${ov.shadowOffsetX||0}px ${ov.shadowOffsetY||0}px ${ov.shadowBlur||0}px ${ov.shadowColor||'transparent'})` }} draggable={false} />
                            )}
                            {(ov.type === 'rect' || ov.type === 'circle') && (
                                <div style={{ width: `${(ov.width||0.2) * screenRect.width}px`, height: `${(ov.height||0.2) * screenRect.height}px`, border: `${strokeWidthPx}px solid ${ov.color}`, backgroundColor: ov.backgroundColor || 'transparent', borderRadius: ov.type === 'circle' ? '50%' : `${(ov.borderRadius||0)}px`, boxShadow: `${(ov.shadowOffsetX||0)}px ${(ov.shadowOffsetY||0)}px ${(ov.shadowBlur||0)}px ${ov.shadowColor||'transparent'}` }} />
                            )}
                            {ov.type === 'line' && (
                                <svg width={`${(ov.width||0.2) * screenRect.width}`} height={`${strokeWidthPx + 10}`} style={{ overflow: 'visible', filter: ov.shadowColor ? `drop-shadow(${ov.shadowOffsetX||0}px ${ov.shadowOffsetY||0}px ${ov.shadowBlur||0}px ${ov.shadowColor})` : undefined }}>
                                    <line x1="0" y1="50%" x2="100%" y2="50%" stroke={ov.color} strokeWidth={strokeWidthPx} strokeLinecap={ov.strokeLineCap || 'butt'} strokeDasharray={ ov.borderStyle === 'dashed' ? `${strokeWidthPx * 3},${strokeWidthPx * 2}` : ov.borderStyle === 'dotted' ? (ov.strokeLineCap === 'round' ? `0,${strokeWidthPx * 2}` : `${strokeWidthPx},${strokeWidthPx}`) : undefined } />
                                </svg>
                            )}
                            {ov.type === 'arrow' && (
                                (() => { const w = (ov.width || 0.2) * screenRect.width; const h = (ov.height || 0.05) * screenRect.height; const headHeight = h; const headLength = Math.min(w, headHeight); const shaftHeight = (ov.strokeWidth || 5) * (screenRect.height / 500); const shaftY = (h - shaftHeight) / 2; return ( <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ filter: `drop-shadow(${ov.shadowOffsetX||0}px ${ov.shadowOffsetY||0}px ${ov.shadowBlur||0}px ${ov.shadowColor||'transparent'})`, overflow: 'visible' }}> <rect x="0" y={shaftY} width={Math.max(0, w - headLength)} height={shaftHeight} fill={ov.color} /> <polygon points={`${w},${h/2} ${w-headLength},0 ${w-headLength},${h}`} fill={ov.color} /> </svg> ); })()
                            )}
                            {/* Selection Handles */}
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
                </>
              )}
            </div>
          </div>
          
          {/* Controls Panels */}
          {activeTab === 'color' && (
             <ColorSettingsPanel color={solidColor} onChange={setSolidColor} />
          )}
          
          {activeTab === 'audio' && (
              <AudioSettingsPanel 
                  audioFile={audioFile}
                  audioVolume={audioVolume}
                  audioDuration={audioDuration}
                  audioPreviewUrl={audioPreviewUrl}
                  onAudioFileChange={setAudioFile}
                  onVolumeChange={setAudioVolume}
                  imageUrl={imageUrl}
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
                slideDuration={currentDuration}
             />
          )}

          {activeTab === 'overlay' && (
            <OverlaySettingsPanel 
                selectedOverlay={selectedOverlay}
                onAddOverlay={handleAddOverlay}
                onUpdateOverlay={updateSelectedOverlay}
                onDeleteOverlay={handleDeleteOverlay}
                slideDuration={currentDuration}
            />
          )}

          {activeTab === 'crop' && (
             <div className="w-full sm:w-80 bg-slate-900 border-t sm:border-t-0 sm:border-l border-slate-700 p-4 flex flex-col gap-4">
                <h4 className="text-white font-bold text-sm">トリミング設定</h4>
                <div className="text-xs text-slate-400 leading-relaxed">
                    プレビュー上の枠をドラッグして、動画に使用する範囲を指定してください。
                </div>
                <button 
                    onClick={handleResetCrop}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" d="M7.793 2.232a.75.75 0 01-.025 1.06L3.622 7.25h10.003a5.375 5.375 0 010 10.75H10.75a.75.75 0 010-1.5h2.875a3.875 3.875 0 000-7.75H3.622l4.146 3.957a.75.75 0 01-1.036 1.085l-5.5-5.25a.75.75 0 010-1.085l5.5-5.25a.75.75 0 011.06.025z" clipRule="evenodd" />
                    </svg>
                    範囲をリセット
                </button>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SlideEditModal;
