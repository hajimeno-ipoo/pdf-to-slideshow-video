
export enum AppStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  EDITING = 'EDITING',
  CONVERTING = 'CONVERTING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export type ApiConnectionStatus = 'checking' | 'connected' | 'error';

export interface TokenUsage {
  totalTokens: number;
}

export interface RequestStats {
  rpm: number; // Requests Per Minute (Last 60s)
  tpm: number; // Tokens Per Minute (Last 60s)
  rpd: number; // Requests Per Day (Since midnight)
}

export interface FadeOptions {
  fadeIn: boolean;
  fadeOut: boolean;
}

export interface DuckingOptions {
  enabled: boolean;
  duckingVolume: number; // 0.0 to 1.0 (Target volume during narration)
}

export interface BgmTimeRange {
  start: number;
  end: number;
}

export interface ProcessingState {
  status: AppStatus;
  message?: string;
  videoUrl?: string;
  extension?: string;
  settings?: VideoSettings;
  bgmFile?: File | null;
  bgmTimeRange?: BgmTimeRange;
  bgmVolume?: number;
  globalAudioFile?: File | null;
  globalAudioVolume?: number;
  fadeOptions?: FadeOptions;
  duckingOptions?: DuckingOptions;
  progress?: {
    current: number;
    total: number;
  };
  error?: string;
}

export interface VideoConfig {
  durationPerSlide: number;
}

export type TransitionType = 'none' | 'fade' | 'slide' | 'zoom' | 'wipe' | 'flip' | 'cross-zoom';
export type EffectType = 'none' | 'kenburns';
export type AspectRatio = '16:9' | '4:3' | '1:1' | '9:16';
export type Resolution = '1080p' | '720p';
export type OutputFormat = 'mp4' | 'mov';
export type BackgroundFill = 'black' | 'white' | 'custom_image';

export interface VideoSettings {
  aspectRatio: AspectRatio;
  resolution: Resolution;
  format: OutputFormat;
  backgroundFill: BackgroundFill;
  backgroundImageFile?: File;
  slideScale: number; // 50-100%
  slideBorderRadius: number; // px
  transitionDuration: number; // seconds
  subtitlesEnabled?: boolean; // 字幕を表示するか
}

export type OverlayType = 'text' | 'arrow' | 'rect' | 'circle' | 'image' | 'line';
export type OverlaySpace = 'slide' | 'canvas';
export type AnimationType = 
  | 'none' 
  | 'fade' 
  | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' 
  | 'zoom' 
  | 'pop' 
  | 'rotate-cw' | 'rotate-ccw'
  | 'wipe-right' | 'wipe-down'
  | 'typewriter';

export interface Overlay {
  id: string;
  type: OverlayType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation: number;
  opacity?: number;
  space?: OverlaySpace;
  hidden?: boolean;
  locked?: boolean;
  
  // Timing
  startTime?: number; // seconds from slide start
  duration?: number;  // seconds to display (if undefined, until slide end)

  // Text specific
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  isBold?: boolean;
  isItalic?: boolean;
  textAlign?: 'left' | 'center' | 'right';
  
  // Style
  color?: string; // Text color or Stroke color
  backgroundColor?: string;
  backgroundPadding?: number;
  borderRadius?: number;
  
  // Border/Line
  strokeWidth?: number;
  strokeColor?: string;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  strokeLineCap?: 'butt' | 'round';
  
  // Shadow
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;

  // Animation
  animationIn?: AnimationType;
  animationOut?: AnimationType;
  
  // Image
  imageData?: string; // Data URL
}

export interface CropData {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Slide {
  id: string;
  pageIndex: number; // -1 for custom image or solid color
  thumbnailUrl: string; // Data URL for preview
  duration: number; // seconds
  
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  
  crop: CropData;
  
  transitionType: TransitionType;
  transitionDuration?: number;
  effectType: EffectType;
  
  customImageFile?: File | null; // If uploaded image
  backgroundColor?: string; // If solid color
  
  narrationScript?: string;
  audioFile?: File;
  audioVolume?: number;
  audioOffset?: number; // Start offset for audio relative to slide start
  
  overlays?: Overlay[];
  // Slide placement on the video canvas (normalized 0..1, fixed aspect ratio)
  layout?: { x: number; y: number; w: number };
  // Layer order (bottom -> top). Use '__SLIDE__' to represent the slide layer.
  layerOrder?: string[];
  
  // Transient property used in worker
  bitmap?: ImageBitmap;
}

export interface ProjectData {
  slides: Slide[];
  sourceFile: File | null;
  videoSettings?: VideoSettings;
  bgmFile: File | null;
  bgmTimeRange?: BgmTimeRange;
  bgmVolume?: number;
  globalAudioFile: File | null;
  globalAudioVolume?: number;
  fadeOptions?: FadeOptions;
  duckingOptions?: DuckingOptions;
  updatedAt: number;
}
