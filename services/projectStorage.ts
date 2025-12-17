import { ProjectData } from '../types';
import { safeRandomUUID } from '../utils/uuid';
import { estimateProjectBytes } from '../utils/projectMetaUtils';

const DB_NAME = 'PDFVideoCreatorDB';
const DB_VERSION = 2;
const STORE_NAME = 'projects';
const META_STORE_NAME = 'projectMeta';
const PROJECT_KEY = 'autosave';

export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  slideCount: number;
  thumbnailUrl: string;
  approxBytes: number;
}

/**
 * Initialize IndexedDB
 */
export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      if (!db.objectStoreNames.contains(META_STORE_NAME)) {
        db.createObjectStore(META_STORE_NAME);
      }
    };
  });
};

const buildProjectMeta = (id: string, name: string, data: ProjectData, createdAt: number): ProjectMeta => {
  const thumbnailUrl = data.slides?.[0]?.thumbnailUrl || '';
  return {
    id,
    name,
    createdAt,
    updatedAt: data.updatedAt || Date.now(),
    slideCount: data.slides?.length || 0,
    thumbnailUrl,
    approxBytes: estimateProjectBytes(data),
  };
};

/**
 * Save project state to IndexedDB
 */
export const saveProject = async (data: ProjectData) => {
  try {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      // IndexedDB automatically handles cloning of File/Blob objects
      const request = store.put(data, PROJECT_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to save project:", error);
  }
};

/**
 * Load project state from IndexedDB
 */
export const loadProject = async (): Promise<ProjectData | null> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(PROJECT_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to load project:", error);
    return null;
  }
};

/**
 * Clear saved project state
 */
export const clearProject = async () => {
  try {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(PROJECT_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to clear project:", error);
  }
};

export const listProjectMetas = async (): Promise<ProjectMeta[]> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(META_STORE_NAME, 'readonly');
      const store = tx.objectStore(META_STORE_NAME);
      const items: ProjectMeta[] = [];
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
          resolve(items);
          return;
        }
        items.push(cursor.value as ProjectMeta);
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to list projects:', error);
    return [];
  }
};

export const loadProjectById = async (id: string): Promise<ProjectData | null> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to load project:', error);
    return null;
  }
};

export const saveNamedProject = async (name: string, data: ProjectData, id?: string): Promise<string | null> => {
  try {
    const db = await initDB();
    const projectId = id || safeRandomUUID();
    const now = Date.now();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME, META_STORE_NAME], 'readwrite');
      const projects = tx.objectStore(STORE_NAME);
      const metas = tx.objectStore(META_STORE_NAME);

      const metaReq = metas.get(projectId);
      metaReq.onsuccess = () => {
        const existing = metaReq.result as ProjectMeta | undefined;
        const createdAt = existing?.createdAt || now;
        const meta = buildProjectMeta(projectId, name, data, createdAt);
        meta.updatedAt = now;
        const put1 = projects.put({ ...data, updatedAt: now }, projectId);
        const put2 = metas.put(meta, projectId);
        put1.onerror = () => reject(put1.error);
        put2.onerror = () => reject(put2.error);
        tx.oncomplete = () => resolve(projectId);
        tx.onerror = () => reject(tx.error);
      };
      metaReq.onerror = () => reject(metaReq.error);
    });
  } catch (error) {
    console.error('Failed to save project:', error);
    return null;
  }
};

export const deleteProjectById = async (id: string) => {
  try {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_NAME, META_STORE_NAME], 'readwrite');
      const projects = tx.objectStore(STORE_NAME);
      const metas = tx.objectStore(META_STORE_NAME);
      const r1 = projects.delete(id);
      const r2 = metas.delete(id);
      r1.onerror = () => reject(r1.error);
      r2.onerror = () => reject(r2.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error('Failed to delete project:', error);
  }
};
