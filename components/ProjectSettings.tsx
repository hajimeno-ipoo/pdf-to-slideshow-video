
import React, { useRef, useState } from 'react';
import { useEditor } from './slideEditor/SlideEditorContext';
import BgmWaveformEditor from './BgmWaveformEditor';
import { Resolution, OutputFormat, BackgroundFill, AspectRatio } from '../types';

const ProjectSettings: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
	  const { 
	      videoSettings, setVideoSettings,
	      bgmFile, setBgmFile, bgmRange, setBgmRange, bgmVolume, setBgmVolume, fadeOptions, setFadeOptions,
	      globalAudioFile, setGlobalAudioFile, globalAudioVolume, setGlobalAudioVolume,
	      duckingOptions, setDuckingOptions,
	      slides, updateSlides,
	      customFonts, removeCustomFont
	  } = useEditor();

  const bgmInputRef = useRef<HTMLInputElement>(null);
  const globalAudioInputRef = useRef<HTMLInputElement>(null);
  const bgImageInputRef = useRef<HTMLInputElement>(null);
  const [globalAudioRange, setGlobalAudioRange] = useState({ start: 0, end: 0 });

  const handleBgmSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        if (file.type.startsWith('audio/')) {
            setBgmFile(file);
            setBgmRange({ start: 0, end: 0 });
            setBgmVolume(1.0);
        } else { alert("音声ファイルを選択してください"); }
    }
  };

  const handleGlobalAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        if (file.type.startsWith('audio/')) {
            setGlobalAudioFile(file);
            setGlobalAudioVolume(1.0);
        } else { alert("音声ファイルを選択してください"); }
    }
  };

  const handleBgImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        if (file.type.startsWith('image/')) setVideoSettings({ backgroundImageFile: file });
        else alert("画像ファイルを選択してください");
    }
  };

  const handleBgImageClear = () => {
    setVideoSettings({ backgroundImageFile: undefined, backgroundFill: 'black' });
    if (bgImageInputRef.current) bgImageInputRef.current.value = '';
  };

	  const handleFitToAudio = () => {
	    if (!bgmFile || slides.length === 0) return;
	    const duration = bgmRange.end - bgmRange.start;
	    if (duration <= 0) return;
	    const perSlide = Math.max(0.1, Math.floor((duration / slides.length) * 100) / 100);
	    const updated = slides.map(s => ({ ...s, duration: perSlide }));
	    updateSlides(updated, true);
	  };

	  const handleRemoveFont = (id: string) => {
	    const font = (customFonts || []).find((f) => f.id === id);
	    if (!font) return;
	    const ok = window.confirm(`「${font.name}」を削除する？\\n※このフォントを使ってるテキストは標準フォントに戻るかも！`);
	    if (!ok) return;
	    removeCustomFont(id);
	  };

  return (
    <div className="flex flex-col h-full bg-transparent text-slate-300 idle-sidebar-typography">
       <div className="p-4 border-b border-white/10 bg-transparent sticky top-0 z-10 flex items-center gap-2">
           {onClose && (
               <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white transition-colors flex items-center text-sm font-bold gap-1 px-1 py-1 rounded hover:bg-slate-800">
                   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" /></svg>
                   閉じる
               </button>
           )}
           <h3 className="text-base font-bold text-white uppercase tracking-wider">プロジェクト設定</h3>
       </div>
       
	       <div className="p-4 space-y-6 overflow-y-auto custom-scrollbar flex-1">
	           {/* Video Format */}
	           <div className="space-y-3">
              <h4 className="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-2">動画出力</h4>
              
              <div className="grid grid-cols-2 gap-3">
	                 <div className="space-y-1">
	                   <label className="text-[12px] text-slate-300 uppercase">フォーマット</label>
	                   <select value={videoSettings.format} onChange={(e) => setVideoSettings({ format: e.target.value as OutputFormat })} className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white outline-none focus:border-emerald-500">
	                     <option value="mp4">MP4 (動画)</option><option value="mov">MOV (動画)</option>
	                   </select>
	                 </div>
                 <div className="space-y-1">
                   <label className="text-[12px] text-slate-300 uppercase">アスペクト比</label>
                   <select value={videoSettings.aspectRatio} onChange={(e) => setVideoSettings({ aspectRatio: e.target.value as AspectRatio })} className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white outline-none focus:border-emerald-500">
                     <option value="16:9">16:9 (Landscape)</option><option value="4:3">4:3 (Slide)</option><option value="1:1">1:1 (Square)</option><option value="9:16">9:16 (Portrait)</option>
                   </select>
                 </div>
                 <div className="space-y-1">
                   <label className="text-[12px] text-slate-300 uppercase">解像度</label>
                   <select value={videoSettings.resolution} onChange={(e) => setVideoSettings({ resolution: e.target.value as Resolution })} className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white outline-none focus:border-emerald-500">
                     <option value="1080p">1080p (FHD)</option><option value="720p">720p (HD)</option>
                   </select>
                 </div>
                 <div className="space-y-1">
                   <label className="text-[12px] text-slate-300 uppercase">背景処理</label>
                   <select value={videoSettings.backgroundFill} onChange={(e) => setVideoSettings({ backgroundFill: e.target.value as BackgroundFill })} className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white outline-none focus:border-emerald-500">
                     <option value="black">黒帯</option><option value="white">白帯</option><option value="custom_image">画像</option>
                   </select>
                 </div>
              </div>

	              {videoSettings.backgroundFill === 'custom_image' && (
	                <div className="mt-2 p-3 bg-slate-800/50 rounded border border-slate-700 border-dashed flex items-center gap-2">
	                    <div className="text-sm text-slate-300 truncate flex-1">{videoSettings.backgroundImageFile ? videoSettings.backgroundImageFile.name : "背景画像を選択..."}</div>
	                    <input type="file" accept="image/*" ref={bgImageInputRef} className="hidden" onChange={handleBgImageSelect} />
	                    {videoSettings.backgroundImageFile && (
	                        <button onClick={handleBgImageClear} className="px-3 py-1 text-[12px] text-red-400 hover:text-red-200 border border-red-500/50 rounded transition-colors whitespace-nowrap">削除</button>
	                    )}
	                    <button onClick={() => bgImageInputRef.current?.click()} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-sm text-white rounded transition-colors whitespace-nowrap">選択</button>
	                </div>
	              )}

              <div className="space-y-3 pt-2">
                 <div className="space-y-1">
                    <div className="flex justify-between text-[12px] text-slate-300 uppercase"><label>スライド縮小</label><span>{videoSettings.slideScale}%</span></div>
		                    <input type="range" min="50" max="100" value={videoSettings.slideScale} onChange={(e) => setVideoSettings({ slideScale: parseInt(e.target.value) })} className="w-full idle-range accent-emerald-500 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                 </div>
                 <div className="space-y-1">
                    <div className="flex justify-between text-[12px] text-slate-300 uppercase"><label>角丸半径</label><span>{videoSettings.slideBorderRadius}px</span></div>
                    <input type="range" min="0" max="50" value={videoSettings.slideBorderRadius} onChange={(e) => setVideoSettings({ slideBorderRadius: parseInt(e.target.value) })} className="w-full idle-range accent-emerald-500 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                 </div>
                 <div className="space-y-1">
                    <div className="flex justify-between text-[12px] text-slate-300 uppercase"><label>標準切替時間</label><span>{videoSettings.transitionDuration.toFixed(1)}s</span></div>
                    <input type="range" min="0.1" max="3.0" step="0.1" value={videoSettings.transitionDuration} onChange={(e) => setVideoSettings({ transitionDuration: parseFloat(e.target.value) })} className="w-full idle-range accent-emerald-500 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                 </div>
	              </div>
	           </div>

	           {/* Fonts */}
	           <div className="space-y-3 pt-4 border-t border-slate-800">
	              <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">フォント（追加分）</h4>
	              {(!customFonts || customFonts.length === 0) ? (
	                  <div className="text-xs text-slate-400">
	                      追加したフォントはここに出るよ。追加はインスペクターの「フォント」からね！
	                  </div>
	              ) : (
	                  <div className="space-y-2">
	                      {customFonts.map((f) => (
	                          <div key={f.id} className="flex items-center justify-between gap-2 bg-slate-800/50 border border-slate-700 rounded px-3 py-2">
	                              <div className="min-w-0">
	                                  <div className="text-xs text-white truncate">{f.name}</div>
	                                  <div className="text-[10px] text-slate-400 truncate">{f.file?.name}</div>
	                              </div>
	                              <button onClick={() => handleRemoveFont(f.id)} className="px-2 py-1 text-[10px] text-red-300 hover:text-red-200 border border-red-500/40 rounded transition-colors whitespace-nowrap">
	                                  削除
	                              </button>
	                          </div>
	                      ))}
	                  </div>
	              )}
	           </div>

	           {/* Audio Settings */}
		           <div className="space-y-3 pt-4 border-t border-slate-800">
		              <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">BGM & オーディオ</h4>
              
              {/* BGM Section */}
              <div className="space-y-2">
                  <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-white">BGM</span>
                      {bgmFile && <button onClick={() => { setBgmFile(null); if(bgmInputRef.current) bgmInputRef.current.value=''; }} className="text-[10px] text-red-400 hover:underline">削除</button>}
                  </div>
                  <input type="file" accept="audio/*" ref={bgmInputRef} onChange={handleBgmSelect} className="hidden" />
                  
                  {!bgmFile ? (
                    <button onClick={() => bgmInputRef.current?.click()} className="w-full py-2 border border-slate-700 border-dashed rounded text-xs text-slate-400 hover:text-white hover:border-emerald-500 hover:bg-slate-800/50 transition-all">＋ BGMを追加</button>
                  ) : (
                    <div className="bg-slate-800 rounded p-2 border border-slate-700">
                        <div className="text-xs text-emerald-400 truncate mb-2">♫ {bgmFile.name}</div>
                        <BgmWaveformEditor file={bgmFile} range={bgmRange} onChange={setBgmRange} volume={bgmVolume} onVolumeChange={setBgmVolume} />
                        <div className="flex gap-4 mt-2">
                            <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-slate-300"><input type="checkbox" checked={fadeOptions.fadeIn} onChange={e => setFadeOptions({...fadeOptions, fadeIn: e.target.checked})} className="rounded bg-slate-700 border-slate-600 text-emerald-500 focus:ring-0 w-3 h-3" />Fade In</label>
                            <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-slate-300"><input type="checkbox" checked={fadeOptions.fadeOut} onChange={e => setFadeOptions({...fadeOptions, fadeOut: e.target.checked})} className="rounded bg-slate-700 border-slate-600 text-emerald-500 focus:ring-0 w-3 h-3" />Fade Out</label>
                        </div>
                        <button onClick={handleFitToAudio} className="w-full mt-2 text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-200 py-1 rounded transition-colors">スライドを曲の長さに合わせる</button>
                    </div>
                  )}
              </div>

              {/* Ducking */}
              {bgmFile && (
                  <div className="bg-slate-800/50 p-2 rounded border border-slate-700">
                      <label className="flex items-center justify-between cursor-pointer group">
                          <span className="text-xs text-yellow-400 font-medium group-hover:text-yellow-300">自動音量調整 (Ducking)</span>
                          <div className="relative">
                              <input type="checkbox" checked={duckingOptions.enabled} onChange={e => setDuckingOptions({...duckingOptions, enabled: e.target.checked})} className="sr-only peer" />
                              <div className="w-7 h-3.5 bg-slate-700 rounded-full peer peer-checked:bg-yellow-900/50 peer-checked:border-yellow-500/50 border border-slate-600 transition-all"></div>
                              <div className="absolute top-0.5 left-0.5 bg-slate-400 w-2.5 h-2.5 rounded-full transition-all peer-checked:translate-x-3.5 peer-checked:bg-yellow-400"></div>
                          </div>
                      </label>
	                      {duckingOptions.enabled && (
	                          <div className="flex items-center gap-2 mt-2">
	                              <span className="text-[10px] text-slate-400">下げる量</span>
		                              <input type="range" min="0.05" max="0.8" step="0.05" value={duckingOptions.duckingVolume} onChange={(e) => setDuckingOptions({...duckingOptions, duckingVolume: parseFloat(e.target.value)})} className="flex-1 idle-range h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-yellow-500" />
	                              <span className="text-[10px] text-yellow-400 w-8 text-right">{Math.round(duckingOptions.duckingVolume * 100)}%</span>
	                          </div>
	                      )}
	                  </div>
	              )}

              {/* Global Audio */}
              <div className="space-y-2 pt-2 border-t border-slate-800/50">
                  <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-white">全体ナレーション</span>
                      {globalAudioFile && <button onClick={() => { setGlobalAudioFile(null); if(globalAudioInputRef.current) globalAudioInputRef.current.value=''; }} className="text-[10px] text-red-400 hover:underline">削除</button>}
                  </div>
                  <input type="file" accept="audio/*" ref={globalAudioInputRef} onChange={handleGlobalAudioSelect} className="hidden" />
                  
                  {!globalAudioFile ? (
                    <button onClick={() => globalAudioInputRef.current?.click()} className="w-full py-2 border border-slate-700 border-dashed rounded text-xs text-slate-400 hover:text-white hover:border-emerald-500 hover:bg-slate-800/50 transition-all">＋ 音声ファイルを追加</button>
                  ) : (
                    <div className="bg-slate-800 rounded p-2 border border-slate-700">
                        <div className="text-xs text-emerald-400 truncate mb-2">♫ {globalAudioFile.name}</div>
                        <BgmWaveformEditor file={globalAudioFile} range={globalAudioRange} onChange={setGlobalAudioRange} volume={globalAudioVolume} onVolumeChange={setGlobalAudioVolume} readonly={true} />
                    </div>
                  )}
              </div>
           </div>
       </div>
    </div>
  );
};

export default ProjectSettings;
