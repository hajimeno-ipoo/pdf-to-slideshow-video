
import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Slide, VideoSettings, BgmTimeRange, FadeOptions, TokenUsage, ProjectData, DuckingOptions, CustomFont } from '../types';
import { serializeProject, deserializeProject } from '../utils/fileUtils';
import { getExportSupportError } from '../utils/exportSupport';
import { saveNamedProject } from '../services/projectStorage';
import { getProjectImportError, getProjectJsonTextError } from '../utils/projectFileImport';
import PreviewPlayer from './PreviewPlayer';
import TimelineEditor from './TimelineEditor';
import { EditorProvider, useEditor } from './slideEditor/SlideEditorContext';
import { Toolbar } from './slideEditor/Toolbar';
import ProjectSettings from './ProjectSettings';
import SlideInspector from './SlideInspector';
import { SlideGrid } from './slideEditor/SlideGrid';
import { useToast } from './ToastProvider';

// Layout Component
const SlideEditorLayout: React.FC<{
  onStartConversion: (
    bgmFile: File | null, 
    fadeOptions: FadeOptions,
    videoSettings: VideoSettings,
    bgmTimeRange?: BgmTimeRange,
    bgmVolume?: number,
    globalAudioFile?: File | null,
    globalAudioVolume?: number,
    duckingOptions?: DuckingOptions
  ) => void;
  onUsageUpdate?: (usage: TokenUsage) => void;
  onLoadProject?: (data: ProjectData) => void;
  onOpenProjectManager?: () => void;
  aiEnabled: boolean;
	}> = ({ onStartConversion, onUsageUpdate, onLoadProject, onOpenProjectManager, aiEnabled }) => {
	  const { pushToast } = useToast();
	  const { 
	      slides, updateSlides, undo, redo, canUndo, canRedo,
	      videoSettings, 
	      bgmFile, bgmRange, bgmVolume, fadeOptions,
      globalAudioFile, globalAudioVolume,
      duckingOptions,
      customFonts,
      sourceFile,
      selectedSlideId, setSelectedSlideId
  } = useEditor();

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSavingNamed, setIsSavingNamed] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [openTopMenu, setOpenTopMenu] = useState<null | 'file' | 'edit'>(null);
  const [topMenuAnchor, setTopMenuAnchor] = useState<null | { top: number; left: number; bottom: number }>(null);
  const [slideListViewMode, setSlideListViewMode] = useState<'grid' | 'coverflow'>('grid');
  const projectInputRef = useRef<HTMLInputElement>(null);
  const topMenuRef = useRef<HTMLDivElement>(null);
  const topMenuPortalRef = useRef<HTMLDivElement>(null);
  const fileMenuBtnRef = useRef<HTMLButtonElement>(null);
  const editMenuBtnRef = useRef<HTMLButtonElement>(null);

  const selectedSlide = slides.find(s => s.id === selectedSlideId);

  // Initial Responsive Check
  useEffect(() => {
      // Mobile: Start closed. Desktop: Start open.
      if (window.innerWidth < 1024) {
          setIsInspectorOpen(false);
      } else {
          setIsInspectorOpen(true);
      }
  }, []);

	  useEffect(() => {
	      const handleKeyDown = (e: KeyboardEvent) => {
	          if (isPreviewOpen) return;
	          const target = e.target as HTMLElement;
	          if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
	          if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
	              e.preventDefault();
	              if (e.shiftKey) redo(); else undo();
	          }
	          if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
	      };
	      window.addEventListener('keydown', handleKeyDown);
	      return () => window.removeEventListener('keydown', handleKeyDown);
	  }, [undo, redo, isPreviewOpen]);

	  // Top menu: close on outside click / ESC
	  useEffect(() => {
	      if (!openTopMenu) return;

	      const handlePointerDown = (e: MouseEvent) => {
	          const target = e.target as Node | null;
	          if (!target) return;
	          if (topMenuRef.current && topMenuRef.current.contains(target)) return;
	          if (topMenuPortalRef.current && topMenuPortalRef.current.contains(target)) return;
	          setOpenTopMenu(null);
	      };

	      const handleKeyDown = (e: KeyboardEvent) => {
	          if (e.key === 'Escape') setOpenTopMenu(null);
	      };

	      document.addEventListener('mousedown', handlePointerDown);
	      document.addEventListener('keydown', handleKeyDown);
	      return () => {
	          document.removeEventListener('mousedown', handlePointerDown);
	          document.removeEventListener('keydown', handleKeyDown);
	      };
	  }, [openTopMenu]);

	  // Keep the portal menu positioned under the active button
	  useEffect(() => {
	      if (!openTopMenu) {
	          setTopMenuAnchor(null);
	          return;
	      }
	      const btn = openTopMenu === 'file' ? fileMenuBtnRef.current : editMenuBtnRef.current;
	      if (!btn) return;

	      const update = () => {
	          const rect = btn.getBoundingClientRect();
	          setTopMenuAnchor({ top: rect.top, left: rect.left, bottom: rect.bottom });
	      };

	      update();
	      window.addEventListener('resize', update);
	      window.addEventListener('scroll', update, true);
	      return () => {
	          window.removeEventListener('resize', update);
	          window.removeEventListener('scroll', update, true);
	      };
	  }, [openTopMenu]);

	  // Open inspector when selection changes to a specific slide
	  useEffect(() => {
	      if (selectedSlideId) {
	          setIsInspectorOpen(true);
      }
  }, [selectedSlideId]);

  const handleUpdateSlide = (updatedSlide: Slide, addToHistory: boolean = true) => {
      const index = slides.findIndex(s => s.id === updatedSlide.id);
      if (index !== -1) {
          const newSlides = [...slides];
          newSlides[index] = updatedSlide;
          updateSlides(newSlides, addToHistory);
      }
  };

  const handleSlideSelect = (id: string | null) => {
      if (id && id === selectedSlideId) {
          // Deselecting
          setSelectedSlideId(null);
          if (window.innerWidth < 1024) {
              setIsInspectorOpen(false);
          }
      } else {
          setSelectedSlideId(id);
          setIsInspectorOpen(true);
      }
  };

	  const handleExportProject = async () => {
	      setIsExporting(true);
	      try {
          const projectData: ProjectData = {
              slides, customFonts, sourceFile, videoSettings, bgmFile, bgmTimeRange: bgmRange, bgmVolume, globalAudioFile, globalAudioVolume, fadeOptions, duckingOptions, updatedAt: Date.now()
          };
          const json = await serializeProject(projectData);
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
	          const a = document.createElement('a');
	          a.href = url; a.download = `project_${new Date().toISOString().slice(0,10)}.json`;
	          document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
	      } catch (e) {
	        console.error("Export failed", e);
	        pushToast({ kind: 'error', message: 'プロジェクトの保存に失敗しました。' });
	      } finally { setIsExporting(false); }
	  };

	  const handleSaveNamedProject = async () => {
	      if (!slides || slides.length === 0) {
	          pushToast({ kind: 'warning', message: 'スライドが無いと保存できないよ。' });
	          return;
	      }

      const defaultName = `project_${new Date().toISOString().slice(0, 19).replace('T', '_')}`;
      const name = window.prompt('プロジェクト名を入れてね！', defaultName);
      if (!name || !name.trim()) return;

      setIsSavingNamed(true);
	      try {
          const projectData: ProjectData = {
              slides,
              customFonts,
              sourceFile,
              videoSettings,
              bgmFile,
              bgmTimeRange: bgmRange,
              bgmVolume,
              globalAudioFile,
              globalAudioVolume,
              fadeOptions,
              duckingOptions,
              updatedAt: Date.now()
          };
	          const savedId = await saveNamedProject(name.trim(), projectData);
	          if (!savedId) {
	              pushToast({ kind: 'error', message: '保存に失敗しちゃった…' });
	              return;
	          }
	          pushToast({ kind: 'success', message: '保存できたよ〜！' });
	      } catch (e) {
	          console.error('Named save failed', e);
	          pushToast({ kind: 'error', message: '保存に失敗しちゃった…' });
	      } finally {
	          setIsSavingNamed(false);
	      }
	  };

  const handleImportProject = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      setIsImporting(true);
	      try {
	          const err = getProjectImportError(file);
	          if (err) {
	              pushToast({ kind: 'error', message: err });
	              return;
	          }
	          const text = await file.text();
	          const textErr = getProjectJsonTextError(text);
	          if (textErr) {
	              pushToast({ kind: 'error', message: textErr });
	              return;
	          }
	          const data = await deserializeProject(text);
	          if (onLoadProject) onLoadProject(data);
	      } catch (e) {
	        console.error("Import failed", e);
	        pushToast({ kind: 'error', message: 'プロジェクトの読み込みに失敗しました。' });
	      } finally { setIsImporting(false); if (projectInputRef.current) projectInputRef.current.value = ''; }
	  };

  const handleStartClick = () => {
    const requiresAudio = !!bgmFile || !!globalAudioFile || slides.some(s => s.audioFile);
    const supportError = getExportSupportError(
      typeof window === 'undefined' ? null : window,
      { requireAudio: requiresAudio }
	    );
	    if (supportError) {
	      pushToast({ kind: 'error', message: supportError });
	      return;
	    }

    onStartConversion(
      bgmFile,
      fadeOptions,
      videoSettings,
      bgmFile ? bgmRange : undefined,
      bgmVolume,
      globalAudioFile,
      globalAudioVolume,
      duckingOptions
    );
  };

  const handleToggleInspector = () => {
      if (isInspectorOpen) {
          setIsInspectorOpen(false);
      } else {
          setIsInspectorOpen(true);
      }
  };

  const handleCloseInspectorMobile = () => {
      setIsInspectorOpen(false);
  };

		  return (
		    <>
		      {openTopMenu && topMenuAnchor && ReactDOM.createPortal(
		        <div
		          ref={topMenuPortalRef}
		          style={{
		            position: 'fixed',
		            top: topMenuAnchor.bottom + 8,
		            left: Math.min(
		              window.innerWidth - 240,
		              Math.max(8, topMenuAnchor.left)
		            ),
		            zIndex: 9999
		          }}
		        >
		          {openTopMenu === 'file' ? (
		            <div role="menu" className="idle-portal-menu w-56 rounded-xl p-1">
		              <button
		                type="button"
		                role="menuitem"
		                onClick={() => {
		                  setOpenTopMenu(null);
		                  projectInputRef.current?.click();
		                }}
		                disabled={isImporting}
		                className="idle-portal-menu-item w-full text-left px-3 py-2 text-xs rounded-lg flex items-center justify-between gap-3"
		              >
		                <span className="flex items-center gap-2">{isImporting ? <span className="animate-spin">↻</span> : null}読込</span>
		                <span className="idle-portal-menu-muted text-[10px]">JSON</span>
		              </button>

		              <button
		                type="button"
		                role="menuitem"
		                onClick={() => {
		                  setOpenTopMenu(null);
		                  handleExportProject();
		                }}
		                disabled={isExporting}
		                className="idle-portal-menu-item w-full text-left px-3 py-2 text-xs rounded-lg flex items-center justify-between gap-3"
		              >
		                <span className="flex items-center gap-2">{isExporting ? <span className="animate-spin">↻</span> : null}保存</span>
		                <span className="idle-portal-menu-muted text-[10px]">JSON</span>
		              </button>

		              <button
		                type="button"
		                role="menuitem"
		                onClick={() => {
		                  setOpenTopMenu(null);
		                  handleSaveNamedProject();
		                }}
		                disabled={isSavingNamed}
		                className="idle-portal-menu-item w-full text-left px-3 py-2 text-xs rounded-lg flex items-center justify-between gap-3"
		              >
		                <span className="flex items-center gap-2">{isSavingNamed ? <span className="animate-spin">↻</span> : null}名前をつけて保存</span>
		                <span className="idle-portal-menu-muted text-[10px]">local</span>
		              </button>

		              <div className="h-px bg-black/10 my-1" />

		              <button
		                type="button"
		                role="menuitem"
		                onClick={() => {
		                  setOpenTopMenu(null);
		                  onOpenProjectManager?.();
		                }}
		                disabled={!onOpenProjectManager}
		                className="idle-portal-menu-item w-full text-left px-3 py-2 text-xs rounded-lg"
		              >
		                プロジェクト管理
		              </button>
		            </div>
		          ) : (
		            <div role="menu" className="idle-portal-menu w-56 rounded-xl p-1">
		              <button
		                type="button"
		                role="menuitem"
		                onClick={() => {
		                  setOpenTopMenu(null);
		                  undo();
		                }}
		                disabled={!canUndo}
		                className="idle-portal-menu-item w-full text-left px-3 py-2 text-xs rounded-lg flex items-center justify-between gap-3"
		              >
		                <span>元に戻す</span>
		                <span className="idle-portal-menu-muted text-[10px]">Ctrl+Z</span>
		              </button>
		              <button
		                type="button"
		                role="menuitem"
		                onClick={() => {
		                  setOpenTopMenu(null);
		                  redo();
		                }}
		                disabled={!canRedo}
		                className="idle-portal-menu-item w-full text-left px-3 py-2 text-xs rounded-lg flex items-center justify-between gap-3"
		              >
		                <span>やり直し</span>
		                <span className="idle-portal-menu-muted text-[10px]">Ctrl+Y</span>
		              </button>
		            </div>
		          )}
		        </div>,
		        document.body
		      )}

		      <div className="w-full h-full flex flex-row gap-3 relative">
		        {/* Left Column: 3 cards (Top controls / Grid / Timeline) */}
			        <div className="flex-1 flex flex-col min-w-0 h-full gap-3">
			          {/* Card 1: Buttons + Global settings + Add slide */}
			          <div className="editor-glass editor-glass--mid rounded-2xl border border-white/10 shadow-2xl overflow-visible flex-none idle-sidebar-typography">
			            <div className="editor-glass-pane editor-glass-pane--strong flex-none flex justify-between items-center p-3 border-b border-slate-800 bg-transparent overflow-x-auto gap-4 scrollbar-hide">
				              <div ref={topMenuRef} className="flex items-center gap-2 flex-shrink-0">
				                <input type="file" ref={projectInputRef} accept=".json" className="hidden" onChange={handleImportProject} />

				                <div className="relative">
			                  <button
			                    ref={fileMenuBtnRef}
			                    type="button"
			                    onClick={() => setOpenTopMenu((v) => (v === 'file' ? null : 'file'))}
			                    className="px-3 py-1.5 bg-slate-800/70 hover:bg-slate-700/70 text-slate-200 hover:text-white text-xs font-bold rounded border border-white/10 transition-colors flex items-center gap-1 whitespace-nowrap"
			                    aria-haspopup="menu"
			                    aria-expanded={openTopMenu === 'file'}
			                  >
			                    ファイル <span className="text-[10px] opacity-70">▾</span>
			                  </button>
				                </div>

				                <div className="relative">
			                  <button
			                    ref={editMenuBtnRef}
			                    type="button"
			                    onClick={() => setOpenTopMenu((v) => (v === 'edit' ? null : 'edit'))}
			                    className="px-3 py-1.5 bg-slate-800/70 hover:bg-slate-700/70 text-slate-200 hover:text-white text-xs font-bold rounded border border-white/10 transition-colors flex items-center gap-1 whitespace-nowrap"
			                    aria-haspopup="menu"
			                    aria-expanded={openTopMenu === 'edit'}
			                  >
			                    編集 <span className="text-[10px] opacity-70">▾</span>
			                  </button>
				                </div>
				              </div>

	              <div className="flex gap-2 items-center flex-shrink-0">
	                <button onClick={() => setIsPreviewOpen(true)} className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded shadow transition-colors whitespace-nowrap"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" /></svg><span className="hidden sm:inline">全画面</span>プレビュー</button>
		                <button
		                  onClick={handleStartClick}
		                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded shadow transition-colors whitespace-nowrap idle-btn-primary"
		                >
		                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 012.25-2.25h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0021 18v-1.94l-2.69-2.689a1.5 1.5 0 00-2.12 0l-.88.879.97.97a.75.75 0 11-1.06 1.06l-5.16-5.159a1.5 1.5 0 00-2.12 0L3 16.061zm10.125-7.81a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0z" clipRule="evenodd" /></svg>
		                  書き出し
		                </button>

	                <div className="w-px h-6 bg-slate-700 mx-2"></div>

	                <button
	                  onClick={handleToggleInspector}
	                  className={`p-1.5 rounded transition-colors ${isInspectorOpen ? 'bg-slate-700 text-white shadow-inner' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
	                  title={isInspectorOpen ? "設定を閉じる" : "設定を開く"}
	                >
	                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
	                    <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 01-.75-.75z" clipRule="evenodd" />
	                  </svg>
	                </button>
	              </div>
	            </div>

	            <div className="flex-none p-3 pb-0">
	              <Toolbar />
	            </div>
	          </div>

		          {/* Card 2: Slide grid */}
			          <div className="editor-glass editor-glass--thin rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col flex-1 min-h-0 idle-sidebar-typography">
				            <div className="editor-glass-pane editor-glass-pane--thin flex items-center justify-end gap-2 px-3 py-2 border-b border-white/10">
				              <div className="flex items-center gap-2">
				                <div className="text-[11px] text-slate-300 font-bold tracking-wide">スライド</div>
				                {slideListViewMode === 'coverflow' ? (
				                  <div className="text-[10px] font-bold text-sky-400">カバーフロー</div>
			                ) : (
			                  <div className="text-[10px] font-bold text-slate-500">グリッド</div>
			                )}
			              </div>
			              <button
			                type="button"
			                role="switch"
		                aria-checked={slideListViewMode === 'coverflow'}
		                aria-label="カバーフロー表示を切り替え"
		                onClick={() => setSlideListViewMode(v => (v === 'grid' ? 'coverflow' : 'grid'))}
		                className={`idle-toggle-switch relative inline-flex h-5 w-9 items-center rounded-full border transition-colors ${
		                  slideListViewMode === 'coverflow'
		                    ? 'bg-sky-600/80 border-sky-500/60'
		                    : 'bg-slate-700/80 border-white/10'
		                }`}
		              >
		                <span
		                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
		                    slideListViewMode === 'coverflow' ? 'translate-x-4' : 'translate-x-1'
		                  }`}
		                />
		              </button>
		            </div>
			            <div className={`editor-glass-pane editor-glass-pane--mid flex-1 min-h-0 custom-scrollbar ${slideListViewMode === 'coverflow' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
			              <SlideGrid onSelect={handleSlideSelect} selectedId={selectedSlideId} viewMode={slideListViewMode} />
			            </div>
			          </div>

	          {/* Card 3: Timeline */}
	          <div className="editor-glass editor-glass--strong rounded-2xl border border-white/10 shadow-2xl overflow-visible flex-none h-[300px] relative idle-sidebar-typography">
	            <TimelineEditor 
	              slides={slides} 
	              onUpdateSlides={(updatedSlides) => updateSlides(updatedSlides, true)}
	              bgmFile={bgmFile}
	              bgmTimeRange={bgmRange}
	              bgmVolume={bgmVolume}
	              globalAudioFile={globalAudioFile}
	              globalAudioVolume={globalAudioVolume}
	              defaultTransitionDuration={videoSettings.transitionDuration}
	              duckingOptions={duckingOptions}
	              videoSettings={videoSettings}
	            />
	          </div>
	        </div>

	        {/* Right Column: Sidebar card (Project settings / Inspector) */}
	        <div 
	          className={`
	            editor-glass editor-glass--strong rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col 
	            transition-all duration-300 ease-in-out z-50
	            absolute inset-0 lg:relative lg:inset-auto lg:h-full lg:shadow-2xl
	            ${isInspectorOpen 
	              ? 'translate-x-0 w-full lg:w-[400px] opacity-100' 
	              : 'translate-x-full lg:translate-x-0 w-full lg:w-0 lg:opacity-0 lg:border-0 lg:shadow-none'
	            }
	          `}
	        >
	          <div className="w-full h-full flex flex-col min-w-[320px]">
	            {selectedSlideId && selectedSlide ? (
		              <div className="flex flex-col h-full relative">
		                <SlideInspector 
		                  isOpen={isInspectorOpen}
		                  slide={selectedSlide} 
		                  onUpdate={handleUpdateSlide} 
		                  onUsageUpdate={onUsageUpdate}
		                  aiEnabled={aiEnabled}
	                  sourceFile={sourceFile}
	                  onClose={handleCloseInspectorMobile}
	                />
	              </div>
	            ) : (
	              <ProjectSettings onClose={handleCloseInspectorMobile} />
	            )}
	          </div>
	        </div>
	      </div>

	      {isPreviewOpen && (
	        <PreviewPlayer 
	            isOpen={isPreviewOpen} 
            onClose={() => setIsPreviewOpen(false)} 
            slides={slides} 
            sourceFile={sourceFile} 
            videoSettings={videoSettings} 
            bgmFile={bgmFile} 
            bgmTimeRange={bgmRange} 
            bgmVolume={bgmVolume} 
            fadeOptions={fadeOptions} 
            globalAudioFile={globalAudioFile} 
            globalAudioVolume={globalAudioVolume} 
            duckingOptions={duckingOptions} 
        />
      )}
    </>
  );
};

interface SlideEditorProps {
  aiEnabled: boolean;
  slides: Slide[];
  onUpdateSlides: (slides: Slide[]) => void;
  customFonts: CustomFont[];
  onUpdateCustomFonts: (fonts: CustomFont[]) => void;
  onStartConversion: (
    bgmFile: File | null, 
    fadeOptions: FadeOptions,
    videoSettings: VideoSettings,
    bgmTimeRange?: BgmTimeRange,
    bgmVolume?: number,
    globalAudioFile?: File | null,
    globalAudioVolume?: number,
    duckingOptions?: DuckingOptions
  ) => void;
  isProcessing: boolean;
  sourceFile: File | null;
  initialSettings?: VideoSettings;
  initialBgmFile?: File | null;
  initialFadeOptions?: FadeOptions;
  initialBgmTimeRange?: BgmTimeRange;
  initialBgmVolume?: number;
  initialGlobalAudioFile?: File | null;
  initialGlobalAudioVolume?: number;
  initialDuckingOptions?: DuckingOptions;
  onUsageUpdate?: (usage: TokenUsage) => void;
  onLoadProject?: (data: ProjectData) => void;
  onAutoSave?: (status: 'idle' | 'pending' | 'saving' | 'saved', time?: Date) => void;
  onOpenProjectManager?: () => void;
}

const SlideEditor: React.FC<SlideEditorProps> = (props) => {
  return (
    <EditorProvider 
      slides={props.slides} 
      onUpdateSlides={props.onUpdateSlides} 
      customFonts={props.customFonts}
      onUpdateCustomFonts={props.onUpdateCustomFonts}
      initialSettings={props.initialSettings}
      initialBgmFile={props.initialBgmFile}
      initialFadeOptions={props.initialFadeOptions}
      initialBgmTimeRange={props.initialBgmTimeRange}
      initialBgmVolume={props.initialBgmVolume}
      initialGlobalAudioFile={props.initialGlobalAudioFile}
      initialGlobalAudioVolume={props.initialGlobalAudioVolume}
      initialDuckingOptions={props.initialDuckingOptions}
      sourceFile={props.sourceFile}
      onAutoSave={props.onAutoSave}
	    >
	      <SlideEditorLayout 
	        onStartConversion={props.onStartConversion} 
	        onUsageUpdate={props.onUsageUpdate}
	        onLoadProject={props.onLoadProject}
	        onOpenProjectManager={props.onOpenProjectManager}
	        aiEnabled={props.aiEnabled}
	      />
	    </EditorProvider>
	  );
};

export default SlideEditor;
