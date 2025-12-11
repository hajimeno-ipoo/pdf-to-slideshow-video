
import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import FileUpload from './components/FileUpload';
import ProcessingStep from './components/ProcessingStep';
import SlideEditor from './components/SlideEditor';
import RestoreModal from './components/RestoreModal';
import CooldownNotification from './components/CooldownNotification';
import { AppStatus, ProcessingState, Slide, VideoSettings, AspectRatio, TransitionType, BgmTimeRange, ApiConnectionStatus, TokenUsage, ProjectData, RequestStats, DuckingOptions } from './types';
import { analyzePdf, generateVideoFromSlides } from './services/pdfVideoService';
import { checkApiConnection, setApiRequestListener, setApiCooldownListener } from './services/geminiService';
import { loadProject, saveProject, clearProject } from './services/projectStorage';

const LIFETIME_TOKENS_KEY = 'pdf_video_creator_lifetime_tokens';
const RPD_KEY = 'pdf_video_creator_rpd_counter';

const App: React.FC = () => {
  const [state, setState] = useState<ProcessingState>({
    status: AppStatus.IDLE
  });
  const [slides, setSlides] = useState<Slide[]>([]);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  
  // API Status & Usage State
  const [apiStatus, setApiStatus] = useState<ApiConnectionStatus>('checking');
  const [totalUsage, setTotalUsage] = useState<TokenUsage>({ totalTokens: 0 }); // Session usage
  const [lifetimeUsage, setLifetimeUsage] = useState<number>(0); // Lifetime usage
  
  // Request Stats (RPM / RPD / TPM)
  const [reqStats, setReqStats] = useState<RequestStats>({ rpm: 0, tpm: 0, rpd: 0 });
  const requestTimestampsRef = useRef<number[]>([]);
  const tokenTimestampsRef = useRef<{time: number, count: number}[]>([]);

  // Cooldown State
  const [cooldown, setCooldown] = useState({ isActive: false, remainingMs: 0, reason: '' });

  // Restore State
  const [restoreData, setRestoreData] = useState<ProjectData | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);

  // Auto-save Status
  const [saveStatus, setSaveStatus] = useState<'idle' | 'pending' | 'saving' | 'saved'>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);

  const handleAutoSaveStatus = (status: 'idle' | 'pending' | 'saving' | 'saved', time?: Date) => {
      setSaveStatus(status);
      if (time) setLastSavedTime(time);
  };

  // Initialize RPD from Local Storage
  useEffect(() => {
      const today = new Date().toLocaleDateString();
      const storedRpd = localStorage.getItem(RPD_KEY);
      let initialRpd = 0;
      
      if (storedRpd) {
          try {
              const parsed = JSON.parse(storedRpd);
              if (parsed.date === today) {
                  initialRpd = parsed.count || 0;
              } else {
                  // New day, reset
                  localStorage.setItem(RPD_KEY, JSON.stringify({ date: today, count: 0 }));
              }
          } catch (e) {
              // error parsing, reset
              localStorage.setItem(RPD_KEY, JSON.stringify({ date: today, count: 0 }));
          }
      }
      setReqStats(prev => ({ ...prev, rpd: initialRpd }));
  }, []);

  // Request Tracking Logic & Cooldown Listener
  useEffect(() => {
      // Listener called whenever Gemini Service makes a request
      setApiRequestListener(() => {
          const now = Date.now();
          requestTimestampsRef.current.push(now);
          
          // Update RPD
          const today = new Date().toLocaleDateString();
          const storedRpd = localStorage.getItem(RPD_KEY);
          let currentRpd = 0;
          if (storedRpd) {
              try {
                  const parsed = JSON.parse(storedRpd);
                  if (parsed.date === today) {
                      currentRpd = parsed.count;
                  }
              } catch(e){}
          }
          const newRpd = currentRpd + 1;
          localStorage.setItem(RPD_KEY, JSON.stringify({ date: today, count: newRpd }));
          
          // Trigger immediate state update for responsiveness
          updateStats();
      });

      // Listener called when cooldown occurs
      setApiCooldownListener((isActive, remainingMs, reason) => {
          setCooldown({ isActive, remainingMs, reason: reason || '' });
      });

      // Periodic cleanup and update for RPM/TPM decay
      const interval = setInterval(() => {
          updateStats();
      }, 1000);

      const updateStats = () => {
          const now = Date.now();
          const windowStart = now - 60000; // 1 minute ago
          
          // RPM
          requestTimestampsRef.current = requestTimestampsRef.current.filter(t => t > windowStart);
          const rpm = requestTimestampsRef.current.length;
          
          // TPM
          tokenTimestampsRef.current = tokenTimestampsRef.current.filter(t => t.time > windowStart);
          const tpm = tokenTimestampsRef.current.reduce((acc, curr) => acc + curr.count, 0);

          // Get latest RPD
          let rpd = 0;
          const stored = localStorage.getItem(RPD_KEY);
          if (stored) {
              try { rpd = JSON.parse(stored).count; } catch(e){}
          }

          setReqStats({ rpm, tpm, rpd });
      };

      return () => clearInterval(interval);
  }, []);

  // Initial Connection Check & Restore Check & Load Lifetime Usage
  useEffect(() => {
      const init = async () => {
          setApiStatus('checking');
          const isConnected = await checkApiConnection();
          setApiStatus(isConnected ? 'connected' : 'error');

          // Load Lifetime Usage
          const storedLifetime = localStorage.getItem(LIFETIME_TOKENS_KEY);
          let initialLifetime = 0;
          
          if (storedLifetime) {
              const parsed = parseInt(storedLifetime, 10);
              if (!isNaN(parsed)) {
                  initialLifetime = parsed;
              }
          }

          if (initialLifetime === 0 && totalUsage.totalTokens > 0) {
              initialLifetime = totalUsage.totalTokens;
              localStorage.setItem(LIFETIME_TOKENS_KEY, initialLifetime.toString());
          }

          setLifetimeUsage(initialLifetime);

          // Check for saved project
          const saved = await loadProject();
          if (saved && saved.slides.length > 0) {
              setRestoreData(saved);
              setShowRestoreModal(true);
          }
      };
      init();
  }, []); // Run only on mount

  const handleUsageUpdate = (usage: TokenUsage) => {
      // Record for TPM Tracking
      const now = Date.now();
      tokenTimestampsRef.current.push({ time: now, count: usage.totalTokens });

      // Update Session Usage
      setTotalUsage(prev => ({
          totalTokens: prev.totalTokens + usage.totalTokens
      }));
      
      // Update Lifetime Usage
      setLifetimeUsage(prev => {
          const newValue = prev + usage.totalTokens;
          localStorage.setItem(LIFETIME_TOKENS_KEY, newValue.toString());
          return newValue;
      });
  };

  const handleRestore = () => {
      if (restoreData) {
          setSlides(restoreData.slides);
          setSourceFile(restoreData.sourceFile);
          setState({
              status: AppStatus.EDITING, // Restore to editing state
              settings: restoreData.videoSettings,
              bgmFile: restoreData.bgmFile,
              bgmTimeRange: restoreData.bgmTimeRange,
              bgmVolume: restoreData.bgmVolume,
              globalAudioFile: restoreData.globalAudioFile,
              globalAudioVolume: restoreData.globalAudioVolume,
              fadeOptions: restoreData.fadeOptions,
              duckingOptions: restoreData.duckingOptions,
          });
          setSaveStatus('saved');
          setLastSavedTime(new Date(restoreData.updatedAt));
      }
      setShowRestoreModal(false);
      setRestoreData(null);
  };
  
  const handleProjectLoad = (data: ProjectData) => {
      setSlides(data.slides);
      setSourceFile(data.sourceFile);
      setState({
          status: AppStatus.EDITING,
          settings: data.videoSettings,
          bgmFile: data.bgmFile,
          bgmTimeRange: data.bgmTimeRange,
          bgmVolume: data.bgmVolume,
          globalAudioFile: data.globalAudioFile,
          globalAudioVolume: data.globalAudioVolume,
          fadeOptions: data.fadeOptions,
          duckingOptions: data.duckingOptions,
      });
      setSaveStatus('saved');
      setLastSavedTime(new Date(data.updatedAt));
  };

  const handleDiscard = async () => {
      await clearProject();
      setShowRestoreModal(false);
      setRestoreData(null);
  };

  // Step 1: Upload & Analyze
  const handleFileSelect = async (file: File, duration: number, transitionType: TransitionType, autoGenerateScript: boolean, customScriptPrompt?: string) => {
    try {
      setSourceFile(file);
      
      setState({ 
        status: AppStatus.ANALYZING, 
        message: 'PDFを解析中...',
        progress: { current: 0, total: 0 }
      });
      
      const analyzedSlides = await analyzePdf(
        file, 
        duration,
        transitionType, // ユーザーの初期設定を各スライドに適用
        (current, total) => {
          setState(prev => ({
            ...prev,
            progress: { current, total }
          }));
        },
        autoGenerateScript,
        handleUsageUpdate, // Pass usage callback
        customScriptPrompt // Pass custom prompt
      );

      setSlides(analyzedSlides);
      setState({ status: AppStatus.EDITING, progress: undefined });

    } catch (error: any) {
      console.error(error);
      setState({ 
        status: AppStatus.ERROR, 
        error: error.message || "予期せぬエラーが発生しました。"
      });
    }
  };

  // Step 2: Edit Slides (Handled by SlideEditor component updating `slides` state)

  // Step 3: Generate Video
  const handleStartConversion = async (
    bgmFile: File | null, 
    fadeOptions: { fadeIn: boolean, fadeOut: boolean },
    videoSettings: VideoSettings,
    bgmTimeRange?: BgmTimeRange,
    bgmVolume: number = 1.0,
    globalAudioFile: File | null = null,
    globalAudioVolume: number = 1.0,
    duckingOptions?: DuckingOptions
  ) => {
    if (!sourceFile && slides.every(s => s.customImageFile)) {
       // All custom images, no source file needed technically but kept for structure
    } else if (!sourceFile && slides.length === 0) {
        return;
    }

    try {
      setState({ 
        status: AppStatus.CONVERTING, 
        message: '動画を作成中...',
        progress: { current: 0, total: slides.length }
      });
      
      const result = await generateVideoFromSlides(
        sourceFile!, // Can be null if using only images, handled in service
        slides,
        bgmFile,
        fadeOptions,
        videoSettings,
        bgmTimeRange,
        bgmVolume,
        globalAudioFile,
        globalAudioVolume,
        (current, total) => {
          setState(prev => ({
            ...prev,
            progress: { current, total }
          }));
        },
        duckingOptions
      );

      setState({ 
        status: AppStatus.COMPLETED, 
        videoUrl: result.url,
        extension: result.extension,
        settings: videoSettings,
        bgmFile: bgmFile,
        bgmTimeRange: bgmTimeRange,
        bgmVolume: bgmVolume,
        globalAudioFile: globalAudioFile,
        globalAudioVolume: globalAudioVolume,
        fadeOptions: fadeOptions,
        duckingOptions: duckingOptions,
        progress: undefined
      });

    } catch (error: any) {
      console.error(error);
      setState({ 
        status: AppStatus.ERROR, 
        error: error.message || "動画生成中にエラーが発生しました。"
      });
    }
  };

  const handleReset = async () => {
    await clearProject(); // Clear Saved Data
    setState({ status: AppStatus.IDLE });
    setSlides([]);
    setSourceFile(null);
    setSaveStatus('idle');
    setLastSavedTime(null);
  };
  
  const handleBackToEdit = () => {
    setState(prev => ({
      ...prev,
      status: AppStatus.EDITING,
      videoUrl: undefined, // 動画URLはクリアするが、settingsなどは保持
      error: undefined,
    }));
  };

  // アスペクト比に応じたプレイヤースタイルを計算
  const getPlayerStyle = (ratio: AspectRatio | undefined) => {
    switch (ratio) {
      case '16:9':
        return { aspectRatio: '16/9', maxWidth: '100%' };
      case '4:3':
        return { aspectRatio: '4/3', maxWidth: '900px' };
      case '1:1':
        return { aspectRatio: '1/1', maxWidth: '600px' };
      case '9:16':
        return { aspectRatio: '9/16', maxWidth: '400px' };
      default:
        return { aspectRatio: '16/9', maxWidth: '100%' };
    }
  };

  const isEditing = state.status === AppStatus.EDITING;

  return (
    <div className="h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-emerald-950/20 text-slate-200 selection:bg-emerald-500/30 flex flex-col overflow-hidden">
      
      {/* Mobile Landscape Warning: 500px以下の高さかつ横画面の場合に表示 */}
      <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col items-center justify-center p-8 text-center hidden [@media(max-height:500px)_and_(orientation:landscape)]:flex h-screen w-screen touch-none">
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-2xl max-w-sm flex flex-col items-center">
              <div className="text-4xl mb-4 animate-bounce">📱↻</div>
              <h2 className="text-xl font-bold text-white mb-2">画面を縦にしてください</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                  このアプリはモバイルの横画面表示には対応していません。<br/>
                  端末を縦向きにしてご利用ください。
              </p>
          </div>
      </div>

      <Header 
        apiStatus={apiStatus} 
        tokenUsage={totalUsage} 
        lifetimeUsage={lifetimeUsage}
        requestStats={reqStats}
        saveStatus={saveStatus}
        lastSavedTime={lastSavedTime}
      />
      
      {/* Global Notification */}
      <CooldownNotification 
          isActive={cooldown.isActive}
          remainingMs={cooldown.remainingMs}
          reason={cooldown.reason}
      />
      
      {/* Main Content Area */}
      <main className={`flex-1 relative w-full flex flex-col ${isEditing ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        
        {/* Restore Modal */}
        <RestoreModal 
            isOpen={showRestoreModal}
            onRestore={handleRestore}
            onDiscard={handleDiscard}
            lastUpdated={restoreData?.updatedAt || 0}
        />

        {/* Editor View */}
        {state.status === AppStatus.EDITING ? (
            <div className="flex-1 w-full h-full p-3 sm:p-4 lg:p-6 overflow-hidden flex flex-col">
                <SlideEditor 
                    slides={slides} 
                    onUpdateSlides={setSlides} 
                    onStartConversion={handleStartConversion}
                    isProcessing={false}
                    sourceFile={sourceFile}
                    initialSettings={state.settings}
                    initialBgmFile={state.bgmFile}
                    initialFadeOptions={state.fadeOptions}
                    initialBgmTimeRange={state.bgmTimeRange}
                    initialBgmVolume={state.bgmVolume}
                    initialGlobalAudioFile={state.globalAudioFile}
                    initialGlobalAudioVolume={state.globalAudioVolume}
                    initialDuckingOptions={state.duckingOptions}
                    onUsageUpdate={handleUsageUpdate}
                    onLoadProject={handleProjectLoad}
                    onAutoSave={handleAutoSaveStatus}
                />
            </div>
        ) : (
            // Non-Editor Views (Landing, Processing, Result)
            <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 items-center pb-24 flex flex-col">
                {/* Hero Section */}
                {state.status === AppStatus.IDLE && (
                <div className="text-center max-w-3xl mx-auto mb-8 space-y-4 animate-fade-in-up px-2">
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white drop-shadow-sm leading-tight">
                    PDF資料を<br className="sm:hidden" />
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-400">
                        動画ファイル
                    </span>
                    に変換
                    </h2>
                    <p className="text-base sm:text-lg text-slate-400 leading-relaxed">
                    PDFの各ページから余白を自動的に除去し、<br className="hidden sm:block"/>
                    編集機能で構成を整えてから動画を作成します。
                    </p>
                </div>
                )}

                {/* Upload Area */}
                {state.status === AppStatus.IDLE && (
                <FileUpload onFileSelect={handleFileSelect} status={state.status} />
                )}

                {/* Processing Status (Analysis or Conversion) */}
                {(state.status === AppStatus.ANALYZING || state.status === AppStatus.CONVERTING) && (
                <ProcessingStep currentStatus={state.status} progress={state.progress} />
                )}

                {/* Error Display */}
                {state.status === AppStatus.ERROR && (
                <div className="mt-10 p-6 bg-red-900/20 border border-red-800 text-red-200 rounded-xl max-w-3xl text-center mx-4 animate-fade-in">
                    <div className="flex justify-center mb-4 text-red-400">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10">
                        <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                    </svg>
                    </div>
                    <h3 className="text-lg font-bold mb-4">エラーが発生しました</h3>
                    <div className="mb-6 break-words whitespace-pre-wrap text-left bg-black/20 p-4 rounded-lg text-sm leading-relaxed font-medium border border-red-500/20">
                    {state.error}
                    </div>
                    <div className="flex gap-4 justify-center">
                        <button 
                        onClick={handleBackToEdit}
                        className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors border border-slate-600 shadow-sm"
                        >
                        編集画面に戻る
                        </button>
                    </div>
                </div>
                )}

                {/* Result Display */}
                {state.status === AppStatus.COMPLETED && state.videoUrl && (
                <div className="mt-8 w-full flex flex-col items-center animate-fade-in space-y-6 px-2">
                    <div 
                    className="bg-slate-800/40 backdrop-blur rounded-3xl border border-slate-700 p-2 shadow-2xl shadow-emerald-500/10 w-full flex justify-center"
                    style={{ maxWidth: 'fit-content' }}
                    >
                        {state.extension === 'gif' ? (
                            <img 
                            src={state.videoUrl} 
                            alt="Generated GIF"
                            className="rounded-2xl bg-black shadow-lg max-h-[70vh] object-contain"
                            style={getPlayerStyle(state.settings?.aspectRatio)}
                            />
                        ) : (
                            <video 
                            src={state.videoUrl} 
                            controls 
                            autoPlay 
                            className="rounded-2xl bg-black shadow-lg max-h-[70vh]"
                            style={getPlayerStyle(state.settings?.aspectRatio)}
                            />
                        )}
                    </div>
                    
                    <div className="flex flex-col items-center justify-center gap-4 pt-4 max-w-2xl text-center w-full">
                    <div className="text-sm text-slate-400 bg-slate-800/50 px-4 py-2 rounded-lg w-full sm:w-auto">
                        ヒント: ダウンロードしたファイル({state.extension})がQuickTimeで再生できない場合は、VLC Playerやブラウザで開いてください。
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto justify-center">
                        <a 
                        href={state.videoUrl} 
                        download={`slideshow.${state.extension || 'webm'}`}
                        className="flex items-center justify-center gap-2 px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full font-medium transition-all shadow-lg shadow-emerald-600/20 w-full sm:w-auto"
                        >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                        ダウンロード
                        </a>

                        <button 
                        onClick={handleBackToEdit}
                        className="flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-medium transition-all shadow-lg shadow-blue-600/20 w-full sm:w-auto"
                        >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                        </svg>
                        再編集する
                        </button>
                        
                        <button 
                        onClick={handleReset}
                        className="flex items-center justify-center gap-2 px-8 py-4 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-full font-medium transition-all w-full sm:w-auto"
                        >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        最初から
                        </button>
                    </div>
                    </div>
                </div>
                )}
            </div>
        )}
      </main>
    </div>
  );
};

export default App;
