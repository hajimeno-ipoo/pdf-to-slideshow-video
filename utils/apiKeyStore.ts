const LOCAL_KEY = 'user_gemini_api_key_local';
const SESSION_KEY = 'user_gemini_api_key_session';

let memoryKey: string | null = null;

export type PersistMode = 'memory' | 'session' | 'local';

export interface StoredCipher {
  cipher: string;
  iv: string;
  salt: string;
}

// ---------- Base64 Helpers ----------
const toB64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (b64: string) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

// ---------- Crypto ----------
const deriveKey = async (pass: string, salt: Uint8Array) => {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

export const encryptKey = async (plain: string, passphrase: string): Promise<StoredCipher> => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(passphrase, salt);
  const enc = new TextEncoder();
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plain));
  return { cipher: toB64(cipherBuf), iv: toB64(iv), salt: toB64(salt) };
};

export const decryptKey = async (stored: StoredCipher, passphrase: string): Promise<string> => {
  const iv = fromB64(stored.iv);
  const salt = fromB64(stored.salt);
  const key = await deriveKey(passphrase, salt);
  const cipherBuf = fromB64(stored.cipher);
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBuf);
  return new TextDecoder().decode(plainBuf);
};

// ---------- Storage ----------
const readSession = () => sessionStorage.getItem(SESSION_KEY);
const readLocal = () => localStorage.getItem(LOCAL_KEY);

const isEncryptedPayload = (val: string | null) => {
  if (!val) return false;
  try {
    const obj = JSON.parse(val);
    return obj && obj.enc === true && obj.data;
  } catch {
    return false;
  }
};

export const hasStoredApiKey = () => !!readSession() || !!readLocal();
export const hasEncryptedStored = () => isEncryptedPayload(readSession()) || isEncryptedPayload(readLocal());

// Get key; if encrypted andパスフレーズ未指定→null
export const getUserApiKey = async (passphrase?: string): Promise<string | null> => {
  if (memoryKey) return memoryKey;
  const sessionVal = readSession();
  const localVal = readLocal();
  const val = sessionVal || localVal;
  if (!val) return null;

  if (isEncryptedPayload(val)) {
    if (!passphrase) return null;
    try {
      const obj = JSON.parse(val);
      const plain = await decryptKey(obj.data as StoredCipher, passphrase);
      memoryKey = plain; // 解読後はメモリ保持
      return plain;
    } catch (e) {
      throw new Error('パスフレーズが違うか、復号に失敗しました');
    }
  }

  memoryKey = val;
  return val;
};

export const setUserApiKey = async (key: string, options: { mode?: PersistMode; passphrase?: string } = {}) => {
  const { mode = 'memory', passphrase } = options;
  memoryKey = mode === 'memory' ? key : null;
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(LOCAL_KEY);

  let saveVal: string | null = key;
  if (passphrase) {
    const encrypted = await encryptKey(key, passphrase);
    saveVal = JSON.stringify({ enc: true, data: encrypted });
  }

  if (mode === 'session' && saveVal) sessionStorage.setItem(SESSION_KEY, saveVal);
  if (mode === 'local' && saveVal) localStorage.setItem(LOCAL_KEY, saveVal);
};

export const clearUserApiKey = () => {
  memoryKey = null;
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(LOCAL_KEY);
};
