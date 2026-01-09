import React, { useEffect, useRef, useState } from 'react';
import { ProjectData } from '../types';
import { deleteProjectById, listProjectMetas, loadProjectById, ProjectMeta } from '../services/projectStorage';
import { deserializeProject } from '../utils/fileUtils';
import { getProjectImportError, getProjectJsonTextError } from '../utils/projectFileImport';
import { formatBytes } from '../utils/projectMetaUtils';

interface ProjectManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadProject: (data: ProjectData) => void;
}

const formatDateTime = (ms: number) => {
  if (!ms) return '';
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
};

const ProjectManagerModal: React.FC<ProjectManagerModalProps> = ({ isOpen, onClose, onLoadProject }) => {
  const [items, setItems] = useState<ProjectMeta[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    setBusy(true);
    try {
      const list = await listProjectMetas();
      setItems(list);
      if (selectedId && !list.some(t => t.id === selectedId)) setSelectedId(null);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setStatusText('');
    (async () => {
      setBusy(true);
      try {
        const list = await listProjectMetas();
        setItems(list);
        setSelectedId(prev => (prev && list.some(t => t.id === prev) ? prev : null));
      } finally {
        setBusy(false);
      }
    })();
  }, [isOpen]);

  const handleLoadById = async (id: string) => {
    setBusy(true);
    try {
      const data = await loadProjectById(id);
      if (!data) {
        setStatusText('プロジェクトが見つからなかったよ。');
        await refresh();
        return;
      }
      onLoadProject(data);
      onClose();
    } catch (e) {
      console.error('Load project failed', e);
      setStatusText('プロジェクトの読み込みに失敗したよ。');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (!selectedId) return;
    const target = items.find(t => t.id === selectedId);
    const ok = window.confirm(`「${target?.name || '（無名）'}」を削除する？（戻せないよ）`);
    if (!ok) return;
    setBusy(true);
    try {
      await deleteProjectById(selectedId);
      await refresh();
    } catch (e) {
      console.error('Delete project failed', e);
      setStatusText('削除に失敗しちゃった…');
    } finally {
      setBusy(false);
    }
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    try {
      const err = getProjectImportError(file);
      if (err) {
        setStatusText(err);
        return;
      }
      const text = await file.text();
      const textErr = getProjectJsonTextError(text);
      if (textErr) {
        setStatusText(textErr);
        return;
      }
      const data = await deserializeProject(text);
      onLoadProject(data);
      onClose();
    } catch (err) {
      console.error('Project import failed', err);
      setStatusText('プロジェクトの読み込みに失敗しました。');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm project-manager-overlay">
      <div className="w-full max-w-5xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden project-manager-panel glass-strong idle-sidebar-typography">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex flex-col">
            <h3 className="text-slate-200 font-bold text-lg">プロジェクト管理</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 border border-white/15 bg-white/10 text-slate-200 hover:bg-white/20 hover:text-white active:bg-white/30 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

	        <div className="p-5">
	          {statusText && (
	            <div className="mb-3 bg-red-900/20 border border-red-900/50 text-red-300 text-sm rounded-xl px-4 py-3" role="alert">
	              {statusText}
	            </div>
	          )}
	          {items.length === 0 ? (
	            <div className="p-8 glass-thin border border-black/10 rounded-xl text-center text-slate-400 text-sm">
	              まだ保存したプロジェクトが無いよ。<br />
	              編集画面で「名前をつけて保存」したらここに出るよ〜
	            </div>
	          ) : (
	            <>
	              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
	                {items.map(p => {
	                  const selected = p.id === selectedId;
	                  return (
	                  <button
	                      key={p.id}
	                      type="button"
	                      onClick={() => { setStatusText(''); setSelectedId(p.id); }}
	                      onDoubleClick={() => handleLoadById(p.id)}
	                      className={`text-left border rounded-xl overflow-hidden transition-colors glass-thin ${
	                        selected ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-black/10'
	                      }`}
	                    >
	                    <div className="relative w-full aspect-video bg-black/10">
	                        {p.thumbnailUrl ? (
	                          <img src={p.thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-contain" />
	                        ) : (
	                          <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-xs">
	                            サムネなし
	                          </div>
	                        )}
	                        <div className="absolute bottom-2 right-2 text-[10px] bg-white/25 text-slate-700 px-2 py-0.5 rounded border border-black/10">
	                          {p.slideCount}枚
	                        </div>
	                      </div>
	                      <div className="p-2">
	                        <div className="text-[13px] text-slate-200 font-bold truncate">{p.name || '（無名）'}</div>
	                        <div className="text-[11px] text-slate-400 mt-1">
	                          更新: {formatDateTime(p.updatedAt)}
	                        </div>
	                        <div className="text-[11px] text-slate-400 mt-1">
	                          容量: {formatBytes(p.approxBytes || 0)}
	                        </div>
	                      </div>
	                    </button>
	                  );
	                })}
	              </div>
	              {!selectedId && (
	                <div className="mt-3 text-[11px] text-slate-400 font-medium" role="status" aria-live="polite">
	                  ヒント：プロジェクトを選択してから「開く」を押してね
	                </div>
	              )}
	            </>
	          )}
	        </div>

        <div className="px-5 py-4 border-t border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept=".json,application/json"
              ref={fileInputRef}
              className="hidden"
              onChange={handleImportJson}
            />
	            <button
	              onClick={() => fileInputRef.current?.click()}
	              disabled={busy}
	              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs idle-btn-glass"
	            >
	              JSONから開く
	            </button>
            <button
              onClick={refresh}
              disabled={busy}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs idle-btn-glass"
            >
              更新
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={busy}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold idle-btn-glass"
            >
              新規作成
            </button>
            <button
              onClick={handleDeleteSelected}
              disabled={busy || !selectedId}
              className="px-4 py-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 rounded-lg text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              削除
            </button>
	            <button
	              onClick={() => selectedId && handleLoadById(selectedId)}
	              disabled={busy || !selectedId}
	              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
	            >
	              開く
	            </button>
	          </div>
	        </div>
      </div>
    </div>
  );
};

export default ProjectManagerModal;
