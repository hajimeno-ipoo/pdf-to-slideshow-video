import React, { useState, useEffect } from 'react';

interface Props {
  open: boolean;
  initialKey?: string;
  initialRemember?: boolean;
  initialPassphrase?: string;
  onSave: (key: string, options: { remember: boolean; mode: 'memory' | 'session' | 'local'; passphrase?: string; }) => void;
  onClose: () => void;
  onClear: () => void;
}

const ApiKeyModal: React.FC<Props> = ({ open, initialKey = '', initialRemember = false, initialPassphrase = '', onSave, onClose, onClear }) => {
  const [key, setKey] = useState(initialKey);
  const [remember, setRemember] = useState(initialRemember);
  const [mode, setMode] = useState<'memory' | 'session' | 'local'>(initialRemember ? 'local' : 'session');
  const [usePass, setUsePass] = useState(!!initialPassphrase);
  const [pass, setPass] = useState(initialPassphrase || '');
  const [show, setShow] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    setKey(initialKey);
    setRemember(initialRemember);
    setMode(initialRemember ? 'local' : 'session');
    setShowHelp(false);
  }, [initialKey, initialRemember, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 px-4 api-key-overlay">
	      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-md p-5 space-y-4 api-key-panel glass-strong idle-sidebar-typography">
	        <div className="flex items-center justify-between">
	          <h3 className="text-slate-200 font-bold text-lg">Gemini APIキー</h3>
	          <button
	            onClick={onClose}
	            aria-label="閉じる"
	            title="閉じる"
	            className="rounded-full p-2 border border-white/15 bg-white/10 text-slate-200 hover:bg-white/20 hover:text-white active:bg-white/30 transition-colors"
	          >
	            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
	              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
	            </svg>
	          </button>
	        </div>
        <div className="space-y-2">
          <label className="text-xs text-slate-200 font-bold">APIキー</label>
          <div className="flex gap-2 items-center">
            <input
              type={show ? 'text' : 'password'}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-100 text-sm api-key-control"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              onClick={() => setShow(s => !s)}
              className="px-2 py-2 text-xs bg-slate-800 border border-slate-700 rounded text-slate-200 api-key-control-btn"
            >
              {show ? '隠す' : '表示'}
            </button>
          </div>
          <p className="text-[11px] text-red-500 font-bold">キーはサーバーに送信しません。この端末だけで使います。</p>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-200 font-bold">保存先</div>
            <button
              type="button"
              onClick={() => setShowHelp((v) => !v)}
              className="text-[11px] text-slate-300 hover:text-white px-2 py-1 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 api-key-control-btn"
              aria-label="保存先のヘルプ"
            >
              {showHelp ? 'ヘルプを閉じる' : 'ヘルプ'}
            </button>
          </div>
	          {showHelp && (
	            <div className="text-[11px] text-sky-300 bg-slate-800/60 border border-slate-700 rounded p-3 leading-relaxed space-y-2">
	              <div className="text-sky-200 font-semibold">保存先の違い</div>
	              <ul className="list-disc pl-4 space-y-1">
	                <li><span className="text-slate-100 font-semibold">メモリのみ</span>：このタブを開いてる間だけ。リロード（更新）やタブを閉じると消えるよ。</li>
	                <li><span className="text-slate-100 font-semibold">このタブだけ</span>：リロードしても残るけど、タブを閉じたら消えるよ。</li>
	                <li><span className="text-slate-100 font-semibold">この端末に保存</span>：タブを閉じても残るよ。同じ端末・同じブラウザなら次回も使えるよ。</li>
	              </ul>
	              <div className="text-sky-300">※保存先を変えて「保存して使う」を押すと、前の保存先にあったキーは消して、選んだ保存先だけに保存するよ。</div>
	            </div>
	          )}
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <button
              onClick={() => { setMode('memory'); setRemember(false); }}
              className={`py-2 rounded border api-key-mode-btn ${mode==='memory'?'api-key-mode-selected border-emerald-500 text-emerald-300 bg-emerald-900/30':'border-slate-700 text-slate-300 bg-slate-800 hover:bg-slate-700'}`}
            >メモリのみ</button>
            <button
              onClick={() => { setMode('session'); setRemember(false); }}
              className={`py-2 rounded border api-key-mode-btn ${mode==='session'?'api-key-mode-selected border-emerald-500 text-emerald-300 bg-emerald-900/30':'border-slate-700 text-slate-300 bg-slate-800 hover:bg-slate-700'}`}
            >このタブだけ</button>
            <button
              onClick={() => { setMode('local'); setRemember(true); }}
              className={`py-2 rounded border api-key-mode-btn ${mode==='local'?'api-key-mode-selected border-emerald-500 text-emerald-300 bg-emerald-900/30':'border-slate-700 text-slate-300 bg-slate-800 hover:bg-slate-700'}`}
            >この端末に保存</button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" checked={usePass} onChange={(e) => setUsePass(e.target.checked)} />
            パスフレーズで暗号化（共有端末におすすめ）
          </label>
          {usePass && (
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-100 text-sm api-key-control"
              placeholder="パスフレーズ"
            />
          )}
        </div>
        <div className="flex justify-between items-center">
          <button onClick={onClear} className="text-xs text-red-300 hover:text-red-200">キーを削除</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded text-slate-200 api-key-control-btn">キャンセル</button>
            <button
              disabled={!key.trim()}
              onClick={() => onSave(key.trim(), { remember: mode === 'local', mode, passphrase: usePass ? pass : undefined })}
              className={`px-4 py-2 text-sm rounded text-white idle-btn-primary ${key.trim() ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-700 cursor-not-allowed'}`}
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
