import React, { useState, useEffect } from 'react';

interface Props {
  open: boolean;
  initialKey?: string;
  initialRemember?: boolean;
  onSave: (key: string, remember: boolean) => void;
  onClose: () => void;
  onClear: () => void;
}

const ApiKeyModal: React.FC<Props> = ({ open, initialKey = '', initialRemember = false, onSave, onClose, onClear }) => {
  const [key, setKey] = useState(initialKey);
  const [remember, setRemember] = useState(initialRemember);
  const [show, setShow] = useState(false);

  useEffect(() => {
    setKey(initialKey);
    setRemember(initialRemember);
  }, [initialKey, initialRemember, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 px-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-md p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold text-lg">Gemini APIキー</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>
        <div className="space-y-2">
          <label className="text-xs text-slate-400">APIキー</label>
          <div className="flex gap-2 items-center">
            <input
              type={show ? 'text' : 'password'}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-100 text-sm"
              autoComplete="off"
              spellCheck={false}
            />
            <button onClick={() => setShow(s => !s)} className="px-2 py-2 text-xs bg-slate-800 border border-slate-700 rounded text-slate-200">
              {show ? '隠す' : '表示'}
            </button>
          </div>
          <p className="text-[11px] text-slate-500">キーはサーバーに送信しません。この端末だけで使います。</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          この端末に保存する（共有PCではオフ推奨）
        </label>
        <div className="flex justify-between items-center">
          <button onClick={onClear} className="text-xs text-red-300 hover:text-red-200">キーを削除</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded text-slate-200">キャンセル</button>
            <button
              disabled={!key.trim()}
              onClick={() => onSave(key.trim(), remember)}
              className={`px-4 py-2 text-sm rounded text-white ${key.trim() ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-700 cursor-not-allowed'}`}
            >
              保存して使う
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;
