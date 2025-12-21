
import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import FileUpload from './components/FileUpload';
import ProjectManagerModal from './components/ProjectManagerModal';
import ProcessingStep from './components/ProcessingStep';
import SlideEditor from './components/SlideEditor';
import RestoreModal from './components/RestoreModal';
import CooldownNotification from './components/CooldownNotification';
import ApiKeyModal from './components/ApiKeyModal';
import { AppStatus, ProcessingState, Slide, VideoSettings, AspectRatio, TransitionType, BgmTimeRange, ApiConnectionStatus, TokenUsage, ProjectData, RequestStats, DuckingOptions } from './types';
import { analyzePdf, drawSlideFrame, generateVideoFromSlides, getKenBurnsParams, getVideoDimensions, initPdfJs, renderBackground } from './services/pdfVideoService';
import { checkApiConnection, setApiRequestListener, setApiCooldownListener } from './services/geminiService';
import { loadProject, saveProject, clearProject } from './services/projectStorage';
import { getUserApiKey, setUserApiKey, clearUserApiKey, hasStoredApiKey, hasEncryptedStored, PersistMode } from './utils/apiKeyStore';
import { getExportSupportError } from './utils/exportSupport';
import { buildThumbnailCaptureTimes, clampSeconds, formatSecondsForFilename } from './utils/thumbnailExport';

declare const pdfjsLib: any;

const LIFETIME_TOKENS_KEY = 'pdf_video_creator_lifetime_tokens';
const RPD_KEY = 'pdf_video_creator_rpd_counter';

const App: React.FC = () => {
  const [state, setState] = useState<ProcessingState>({
    status: AppStatus.IDLE
  });
  const [slides, setSlides] = useState<Slide[]>([]);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  
  // API Status & Usage State
  const [apiStatus, setApiStatus] = useState<ApiConnectionStatus>('checking');
  const [totalUsage, setTotalUsage] = useState<TokenUsage>({ totalTokens: 0 }); // Session usage
  const [lifetimeUsage, setLifetimeUsage] = useState<number>(0); // Lifetime usage
  
  // Request Stats (RPM / RPD / TPM)
  const [reqStats, setReqStats] = useState<RequestStats>({ rpm: 0, tpm: 0, rpd: 0 });
  const requestTimestampsRef = useRef<number[]>([]);
  const tokenTimestampsRef = useRef<{time: number, count: number}[]>([]);
  const completedVideoRef = useRef<HTMLVideoElement | null>(null);
  const [thumbnailDialogOpen, setThumbnailDialogOpen] = useState(false);
  const [thumbnailMode, setThumbnailMode] = useState<'single' | 'range'>('single');
  const [thumbnailSingleSeconds, setThumbnailSingleSeconds] = useState('0');
  const [thumbnailRangeStartSeconds, setThumbnailRangeStartSeconds] = useState('0');
  const [thumbnailRangeEndSeconds, setThumbnailRangeEndSeconds] = useState('0');
  const [thumbnailExporting, setThumbnailExporting] = useState(false);
  const [thumbnailProgressText, setThumbnailProgressText] = useState('');
  const [thumbnailErrorText, setThumbnailErrorText] = useState('');
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [apiKeyRemember, setApiKeyRemember] = useState<boolean>(hasStoredApiKey());
  const [apiKeyEncrypted, setApiKeyEncrypted] = useState<boolean>(hasEncryptedStored());
  const [apiKeyValue, setApiKeyValue] = useState<string>('');
  const [apiKeyMode, setApiKeyMode] = useState<PersistMode>('session');
  const [projectManagerOpen, setProjectManagerOpen] = useState(true);
  const prevStatusRef = useRef<AppStatus | null>(null);

  // Cooldown State
  const [cooldown, setCooldown] = useState({ isActive: false, remainingMs: 0, reason: '' });

  // Restore State
  const [restoreData, setRestoreData] = useState<ProjectData | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);

  // Auto-save Status
  const [saveStatus, setSaveStatus] = useState<'idle' | 'pending' | 'saving' | 'saved'>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);

  const handleAutoSaveStatus = (status: 'idle' | 'pending' | 'saving' | 'saved', time?: Date) => {
      setSaveStatus(status);
      if (time) setLastSavedTime(time);
  };

  // Initialize RPD from Local Storage
  useEffect(() => {
      const today = new Date().toLocaleDateString();
      const storedRpd = localStorage.getItem(RPD_KEY);
      let initialRpd = 0;
      
      if (storedRpd) {
          try {
              const parsed = JSON.parse(storedRpd);
              if (parsed.date === today) {
                  initialRpd = parsed.count || 0;
              } else {
                  // New day, reset
                  localStorage.setItem(RPD_KEY, JSON.stringify({ date: today, count: 0 }));
              }
          } catch (e) {
              // error parsing, reset
              localStorage.setItem(RPD_KEY, JSON.stringify({ date: today, count: 0 }));
          }
      }
      setReqStats(prev => ({ ...prev, rpd: initialRpd }));
  }, []);

  // 起動時/IDLEに戻ったときに、プロジェクト管理モーダルを開く
  useEffect(() => {
      if (state.status === AppStatus.IDLE && prevStatusRef.current !== AppStatus.IDLE) {
          setProjectManagerOpen(true);
      }
      prevStatusRef.current = state.status;
  }, [state.status]);

  // Request Tracking Logic & Cooldown Listener
  useEffect(() => {
      // Listener called whenever Gemini Service makes a request
      setApiRequestListener(() => {
          const now = Date.now();
          requestTimestampsRef.current.push(now);
          
          // Update RPD
          const today = new Date().toLocaleDateString();
          const storedRpd = localStorage.getItem(RPD_KEY);
          let currentRpd = 0;
          if (storedRpd) {
              try {
                  const parsed = JSON.parse(storedRpd);
                  if (parsed.date === today) {
                      currentRpd = parsed.count;
                  }
              } catch(e){}
          }
          const newRpd = currentRpd + 1;
          localStorage.setItem(RPD_KEY, JSON.stringify({ date: today, count: newRpd }));
          
          // Trigger immediate state update for responsiveness
          updateStats();
      });

      // Listener called when cooldown occurs
      setApiCooldownListener((isActive, remainingMs, reason) => {
          setCooldown({ isActive, remainingMs, reason: reason || '' });
      });

      // Periodic cleanup and update for RPM/TPM decay
      const interval = setInterval(() => {
          updateStats();
      }, 1000);

      const updateStats = () => {
          const now = Date.now();
          const windowStart = now - 60000; // 1 minute ago
          
          // RPM
          requestTimestampsRef.current = requestTimestampsRef.current.filter(t => t > windowStart);
          const rpm = requestTimestampsRef.current.length;
          
          // TPM
          tokenTimestampsRef.current = tokenTimestampsRef.current.filter(t => t.time > windowStart);
          const tpm = tokenTimestampsRef.current.reduce((acc, curr) => acc + curr.count, 0);

          // Get latest RPD
          let rpd = 0;
          const stored = localStorage.getItem(RPD_KEY);
          if (stored) {
              try { rpd = JSON.parse(stored).count; } catch(e){}
          }

          setReqStats({ rpm, tpm, rpd });
      };

      return () => clearInterval(interval);
  }, []);

  // Initial Connection Check & Restore Check & Load Lifetime Usage
  useEffect(() => {
      const init = async () => {
          // load stored key into memory
          try {
              const stored = await getUserApiKey();
              if (stored) {
                  setApiKeyValue(stored);
                  setApiKeyRemember(hasStoredApiKey());
                  setApiKeyEncrypted(hasEncryptedStored());
                  setApiStatus('checking');
                  const ok = await checkApiConnection();
                  setApiStatus(ok ? 'connected' : 'error');
              }
          } catch {
              // passphrase required or failed
              setApiKeyValue('');
              setApiStatus('error');
          }

          setApiStatus('checking');
          const isConnected = await checkApiConnection();
          setApiStatus(isConnected ? 'connected' : 'error');

          // Load Lifetime Usage
          const storedLifetime = localStorage.getItem(LIFETIME_TOKENS_KEY);
          let initialLifetime = 0;
          
          if (storedLifetime) {
              const parsed = parseInt(storedLifetime, 10);
              if (!isNaN(parsed)) {
                  initialLifetime = parsed;
              }
          }

          if (initialLifetime === 0 && totalUsage.totalTokens > 0) {
              initialLifetime = totalUsage.totalTokens;
              localStorage.setItem(LIFETIME_TOKENS_KEY, initialLifetime.toString());
          }

          setLifetimeUsage(initialLifetime);

          // Check for saved project
          const saved = await loadProject();
          if (saved && saved.slides.length > 0) {
              setRestoreData(saved);
              setShowRestoreModal(true);
          }
      };
      init();
  }, []); // Run only on mount

  const handleUsageUpdate = (usage: TokenUsage) => {
      // Record for TPM Tracking
      const now = Date.now();
      tokenTimestampsRef.current.push({ time: now, count: usage.totalTokens });

      // Update Session Usage
      setTotalUsage(prev => ({
          totalTokens: prev.totalTokens + usage.totalTokens
      }));
      
      // Update Lifetime Usage
      setLifetimeUsage(prev => {
          const newValue = prev + usage.totalTokens;
          localStorage.setItem(LIFETIME_TOKENS_KEY, newValue.toString());
          return newValue;
      });
  };

  const handleRestore = () => {
      if (restoreData) {
          setSlides(restoreData.slides);
          setSourceFile(restoreData.sourceFile);
          setState({
              status: AppStatus.EDITING, // Restore to editing state
              settings: restoreData.videoSettings,
              bgmFile: restoreData.bgmFile,
              bgmTimeRange: restoreData.bgmTimeRange,
              bgmVolume: restoreData.bgmVolume,
              globalAudioFile: restoreData.globalAudioFile,
              globalAudioVolume: restoreData.globalAudioVolume,
              fadeOptions: restoreData.fadeOptions,
              duckingOptions: restoreData.duckingOptions,
          });
          setSaveStatus('saved');
          setLastSavedTime(new Date(restoreData.updatedAt));
      }
      setShowRestoreModal(false);
      setRestoreData(null);
  };
  
  const handleProjectLoad = (data: ProjectData) => {
      setSlides(data.slides);
      setSourceFile(data.sourceFile);
      setState({
          status: AppStatus.EDITING,
          settings: data.videoSettings,
          bgmFile: data.bgmFile,
          bgmTimeRange: data.bgmTimeRange,
          bgmVolume: data.bgmVolume,
          globalAudioFile: data.globalAudioFile,
          globalAudioVolume: data.globalAudioVolume,
          fadeOptions: data.fadeOptions,
          duckingOptions: data.duckingOptions,
      });
      setSaveStatus('saved');
      setLastSavedTime(new Date(data.updatedAt));
  };

  const handleDiscard = async () => {
      await clearProject();
      setShowRestoreModal(false);
      setRestoreData(null);
  };

  // Step 1: Upload & Analyze
  const handleFileSelect = async (file: File, duration: number, transitionType: TransitionType, autoGenerateScript: boolean, customScriptPrompt?: string) => {
    try {
      setSourceFile(file);
      
      setState({ 
        status: AppStatus.ANALYZING, 
        message: 'PDFを解析中...',
        progress: { current: 0, total: 0 }
      });
      
      const analyzedSlides = await analyzePdf(
        file, 
        duration,
        transitionType, // ユーザーの初期設定を各スライドに適用
        (current, total) => {
          setState(prev => ({
            ...prev,
            progress: { current, total }
          }));
        },
        autoGenerateScript,
        handleUsageUpdate, // Pass usage callback
        customScriptPrompt // Pass custom prompt
      );

      setSlides(analyzedSlides);
      setState({ status: AppStatus.EDITING, progress: undefined });

    } catch (error: any) {
      console.error(error);
      setState({ 
        status: AppStatus.ERROR, 
        error: error.message || "予期せぬエラーが発生しました。"
      });
    }
  };

  // Step 2: Edit Slides (Handled by SlideEditor component updating `slides` state)

  // Step 3: Generate Video
	  const handleStartConversion = async (
	    bgmFile: File | null, 
	    fadeOptions: { fadeIn: boolean, fadeOut: boolean },
	    videoSettings: VideoSettings,
	    bgmTimeRange?: BgmTimeRange,
	    bgmVolume: number = 1.0,
	    globalAudioFile: File | null = null,
	    globalAudioVolume: number = 1.0,
	    duckingOptions?: DuckingOptions
	  ) => {
    if (!sourceFile && slides.every(s => s.customImageFile)) {
       // All custom images, no source file needed technically but kept for structure
    } else if (!sourceFile && slides.length === 0) {
        return;
	    }
	
	    try {
	      const requiresAudio = !!bgmFile || !!globalAudioFile || slides.some(s => s.audioFile);
	      const supportError = getExportSupportError(
	        typeof window === 'undefined' ? null : window,
	        { requireAudio: requiresAudio }
	      );
	      if (supportError) {
	        alert(supportError);
	        return;
	      }
	
	      setState({ 
	        status: AppStatus.CONVERTING, 
	        message: '動画を作成中...',
        progress: { current: 0, total: slides.length }
      });
      
      const result = await generateVideoFromSlides(
        sourceFile!, // Can be null if using only images, handled in service
        slides,
        bgmFile,
        fadeOptions,
        videoSettings,
        bgmTimeRange,
        bgmVolume,
        globalAudioFile,
        globalAudioVolume,
	        (current, total) => {
	          setState(prev => ({
	            ...prev,
	            progress: { current, total }
	          }));
	        },
	        duckingOptions
	      );

      setState({ 
        status: AppStatus.COMPLETED, 
        videoUrl: result.url,
        extension: result.extension,
        settings: videoSettings,
        bgmFile: bgmFile,
        bgmTimeRange: bgmTimeRange,
        bgmVolume: bgmVolume,
        globalAudioFile: globalAudioFile,
        globalAudioVolume: globalAudioVolume,
        fadeOptions: fadeOptions,
        duckingOptions: duckingOptions,
        progress: undefined
      });

    } catch (error: any) {
      console.error(error);
      setState({ 
        status: AppStatus.ERROR, 
        error: error.message || "動画生成中にエラーが発生しました。"
      });
    }
  };

  const handleReset = async () => {
    await clearProject(); // Clear Saved Data
    setState({ status: AppStatus.IDLE });
    setSlides([]);
    setSourceFile(null);
    setSaveStatus('idle');
    setLastSavedTime(null);
  };
  
  const handleBackToEdit = () => {
    setState(prev => ({
      ...prev,
      status: AppStatus.EDITING,
      videoUrl: undefined, // 動画URLはクリアするが、settingsなどは保持
      error: undefined,
    }));
  };

  const openThumbnailDialog = () => {
    const video = completedVideoRef.current;
    const current = video?.currentTime ?? 0;
    const duration = video && Number.isFinite(video.duration) ? video.duration : 0;

    setThumbnailMode('single');
    setThumbnailSingleSeconds(String(Math.round(current * 10) / 10));
    setThumbnailRangeStartSeconds('0');
    setThumbnailRangeEndSeconds(String(Math.round(Math.min(duration || 0, 10) * 10) / 10));
    setThumbnailErrorText('');
    setThumbnailProgressText('');
    setThumbnailDialogOpen(true);
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadVideo = () => {
    if (!state.videoUrl) return;
    const extension = state.extension || 'mp4';
    const a = document.createElement('a');
    a.href = state.videoUrl;
    a.download = `slideshow.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const isTaintedCanvasError = (e: any) => {
    const message = String(e?.message || '');
    return (
      e?.name === 'SecurityError' ||
      message.includes('Tainted canvases') ||
      message.toLowerCase().includes('tainted')
    );
  };

  const isSeekError = (e: any) => {
    const message = String(e?.message || '');
    return message.includes('シーク') || message.toLowerCase().includes('seek');
  };

		  const getSlideIndexAtSeconds = (seconds: number) => {
		    if (slides.length === 0) return -1;
		    let cursor = 0;
		    for (let i = 0; i < slides.length; i++) {
	      const d = Number(slides[i].duration) || 0;
	      if (seconds < cursor + d) return i;
	      cursor += d;
	    }
	    return slides.length - 1;
	  };

	  const getSlideAtSeconds = (seconds: number) => {
	    if (slides.length === 0) return { index: -1, offset: 0 };
	    let cursor = 0;
	    for (let i = 0; i < slides.length; i++) {
	      const d = Number(slides[i].duration) || 0;
	      const isLast = i === slides.length - 1;
	      if (seconds < cursor + d || isLast) {
	        const rawOffset = Math.max(0, seconds - cursor);
	        const offset = d > 0 ? Math.min(d, rawOffset) : 0;
	        return { index: i, offset };
	      }
	      cursor += d;
	    }
	    return { index: slides.length - 1, offset: 0 };
	  };

	  const decodeDataUrlToBytes = (dataUrl: string) => {
	    const match = dataUrl.match(/^data:([^;,]+)(;base64)?,(.*)$/);
	    if (!match) throw new Error('画像データが読み取れなかったよ。');

    const mimeType = match[1] || 'application/octet-stream';
    const isBase64 = !!match[2];
    const data = match[3] || '';

    if (isBase64) {
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return { mimeType, bytes };
    }

    const text = decodeURIComponent(data);
    const bytes = new TextEncoder().encode(text);
    return { mimeType, bytes };
  };

  const mimeTypeToExtension = (mimeType: string) => {
    if (mimeType === 'image/jpeg') return 'jpg';
    if (mimeType === 'image/png') return 'png';
    if (mimeType === 'image/gif') return 'gif';
    if (mimeType === 'image/webp') return 'webp';
    if (mimeType === 'image/svg+xml') return 'svg';
    const m = mimeType.match(/\/([a-z0-9.+-]+)$/i)?.[1];
    return (m || 'bin').replace('jpeg', 'jpg').replace('+xml', '');
  };

	  const createThumbnailFilesFromSlides = (times: number[]) => {
	    const files: Record<string, Uint8Array> = {};
	    for (let i = 0; i < times.length; i++) {
	      const t = times[i];
	      const slideIndex = getSlideIndexAtSeconds(t);
	      if (slideIndex < 0) throw new Error('スライドが無いみたい。');
	      const slide = slides[slideIndex];
	      const { mimeType, bytes } = decodeDataUrlToBytes(slide.thumbnailUrl);
	      const ext = mimeTypeToExtension(mimeType);
	      files[`thumbnail_${String(i + 1).padStart(2, '0')}_slide${String(slideIndex + 1).padStart(2, '0')}_${formatSecondsForFilename(t)}s.${ext}`] = bytes;
	    }
	    return files;
	  };

	  const getEffectiveVideoSettings = (): VideoSettings => {
	    return (
	      state.settings || {
	        aspectRatio: '16:9',
	        resolution: '1080p',
	        format: 'mp4',
	        backgroundFill: 'black',
	        slideScale: 100,
	        slideBorderRadius: 0,
	        transitionDuration: 0.5,
	      }
	    );
	  };

	  const getThumbnailOutputSize = (video: HTMLVideoElement) => {
	    const w = video.videoWidth;
	    const h = video.videoHeight;
	    if (w && h) return { width: w, height: h };
	    const s = getEffectiveVideoSettings();
	    return getVideoDimensions(s.aspectRatio, s.resolution);
	  };

	  const loadPdfDocumentForThumbnails = async () => {
	    if (!sourceFile) return null;
	    if (!slides.some((s) => s.pageIndex > 0)) return null;
	    initPdfJs();
	    if (typeof pdfjsLib === 'undefined') return null;
	    const arrayBuffer = await sourceFile.arrayBuffer();
	    return await pdfjsLib.getDocument(arrayBuffer).promise;
	  };

	  const loadBackgroundBitmapForThumbnails = async (settings: VideoSettings) => {
	    if (settings.backgroundFill !== 'custom_image') return null;
	    if (!settings.backgroundImageFile) return null;
	    try {
	      return await createImageBitmap(settings.backgroundImageFile);
	    } catch (_) {
	      return null;
	    }
	  };

	  const renderSlideBitmapForThumbnailExport = async (pdfDoc: any | null, slide: Slide, width: number, height: number) => {
	    if (slide.customImageFile) {
	      return await createImageBitmap(slide.customImageFile);
	    }
	    if (slide.backgroundColor) {
	      const canvas = document.createElement('canvas');
	      canvas.width = width;
	      canvas.height = height;
	      const ctx = canvas.getContext('2d');
	      if (!ctx) throw new Error('スライドが作れなかったよ。');
	      ctx.fillStyle = slide.backgroundColor;
	      ctx.fillRect(0, 0, width, height);
	      return await createImageBitmap(canvas);
	    }
	    if (pdfDoc && slide.pageIndex > 0) {
	      const page = await pdfDoc.getPage(slide.pageIndex);
	      const cropW = Math.max(1, Number(slide.crop?.width) || 1);
	      const cropH = Math.max(1, Number(slide.crop?.height) || 1);
	      const scale = Math.min(3.0, width / cropW);
	      const viewport = page.getViewport({ scale });
	      const canvas = document.createElement('canvas');
	      canvas.width = cropW * scale;
	      canvas.height = cropH * scale;
	      const ctx = canvas.getContext('2d');
	      if (!ctx) throw new Error('スライドが作れなかったよ。');
	      ctx.fillStyle = '#ffffff';
	      ctx.fillRect(0, 0, canvas.width, canvas.height);
	      const renderContext = {
	        canvasContext: ctx,
	        viewport,
	        transform: [1, 0, 0, 1, -(slide.crop?.x || 0) * scale, -(slide.crop?.y || 0) * scale],
	      };
	      await page.render(renderContext).promise;
	      return await createImageBitmap(canvas);
	    }
	    throw new Error('スライドが作れなかったよ。');
	  };

	  const renderPngBlobFromSlideSources = async (
	    pdfDoc: any | null,
	    bgBitmap: ImageBitmap | null,
	    seconds: number,
	    width: number,
	    height: number,
	    settings: VideoSettings
	  ) => {
	    const { index, offset } = getSlideAtSeconds(seconds);
	    if (index < 0) throw new Error('スライドが無いみたい。');
	    const slide = slides[index];

	    const canvas = document.createElement('canvas');
	    canvas.width = width;
	    canvas.height = height;
	    const ctx = canvas.getContext('2d');
	    if (!ctx) throw new Error('サムネ画像を作れなかったよ。');

	    const fill = settings.backgroundFill === 'white' ? '#ffffff' : '#000000';
	    renderBackground(ctx, width, height, fill, bgBitmap);

	    const slideBitmap = await renderSlideBitmapForThumbnailExport(pdfDoc, slide, width, height);
	    const progress = slide.duration > 0 ? Math.min(1, Math.max(0, offset / slide.duration)) : 0;
	    const kenBurns = slide.effectType === 'kenburns' ? getKenBurnsParams(slide.id) : null;
	    await drawSlideFrame(ctx, slideBitmap, width, height, slide.effectType, kenBurns, progress, slide, settings, offset);
	    try { slideBitmap.close?.(); } catch (_) {}

	    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
	    if (!blob) throw new Error('サムネ画像を作れなかったよ。');
	    return { blob, slideIndex: index };
	  };

	  const createHighResThumbnailFilesFromSlides = async (times: number[], width: number, height: number, settings: VideoSettings) => {
	    let pdfDoc: any | null = null;
	    let bgBitmap: ImageBitmap | null = null;
	    try {
	      pdfDoc = await loadPdfDocumentForThumbnails();
	      bgBitmap = await loadBackgroundBitmapForThumbnails(settings);
	      const files: Record<string, Uint8Array> = {};
	      for (let i = 0; i < times.length; i++) {
	        const t = times[i];
	        setThumbnailProgressText(`${i + 1}/${times.length} 枚目を作ってるよ…`);
	        const { blob, slideIndex } = await renderPngBlobFromSlideSources(pdfDoc, bgBitmap, t, width, height, settings);
	        const buf = await blob.arrayBuffer();
	        files[`thumbnail_${String(i + 1).padStart(2, '0')}_slide${String(slideIndex + 1).padStart(2, '0')}_${formatSecondsForFilename(t)}s.png`] = new Uint8Array(buf);
	      }
	      return files;
	    } catch (e) {
	      console.error(e);
	      return createThumbnailFilesFromSlides(times);
	    } finally {
	      try { bgBitmap?.close?.(); } catch (_) {}
	      try { pdfDoc?.destroy?.(); } catch (_) {}
	    }
	  };

		  const seekVideoToSeconds = (video: HTMLVideoElement, seconds: number) => {
		    const duration = Number.isFinite(video.duration) ? video.duration : 0;
		    const epsilon = 0.05;
		    const target = duration > 0 ? Math.min(Math.max(0, seconds), Math.max(0, duration - epsilon)) : seconds;
		    if (Math.abs(video.currentTime - target) < 0.01) return Promise.resolve();

	    return new Promise<void>((resolve, reject) => {
	      const timeoutId = window.setTimeout(() => {
        cleanup();
        reject(new Error('シークがタイムアウトしたよ。'));
      }, 8000);

      const cleanup = () => {
        window.clearTimeout(timeoutId);
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('error', onError);
      };

      const onSeeked = () => {
        cleanup();
        resolve();
      };

      const onError = () => {
        cleanup();
        reject(new Error('シークに失敗したよ。'));
      };

      video.addEventListener('seeked', onSeeked);
      video.addEventListener('error', onError);
      video.currentTime = target;
    });
  };

  const capturePngBlobFromVideo = async (video: HTMLVideoElement) => {
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) throw new Error('プレビューの読み込みが終わってから押してね。');

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('サムネ画像を作れなかったよ。');

    ctx.drawImage(video, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('サムネ画像を作れなかったよ。');
    return blob;
  };

  const handleConfirmThumbnailExport = async () => {
    try {
      const video = completedVideoRef.current;
      if (!video) return;
      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        throw new Error('動画の長さが取れないよ。プレビューが出てから押してね。');
      }

      setThumbnailExporting(true);
      setThumbnailErrorText('');
      setThumbnailProgressText('');

      if (thumbnailMode === 'single') {
        const raw = Number(thumbnailSingleSeconds);
        if (!Number.isFinite(raw)) throw new Error('秒数を入れてね。');
        const t = clampSeconds(raw, video.duration);

        const slideIndex = getSlideIndexAtSeconds(t);
        setThumbnailProgressText('1枚作ってるよ…');
        try {
          const wasPaused = video.paused;
          const restoreTime = video.currentTime;
          video.pause();

          await seekVideoToSeconds(video, t);
          const blob = await capturePngBlobFromVideo(video);
          downloadBlob(blob, `thumbnail_${formatSecondsForFilename(t)}s.png`);

          await seekVideoToSeconds(video, restoreTime);
          if (!wasPaused) {
            try { await video.play(); } catch (_) {}
          }
	        } catch (e: any) {
	          if (!isTaintedCanvasError(e) && !isSeekError(e)) throw e;
	          if (slideIndex < 0) throw new Error('サムネ画像が作れなかったよ。');
	          setThumbnailProgressText(
	            isTaintedCanvasError(e)
	              ? '安全の都合で、高画質で作ってるよ…'
	              : '動画のジャンプが重いから、高画質で作ってるよ…'
	          );
	          const settings = getEffectiveVideoSettings();
	          const { width, height } = getThumbnailOutputSize(video);
	          let pdfDoc: any | null = null;
	          let bgBitmap: ImageBitmap | null = null;
	          try {
	            pdfDoc = await loadPdfDocumentForThumbnails();
	            bgBitmap = await loadBackgroundBitmapForThumbnails(settings);
	            const { blob } = await renderPngBlobFromSlideSources(pdfDoc, bgBitmap, t, width, height, settings);
	            downloadBlob(blob, `thumbnail_${formatSecondsForFilename(t)}s.png`);
	          } catch (fallbackError) {
	            console.error(fallbackError);
	            const slide = slides[slideIndex];
	            const { mimeType, bytes } = decodeDataUrlToBytes(slide.thumbnailUrl);
	            const ext = mimeTypeToExtension(mimeType);
	            downloadBlob(new Blob([bytes], { type: mimeType }), `thumbnail_slide${String(slideIndex + 1).padStart(2, '0')}_${formatSecondsForFilename(t)}s.${ext}`);
	          } finally {
	            try { bgBitmap?.close?.(); } catch (_) {}
	            try { pdfDoc?.destroy?.(); } catch (_) {}
	          }
	        }
	      } else {
	        const rawStart = Number(thumbnailRangeStartSeconds);
	        const rawEnd = Number(thumbnailRangeEndSeconds);
        if (!Number.isFinite(rawStart) || !Number.isFinite(rawEnd)) throw new Error('開始と終了の秒数を入れてね。');
        if (rawStart > rawEnd) throw new Error('開始秒は終了秒より小さくしてね。');
        const times = buildThumbnailCaptureTimes(rawStart, rawEnd, video.duration, 20);
        const start = times[0];
        const end = times[times.length - 1];

        let useSlideFallback = false;
        const files: Record<string, Uint8Array> = {};

        try {
          const wasPaused = video.paused;
          const restoreTime = video.currentTime;
          video.pause();

          for (let i = 0; i < times.length; i++) {
            const t = times[i];
            setThumbnailProgressText(`${i + 1}/${times.length} 枚目を作ってるよ…`);
            await seekVideoToSeconds(video, t);
            const blob = await capturePngBlobFromVideo(video);
            const buf = await blob.arrayBuffer();
            files[`thumbnail_${String(i + 1).padStart(2, '0')}_${formatSecondsForFilename(t)}s.png`] = new Uint8Array(buf);
          }

          await seekVideoToSeconds(video, restoreTime);
          if (!wasPaused) {
            try { await video.play(); } catch (_) {}
          }
	        } catch (e: any) {
	          if (!isTaintedCanvasError(e) && !isSeekError(e)) throw e;
	          useSlideFallback = true;
	        }

	        const settings = getEffectiveVideoSettings();
	        const { width, height } = getThumbnailOutputSize(video);
	        const finalFiles = useSlideFallback ? await createHighResThumbnailFilesFromSlides(times, width, height, settings) : files;

	        setThumbnailProgressText(useSlideFallback ? '高画質サムネをZIPにまとめてるよ…' : 'ZIPにまとめてるよ…');
	        const fflateUrl = 'https://cdn.jsdelivr.net/npm/fflate@0.8.2/+esm';
	        const fflate = (await import(/* @vite-ignore */ fflateUrl)) as any;
	        const zipped = fflate.zipSync(finalFiles, { level: 0 });
	        const zipBlob = new Blob([zipped], { type: 'application/zip' });
        downloadBlob(zipBlob, `thumbnails_${formatSecondsForFilename(start)}s-${formatSecondsForFilename(end)}s.zip`);
      }

      setThumbnailDialogOpen(false);
    } catch (e: any) {
      console.error(e);
      setThumbnailErrorText(e?.message || 'サムネ画像の書き出しに失敗しました。');
    } finally {
      setThumbnailExporting(false);
      setThumbnailProgressText('');
    }
  };

  // アスペクト比に応じたプレイヤースタイルを計算
  const getPlayerStyle = (ratio: AspectRatio | undefined) => {
    switch (ratio) {
      case '16:9':
        return { aspectRatio: '16/9', maxWidth: '100%' };
      case '4:3':
        return { aspectRatio: '4/3', maxWidth: '900px' };
      case '1:1':
        return { aspectRatio: '1/1', maxWidth: '600px' };
      case '9:16':
        return { aspectRatio: '9/16', maxWidth: '400px' };
      default:
        return { aspectRatio: '16/9', maxWidth: '100%' };
    }
  };

	  const isEditing = state.status === AppStatus.EDITING;
	  const isIdle = state.status === AppStatus.IDLE;
	  const aiEnabled = apiStatus === 'connected';

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${isIdle ? 'screen-idle' : 'bg-gradient-to-b from-slate-900 via-slate-900 to-emerald-950/20 text-slate-200 selection:bg-emerald-500/30'}`}>
      
      {/* Mobile Landscape Warning: 500px以下の高さかつ横画面の場合に表示 */}
      <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col items-center justify-center p-8 text-center hidden [@media(max-height:500px)_and_(orientation:landscape)]:flex h-screen w-screen touch-none">
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-2xl max-w-sm flex flex-col items-center">
              <div className="text-4xl mb-4 animate-bounce">📱↻</div>
              <h2 className="text-xl font-bold text-white mb-2">画面を縦にしてください</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                  このアプリはモバイルの横画面表示には対応していません。<br/>
                  端末を縦向きにしてご利用ください。
              </p>
          </div>
      </div>

      <Header 
        apiStatus={apiStatus} 
        tokenUsage={totalUsage} 
        lifetimeUsage={lifetimeUsage}
        requestStats={reqStats}
        saveStatus={saveStatus}
        lastSavedTime={lastSavedTime}
        hasApiKey={!!apiKeyValue}
        onOpenApiKey={() => setApiKeyModalOpen(true)}
      />

	      <ApiKeyModal
	        open={apiKeyModalOpen}
	        initialKey={apiKeyValue}
	        initialRemember={apiKeyRemember}
        onClose={() => setApiKeyModalOpen(false)}
        onClear={() => {
          if (window.confirm('保存されたAPIキーを削除しますか？')) {
            clearUserApiKey();
            setApiKeyValue('');
            setApiKeyRemember(false);
            setApiKeyEncrypted(false);
            setApiStatus('error');
            setApiKeyModalOpen(false);
          }
        }}
        onSave={async (key, { remember, mode, passphrase }) => {
          try {
            await setUserApiKey(key, { mode, passphrase });
            const plain = await getUserApiKey(passphrase); // ensure decryptable
            setApiKeyValue(plain || '');
            setApiKeyRemember(mode === 'local');
            setApiKeyEncrypted(!!passphrase);
            setApiKeyMode(mode);
            setApiStatus('checking');
            setApiKeyModalOpen(false);
            const ok = await checkApiConnection();
            setApiStatus(ok ? 'connected' : 'error');
          } catch (e) {
            console.error(e);
            setApiStatus('error');
          }
	        }}
	      />

        <ProjectManagerModal
          isOpen={projectManagerOpen}
          onClose={() => setProjectManagerOpen(false)}
          onLoadProject={(data) => {
            setProjectManagerOpen(false);
            handleProjectLoad(data);
          }}
        />

	      {thumbnailDialogOpen && (
	        <div className="fixed inset-0 z-[9998] bg-black/60 flex items-center justify-center p-4">
	          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl">
	            <div className="flex items-center justify-between mb-3">
	              <h3 className="text-lg font-bold text-white">サムネ画像を書き出す</h3>
	              <button
	                onClick={() => setThumbnailDialogOpen(false)}
	                disabled={thumbnailExporting}
	                className="text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
	                aria-label="閉じる"
	              >
	                ×
	              </button>
	            </div>

	            <div className="space-y-3">
	              <div className="flex gap-2">
	                <button
	                  onClick={() => setThumbnailMode('single')}
	                  disabled={thumbnailExporting}
	                  className={`flex-1 px-3 py-2 text-sm rounded border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
	                    thumbnailMode === 'single'
	                      ? 'bg-emerald-600 text-white border-emerald-500/40'
	                      : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
	                  }`}
	                >
	                  1枚
	                </button>
	                <button
	                  onClick={() => setThumbnailMode('range')}
	                  disabled={thumbnailExporting}
	                  className={`flex-1 px-3 py-2 text-sm rounded border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
	                    thumbnailMode === 'range'
	                      ? 'bg-emerald-600 text-white border-emerald-500/40'
	                      : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
	                  }`}
	                >
	                  ZIP（最大20枚）
	                </button>
	              </div>

	              {thumbnailMode === 'single' ? (
	                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 space-y-2">
	                  <label className="text-xs text-slate-300 block">時間（秒）</label>
	                  <input
	                    type="number"
	                    min="0"
	                    step="0.1"
	                    value={thumbnailSingleSeconds}
	                    onChange={(e) => setThumbnailSingleSeconds(e.target.value)}
	                    disabled={thumbnailExporting}
	                    className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 disabled:opacity-50"
	                  />
	                  <div className="text-[11px] text-slate-400">例: 12.3</div>
	                </div>
	              ) : (
	                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 space-y-2">
	                  <label className="text-xs text-slate-300 block">範囲（秒）</label>
	                  <div className="flex items-center gap-2">
	                    <input
	                      type="number"
	                      min="0"
	                      step="0.1"
	                      value={thumbnailRangeStartSeconds}
	                      onChange={(e) => setThumbnailRangeStartSeconds(e.target.value)}
	                      disabled={thumbnailExporting}
	                      className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 disabled:opacity-50"
	                      placeholder="開始"
	                    />
	                    <span className="text-slate-400">〜</span>
	                    <input
	                      type="number"
	                      min="0"
	                      step="0.1"
	                      value={thumbnailRangeEndSeconds}
	                      onChange={(e) => setThumbnailRangeEndSeconds(e.target.value)}
	                      disabled={thumbnailExporting}
	                      className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 disabled:opacity-50"
	                      placeholder="終了"
	                    />
	                  </div>
	                  <div className="text-[11px] text-slate-400">この範囲を最大20枚でZIPにまとめるよ。</div>
	                </div>
	              )}

	              {thumbnailErrorText && (
	                <div className="text-sm text-red-200 bg-red-900/20 border border-red-800/40 rounded-xl p-3">
	                  {thumbnailErrorText}
	                </div>
	              )}

	              {thumbnailProgressText && (
	                <div className="text-xs text-slate-400">{thumbnailProgressText}</div>
	              )}
	            </div>

	            <div className="mt-4 flex gap-3 justify-end">
	              <button
	                onClick={() => setThumbnailDialogOpen(false)}
	                disabled={thumbnailExporting}
	                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
	              >
	                キャンセル
	              </button>
	              <button
	                onClick={handleConfirmThumbnailExport}
	                disabled={thumbnailExporting}
	                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg border border-emerald-500/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
	              >
	                {thumbnailMode === 'single' ? '1枚ダウンロード' : 'ZIPでダウンロード'}
	              </button>
	            </div>
	          </div>
	        </div>
	      )}
	      
	      {/* Global Notification */}
	      <CooldownNotification 
	          isActive={cooldown.isActive}
          remainingMs={cooldown.remainingMs}
          reason={cooldown.reason}
      />
      
      {/* Main Content Area */}
      <main className={`flex-1 relative w-full flex flex-col ${isEditing ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        
        {/* Restore Modal */}
        <RestoreModal 
            isOpen={showRestoreModal}
            onRestore={handleRestore}
            onDiscard={handleDiscard}
            lastUpdated={restoreData?.updatedAt || 0}
        />

        {/* Editor View */}
        {state.status === AppStatus.EDITING ? (
            <div className="flex-1 w-full h-full p-3 sm:p-4 lg:p-6 overflow-hidden flex flex-col">
		                    <SlideEditor
		                    aiEnabled={aiEnabled}
		                    slides={slides} 
		                    onUpdateSlides={setSlides} 
	                    onStartConversion={handleStartConversion}
	                    isProcessing={false}
	                    sourceFile={sourceFile}
	                    initialSettings={state.settings}
	                    initialBgmFile={state.bgmFile}
	                    initialFadeOptions={state.fadeOptions}
	                    initialBgmTimeRange={state.bgmTimeRange}
	                    initialBgmVolume={state.bgmVolume}
	                    initialGlobalAudioFile={state.globalAudioFile}
	                    initialGlobalAudioVolume={state.globalAudioVolume}
	                    initialDuckingOptions={state.duckingOptions}
	                    onUsageUpdate={handleUsageUpdate}
	                    onLoadProject={handleProjectLoad}
                      onOpenProjectManager={() => setProjectManagerOpen(true)}
	                    onAutoSave={handleAutoSaveStatus}
	                />
            </div>
        ) : (
            // Non-Editor Views (Landing, Processing, Result)
            <div className={`w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 items-center pb-24 flex flex-col ${isIdle ? 'idle-surface' : ''}`}>
                {/* Hero Section */}
                {state.status === AppStatus.IDLE && (
                <div className="text-center max-w-3xl mx-auto mb-8 space-y-4 animate-fade-in-up px-2">
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white drop-shadow-sm leading-tight">
                    PDF資料を<br className="sm:hidden" />
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-sky-500">
                        動画ファイル
                    </span>
                    に変換
                    </h2>
                </div>
                )}

                {/* Upload Area */}
                {state.status === AppStatus.IDLE && (
                  <div className="w-full max-w-2xl mx-auto mb-4 flex flex-col items-center gap-2 px-2 sm:px-0">
                    <button
                      onClick={() => setProjectManagerOpen(true)}
                      className="px-4 py-2 rounded-lg transition-colors idle-btn-glass"
                    >
                      プロジェクト管理を開く
                    </button>
                  </div>
                )}
                {state.status === AppStatus.IDLE && (
	                <FileUpload onFileSelect={handleFileSelect} status={state.status} aiEnabled={aiEnabled} />
	                )}

                {/* Processing Status (Analysis or Conversion) */}
                {(state.status === AppStatus.ANALYZING || state.status === AppStatus.CONVERTING) && (
                <ProcessingStep currentStatus={state.status} progress={state.progress} />
                )}

                {/* Error Display */}
                {state.status === AppStatus.ERROR && (
                <div className="mt-10 p-6 bg-red-900/20 border border-red-800 text-red-200 rounded-xl max-w-3xl text-center mx-4 animate-fade-in">
                    <div className="flex justify-center mb-4 text-red-400">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10">
                        <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                    </svg>
                    </div>
                    <h3 className="text-lg font-bold mb-4">エラーが発生しました</h3>
                    <div className="mb-6 break-words whitespace-pre-wrap text-left bg-black/20 p-4 rounded-lg text-sm leading-relaxed font-medium border border-red-500/20">
                    {state.error}
                    </div>
                    <div className="flex gap-4 justify-center">
                        <button 
                        onClick={handleBackToEdit}
                        className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors border border-slate-600 shadow-sm"
                        >
                        編集画面に戻る
                        </button>
                    </div>
                </div>
                )}

                {/* Result Display */}
                {state.status === AppStatus.COMPLETED && state.videoUrl && (
                <div className="mt-8 w-full flex flex-col items-center animate-fade-in space-y-6 px-2">
	                    <div 
	                    className="bg-slate-800/40 backdrop-blur rounded-3xl border border-slate-700 p-2 shadow-2xl shadow-emerald-500/10 w-full flex justify-center"
	                    style={{ maxWidth: 'fit-content' }}
	                    >
	                        <video 
	                        ref={completedVideoRef}
	                        src={state.videoUrl} 
	                        controls 
	                        autoPlay 
	                        className="rounded-2xl bg-black shadow-lg max-h-[70vh]"
	                        style={getPlayerStyle(state.settings?.aspectRatio)}
	                        />
	                    </div>
	                    
	                    <div className="flex flex-col items-center justify-center gap-4 pt-4 max-w-2xl text-center w-full">
	                    <div className="text-sm text-slate-400 bg-slate-800/50 px-4 py-2 rounded-lg w-full sm:w-auto">
                        ヒント: ダウンロードしたファイル({state.extension})がQuickTimeで再生できない場合は、VLC Playerやブラウザで開いてください。
                    </div>
	                    
				                    <div className="flex flex-col sm:flex-row sm:flex-nowrap gap-3 w-full sm:w-auto justify-center">
				                        <button 
				                        onClick={downloadVideo}
				                        className="flex items-center justify-center gap-2 px-5 py-3 bg-amber-500 hover:bg-amber-400 text-white rounded-2xl text-sm font-semibold transition-all shadow-lg shadow-amber-500/20 w-full sm:w-auto sm:shrink-0 whitespace-nowrap"
				                        >
				                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
				                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M12 3v12m0 0l-3.75-3.75M12 15l3.75-3.75" />
				                        </svg>
				                        動画ダウンロード
				                        </button>

				                        <button 
				                        onClick={openThumbnailDialog}
				                        className="flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-sm font-semibold transition-all shadow-lg shadow-emerald-600/20 w-full sm:w-auto sm:shrink-0 whitespace-nowrap"
				                        >
			                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
			                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 4.5h10.5A2.25 2.25 0 0119.5 6.75v10.5A2.25 2.25 0 0117.25 19.5H6.75A2.25 2.25 0 014.5 17.25V6.75A2.25 2.25 0 016.75 4.5z" />
			                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 11.25l1.5 1.5 2.25-3 3.75 5.25H7.5l.75-3.75z" />
			                        </svg>
			                        画像ダウンロード
			                        </button>

			                        <button 
			                        onClick={handleBackToEdit}
			                        className="flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-sm font-semibold transition-all shadow-lg shadow-blue-600/20 w-full sm:w-auto sm:shrink-0 whitespace-nowrap"
		                        >
		                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
		                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
		                        </svg>
		                        再編集
		                        </button>
		                        
		                        <button 
		                        onClick={handleReset}
		                        className="flex items-center justify-center gap-2 px-5 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-2xl text-sm font-semibold transition-all w-full sm:w-auto sm:shrink-0 whitespace-nowrap"
		                        >
		                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
		                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
		                        </svg>
		                        最初から
	                        </button>
	                    </div>
                    </div>
                </div>
                )}
            </div>
        )}
      </main>
    </div>
  );
};

export default App;
