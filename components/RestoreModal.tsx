import React from 'react';

interface RestoreModalProps {
  isOpen: boolean;
  onRestore: () => void;
  onDiscard: () => void;
  lastUpdated: number;
}

const RestoreModal: React.FC<RestoreModalProps> = ({ isOpen, onRestore, onDiscard, lastUpdated }) => {
  if (!isOpen) return null;

  const dateStr = new Date(lastUpdated).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl shadow-emerald-900/20">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm11.378-3.917c-.89-.777-2.366-.777-3.255 0a.75.75 0 01-.988-1.129c1.454-1.272 3.776-1.272 5.23 0 1.513 1.324 1.513 3.518 0 4.842a3.75 3.75 0 01-.837.552c-.676.328-1.028.774-1.028 1.152v.75a.75.75 0 01-1.5 0v-.75c0-1.279 1.06-2.107 1.875-2.502.182-.088.351-.199.503-.331.83-.727.83-1.857 0-2.584zM12 18a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">作業の続きから始めますか？</h3>
            <p className="text-xs text-slate-400">前回保存された作業内容が見つかりました。</p>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-3 mb-6 border border-slate-700">
          <p className="text-sm text-slate-300 text-center">
            最終更新: <span className="font-mono text-emerald-400 font-bold">{dateStr}</span>
          </p>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={onDiscard}
            className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors border border-slate-600"
          >
            破棄して新規作成
          </button>
          <button 
            onClick={onRestore}
            className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold transition-colors shadow-lg shadow-emerald-900/30"
          >
            復元する
          </button>
        </div>
      </div>
    </div>
  );
};

export default RestoreModal;
