import React, { useEffect, useRef, useState } from 'react';
import { AppStatus, TransitionType } from '../types';

interface FileUploadProps {
  onFileSelect: (file: File, duration: number, transitionType: TransitionType, autoGenerateScript: boolean, customScriptPrompt?: string) => void;
  status: AppStatus;
  aiEnabled: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, status, aiEnabled }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [duration, setDuration] = useState<number>(3); // Default 3 seconds
  const [transitionType, setTransitionType] = useState<TransitionType>('fade'); // Default fade
  const [autoGenerateScript, setAutoGenerateScript] = useState<boolean>(false); // AI script generation
  const [customScriptPrompt, setCustomScriptPrompt] = useState<string>(''); // Custom prompt for AI

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndUpload(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndUpload(e.target.files[0]);
    }
  };

  const validateAndUpload = (file: File) => {
    if (file.type !== 'application/pdf') {
      alert('PDFファイルのみアップロード可能です。');
      return;
    }
    onFileSelect(file, duration, transitionType, autoGenerateScript, customScriptPrompt);
  };

  const isDisabled = status === AppStatus.CONVERTING;
  const isAiLocked = !aiEnabled;

  useEffect(() => {
    if (isAiLocked) setAutoGenerateScript(false);
  }, [isAiLocked]);

  return (
    <div 
      className={`w-full max-w-2xl mx-auto mt-6 sm:mt-10 transition-all duration-300 px-2 sm:px-0 ${isDisabled ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}
    >
      {/* Settings Area */}
      <div className="mb-6 glass p-4 sm:p-6 rounded-[32px] flex flex-col gap-4">
         <div className="flex flex-col sm:flex-row gap-6 sm:gap-4 justify-between">
             {/* Duration Setting */}
             <div className="flex flex-col sm:block space-y-2 sm:space-y-0">
                <div className="flex items-center justify-between sm:justify-start gap-4">
                  <label htmlFor="duration" className="text-slate-300 font-medium whitespace-nowrap">
                    基本表示時間:
                  </label>
                  <div className="flex items-center gap-2">
                    <input 
                      id="duration"
                      type="number" 
                      min="1" 
                      max="60" 
                      value={duration} 
                      onChange={(e) => setDuration(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none text-center"
                    />
                    <span className="text-slate-400">秒</span>
                  </div>
                </div>
             </div>

             {/* Transition Setting */}
             <div className="flex flex-col sm:block space-y-2 sm:space-y-0 pt-4 sm:pt-0 border-t sm:border-t-0 border-black/10 sm:border-l sm:pl-6">
                <div className="flex items-center justify-between sm:justify-start gap-4">
                  <label htmlFor="transition" className="text-slate-300 font-medium whitespace-nowrap">
                    切り替え効果:
                  </label>
                  <div className="relative w-36 sm:w-auto">
                    <select
                      id="transition"
                      value={transitionType}
                      onChange={(e) => setTransitionType(e.target.value as TransitionType)}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none text-sm appearance-none pr-8"
                    >
                      <option value="none">なし</option>
                      <option value="fade">フェード</option>
                      <option value="slide">スライド</option>
                      <option value="zoom">ズーム</option>
                      <option value="wipe">ワイプ</option>
                      <option value="flip">フリップ</option>
                      <option value="cross-zoom">クロスズーム</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                      <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                  </div>
                </div>
             </div>
         </div>
         
	         {/* AI Script Generation Option */}
	         <div className="pt-4 border-t border-black/10 space-y-3">
	             <label className={`flex items-start gap-3 ${isAiLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer group'}`}>
	                 <div className="relative flex items-center mt-0.5">
	                    <input 
	                        type="checkbox" 
	                        checked={autoGenerateScript} 
	                        onChange={(e) => setAutoGenerateScript(e.target.checked)} 
	                        disabled={isAiLocked}
	                        className="peer sr-only"
	                    />
	                    <div className="w-10 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-indigo-600 peer-checked:to-purple-600"></div>
	                 </div>
	                 <div className="flex-1">
	                     <div className="flex items-center gap-2">
	                         <span className="text-slate-300 font-bold text-sm">AIでナレーション原稿を自動生成する</span>
	                     </div>
	                     <p className="text-xs text-slate-300 font-bold mt-1">
	                         各スライドの画像をAIが解析し、説明文を自動で下書きします。<br/>
	                         <span className="text-red-500">※ 解析時間が大幅に長くなる場合があります（1ページあたり約2~3秒追加）</span>
	                         {isAiLocked && <span className="block text-red-500 mt-1">※ API接続がOKの時だけ使えるよ（上のAPIキーから設定してね）</span>}
	                     </p>
	                 </div>
	             </label>

             {/* Custom Prompt Input */}
             {autoGenerateScript && (
                 <div className="ml-13 pl-13 animate-fade-in pl-2 sm:pl-12">
                     <div className="space-y-2">
                         <label htmlFor="customPrompt" className="text-xs text-indigo-300 font-medium flex items-center gap-2">
                             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                 <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                             </svg>
                             生成時の指示 (オプション)
                         </label>
                         <textarea
                             id="customPrompt"
                             value={customScriptPrompt}
                             onChange={(e) => setCustomScriptPrompt(e.target.value)}
                             placeholder="例: 明るく元気な口調で / 小学生にもわかるように / 関西弁で / 要点のみを箇条書き風に解説して"
                             className="w-full bg-slate-900/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y min-h-[80px] placeholder:text-slate-600"
                             rows={3}
                         />
                     </div>
                 </div>
             )}
         </div>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          relative border-2 border-transparent rounded-[40px] p-8 sm:p-10 pb-16 sm:pb-20 text-center cursor-pointer transition-all duration-300 group glass-strong
          ${isDragging 
            ? 'border-dashed border-blue-500 bg-blue-500/10 scale-[1.02]' 
            : ''
          }
        `}
      >
        <input 
          type="file" 
          accept="application/pdf" 
          ref={inputRef} 
          className="hidden" 
          onChange={handleChange}
        />
        
        <div className="flex flex-col items-center justify-center gap-4">
          <div className={`p-4 rounded-full glass-thin transition-colors ${isDragging ? 'text-blue-600' : 'text-slate-400'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-white group-hover:text-blue-600 transition-colors">
              PDFファイルをアップロード
            </h3>
            <p className="text-sm text-slate-400 mt-2">
              タップ または ドラッグ＆ドロップ
            </p>
          </div>
        </div>

        <p className="absolute inset-x-0 bottom-4 sm:bottom-5 px-6 text-center text-xs text-red-500 font-bold pointer-events-none">
          ※ サーバーにファイルは送信されません。ブラウザ内で安全に変換されます。
        </p>
      </div>
    </div>
  );
};

export default FileUpload;
