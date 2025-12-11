
import React, { useState } from 'react';
import { Overlay, OverlayType, AnimationType } from '../../types';
import { FONTS, ANIMATION_VALUES, getAnimationLabel, parseColor } from './constants';
import InlineColorPicker from './InlineColorPicker';

interface OverlaySettingsPanelProps {
  selectedOverlay: Overlay | undefined;
  onUpdateOverlay: (updates: Partial<Overlay>) => void;
  onDeleteOverlay: () => void;
  onAddOverlay: (type: OverlayType) => void;
  pendingAddType?: OverlayType | null;
  slideDuration: number;
}

const OverlaySettingsPanel: React.FC<OverlaySettingsPanelProps> = ({
  selectedOverlay,
  onUpdateOverlay,
  onDeleteOverlay,
  onAddOverlay,
  pendingAddType,
  slideDuration
}) => {
  const [activePropertyTab, setActivePropertyTab] = useState<'style' | 'outline' | 'shadow' | 'anim'>('style');

  const updateBgColorHex = (newHex: string) => { 
      if (!selectedOverlay) return; 
      const { alpha } = parseColor(selectedOverlay.backgroundColor); 
      const newAlpha = alpha === 0 ? 1 : alpha; 
      const r = parseInt(newHex.slice(1, 3), 16); 
      const g = parseInt(newHex.slice(3, 5), 16); 
      const b = parseInt(newHex.slice(5, 7), 16); 
      onUpdateOverlay({ backgroundColor: `rgba(${r}, ${g}, ${b}, ${newAlpha})` }); 
  };
  
  const updateBgColorAlpha = (newAlpha: number) => { 
      if (!selectedOverlay) return; 
      const defaultHex = selectedOverlay.type === 'text' ? '#000000' : '#ffffff'; 
      const { hex } = parseColor(selectedOverlay.backgroundColor, defaultHex); 
      const r = parseInt(hex.slice(1, 3), 16); 
      const g = parseInt(hex.slice(3, 5), 16); 
      const b = parseInt(hex.slice(5, 7), 16); 
      onUpdateOverlay({ backgroundColor: `rgba(${r}, ${g}, ${b}, ${newAlpha})` }); 
  };

  const bgColorState = selectedOverlay ? parseColor(selectedOverlay.backgroundColor, selectedOverlay.type === 'text' ? '#000000' : '#ffffff') : { hex: '#000000', alpha: 1 };

  // Helper to determine button style based on selection
  const getButtonStyle = (type: OverlayType) => {
      const isSelected = selectedOverlay?.type === type;
      const isPending = pendingAddType === type;

      if (isPending) {
          return "bg-emerald-600 border-emerald-500 text-white ring-2 ring-emerald-400/50 shadow-md transform scale-105 z-10 animate-pulse";
      }
      if (isSelected) {
          return "bg-emerald-600 border-emerald-500 text-white ring-2 ring-emerald-400/30 shadow-md transform scale-105 z-10";
      }
      return "bg-slate-800 hover:bg-slate-700 border-slate-700 text-white hover:scale-105 active:scale-95 text-slate-400 hover:text-slate-200";
  };

  const getIconColor = (type: OverlayType) => {
      const isSelected = selectedOverlay?.type === type;
      const isPending = pendingAddType === type;
      return (isSelected || isPending) ? "text-white" : "text-slate-300 group-hover:text-emerald-400";
  };

  const getLabelColor = (type: OverlayType) => {
      const isSelected = selectedOverlay?.type === type;
      const isPending = pendingAddType === type;
      return (isSelected || isPending) ? "text-white font-bold" : "text-slate-400 group-hover:text-slate-200";
  };

  return (
    <div className="w-full p-4 flex flex-col gap-6">
      {/* 追加エリア */}
      <div className="flex flex-col gap-2">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">装飾を追加 / 選択中</h4>
          <div className="grid grid-cols-5 gap-2">
              <button onClick={() => onAddOverlay('text')} className={`aspect-square flex flex-col items-center justify-center rounded-lg transition-all border shadow-sm group ${getButtonStyle('text')}`}>
                  <span className={`text-xl font-serif mb-1 transition-colors ${getIconColor('text')}`}>T</span>
                  <span className={`text-[9px] transition-colors ${getLabelColor('text')}`}>テキスト</span>
              </button>
              
              <button onClick={() => onAddOverlay('line')} className={`aspect-square flex flex-col items-center justify-center rounded-lg transition-all border shadow-sm group ${getButtonStyle('line')}`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={`mb-1 transition-colors ${getIconColor('line')}`}><line x1="4" y1="20" x2="20" y2="4" /></svg>
                  <span className={`text-[9px] transition-colors ${getLabelColor('line')}`}>線</span>
              </button>

              <button onClick={() => onAddOverlay('arrow')} className={`aspect-square flex flex-col items-center justify-center rounded-lg transition-all border shadow-sm group ${getButtonStyle('arrow')}`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`mb-1 transition-colors ${getIconColor('arrow')}`}><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                  <span className={`text-[9px] transition-colors ${getLabelColor('arrow')}`}>矢印</span>
              </button>

              <button onClick={() => onAddOverlay('rect')} className={`aspect-square flex flex-col items-center justify-center rounded-lg transition-all border shadow-sm group ${getButtonStyle('rect')}`}>
                  <div className={`w-5 h-4 border-2 border-current rounded-sm mb-1 transition-colors ${getIconColor('rect')}`}></div>
                  <span className={`text-[9px] transition-colors ${getLabelColor('rect')}`}>四角</span>
              </button>

              <button onClick={() => onAddOverlay('circle')} className={`aspect-square flex flex-col items-center justify-center rounded-lg transition-all border shadow-sm group ${getButtonStyle('circle')}`}>
                  <div className={`w-5 h-5 border-2 border-current rounded-full mb-1 transition-colors ${getIconColor('circle')}`}></div>
                  <span className={`text-[9px] transition-colors ${getLabelColor('circle')}`}>丸</span>
              </button>
          </div>
      </div>

      {/* 編集エリア */}
      {selectedOverlay && selectedOverlay.type !== 'image' ? (
        <div className="space-y-4 animate-fade-in border-t-2 border-slate-700/50 pt-2">
          <div className="flex items-center justify-between">
               <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">選択中の装飾設定</h4>
               <button onClick={onDeleteOverlay} className="px-3 py-1 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 rounded text-xs transition-colors">削除</button>
          </div>

          {selectedOverlay.type === 'text' && (
              <div className="space-y-1"><label className="text-xs text-slate-400">テキスト内容</label><textarea value={selectedOverlay.text || ''} onChange={(e) => onUpdateOverlay({ text: e.target.value })} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm h-16 focus:ring-1 focus:ring-emerald-500 outline-none" /></div>
          )}
          
          <div className="flex bg-slate-800 rounded p-1">
              {['style', 'outline', 'shadow', 'anim'].map(t => (
                  <button key={t} onClick={() => setActivePropertyTab(t as any)} className={`flex-1 py-1 text-xs rounded transition-colors ${activePropertyTab === t ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>{t === 'style' ? 'スタイル' : t === 'outline' ? (selectedOverlay.type === 'line' ? '線' : '線') : t === 'shadow' ? '影' : 'アニメーション'}</button>
              ))}
          </div>
          
          {activePropertyTab === 'anim' && (
              <div className="space-y-4">
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
                              className="w-full accent-emerald-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" 
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
                              className="w-full accent-emerald-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" 
                          />
                      </div>
                  </div>

                  <div className="space-y-1">
                      <label className="text-xs text-slate-400">開始 (イン)</label>
                      <select value={selectedOverlay.animationIn || 'none'} onChange={(e) => onUpdateOverlay({ animationIn: e.target.value as AnimationType })} className="w-full bg-slate-800 border border-slate-600 rounded p-1 text-xs text-white">
                          {ANIMATION_VALUES.map(v => <option key={v} value={v} disabled={v === 'typewriter' && selectedOverlay.type !== 'text'}>{getAnimationLabel(v, 'in')}</option>)}
                      </select>
                  </div>
                  <div className="space-y-1">
                      <label className="text-xs text-slate-400">終了 (アウト)</label>
                      <select value={selectedOverlay.animationOut || 'none'} onChange={(e) => onUpdateOverlay({ animationOut: e.target.value as AnimationType })} className="w-full bg-slate-800 border border-slate-600 rounded p-1 text-xs text-white">
                          {ANIMATION_VALUES.map(v => <option key={v} value={v} disabled={v === 'typewriter'}>{getAnimationLabel(v, 'out')}</option>)}
                      </select>
                  </div>
              </div>
          )}
          {activePropertyTab === 'style' && (
              <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                     <div className="space-y-1">
                        <label className="text-xs text-slate-400">色</label>
                        <InlineColorPicker value={selectedOverlay.color || '#ffffff'} onChange={(hex) => onUpdateOverlay({ color: hex })} />
                     </div>
                     {selectedOverlay.type === 'text' && (
                         <div className="space-y-1">
                             <label className="text-xs text-slate-400 flex justify-between">
                               <span>サイズ</span>
                               <span>{((selectedOverlay.fontSize ?? 5)).toFixed(1)}px</span>
                             </label>
                             <input type="range" min="1" max="100" step="0.5" value={selectedOverlay.fontSize || 5} onChange={(e) => onUpdateOverlay({ fontSize: parseFloat(e.target.value) })} className="w-full accent-emerald-500 h-8" />
                         </div>
                     )}
                  </div>
                  {selectedOverlay.type === 'text' && (
                      <div className="flex gap-1 pt-2 border-t border-slate-800">
                          <button onClick={() => onUpdateOverlay({ isBold: !selectedOverlay.isBold })} className={`p-1.5 rounded flex-1 flex justify-center items-center border transition-colors ${selectedOverlay.isBold ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'}`} title="太字"><span className="font-bold text-xs">B</span></button>
                          <button onClick={() => onUpdateOverlay({ isItalic: !selectedOverlay.isItalic })} className={`p-1.5 rounded flex-1 flex justify-center items-center border transition-colors ${selectedOverlay.isItalic ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'}`} title="斜体"><span className="italic text-xs font-serif">I</span></button>
                          <div className="w-px bg-slate-700 mx-1"></div>
                          <button onClick={() => onUpdateOverlay({ textAlign: 'left' })} className={`p-1.5 rounded flex-1 flex justify-center items-center border transition-colors ${selectedOverlay.textAlign === 'left' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'}`} title="左揃え"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 10.5a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5a.75.75 0 01-.75-.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10z" clipRule="evenodd" /></svg></button>
                          <button onClick={() => onUpdateOverlay({ textAlign: 'center' })} className={`p-1.5 rounded flex-1 flex justify-center items-center border transition-colors ${(!selectedOverlay.textAlign || selectedOverlay.textAlign === 'center') ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'}`} title="中央揃え"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 10.5a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 01-.75-.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10z" clipRule="evenodd" /></svg></button>
                          <button onClick={() => onUpdateOverlay({ textAlign: 'right' })} className={`p-1.5 rounded flex-1 flex justify-center items-center border transition-colors ${selectedOverlay.textAlign === 'right' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'}`} title="右揃え"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm7.5 10.5a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5a.75.75 0 01-.75-.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10z" clipRule="evenodd" /></svg></button>
                      </div>
                  )}
                  {(selectedOverlay.type === 'arrow' || selectedOverlay.type === 'rect' || selectedOverlay.type === 'circle' || selectedOverlay.type === 'line') && (
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                          <div className="space-y-1">
                              <label className="text-xs text-slate-400 flex justify-between"><span>幅</span><span>{Math.round((selectedOverlay.width || 0.2) * 100)}%</span></label>
                              <input type="range" min="0.01" max="1.0" step="0.01" value={selectedOverlay.width || 0.2} onChange={(e) => onUpdateOverlay({ width: parseFloat(e.target.value) })} className="w-full accent-emerald-500 h-8" />
                          </div>
                          {selectedOverlay.type !== 'line' && (
                              <div className="space-y-1">
                                  <label className="text-xs text-slate-400 flex justify-between"><span>高さ</span><span>{Math.round((selectedOverlay.height || 0.2) * 100)}%</span></label>
                                  <input type="range" min="0.01" max="1.0" step="0.01" value={selectedOverlay.height || 0.2} onChange={(e) => onUpdateOverlay({ height: parseFloat(e.target.value) })} className="w-full accent-emerald-500 h-8" />
                              </div>
                          )}
                      </div>
                  )}
                  {(selectedOverlay.type === 'rect' || selectedOverlay.type === 'circle') && (
                      <div className="space-y-1">
                         <label className="text-xs text-slate-400">塗りつぶし</label>
                         <div className="flex flex-col gap-2">
                             <InlineColorPicker value={bgColorState.hex} onChange={updateBgColorHex} />
                             <div className="space-y-1">
                                 <label className="text-[10px] text-slate-400 flex justify-between"><span>透明度</span><span>{Math.round(bgColorState.alpha * 100)}%</span></label>
                                 <input type="range" min="0" max="1" step="0.05" value={bgColorState.alpha} onChange={(e) => updateBgColorAlpha(parseFloat(e.target.value))} className="w-full accent-emerald-500 h-6 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                             </div>
                         </div>
                      </div>
                  )}
                  {selectedOverlay.type === 'text' && (
                    <>
                        <div className="space-y-1">
                            <label className="text-xs text-slate-400">背景色</label>
                            <div className="flex flex-col gap-2">
                                <InlineColorPicker value={bgColorState.hex} onChange={updateBgColorHex} />
                                <div className="space-y-1">
                                    <label className="text-[10px] text-slate-400 flex justify-between"><span>透明度</span><span>{Math.round(bgColorState.alpha * 100)}%</span></label>
                                    <input type="range" min="0" max="1" step="0.05" value={bgColorState.alpha} onChange={(e) => updateBgColorAlpha(parseFloat(e.target.value))} className="w-full accent-emerald-500 h-6 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-1"><label className="text-xs text-slate-400">フォント</label><select value={selectedOverlay.fontFamily} onChange={(e) => onUpdateOverlay({ fontFamily: e.target.value })} className="w-full bg-slate-800 border border-slate-600 rounded p-1 text-xs text-white">{FONTS.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}</select></div>
                    </>
                  )}
                  <div className="space-y-1 pt-2 border-t border-slate-800">
                      <div className="flex justify-between"><label className="text-xs text-slate-400">回転 ({selectedOverlay.rotation || 0}°)</label><button onClick={() => onUpdateOverlay({ rotation: 0 })} className="text-[10px] text-slate-500">リセット</button></div>
                      <input type="range" min="-180" max="180" step="1" value={selectedOverlay.rotation || 0} onChange={(e) => onUpdateOverlay({ rotation: parseInt(e.target.value) })} className="w-full accent-emerald-500 h-8" />
                  </div>
              </div>
          )}
          {activePropertyTab === 'outline' && (
              <div className="space-y-3">
                 <div className="space-y-1">
                     <label className="text-xs text-slate-400 flex justify-between"><span>{selectedOverlay.type === 'line' ? '太さ' : '線'}</span><span>{selectedOverlay.strokeWidth || 0}px</span></label>
                     {selectedOverlay.type === 'text' && (
                        <div className="mb-2">
                          <InlineColorPicker value={selectedOverlay.strokeColor || '#000000'} onChange={(hex) => onUpdateOverlay({ strokeColor: hex })} />
                        </div>
                     )}
                     <input type="range" min="0" max="100" step="0.5" value={selectedOverlay.strokeWidth || 0} onChange={(e) => onUpdateOverlay({ strokeWidth: parseFloat(e.target.value) })} className="w-full accent-emerald-500 h-8" />
                 </div>
                 {selectedOverlay.type === 'rect' && (
                     <div className="space-y-1">
                         <label className="text-xs text-slate-400 flex justify-between"><span>角丸</span><span>{selectedOverlay.borderRadius || 0}px</span></label>
                         <input type="range" min="0" max="100" step="1" value={selectedOverlay.borderRadius || 0} onChange={(e) => onUpdateOverlay({ borderRadius: parseFloat(e.target.value) })} className="w-full accent-emerald-500 h-8" />
                     </div>
                 )}
                 
                 {selectedOverlay.type === 'line' && (
                     <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                         <div className="space-y-1">
                             <label className="text-xs text-slate-400">種類</label>
                             <div className="flex bg-slate-800 rounded p-0.5">
                                 {['solid', 'dashed', 'dotted'].map((s) => (
                                     <button key={s} onClick={() => onUpdateOverlay({ borderStyle: s as any })} className={`flex-1 py-1 text-[10px] rounded ${(!selectedOverlay.borderStyle && s === 'solid') || selectedOverlay.borderStyle === s ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}>{s === 'solid' ? '実線' : s === 'dashed' ? '破線' : '点線'}</button>
                                 ))}
                             </div>
                         </div>
                         <div className="space-y-1">
                             <label className="text-xs text-slate-400">端の形状</label>
                             <div className="flex bg-slate-800 rounded p-0.5">
                                 {['butt', 'round'].map((c) => (
                                     <button key={c} onClick={() => onUpdateOverlay({ strokeLineCap: c as any })} className={`flex-1 py-1 text-[10px] rounded ${(!selectedOverlay.strokeLineCap && c === 'butt') || selectedOverlay.strokeLineCap === c ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}>{c === 'butt' ? '四角' : '丸'}</button>
                                 ))}
                             </div>
                         </div>
                     </div>
                 )}
              </div>
          )}
          {activePropertyTab === 'shadow' && (
              <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400">影色</label>
                    <InlineColorPicker value={selectedOverlay.shadowColor || '#000000'} onChange={(hex) => onUpdateOverlay({ shadowColor: hex })} />
                  </div>
                  <div className="space-y-1">
                      <label className="text-xs text-slate-400 flex justify-between"><span>ぼかし</span><span>{selectedOverlay.shadowBlur || 0}px</span></label>
                      <input type="range" min="0" max="100" value={selectedOverlay.shadowBlur || 0} onChange={(e) => onUpdateOverlay({ shadowBlur: parseFloat(e.target.value) })} className="w-full accent-emerald-500 h-8" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 flex justify-between"><span>X</span><span>{selectedOverlay.shadowOffsetX || 0}</span></label>
                          <input type="range" min="-100" max="100" value={selectedOverlay.shadowOffsetX || 0} onChange={(e) => onUpdateOverlay({ shadowOffsetX: parseFloat(e.target.value) })} className="w-full accent-emerald-500 h-8" />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 flex justify-between"><span>Y</span><span>{selectedOverlay.shadowOffsetY || 0}</span></label>
                          <input type="range" min="-100" max="100" value={selectedOverlay.shadowOffsetY || 0} onChange={(e) => onUpdateOverlay({ shadowOffsetY: parseFloat(e.target.value) })} className="w-full accent-emerald-500 h-8" />
                      </div>
                  </div>
              </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-500 text-xs italic p-4 text-center border-t border-slate-800 border-dashed">
            装飾を選択するか、上から追加してください
        </div>
      )}
    </div>
  );
};

export default OverlaySettingsPanel;
