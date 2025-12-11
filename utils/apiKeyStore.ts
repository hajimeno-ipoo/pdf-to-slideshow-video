const STORAGE_KEY = 'user_gemini_api_key';

let memoryKey: string | null = null;

export const getUserApiKey = (): string | null => {
  return memoryKey || localStorage.getItem(STORAGE_KEY) || null;
};

export const setUserApiKey = (key: string, persist: boolean) => {
  memoryKey = key;
  if (persist) {
    localStorage.setItem(STORAGE_KEY, key);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
};

export const clearUserApiKey = () => {
  memoryKey = null;
  localStorage.removeItem(STORAGE_KEY);
};

export const hasStoredApiKey = () => !!localStorage.getItem(STORAGE_KEY);
