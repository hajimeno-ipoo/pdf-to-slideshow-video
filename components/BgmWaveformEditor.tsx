import React, { useEffect, useRef, useState, useCallback } from 'react';
import { BgmTimeRange } from '../types';

interface BgmWaveformEditorProps {
  file: File;
  range: BgmTimeRange;
  onChange: (range: BgmTimeRange) => void;
  volume: number;
  onVolumeChange: (volume: number) => void;
  readonly?: boolean;
}

const BgmWaveformEditor: React.FC<BgmWaveformEditorProps> = ({ file, range, onChange, volume, onVolumeChange, readonly = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hoverState, setHoverState] = useState<'none' | 'start' | 'end' | 'body'>('none');
  const [dragState, setDragState] = useState<'none' | 'start' | 'end'>('none');

  // Audio Decoding
  useEffect(() => {
    const loadAudio = async () => {
      setIsLoading(true);
      try {
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const ctx = audioContextRef.current;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = await ctx.decodeAudioData(arrayBuffer);
        
        audioBufferRef.current = buffer;
        setDuration(buffer.duration);
        
        // If range is not set (initial), set to full duration
        if (range.end === 0) {
            onChange({ start: 0, end: buffer.duration });
        }
        
        drawWaveform(buffer);
      } catch (e) {
        console.error("Failed to decode audio", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadAudio();

    return () => {
      stopAudio();
      if (audioContextRef.current?.state !== 'closed') {
        audioContextRef.current?.close();
      }
      audioContextRef.current = null;
    };
  }, [file]);

  // Update volume during playback
  useEffect(() => {
    if (gainNodeRef.current && audioContextRef.current) {
        // Smooth transition
        gainNodeRef.current.gain.setTargetAtTime(volume, audioContextRef.current.currentTime, 0.1);
    }
  }, [volume]);

  // Sync cursor with start time when start handle changes (and not playing)
  // Removing isPlaying from dependency array allows "Pause" behavior (cursor stays when stopped)
  useEffect(() => {
      if (!isPlaying && !readonly) {
          setCurrentTime(range.start);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, readonly]);

  // Draw Waveform (Improved Visuals)
  const drawWaveform = useCallback((buffer: AudioBuffer) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Retina display support
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const data = buffer.getChannelData(0);
    
    // Config for bars
    const barWidth = 2; // px
    const gap = 1; // px
    const totalBars = Math.floor(width / (barWidth + gap));
    const step = Math.ceil(data.length / totalBars);
    const amp = height / 2;

    ctx.clearRect(0, 0, width, height);

    // Center Line
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.moveTo(0, amp);
    ctx.lineTo(width, amp);
    ctx.stroke();

    ctx.fillStyle = readonly ? '#6366f1' : '#10b981'; // indigo-500 for readonly, emerald-500 for editable

    for (let i = 0; i < totalBars; i++) {
      let min = 1.0;
      let max = -1.0;
      
      const startIndex = i * step;
      for (let j = 0; j < step; j++) {
        if (startIndex + j < data.length) {
            const datum = data[startIndex + j];
            if (datum < min) min = datum;
            if (datum > max) max = datum;
        }
      }
      
      const x = i * (barWidth + gap);
      const barHeight = Math.max(2, (max - min) * amp * 0.9); 
      const y = amp - (barHeight / 2);

      // Rounded bars
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(x, y, barWidth, barHeight, 2);
      } else {
          ctx.rect(x, y, barWidth, barHeight);
      }
      ctx.fill();
    }
  }, [readonly]);

  // Playback Control
  const togglePlay = async () => {
    if (isPlaying) {
      stopAudio();
    } else {
      await playAudio();
    }
  };

  const playAudio = async () => {
    if (!audioContextRef.current || !audioBufferRef.current) return;
    
    const ctx = audioContextRef.current;
    
    // Ensure context is running (await to satisfy Safari/Chrome autoplay policies)
    if (ctx.state === 'suspended') {
        try {
            await ctx.resume();
        } catch (e) {
            console.error('AudioContext resume failed', e);
            return;
        }
    }

    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    
    source.buffer = audioBufferRef.current;
    
    // Readonly mode plays full duration without loop by default (or we can loop full range)
    // Editable mode uses range
    const effectiveStart = readonly ? 0 : range.start;
    const effectiveEnd = readonly ? duration : range.end;

    if (!readonly) {
        source.loop = true;
        source.loopStart = effectiveStart;
        source.loopEnd = effectiveEnd;
    } else {
        source.loop = false; // Play once for narration usually
    }
    
    gain.gain.value = volume;

    source.connect(gain);
    gain.connect(ctx.destination);
    
    // Determine start position (Resume support)
    let startOffset = currentTime;
    
    // If current time is outside valid range (or close to end), reset to start
    if (startOffset < effectiveStart || startOffset >= effectiveEnd - 0.05) {
        startOffset = effectiveStart;
    }

    // Start playback
    source.start(0, startOffset);
    
    // Adjust startTimeRef
    if (!readonly) {
        const offsetInLoop = startOffset - effectiveStart;
        startTimeRef.current = ctx.currentTime - offsetInLoop;
    } else {
        startTimeRef.current = ctx.currentTime - startOffset;
    }

    sourceNodeRef.current = source;
    gainNodeRef.current = gain;
    setIsPlaying(true);
    
    // Animation Loop for Cursor
    const animate = () => {
      // Check if still playing
      if (!sourceNodeRef.current || !audioContextRef.current) return;
      
      const ctx = audioContextRef.current;
      const elapsed = ctx.currentTime - startTimeRef.current; 
      
      if (!readonly) {
          const loopDuration = effectiveEnd - effectiveStart;
          if (loopDuration > 0) {
              const timeInLoop = elapsed % loopDuration;
              setCurrentTime(effectiveStart + timeInLoop);
          } else {
              setCurrentTime(effectiveStart);
          }
          animationFrameRef.current = requestAnimationFrame(animate);
      } else {
          // Linear playback
          const now = elapsed;
          if (now >= duration) {
              setCurrentTime(duration);
              stopAudio();
          } else {
              setCurrentTime(now);
              animationFrameRef.current = requestAnimationFrame(animate);
          }
      }
    };
    animationFrameRef.current = requestAnimationFrame(animate);
  };

  const stopAudio = () => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch (e) {
        // ignore errors
      }
      sourceNodeRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setIsPlaying(false);
  };
  
  // Mouse Interaction Logic
  const getContainerWidth = () => {
      return containerRef.current?.clientWidth || 0;
  };

  const getXFromTime = (time: number) => {
      const w = getContainerWidth();
      if (w === 0 || duration === 0) return 0;
      return (time / duration) * w;
  };

  const getTimeFromX = (x: number) => {
      const w = getContainerWidth();
      if (w === 0 || duration === 0) return 0;
      return (x / w) * duration;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Stop playing when user starts interacting
    if (isPlaying) {
        stopAudio();
    }

    if (!readonly && (hoverState === 'start' || hoverState === 'end')) {
        setDragState(hoverState);
        e.preventDefault(); 
    } else {
        // Click on body -> Seek logic
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
            const x = e.clientX - rect.left;
            let time = getTimeFromX(x);
            
            // Snap to range if editable
            if (!readonly) {
                if (time < range.start) time = range.start;
                if (time > range.end) time = range.end;
            } else {
                // Clamp to duration
                time = Math.max(0, Math.min(duration, time));
            }
            
            setCurrentTime(time);
        }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = Math.max(0, Math.min(duration, getTimeFromX(x)));
    
    // Dragging Logic (Only if not readonly)
    if (!readonly && dragState !== 'none') {
        if (dragState === 'start') {
            const newStart = Math.min(time, range.end - 0.5); // Min duration 0.5s
            onChange({ ...range, start: newStart });
        } else {
            const newEnd = Math.max(time, range.start + 0.5); // Min duration 0.5s
            onChange({ ...range, end: newEnd });
        }
        return;
    }

    // Hover Detection
    const threshold = 15; // Hit area in pixels
    
    if (readonly) {
        setHoverState('body');
        containerRef.current.style.cursor = 'pointer';
        return;
    }

    const startX = getXFromTime(range.start);
    const endX = getXFromTime(range.end);

    if (Math.abs(x - startX) < threshold) {
        setHoverState('start');
        containerRef.current.style.cursor = 'col-resize';
    } else if (Math.abs(x - endX) < threshold) {
        setHoverState('end');
        containerRef.current.style.cursor = 'col-resize';
    } else {
        setHoverState('body');
        containerRef.current.style.cursor = 'pointer'; // Indicate seekable
    }
  };

  const handleMouseUp = () => {
    setDragState('none');
  };

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds) || isNaN(seconds)) return "0:00.0";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  // Calculate positions for rendering
  const startPercent = duration > 0 ? (range.start / duration) * 100 : 0;
  const endPercent = duration > 0 ? (range.end / duration) * 100 : 100;
  const currentPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex flex-col gap-3 select-none">
       {/* Canvas Container */}
       <div 
         ref={containerRef}
         className="relative h-32 bg-slate-900 rounded-lg overflow-hidden border border-slate-700 shadow-inner group select-none"
         onMouseDown={handleMouseDown}
         onMouseMove={handleMouseMove}
         onMouseUp={handleMouseUp}
         onMouseLeave={handleMouseUp}
       >
         {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-30">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium animate-pulse">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading Audio...
                </div>
            </div>
         )}
         
         <canvas 
            ref={canvasRef} 
            className="w-full h-full block opacity-80"
         />

         {/* Overlays and Handles */}
         {!isLoading && duration > 0 && (
             <>
                 {/* Mask Left (Inactive Area) - Only show if not readonly */}
                 {!readonly && (
                     <div 
                        className="absolute top-0 bottom-0 left-0 bg-slate-950/70 pointer-events-none backdrop-grayscale transition-[width] duration-75 ease-out"
                        style={{ width: `${startPercent}%` }} 
                     />
                 )}
                 {/* Mask Right (Inactive Area) - Only show if not readonly */}
                 {!readonly && (
                     <div 
                        className="absolute top-0 bottom-0 right-0 bg-slate-950/70 pointer-events-none backdrop-grayscale transition-[left] duration-75 ease-out"
                        style={{ left: `${endPercent}%` }} 
                     />
                 )}
                 
                 {/* Start Handle - Only show if not readonly */}
                 {!readonly && (
                     <div 
                        className={`absolute top-0 bottom-0 -translate-x-1/2 w-8 flex flex-col items-center cursor-col-resize z-20 group/handle transition-opacity duration-200 ${hoverState === 'start' || dragState === 'start' ? 'opacity-100' : 'opacity-80'}`}
                        style={{ left: `${startPercent}%` }}
                     >
                         {/* Grip Head */}
                         <div className={`absolute top-0 w-4 h-6 rounded-b flex items-center justify-center shadow-md border-x border-b border-emerald-600/50 ${hoverState === 'start' || dragState === 'start' ? 'bg-white text-emerald-700' : 'bg-emerald-500 text-emerald-900'}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                 <path d="M7 3.5a.5.5 0 01.5-.5h5a.5.5 0 010 1h-5a.5.5 0 01-.5-.5zM7 6.5a.5.5 0 01.5-.5h5a.5.5 0 010 1h-5a.5.5 0 01-.5-.5zM7 9.5a.5.5 0 01.5-.5h5a.5.5 0 010 1h-5a.5.5 0 01-.5-.5z" />
                            </svg>
                         </div>
                         {/* Visual Line */}
                         <div className={`w-0.5 h-full mt-6 ${hoverState === 'start' || dragState === 'start' ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'bg-emerald-500'}`}></div>
                         
                         {/* Tooltip */}
                         <div className={`absolute bottom-2 bg-slate-800 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-lg pointer-events-none transition-all duration-200 ${dragState === 'start' || hoverState === 'start' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}>
                             Start: {formatTime(range.start)}
                         </div>
                     </div>
                 )}

                 {/* End Handle - Only show if not readonly */}
                 {!readonly && (
                     <div 
                        className={`absolute top-0 bottom-0 -translate-x-1/2 w-8 flex flex-col items-center cursor-col-resize z-20 group/handle transition-opacity duration-200 ${hoverState === 'end' || dragState === 'end' ? 'opacity-100' : 'opacity-80'}`}
                        style={{ left: `${endPercent}%` }}
                     >
                         {/* Grip Head */}
                         <div className={`absolute top-0 w-4 h-6 rounded-b flex items-center justify-center shadow-md border-x border-b border-emerald-600/50 ${hoverState === 'end' || dragState === 'end' ? 'bg-white text-emerald-700' : 'bg-emerald-500 text-emerald-900'}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                 <path d="M7 3.5a.5.5 0 01.5-.5h5a.5.5 0 010 1h-5a.5.5 0 01-.5-.5zM7 6.5a.5.5 0 01.5-.5h5a.5.5 0 010 1h-5a.5.5 0 01-.5-.5zM7 9.5a.5.5 0 01.5-.5h5a.5.5 0 010 1h-5a.5.5 0 01-.5-.5z" />
                            </svg>
                         </div>
                         {/* Visual Line */}
                         <div className={`w-0.5 h-full mt-6 ${hoverState === 'end' || dragState === 'end' ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'bg-emerald-500'}`}></div>
                         
                         {/* Tooltip */}
                         <div className={`absolute bottom-2 bg-slate-800 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-lg pointer-events-none transition-all duration-200 ${dragState === 'end' || hoverState === 'end' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}>
                             End: {formatTime(range.end)}
                         </div>
                     </div>
                 )}

                 {/* Playback Cursor (Always visible) */}
                 <div 
                    className="absolute top-0 bottom-0 w-px bg-yellow-400 z-10 shadow-[0_0_6px_rgba(250,204,21,0.8)] pointer-events-none will-change-[left]"
                    style={{ left: `${currentPercent}%` }}
                 >
                    <div className="absolute -top-1.5 -translate-x-1/2 w-3 h-3 bg-yellow-400 rotate-45 rounded-[1px] shadow-sm"></div>
                 </div>
             </>
         )}
       </div>

       {/* Controls Bar */}
       <div className="flex flex-wrap items-center gap-3 bg-slate-900/50 p-2 rounded-lg border border-slate-700/50">
           {/* Left Controls: Play + Time */}
           <div className="flex items-center gap-4 flex-1 min-w-[180px]">
               <button 
                 onClick={togglePlay}
                 className={`flex items-center justify-center w-10 h-10 rounded-full transition-all shadow-lg active:scale-95 ${isPlaying ? 'bg-yellow-500 hover:bg-yellow-400 text-slate-900 ring-2 ring-yellow-500/30' : (readonly ? 'bg-indigo-600 hover:bg-indigo-500 ring-2 ring-indigo-600/30' : 'bg-emerald-600 hover:bg-emerald-500 ring-2 ring-emerald-600/30') + ' text-white'}`}
                 title={isPlaying ? "一時停止" : "プレビュー再生"}
               >
                   {isPlaying ? (
                       <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                         <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" />
                       </svg>
                   ) : (
                       <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 translate-x-0.5">
                         <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                       </svg>
                   )}
               </button>
               
               {!readonly ? (
                   <div className="flex flex-col text-[11px] leading-tight font-mono">
                       <div className="flex items-center gap-2">
                           <span className="text-slate-500 w-10">START</span>
                           <span className="text-emerald-400 font-bold bg-slate-800 px-1 rounded">{formatTime(range.start)}</span>
                       </div>
                       <div className="flex items-center gap-2 mt-1">
                           <span className="text-slate-500 w-10">END</span>
                           <span className="text-emerald-400 font-bold bg-slate-800 px-1 rounded">{formatTime(range.end)}</span>
                       </div>
                   </div>
               ) : (
                   <div className="flex flex-col text-[11px] leading-tight font-mono">
                       <div className="flex items-center gap-2">
                           <span className="text-slate-500 w-10">CURRENT</span>
                           <span className="text-indigo-400 font-bold bg-slate-800 px-1 rounded">{formatTime(currentTime)}</span>
                       </div>
                   </div>
               )}

               <div className="h-8 w-px bg-slate-700 mx-2"></div>
               <div className="text-xs text-slate-400 font-mono flex flex-col items-start">
                   <span className="text-[10px] text-slate-500">TOTAL</span>
                   <span className="text-white font-bold text-sm">{formatTime(readonly ? duration : (range.end - range.start))}</span>
               </div>
           </div>
           
           {/* Right Controls: Volume */}
          <div className="flex items-center gap-3 flex-1 justify-end min-w-[140px] max-w-[240px]">
               {volume === 0 ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-slate-600">
                        <path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" />
                    </svg>
               ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-slate-400">
                        <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
               )}
               <input 
                 type="range" 
                 min="0" 
                 max="1" 
                 step="0.01" 
                 value={volume}
                 onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                 className={`w-full min-w-[100px] h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer ${readonly ? 'accent-indigo-500 hover:accent-indigo-400' : 'accent-emerald-500 hover:accent-emerald-400'}`}
                 title={`Volume: ${Math.round(volume * 100)}%`}
               />
               <span className="text-[10px] text-slate-500 w-8 text-right font-mono">{Math.round(volume * 100)}%</span>
           </div>
       </div>
    </div>
  );
};

export default BgmWaveformEditor;
