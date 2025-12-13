
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Slide, VideoSettings, BgmTimeRange, FadeOptions, DuckingOptions, ProjectData, TokenUsage, AspectRatio, Resolution, OutputFormat, BackgroundFill } from '../../types';
import { saveProject } from '../../services/projectStorage';

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

  outputFileHandle: FileSystemFileHandle | null;
  outputFileFormat: OutputFormat | null;
  setOutputFileHandle: (handle: FileSystemFileHandle | null, format: OutputFormat | null) => void;

  saveProjectState: () => Promise<void>;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

interface EditorProviderProps {
  children: React.ReactNode;
  slides: Slide[];
  onUpdateSlides: (slides: Slide[]) => void;
  initialSettings?: VideoSettings;
  initialOutputFileHandle?: FileSystemFileHandle | null;
  initialOutputFileFormat?: OutputFormat | null;
  initialBgmFile?: File | null;
  initialFadeOptions?: FadeOptions;
  initialBgmTimeRange?: BgmTimeRange;
  initialBgmVolume?: number;
  initialGlobalAudioFile?: File | null;
  initialGlobalAudioVolume?: number;
  initialDuckingOptions?: DuckingOptions;
  sourceFile: File | null;
  onAutoSave?: (status: 'idle' | 'pending' | 'saving' | 'saved', time?: Date) => void;
  onOutputFileTargetChange?: (handle: FileSystemFileHandle | null, format: OutputFormat | null) => void;
}

export const EditorProvider: React.FC<EditorProviderProps> = ({ 
  children, slides, onUpdateSlides, initialSettings, initialOutputFileHandle, initialOutputFileFormat, initialBgmFile, initialFadeOptions, initialBgmTimeRange, initialBgmVolume, initialGlobalAudioFile, initialGlobalAudioVolume, initialDuckingOptions, sourceFile, onAutoSave, onOutputFileTargetChange
}) => {
  // --- History State ---
  const [history, setHistory] = useState<Slide[][]>([]);
  const [future, setFuture] = useState<Slide[][]>([]);

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

  // --- Output Target State ---
  const [outputFileHandle, setOutputFileHandleState] = useState<FileSystemFileHandle | null>(initialOutputFileHandle || null);
  const [outputFileFormat, setOutputFileFormat] = useState<OutputFormat | null>(initialOutputFileFormat || null);

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

  // Sync output file target on load
  useEffect(() => {
      if (initialOutputFileHandle !== undefined) setOutputFileHandleState(initialOutputFileHandle);
      if (initialOutputFileFormat !== undefined) setOutputFileFormat(initialOutputFileFormat);
  }, [initialOutputFileHandle, initialOutputFileFormat]);

  // --- Audio State ---
  const [bgmFile, setBgmFile] = useState<File | null>(initialBgmFile || null);
  const [bgmRange, setBgmRange] = useState<BgmTimeRange>(initialBgmTimeRange || { start: 0, end: 0 });
  const [bgmVolume, setBgmVolume] = useState<number>(initialBgmVolume ?? 1.0);
  const [fadeOptions, setFadeOptions] = useState<FadeOptions>(initialFadeOptions || { fadeIn: true, fadeOut: true });
  
  const [globalAudioFile, setGlobalAudioFile] = useState<File | null>(initialGlobalAudioFile || null);
  const [globalAudioVolume, setGlobalAudioVolume] = useState<number>(initialGlobalAudioVolume ?? 1.0);
  
  const [duckingOptions, setDuckingOptions] = useState<DuckingOptions>(initialDuckingOptions || { enabled: true, duckingVolume: 0.2 });

  // Sync Audio Props
  useEffect(() => {
      setBgmFile(initialBgmFile || null);
      if (initialBgmTimeRange) setBgmRange(initialBgmTimeRange);
      if (initialBgmVolume !== undefined) setBgmVolume(initialBgmVolume);
      if (initialFadeOptions) setFadeOptions(initialFadeOptions);
      setGlobalAudioFile(initialGlobalAudioFile || null);
      if (initialGlobalAudioVolume !== undefined) setGlobalAudioVolume(initialGlobalAudioVolume);
      if (initialDuckingOptions) setDuckingOptions(initialDuckingOptions);
  }, [initialBgmFile, initialBgmTimeRange, initialBgmVolume, initialFadeOptions, initialGlobalAudioFile, initialGlobalAudioVolume, initialDuckingOptions]);

  // --- Actions ---

  const updateSlides = useCallback((newSlides: Slide[], addToHistory = true) => {
      if (addToHistory) {
          setHistory(prev => {
              const newHistory = [...prev, slides];
              return newHistory.slice(-50); // Keep last 50
          });
          setFuture([]);
      }
      onUpdateSlides(newSlides);
  }, [slides, onUpdateSlides]);

  const undo = useCallback(() => {
      setHistory(prev => {
          if (prev.length === 0) return prev;
          const previous = prev[prev.length - 1];
          const newHistory = prev.slice(0, -1);
          setFuture(f => [slides, ...f]);
          onUpdateSlides(previous);
          return newHistory;
      });
  }, [history, slides, onUpdateSlides]);

  const redo = useCallback(() => {
      setFuture(prev => {
          if (prev.length === 0) return prev;
          const next = prev[0];
          const newFuture = prev.slice(1);
          setHistory(h => [...h, slides]);
          onUpdateSlides(next);
          return newFuture;
      });
  }, [future, slides, onUpdateSlides]);

  const setVideoSettings = (settings: Partial<VideoSettings>) => {
      if (settings.aspectRatio) setAspectRatio(settings.aspectRatio);
      if (settings.resolution) setResolution(settings.resolution);
      if (settings.format) setFormat(settings.format);
      if (settings.backgroundFill) setBackgroundFill(settings.backgroundFill);
      if (settings.backgroundImageFile !== undefined) setBackgroundImageFile(settings.backgroundImageFile);
      if (settings.slideScale !== undefined) setSlideScale(settings.slideScale);
      if (settings.slideBorderRadius !== undefined) setSlideBorderRadius(settings.slideBorderRadius);
      if (settings.transitionDuration !== undefined) setTransitionDuration(settings.transitionDuration);
  };

  const setOutputFileHandle = (handle: FileSystemFileHandle | null, format: OutputFormat | null) => {
      setOutputFileHandleState(handle);
      setOutputFileFormat(format);
      onOutputFileTargetChange?.(handle, format);
  };

  // --- Auto Save Logic ---
  const saveProjectState = useCallback(async () => {
      const currentSettings: VideoSettings = {
          aspectRatio, resolution, format, backgroundFill, backgroundImageFile, slideScale, slideBorderRadius, transitionDuration
      };
      
      const projectData: ProjectData = {
          slides,
          sourceFile,
          videoSettings: currentSettings,
          outputFileHandle,
          outputFileFormat,
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
  }, [slides, aspectRatio, resolution, format, backgroundFill, backgroundImageFile, slideScale, slideBorderRadius, transitionDuration, bgmFile, bgmRange, bgmVolume, globalAudioFile, globalAudioVolume, fadeOptions, duckingOptions, sourceFile, outputFileHandle, outputFileFormat]);

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
      outputFileHandle,
      outputFileFormat,
      setOutputFileHandle,
      saveProjectState
  };

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
};

export const useEditor = () => {
  const context = useContext(EditorContext);
  if (!context) throw new Error("useEditor must be used within an EditorProvider");
  return context;
};
