
import React, { useRef, useState, useEffect } from 'react';
import { useEditor } from './SlideEditorContext';
import BgmWaveformEditor from '../BgmWaveformEditor';
import { Resolution, OutputFormat, BackgroundFill, AspectRatio } from '../../types';
import { useToast } from '../ToastProvider';

export const SettingsPanel: React.FC = () => {
  const { pushToast } = useToast();
  const { 
      videoSettings, setVideoSettings,
      bgmFile, setBgmFile, bgmRange, setBgmRange, bgmVolume, setBgmVolume, fadeOptions, setFadeOptions,
      globalAudioFile, setGlobalAudioFile, globalAudioVolume, setGlobalAudioVolume,
      duckingOptions, setDuckingOptions,
      slides, updateSlides
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
        } else { pushToast({ kind: 'warning', message: '音声ファイルを選択してください' }); }
    }
  };

  const handleGlobalAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        if (file.type.startsWith('audio/')) {
            setGlobalAudioFile(file);
            setGlobalAudioVolume(1.0);
        } else { pushToast({ kind: 'warning', message: '音声ファイルを選択してください' }); }
    }
  };

  const handleBgImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        if (file.type.startsWith('image/')) setVideoSettings({ backgroundImageFile: file });
        else pushToast({ kind: 'warning', message: '画像ファイルを選択してください' });
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

  return (
    <div className="flex flex-col gap-4 mb-8">
       {/* Video Export Settings */}
       <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-700/50 space-y-3">
          <h4 className="text-sm font-semibold text-emerald-400 border-b border-slate-700/50 pb-2 mb-2">動画書き出し設定</h4>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
             <div className="space-y-1">
	               <label className="text-xs text-slate-400 block mb-1">フォーマット</label>
	               <select value={videoSettings.format} onChange={(e) => setVideoSettings({ format: e.target.value as OutputFormat })} className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:ring-1 focus:ring-emerald-500 outline-none">
	                 <option value="mp4">MP4 (動画)</option><option value="mov">MOV (動画)</option>
	               </select>
	             </div>
             <div className="space-y-1">
               <label className="text-xs text-slate-400 block mb-1">アスペクト比</label>
               <select value={videoSettings.aspectRatio} onChange={(e) => setVideoSettings({ aspectRatio: e.target.value as AspectRatio })} className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:ring-1 focus:ring-emerald-500 outline-none">
                 <option value="16:9">16:9 (YouTube等)</option><option value="4:3">4:3 (スライド)</option><option value="1:1">1:1 (Instagram)</option><option value="9:16">9:16 (TikTok/Shorts)</option>
               </select>
             </div>
             <div className="space-y-1">
               <label className="text-xs text-slate-400 block mb-1">解像度</label>
               <select value={videoSettings.resolution} onChange={(e) => setVideoSettings({ resolution: e.target.value as Resolution })} className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:ring-1 focus:ring-emerald-500 outline-none">
                 <option value="1080p">1080p (高画質)</option><option value="720p">720p (標準)</option>
               </select>
             </div>
             <div className="space-y-1">
               <label className="text-xs text-slate-400 block mb-1">余白の設定</label>
               <select value={videoSettings.backgroundFill} onChange={(e) => setVideoSettings({ backgroundFill: e.target.value as BackgroundFill })} className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:ring-1 focus:ring-emerald-500 outline-none">
                 <option value="black">黒帯</option><option value="white">白帯</option><option value="custom_image">カスタム画像</option>
               </select>
             </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
	             <div className="space-y-1"><label className="text-xs text-slate-400">スライドサイズ ({videoSettings.slideScale}%)</label><input type="range" min="50" max="100" value={videoSettings.slideScale} onChange={(e) => setVideoSettings({ slideScale: parseInt(e.target.value) })} className="w-full idle-range accent-emerald-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" /></div>
	             <div className="space-y-1"><label className="text-xs text-slate-400">角丸の半径 ({videoSettings.slideBorderRadius}px)</label><input type="range" min="0" max="50" value={videoSettings.slideBorderRadius} onChange={(e) => setVideoSettings({ slideBorderRadius: parseInt(e.target.value) })} className="w-full idle-range accent-emerald-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" /></div>
	             <div className="space-y-1"><label className="text-xs text-slate-400">トランジション時間 ({videoSettings.transitionDuration.toFixed(1)}秒)</label><input type="range" min="0.1" max="3.0" step="0.1" value={videoSettings.transitionDuration} onChange={(e) => setVideoSettings({ transitionDuration: parseFloat(e.target.value) })} className="w-full idle-range accent-emerald-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" /></div>
          </div>
          {videoSettings.backgroundFill === 'custom_image' && (
            <div className="mt-2 p-3 bg-slate-800/50 rounded border border-slate-600 border-dashed flex items-center gap-3">
                <input type="file" accept="image/*" ref={bgImageInputRef} className="hidden" onChange={handleBgImageSelect} />
                <button onClick={() => bgImageInputRef.current?.click()} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-xs text-white rounded transition-colors whitespace-nowrap">画像を選択...</button>
                <div className="text-xs text-slate-400 truncate flex-1">{videoSettings.backgroundImageFile ? videoSettings.backgroundImageFile.name : "未選択"}</div>
                {videoSettings.backgroundImageFile && (
                  <button onClick={handleBgImageClear} className="px-2 py-1 text-[11px] text-red-400 hover:text-red-200 border border-red-500/50 rounded transition-colors whitespace-nowrap">削除</button>
                )}
            </div>
          )}
       </div>

       {/* BGM Settings */}
	       <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-700/50 space-y-3">
	          <div className="flex justify-between items-center border-b border-slate-700/50 pb-2 mb-2">
	             <h4 className="text-sm font-semibold text-emerald-400">BGM設定</h4>
	          </div>
          <div className="flex flex-col gap-3">
              <input type="file" accept="audio/*" ref={bgmInputRef} onChange={handleBgmSelect} className="hidden" />
              {!bgmFile ? (
                <button onClick={() => bgmInputRef.current?.click()} className="flex items-center gap-2 text-xs bg-slate-700 hover:bg-slate-600 px-3 py-3 rounded text-slate-200 transition-colors w-full justify-center"><span>＋ 音楽ファイルを追加</span></button>
              ) : (
                <div className="w-full space-y-3">
                  <div className="flex items-center justify-between bg-slate-800 rounded px-3 py-2">
                     <div className="flex flex-col overflow-hidden mr-2"><span className="text-xs text-emerald-400 truncate" title={bgmFile.name}>♫ {bgmFile.name}</span></div>
                     <button onClick={() => { setBgmFile(null); if (bgmInputRef.current) bgmInputRef.current.value = ''; }} className="text-slate-500 hover:text-red-400 p-1 flex-shrink-0" title="削除"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg></button>
                  </div>
                  <div className="bg-slate-800/50 rounded p-2 space-y-2">
                      <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] text-slate-400">波形編集 & 範囲設定</span>
                          <button onClick={handleFitToAudio} className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded transition-colors whitespace-nowrap">長さに合わせる</button>
                      </div>
                      <BgmWaveformEditor file={bgmFile} range={bgmRange} onChange={setBgmRange} volume={bgmVolume} onVolumeChange={setBgmVolume} />
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-1">
                      <div className="flex gap-4">
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-300"><input type="checkbox" checked={fadeOptions.fadeIn} onChange={e => setFadeOptions({...fadeOptions, fadeIn: e.target.checked})} className="rounded bg-slate-700 border-slate-600 text-emerald-500 focus:ring-0 w-3.5 h-3.5" />フェードイン</label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-300"><input type="checkbox" checked={fadeOptions.fadeOut} onChange={e => setFadeOptions({...fadeOptions, fadeOut: e.target.checked})} className="rounded bg-slate-700 border-slate-600 text-emerald-500 focus:ring-0 w-3.5 h-3.5" />フェードアウト</label>
                      </div>
                      
                      <div className="flex flex-col gap-2 bg-slate-800/50 p-2 rounded border border-slate-700">
                          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-yellow-400 font-medium" title="ナレーションがある箇所でBGMの音量を自動で下げます">
                              <input type="checkbox" checked={duckingOptions.enabled} onChange={e => setDuckingOptions({...duckingOptions, enabled: e.target.checked})} className="rounded bg-slate-700 border-slate-600 text-yellow-500 focus:ring-0 w-3.5 h-3.5" />
                              自動音量調整（ダッキング）
                          </label>
                          {duckingOptions.enabled && (
                              <div className="flex items-center gap-2 pl-5">
                                  <span className="text-[10px] text-slate-400 whitespace-nowrap">下げる音量:</span>
	                                  <input type="range" min="0.05" max="0.8" step="0.05" value={duckingOptions.duckingVolume} onChange={(e) => setDuckingOptions({...duckingOptions, duckingVolume: parseFloat(e.target.value)})} className="w-24 idle-range h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-yellow-500" />
                                  <span className="text-[10px] text-yellow-400 w-8">{Math.round(duckingOptions.duckingVolume * 100)}%</span>
                              </div>
                          )}
                      </div>
                  </div>
                </div>
              )}
          </div>
       </div>

       {/* Global Narration Settings */}
	       <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-700/50 space-y-3">
	          <h4 className="text-sm font-semibold text-emerald-400 border-b border-slate-700/50 pb-2 mb-2">全体ナレーション設定</h4>
          <div className="flex flex-col gap-3">
              <input type="file" accept="audio/*" ref={globalAudioInputRef} onChange={handleGlobalAudioSelect} className="hidden" />
              {!globalAudioFile ? (
                <button onClick={() => globalAudioInputRef.current?.click()} className="flex items-center gap-2 text-xs bg-slate-700 hover:bg-slate-600 px-3 py-3 rounded text-slate-200 transition-colors w-full justify-center"><span>＋ 音声ファイルを追加</span></button>
              ) : (
                <div className="w-full space-y-3">
                  <div className="flex items-center justify-between bg-slate-800 rounded px-3 py-2">
                     <div className="flex flex-col overflow-hidden mr-2"><span className="text-xs text-emerald-400 truncate" title={globalAudioFile.name}>♫ {globalAudioFile.name}</span></div>
                     <button onClick={() => { setGlobalAudioFile(null); if (globalAudioInputRef.current) globalAudioInputRef.current.value = ''; }} className="text-slate-500 hover:text-red-400 p-1 flex-shrink-0" title="削除"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg></button>
                  </div>
                  <div className="bg-slate-800/50 rounded p-2 space-y-2">
                      <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] text-slate-400">波形編集 (再生確認のみ)</span>
                      </div>
                      <BgmWaveformEditor file={globalAudioFile} range={globalAudioRange} onChange={setGlobalAudioRange} volume={globalAudioVolume} onVolumeChange={setGlobalAudioVolume} readonly={true} />
                  </div>
                  <div className="text-[10px] text-slate-500 px-2">※ 動画全体を通して再生されます（ループなし）</div>
                </div>
              )}
          </div>
       </div>
    </div>
  );
};
