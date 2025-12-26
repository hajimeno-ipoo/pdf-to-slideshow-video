
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Slide, VideoSettings, BgmTimeRange, FadeOptions, DuckingOptions, ProjectData, TokenUsage, AspectRatio, Resolution, OutputFormat, BackgroundFill } from '../../types';
import { saveProject } from '../../services/projectStorage';

type UndoRedoSnapshot = {
  slides: Slide[];
  slideScale: number;
  slideBorderRadius: number;
  backgroundFill: BackgroundFill;
  backgroundImageFile: File | undefined;
  bgmFile: File | null;
  bgmRange: BgmTimeRange;
  bgmVolume: number;
  globalAudioFile: File | null;
  globalAudioVolume: number;
};

interface EditorContextType {
  slides: Slide[];
  updateSlides: (newSlides: Slide[], addToHistory?: boolean) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  
  selectedSlideId: string | null;
  setSelectedSlideId: (id: string | null) => void;

  videoSettings: VideoSettings;
  setVideoSettings: (settings: Partial<VideoSettings>) => void;
  
  bgmFile: File | null;
  setBgmFile: (file: File | null) => void;
  bgmRange: BgmTimeRange;
  setBgmRange: (range: BgmTimeRange) => void;
  bgmVolume: number;
  setBgmVolume: (vol: number) => void;
  fadeOptions: FadeOptions;
  setFadeOptions: (options: FadeOptions) => void;
  
  globalAudioFile: File | null;
  setGlobalAudioFile: (file: File | null) => void;
  globalAudioVolume: number;
  setGlobalAudioVolume: (vol: number) => void;
  
  duckingOptions: DuckingOptions;
  setDuckingOptions: (options: DuckingOptions) => void;
  
  sourceFile: File | null;

  saveProjectState: () => Promise<void>;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

interface EditorProviderProps {
  children: React.ReactNode;
  slides: Slide[];
  onUpdateSlides: (slides: Slide[]) => void;
  initialSettings?: VideoSettings;
  initialBgmFile?: File | null;
  initialFadeOptions?: FadeOptions;
  initialBgmTimeRange?: BgmTimeRange;
  initialBgmVolume?: number;
  initialGlobalAudioFile?: File | null;
  initialGlobalAudioVolume?: number;
  initialDuckingOptions?: DuckingOptions;
  sourceFile: File | null;
  onAutoSave?: (status: 'idle' | 'pending' | 'saving' | 'saved', time?: Date) => void;
}

export const EditorProvider: React.FC<EditorProviderProps> = ({ 
  children, slides, onUpdateSlides, initialSettings, initialBgmFile, initialFadeOptions, initialBgmTimeRange, initialBgmVolume, initialGlobalAudioFile, initialGlobalAudioVolume, initialDuckingOptions, sourceFile, onAutoSave
}) => {
  // --- History State ---
  const [history, setHistory] = useState<UndoRedoSnapshot[]>([]);
  const [future, setFuture] = useState<UndoRedoSnapshot[]>([]);
  const historyGroupActiveRef = useRef(false);
  const historyGroupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Selection State ---
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);

  // --- Settings State ---
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(initialSettings?.aspectRatio || '16:9');
  const [resolution, setResolution] = useState<Resolution>(initialSettings?.resolution || '1080p');
  const [format, setFormat] = useState<OutputFormat>(initialSettings?.format || 'mp4');
  const [backgroundFill, setBackgroundFill] = useState<BackgroundFill>(initialSettings?.backgroundFill || 'black');
  const [backgroundImageFile, setBackgroundImageFile] = useState<File | undefined>(initialSettings?.backgroundImageFile);
  const [slideScale, setSlideScale] = useState<number>(initialSettings?.slideScale || 95);
  const [slideBorderRadius, setSlideBorderRadius] = useState<number>(initialSettings?.slideBorderRadius || 12);
  const [transitionDuration, setTransitionDuration] = useState<number>(initialSettings?.transitionDuration || 1.0);

  // Sync with initialSettings on load
  useEffect(() => {
     if (initialSettings) {
         setAspectRatio(initialSettings.aspectRatio);
         setResolution(initialSettings.resolution);
         setFormat(initialSettings.format);
         setBackgroundFill(initialSettings.backgroundFill);
         setBackgroundImageFile(initialSettings.backgroundImageFile);
         setSlideScale(initialSettings.slideScale);
         setSlideBorderRadius(initialSettings.slideBorderRadius);
         setTransitionDuration(initialSettings.transitionDuration);
     }
	  }, [initialSettings]);

	  // --- Audio State ---
	  const [bgmFile, setBgmFileState] = useState<File | null>(initialBgmFile || null);
	  const [bgmRange, setBgmRangeState] = useState<BgmTimeRange>(initialBgmTimeRange || { start: 0, end: 0 });
	  const [bgmVolume, setBgmVolumeState] = useState<number>(initialBgmVolume ?? 1.0);
	  const [fadeOptions, setFadeOptionsState] = useState<FadeOptions>(initialFadeOptions || { fadeIn: true, fadeOut: true });
	  
	  const [globalAudioFile, setGlobalAudioFileState] = useState<File | null>(initialGlobalAudioFile || null);
	  const [globalAudioVolume, setGlobalAudioVolumeState] = useState<number>(initialGlobalAudioVolume ?? 1.0);
	  
	  const [duckingOptions, setDuckingOptionsState] = useState<DuckingOptions>(initialDuckingOptions || { enabled: true, duckingVolume: 0.2 });

	  // Sync Audio Props
	  useEffect(() => {
	      setBgmFileState(initialBgmFile || null);
	      if (initialBgmTimeRange) setBgmRangeState(initialBgmTimeRange);
	      if (initialBgmVolume !== undefined) setBgmVolumeState(initialBgmVolume);
	      if (initialFadeOptions) setFadeOptionsState(initialFadeOptions);
	      setGlobalAudioFileState(initialGlobalAudioFile || null);
	      if (initialGlobalAudioVolume !== undefined) setGlobalAudioVolumeState(initialGlobalAudioVolume);
	      if (initialDuckingOptions) setDuckingOptionsState(initialDuckingOptions);
	  }, [initialBgmFile, initialBgmTimeRange, initialBgmVolume, initialFadeOptions, initialGlobalAudioFile, initialGlobalAudioVolume, initialDuckingOptions]);

	  // --- Actions ---

	  const resetHistoryGroup = useCallback(() => {
	      historyGroupActiveRef.current = false;
	      if (historyGroupTimerRef.current) {
	          clearTimeout(historyGroupTimerRef.current);
	          historyGroupTimerRef.current = null;
	      }
	  }, []);

	  useEffect(() => {
	      return () => {
	          if (historyGroupTimerRef.current) {
	              clearTimeout(historyGroupTimerRef.current);
	              historyGroupTimerRef.current = null;
	          }
	      };
	  }, []);

	  const createSnapshot = useCallback((): UndoRedoSnapshot => ({
	      slides,
	      slideScale,
	      slideBorderRadius,
	      backgroundFill,
	      backgroundImageFile,
	      bgmFile,
	      bgmRange: { ...bgmRange },
	      bgmVolume,
	      globalAudioFile,
	      globalAudioVolume,
	  }), [slides, slideScale, slideBorderRadius, backgroundFill, backgroundImageFile, bgmFile, bgmRange, bgmVolume, globalAudioFile, globalAudioVolume]);

	  const pushHistory = useCallback((snapshot: UndoRedoSnapshot) => {
	      setHistory(prev => {
	          const newHistory = [...prev, snapshot];
	          return newHistory.slice(-50); // Keep last 50
	      });
	      setFuture([]);
	  }, []);

	  const pushHistoryGrouped = useCallback(() => {
	      if (!historyGroupActiveRef.current) {
	          pushHistory(createSnapshot());
	          historyGroupActiveRef.current = true;
	      }
	      if (historyGroupTimerRef.current) clearTimeout(historyGroupTimerRef.current);
	      historyGroupTimerRef.current = setTimeout(() => {
	          historyGroupActiveRef.current = false;
	          historyGroupTimerRef.current = null;
	      }, 300);
	  }, [createSnapshot, pushHistory]);

	  const applySnapshot = useCallback((snapshot: UndoRedoSnapshot) => {
	      onUpdateSlides(snapshot.slides);
	      setSlideScale(snapshot.slideScale);
	      setSlideBorderRadius(snapshot.slideBorderRadius);
	      setBackgroundFill(snapshot.backgroundFill);
	      setBackgroundImageFile(snapshot.backgroundImageFile);
	      setBgmFileState(snapshot.bgmFile);
	      setBgmRangeState(snapshot.bgmRange);
	      setBgmVolumeState(snapshot.bgmVolume);
	      setGlobalAudioFileState(snapshot.globalAudioFile);
	      setGlobalAudioVolumeState(snapshot.globalAudioVolume);
	  }, [onUpdateSlides]);

	  const updateSlides = useCallback((newSlides: Slide[], addToHistory = true) => {
	      if (addToHistory) {
	          pushHistory(createSnapshot());
	      }
	      onUpdateSlides(newSlides);
	  }, [createSnapshot, onUpdateSlides, pushHistory]);

	  const undo = useCallback(() => {
	      resetHistoryGroup();
	      setHistory(prev => {
	          if (prev.length === 0) return prev;
	          const previous = prev[prev.length - 1];
	          const newHistory = prev.slice(0, -1);
	          const currentSnapshot = createSnapshot();
	          setFuture(f => [currentSnapshot, ...f]);
	          applySnapshot(previous);
	          return newHistory;
	      });
	  }, [applySnapshot, createSnapshot, resetHistoryGroup]);

	  const redo = useCallback(() => {
	      resetHistoryGroup();
	      setFuture(prev => {
	          if (prev.length === 0) return prev;
	          const next = prev[0];
	          const newFuture = prev.slice(1);
	          const currentSnapshot = createSnapshot();
	          setHistory(h => {
	              const newHistory = [...h, currentSnapshot];
	              return newHistory.slice(-50); // Keep last 50
	          });
	          applySnapshot(next);
	          return newFuture;
	      });
	  }, [applySnapshot, createSnapshot, resetHistoryGroup]);

	  const setVideoSettings = useCallback((settings: Partial<VideoSettings>) => {
	      const willChangeSlideScale = settings.slideScale !== undefined && settings.slideScale !== slideScale;
	      const willChangeSlideBorderRadius = settings.slideBorderRadius !== undefined && settings.slideBorderRadius !== slideBorderRadius;
	      const willChangeBackgroundFill = settings.backgroundFill !== undefined && settings.backgroundFill !== backgroundFill;
	      const willChangeBackgroundImageFile = settings.backgroundImageFile !== undefined && settings.backgroundImageFile !== backgroundImageFile;
	      if (willChangeSlideScale || willChangeSlideBorderRadius || willChangeBackgroundFill || willChangeBackgroundImageFile) pushHistoryGrouped();
	      if (settings.aspectRatio) setAspectRatio(settings.aspectRatio);
	      if (settings.resolution) setResolution(settings.resolution);
	      if (settings.format) setFormat(settings.format);
	      if (settings.backgroundFill) setBackgroundFill(settings.backgroundFill);
	      if (settings.backgroundImageFile !== undefined) setBackgroundImageFile(settings.backgroundImageFile);
	      if (settings.slideScale !== undefined) setSlideScale(settings.slideScale);
	      if (settings.slideBorderRadius !== undefined) setSlideBorderRadius(settings.slideBorderRadius);
	      if (settings.transitionDuration !== undefined) setTransitionDuration(settings.transitionDuration);
	  }, [backgroundFill, backgroundImageFile, pushHistoryGrouped, slideBorderRadius, slideScale]);

	  const setBgmFile = useCallback((file: File | null) => {
	      if (file !== bgmFile) pushHistoryGrouped();
	      setBgmFileState(file);
	  }, [bgmFile, pushHistoryGrouped]);

	  const setBgmRange = useCallback((range: BgmTimeRange) => {
	      if (range.start !== bgmRange.start || range.end !== bgmRange.end) pushHistoryGrouped();
	      setBgmRangeState(range);
	  }, [bgmRange.end, bgmRange.start, pushHistoryGrouped]);

	  const setBgmVolume = useCallback((vol: number) => {
	      if (vol !== bgmVolume) pushHistoryGrouped();
	      setBgmVolumeState(vol);
	  }, [bgmVolume, pushHistoryGrouped]);

	  const setFadeOptions = useCallback((options: FadeOptions) => {
	      setFadeOptionsState(options);
	  }, []);

	  const setGlobalAudioFile = useCallback((file: File | null) => {
	      if (file !== globalAudioFile) pushHistoryGrouped();
	      setGlobalAudioFileState(file);
	  }, [globalAudioFile, pushHistoryGrouped]);

	  const setGlobalAudioVolume = useCallback((vol: number) => {
	      if (vol !== globalAudioVolume) pushHistoryGrouped();
	      setGlobalAudioVolumeState(vol);
	  }, [globalAudioVolume, pushHistoryGrouped]);

	  const setDuckingOptions = useCallback((options: DuckingOptions) => {
	      setDuckingOptionsState(options);
	  }, []);

	  // --- Auto Save Logic ---
	  const saveProjectState = useCallback(async () => {
	      const currentSettings: VideoSettings = {
	          aspectRatio, resolution, format, backgroundFill, backgroundImageFile, slideScale, slideBorderRadius, transitionDuration
      };
      
	      const projectData: ProjectData = {
	          slides,
	          sourceFile,
	          videoSettings: currentSettings,
	          bgmFile,
	          bgmTimeRange: bgmRange,
	          bgmVolume,
	          globalAudioFile,
	          globalAudioVolume,
	          fadeOptions,
	          duckingOptions,
	          updatedAt: Date.now()
	      };

	      await saveProject(projectData);
	  }, [slides, aspectRatio, resolution, format, backgroundFill, backgroundImageFile, slideScale, slideBorderRadius, transitionDuration, bgmFile, bgmRange, bgmVolume, globalAudioFile, globalAudioVolume, fadeOptions, duckingOptions, sourceFile]);

  useEffect(() => {
      if (!onAutoSave || slides.length === 0) return;
      onAutoSave('pending');
      const timer = setTimeout(async () => {
          onAutoSave('saving');
          try {
              await saveProjectState();
              onAutoSave('saved', new Date());
          } catch (e) {
              console.error("Auto save failed", e);
          }
      }, 2000);
      return () => clearTimeout(timer);
  }, [saveProjectState, onAutoSave, slides.length]); // Depend on saveProjectState which depends on all data

  const value: EditorContextType = {
      slides,
      updateSlides,
      undo,
      redo,
      canUndo: history.length > 0,
      canRedo: future.length > 0,
      
      selectedSlideId,
      setSelectedSlideId,
      
	      videoSettings: { aspectRatio, resolution, format, backgroundFill, backgroundImageFile, slideScale, slideBorderRadius, transitionDuration },
	      setVideoSettings,
	      
	      bgmFile, setBgmFile,
	      bgmRange, setBgmRange,
	      bgmVolume, setBgmVolume,
	      fadeOptions, setFadeOptions,
	      
	      globalAudioFile, setGlobalAudioFile,
	      globalAudioVolume, setGlobalAudioVolume,
	      
	      duckingOptions, setDuckingOptions,
      
      sourceFile,
      saveProjectState
  };

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
};

export const useEditor = () => {
  const context = useContext(EditorContext);
  if (!context) throw new Error("useEditor must be used within an EditorProvider");
  return context;
};
