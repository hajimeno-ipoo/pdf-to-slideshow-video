
import React, { useState } from 'react';
import { ApiConnectionStatus, TokenUsage, RequestStats } from '../types';

interface HeaderProps {
  apiStatus?: ApiConnectionStatus;
  tokenUsage?: TokenUsage;
  lifetimeUsage?: number;
  requestStats?: RequestStats;
  saveStatus?: 'idle' | 'pending' | 'saving' | 'saved';
  lastSavedTime?: Date | null;
  hasApiKey?: boolean;
  onOpenApiKey?: () => void;
  onOpenGlassSettings?: () => void;
  idleTheme?: boolean;
}

const WARNING_THRESHOLD = 500000;
const RPM_LIMIT = 15;
const TPM_LIMIT = 1000000;
const RPD_LIMIT = 1500;

const Header: React.FC<HeaderProps> = ({ 
	    apiStatus = 'checking', 
	    tokenUsage = { totalTokens: 0 }, 
	    lifetimeUsage = 0,
	    requestStats = { rpm: 0, tpm: 0, rpd: 0 },
	    saveStatus = 'idle',
	    lastSavedTime = null,
	    hasApiKey = false,
	    onOpenApiKey,
	    onOpenGlassSettings,
	    idleTheme = false
	}) => {
  const [showDevMode, setShowDevMode] = useState(false);

  // Calculate percentages
  const rpmPercentage = Math.min(100, (requestStats.rpm / RPM_LIMIT) * 100);
  const tpmPercentage = Math.min(100, (requestStats.tpm / TPM_LIMIT) * 100);
  const rpdPercentage = Math.min(100, (requestStats.rpd / RPD_LIMIT) * 100);

  // Colors
  let rpmColor = 'bg-emerald-500';
  let rpmText = 'text-slate-200';
  if (requestStats.rpm >= RPM_LIMIT) { rpmColor = 'bg-red-500'; rpmText = 'text-red-400 font-bold animate-pulse'; }
  else if (requestStats.rpm >= RPM_LIMIT * 0.8) { rpmColor = 'bg-yellow-500'; rpmText = 'text-yellow-400'; }

  let tpmColor = 'bg-emerald-500';
  let tpmText = 'text-slate-200';
  if (requestStats.tpm >= TPM_LIMIT) { tpmColor = 'bg-red-500'; tpmText = 'text-red-400 font-bold animate-pulse'; }
  else if (requestStats.tpm >= TPM_LIMIT * 0.8) { tpmColor = 'bg-yellow-500'; tpmText = 'text-yellow-400'; }

  const baseUrl = import.meta.env.BASE_URL;
  const getDocUrl = (docPath: string) => {
    const url = `${baseUrl}${docPath}`;
    return idleTheme ? `${url}?theme=idle` : url;
  };

  const openDoc = (e: React.MouseEvent<HTMLAnchorElement>, url: string) => {
    // Allow browser default behavior for modifier keys / non-left click (open in new tab, etc.)
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

    e.preventDefault();
    const opened = window.open(url, 'pdf-video-docs');
    if (!opened) {
      window.location.href = url;
    }
  };

  return (
    <header className="w-full py-3 px-4 border-b border-slate-800 bg-slate-950 flex-none z-50">
      <div className="max-w-full mx-auto flex items-center justify-between gap-4">
        {/* Logo Section */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-white">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            </svg>
	          </div>
		          <div className="flex items-baseline gap-2">
		            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 tracking-tight">
		              PDF Slideshow Maker
		            </h1>
		            <span className="text-lg text-slate-500 font-medium">
		              PDFをスライドにして動画へ
		            </span>
		          </div>
		        </div>

        {/* Right Section */}
        <div className="flex items-center gap-4">
            {/* Docs Links */}
            <nav className="flex items-center gap-3 text-[10px] font-medium">
                <a href={getDocUrl('user_manual.html')} onClick={(e) => openDoc(e, getDocUrl('user_manual.html'))} className="text-slate-300 hover:text-emerald-400 hover:underline underline-offset-2">
                    ユーザーマニュアル
                </a>
                <a href={getDocUrl('usage.html')} onClick={(e) => openDoc(e, getDocUrl('usage.html'))} className="text-slate-300 hover:text-emerald-400 hover:underline underline-offset-2">
                    利用について
                </a>
                <a href={getDocUrl('terms.html')} onClick={(e) => openDoc(e, getDocUrl('terms.html'))} className="text-slate-300 hover:text-emerald-400 hover:underline underline-offset-2">
                    利用規約
                </a>
                <a href={getDocUrl('privacy.html')} onClick={(e) => openDoc(e, getDocUrl('privacy.html'))} className="text-slate-300 hover:text-emerald-400 hover:underline underline-offset-2">
                    プライバシーポリシー
                </a>
            </nav>
            
            {/* Auto Save Status */}
            <div className={`flex items-center gap-2 transition-opacity duration-300 ${saveStatus === 'idle' ? 'opacity-50' : 'opacity-100'}`}>
                {saveStatus === 'saving' ? (
                    <svg className="animate-spin h-3 w-3 text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : saveStatus === 'saved' ? (
                    <svg className="h-3 w-3 text-emerald-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                ) : null}
                <span className="text-[10px] text-slate-500 font-medium">
                    {saveStatus === 'saving' ? '保存中...' : (saveStatus === 'saved' ? '保存済み' : '')}
                </span>
            </div>

            {/* Developer Mode Toggle */}
            <label className="flex items-center gap-2 cursor-pointer group">
                <span className={`text-[10px] font-medium transition-colors idle-header-devlabel ${showDevMode ? 'idle-header-devlabel--on text-emerald-400' : 'text-slate-600 group-hover:text-slate-500'}`}>Dev Mode</span>
                <div className="relative">
                    <input type="checkbox" checked={showDevMode} onChange={e => setShowDevMode(e.target.checked)} className="sr-only peer" />
                    <div className="w-8 h-4 bg-slate-800 rounded-full peer peer-checked:bg-emerald-900/50 peer-checked:border-emerald-500/50 border border-slate-700 transition-all idle-header-switch-track"></div>
                    <div className="absolute top-0.5 left-0.5 bg-slate-500 w-3 h-3 rounded-full transition-all peer-checked:translate-x-4 peer-checked:bg-emerald-400 idle-header-switch-thumb"></div>
                </div>
            </label>
            
            {/* Stats Block (Only visible in Dev Mode) */}
            {showDevMode && (
                <div className="flex items-stretch bg-slate-900 rounded border border-slate-800 shadow-sm overflow-hidden h-8 animate-fade-in idle-header-stats">
                    {/* Status */}
                    <div className="flex items-center px-2 border-r border-slate-800 bg-slate-800/30 gap-1.5 idle-header-stats-cell">
                        <div className={`w-1.5 h-1.5 rounded-full ${apiStatus === 'connected' ? 'bg-emerald-500' : (apiStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500')}`}></div>
                        <span className="text-[10px] font-bold text-slate-400">API</span>
                    </div>

                    {/* RPM */}
                    <div className="flex flex-col justify-center px-2 border-r border-slate-800 min-w-[60px] idle-header-stats-cell">
                        <div className="flex justify-between items-end">
                            <span className="text-[8px] text-slate-600 font-bold">RPM</span>
                            <span className={`text-[9px] font-mono leading-none ${rpmText}`}>{requestStats.rpm}</span>
                        </div>
                        <div className="w-full h-0.5 bg-slate-800 rounded-full mt-0.5 idle-header-stats-bar">
                            <div className={`h-full ${rpmColor}`} style={{ width: `${rpmPercentage}%` }} />
                        </div>
                    </div>

                    {/* TPM */}
                    <div className="flex flex-col justify-center px-2 min-w-[60px] idle-header-stats-cell">
                        <div className="flex justify-between items-end">
                            <span className="text-[8px] text-slate-600 font-bold">TPM</span>
                            <span className={`text-[9px] font-mono leading-none ${tpmText}`}>{(requestStats.tpm / 1000).toFixed(0)}k</span>
                        </div>
                        <div className="w-full h-0.5 bg-slate-800 rounded-full mt-0.5 idle-header-stats-bar">
                            <div className={`h-full ${tpmColor}`} style={{ width: `${tpmPercentage}%` }} />
                        </div>
                    </div>
                </div>
	            )}

	            {onOpenGlassSettings && (
	              <button
	                onClick={onOpenGlassSettings}
	                aria-label="ガラス設定"
	                title="ガラス設定"
	                className="p-2 rounded-full border transition-colors idle-header-apikey border-slate-700 text-slate-300 bg-slate-800 hover:bg-slate-700"
	              >
	                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
	                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 6h9M10.5 18h9M4.5 6h.01M4.5 18h.01M7.5 6v12" />
	                </svg>
	              </button>
	            )}

		            {/* API Key Button (icon) */}
		            <button
		              onClick={onOpenApiKey}
		              aria-label="APIキー"
		              title={hasApiKey ? 'APIキー（設定済み）' : 'APIキーを設定'}
		              className={`p-2 rounded-full border transition-colors idle-header-apikey ${hasApiKey ? 'idle-header-apikey--set border-emerald-500/60 text-emerald-300 bg-emerald-900/20 hover:bg-emerald-800/30' : 'border-slate-700 text-slate-300 bg-slate-800 hover:bg-slate-700'}`}
		            >
	              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
	                <path
	                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.75 5.25a3.75 3.75 0 10-2.728 6.322l-6.272 6.272v2.25h2.25l.75-.75h1.5l.75-.75h1.5l2.25-2.25"
                />
              </svg>
            </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
