
import React, { useState, useRef, useEffect } from 'react';
import { Slide, VideoSettings, BgmTimeRange, FadeOptions, TokenUsage, ProjectData, DuckingOptions } from '../types';
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
  const { 
      slides, updateSlides, undo, redo, canUndo, canRedo,
      videoSettings, 
      bgmFile, bgmRange, bgmVolume, fadeOptions,
      globalAudioFile, globalAudioVolume,
      duckingOptions,
      sourceFile,
      selectedSlideId, setSelectedSlideId
  } = useEditor();

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSavingNamed, setIsSavingNamed] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const projectInputRef = useRef<HTMLInputElement>(null);

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

  // Open inspector when selection changes to a specific slide
  useEffect(() => {
      if (selectedSlideId) {
          setIsInspectorOpen(true);
      }
  }, [selectedSlideId]);

  const handleUpdateSlide = (updatedSlide: Slide) => {
      const index = slides.findIndex(s => s.id === updatedSlide.id);
      if (index !== -1) {
          const newSlides = [...slides];
          newSlides[index] = updatedSlide;
          updateSlides(newSlides, true);
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
              slides, sourceFile, videoSettings, bgmFile, bgmTimeRange: bgmRange, bgmVolume, globalAudioFile, globalAudioVolume, fadeOptions, duckingOptions, updatedAt: Date.now()
          };
          const json = await serializeProject(projectData);
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = `project_${new Date().toISOString().slice(0,10)}.json`;
          document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      } catch (e) { console.error("Export failed", e); alert("プロジェクトの保存に失敗しました。"); } finally { setIsExporting(false); }
  };

  const handleSaveNamedProject = async () => {
      if (!slides || slides.length === 0) {
          alert('スライドが無いと保存できないよ。');
          return;
      }

      const defaultName = `project_${new Date().toISOString().slice(0, 19).replace('T', '_')}`;
      const name = window.prompt('プロジェクト名を入れてね！', defaultName);
      if (!name || !name.trim()) return;

      setIsSavingNamed(true);
      try {
          const projectData: ProjectData = {
              slides,
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
              alert('保存に失敗しちゃった…');
              return;
          }
          alert('保存できたよ〜！');
      } catch (e) {
          console.error('Named save failed', e);
          alert('保存に失敗しちゃった…');
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
              alert(err);
              return;
          }
          const text = await file.text();
          const textErr = getProjectJsonTextError(text);
          if (textErr) {
              alert(textErr);
              return;
          }
          const data = await deserializeProject(text);
          if (onLoadProject) onLoadProject(data);
      } catch (e) { console.error("Import failed", e); alert("プロジェクトの読み込みに失敗しました。"); } finally { setIsImporting(false); if (projectInputRef.current) projectInputRef.current.value = ''; }
  };

  const handleStartClick = () => {
    const requiresAudio = !!bgmFile || !!globalAudioFile || slides.some(s => s.audioFile);
    const supportError = getExportSupportError(
      typeof window === 'undefined' ? null : window,
      { requireAudio: requiresAudio }
    );
    if (supportError) {
      alert(supportError);
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
	      <div className="w-full h-full flex flex-row gap-3 relative">
	        {/* Left Column: 3 cards (Top controls / Grid / Timeline) */}
	        <div className="flex-1 flex flex-col min-w-0 h-full gap-3">
	          {/* Card 1: Buttons + Global settings + Add slide */}
	          <div className="editor-glass editor-glass--mid rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex-none">
	            <div className="editor-glass-pane editor-glass-pane--strong flex-none flex justify-between items-center p-3 border-b border-slate-800 bg-transparent overflow-x-auto gap-4 scrollbar-hide">
	              <div className="flex items-center gap-2 flex-shrink-0">
	                <input type="file" ref={projectInputRef} accept=".json" className="hidden" onChange={handleImportProject} />
	                <button onClick={() => projectInputRef.current?.click()} disabled={isImporting} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs rounded border border-slate-700 transition-colors flex items-center gap-1 whitespace-nowrap">
	                  {isImporting ? <span className="animate-spin">↻</span> : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path d="M9.25 13.25a.75.75 0 001.5 0V4.636l2.955 3.129a.75.75 0 001.09-1.03l-4.25-4.5a.75.75 0 00-1.09 0l-4.25 4.5a.75.75 0 101.09 1.03L9.25 4.636v8.614z" /><path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0118 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" /></svg>} 読込
	                </button>
	                <button onClick={handleExportProject} disabled={isExporting} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs rounded border border-slate-700 transition-colors flex items-center gap-1 whitespace-nowrap">
	                  {isExporting ? <span className="animate-spin">↻</span> : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" /><path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" /></svg>} 保存
	                </button>
	                <button onClick={handleSaveNamedProject} disabled={isSavingNamed} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs rounded border border-slate-700 transition-colors flex items-center gap-1 whitespace-nowrap">
	                  {isSavingNamed ? <span className="animate-spin">↻</span> : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M4.75 3A1.75 1.75 0 003 4.75v10.5A1.75 1.75 0 004.75 17h10.5A1.75 1.75 0 0017 15.25V7.621a1.75 1.75 0 00-.513-1.237l-2.871-2.871A1.75 1.75 0 0012.379 3H4.75zM6.5 4.5a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5h-4.5a.75.75 0 01-.75-.75zm0 4a.75.75 0 01.75-.75h6.5a.75.75 0 010 1.5h-6.5a.75.75 0 01-.75-.75zm0 4a.75.75 0 01.75-.75h6.5a.75.75 0 010 1.5h-6.5a.75.75 0 01-.75-.75z" clipRule="evenodd" /></svg>} 名前をつけて保存
	                </button>
	                <button onClick={onOpenProjectManager} disabled={!onOpenProjectManager} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs rounded border border-slate-700 transition-colors flex items-center gap-1 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed">
	                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M2 4.75A2.75 2.75 0 014.75 2h7.69a2.75 2.75 0 011.944.806l2.81 2.81A2.75 2.75 0 0118 7.56v7.69A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25V4.75zm2.75-1.25c-.69 0-1.25.56-1.25 1.25v10.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25V7.56c0-.332-.132-.65-.366-.884l-2.81-2.81A1.25 1.25 0 0011.19 3.5H4.75z" clipRule="evenodd" /></svg>
	                  プロジェクト管理
	                </button>

	                <div className="w-px h-5 bg-slate-700 mx-1"></div>

	                <button onClick={undo} disabled={!canUndo} className={`p-1.5 rounded border transition-colors ${!canUndo ? 'bg-slate-800 text-slate-600 border-slate-800 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border-slate-700'}`} title="元に戻す (Ctrl+Z)">
	                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M7.793 2.232a.75.75 0 01-.025 1.06L3.622 7.25h10.003a5.375 5.375 0 010 10.75H10.75a.75.75 0 010-1.5h2.875a3.875 3.875 0 000-7.75H3.622l4.146 3.957a.75.75 0 01-1.036 1.085l-5.5-5.25a.75.75 0 010-1.085l5.5-5.25a.75.75 0 011.06.025z" clipRule="evenodd" /></svg>
	                </button>
	                <button onClick={redo} disabled={!canRedo} className={`p-1.5 rounded border transition-colors ${!canRedo ? 'bg-slate-800 text-slate-600 border-slate-800 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border-slate-700'}`} title="やり直し (Ctrl+Y / Ctrl+Shift+Z)">
	                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5" style={{ transform: 'scaleX(-1)' }}><path fillRule="evenodd" d="M7.793 2.232a.75.75 0 01-.025 1.06L3.622 7.25h10.003a5.375 5.375 0 010 10.75H10.75a.75.75 0 010-1.5h2.875a3.875 3.875 0 000-7.75H3.622l4.146 3.957a.75.75 0 01-1.036 1.085l-5.5-5.25a.75.75 0 010-1.085l5.5-5.25a.75.75 0 011.06.025z" clipRule="evenodd" /></svg>
	                </button>
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
	          <div className="editor-glass editor-glass--thin rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex-1 min-h-0">
	            <div className="flex-1 overflow-y-auto custom-scrollbar h-full">
	              <SlideGrid onSelect={handleSlideSelect} selectedId={selectedSlideId} />
	            </div>
	          </div>

	          {/* Card 3: Timeline */}
	          <div className="editor-glass editor-glass--strong rounded-2xl border border-white/10 shadow-2xl overflow-visible flex-none h-[300px] relative">
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
