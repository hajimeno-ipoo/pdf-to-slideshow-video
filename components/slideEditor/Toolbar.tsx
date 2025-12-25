
import React, { useRef, useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useEditor } from './SlideEditorContext';
import { createSlideFromImage, createSolidColorSlide } from '../../services/pdfVideoService';
import { TransitionType, EffectType } from '../../types';
import ColorPickerPopover from '../ColorPickerPopover';

export const Toolbar: React.FC = () => {
  const { slides, updateSlides, selectedSlideId, setSelectedSlideId } = useEditor();
  const imageAddInputRef = useRef<HTMLInputElement>(null);
  
  const [globalDuration, setGlobalDuration] = useState<number>(3);
  const [globalSlideVolume, setGlobalSlideVolume] = useState<number>(1.0);
  const [globalTransitionType, setGlobalTransitionType] = useState<TransitionType>('fade');
  const [globalEffectType, setGlobalEffectType] = useState<EffectType>('none');
  const [solidAddColor, setSolidAddColor] = useState<string>('#000000');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorBtnRef = useRef<HTMLButtonElement>(null);
  
  // Insertion settings
  const [targetSlideIndex, setTargetSlideIndex] = useState<number>(1);
  const [insertPosition, setInsertPosition] = useState<'before' | 'after'>('after');

  // Accordion State
  const [isGlobalSettingsOpen, setIsGlobalSettingsOpen] = useState(false);
  const [isAddSlideOpen, setIsAddSlideOpen] = useState(true);

  // Sync target index when selection changes
  useEffect(() => {
      if (selectedSlideId) {
          const index = slides.findIndex(s => s.id === selectedSlideId);
          if (index !== -1) {
              setTargetSlideIndex(index + 1);
          }
      } else {
          // 何も選択されていないときは常に先頭(1)をデフォルトにする
          setTargetSlideIndex(1);
      }
  }, [selectedSlideId, slides.length]);

  // スライド総数が変わったときも先頭にリセット
  useEffect(() => {
      setTargetSlideIndex(1);
  }, [slides.length]);

  const getInsertIndex = () => {
      if (slides.length === 0) return 0;
      let index = insertPosition === 'before' ? targetSlideIndex - 1 : targetSlideIndex;
      return Math.max(0, Math.min(slides.length, index));
  };

  const handleAddImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.type.startsWith('image/')) {
        try {
          const newSlide = await createSlideFromImage(file, globalDuration, globalTransitionType);
          const newSlides = [...slides];
          newSlides.splice(getInsertIndex(), 0, newSlide);
          updateSlides(newSlides, true);
          setSelectedSlideId(newSlide.id);
        } catch (error) { console.error("Failed to add image", error); alert("画像の追加に失敗しました。"); }
      } else { alert("画像ファイル(jpg, png等)を選択してください"); }
    }
    if (imageAddInputRef.current) imageAddInputRef.current.value = '';
  };

  const handleAddSolidColorSlide = async () => {
      try {
          const newSlide = await createSolidColorSlide(solidAddColor, globalDuration, globalTransitionType);
          const newSlides = [...slides];
          newSlides.splice(getInsertIndex(), 0, newSlide);
          updateSlides(newSlides, true);
          setSelectedSlideId(newSlide.id);
      } catch (error) { console.error("Failed to add solid color slide", error); }
  };

  const handleApplyGlobalDuration = () => {
    const updated = slides.map(s => ({ ...s, duration: Math.max(0.1, globalDuration) }));
    updateSlides(updated, true);
  };

  const handleApplyGlobalSlideVolume = () => {
    const updated = slides.map(s => ({ ...s, audioVolume: globalSlideVolume }));
    updateSlides(updated, true);
  };

  const handleApplyGlobalTransition = () => {
    const updated = slides.map(s => ({ ...s, transitionType: globalTransitionType }));
    updateSlides(updated, true);
  };

  const handleApplyGlobalEffect = () => {
    const updated = slides.map(s => ({ ...s, effectType: globalEffectType }));
    updateSlides(updated, true);
  };

  return (
    <div className="flex flex-col gap-2 mb-2 bg-transparent border-b border-white/10 pb-2 px-1 select-none">
         
         {/* Group 1: Global Settings (Accordion) */}
         <div className="rounded-xl bg-slate-800/30 border border-slate-700/50 overflow-hidden">
             <button 
                onClick={() => setIsGlobalSettingsOpen(!isGlobalSettingsOpen)}
                className="w-full flex items-center justify-between p-2 bg-slate-800/50 hover:bg-slate-800 transition-colors text-left"
             >
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm0 5.25a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 01-.75-.75z" clipRule="evenodd" /></svg>
                    一括設定 (全スライド適用)
                 </span>
                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 text-slate-500 transition-transform ${isGlobalSettingsOpen ? 'rotate-180' : ''}`}>
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                 </svg>
             </button>
             
             {isGlobalSettingsOpen && (
                 <div className="p-3 flex flex-wrap items-center gap-3 animate-fade-in-down">
                     {/* Duration */}
                     <div className="flex items-center bg-slate-900 rounded-lg border border-slate-700 px-2 py-1 gap-2">
                         <span className="text-xs text-slate-400 whitespace-nowrap">時間</span>
                         <input type="number" min="1" value={globalDuration} onChange={(e) => setGlobalDuration(parseInt(e.target.value) || 1)} className="w-14 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-center text-xs focus:ring-1 focus:ring-emerald-500 outline-none" />
                         <button onClick={handleApplyGlobalDuration} className="text-[10px] bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded text-slate-200 transition-colors border border-slate-600 whitespace-nowrap">適用</button>
                     </div>

                     {/* Volume */}
                     <div className="flex items-center bg-slate-900 rounded-lg border border-slate-700 px-2 py-1 gap-2">
                         <span className="text-xs text-slate-400 whitespace-nowrap">音量</span>
                         <input type="number" min="0" max="200" step="10" value={Math.round(globalSlideVolume * 100)} onChange={(e) => setGlobalSlideVolume(Math.max(0, parseInt(e.target.value) || 0) / 100)} className="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-right text-xs focus:ring-1 focus:ring-emerald-500 outline-none" />
                         <span className="text-[10px] text-slate-500">%</span>
                         <button onClick={handleApplyGlobalSlideVolume} className="text-[10px] bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded text-slate-200 transition-colors border border-slate-600 whitespace-nowrap">適用</button>
                     </div>
                     
                     {/* Transition */}
                     <div className="flex items-center bg-slate-900 rounded-lg border border-slate-700 px-2 py-1 gap-2">
                         <span className="text-xs text-slate-400 whitespace-nowrap">効果</span>
                         <select value={globalTransitionType} onChange={(e) => setGlobalTransitionType(e.target.value as TransitionType)} className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-xs outline-none min-w-[96px]">
                             <option value="none">なし</option><option value="fade">フェード</option><option value="slide">スライド</option><option value="zoom">ズーム</option>
                             <option value="wipe">ワイプ</option><option value="flip">フリップ</option><option value="cross-zoom">クロスズーム</option>
                         </select>
                         <button onClick={handleApplyGlobalTransition} className="text-[10px] bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded text-slate-200 transition-colors border border-slate-600 whitespace-nowrap">適用</button>
                     </div>

                     {/* Motion */}
                     <div className="flex items-center bg-slate-900 rounded-lg border border-slate-700 px-2 py-1 gap-2">
                        <span className="text-xs text-slate-400 whitespace-nowrap">モーション</span>
                        <select value={globalEffectType} onChange={(e) => setGlobalEffectType(e.target.value as EffectType)} className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-xs outline-none min-w-[96px]">
                            <option value="none">なし</option><option value="kenburns">Ken Burns</option>
                        </select>
                        <button onClick={handleApplyGlobalEffect} className="text-[10px] bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded text-slate-200 transition-colors border border-slate-600 whitespace-nowrap">適用</button>
                      </div>
                 </div>
             )}
         </div>

         {/* Group 2: Insert Slide (Accordion) */}
         <div className="rounded-xl bg-slate-800/30 border border-slate-700/50 overflow-hidden">
             <button 
                onClick={() => setIsAddSlideOpen(!isAddSlideOpen)}
                className="w-full flex items-center justify-between p-2 bg-slate-800/50 hover:bg-slate-800 transition-colors text-left"
             >
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" /></svg>
                    スライド追加
                 </span>
                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 text-slate-500 transition-transform ${isAddSlideOpen ? 'rotate-180' : ''}`}>
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                 </svg>
             </button>

             {isAddSlideOpen && (
                 <div className="p-3 flex flex-wrap items-center gap-3 animate-fade-in-down">
                     {/* Position Control */}
                     <div className="flex items-center bg-slate-900 rounded-lg border border-slate-700 p-1 gap-2">
                        <div className="flex items-center pl-2">
                            <span className="text-xs text-slate-400 mr-2 whitespace-nowrap">No.</span>
                            <input 
                                type="number" 
                                min="1" 
                                max={slides.length || 1} 
                                value={targetSlideIndex}
                                onChange={(e) => setTargetSlideIndex(Math.max(1, Math.min(slides.length || 1, parseInt(e.target.value) || 1)))}
                                className="w-10 bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-white text-center text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                            />
                        </div>
                        
                        <span className="text-xs text-slate-500">の</span>

	                        <div className="flex bg-slate-800 rounded p-0.5 border border-slate-600 idle-segment">
	                            <button 
	                                onClick={() => setInsertPosition('before')} 
	                                className={`idle-segment-btn px-2 py-0.5 text-[10px] rounded transition-colors ${insertPosition === 'before' ? 'is-selected bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
	                            >
	                                前
	                            </button>
	                            <button 
	                                onClick={() => setInsertPosition('after')} 
	                                className={`idle-segment-btn px-2 py-0.5 text-[10px] rounded transition-colors ${insertPosition === 'after' ? 'is-selected bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
	                            >
	                                後
	                            </button>
	                        </div>
                        <span className="text-xs text-slate-500 mr-1">に追加</span>
                     </div>

                     <div className="h-6 w-px bg-slate-700 mx-1 hidden sm:block"></div>

	                     <div className="flex items-center gap-2 w-full sm:w-auto">
	                         <input type="file" accept="image/*" ref={imageAddInputRef} onChange={handleAddImage} className="hidden" />
	                         <button onClick={() => imageAddInputRef.current?.click()} className="flex-1 sm:flex-none flex items-center justify-center gap-1 text-[11px] bg-blue-600 hover:bg-blue-500 px-2.5 py-1 rounded-md text-white transition-colors border border-blue-500 shadow-sm whitespace-nowrap font-medium">
	                           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" /></svg>
	                           画像
	                         </button>
	                     <div className="relative flex items-center gap-2 bg-slate-800 px-2 py-1 rounded border border-slate-700">
	                       <button 
	                          ref={colorBtnRef}
	                          onClick={() => setShowColorPicker(!showColorPicker)}
	                          className="w-9 h-9 rounded-md border border-slate-600 shadow-inner"
	                          style={{ backgroundColor: solidAddColor }}
	                          title="無地スライドの背景色"
	                       />
                       {showColorPicker && colorBtnRef.current && ReactDOM.createPortal(
                          <div
                            style={{
                              position: 'fixed',
                              top: colorBtnRef.current.getBoundingClientRect().bottom + 8,
                              left: Math.min(
                                window.innerWidth - 340,
                                Math.max(8, colorBtnRef.current.getBoundingClientRect().left)
                              ),
                              zIndex: 9999
                            }}
                          >
                            <ColorPickerPopover 
                              value={solidAddColor} 
                              onChange={(hex) => setSolidAddColor(hex)} 
                              onClose={() => setShowColorPicker(false)}
                            />
                          </div>,
                          document.body
                       )}
	                       <button onClick={handleAddSolidColorSlide} className="flex-1 sm:flex-none flex items-center justify-center gap-1 text-[11px] bg-slate-700 hover:bg-slate-600 px-2.5 py-1 rounded-md text-white transition-colors border border-slate-600 shadow-sm whitespace-nowrap font-medium">
	                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path d="M2 3a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H3a1 1 0 01-1-1V3z" /></svg>
	                      無地
	                       </button>
	                     </div>
	                     </div>
                 </div>
             )}
         </div>
    </div>
  );
};
