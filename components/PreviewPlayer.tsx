
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Slide, VideoSettings, BgmTimeRange, FadeOptions, DuckingOptions, Overlay } from '../types';
import { 
  initPdfJs, 
  renderSlideToImage, 
  drawSlideFrame, 
  getKenBurnsParams, 
  getVideoDimensions,
  renderBackground
} from '../services/pdfVideoService';

declare const pdfjsLib: any;

interface PreviewPlayerProps {
  isOpen: boolean;
  onClose: () => void;
  slides: Slide[];
  sourceFile: File | null;
  videoSettings: VideoSettings;
  bgmFile: File | null;
  bgmTimeRange?: BgmTimeRange;
  bgmVolume?: number;
  globalAudioFile?: File | null;
  globalAudioVolume?: number;
  fadeOptions?: FadeOptions;
  duckingOptions?: DuckingOptions;
}

// Helper to check if slide is animated image
const isAnimSlide = (slide: Slide | null) => {
    return !!(slide?.customImageFile && (
        slide.customImageFile.type === 'image/gif' || 
        slide.customImageFile.type === 'image/webp' || 
        slide.customImageFile.type === 'image/png'
    ));
};

// Helper to check if background file is animated
const isAnimBackground = (file: File | undefined) => {
    return !!(file && (
        file.type === 'image/gif' || 
        file.type === 'image/webp' || 
        file.type === 'image/png'
    ));
};

// Easing functions for preview animation
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

// Helper component for slide background when using custom image (GIF/APNG support)
const SlideBackgroundLayer = React.memo(({ slide, kenBurns, progress, width: videoW, height: videoH, videoSettings }: { slide: Slide, kenBurns: any, progress: number, width: number, height: number, videoSettings: VideoSettings }) => {
    const isAnim = isAnimSlide(slide);
    if (!isAnim) return null;
    if (videoW === 0) return null;

    const [imageSrc, setImageSrc] = useState<string>("");

    useEffect(() => {
        let url = "";
        if (slide.customImageFile) {
            url = URL.createObjectURL(slide.customImageFile);
            setImageSrc(url);
        } else {
            setImageSrc(slide.thumbnailUrl);
        }
        return () => {
            if (url) URL.revokeObjectURL(url);
        };
    }, [slide.customImageFile, slide.thumbnailUrl]);

    const slideScale = videoSettings.slideScale / 100;
    const radius = videoSettings.slideBorderRadius;

    let kbScale = 1.0;
    let kbX = 0;
    let kbY = 0;
    
    if (slide.effectType === 'kenburns' && kenBurns) {
        const { direction, startScale, endScale, panX, panY } = kenBurns;
        kbScale = startScale + (endScale - startScale) * progress;
        if (direction.includes('pan')) {
           kbX = panX * videoW * progress;
           kbY = panY * videoH * progress;
        }
        if (direction === 'zoom-out') {
             kbScale = endScale + (startScale - endScale) * progress;
        }
    }

    const availableW = videoW * slideScale;
    const availableH = videoH * slideScale;
    const imgRatio = slide.crop.width / slide.crop.height;
    
    let finalW = availableW;
    let finalH = availableW / imgRatio;
    
    if (finalH > availableH) {
        finalH = availableH;
        finalW = availableH * imgRatio;
    }
    
    const centerX = videoW / 2;
    const centerY = videoH / 2;
    const drawW = finalW * kbScale;
    const drawH = finalH * kbScale;
    const drawX = centerX - (drawW / 2) + kbX;
    const drawY = centerY - (drawH / 2) + kbY;

    return (
        <div 
            style={{
                position: 'absolute',
                left: drawX,
                top: drawY,
                width: drawW,
                height: drawH,
                borderRadius: `${radius}px`,
                overflow: 'hidden',
                zIndex: 0, // Behind overlays
                pointerEvents: 'none',
            }}
        >
            <img 
                src={imageSrc || slide.thumbnailUrl} 
                alt=""
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'fill'
                }}
            />
        </div>
    );
});

// Helper component for DOM overlays - Defined OUTSIDE to prevent re-mounting on every render
const OverlayLayer = React.memo(({ 
    slide, 
    kenBurns, 
    progress, 
    width: videoW, 
    height: videoH, 
    videoSettings,
    currentTime // Local time in slide
}: { 
    slide: Slide, 
    kenBurns: any, 
    progress: number, 
    width: number, 
    height: number, 
    videoSettings: VideoSettings,
    currentTime: number
}) => {
    if (!slide.overlays) return null;
    if (videoW === 0) return null;

    const slideScale = videoSettings.slideScale / 100;
    const availableW = videoW * slideScale;
    const availableH = videoH * slideScale;
    
    const imgRatio = slide.width / slide.height;
    
    let finalW = availableW;
    let finalH = availableW / imgRatio;
    
    if (finalH > availableH) {
        finalH = availableH;
        finalW = availableH * imgRatio;
    }
    
    let kbScale = 1.0;
    let kbX = 0;
    let kbY = 0;
    
    if (slide.effectType === 'kenburns' && kenBurns) {
        const { direction, startScale, endScale, panX, panY } = kenBurns;
        kbScale = startScale + (endScale - startScale) * progress;
        if (direction.includes('pan')) {
           kbX = panX * videoW * progress;
           kbY = panY * videoH * progress;
        }
        if (direction === 'zoom-out') {
             kbScale = endScale + (startScale - endScale) * progress;
        }
    }
    
    const centerX = videoW / 2;
    const centerY = videoH / 2;
    const drawW = finalW * kbScale;
    const drawH = finalH * kbScale;
    const drawX = centerX - (drawW / 2) + kbX;
    const drawY = centerY - (drawH / 2) + kbY;
    const shadowScale = drawH / 500;

    return (
        <div 
          style={{ 
              position: 'absolute', 
              left: drawX, top: drawY, 
              width: drawW, height: drawH, 
              pointerEvents: 'none',
              overflow: 'hidden',
              zIndex: 10
          }}
        >
            {slide.overlays.map(ov => {
                // Timing Check
                const startTime = ov.startTime || 0;
                const duration = ov.duration || (slide.duration - startTime);
                const endTime = startTime + duration;

                if (currentTime < startTime || currentTime > endTime) {
                    return null;
                }

                const strokeWidthPx = Math.max(1, (ov.strokeWidth || 0) * (drawH / 500));
                const baseDuration = 1.0;
                const animDuration = (duration < 2.0) ? Math.min(baseDuration, duration / 2) : baseDuration;
                
                // Calculate local time for this overlay
                const timeInOverlay = currentTime - startTime;

                let alpha = ov.opacity ?? 1;
                let offsetX = 0;
                let offsetY = 0;
                let scale = 1;
                let rotation = ov.rotation || 0;
                let clipPath: string | undefined = undefined;
                let displayText = ov.text;

                // Animation IN
                if (ov.animationIn && ov.animationIn !== 'none') {
                    const p = Math.min(1, Math.max(0, timeInOverlay / animDuration));
                    const easeOut = 1 - Math.pow(1 - p, 3);

                    switch (ov.animationIn) {
                        case 'fade': alpha *= easeOut; break;
                        case 'pop': scale = easeOutBack(p); alpha *= Math.min(1, p * 2); break;
                        case 'slide-up': offsetY += (1 - easeOut) * (drawH * 0.2); alpha *= easeOut; break;
                        case 'slide-down': offsetY -= (1 - easeOut) * (drawH * 0.2); alpha *= easeOut; break;
                        case 'slide-left': offsetX -= (1 - easeOut) * (drawW * 0.2); alpha *= easeOut; break;
                        case 'slide-right': offsetX += (1 - easeOut) * (drawW * 0.2); alpha *= easeOut; break;
                        case 'zoom': scale = easeOut; alpha *= easeOut; break;
                        case 'rotate-cw': rotation += (1 - easeOut) * -180; alpha *= easeOut; break;
                        case 'rotate-ccw': rotation += (1 - easeOut) * 180; alpha *= easeOut; break;
                        case 'wipe-right': clipPath = `inset(0 ${100 - (easeOut * 100)}% 0 0)`; break;
                        case 'wipe-down': clipPath = `inset(0 0 ${100 - (easeOut * 100)}% 0)`; break;
                        case 'typewriter': 
                            if (ov.type === 'text' && ov.text) {
                                const len = Math.floor(ov.text.length * p);
                                displayText = ov.text.substring(0, len);
                            }
                            break;
                    }
                }

                // Animation OUT
                if (ov.animationOut && ov.animationOut !== 'none') {
                    const outStartTime = duration - animDuration;
                    if (timeInOverlay > outStartTime) {
                        const p = Math.min(1, Math.max(0, (timeInOverlay - outStartTime) / animDuration));
                        const easeIn = Math.pow(p, 3);
                        switch (ov.animationOut) {
                            case 'fade': alpha *= (1 - easeIn); break;
                            case 'pop': scale = easeInBack(1 - p); alpha *= (1 - p); break;
                            case 'slide-up': offsetY -= easeIn * (drawH * 0.2); alpha *= (1 - easeIn); break;
                            case 'slide-down': offsetY += easeIn * (drawH * 0.2); alpha *= (1 - easeIn); break;
                            case 'slide-left': offsetX -= easeIn * (drawW * 0.2); alpha *= (1 - easeIn); break;
                            case 'slide-right': offsetX += easeIn * (drawW * 0.2); alpha *= (1 - easeIn); break;
                            case 'zoom': scale = 1 + easeIn * 0.5; alpha *= (1 - easeIn); break;
                            case 'rotate-cw': rotation += easeIn * 180; alpha *= (1 - easeIn); break;
                            case 'rotate-ccw': rotation += easeIn * -180; alpha *= (1 - easeIn); break;
                            case 'wipe-right': clipPath = `inset(0 0 0 ${easeIn * 100}%)`; break;
                            case 'wipe-down': clipPath = `inset(${easeIn * 100}% 0 0 0)`; break;
                        }
                    }
                }

                const baseStyle: React.CSSProperties = {
                    position: 'absolute',
                    left: `${ov.x * 100}%`,
                    top: `${ov.y * 100}%`,
                    transform: `translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px) rotate(${rotation}deg) scale(${scale})`,
                    opacity: alpha, // Local opacity only
                    clipPath: clipPath,
                };

                // テキスト枠線をプレビューでも出すためのスタイル
                const textStrokeStyle: React.CSSProperties =
                    strokeWidthPx > 0
                        ? {
                              WebkitTextStrokeWidth: `${strokeWidthPx}px`,
                              WebkitTextStrokeColor: ov.strokeColor || '#000',
                              WebkitTextStroke: `${strokeWidthPx}px ${ov.strokeColor || '#000'}`,
                              paintOrder: 'stroke fill',
                          }
                        : {};

                return (
                    <div key={ov.id} style={baseStyle}>
                        {ov.type === 'text' && (
                            <div style={{
                                fontSize: `${(ov.fontSize || 5) / 100 * drawH}px`,
                                fontFamily: `"${ov.fontFamily}", sans-serif`,
                                fontWeight: ov.isBold ? 'bold' : 'normal',
                                fontStyle: ov.isItalic ? 'italic' : 'normal',
                                textAlign: ov.textAlign || 'center',
                                whiteSpace: ov.width ? 'normal' : 'pre',
                                width: ov.width ? `${ov.width * 100 * (drawW/drawH/ov.width*0.2)}vw` : 'auto', 
                                minWidth: ov.width ? `${ov.width * drawW}px` : 'auto',
                                color: ov.color,
                                backgroundColor: ov.backgroundColor,
                                padding: ov.backgroundColor ? `${(ov.backgroundPadding||0) * ((ov.fontSize||5)/500 * drawH)}px` : undefined,
                                borderRadius: `${(ov.borderRadius||0)}px`,
                                filter: ov.shadowColor ? `drop-shadow(${(ov.shadowOffsetX||0)*shadowScale}px ${(ov.shadowOffsetY||0)*shadowScale}px ${(ov.shadowBlur||0)*shadowScale}px ${ov.shadowColor})` : undefined,
                                ...textStrokeStyle,
                            }}>
                                {displayText}
                            </div>
                        )}
                        {ov.type === 'image' && ov.imageData && (
                            <img 
                              src={ov.imageData} 
                              alt="overlay" 
                              style={{ 
                                  width: `${(ov.width||0.2) * drawW}px`, 
                                  height: `${(ov.height||0.2) * drawH}px`, 
                                  objectFit: 'contain',
                                  filter: `drop-shadow(${(ov.shadowOffsetX||0)*shadowScale}px ${(ov.shadowOffsetY||0)*shadowScale}px ${(ov.shadowBlur||0)*shadowScale}px ${ov.shadowColor||'transparent'})` 
                              }} 
                            />
                        )}
                        {(ov.type === 'rect' || ov.type === 'circle') && (
                            <div style={{ 
                                width: `${(ov.width||0.2) * drawW}px`, 
                                height: `${(ov.height||0.2) * drawH}px`, 
                                border: `${strokeWidthPx}px solid ${ov.color}`, 
                                backgroundColor: ov.backgroundColor || 'transparent', 
                                borderRadius: ov.type === 'circle' ? '50%' : `${(ov.borderRadius||0)}px`,
                                boxShadow: `${(ov.shadowOffsetX||0)*shadowScale}px ${(ov.shadowOffsetY||0)*shadowScale}px ${(ov.shadowBlur||0)*shadowScale}px ${ov.shadowColor||'transparent'}`
                            }} />
                        )}
                        {ov.type === 'line' && (
                              <svg width={`${(ov.width||0.2) * drawW}`} height={`${Math.max(20, strokeWidthPx * 2)}`} style={{ overflow: 'visible', filter: ov.shadowColor ? `drop-shadow(${(ov.shadowOffsetX||0)*shadowScale}px ${(ov.shadowOffsetY||0)*shadowScale}px ${(ov.shadowBlur||0)*shadowScale}px ${ov.shadowColor})` : undefined }}>
                                  <line x1="0" y1="50%" x2="100%" y2="50%" stroke={ov.color} strokeWidth={strokeWidthPx} strokeLinecap={ov.strokeLineCap || 'butt'} strokeDasharray={ ov.borderStyle === 'dashed' ? `${strokeWidthPx * 3},${strokeWidthPx * 2}` : ov.borderStyle === 'dotted' ? (ov.strokeLineCap === 'round' ? `0,${strokeWidthPx * 2}` : `${strokeWidthPx},${strokeWidthPx}`) : undefined } />
                              </svg>
                        )}
                        {ov.type === 'arrow' && (
                              (() => { 
                                  const w = (ov.width || 0.2) * drawW; 
                                  const h = (ov.height || 0.05) * drawH; 
                                  const headHeight = h; 
                                  const headLength = Math.min(w, headHeight); 
                                  const shaftHeight = (ov.strokeWidth || 5) * (drawH / 500); 
                                  const shaftY = (h - shaftHeight) / 2; 
                                  return ( 
                                      <svg width={w} height={h} style={{ filter: `drop-shadow(${(ov.shadowOffsetX||0)*shadowScale}px ${(ov.shadowOffsetY||0)*shadowScale}px ${(ov.shadowBlur||0)*shadowScale}px ${ov.shadowColor||'transparent'})`, overflow: 'visible' }}> 
                                          <rect x="0" y={shaftY} width={Math.max(0, w - headLength)} height={shaftHeight} fill={ov.color} /> 
                                          <polygon points={`${w},${h/2} ${w-headLength},0 ${w-headLength},${h}`} fill={ov.color} /> 
                                      </svg> 
                                  ); 
                              })()
                        )}
                    </div>
                );
            })}
        </div>
    );
});

// ... (Rest of the file remains unchanged)
const PreviewPlayer: React.FC<PreviewPlayerProps> = ({
  isOpen, onClose, slides, sourceFile, videoSettings, bgmFile, bgmTimeRange, bgmVolume = 1.0, fadeOptions, globalAudioFile, globalAudioVolume = 1.0, duckingOptions
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null); 
  
  const [currentTime, setCurrentTime] = useState(0);
  const totalDuration = useMemo(() => slides.reduce((acc, s) => acc + s.duration, 0), [slides]);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [bgAnimUrl, setBgAnimUrl] = useState<string | null>(null);
  
  const requestRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const isPlayingRef = useRef(false); 
  const isDrawingRef = useRef(false);
  const [isPlayingState, setIsPlayingState] = useState(false);

  const [currentOverlayData, setCurrentOverlayData] = useState<{
      slide: Slide | null,
      nextSlide: Slide | null,
      transProgress: number,
      kenBurns: any,
      nextKenBurns: any,
      currentProgress: number,
      nextProgress: number,
      width: number, 
      height: number,
      localTime: number 
  }>({ slide: null, nextSlide: null, transProgress: 0, kenBurns: null, nextKenBurns: null, currentProgress: 0, nextProgress: 0, width: 0, height: 0, localTime: 0 });

  const [scale, setScale] = useState(1);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const bgmSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const bgmGainRef = useRef<GainNode | null>(null);
  const duckingGainRef = useRef<GainNode | null>(null);
  const globalAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const globalAudioGainRef = useRef<GainNode | null>(null);
  const narrationSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const lastDuckEndRef = useRef<number>(0);
  
  const pdfDocRef = useRef<any>(null);
  
  const currentSlideImageRef = useRef<ImageBitmap | null>(null);
  const nextSlideImageRef = useRef<ImageBitmap | null>(null);
  const bgImageRef = useRef<ImageBitmap | null>(null);
  const overlayImageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const currentIndexRef = useRef<number>(-1);
  
  const bgmBufferRef = useRef<AudioBuffer | null>(null);
  const globalAudioBufferRef = useRef<AudioBuffer | null>(null);
  const narrationBuffersRef = useRef<Map<string, AudioBuffer>>(new Map());

  // Update scale on resize
  useEffect(() => {
      if (!containerRef.current) return;
      const updateScale = () => {
          if (!containerRef.current) return;
          const { width: cw, height: ch } = containerRef.current.getBoundingClientRect();
          const { width: vw, height: vh } = getVideoDimensions(videoSettings.aspectRatio, videoSettings.resolution);
          
          if (vw === 0 || vh === 0) return;
          
          const scaleX = cw / vw;
          const scaleY = ch / vh;
          const s = Math.min(scaleX, scaleY);
          setScale(s);
      };
      
      updateScale();
      window.addEventListener('resize', updateScale);
      const observer = new ResizeObserver(updateScale);
      observer.observe(containerRef.current);
      return () => {
          window.removeEventListener('resize', updateScale);
          observer.disconnect();
      };
  }, [videoSettings.aspectRatio, videoSettings.resolution]);

  // Handle Animated Background URL
  useEffect(() => {
      if (videoSettings.backgroundFill === 'custom_image' && isAnimBackground(videoSettings.backgroundImageFile)) {
          const url = URL.createObjectURL(videoSettings.backgroundImageFile!);
          setBgAnimUrl(url);
          return () => URL.revokeObjectURL(url);
      } else {
          setBgAnimUrl(null);
      }
  }, [videoSettings.backgroundImageFile, videoSettings.backgroundFill]);

  // Initialize
  useEffect(() => {
    if (!isOpen) return;
    
    let isMounted = true;

    // Reset state
    isPlayingRef.current = false;
    setIsPlayingState(false);
    isDrawingRef.current = false;
    setCurrentTime(0);
    setIsLoading(true);
    setErrorMsg(null);
    currentIndexRef.current = -1;
    
    // Clean up previous images
    if (currentSlideImageRef.current) { currentSlideImageRef.current.close(); currentSlideImageRef.current = null; }
    if (nextSlideImageRef.current) { nextSlideImageRef.current.close(); nextSlideImageRef.current = null; }

    const init = async () => {
      try {
        initPdfJs();
        
        // Load PDF
        if (sourceFile) {
           const arrayBuffer = await sourceFile.arrayBuffer();
           if (!isMounted) return;
           pdfDocRef.current = await pdfjsLib.getDocument(arrayBuffer).promise;
        }
        
        // Load BG Image
        if (videoSettings.backgroundFill === 'custom_image' && videoSettings.backgroundImageFile && !isAnimBackground(videoSettings.backgroundImageFile)) {
           try {
             const bmp = await createImageBitmap(videoSettings.backgroundImageFile);
             if (isMounted) bgImageRef.current = bmp;
             else bmp.close();
           } catch (e) {
             console.warn("Failed to load BG image", e);
           }
        } else {
            bgImageRef.current = null;
        }
        
        if (!isMounted) return;

        // Preload slides
        const { width, height } = getVideoDimensions(videoSettings.aspectRatio, videoSettings.resolution);
        if (slides.length > 0) {
            const bmp = await renderSlideToImage(pdfDocRef.current, slides[0], width, height, videoSettings);
            if (isMounted) {
                currentSlideImageRef.current = bmp;
                currentIndexRef.current = 0;
            } else {
                bmp.close();
                return;
            }
        }
        if (slides.length > 1) {
            const bmp = await renderSlideToImage(pdfDocRef.current, slides[1], width, height, videoSettings);
            if (isMounted) {
                nextSlideImageRef.current = bmp;
            } else {
                bmp.close();
                return;
            }
        }

        // Prepare Audio
        if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
             audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const ctx = audioCtxRef.current;

        if (bgmFile) {
            const ab = await bgmFile.arrayBuffer();
            if (isMounted) bgmBufferRef.current = await ctx.decodeAudioData(ab);
        } else {
            bgmBufferRef.current = null;
        }

        if (globalAudioFile) {
            const ab = await globalAudioFile.arrayBuffer();
            if (isMounted) globalAudioBufferRef.current = await ctx.decodeAudioData(ab);
        } else {
            globalAudioBufferRef.current = null;
        }

        if (isMounted) narrationBuffersRef.current.clear();
        for (const slide of slides) {
            if (!isMounted) break;
            if (slide.audioFile) {
                const ab = await slide.audioFile.arrayBuffer();
                const buf = await ctx.decodeAudioData(ab);
                narrationBuffersRef.current.set(slide.id, buf);
            }
        }

        if (!isMounted) return;

        setIsLoading(false);
        await drawFrame(0);
        
      } catch (e: any) {
        if (!isMounted) return;
        console.error("Preview init failed", e);
        setErrorMsg(e.message || "プレビューの準備に失敗しました");
        setIsLoading(false);
      }
    };
    
    init();
    
    return () => {
        isMounted = false;
        cleanup();
    };
  }, [isOpen, slides, sourceFile, bgmFile, globalAudioFile, videoSettings.backgroundImageFile, videoSettings.aspectRatio, videoSettings.resolution, videoSettings.backgroundFill]);

  useEffect(() => {
      if (!isPlayingRef.current && !isLoading) {
          drawFrame(currentTime);
      }
  }, [videoSettings, currentTime, isLoading]);

  const cleanup = () => {
      stopAudio();
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (currentSlideImageRef.current) currentSlideImageRef.current.close();
      if (nextSlideImageRef.current) nextSlideImageRef.current.close();
      if (bgImageRef.current) bgImageRef.current.close();
      overlayImageCache.current.clear();
  };

  const playAudio = async (startOffset: number) => {
      if (!audioCtxRef.current) return;
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') await ctx.resume();

      // BGM
      if (bgmBufferRef.current) {
          const src = ctx.createBufferSource();
          src.buffer = bgmBufferRef.current;
          src.loop = true; 
          
          if (bgmTimeRange && bgmTimeRange.end > bgmTimeRange.start) {
              src.loopStart = bgmTimeRange.start;
              src.loopEnd = bgmTimeRange.end;
          }

          // Create Gain Nodes Chain: Src -> FadeGain -> DuckingGain -> MasterGain -> Destination
          const gain = ctx.createGain();
          const fadeGain = ctx.createGain();
          const duckGain = ctx.createGain();
          fadeGain.gain.value = 1.0; 
          duckGain.gain.value = 1.0;
          
          gain.gain.value = bgmVolume; // Master volume for BGM channel

          src.connect(fadeGain);
          fadeGain.connect(duckGain);
          duckGain.connect(gain);
          gain.connect(ctx.destination);
          
          duckingGainRef.current = duckGain;

          // Basic start logic
          let offset = startOffset;
          if (bgmTimeRange && bgmTimeRange.end > bgmTimeRange.start) {
              const dur = bgmTimeRange.end - bgmTimeRange.start;
              offset = bgmTimeRange.start + (startOffset % dur);
          }
          src.start(0, offset);
          
          // --- Fade Logic for Preview ---
          const FADE_DURATION = 2.0;
          const now = ctx.currentTime;
          
          // Fade In
          if (fadeOptions?.fadeIn) {
              if (startOffset < FADE_DURATION) {
                  // We are in the fade-in zone
                  const fadeRemaining = FADE_DURATION - startOffset;
                  const startVal = startOffset / FADE_DURATION; // 0.0 to 1.0
                  fadeGain.gain.setValueAtTime(startVal, now);
                  fadeGain.gain.linearRampToValueAtTime(1.0, now + fadeRemaining);
              } else {
                  fadeGain.gain.setValueAtTime(1.0, now);
              }
          } else {
              fadeGain.gain.setValueAtTime(1.0, now);
          }

          // Fade Out
          if (fadeOptions?.fadeOut) {
              const timeUntilEnd = totalDuration - startOffset;
              const fadeOutStartRel = timeUntilEnd - FADE_DURATION; // Time from now to start fading out
              
              if (fadeOutStartRel > 0) {
                  // Fade out starts in future
                  fadeGain.gain.setValueAtTime(1.0, now + fadeOutStartRel);
                  fadeGain.gain.linearRampToValueAtTime(0, now + timeUntilEnd);
              } else {
                  // We are already in fade out zone
                  const fadeOutStartPoint = totalDuration - FADE_DURATION;
                  const progress = (startOffset - fadeOutStartPoint) / FADE_DURATION;
                  const currentVal = Math.max(0, 1.0 - progress);
                  
                  fadeGain.gain.setValueAtTime(currentVal, now);
                  fadeGain.gain.linearRampToValueAtTime(0, now + timeUntilEnd);
              }
          }

          bgmSourceRef.current = src;
          bgmGainRef.current = gain;
      }

      // Global Audio
      if (globalAudioBufferRef.current) {
          const src = ctx.createBufferSource();
          src.buffer = globalAudioBufferRef.current;
          const gain = ctx.createGain();
          gain.gain.value = globalAudioVolume;
          src.connect(gain);
          gain.connect(ctx.destination);
          if (startOffset < globalAudioBufferRef.current.duration) {
              src.start(0, startOffset);
          }
          globalAudioSourceRef.current = src;
          globalAudioGainRef.current = gain;
      }

      // Narration
      let cursor = 0;
      narrationSourcesRef.current = [];
      for (const slide of slides) {
          const buffer = narrationBuffersRef.current.get(slide.id);
          const slideStart = cursor;
          
          if (buffer) {
              const audioOffset = slide.audioOffset || 0;
              const playStart = slideStart + audioOffset;
              const playEnd = playStart + buffer.duration;
              
              if (startOffset < playEnd) {
                  const src = ctx.createBufferSource();
                  src.buffer = buffer;
                  const gain = ctx.createGain();
                  gain.gain.value = slide.audioVolume ?? 1.0;
                  src.connect(gain);
                  gain.connect(ctx.destination);
                  
                  let offsetInFile = 0;
                  let delay = 0;
                  
                  if (startOffset > playStart) {
                      offsetInFile = startOffset - playStart;
                  } else {
                      delay = playStart - startOffset;
                  }
                  
                  src.start(ctx.currentTime + delay, offsetInFile);
                  
                  // Ducking schedule: lower BGM during narration if enabled and bgm is present
                  if (duckingGainRef.current && duckingOptions?.enabled) {
                      const g = duckingGainRef.current.gain;
                      const duckVol = duckingOptions.duckingVolume;
                      const ramp = 0.03; // 30msでクリックを抑制
                      const now = ctx.currentTime;
                      const startT = Math.max(now, ctx.currentTime + delay);
                      const endT = startT + (buffer.duration - offsetInFile);
                      const releaseEnd = endT + ramp;

                      // 直前のダック中ならキャンセルせず延長のみ
                      if (startT <= lastDuckEndRef.current + ramp) {
                          g.cancelScheduledValues(startT);
                          g.setValueAtTime(duckVol, startT);
                          g.setValueAtTime(duckVol, endT);
                          g.linearRampToValueAtTime(1.0, releaseEnd);
                          lastDuckEndRef.current = Math.max(lastDuckEndRef.current, releaseEnd);
                      } else {
                          if (typeof g.cancelAndHoldAtTime === 'function') {
                              g.cancelAndHoldAtTime(startT);
                          } else {
                              g.cancelScheduledValues(startT);
                              const currentVal = g.value;
                              g.setValueAtTime(currentVal, startT);
                          }
                          g.linearRampToValueAtTime(duckVol, startT + ramp);
                          g.setValueAtTime(duckVol, endT);
                          g.linearRampToValueAtTime(1.0, releaseEnd);
                          lastDuckEndRef.current = releaseEnd;
                      }
                  }
                  
                  narrationSourcesRef.current.push(src);
              }
          }
          cursor += slide.duration;
      }
  };

  const stopAudio = () => {
      try {
          if (bgmSourceRef.current) { bgmSourceRef.current.stop(); bgmSourceRef.current.disconnect(); }
          if (globalAudioSourceRef.current) { globalAudioSourceRef.current.stop(); globalAudioSourceRef.current.disconnect(); }
          if (duckingGainRef.current) { duckingGainRef.current.gain.cancelScheduledValues(0); duckingGainRef.current.gain.setValueAtTime(1.0, 0); duckingGainRef.current.disconnect(); duckingGainRef.current = null; }
          narrationSourcesRef.current.forEach(src => { try { src.stop(); src.disconnect(); } catch(e){} });
          narrationSourcesRef.current = [];
          lastDuckEndRef.current = 0;
      } catch (e) { /* ignore */ }
  };

  const pausePlayback = () => {
      isPlayingRef.current = false;
      setIsPlayingState(false);
      stopAudio();
      if (requestRef.current) {
          cancelAnimationFrame(requestRef.current);
          requestRef.current = null;
      }
      isDrawingRef.current = false;
  };

  const togglePlay = () => {
      if (isPlayingState) {
          pausePlayback();
      } else {
          // Resume logic
          if (currentTime >= totalDuration) {
              setCurrentTime(0);
              startTimeRef.current = performance.now();
              playAudio(0);
          } else {
              startTimeRef.current = performance.now() - (currentTime * 1000);
              playAudio(currentTime);
          }
          isPlayingRef.current = true;
          setIsPlayingState(true);
          requestRef.current = requestAnimationFrame(animate);
      }
  };

  const animate = async (time: number) => {
      if (!isPlayingRef.current) return;
      if (isDrawingRef.current) {
          requestRef.current = requestAnimationFrame(animate);
          return;
      }
      isDrawingRef.current = true;
      const elapsed = (performance.now() - startTimeRef.current) / 1000; 
      if (elapsed >= totalDuration) {
          isDrawingRef.current = false;
          pausePlayback();
          setCurrentTime(totalDuration);
          return;
      }
      setCurrentTime(elapsed);
      await drawFrame(elapsed);
      isDrawingRef.current = false;
      requestRef.current = requestAnimationFrame(animate);
  };
  
  const drawFrame = async (time: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const { width, height } = getVideoDimensions(videoSettings.aspectRatio, videoSettings.resolution);
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;

      let t = 0;
      let activeIndex = 0;
      for (let i = 0; i < slides.length; i++) {
          if (time < t + slides[i].duration) {
              activeIndex = i;
              break;
          }
          t += slides[i].duration;
      }
      if (time >= totalDuration && totalDuration > 0) {
          activeIndex = slides.length - 1;
          t = totalDuration - slides[activeIndex].duration;
      }
      
      const localTime = Math.max(0, time - t);
      const slide = slides[activeIndex];
      
      if (!slide) return; 

      if (activeIndex !== currentIndexRef.current) {
           await updateSlideImages(activeIndex, width, height);
           currentIndexRef.current = activeIndex;
      }
      
      const transitionDurationBase = slide.transitionDuration !== undefined ? slide.transitionDuration : videoSettings.transitionDuration;
      const safeDuration = Math.max(1, slide.duration);
      let transDur = 0;
      if (slide.transitionType !== 'none' && transitionDurationBase > 0) {
          transDur = Math.max(0, Math.min(transitionDurationBase, safeDuration - 0.5));
      }
      
      const staticDur = safeDuration - transDur;
      const bgColor = videoSettings.backgroundFill === 'white' ? '#ffffff' : '#000000';
      
      if (bgAnimUrl) {
          ctx.clearRect(0, 0, width, height);
      } else {
          renderBackground(ctx, width, height, bgColor, bgImageRef.current);
      }

      const kenBurns = slide.effectType === 'kenburns' ? getKenBurnsParams(slide.id) : null;

      let currentSlideData = null;
      let nextSlideData = null;
      let transitionProgress = 0;
      let currentKBProgress = 0;
      let nextKBProgress = 0;
      let nextKenBurns = null;

      if (localTime < staticDur || activeIndex === slides.length - 1) {
          // Static Phase
          const progress = Math.min(1.0, localTime / safeDuration);
          currentKBProgress = progress;
          // IMPORTANT: If slide is animated GIF/APNG, skip canvas drawing
          if (currentSlideImageRef.current && !isAnimSlide(slide)) {
               await drawSlideFrame(ctx, currentSlideImageRef.current, width, height, slide.effectType, kenBurns, progress, slide, videoSettings, localTime, overlayImageCache.current, true);
          }
          currentSlideData = slide;
          nextSlideData = null;
          transitionProgress = 0;
      } else {
          // Transition Phase
          const transProgress = (localTime - staticDur) / transDur;
          transitionProgress = transProgress;
          const nextIndex = activeIndex + 1;
          const nextSlide = slides[nextIndex];
          nextKenBurns = nextSlide && nextSlide.effectType === 'kenburns' ? getKenBurnsParams(nextSlide.id) : null;
          
          currentKBProgress = Math.min(1.0, localTime / safeDuration);
          nextKBProgress = Math.min(1.0, (localTime - staticDur) / Math.max(1, nextSlide.duration));

          currentSlideData = slide;
          nextSlideData = nextSlide;

           switch (slide.transitionType) {
              case 'fade':
                ctx.globalAlpha = 1.0;
                if (currentSlideImageRef.current && !isAnimSlide(slide)) 
                    await drawSlideFrame(ctx, currentSlideImageRef.current, width, height, slide.effectType, kenBurns, currentKBProgress, slide, videoSettings, localTime, overlayImageCache.current, true);
                if (nextSlideImageRef.current && !isAnimSlide(nextSlide)) {
                    ctx.globalAlpha = transProgress;
                    await drawSlideFrame(ctx, nextSlideImageRef.current, width, height, nextSlide.effectType, nextKenBurns, nextKBProgress, nextSlide, videoSettings, 0, overlayImageCache.current, true);
                }
                break;
              case 'slide':
                // Current slides left, next slides in from right
                if (currentSlideImageRef.current && !isAnimSlide(slide)) {
                    ctx.save();
                    ctx.translate(-width * transProgress, 0);
                    await drawSlideFrame(ctx, currentSlideImageRef.current, width, height, slide.effectType, kenBurns, currentKBProgress, slide, videoSettings, localTime, overlayImageCache.current, true);
                    ctx.restore();
                }
                if (nextSlideImageRef.current && !isAnimSlide(nextSlide)) {
                    ctx.save();
                    ctx.translate(width * (1 - transProgress), 0);
                    await drawSlideFrame(ctx, nextSlideImageRef.current, width, height, nextSlide.effectType, nextKenBurns, nextKBProgress, nextSlide, videoSettings, 0, overlayImageCache.current, true);
                    ctx.restore();
                }
                break;
              case 'wipe':
                // Current underneath, Next clips in from left
                if (currentSlideImageRef.current && !isAnimSlide(slide)) {
                    await drawSlideFrame(ctx, currentSlideImageRef.current, width, height, slide.effectType, kenBurns, currentKBProgress, slide, videoSettings, localTime, overlayImageCache.current, true);
                }
                if (nextSlideImageRef.current && !isAnimSlide(nextSlide)) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(0, 0, width * transProgress, height);
                    ctx.clip();
                    await drawSlideFrame(ctx, nextSlideImageRef.current, width, height, nextSlide.effectType, nextKenBurns, nextKBProgress, nextSlide, videoSettings, 0, overlayImageCache.current, true);
                    ctx.restore();
                }
                break;
              case 'zoom':
                // Current fades out, Next zooms in
                if (currentSlideImageRef.current && !isAnimSlide(slide)) {
                    ctx.globalAlpha = 1.0 - transProgress;
                    await drawSlideFrame(ctx, currentSlideImageRef.current, width, height, slide.effectType, kenBurns, currentKBProgress, slide, videoSettings, localTime, overlayImageCache.current, true);
                }
                if (nextSlideImageRef.current && !isAnimSlide(nextSlide)) {
                    ctx.globalAlpha = 1.0;
                    const scale = 0.5 + 0.5 * transProgress;
                    ctx.save();
                    ctx.translate(width/2, height/2);
                    ctx.scale(scale, scale);
                    ctx.translate(-width/2, -height/2);
                    await drawSlideFrame(ctx, nextSlideImageRef.current, width, height, nextSlide.effectType, nextKenBurns, nextKBProgress, nextSlide, videoSettings, 0, overlayImageCache.current, true);
                    ctx.restore();
                }
                break;
              case 'flip':
                // 3D Flip simulation via ScaleX
                if (transProgress < 0.5) {
                    if (currentSlideImageRef.current && !isAnimSlide(slide)) {
                        ctx.save();
                        ctx.translate(width/2, height/2);
                        ctx.scale(1 - 2 * transProgress, 1);
                        ctx.translate(-width/2, -height/2);
                        await drawSlideFrame(ctx, currentSlideImageRef.current, width, height, slide.effectType, kenBurns, currentKBProgress, slide, videoSettings, localTime, overlayImageCache.current, true);
                        ctx.restore();
                    }
                } else {
                    if (nextSlideImageRef.current && !isAnimSlide(nextSlide)) {
                        ctx.save();
                        ctx.translate(width/2, height/2);
                        ctx.scale(2 * (transProgress - 0.5), 1);
                        ctx.translate(-width/2, -height/2);
                        await drawSlideFrame(ctx, nextSlideImageRef.current, width, height, nextSlide.effectType, nextKenBurns, nextKBProgress, nextSlide, videoSettings, 0, overlayImageCache.current, true);
                        ctx.restore();
                    }
                }
                break;
              case 'cross-zoom':
                // Current scales up and fades out, Next starts big and scales down and fades in
                if (currentSlideImageRef.current && !isAnimSlide(slide)) {
                    ctx.globalAlpha = 1.0 - transProgress;
                    const scaleC = 1 + transProgress;
                    ctx.save();
                    ctx.translate(width/2, height/2);
                    ctx.scale(scaleC, scaleC);
                    ctx.translate(-width/2, -height/2);
                    await drawSlideFrame(ctx, currentSlideImageRef.current, width, height, slide.effectType, kenBurns, currentKBProgress, slide, videoSettings, localTime, overlayImageCache.current, true);
                    ctx.restore();
                }
                if (nextSlideImageRef.current && !isAnimSlide(nextSlide)) {
                    ctx.globalAlpha = transProgress;
                    const scaleN = 1.5 - 0.5 * transProgress;
                    ctx.save();
                    ctx.translate(width/2, height/2);
                    ctx.scale(scaleN, scaleN);
                    ctx.translate(-width/2, -height/2);
                    await drawSlideFrame(ctx, nextSlideImageRef.current, width, height, nextSlide.effectType, nextKenBurns, nextKBProgress, nextSlide, videoSettings, 0, overlayImageCache.current, true);
                    ctx.restore();
                }
                break;
              default:
                  ctx.globalAlpha = 1.0;
                  if (currentSlideImageRef.current && !isAnimSlide(slide)) 
                     await drawSlideFrame(ctx, currentSlideImageRef.current, width, height, slide.effectType, kenBurns, currentKBProgress, slide, videoSettings, localTime, overlayImageCache.current, true);
                  break;
           }
           ctx.globalAlpha = 1.0;
      }

      // Update Overlay State
      setCurrentOverlayData({
          slide: currentSlideData,
          nextSlide: nextSlideData,
          transProgress: transitionProgress,
          kenBurns: kenBurns,
          nextKenBurns: nextKenBurns,
          currentProgress: currentKBProgress,
          nextProgress: nextKBProgress,
          width,
          height,
          localTime
      });
  };
  
  const updateSlideImages = async (index: number, w: number, h: number) => {
      const s1 = slides[index];
      const s2 = slides[index+1];
      
      if (s1 && !isAnimSlide(s1)) {
          if (currentSlideImageRef.current) currentSlideImageRef.current.close();
          currentSlideImageRef.current = await renderSlideToImage(pdfDocRef.current, s1, w, h, videoSettings);
      }
      if (s2 && !isAnimSlide(s2)) {
          if (nextSlideImageRef.current) nextSlideImageRef.current.close();
          nextSlideImageRef.current = await renderSlideToImage(pdfDocRef.current, s2, w, h, videoSettings);
      }
  };
  
  const handleSeek = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const t = parseFloat(e.target.value);
      setCurrentTime(t);
      if (isPlayingState) {
          stopAudio();
          startTimeRef.current = performance.now() - (t * 1000);
          playAudio(t);
      } else {
          await drawFrame(t);
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm">
      <div className="flex flex-col w-full h-full max-w-5xl mx-auto p-4">
          <div className="flex justify-between items-center mb-2">
              <h3 className="text-white font-bold text-lg flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${isPlayingState ? 'bg-red-500 animate-pulse' : 'bg-slate-500'}`}></span>
                  プレビュー再生
              </h3>
              <button onClick={onClose} className="text-slate-400 hover:text-white p-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
              </button>
          </div>
          
          <div 
            className="flex-1 flex items-center justify-center bg-slate-900 rounded-lg border border-slate-800 relative overflow-hidden" 
            ref={containerRef}
          >
               {isLoading && (
                   <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/50">
                       <div className="text-emerald-500 font-bold flex items-center gap-2">
                           <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                           準備中...
                       </div>
                   </div>
               )}
               {errorMsg && (
                   <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/80">
                       <div className="text-red-400 font-bold px-4 py-2 bg-red-900/30 rounded border border-red-800">{errorMsg}</div>
                   </div>
               )}
               
               {bgAnimUrl && <img src={bgAnimUrl} alt="" className="absolute inset-0 w-full h-full object-cover z-0 opacity-100" style={{ objectFit: videoSettings.aspectRatio === '9:16' ? 'cover' : 'contain' }} />}

               <canvas ref={canvasRef} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 shadow-2xl z-1" style={{ maxWidth: '100%', maxHeight: '100%', aspectRatio: videoSettings.aspectRatio.replace(':', '/') }} />

               {currentOverlayData.width > 0 && (
                   <div 
                        className="absolute top-1/2 left-1/2"
                        style={{ 
                            width: currentOverlayData.width, 
                            height: currentOverlayData.height,
                            transform: `translate(-50%, -50%) scale(${scale})`,
                            transformOrigin: 'center center',
                            pointerEvents: 'none',
                            zIndex: 10
                        }}
                   >
                       {/* Current Slide Container - Keep fully opaque to allow proper cross-dissolve with next slide */}
                       {currentOverlayData.slide && (
                           <div style={{ 
                                position: 'absolute', 
                                inset: 0, 
                                zIndex: 10,
                                opacity: 1 
                           }}>
                               <SlideBackgroundLayer 
                                   slide={currentOverlayData.slide} 
                                   kenBurns={currentOverlayData.kenBurns} 
                                   progress={currentOverlayData.currentProgress}
                                   width={currentOverlayData.width}
                                   height={currentOverlayData.height}
                                   videoSettings={videoSettings}
                               />
                               <OverlayLayer 
                                   slide={currentOverlayData.slide} 
                                   kenBurns={currentOverlayData.kenBurns} 
                                   progress={currentOverlayData.currentProgress}
                                   width={currentOverlayData.width}
                                   height={currentOverlayData.height}
                                   videoSettings={videoSettings}
                                   currentTime={currentOverlayData.localTime}
                               />
                           </div>
                       )}
                       
                       {/* Next Slide Container - Positioned ABOVE current slide (z-index 20) with transition opacity */}
                       {currentOverlayData.nextSlide && currentOverlayData.transProgress > 0 && (
                           <div style={{ position: 'absolute', inset: 0, zIndex: 20, opacity: currentOverlayData.transProgress }}>
                               <SlideBackgroundLayer 
                                   slide={currentOverlayData.nextSlide} 
                                   kenBurns={currentOverlayData.nextKenBurns} 
                                   progress={currentOverlayData.nextProgress}
                                   width={currentOverlayData.width}
                                   height={currentOverlayData.height}
                                   videoSettings={videoSettings}
                               />
                               <OverlayLayer 
                                   slide={currentOverlayData.nextSlide} 
                                   kenBurns={currentOverlayData.nextKenBurns} 
                                   progress={currentOverlayData.nextProgress}
                                   width={currentOverlayData.width}
                                   height={currentOverlayData.height}
                                   videoSettings={videoSettings}
                                   currentTime={0}
                               />
                           </div>
                       )}
                   </div>
               )}
          </div>
          
          <div className="mt-4 bg-slate-900 rounded-xl p-4 border border-slate-800 flex items-center gap-4">
              <button 
                onClick={togglePlay}
                disabled={isLoading}
                className="w-12 h-12 rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 flex items-center justify-center text-white transition-all shadow-lg shadow-emerald-900/50"
              >
                  {isPlayingState ? (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" /></svg>
                  ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 translate-x-0.5"><path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" /></svg>
                  )}
              </button>
              
              <div className="flex-1">
                  <input 
                      type="range" 
                      min="0" 
                      max={totalDuration} 
                      step="0.1" 
                      value={currentTime}
                      onChange={handleSeek}
                      disabled={isLoading}
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500 opacity-50"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-1 font-mono">
                      <span>{Math.floor(currentTime)}s</span>
                      <span>{Math.floor(totalDuration)}s</span>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default PreviewPlayer;
