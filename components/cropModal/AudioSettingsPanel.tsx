
import React, { useState, useRef, useEffect } from 'react';
import { TokenUsage } from '../../types';
import { generateSpeech, generateSlideScript, VOICES } from '../../services/geminiService';

interface AudioSettingsPanelProps {
  audioFile: File | undefined;
  audioVolume: number;
  audioDuration: number;
  audioPreviewUrl: string | null;
  
  onAudioFileChange: (file: File | undefined) => void;
  onVolumeChange: (volume: number) => void;
  
  // For TTS
  imageUrl: string; 
  initialScript?: string;
  onUsageUpdate?: (usage: TokenUsage) => void;
}

const AudioSettingsPanel: React.FC<AudioSettingsPanelProps> = ({
  audioFile,
  audioVolume,
  audioDuration,
  audioPreviewUrl,
  onAudioFileChange,
  onVolumeChange,
  imageUrl,
  initialScript,
  onUsageUpdate
}) => {
  const [audioMode, setAudioMode] = useState<'upload' | 'record' | 'tts'>('upload');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioUploadRef = useRef<HTMLInputElement>(null);

  const [ttsText, setTtsText] = useState(initialScript || '');
  const [scriptPrompt, setScriptPrompt] = useState(''); 
  const [ttsStylePrompt, setTtsStylePrompt] = useState('');
  const [ttsVoice, setTtsVoice] = useState('Kore');
  const [isGeneratingTts, setIsGeneratingTts] = useState(false);
  const [isAnalyzingSlide, setIsAnalyzingSlide] = useState(false);

  useEffect(() => {
      if (initialScript && !ttsText) {
          setTtsText(initialScript);
      }
      if (initialScript && !audioFile) {
          setAudioMode('tts');
      }
  }, [initialScript]);

  // Auto-fill prompt for Zundamon style
  useEffect(() => {
      if (ttsVoice === 'Zundamon_Style') {
          setTtsStylePrompt(prev => {
              // Only auto-fill if empty to avoid overwriting user input
              if (!prev || prev.trim() === '') {
                  return "語尾に「〜なのだ」をつけて、元気でかわいらしい声で話してください。";
              }
              return prev;
          });
      }
  }, [ttsVoice]);

  useEffect(() => {
      return () => {
          stopRecordingCleanup();
      };
  }, []);

  const stopRecordingCleanup = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
      }
      if (timerRef.current) clearInterval(timerRef.current);
      const tracks = mediaRecorderRef.current?.stream.getTracks();
      tracks?.forEach(track => track.stop());
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          const file = e.target.files[0];
          if (file.type.startsWith('audio/')) {
              onAudioFileChange(file);
          } else {
              alert("音声ファイルを選択してください");
          }
      }
      e.target.value = '';
  };

  const startRecording = async () => { 
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const mediaRecorder = new MediaRecorder(stream);
          mediaRecorderRef.current = mediaRecorder;
          audioChunksRef.current = [];
          mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
          mediaRecorder.onstop = () => {
              const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
              const file = new File([audioBlob], `recording_${Date.now()}.webm`, { type: 'audio/webm' });
              onAudioFileChange(file);
          };
          mediaRecorder.start(100);
          setIsRecording(true);
          setRecordingTime(0);
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = window.setInterval(() => {
              setRecordingTime(prev => prev + 1);
          }, 1000);
      } catch (err) {
          console.error(err);
          alert("マイクへのアクセスに失敗しました。");
      }
  };

  const stopRecording = () => {
      setIsRecording(false);
      stopRecordingCleanup();
  };

  const handleGenerateTts = async () => {
      if (!ttsText) return;
      setIsGeneratingTts(true);
      try {
          const { file, usage } = await generateSpeech(ttsText, ttsVoice, ttsStylePrompt);
          onAudioFileChange(file);
          if (onUsageUpdate) onUsageUpdate(usage);
      } catch (e: any) {
          alert(e.message);
      } finally {
          setIsGeneratingTts(false);
      }
  };

  const handleAnalyzeSlide = async () => {
      setIsAnalyzingSlide(true);
      try {
          const result = await generateSlideScript(imageUrl, undefined, scriptPrompt);
          setTtsText(result.text);
          if (onUsageUpdate) onUsageUpdate(result.usage);
      } catch (e: any) {
          alert(e.message);
      } finally {
          setIsAnalyzingSlide(false);
      }
  };

  const formatTime = (seconds: number) => {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full p-4 flex flex-col gap-6">
        
        {/* 現在の音声ファイル情報 */}
        {audioFile && (
            <div className="bg-slate-800 rounded-lg p-3 border border-slate-700 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                    <span className="text-xs text-emerald-400 font-bold truncate flex-1 mr-2">♫ {audioFile.name}</span>
                    <button onClick={() => onAudioFileChange(undefined)} className="text-slate-500 hover:text-red-400 p-1"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg></button>
                </div>
                {audioPreviewUrl && (
                    <audio src={audioPreviewUrl} controls className="w-full h-8" />
                )}
                <div className="space-y-1">
                    <label className="text-xs text-slate-400 flex justify-between"><span>音量</span><span>{Math.round(audioVolume * 100)}%</span></label>
                    <input type="range" min="0" max="2" step="0.1" value={audioVolume} onChange={(e) => onVolumeChange(parseFloat(e.target.value))} className="w-full accent-emerald-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                </div>
            </div>
        )}

        {/* 追加モード切り替え */}
        <div className="flex flex-col gap-2">
             <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{audioFile ? '音声を変更' : '音声を追加'}</h4>
             <div className="flex p-1 bg-slate-800 rounded-lg mb-1">
                  <button onClick={() => setAudioMode('upload')} className={`flex-1 py-1.5 text-xs rounded-md ${audioMode === 'upload' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>アップロード</button>
                  <button onClick={() => setAudioMode('record')} className={`flex-1 py-1.5 text-xs rounded-md ${audioMode === 'record' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>録音</button>
                  <button onClick={() => setAudioMode('tts')} className={`flex-1 py-1.5 text-xs rounded-md ${audioMode === 'tts' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>AI読み上げ</button>
             </div>

             {/* Upload Mode */}
             {audioMode === 'upload' && (
                 <>
                    <button onClick={() => audioUploadRef.current?.click()} className="w-full flex flex-col items-center justify-center p-6 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-white transition-colors border-2 border-dashed border-slate-600 hover:border-emerald-500 group">
                        <span className="flex items-center gap-2 text-slate-400 group-hover:text-white transition-colors">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg> 
                          音声ファイルを選択
                        </span>
                    </button>
                    <input type="file" ref={audioUploadRef} className="hidden" accept="audio/*" onChange={handleAudioUpload} />
                 </>
             )}

             {/* Recording Mode */}
             {audioMode === 'record' && (
                 <div className="flex flex-col items-center justify-center p-6 bg-slate-800 rounded-lg border border-slate-700 gap-4">
                     <div className={`text-4xl font-mono font-bold ${isRecording ? 'text-red-500 animate-pulse' : 'text-slate-500'}`}>
                         {formatTime(recordingTime)}
                     </div>
                     {!isRecording ? (
                         <button onClick={startRecording} className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center text-white shadow-lg transition-transform hover:scale-105 active:scale-95">
                             <div className="w-6 h-6 bg-white rounded-full"></div>
                         </button>
                     ) : (
                         <button onClick={stopRecording} className="w-16 h-16 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-white shadow-lg border-2 border-red-500 transition-transform hover:scale-105 active:scale-95">
                             <div className="w-6 h-6 bg-red-500 rounded-sm"></div>
                         </button>
                     )}
                     <div className="text-xs text-slate-400">{isRecording ? '録音中...' : 'タップして録音開始'}</div>
                 </div>
             )}

             {/* TTS Mode */}
             {audioMode === 'tts' && (
                 <div className="flex flex-col gap-4 animate-fade-in">
                     
                     <div className="space-y-2">
                         <div className="flex justify-between items-end">
                             <label className="text-xs text-slate-400">スライドから原稿を生成</label>
                         </div>
                         <div className="bg-slate-800 p-2 rounded-lg border border-slate-700 space-y-2">
                             <textarea 
                                placeholder="生成への指示（例: 明るく、要点を3つに絞って）" 
                                value={scriptPrompt}
                                onChange={(e) => setScriptPrompt(e.target.value)}
                                className="w-full bg-slate-900/50 border border-slate-600 rounded px-2 py-1 text-xs text-white outline-none resize-none h-12"
                             />
                             <button 
                                onClick={handleAnalyzeSlide}
                                disabled={isAnalyzingSlide}
                                className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded text-xs font-bold transition-colors flex items-center justify-center gap-2"
                             >
                                 {isAnalyzingSlide ? <span className="animate-spin">↻</span> : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path d="M10 2a.75.75 0 01.75.75v5.59l2.684-2.227a.75.75 0 11.964 1.137l-4 3.32a.75.75 0 01-.964 0l-4-3.32a.75.75 0 11.964-1.137L9.25 8.34V2.75A.75.75 0 0110 2z" /></svg>}
                                 スライドから原稿を生成
                             </button>
                         </div>
                     </div>

                     <div className="space-y-1">
                         <label className="text-xs text-slate-400">読み上げテキスト</label>
                         <textarea 
                             value={ttsText}
                             onChange={(e) => setTtsText(e.target.value)}
                             placeholder="ここに読み上げさせたい文章を入力してください"
                             className="w-full bg-slate-800 border border-slate-600 rounded p-3 text-white text-sm h-32 focus:ring-1 focus:ring-emerald-500 outline-none"
                         />
                     </div>

                     <div className="space-y-1">
                         <label className="text-xs text-slate-400">声の種類</label>
                         <select 
                             value={ttsVoice}
                             onChange={(e) => setTtsVoice(e.target.value)}
                             className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm outline-none"
                         >
                             {VOICES.map(v => (
                                 <option key={v.value} value={v.value}>{v.name}</option>
                             ))}
                         </select>
                     </div>

                     <div className="space-y-1">
                         <label className="text-xs text-slate-400">話し方の指示 (オプション)</label>
                         <textarea
                             value={ttsStylePrompt}
                             onChange={(e) => setTtsStylePrompt(e.target.value)}
                             placeholder="例: 明るく元気な声で / 落ち着いたトーンで / 悲しげに / 早口で"
                             className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-xs h-16 focus:ring-1 focus:ring-emerald-500 outline-none resize-y min-h-[64px]"
                         />
                     </div>

                     <button 
                        onClick={handleGenerateTts}
                        disabled={isGeneratingTts || !ttsText}
                        className={`w-full py-3 rounded-lg font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 ${isGeneratingTts || !ttsText ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
                     >
                         {isGeneratingTts ? (
                             <>
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                生成中...
                             </>
                         ) : (
                             '音声を生成 (Gemini)'
                         )}
                     </button>
                 </div>
             )}
        </div>
    </div>
  );
};

export default AudioSettingsPanel;
