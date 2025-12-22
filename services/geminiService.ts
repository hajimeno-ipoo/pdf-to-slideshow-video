
import { GoogleGenAI } from "@google/genai";
import { TokenUsage } from "../types";
import { getUserApiKey } from "../utils/apiKeyStore";
import { sanitizeMessage } from "../utils/sanitize";

let cachedClient: GoogleGenAI | null = null;
let cachedKey: string | null = null;

const getClient = async () => {
  const key = await getUserApiKey();
  if (!key) throw new Error("Gemini APIキーを設定してください");
  if (cachedClient && cachedKey === key) return cachedClient;
  cachedKey = key;
  cachedClient = new GoogleGenAI({ apiKey: key });
  return cachedClient;
};

// Constants
const TTS_MODEL = "gemini-2.5-flash-preview-tts";
const IMAGE_GEN_MODEL = "gemini-2.5-flash-image";
const VISION_MODEL = "gemini-2.5-flash"; // Multimodal model for image analysis
const SAMPLE_RATE = 24000;

export const VOICES = [
  { name: 'ずんだもん風 (Gemini再現)', value: 'Zundamon_Style' },
  { name: 'Kore (女性・落ち着いた)', value: 'Kore' },
  { name: 'Puck (男性・クリア)', value: 'Puck' },
  { name: 'Charon (男性・低音)', value: 'Charon' },
  { name: 'Fenrir (男性・エネルギッシュ)', value: 'Fenrir' },
  { name: 'Zephyr (女性・やわらか)', value: 'Zephyr' },
];

const RATE_LIMIT_ERROR_MESSAGE = `API利用制限 (429 Resource Exhausted) に達しました。

▼ 1分間あたりのリクエスト数 (RPM) の超過
短時間に連続して何度も質問やリクエストを送りすぎた場合に発生します。
対策: 数分待ってから、少しペースを落として再度実行してください。

▼ 1分間あたりのトークン数 (TPM) の超過
短時間に大量のテキストや画像を送信しすぎた場合に発生します。
対策: 送信するデータ量を減らすか、数分待ってペースを落としてください。

▼ 1日あたりのリクエスト数 (RPD) の超過
その日の利用可能回数をすべて使い切ってしまった場合に発生します（特に無料枠の場合）。
対策: 翌日（リセットされる時間）まで待つ必要があります。`;

// --- Request Tracking & Cooldown Notification ---
type RequestListener = () => void;
let requestListener: RequestListener | null = null;

export const setApiRequestListener = (listener: RequestListener) => {
    requestListener = listener;
};

type CooldownListener = (isActive: boolean, remainingMs: number, reason?: string) => void;
let cooldownListener: CooldownListener | null = null;

export const setApiCooldownListener = (listener: CooldownListener) => {
    cooldownListener = listener;
};

const notifyCooldown = (isActive: boolean, ms: number, reason: string = '') => {
    if (cooldownListener) cooldownListener(isActive, ms, reason);
};

/**
 * Helper to wait for a specified duration
 */
export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Rate Limit Queue Class
 * Enforces a minimum interval between requests to respect RPM limits.
 * Gemini Free Tier has a limit of 15 RPM (approx 1 request every 4 seconds).
 */
class RateLimitQueue {
  private queue: Array<() => Promise<void>> = [];
  private isProcessing = false;
  private lastRequestTime = 0;
  // 60s / 15 requests = 4000ms. We add a small buffer.
  private minInterval = 4200; 

  /**
   * Add a request operation to the queue.
   * @param operation A function that returns a Promise.
   */
  async add<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.process();
    });
  }

  private async process() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const timeSinceLast = now - this.lastRequestTime;
      
      // If we need to wait to satisfy the interval
      if (timeSinceLast < this.minInterval) {
        const waitTime = this.minInterval - timeSinceLast;
        // Notify UI about cooldown
        notifyCooldown(true, waitTime, 'レート制限調整中(RPM)');
        await wait(waitTime);
        notifyCooldown(false, 0);
      }

      const task = this.queue.shift();
      if (task) {
        this.lastRequestTime = Date.now();
        // Notify listener about a request attempt (for stats UI)
        if (requestListener) requestListener();
        
        await task();
      }
    }

    this.isProcessing = false;
  }
}

// Global instance of the rate limiter
const apiQueue = new RateLimitQueue();


/**
 * Helper to extract meaningful error message
 */
const getErrorMessage = (error: any): string => {
    if (!error) return "Unknown error";
    if (error instanceof Error) return error.message;
    
    // Check if error is a JSON string
    if (typeof error === 'string') {
        try {
            const parsed = JSON.parse(error);
            if (parsed.error && parsed.error.message) return parsed.error.message;
        } catch (e) {
            return error;
        }
    }
    
    // Handle nested error object from GoogleGenAI or fetch response
    if (typeof error === 'object') {
        if (error.error && error.error.message) return error.error.message;
        if (error.message) return error.message;
        
        // Sometimes the error is wrapped in a response object or just stringifiable
        try {
            const str = JSON.stringify(error);
            if (str !== '{}') {
                const parsed = JSON.parse(str);
                if (parsed.error && parsed.error.message) return parsed.error.message;
                return str; 
            }
        } catch (e) {}
    }
    return String(error);
};

/**
 * Helper to retry API calls with exponential backoff
 * Handles 429 (Too Many Requests) and 503 (Service Unavailable)
 */
async function callWithRetry<T>(fn: () => Promise<T>, retries = 3, initialDelay = 2000): Promise<T> {
  let delay = initialDelay;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const msg = getErrorMessage(error);
      const errCode = error?.status || error?.error?.code || error?.response?.status;
      
      const isRateLimit = 
        errCode === 429 || 
        msg.includes('429') || 
        msg.includes('quota') || 
        msg.includes('RESOURCE_EXHAUSTED') ||
        error?.status === 'RESOURCE_EXHAUSTED'; 

      const isServerOverload = 
        errCode === 503 || 
        errCode === 500 || 
        msg.includes('503') || 
        msg.includes('Overloaded');

      if ((isRateLimit || isServerOverload) && i < retries - 1) {
        console.warn(`Gemini API Retry (${i + 1}/${retries}): ${msg}. Waiting ${delay}ms`);
        const reason = isRateLimit ? 'API制限により待機中' : 'サーバー混雑のため待機中';
        notifyCooldown(true, delay, reason);
        await wait(delay);
        notifyCooldown(false, 0);
        delay *= 2; // Exponential backoff
        continue;
      }
      
      if (typeof error === 'object' && !error.message && error.error && error.error.message) {
          throw new Error(error.error.message);
      }
      throw error;
    }
  }
  throw new Error("Max retries exceeded");
}

/**
 * Helper to convert Base64 string to Uint8Array
 */
const base64ToUint8Array = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

/**
 * Write a string to a DataView
 */
const writeString = (view: DataView, offset: number, string: string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

/**
 * Create a WAV file from PCM data
 */
const createWavFile = (pcmData: Uint8Array, sampleRate: number): File => {
  const numChannels = 1;
  const bitDepth = 16; // Assuming 16-bit PCM
  const byteRate = sampleRate * numChannels * (bitDepth / 8);
  const blockAlign = numChannels * (bitDepth / 8);
  const dataSize = pcmData.byteLength;
  
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF chunk
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write PCM data
  const wavBytes = new Uint8Array(buffer);
  wavBytes.set(pcmData, 44);

  const blob = new Blob([buffer], { type: 'audio/wav' });
  return new File([blob], `tts_${Date.now()}.wav`, { type: 'audio/wav' });
};

/**
 * Check API Connection
 * Note: This bypasses the queue to ensure quick initial feedback, 
 * but still updates stats via callWithRetry if needed.
 */
export const checkApiConnection = async (): Promise<boolean> => {
  try {
    await callWithRetry(async () => {
      // Direct call, bypassing queue for quick check
      if (requestListener) requestListener();
      const ai = await getClient();
      return await ai.models.generateContent({
        model: VISION_MODEL,
        contents: { parts: [{ text: "hi" }] },
      });
    }, 3, 1000); 
    return true;
  } catch (error: any) {
    const msg = getErrorMessage(error);
    if (msg.includes('quota') || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
        console.warn("API Connection Check: Quota exceeded, but key is assumed valid.");
        return true;
    }
    console.error("API Connection Check Failed:", msg);
    return false;
  }
};

/**
 * Generate speech from text using Gemini API
 * Uses apiQueue to respect rate limits.
 */
export const generateSpeech = async (text: string, voiceName: string = 'Kore', stylePrompt?: string): Promise<{ file: File, usage: TokenUsage }> => {
  return apiQueue.add(async () => {
    if (!text.trim()) throw new Error("テキストを入力してください");

    let actualVoice = voiceName;
    let promptText = text;
    
    if (voiceName === 'Zundamon_Style') {
        actualVoice = 'Zephyr'; 
        const persona = "あなたは『ずんだもん』です。東北地方の応援キャラクターで、ずんだ餅の妖精です。声質は甲高く、元気いっぱいで、かわいらしい子供のようなアニメ声で話してください。生意気だけど憎めない愛されキャラの演技をしてください。";
        const userStyle = stylePrompt ? `追加の話し方指示: ${stylePrompt}` : "";
        promptText = `${persona} ${userStyle}\n\n読み上げるセリフ: 「${text}」`;
    } else {
        if (stylePrompt && stylePrompt.trim()) {
            promptText = `${stylePrompt}: ${text}`;
        }
    }

    try {
      const response = await callWithRetry(async () => {
          const ai = await getClient();
          return await ai.models.generateContent({
            model: TTS_MODEL,
            contents: {
              parts: [{ text: promptText }],
            },
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: actualVoice },
                },
              },
            },
          });
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) throw new Error("音声データの生成に失敗しました");

      const pcmData = base64ToUint8Array(base64Audio);
      const wavFile = createWavFile(pcmData, SAMPLE_RATE);
      
      const usage: TokenUsage = {
          totalTokens: response.usageMetadata?.totalTokenCount || 0
      };
      
      return { file: wavFile, usage };

    } catch (error: any) {
      const msg = getErrorMessage(error);
      console.error("TTS Error:", error);
      if (msg.includes('quota') || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
           throw new Error(RATE_LIMIT_ERROR_MESSAGE);
      }
      throw new Error(msg || "音声生成中にエラーが発生しました");
    }
  });
};

/**
 * Generate image from text using Gemini API
 * Uses apiQueue to respect rate limits.
 */
export const generateImage = async (prompt: string): Promise<{ imageData: string, usage: TokenUsage }> => {
  return apiQueue.add(async () => {
    if (!prompt.trim()) throw new Error("画像の説明を入力してください");

    try {
      const response = await callWithRetry(async () => {
          const ai = await getClient();
          return await ai.models.generateContent({
            model: IMAGE_GEN_MODEL,
            contents: {
              parts: [{ text: prompt }],
            },
          });
      });

      const parts = response.candidates?.[0]?.content?.parts || [];
      let imageData = '';
      
      for (const part of parts) {
          if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
              imageData = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
              break;
          }
      }
      
      if (!imageData) {
          const textPart = parts.find(p => p.text);
          if (textPart) {
              throw new Error(`画像生成できませんでした: ${textPart.text}`);
          }
          throw new Error("画像データが返されませんでした");
      }

      const usage: TokenUsage = {
          totalTokens: response.usageMetadata?.totalTokenCount || 0
      };

      return { imageData, usage };

  } catch (error: any) {
      const msg = getErrorMessage(error);
      console.error("Image Gen Error:", sanitizeMessage(error));
      if (msg.includes('quota') || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
           throw new Error(RATE_LIMIT_ERROR_MESSAGE);
      }
      throw new Error(sanitizeMessage(msg) || "画像生成中にエラーが発生しました");
    }
  });
};

/**
 * Generate narration script from slide image using Gemini Vision
 * Uses apiQueue to respect rate limits.
 */
export const generateSlideScript = async (imageBase64: string, previousContext?: string, customInstructions?: string): Promise<{ text: string, usage: TokenUsage }> => {
    return apiQueue.add(async () => {
        const base64Data = imageBase64.split(',')[1] || imageBase64;
        
        let prompt = "このスライド画像の内容を基に、プレゼンテーション用のナレーション原稿を作成してください。日本語で、自然な話し言葉（です・ます調）で、150文字以内で簡潔にまとめてください。スライドのタイトルや要点を補足する形で、聴衆に語りかけるような口調にしてください。";

        if (previousContext) {
            prompt += `\n\n【最重要：文脈の維持】\nこれは連続したプレゼンテーションの続きです。\n直前のスライドでは以下のナレーションが流れました：\n"""\n${previousContext}\n"""\n\nこの直前の内容を受けて、話が自然に繋がるように（必要に応じて「次は」「続いて」「このように」などの接続詞を用いて）今回のスライドの解説を始めてください。唐突な始まり方を避けてください。これが**最も優先される**指示です。`;
        } else {
            prompt += "\n\nこれはプレゼンテーションの最初のスライド、または導入部分です。必要に応じて挨拶やタイトルの紹介から始めても構いません。";
        }

        if (customInstructions && customInstructions.trim() !== '') {
            prompt += `\n\n【ユーザーからのスタイル・内容指示】\n上記の「文脈の維持」を崩さない範囲で、以下の指示を反映してください：\n「${customInstructions}」\n`;
        }

        try {
            const response = await callWithRetry(async () => {
                const ai = await getClient();
                return await ai.models.generateContent({
                    model: VISION_MODEL,
                    contents: {
                        parts: [
                            {
                                inlineData: {
                                    mimeType: "image/jpeg",
                                    data: base64Data
                                }
                            },
                            {
                                text: prompt
                            }
                        ]
                    }
                });
            });

            const text = response.text;
            if (!text) throw new Error("テキストが生成されませんでした");
            
            const usage: TokenUsage = {
                totalTokens: response.usageMetadata?.totalTokenCount || 0
            };
            
            return { text: text.trim(), usage };
        } catch (error: any) {
            const msg = getErrorMessage(error);
            console.error("Script Gen Error:", error);
            if (msg.includes('quota') || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
                 throw new Error(RATE_LIMIT_ERROR_MESSAGE);
            }
            throw new Error(msg || "原稿生成中にエラーが発生しました");
        }
    });
};
