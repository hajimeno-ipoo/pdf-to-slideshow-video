
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Slide, BgmTimeRange, DuckingOptions, VideoSettings } from '../types';
import { 
  drawSlideFrame, 
  getKenBurnsParams, 
  renderBackground, 
  getVideoDimensions 
} from '../services/pdfVideoService';

interface TimelineEditorProps {
  slides: Slide[];
  onUpdateSlides: (slides: Slide[]) => void;
  bgmFile: File | null;
  bgmTimeRange?: BgmTimeRange;
  bgmVolume: number;
  globalAudioFile?: File | null;
  globalAudioVolume?: number;
  defaultTransitionDuration?: number;
  duckingOptions?: DuckingOptions;
  videoSettings?: VideoSettings; // Added for preview
}

const MIN_DURATION = 0.5;
const WAVEFORM_HEIGHT = 48; // Increased height for better visibility

// Helper to draw detailed waveform
const drawWaveform = (
  canvas: HTMLCanvasElement,
  buffer: AudioBuffer | null,
  scale: number,
  totalDuration: number,
  volume: number,
  color: string,
  bgmRange?: BgmTimeRange
) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  // Ensure width is at least 1px so canvas doesn't throw errors, even if totalDuration is 0
  const width = Math.max(1, totalDuration * scale);
  const height = WAVEFORM_HEIGHT;

  // Resize canvas if needed
  if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
  }
  
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  // Background
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, width, height);

  // Grid
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let t = 0; t <= totalDuration; t += 1) {
      const x = t * scale;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
  }
  ctx.stroke();

  if (!buffer) {
      ctx.restore();
      return;
  }

  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const amp = height / 2;
  const step = Math.ceil(sampleRate / scale); // Samples per pixel (approx)
  
  // Optimization: Don't check every sample if zoomed out extremely far.
  const samplesToCheck = 50; 
  const stride = Math.max(1, Math.floor(step / samplesToCheck));

  ctx.fillStyle = color;
  ctx.beginPath();

  const rangeStart = bgmRange?.start || 0;
  // Correct logic: if rangeEnd is 0 or less than/equal to start (initial state), treat as full duration loop
  const rangeEnd = (bgmRange && bgmRange.end > rangeStart) ? bgmRange.end : buffer.duration;
  
  const loopDuration = rangeEnd - rangeStart;
  // If bgmRange is undefined (Global Audio), we don't loop. If it is defined (BGM), we loop.
  // Note: BGM defaults to {start:0, end:0} which results in loopDuration = buffer.duration.
  const shouldLoop = !!bgmRange && loopDuration > 0;

  for (let x = 0; x < width; x++) {
      let time = x / scale;
      
      // Determine sample index
      let sampleIdx = 0;
      if (shouldLoop) {
          // BGM Logic: Wrap time based on loop duration
          const timeInLoop = time % loopDuration;
          sampleIdx = Math.floor((rangeStart + timeInLoop) * sampleRate);
      } else {
          // Linear Logic (Global Audio): Stop if exceeds buffer
          if (time > buffer.duration) continue; 
          sampleIdx = Math.floor(time * sampleRate);
      }

      // Calculate Peak in this pixel's time window
      let maxVal = 0;
      // We look ahead `step` samples, but skip by `stride`
      const endSearch = sampleIdx + step;
      const limit = data.length;
      
      for (let i = sampleIdx; i < endSearch; i += stride) {
          // Wrap index if looping to be safe, though calculated sampleIdx should be valid relative to buffer
          const safeI = shouldLoop ? i % limit : i;
          if (safeI >= limit) break; 
          
          const val = Math.abs(data[safeI]);
          if (val > maxVal) maxVal = val;
      }

      if (maxVal > 0) {
          // Draw symmetric bar
          const barHeight = Math.max(1, maxVal * amp * 1.8 * volume);
          const y = amp - (barHeight / 2);
          ctx.fillRect(x, y, 1, barHeight);
      }
  }
  
  ctx.restore();
};

const TimelineEditor: React.FC<TimelineEditorProps> = ({ 
  slides, 
  onUpdateSlides, 
  bgmFile, 
  bgmTimeRange,
  bgmVolume,
  globalAudioFile,
  globalAudioVolume = 1.0,
  defaultTransitionDuration = 1.0,
  duckingOptions,
  videoSettings
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const globalAudioCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null); // Preview Canvas

  const [scale, setScale] = useState(40); // pixels per second
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [globalAudioBuffer, setGlobalAudioBuffer] = useState<AudioBuffer | null>(null);
  
  // Local slides state for drag operations
  const [localSlides, setLocalSlides] = useState<Slide[]>(slides);
  
  // Sync local slides when props change (only if not dragging)
  useEffect(() => {
      if (!isResizing && !isResizingTransition && !isDraggingAudio && draggingSlideIndex === null) {
          setLocalSlides(slides);
      }
  }, [slides]); // Removed isResizing vars from dependency to avoid loop, but need conditional check

  // Playhead & Scrubbing State
  const [currentTime, setCurrentTime] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrollLeft, setScrollLeft] = useState(0); // Track scroll for preview positioning
  
  // Duration Resize State
  const [isResizing, setIsResizing] = useState<string | null>(null); 
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartDuration, setResizeStartDuration] = useState(0);

  // Transition Resize State
  const [isResizingTransition, setIsResizingTransition] = useState<string | null>(null);
  const [transResizeStartX, setTransResizeStartX] = useState(0);
  const [transResizeStartDuration, setTransResizeStartDuration] = useState(0);

  // Audio Offset Drag State
  const [isDraggingAudio, setIsDraggingAudio] = useState<string | null>(null);
  const [dragAudioStartX, setDragAudioStartX] = useState(0);
  const [dragAudioStartOffset, setDragAudioStartOffset] = useState(0);

  // Slide Reorder Drag State
  const [draggingSlideIndex, setDraggingSlideIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  // Audio Durations Cache
  const [audioDurations, setAudioDurations] = useState<Map<string, number>>(new Map());

  // Use localSlides for rendering and calculations during interaction
  const displaySlides = localSlides;
  const totalDuration = useMemo(() => displaySlides.reduce((acc, s) => acc + s.duration, 0), [displaySlides]);

  // Decode Slide Audios
  useEffect(() => {
      const loadDurations = async () => {
          const newDurations = new Map<string, number>();
          let hasUpdates = false;
          for (const slide of displaySlides) {
              if (slide.audioFile && !audioDurations.has(slide.id)) {
                  try {
                      const ab = await slide.audioFile.arrayBuffer();
                      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                      const decoded = await ctx.decodeAudioData(ab);
                      newDurations.set(slide.id, decoded.duration);
                      ctx.close();
                      hasUpdates = true;
                  } catch (e) {
                      console.error(`Failed to get duration for slide ${slide.id}`, e);
                  }
              } else if (slide.audioFile && audioDurations.has(slide.id)) {
                  newDurations.set(slide.id, audioDurations.get(slide.id)!);
              }
          }
          if (hasUpdates) {
              setAudioDurations(prev => new Map([...prev, ...newDurations]));
          }
      };
      loadDurations();
  }, [displaySlides]); // Only re-run if slides change structurally

  // Decode BGM
  useEffect(() => {
    if (!bgmFile) { setAudioBuffer(null); return; }
    const decode = async () => {
      try {
        const arrayBuffer = await bgmFile.arrayBuffer();
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const decoded = await ctx.decodeAudioData(arrayBuffer);
        setAudioBuffer(decoded);
        ctx.close();
      } catch (e) {}
    };
    decode();
  }, [bgmFile]);

  // Decode Global Audio
  useEffect(() => {
    if (!globalAudioFile) { setGlobalAudioBuffer(null); return; }
    const decode = async () => {
      try {
        const arrayBuffer = await globalAudioFile.arrayBuffer();
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const decoded = await ctx.decodeAudioData(arrayBuffer);
        setGlobalAudioBuffer(decoded);
        ctx.close();
      } catch (e) {}
    };
    decode();
  }, [globalAudioFile]);

  // Draw Preview Frame
  const drawPreview = useCallback(async (time: number) => {
      const canvas = previewCanvasRef.current;
      if (!canvas || !videoSettings) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Identify Slide
      let t = 0;
      let activeIndex = 0;
      for (let i = 0; i < displaySlides.length; i++) {
          if (time < t + displaySlides[i].duration) {
              activeIndex = i;
              break;
          }
          t += displaySlides[i].duration;
      }
      if (time >= totalDuration) {
          activeIndex = displaySlides.length - 1;
          t = totalDuration - displaySlides[activeIndex].duration;
      }
      const slide = displaySlides[activeIndex];
      if (!slide) return;

      const localTime = Math.max(0, time - t);

      try {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = slide.thumbnailUrl;
          await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; });
          const bmp = await createImageBitmap(img);

          const { width, height } = getVideoDimensions(videoSettings.aspectRatio, '720p');
          const previewScale = 0.3; // 30% size for preview
          const pW = width * previewScale;
          const pH = height * previewScale;

          canvas.width = pW;
          canvas.height = pH;

          // Draw Logic
          const bgFill = videoSettings.backgroundFill === 'white' ? '#ffffff' : '#000000';
          renderBackground(ctx, pW, pH, bgFill, null);

          const kenBurns = slide.effectType === 'kenburns' ? getKenBurnsParams(slide.id) : null;
          const progress = Math.min(1.0, localTime / slide.duration);

          ctx.save();
          ctx.scale(previewScale, previewScale);
          await drawSlideFrame(ctx, bmp, width, height, slide.effectType, kenBurns, progress, slide, videoSettings, localTime);
          ctx.restore();
          
          bmp.close();
      } catch (e) {
          console.error("Preview draw failed", e);
      }
  }, [displaySlides, totalDuration, videoSettings]);

  // Update Preview when scrubbing
  useEffect(() => {
      if (isScrubbing) {
          drawPreview(currentTime);
      }
  }, [currentTime, isScrubbing, drawPreview]);


  // Draw BGM Waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Draw base waveform
    drawWaveform(canvas, audioBuffer, scale, totalDuration, bgmVolume, '#059669', bgmTimeRange);

    // Draw Ducking Line (Overlay)
    if (duckingOptions?.enabled) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const dpr = window.devicePixelRatio || 1;
        // NOTE: Context is already scaled if drawWaveform didn't restore? 
        // drawWaveform restores context state, so we need to set scale again for overlay drawing
        ctx.save();
        ctx.scale(dpr, dpr);

        const width = totalDuration * scale;
        const height = WAVEFORM_HEIGHT; 
        const amp = height / 2;

        const duckingVol = duckingOptions.duckingVolume; 
        const fadeDuration = 0.5;
        const intervals: {start: number, end: number}[] = [];
        let curT = 0;
        displaySlides.forEach(s => {
            if (s.audioFile) {
                const dur = audioDurations.get(s.id) || 0;
                if (dur > 0) {
                    const sTime = curT + (s.audioOffset || 0);
                    intervals.push({ start: sTime, end: sTime + dur });
                }
            }
            curT += s.duration;
        });
        if (globalAudioBuffer) intervals.push({ start: 0, end: globalAudioBuffer.duration });
        
        ctx.strokeStyle = '#fbbf24'; 
        ctx.lineWidth = 2; 
        ctx.beginPath();
        
        const pointsToDraw = Math.ceil(width / 2);
        for (let i = 0; i <= pointsToDraw; i++) {
            const x = i * 2;
            const t = x / scale;
            let minVol = 1.0;
            let isInside = false;
            let distToStart = 9999;
            let distToEnd = 9999;
            for (const iv of intervals) {
                if (t >= iv.start && t <= iv.end) { isInside = true; break; }
                if (t < iv.start) distToStart = Math.min(distToStart, iv.start - t);
                if (t > iv.end) distToEnd = Math.min(distToEnd, t - iv.end);
            }
            if (isInside) minVol = duckingVol;
            else {
                if (distToStart < fadeDuration) { const p = 1.0 - (distToStart / fadeDuration); minVol = Math.min(minVol, 1.0 - (1.0 - duckingVol) * p); }
                if (distToEnd < fadeDuration) { const p = distToEnd / fadeDuration; minVol = Math.min(minVol, duckingVol + (1.0 - duckingVol) * p); }
            }
            const y = amp - (amp * 0.8 * bgmVolume * minVol);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
    }
  }, [audioBuffer, scale, totalDuration, bgmTimeRange, bgmVolume, displaySlides, audioDurations, globalAudioBuffer, duckingOptions]);

  // Draw Global Audio Waveform
  useEffect(() => {
    const canvas = globalAudioCanvasRef.current;
    if (!canvas) return;
    
    // Global Audio doesn't loop and has no range, pass undefined for bgmRange
    drawWaveform(canvas, globalAudioBuffer, scale, totalDuration, globalAudioVolume, '#4f46e5');
    
  }, [globalAudioBuffer, scale, totalDuration, globalAudioVolume]);

  // --- Handlers ---

  const handleScroll = () => {
      if (scrollContainerRef.current) {
          setScrollLeft(scrollContainerRef.current.scrollLeft);
      }
  };

  // Unified MouseDown for Timeline (Scrubbing)
  const handleTimelineMouseDown = (e: React.MouseEvent) => {
      // Prevent scrubbing if clicking on interactive elements
      if ((e.target as HTMLElement).closest('.cursor-grab, .cursor-col-resize, .cursor-ew-resize, .no-drag')) return;
      
      setIsScrubbing(true);
      updateScrubTime(e);
  };

  const updateScrubTime = (e: MouseEvent | React.MouseEvent) => {
      if (!scrollContainerRef.current) return;
      const rect = scrollContainerRef.current.getBoundingClientRect();
      const scrollLeft = scrollContainerRef.current.scrollLeft;
      const x = e.clientX - rect.left + scrollLeft;
      const time = Math.max(0, Math.min(totalDuration, x / scale));
      setCurrentTime(time);
  };

  const handleResizeStart = (e: React.MouseEvent, slideId: string, currentDuration: number) => { e.preventDefault(); e.stopPropagation(); setIsResizing(slideId); setResizeStartX(e.clientX); setResizeStartDuration(currentDuration); };
  const handleTransitionResizeStart = (e: React.MouseEvent, slideId: string, currentTransDuration: number) => { e.preventDefault(); e.stopPropagation(); setIsResizingTransition(slideId); setTransResizeStartX(e.clientX); setTransResizeStartDuration(currentTransDuration); };
  const handleAudioDragStart = (e: React.MouseEvent, slideId: string, currentOffset: number) => { e.preventDefault(); e.stopPropagation(); setIsDraggingAudio(slideId); setDragAudioStartX(e.clientX); setDragAudioStartOffset(currentOffset); };
  const handleSlideMouseDown = (e: React.MouseEvent, index: number) => { if (e.button !== 0) return; if ((e.target as HTMLElement).closest('.no-drag')) return; setDraggingSlideIndex(index); };
  
  useEffect(() => {
      const onMove = (e: MouseEvent) => {
          if (isScrubbing) {
              updateScrubTime(e);
          } else if (isResizing) {
              const deltaX = e.clientX - resizeStartX;
              const deltaSeconds = deltaX / scale;
              const newDuration = Math.max(MIN_DURATION, resizeStartDuration + deltaSeconds);
              // Update localSlides only
              setLocalSlides(prev => prev.map(s => s.id === isResizing ? { ...s, duration: Number(newDuration.toFixed(2)) } : s));
          } else if (isResizingTransition) {
              const deltaX = transResizeStartX - e.clientX; 
              const deltaSeconds = deltaX / scale;
              const slide = localSlides.find(s => s.id === isResizingTransition);
              const maxDur = slide ? Math.max(0, slide.duration - 0.5) : 3.0; 
              const newDuration = Math.min(maxDur, Math.max(0, transResizeStartDuration + deltaSeconds));
              setLocalSlides(prev => prev.map(s => s.id === isResizingTransition ? { ...s, transitionDuration: Number(newDuration.toFixed(2)) } : s));
          } else if (isDraggingAudio) {
              const deltaX = e.clientX - dragAudioStartX;
              const deltaSeconds = deltaX / scale;
              const newOffset = Math.max(0, dragAudioStartOffset + deltaSeconds);
              setLocalSlides(prev => prev.map(s => s.id === isDraggingAudio ? { ...s, audioOffset: Number(newOffset.toFixed(2)) } : s));
          } else if (draggingSlideIndex !== null) {
              if (!containerRef.current) return;
              const rect = containerRef.current.getBoundingClientRect();
              const scrollLeft = containerRef.current.scrollLeft;
              const mouseX = e.clientX - rect.left + scrollLeft;
              let currentX = 0;
              let target = localSlides.length;
              for (let i = 0; i < localSlides.length; i++) {
                  const width = localSlides[i].duration * scale;
                  const center = currentX + width / 2;
                  if (mouseX < center) { target = i; break; }
                  currentX += width;
              }
              setDropTargetIndex(target);
          }
      };

      const onUp = () => {
          if (isResizing || isResizingTransition || isDraggingAudio) {
              // Commit changes to parent only on mouse up
              onUpdateSlides(localSlides);
          }
          
          if (draggingSlideIndex !== null && dropTargetIndex !== null) {
              if (draggingSlideIndex !== dropTargetIndex && dropTargetIndex !== draggingSlideIndex + 1) {
                  const newSlides = [...localSlides];
                  const [item] = newSlides.splice(draggingSlideIndex, 1);
                  let insertIndex = dropTargetIndex;
                  if (draggingSlideIndex < dropTargetIndex) insertIndex--;
                  newSlides.splice(insertIndex, 0, item);
                  onUpdateSlides(newSlides); // Commit reorder
              } else {
                  // Cancel drag, revert to original slides implicitly by props update or just reset local
                  setLocalSlides(slides); 
              }
          }

          setIsScrubbing(false);
          setIsResizing(null); setIsResizingTransition(null); setIsDraggingAudio(null); setDraggingSlideIndex(null); setDropTargetIndex(null);
      };

      if (isScrubbing || isResizing || isResizingTransition || isDraggingAudio || draggingSlideIndex !== null) {
          window.addEventListener('mousemove', onMove);
          window.addEventListener('mouseup', onUp);
      }
      return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [isScrubbing, isResizing, resizeStartX, resizeStartDuration, isResizingTransition, transResizeStartX, transResizeStartDuration, isDraggingAudio, dragAudioStartX, dragAudioStartOffset, draggingSlideIndex, dropTargetIndex, scale, localSlides, onUpdateSlides, totalDuration]); // Depend on localSlides

  // Render Helpers
  const formatTime = (seconds: number) => { const m = Math.floor(seconds / 60); const s = Math.floor(seconds % 60); return `${m}:${s.toString().padStart(2, '0')}`; };
  const getDropLineX = () => { if (dropTargetIndex === null) return -1; let x = 0; for (let i = 0; i < dropTargetIndex; i++) { x += displaySlides[i].duration * scale; } return x; };
  const getTransitionLabel = (type: string) => { switch(type) { case 'fade': return 'F'; case 'slide': return 'S'; case 'zoom': return 'Z'; case 'wipe': return 'W'; case 'flip': return 'Fl'; case 'cross-zoom': return 'Cr'; default: return ''; } };
  // タイムラインのトランジション色を「一括設定」と同じ系統に合わせる
  const getTransitionColors = (type: string) => {
      switch(type) {
          case 'fade':       return { base: '#10b981', stripe: '#34d399', text: '#d1fae5' }; // emerald
          case 'slide':      return { base: '#3b82f6', stripe: '#60a5fa', text: '#dbeafe' }; // blue
          case 'zoom':       return { base: '#7c3aed', stripe: '#a855f7', text: '#ede9fe' }; // violet (SlideGrid系統)
          case 'wipe':       return { base: '#f59e0b', stripe: '#fbbf24', text: '#fffbeb' }; // amber
          case 'flip':       return { base: '#fbbf24', stripe: '#facc15', text: '#fef9c3' }; // yellow系
          case 'cross-zoom': return { base: '#ec4899', stripe: '#f472b6', text: '#fdf2f8' }; // pink系
          default:           return { base: '#6b7280', stripe: '#9ca3af', text: '#f3f4f6' }; // gray fallback
      }
  };

  // Determine preview popup position based on playhead and scroll
  const playheadX = (currentTime * scale) - scrollLeft;
  const editorWidth = scrollContainerRef.current?.clientWidth || 800;
  const popupLeft = Math.max(80, Math.min(editorWidth - 80, playheadX));

  return (
    <div className="w-full bg-slate-950 border-t border-slate-800 select-none flex flex-col relative group/timeline h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-slate-800 bg-slate-900/50 flex-none h-10">
          <div className="flex items-center gap-2">
              <span className="text-[12px] font-bold text-slate-300 uppercase tracking-wider">Timeline</span>
              <span className="text-[12px] text-slate-400 ml-2">Total: <span className="text-white">{totalDuration.toFixed(1)}s</span></span>
              {/* Playhead Time Display */}
              <span className="text-[12px] text-emerald-300 font-mono ml-4 bg-slate-950 px-2.5 py-0.5 rounded border border-slate-700">{formatTime(currentTime)}</span>
          </div>
          <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Zoom</span>
              <input type="range" min="10" max="100" value={scale} onChange={(e) => setScale(Number(e.target.value))} className="w-24 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
          </div>
      </div>

      {/* Preview Pop-up (Only when scrubbing) */}
      <div 
        className={`absolute bottom-[calc(100%-32px)] mb-2 z-[100] bg-black rounded-lg border border-emerald-500/50 shadow-2xl transition-all duration-75 origin-bottom ${isScrubbing ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2 pointer-events-none'}`}
        style={{ left: `${popupLeft}px`, transform: 'translateX(-50%)' }}
      >
          <div className="relative p-1">
              <canvas ref={previewCanvasRef} className="rounded border border-slate-800 bg-slate-900 block" />
              <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-1.5 rounded backdrop-blur-sm font-mono border border-white/10">
                  {formatTime(currentTime)}
              </div>
          </div>
          {/* Arrow */}
          <div className="absolute bottom-[-5px] left-1/2 -translate-x-1/2 w-3 h-3 bg-black border-r border-b border-emerald-500/50 rotate-45"></div>
      </div>

      {/* Timeline Scroll Area */}
      <div 
        ref={scrollContainerRef}
        className="w-full overflow-x-auto overflow-y-hidden scrollbar-hide relative bg-slate-950 cursor-text flex-1"
        onMouseDown={handleTimelineMouseDown}
        onScroll={handleScroll}
      >
         <div 
            ref={containerRef}
            style={{ width: `${Math.max(scrollContainerRef.current?.clientWidth || 0, totalDuration * scale + 100)}px`, minWidth: '100%', minHeight: '100%' }} 
            className="relative flex flex-col"
         >
             
             {/* Ruler */}
             <div className="h-6 w-full border-b border-slate-700 flex items-end text-[11px] text-slate-400 relative bg-slate-900/90 sticky top-0 z-30 pointer-events-none">
                 {Array.from({ length: Math.ceil(totalDuration) + 2 }).map((_, i) => (
                     <div key={i} className="absolute bottom-0 border-l border-slate-700 pl-1 h-3 flex items-center" style={{ left: `${i * scale}px` }}>
                         {i % 5 === 0 && <span>{formatTime(i)}</span>}
                     </div>
                 ))}
             </div>

             {/* Playhead (Red Line) */}
             <div 
                className="absolute top-0 bottom-0 w-px bg-red-500 z-50 pointer-events-none shadow-[0_0_8px_rgba(239,68,68,0.8)] transition-transform duration-75 ease-out h-full"
                style={{ transform: `translateX(${currentTime * scale}px)` }}
             >
                 {/* Head */}
                 <div className="absolute top-0 -translate-x-1/2 w-3 h-3 bg-red-500 transform rotate-45 -mt-1.5 shadow-sm sticky top-0"></div>
             </div>

             {/* Tracks Container */}
             <div className="flex-1 flex flex-col relative pb-2">
                 
                 {/* Drop Indicator */}
                 {dropTargetIndex !== null && (
                     <div className="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-50 shadow-[0_0_10px_rgba(59,130,246,0.8)] pointer-events-none" style={{ left: `${getDropLineX()}px` }}>
                         <div className="absolute top-0 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 rotate-45 sticky top-0"></div>
                     </div>
                 )}

                 {/* Slides Track */}
                 <div className="h-[64px] flex items-center z-10 border-b border-slate-800 relative bg-slate-900/30 flex-shrink-0">
                     {displaySlides.map((slide, index) => {
                         const width = slide.duration * scale;
                         const isDragging = draggingSlideIndex === index;
                         const isBeingResized = isResizingTransition === slide.id;
                         const hasTransition = slide.transitionType !== 'none';
                         const transDur = slide.transitionDuration !== undefined ? slide.transitionDuration : defaultTransitionDuration;
                         const transWidth = hasTransition ? Math.max(0, Math.min(transDur, slide.duration - 0.5)) * scale : 0;

                         return (
                             <div 
                                key={slide.id} 
                                className={`h-full relative group border-r border-slate-800 bg-slate-800/60 hover:bg-slate-700/60 transition-colors flex flex-col overflow-hidden box-border cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-40' : 'opacity-100'}`}
                                style={{ width: `${width}px` }}
                                onMouseDown={(e) => handleSlideMouseDown(e, index)}
                             >
                                 <div className="flex-1 p-1 flex items-center justify-center overflow-hidden pointer-events-none">
                                     {width > 30 && (
                                         <img src={slide.thumbnailUrl} alt="" className="h-full w-auto object-contain rounded shadow-sm opacity-90" />
                                     )}
                                 </div>
                                 {hasTransition && transWidth > 0 && (
                                     (() => {
                                         const tc = getTransitionColors(slide.transitionType);
                                         return (
                                         <div className="absolute top-0 bottom-0 right-0 flex items-center justify-center pointer-events-none overflow-hidden no-drag"
                                              style={{ width: `${transWidth}px`, backgroundColor: tc.base + '33', borderLeft: `1px solid ${tc.base}` }}>
                                             <div className="absolute inset-0 opacity-25" style={{ backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 5px, ${tc.stripe} 5px, ${tc.stripe} 10px)` }}></div>
                                         <div className="z-10 flex flex-col items-center justify-center">
                                             {transWidth > 15 && <span className="text-[9px] font-bold drop-shadow-md leading-none" style={{ color: tc.text }}>{getTransitionLabel(slide.transitionType)}</span>}
                                             {(transWidth > 25 || isBeingResized) && <span className="text-[8px] font-mono px-1 rounded mt-0.5 backdrop-blur-sm shadow-sm scale-90" style={{ color: '#fff', backgroundColor: tc.base + '99' }}>{transDur.toFixed(1)}s</span>}
                                         </div>
                                         </div>
                                         );
                                     })()
                                 )}
                                 {hasTransition && (
                                     <div className="absolute top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center z-30 no-drag opacity-0 group-hover:opacity-100 transition-opacity" style={{ right: `${transWidth - 1}px`, backgroundColor: 'transparent' }} onMouseDown={(e) => handleTransitionResizeStart(e, slide.id, transDur)} title={`Transition: ${transDur.toFixed(1)}s`}>
                                         <div className="w-0.5 h-4 rounded-full shadow-sm" style={{ backgroundColor: getTransitionColors(slide.transitionType).stripe }}></div>
                                     </div>
                                 )}
                                 <div className="h-4 bg-slate-900/50 flex items-center justify-center text-[9px] text-slate-300 truncate px-1 border-t border-slate-800/50 pointer-events-none">{width > 25 ? `${slide.duration}s` : ''}</div>
                                 <div className="absolute top-0 right-0 bottom-0 w-3 cursor-col-resize flex items-center justify-center hover:bg-emerald-500/30 z-40 opacity-0 group-hover:opacity-100 transition-opacity no-drag" onMouseDown={(e) => handleResizeStart(e, slide.id, slide.duration)}><div className="w-1 h-6 bg-white/50 rounded-full shadow-sm"></div></div>
                                 <div className="absolute top-0.5 left-0.5 bg-black/50 text-[8px] text-white px-1 rounded opacity-60 pointer-events-none">{index + 1}</div>
                             </div>
                         );
                     })}
                 </div>

                 {/* Narration Track */}
                 <div className="h-[48px] relative w-full bg-slate-900/50 border-t border-slate-800 flex overflow-hidden flex-shrink-0">
                     <div className="absolute top-0.5 left-1 text-[8px] text-slate-500 z-10 pointer-events-none bg-slate-900/50 px-1 rounded">Slide Audio</div>
                     {displaySlides.map((slide) => {
                         const slideWidth = slide.duration * scale;
                         const offset = slide.audioOffset || 0;
                         const offsetPx = offset * scale;
                         const duration = audioDurations.get(slide.id) || 0;
                         const barWidth = duration > 0 ? duration * scale : slideWidth; 
                         return (
                             <div key={slide.id} className="h-full border-r border-slate-800 relative group" style={{ width: `${slideWidth}px` }}>
                                 {slide.audioFile && (
                                     <div className="absolute top-0.5 bottom-0.5 bg-blue-600/60 border border-blue-400/50 rounded flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing hover:bg-blue-500/70 z-10 shadow-sm no-drag" style={{ left: `${offsetPx}px`, width: duration > 0 ? `${barWidth}px` : '100%', minWidth: '10px' }} onMouseDown={(e) => handleAudioDragStart(e, slide.id, offset)}>
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-white/30"></div>
                                        <span className="text-[8px] text-white truncate px-1 w-full text-center drop-shadow-md select-none pointer-events-none">{slide.audioFile.name}{offset > 0 && <span className="opacity-75 ml-1">(+{offset}s)</span>}</span>
                                        {duration > slide.duration - offset && <div className="absolute right-0 top-0 bottom-0 w-1 bg-red-500/80" title="音声がスライド時間を超えています"></div>}
                                     </div>
                                 )}
                             </div>
                         )
                     })}
                 </div>

                 {/* Global Narration Track */}
                 <div className="h-[48px] relative w-full bg-slate-900 border-t border-slate-800 flex-shrink-0">
                     <div className="absolute top-0.5 left-1 text-[8px] text-slate-500 z-10 pointer-events-none bg-slate-900/50 px-1 rounded">Global Audio</div>
                     <canvas ref={globalAudioCanvasRef} className="absolute top-0 left-0 h-full" />
                     {!globalAudioFile && <div className="absolute inset-0 flex items-center justify-center text-[8px] text-slate-700 pointer-events-none">全体音声なし</div>}
                 </div>

                 {/* BGM Waveform Track */}
                 <div className="h-[48px] relative w-full bg-slate-900 border-t border-slate-800 flex-shrink-0">
                     <div className="absolute top-0.5 left-1 text-[8px] text-slate-500 z-10 pointer-events-none bg-slate-900/50 px-1 rounded">BGM</div>
                     <canvas ref={canvasRef} className="absolute top-0 left-0 h-full" />
                     {!bgmFile && <div className="absolute inset-0 flex items-center justify-center text-[8px] text-slate-700 pointer-events-none">BGMなし</div>}
                 </div>
             </div>
         </div>
      </div>
    </div>
  );
};

export default TimelineEditor;
