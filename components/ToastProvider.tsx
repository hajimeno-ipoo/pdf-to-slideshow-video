import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

export type ToastKind = 'success' | 'info' | 'warning' | 'error';

type Toast = {
  id: string;
  kind: ToastKind;
  message: string;
  durationMs: number;
};

export type ToastInput = {
  kind?: ToastKind;
  message: string;
  durationMs?: number;
};

type ToastContextValue = {
  pushToast: (toast: ToastInput) => string;
  dismissToast: (id: string) => void;
  clearToasts: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATIONS: Record<ToastKind, number> = {
  success: 2000,
  info: 3000,
  warning: 3000,
  error: 5000,
};

const MAX_TOASTS = 3;

const buildToastId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const getToastTheme = (kind: ToastKind) => {
  if (kind === 'success') return { dot: 'bg-emerald-400', border: 'border-emerald-500/30' };
  if (kind === 'warning') return { dot: 'bg-amber-400', border: 'border-amber-500/30' };
  if (kind === 'error') return { dot: 'bg-red-400', border: 'border-red-500/30' };
  return { dot: 'bg-sky-400', border: 'border-sky-500/30' };
};

const ToastViewport: React.FC<{ toasts: Toast[]; onDismiss: (id: string) => void }> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[300] flex flex-col gap-2 items-stretch w-[92vw] max-w-sm pointer-events-none">
      {toasts.map((t) => {
        const theme = getToastTheme(t.kind);
        const role = t.kind === 'error' ? 'alert' : 'status';
        const ariaLive = t.kind === 'error' ? 'assertive' : 'polite';
        return (
          <div
            key={t.id}
            role={role}
            aria-live={ariaLive}
            className={`pointer-events-auto bg-slate-900/85 backdrop-blur-md border ${theme.border} text-slate-100 rounded-xl shadow-2xl glass-strong idle-sidebar-typography`}
          >
            <div className="flex items-start gap-3 px-4 py-3">
              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${theme.dot}`} />
              <div className="flex-1 text-[13px] leading-relaxed break-words">{t.message}</div>
              <button
                type="button"
                onClick={() => onDismiss(t.id)}
                aria-label="閉じる"
                title="閉じる"
                className="ml-1 rounded-full p-1 border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white active:bg-white/15 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    for (const timer of timersRef.current.values()) window.clearTimeout(timer);
    timersRef.current.clear();
    setToasts([]);
  }, []);

  const pushToast = useCallback((toast: ToastInput) => {
    const kind: ToastKind = toast.kind || 'info';
    const durationMs = Number.isFinite(toast.durationMs) ? Math.max(0, toast.durationMs as number) : DEFAULT_DURATIONS[kind];
    const id = buildToastId();
    const next: Toast = { id, kind, message: toast.message, durationMs };

    setToasts((prev) => {
      const nextList = [...prev, next];
      while (nextList.length > MAX_TOASTS) {
        const removed = nextList.shift();
        if (removed) {
          const timer = timersRef.current.get(removed.id);
          if (timer) window.clearTimeout(timer);
          timersRef.current.delete(removed.id);
        }
      }
      return nextList;
    });

    if (durationMs > 0) {
      const timer = window.setTimeout(() => dismissToast(id), durationMs);
      timersRef.current.set(id, timer);
    }

    return id;
  }, [dismissToast]);

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) window.clearTimeout(timer);
      timersRef.current.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ pushToast, dismissToast, clearToasts }), [pushToast, dismissToast, clearToasts]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
};

