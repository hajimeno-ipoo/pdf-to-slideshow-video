
import React, { useState } from 'react';
import { useEditor } from './SlideEditorContext';
import { TransitionType, Slide } from '../../types';
import { safeRandomUUID } from '../../utils/uuid';

interface SlideGridProps {
  onSelect: (id: string | null) => void;
  selectedId: string | null;
}

export const SlideGrid: React.FC<SlideGridProps> = ({ onSelect, selectedId }) => {
  const { slides, updateSlides, videoSettings } = useEditor();
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

  const getTransitionIcon = (type: TransitionType) => {
    switch (type) {
      case 'fade': return (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path d="M10 2a.75.75 0 01.75.75v5.59l2.684-2.227a.75.75 0 11.964 1.137l-4 3.32a.75.75 0 01-.964 0l-4-3.32a.75.75 0 11.964-1.137L9.25 8.34V2.75A.75.75 0 0110 2z" /><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-1.5a6.5 6.5 0 100-13 6.5 6.5 0 000 13z" clipRule="evenodd" /></svg>);
      case 'slide': return (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M2 10a.75.75 0 01.75-.75h12.59l-2.1-1.95a.75.75 0 111.02-1.1l3.5 3.25a.75.75 0 010 1.1l-3.5 3.25a.75.75 0 11-1.02-1.1l2.1-1.95H2.75A.75.75 0 012 10z" clipRule="evenodd" /></svg>);
      case 'zoom': return (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" /></svg>);
      case 'wipe': return (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path d="M13 10a1 1 0 11-2 0 1 1 0 012 0z" /><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-5.5-2.5a.75.75 0 00-1.5 0V17a.75.75 0 00.75.75h1.5a.75.75 0 000-1.5h-.75v-1.5zM17 15.5a.75.75 0 00-1.5 0v.75h-.75a.75.75 0 000 1.5h1.5A.75.75 0 0017 17v-1.5zM3.5 4.5a.75.75 0 001.5 0v.75h.75a.75.75 0 000-1.5h-1.5A.75.75 0 003.5 3v1.5zM15.5 3a.75.75 0 00-1.5 0v.75h-.75a.75.75 0 000 1.5h1.5A.75.75 0 0015.5 4.5V3z" clipRule="evenodd" /></svg>);
      case 'flip': return (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h-4a1 1 0 110-2h4a1 1 0 01.707.293l1.562 1.563a3.5 3.5 0 104.386-4.954l1.258-1.258a5.5 5.5 0 011.6 4.201z" /></svg>);
      case 'cross-zoom': return (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>);
      default: return (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" /></svg>);
    }
  }

  const getTransitionColor = (type: TransitionType) => {
    switch (type) {
        case 'none': return 'text-slate-500 bg-slate-800 border-slate-700';
        case 'fade': return 'text-emerald-400 bg-emerald-900/20 border-emerald-800/50';
        case 'slide': return 'text-blue-400 bg-blue-900/20 border-blue-800/50';
        case 'zoom': return 'text-purple-400 bg-purple-900/20 border-purple-800/50';
        case 'wipe': return 'text-orange-400 bg-orange-900/20 border-orange-800/50';
        case 'flip': return 'text-yellow-400 bg-yellow-900/20 border-yellow-800/50';
        case 'cross-zoom': return 'text-pink-400 bg-pink-900/20 border-pink-800/50';
    }
  };

  const onDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };
  const onDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  const onDrop = (e: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
    e.preventDefault();
    if (draggedItemIndex === null) return;
    if (draggedItemIndex === dropIndex) return;
    const newSlides = [...slides];
    const [draggedItem] = newSlides.splice(draggedItemIndex, 1);
    newSlides.splice(dropIndex, 0, draggedItem);
    updateSlides(newSlides, true);
    setDraggedItemIndex(null);
  };

  const handleDuplicate = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const index = slides.findIndex(s => s.id === id);
    if (index === -1) return;
    const original = slides[index];
    const duplicated: Slide = { ...original, id: safeRandomUUID(), overlays: original.overlays?.map(o => ({ ...o, id: safeRandomUUID() })), };
    const newSlides = [...slides];
    newSlides.splice(index + 1, 0, duplicated);
    updateSlides(newSlides, true);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (slides.length <= 1) { alert("最低1枚のスライドが必要です"); return; }
    updateSlides(slides.filter(s => s.id !== id), true);
    if (selectedId === id) onSelect(null);
  };

  const handleTransitionChange = (id: string, type: TransitionType) => {
      const updated = slides.map(s => s.id === id ? { ...s, transitionType: type } : s);
      updateSlides(updated, true);
  };

  const handleDurationChange = (id: string, newDuration: number) => {
      const duration = Math.max(0.1, newDuration); // Ensure minimum duration
      const updated = slides.map(s => s.id === id ? { ...s, duration: duration } : s);
      updateSlides(updated, true); // true adds to history
  };

  const [bgPreviewUrl, setBgPreviewUrl] = useState<string | null>(null);
  React.useEffect(() => {
    if (videoSettings.backgroundFill === 'custom_image' && videoSettings.backgroundImageFile) {
        const url = URL.createObjectURL(videoSettings.backgroundImageFile);
        setBgPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    } else { setBgPreviewUrl(null); }
  }, [videoSettings.backgroundFill, videoSettings.backgroundImageFile]);

  // Preview styling helpers
  const getBackgroundColor = () => {
      if (videoSettings.backgroundFill === 'white') return '#ffffff';
      if (videoSettings.backgroundFill === 'black') return '#000000';
      return '#000000';
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 p-1 pb-20">
      {slides.map((slide, index) => {
        const isSelected = slide.id === selectedId;
        const isSolid = slide.pageIndex <= 0 && !!slide.backgroundColor && !slide.customImageFile;
        const SLIDE_TOKEN = '__SLIDE__';
        const overlays = Array.isArray(slide.overlays) ? slide.overlays : [];
        const overlayIds = overlays.map(o => o.id);
        let layerOrder: string[] = Array.isArray(slide.layerOrder) ? [...slide.layerOrder] : [SLIDE_TOKEN, ...overlayIds];
        if (!layerOrder.includes(SLIDE_TOKEN)) layerOrder.unshift(SLIDE_TOKEN);
        for (const id of overlayIds) if (!layerOrder.includes(id)) layerOrder.push(id);
        layerOrder = layerOrder.filter(id => id === SLIDE_TOKEN || overlayIds.includes(id));
        const slideIndex = layerOrder.indexOf(SLIDE_TOKEN);

        const getOverlayById = (id: string) => overlays.find(o => o.id === id);
        const isCanvasOverlay = (id: string) => {
          const ov = getOverlayById(id);
          if (!ov || ov.hidden) return false;
          return (ov.space || 'slide') === 'canvas';
        };

        const canvasBefore = layerOrder.filter((id) => id !== SLIDE_TOKEN && isCanvasOverlay(id) && (slideIndex < 0 || layerOrder.indexOf(id) < slideIndex));

        const canvasBgId = [...canvasBefore].reverse().find((id) => {
          const ov = getOverlayById(id);
          return !!ov && !ov.hidden && ov.type === 'image' && !!ov.imageData;
        });
        const canvasBgUrl = canvasBgId ? (getOverlayById(canvasBgId)?.imageData || '') : '';

        return (
        <div 
            key={slide.id} 
            onClick={() => onSelect(slide.id)}
            onDragOver={(e) => onDragOver(e, index)} 
            onDrop={(e) => onDrop(e, index)} 
            className={`relative group rounded-lg overflow-hidden border transition-all flex flex-col cursor-pointer ${isSelected ? 'ring-2 ring-emerald-500 border-emerald-500' : (draggedItemIndex === index ? 'opacity-50 border-emerald-500' : 'border-slate-700 hover:border-slate-500 bg-slate-800')}`}
        >
          <div className="absolute top-1 left-1 z-20 flex gap-1 pointer-events-none">
             <div className="bg-black/60 backdrop-blur px-1.5 py-0.5 rounded text-[8px] text-white font-mono">{index + 1}</div>
             {slide.audioFile && <div className="bg-indigo-500/80 px-1 py-0.5 rounded text-[8px] text-white">♫</div>}
          </div>
          
	          <div 
	            draggable={true} 
	            onDragStart={(e) => onDragStart(e, index)} 
	            className="aspect-video w-full flex items-center justify-center overflow-hidden relative"
	            style={{ backgroundColor: getBackgroundColor() }}
	          >
	            {bgPreviewUrl && (<img src={bgPreviewUrl} className="absolute inset-0 w-full h-full object-cover opacity-50 pointer-events-none" />)}
	            
	            <div 
	                className="relative w-full h-full flex items-center justify-center"
	                style={{ 
	                    transform: `scale(${videoSettings.slideScale / 100})`, 
	                    boxShadow: videoSettings.slideScale < 100 ? '0 4px 6px -1px rgba(0, 0, 0, 0.5)' : 'none',
	                    borderRadius: `${videoSettings.slideBorderRadius * 0.4}px`, // Approximate scaling
	                    overflow: 'hidden',
                        // Slide thumbnail uses object-contain, so the empty area shows through.
                        // If a canvas background image exists, use it to fill the “black bars” inside the slide frame.
                        backgroundImage: canvasBgUrl ? `url(${canvasBgUrl})` : undefined,
                        backgroundSize: canvasBgUrl ? 'cover' : undefined,
                        backgroundPosition: canvasBgUrl ? 'center' : undefined,
	                        backgroundRepeat: canvasBgUrl ? 'no-repeat' : undefined,
	                }}
	            >
	                <img 
	                    src={slide.thumbnailUrl} 
	                    alt={`Slide ${index + 1}`} 
	                    className="object-contain pointer-events-none w-full h-full" 
	                    style={{ backgroundColor: isSolid ? slide.backgroundColor : undefined }}
	                />
	            </div>
	          </div>
          
          <div className="h-10 bg-slate-900 border-t border-slate-800 flex items-center justify-between px-2 gap-2" onClick={(e) => e.stopPropagation()}>
              {/* Transition Selector */}
              <div className="relative group/select hover:opacity-100 transition-opacity max-w-[40%] sm:max-w-[50%]">
                  <div className={`flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-medium transition-colors ${getTransitionColor(slide.transitionType)}`}>
                      {getTransitionIcon(slide.transitionType)}
                      <span className="uppercase tracking-wider truncate">{slide.transitionType === 'none' ? 'None' : slide.transitionType.replace('-',' ')}</span>
                  </div>
                  <select 
                      value={slide.transitionType}
                      onChange={(e) => handleTransitionChange(slide.id, e.target.value as TransitionType)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      title="切り替え効果を変更"
                  >
                      <option value="none">なし (None)</option>
                      <option value="fade">フェード (Fade)</option>
                      <option value="slide">スライド (Slide)</option>
                      <option value="zoom">ズーム (Zoom)</option>
                      <option value="wipe">ワイプ (Wipe)</option>
                      <option value="flip">フリップ (Flip)</option>
                      <option value="cross-zoom">クロスズーム (Cross)</option>
                  </select>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2 ml-auto">
                  <div className="flex items-center gap-1 px-1.5 py-1 bg-slate-800 rounded border border-slate-700 hover:border-slate-600 transition-colors group/time" title="表示時間を変更">
                       <svg className="w-3 h-3 text-slate-500 flex-shrink-0 group-hover/time:text-emerald-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                       <input 
                          type="number" 
                          min="0.1" 
                          step="0.1" 
                          value={slide.duration} 
                          onChange={(e) => handleDurationChange(slide.id, parseFloat(e.target.value))}
                          onClick={(e) => e.stopPropagation()}
                          className="w-10 bg-transparent text-right text-xs font-mono font-bold text-slate-300 focus:text-emerald-400 outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none hover:text-white transition-colors"
                       />
                       <span className="text-[10px] text-slate-500 font-mono">s</span>
                  </div>
                  <div className="flex items-center bg-slate-800 rounded border border-slate-700">
                      <button onClick={(e) => handleDuplicate(e, slide.id)} className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700 transition-colors border-r border-slate-700" title="複製">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" /></svg>
                      </button>
                      <button onClick={(e) => handleDelete(e, slide.id)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 transition-colors" title="削除">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
                      </button>
                  </div>
              </div>
          </div>
        </div>
        );
      })}
    </div>
  );
};
