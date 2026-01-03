import { TokenUsage } from "../types";

let VOICEVOX_BASE_URL = "http://127.0.0.1:50021";
let USE_NGROK_HEADER = false;

export interface VoicevoxSpeaker {
  name: string;
  speaker_uuid: string;
  styles: {
    name: string;
    id: number;
  }[];
  version: string;
}

export interface FlattenedSpeaker {
  name: string; // e.g., "ずんだもん (ノーマル)"
  id: number;   // style id
}

export const setVoicevoxBaseUrl = (url: string) => {
    VOICEVOX_BASE_URL = url.replace(/\/$/, "").trim();
};

export const getVoicevoxBaseUrl = () => VOICEVOX_BASE_URL;

const getHeaders = (contentTypeJson = false) => {
    const headers: Record<string, string> = {};
    if (USE_NGROK_HEADER) {
        headers["ngrok-skip-browser-warning"] = "true";
    }
    if (contentTypeJson) {
        headers["Content-Type"] = "application/json";
    }
    return headers;
};

export interface ConnectionResult {
    success: boolean;
    message?: string;
    detail?: string;
}

/**
 * Check if VOICEVOX is running at the configured URL
 */
export const checkVoicevoxConnection = async (customUrl?: string): Promise<ConnectionResult> => {
  let targetUrl = customUrl ? customUrl.trim().replace(/\/$/, "") : VOICEVOX_BASE_URL;
  
  // Force HTTPS for non-localhost/ngrok URLs to avoid Mixed Content errors on AI Studio
  if (!targetUrl.includes('localhost') && !targetUrl.includes('127.0.0.1') && targetUrl.startsWith('http://')) {
      console.warn("Upgrading URL to HTTPS to avoid Mixed Content error");
      targetUrl = targetUrl.replace('http://', 'https://');
  }

  const urlsToCheck = customUrl ? [targetUrl] : [
      VOICEVOX_BASE_URL,
      "http://127.0.0.1:50021",
      "http://localhost:50021"
  ];

  let lastError: string = "";

  for (const url of urlsToCheck) {
    // Strategy 1: Simple GET (No custom headers to avoid CORS Preflight issues if possible)
    // We try to request JSON to potentially bypass ngrok's HTML warning page logic
    try {
      console.log(`Checking connection to ${url}/version (No Headers)...`);
      const response = await fetch(`${url}/version`, { 
          method: 'GET',
          headers: { 'Accept': 'application/json' }
      });
      
      const contentType = response.headers.get("content-type");
      const text = await response.text();

      if (response.ok) {
        // If it looks like the ngrok warning page (HTML)
        if (text.trim().startsWith('<') || (contentType && contentType.includes('text/html'))) {
            console.warn("Detected ngrok warning page. Trying to bypass...");
            // Fall through to Strategy 2
        } else {
            console.log(`VOICEVOX Connected at ${url}`);
            VOICEVOX_BASE_URL = url;
            USE_NGROK_HEADER = false;
            return { success: true };
        }
      } else {
          lastError = `Status: ${response.status} ${response.statusText}`;
      }
    } catch (e: any) {
      console.warn('Standard connection failed for', url, e);
      lastError = e.message || "Network Error";
    }

    // Strategy 2: With ngrok bypass header
    // This forces a preflight OPTIONS request. If server rejects Origin, this fails.
    try {
      console.log(`Checking connection to ${url}/version (With Headers)...`);
      const response = await fetch(`${url}/version`, { 
          method: 'GET',
          headers: { "ngrok-skip-browser-warning": "true" }
      });
      
      if (response.ok) {
        const text = await response.text();
        if (!text.trim().startsWith('<')) {
            console.log(`VOICEVOX Connected at ${url} using ngrok header`);
            VOICEVOX_BASE_URL = url;
            USE_NGROK_HEADER = true;
            return { success: true };
        } else {
            lastError = "Ngrok warning page persists even with headers.";
        }
      } else {
          lastError = `Status: ${response.status} (With Header)`;
      }
    } catch (e: any) {
      console.warn('Header connection failed for', url, e);
      // If Strategy 1 failed (Network Error or HTML), and Strategy 2 failed (Network Error),
      // it is almost certainly a CORS Preflight failure (403/405 from server).
      if (e.message === "Failed to fetch") {
          lastError = "通信エラー: CORS設定またはngrok警告ページが原因の可能性があります。ブラウザでURLを開き「Visit Site」をクリックしてから再試行してください。";
      } else {
          lastError = e.message;
      }
    }
  }
  
  console.error("VOICEVOX Connection Failed.", lastError);
  return { success: false, message: "VOICEVOX Connection Failed", detail: lastError };
};

export const getVoicevoxSpeakers = async (): Promise<FlattenedSpeaker[]> => {
  try {
    const response = await fetch(`${VOICEVOX_BASE_URL}/speakers`, { 
        method: 'GET',
        headers: getHeaders()
    });
    if (!response.ok) throw new Error(`Speakers fetch failed: ${response.status}`);
    
    const data: VoicevoxSpeaker[] = await response.json();
    const list: FlattenedSpeaker[] = [];

    data.forEach(speaker => {
      speaker.styles.forEach(style => {
        list.push({
          name: `${speaker.name} (${style.name})`,
          id: style.id
        });
      });
    });

    return list;
  } catch (e: any) {
    console.error("VOICEVOX Speakers Error", e);
    throw new Error(`VOICEVOXへの接続に失敗しました: ${e.message}`);
  }
};

export const generateVoicevoxAudio = async (text: string, speakerId: number): Promise<File> => {
  try {
    // 1. Audio Query
    const queryRes = await fetch(`${VOICEVOX_BASE_URL}/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`, {
      method: 'POST',
      headers: getHeaders()
    });
    if (!queryRes.ok) throw new Error(`Audio query failed: ${queryRes.status}`);
    const queryJson = await queryRes.json();

    // 2. Synthesis
    const synthRes = await fetch(`${VOICEVOX_BASE_URL}/synthesis?speaker=${speakerId}`, {
      method: 'POST',
      headers: getHeaders(true),
      body: JSON.stringify(queryJson)
    });
    
    if (!synthRes.ok) throw new Error(`Synthesis failed: ${synthRes.status}`);
    
    const blob = await synthRes.blob();
    return new File([blob], `voicevox_${Date.now()}.wav`, { type: 'audio/wav' });

  } catch (e: any) {
    console.error("VOICEVOX Gen Error", e);
    throw new Error(`音声生成に失敗しました: ${e.message}`);
  }
};
