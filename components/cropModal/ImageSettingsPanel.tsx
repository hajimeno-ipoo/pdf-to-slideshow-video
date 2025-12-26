
import React, { useEffect, useRef, useState } from 'react';
import { Overlay, TokenUsage, AnimationType } from '../../types';
import { generateImage } from '../../services/geminiService';
import { ANIMATION_VALUES, getAnimationLabel } from './constants';
import InlineColorPicker from './InlineColorPicker';

interface ImageSettingsPanelProps {
  onAddImage: (imageData: string) => void; 
  selectedOverlay: Overlay | undefined; 
  onUpdateOverlay: (updates: Partial<Overlay>) => void;
  onDeleteOverlay: () => void;
  onUsageUpdate?: (usage: TokenUsage) => void;
  onReorderOverlay?: (action: 'front' | 'back' | 'forward' | 'backward') => void;
  canMoveForward?: boolean;
  canMoveBackward?: boolean;
  slideDuration: number;
  aiEnabled: boolean;
}

const ImageSettingsPanel: React.FC<ImageSettingsPanelProps> = ({
  onAddImage,
  selectedOverlay,
  onUpdateOverlay,
  onDeleteOverlay,
  onUsageUpdate,
  onReorderOverlay,
  canMoveForward,
  canMoveBackward,
  slideDuration,
  aiEnabled
}) => {
  const [imageMode, setImageMode] = useState<'upload' | 'gen'>('upload');
  const [imgGenPrompt, setImgGenPrompt] = useState('');
	const [isGeneratingImg, setIsGeneratingImg] = useState(false);
	const imageUploadRef = useRef<HTMLInputElement>(null);
	const isAiLocked = !aiEnabled;

	useEffect(() => {
	  if (isAiLocked) setImageMode('upload');
	}, [isAiLocked]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => { 
      if (e.target.files && e.target.files.length > 0) { 
          const file = e.target.files[0]; 
          const reader = new FileReader(); 
          reader.onload = () => { 
              if (typeof reader.result === 'string') onAddImage(reader.result); 
          }; 
          reader.readAsDataURL(file); 
      } 
      e.target.value = '';
  };

  const handleGenerateImage = async () => { 
      if (!imgGenPrompt.trim()) return;
      setIsGeneratingImg(true);
      try {
          const result = await generateImage(imgGenPrompt);
          onAddImage(result.imageData);
          setImgGenPrompt(''); 
          if (onUsageUpdate && result.usage) onUsageUpdate(result.usage);
      } catch (e: any) { alert("画像生成に失敗しました: " + e.message); } finally { setIsGeneratingImg(false); }
  };

  return (
    <div className="w-full p-4 flex flex-col gap-6">
         {/* 追加エリア (常時表示) */}
	         <div className="flex flex-col gap-2">
	             <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">画像の追加</h4>
	             <div className="flex p-1 bg-slate-800 rounded-lg mb-1">
	                  <button onClick={() => setImageMode('upload')} className={`flex-1 py-1.5 text-xs rounded-md ${imageMode === 'upload' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>アップロード</button>
	                  <button
	                      onClick={() => setImageMode('gen')}
	                      disabled={isAiLocked}
	                      className={`flex-1 py-1.5 text-xs rounded-md disabled:opacity-40 disabled:cursor-not-allowed ${imageMode === 'gen' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white disabled:hover:text-slate-400'}`}
	                  >
	                      AIで生成
	                  </button>
	             </div>
             
             {imageMode === 'upload' ? (
                 <>
                    <button onClick={() => imageUploadRef.current?.click()} className="w-full flex flex-col items-center justify-center p-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-white transition-colors border-2 border-dashed border-slate-600 hover:border-emerald-500 group">
                        <span className="flex items-center gap-2 text-slate-400 group-hover:text-white transition-colors">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> 
                          ファイルを選択
                        </span>
                    </button>
                    <input type="file" ref={imageUploadRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                 </>
             ) : (
                 <div className="space-y-3 bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                    <div className="space-y-1">
	                        <textarea 
	                            value={imgGenPrompt}
	                            onChange={(e) => setImgGenPrompt(e.target.value)}
	                            disabled={isAiLocked}
	                            placeholder="例: 会議室で握手をするビジネスマンのイラスト"
	                            className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-xs h-20 focus:ring-1 focus:ring-emerald-500 outline-none resize-none disabled:opacity-60 disabled:cursor-not-allowed"
	                        />
	                    </div>
	                    <button 
	                        onClick={handleGenerateImage} 
	                        disabled={isAiLocked || isGeneratingImg || !imgGenPrompt.trim()}
	                        className={`w-full py-1.5 rounded font-medium text-xs transition-all flex items-center justify-center gap-2 ${isAiLocked || isGeneratingImg || !imgGenPrompt.trim() ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg'}`}
	                    >
	                        {isGeneratingImg ? (
	                            <>
	                                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
	                                生成中...
	                            </>
	                        ) : (
	                            '画像を生成 (無料)'
	                        )}
	                    </button>
	                    {isAiLocked && <div className="text-[11px] text-slate-500">※ API接続がOKの時だけ使えるよ（上のAPIキーから設定してね）</div>}
	                 </div>
	             )}
	         </div>

         {/* 編集エリア (選択時のみ表示) */}
         {selectedOverlay && selectedOverlay.type === 'image' ? (
            <div className="space-y-4 animate-fade-in border-t-2 border-slate-700/50 pt-2">
               <div className="flex items-center justify-between">
                   <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">選択中の画像設定</h4>
                   <button onClick={onDeleteOverlay} className="px-3 py-1 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 rounded text-xs transition-colors">削除</button>
               </div>
	               {onReorderOverlay && (
	                   <div className="flex items-center justify-between gap-2 bg-slate-800/30 border border-slate-700/50 rounded-lg p-2">
	                       <span className="text-[10px] text-slate-400 font-bold tracking-wider">重なり順</span>
	                       <div className="flex items-center gap-1">
	                           <button onClick={() => onReorderOverlay('back')} disabled={!canMoveBackward} className="px-2 py-1 text-[10px] rounded bg-slate-800 border border-slate-700 text-slate-200 disabled:opacity-40">最背面</button>
	                           <button onClick={() => onReorderOverlay('backward')} disabled={!canMoveBackward} className="px-2 py-1 text-[10px] rounded bg-slate-800 border border-slate-700 text-slate-200 disabled:opacity-40">後ろへ</button>
	                           <button onClick={() => onReorderOverlay('forward')} disabled={!canMoveForward} className="px-2 py-1 text-[10px] rounded bg-slate-800 border border-slate-700 text-slate-200 disabled:opacity-40">前へ</button>
	                           <button onClick={() => onReorderOverlay('front')} disabled={!canMoveForward} className="px-2 py-1 text-[10px] rounded bg-slate-800 border border-slate-700 text-slate-200 disabled:opacity-40">最前面</button>
	                       </div>
	                   </div>
	               )}
               
               <div className="space-y-3">
                  <div className="space-y-1">
                     <label className="text-xs text-slate-400 flex justify-between"><span>不透明度</span><span>{Math.round((selectedOverlay.opacity ?? 1) * 100)}%</span></label>
                     <input type="range" min="0" max="1" step="0.1" value={selectedOverlay.opacity ?? 1} onChange={(e) => onUpdateOverlay({ opacity: parseFloat(e.target.value) })} className="w-full idle-range accent-emerald-500 h-8" />
                  </div>
                  <div className="space-y-3 pt-2 border-t border-slate-800">
                      <h5 className="text-xs text-slate-400 font-bold">アニメーション</h5>
                      <div className="space-y-3 bg-slate-800/30 p-2 rounded border border-slate-700/50">
                          <div className="space-y-1">
                              <label className="text-xs text-slate-400 flex justify-between">
                                  <span>開始時間 (Start Time)</span>
                                  <span>{selectedOverlay.startTime?.toFixed(1) || 0}s</span>
                              </label>
                              <input 
                                  type="range" 
                                  min="0" 
                                  max={slideDuration} 
                                  step="0.1" 
                                  value={selectedOverlay.startTime || 0} 
                                  onChange={(e) => onUpdateOverlay({ startTime: parseFloat(e.target.value) })} 
                                  className="w-full idle-range accent-emerald-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" 
                              />
                          </div>
                          <div className="space-y-1">
                              <label className="text-xs text-slate-400 flex justify-between">
                                  <span>表示期間 (Duration)</span>
                                  <span>{selectedOverlay.duration ? selectedOverlay.duration.toFixed(1) + 's' : '最後まで'}</span>
                              </label>
                              <input 
                                  type="range" 
                                  min="0.5" 
                                  max={Math.max(0.5, slideDuration - (selectedOverlay.startTime || 0))} 
                                  step="0.1" 
                                  value={selectedOverlay.duration || (slideDuration - (selectedOverlay.startTime || 0))} 
                                  onChange={(e) => onUpdateOverlay({ duration: parseFloat(e.target.value) })} 
                                  className="w-full idle-range accent-emerald-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" 
                              />
                          </div>
                      </div>
                      <div className="space-y-1">
                          <label className="text-xs text-slate-400">開始 (イン)</label>
                          <select value={selectedOverlay.animationIn || 'none'} onChange={(e) => onUpdateOverlay({ animationIn: e.target.value as AnimationType })} className="w-full bg-slate-800 border border-slate-600 rounded p-1 text-xs text-white">
                              {ANIMATION_VALUES.map(v => <option key={v} value={v} disabled={v === 'typewriter'}>{getAnimationLabel(v, 'in')}</option>)}
                          </select>
                      </div>
                      <div className="space-y-1">
                          <label className="text-xs text-slate-400">終了 (アウト)</label>
                          <select value={selectedOverlay.animationOut || 'none'} onChange={(e) => onUpdateOverlay({ animationOut: e.target.value as AnimationType })} className="w-full bg-slate-800 border border-slate-600 rounded p-1 text-xs text-white">
                              {ANIMATION_VALUES.map(v => <option key={v} value={v} disabled={v === 'typewriter'}>{getAnimationLabel(v, 'out')}</option>)}
                          </select>
                      </div>
                  </div>
		                  <div className="space-y-1 pt-2 border-t border-slate-800">
		                      <div className="flex justify-between"><label className="text-xs text-slate-400">回転 ({selectedOverlay.rotation || 0}°)</label><button type="button" onClick={() => onUpdateOverlay({ rotation: 0 })} className="text-[10px] text-slate-500">リセット</button></div>
		                      <input type="range" min="-180" max="180" step="1" value={selectedOverlay.rotation || 0} onChange={(e) => onUpdateOverlay({ rotation: parseInt(e.target.value) })} className="w-full idle-range accent-emerald-500 h-8" />
		                  </div>
	                  <div className="space-y-1 pt-2 border-t border-slate-800">
	                      <div className="flex justify-between"><label className="text-xs text-slate-400">反転</label><button type="button" onClick={() => onUpdateOverlay({ flipX: false, flipY: false })} className="text-[10px] text-slate-500">リセット</button></div>
	                      <div className="flex bg-slate-800 rounded p-0.5 border border-slate-600 idle-segment">
	                          <button type="button" onClick={() => onUpdateOverlay({ flipX: !selectedOverlay.flipX })} className={`idle-segment-btn flex-1 py-1 text-[10px] rounded transition-colors ${selectedOverlay.flipX ? 'is-selected' : 'text-slate-400 hover:text-white'}`} title="左右反転">左右</button>
	                          <button type="button" onClick={() => onUpdateOverlay({ flipY: !selectedOverlay.flipY })} className={`idle-segment-btn flex-1 py-1 text-[10px] rounded transition-colors ${selectedOverlay.flipY ? 'is-selected' : 'text-slate-400 hover:text-white'}`} title="上下反転">上下</button>
	                      </div>
	                  </div>
	                  <div className="space-y-3 pt-2 border-t border-slate-800">
	                      <h5 className="text-xs text-slate-400 font-bold">影 (ドロップシャドウ)</h5>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-400">影の色</label>
                        <InlineColorPicker value={selectedOverlay.shadowColor || '#000000'} onChange={(hex) => onUpdateOverlay({ shadowColor: hex })} />
                      </div>
                      <div className="space-y-1">
                          <label className="text-xs text-slate-400 flex justify-between"><span>ぼかし</span><span>{selectedOverlay.shadowBlur || 0}px</span></label>
                          <input type="range" min="0" max="100" value={selectedOverlay.shadowBlur || 0} onChange={(e) => onUpdateOverlay({ shadowBlur: parseFloat(e.target.value) })} className="w-full idle-range accent-emerald-500 h-8" />
                      </div>
	                      <div className="grid grid-cols-2 gap-2">
	                          <div className="space-y-1">
	                              <label className="text-xs text-slate-400 flex items-center justify-between">
	                                  <span>X</span>
	                                  <span className="text-sm text-slate-200 font-medium tabular-nums">{selectedOverlay.shadowOffsetX || 0}</span>
	                              </label>
		                              <input type="range" min="-100" max="100" value={selectedOverlay.shadowOffsetX || 0} onChange={(e) => onUpdateOverlay({ shadowOffsetX: parseFloat(e.target.value) })} className="w-full idle-range accent-emerald-500 h-8" />
	                          </div>
	                          <div className="space-y-1">
	                              <label className="text-xs text-slate-400 flex items-center justify-between">
	                                  <span>Y</span>
	                                  <span className="text-sm text-slate-200 font-medium tabular-nums">{selectedOverlay.shadowOffsetY || 0}</span>
	                              </label>
		                              <input type="range" min="-100" max="100" value={selectedOverlay.shadowOffsetY || 0} onChange={(e) => onUpdateOverlay({ shadowOffsetY: parseFloat(e.target.value) })} className="w-full idle-range accent-emerald-500 h-8" />
	                          </div>
	                      </div>
	                  </div>
               </div>
            </div>
         ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-xs italic p-4 text-center border-t border-slate-800 border-dashed">
                画像をタップすると設定が表示されます
            </div>
         )}
    </div>
  );
};

export default ImageSettingsPanel;
