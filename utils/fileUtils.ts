import { ProjectData, Slide, VideoSettings } from '../types';

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      } else {
        reject(new Error('Failed to convert file to base64'));
      }
    };
    reader.onerror = (error) => reject(error);
  });
};

export const base64ToFile = async (base64: string, filename: string, mimeType: string): Promise<File> => {
    const res = await fetch(`data:${mimeType};base64,${base64}`);
    const buf = await res.arrayBuffer();
    return new File([buf], filename, { type: mimeType });
};

interface SerializedFile {
    name: string;
    type: string;
    data: string; // Base64
}

const serializeFile = async (file: File | null | undefined): Promise<SerializedFile | null> => {
    if (!file) return null;
    const data = await fileToBase64(file);
    return { name: file.name, type: file.type, data };
};

const deserializeFile = async (s: SerializedFile | null): Promise<File | null> => {
    if (!s) return null;
    return base64ToFile(s.data, s.name, s.type);
};

export const serializeProject = async (data: ProjectData): Promise<string> => {
    const slides = await Promise.all(data.slides.map(async s => ({
        ...s,
        customImageFile: await serializeFile(s.customImageFile),
        audioFile: await serializeFile(s.audioFile)
    })));

    const settings = data.videoSettings ? {
        ...data.videoSettings,
        backgroundImageFile: await serializeFile(data.videoSettings.backgroundImageFile)
    } : undefined;

    const exportData = {
        version: 1,
        timestamp: Date.now(),
        sourceFile: await serializeFile(data.sourceFile),
        slides,
        videoSettings: settings,
        bgmFile: await serializeFile(data.bgmFile),
        bgmTimeRange: data.bgmTimeRange,
        bgmVolume: data.bgmVolume,
        globalAudioFile: await serializeFile(data.globalAudioFile),
        globalAudioVolume: data.globalAudioVolume,
        fadeOptions: data.fadeOptions,
    };

    return JSON.stringify(exportData);
};

export const deserializeProject = async (json: string): Promise<ProjectData> => {
    const raw = JSON.parse(json);
    
    const slides: Slide[] = await Promise.all((raw.slides || []).map(async (s: any) => ({
        ...s,
        customImageFile: s.customImageFile ? await deserializeFile(s.customImageFile) : undefined,
        audioFile: s.audioFile ? await deserializeFile(s.audioFile) : undefined
    })));

    const videoSettings: VideoSettings | undefined = raw.videoSettings ? {
        ...raw.videoSettings,
        backgroundImageFile: raw.videoSettings.backgroundImageFile ? await deserializeFile(raw.videoSettings.backgroundImageFile) : undefined
    } : undefined;

    return {
        slides,
        sourceFile: await deserializeFile(raw.sourceFile),
        videoSettings,
        bgmFile: await deserializeFile(raw.bgmFile),
        bgmTimeRange: raw.bgmTimeRange,
        bgmVolume: raw.bgmVolume,
        globalAudioFile: await deserializeFile(raw.globalAudioFile),
        globalAudioVolume: raw.globalAudioVolume,
        fadeOptions: raw.fadeOptions,
        updatedAt: raw.timestamp || Date.now()
    };
};
