
import React, { useState, useRef } from 'react';
import { CreationItem, CreationType } from '../types';

interface DraggableResultProps {
  item: CreationItem;
  onDelete: (id: string) => void;
  onUpdatePosition: (id: string, x: number, y: number) => void;
  onSaveToGallery: (id: string) => void;
  onExpand: (id: string) => void; // New prop to trigger global viewer
  scale: number;
}

const DraggableResult: React.FC<DraggableResultProps> = ({ item, onDelete, onUpdatePosition, onSaveToGallery, onExpand, scale }) => {
  // We use local state for initial mount, but DOM manipulation for updates
  const elementRef = useRef<HTMLDivElement>(null);
  const dragInfo = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0, isDragging: false });
  const [isDraggingVisual, setIsDraggingVisual] = useState(false);

  // Position fallback
  const currentX = item.position?.x ?? 100;
  const currentY = item.position?.y ?? 100;

  // Helper to determine if item is video (Strictly MP4 output)
  const isVideo = [
    CreationType.VIDEO,
    CreationType.IMAGE_TO_VIDEO,
    CreationType.MIMIC,
    CreationType.FACE_TO_VIDEO
  ].includes(item.type);

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.no-drag')) return;

    e.stopPropagation();
    e.preventDefault();

    const element = elementRef.current;
    if (!element) return;

    element.setPointerCapture(e.pointerId);
    setIsDraggingVisual(true);

    dragInfo.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      initialX: currentX,
      initialY: currentY
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragInfo.current.isDragging || !elementRef.current) return;

    e.stopPropagation();
    e.preventDefault();

    // Calculate delta in "Unscaled World Coordinates"
    const deltaX = (e.clientX - dragInfo.current.startX) / scale;
    const deltaY = (e.clientY - dragInfo.current.startY) / scale;

    // Current world position (unscaled)
    const newX = dragInfo.current.initialX + deltaX;
    const newY = dragInfo.current.initialY + deltaY;

    // Apply SCALED transformation for visual feedback (Sharp Vector Zoom)
    elementRef.current.style.transform = `translate(${newX * scale}px, ${newY * scale}px) scale(${scale})`;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragInfo.current.isDragging) return;

    e.stopPropagation();
    e.preventDefault();

    if (elementRef.current) {
      elementRef.current.releasePointerCapture(e.pointerId);
    }

    setIsDraggingVisual(false);
    dragInfo.current.isDragging = false;

    const deltaX = (e.clientX - dragInfo.current.startX) / scale;
    const deltaY = (e.clientY - dragInfo.current.startY) / scale;

    const finalX = dragInfo.current.initialX + deltaX;
    const finalY = dragInfo.current.initialY + deltaY;

    if (!isNaN(finalX) && !isNaN(finalY)) {
      onUpdatePosition(item.id, finalX, finalY);
    }
  };

  const handleDownload = async () => {
    const extension = isVideo ? 'mp4' : 'png';
    const mimeType = isVideo ? 'video/mp4' : 'image/png';
    const filename = `creativeflow-${item.id}.${extension}`;

    try {
      const response = await fetch(item.url);
      const blob = await response.blob();
      const newBlob = new Blob([blob], { type: mimeType });
      const objectUrl = URL.createObjectURL(newBlob);

      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error("Download failed fallback", error);
      const link = document.createElement('a');
      link.href = item.url;
      link.download = filename;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div
      ref={elementRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={(e) => e.stopPropagation()} // Prevent zoom when scrolling inside result card
      // PREMIUM ZOOM: We apply the scale here on the individual block, preventing blurry texture scaling
      style={{
        transform: `translate(${currentX * scale}px, ${currentY * scale}px) scale(${scale})`,
        transformOrigin: '0 0',
        touchAction: 'none'
      }}
      className={`stop-pan absolute top-0 left-0 z-20 group transition-shadow duration-300 sharp-render ${isDraggingVisual ? 'scale-[1.02] z-50 shadow-2xl' : 'shadow-xl'} animate-in fade-in slide-in-from-left-8`}
    >
      <div className="bg-[#F8FAFC] dark:bg-[#0f172a]/95 border border-slate-200 dark:border-[#1e293b] rounded-[1.5rem] overflow-hidden w-[320px] backdrop-blur-xl flex flex-col shadow-2xl relative">

        {/* Header - NOW DRAGGABLE HANDLE */}
        <div
          onPointerDown={handlePointerDown}
          className={`px-5 py-3 flex justify-between items-center bg-slate-50/80 dark:bg-[#1e293b]/60 border-b border-slate-200 dark:border-white/5 transition-colors ${isDraggingVisual ? 'cursor-grabbing' : 'cursor-grab hover:bg-slate-100 dark:hover:bg-white/5'}`}
        >
          <div className="flex items-center gap-2 pointer-events-none">
            <span className={`w-2 h-2 rounded-full ${!isVideo ? 'bg-indigo-500' : 'bg-purple-500'}`}></span>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">
              {isVideo ? 'Vídeo' : 'Resultado'}
            </span>
          </div>
          <div className="flex items-center gap-2 no-drag">
            <button onClick={(e) => { e.stopPropagation(); onExpand(item.id); }} className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-400 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white" title="Expandir">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(item.id); }} className="p-1.5 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Media */}
        <div className="relative w-full bg-slate-100 dark:bg-black aspect-square flex items-center justify-center overflow-hidden no-drag cursor-pointer group/media" onClick={() => onExpand(item.id)}>
          {!isVideo ? (
            <img src={item.url} className="w-full h-full object-contain" alt="Resultado" />
          ) : (
            <video src={item.url} className="w-full h-full object-contain" controls={false} playsInline autoPlay muted loop />
          )}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/media:opacity-100 transition-opacity flex items-center justify-center">
            <span className="text-white text-xs font-bold uppercase tracking-widest border border-white/30 px-3 py-1 rounded-full backdrop-blur-md">Visualizar</span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 grid grid-cols-2 gap-3 no-drag bg-white dark:bg-[#0f172a] border-t border-slate-100 dark:border-white/5 cursor-default">
          <button onClick={handleDownload} className="flex items-center justify-center gap-2 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white rounded-xl text-[10px] font-black uppercase tracking-wide transition-colors border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            {isVideo ? 'Baixar' : 'Baixar'}
          </button>
          <div className="flex items-center justify-center gap-2 py-3 bg-green-500/10 text-green-600 dark:text-green-500 rounded-xl text-[10px] font-black uppercase tracking-wide border border-green-500/20 cursor-default">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            Salvo
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(DraggableResult, (prev, next) => {
  return prev.item.id === next.item.id &&
    prev.item.position?.x === next.item.position?.x &&
    prev.item.position?.y === next.item.position?.y &&
    prev.item.url === next.item.url &&
    prev.scale === next.scale;
});
