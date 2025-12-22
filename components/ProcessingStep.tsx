import React from 'react';
import { AppStatus } from '../types';

interface ProcessingStepProps {
  currentStatus: AppStatus;
  progress?: {
    current: number;
    total: number;
  };
}

const ProcessingStep: React.FC<ProcessingStepProps> = ({ currentStatus, progress }) => {
  if (currentStatus !== AppStatus.CONVERTING && currentStatus !== AppStatus.ANALYZING) {
    return null;
  }

  const isAnalyzing = currentStatus === AppStatus.ANALYZING;
  const title = isAnalyzing ? "PDFを解析中" : "動画を作成中";
  
  const percentage = progress && progress.total > 0 
    ? Math.round((progress.current / progress.total) * 100) 
    : 0;

  return (
    <div className="w-full max-w-2xl mx-auto mt-8 p-6 rounded-3xl border border-black/10 glass-strong idle-sidebar-typography animate-fade-in">
      <div className="flex items-center justify-center gap-3 mb-6">
        {isAnalyzing ? (
           <svg className="animate-spin h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
             <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
             <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
           </svg>
        ) : (
           <svg className="animate-spin h-5 w-5 text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
             <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
             <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
           </svg>
        )}
        <h3 className="text-lg font-semibold text-white">{title}</h3>
      </div>
      
      <div className="space-y-4">
        <div className="flex justify-between text-sm text-slate-300">
          <span>{isAnalyzing ? "Analyzing Slides..." : "Rendering Video..."}</span>
          <span>{percentage}%</span>
        </div>
        
        <div className="w-full bg-black/10 rounded-full h-2.5 overflow-hidden border border-black/10">
          <div 
            className={`h-2.5 rounded-full transition-all duration-300 ease-out ${isAnalyzing ? 'bg-blue-500' : 'bg-emerald-500'}`}
            style={{ width: `${percentage}%` }}
          ></div>
        </div>

        <p className="text-center text-slate-400 text-sm mt-2">
          {isAnalyzing 
            ? `ページ ${progress?.current} / ${progress?.total} を読み込んでいます...` 
            : `スライド ${progress?.current} / ${progress?.total} を録画中`
          }
        </p>
      </div>
    </div>
  );
};

export default ProcessingStep;
