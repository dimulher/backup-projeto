
import React, { useState, useEffect, useRef } from 'react';
import { CreationItem, CreationType, Quality } from '../types';
import { CREDIT_COSTS } from '../constants';

interface FullscreenViewerProps {
  item: CreationItem | null;
  onClose: () => void;
}

const FullscreenViewer: React.FC<FullscreenViewerProps> = ({ item, onClose }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [showDetails, setShowDetails] = useState(true); // Default to show details
  
  const dragStart = useRef({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement>(null);

  // Reset state when item changes
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setShowDetails(true);
  }, [item]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!item) return null;

  // Correctly identify all video types
  const isVideo = [
    CreationType.VIDEO, 
    CreationType.IMAGE_TO_VIDEO, 
    CreationType.MIMIC, 
    CreationType.FACE_TO_VIDEO
  ].includes(item.type);

  // Helper to determine cost (replicated from logic since not stored on item yet)
  const getCreditCost = () => {
    if (item.type === CreationType.IMAGE || item.type === CreationType.CREATIVE_MODEL) {
       return (CREDIT_COSTS.IMAGE as any)[item.quality || Quality.K1];
    }
    if (item.type === CreationType.AVATAR) return CREDIT_COSTS.AVATAR;
    if (item.type === CreationType.VIDEO) return CREDIT_COSTS.VIDEO;
    if (item.type === CreationType.IMAGE_TO_VIDEO) return CREDIT_COSTS.IMAGE_TO_VIDEO;
    if (item.type === CreationType.FACE_TO_VIDEO) return CREDIT_COSTS.FACE_TO_VIDEO;
    if (item.type === CreationType.MIMIC) return CREDIT_COSTS.MIMIC;
    return 0;
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    const extension = isVideo ? 'mp4' : 'png';
    const mimeType = isVideo ? 'video/mp4' : 'image/png';
    const filename = `creativeflow-${item.id}.${extension}`;

    try {
      // Fetch data to ensure we have a valid blob with correct type
      const response = await fetch(item.url);
      const blob = await response.blob();
      
      // Force the correct MIME type
      const newBlob = new Blob([blob], { type: mimeType });
      const objectUrl = URL.createObjectURL(newBlob);
      
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Cleanup
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error("Download failed, falling back to direct link", error);
      // Fallback for direct URLs
      const link = document.createElement('a');
      link.href = item.url;
      link.download = filename;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleCopyPrompt = () => {
      navigator.clipboard.writeText(item.prompt);
      alert("Prompt copiado para a área de transferência.");
  };

  // --- Zoom Logic (Images Only) ---
  const handleWheel = (e: React.WheelEvent) => {
    if (isVideo) return;
    e.stopPropagation();
    // Zoom logic
    const delta = -e.deltaY * 0.001;
    setScale(prev => Math.min(Math.max(prev + delta, 0.5), 5));
  };

  const zoomIn = (e: React.MouseEvent) => { e.stopPropagation(); setScale(prev => Math.min(prev + 0.5, 5)); };
  const zoomOut = (e: React.MouseEvent) => { e.stopPropagation(); setScale(prev => Math.max(prev - 0.5, 0.5)); };
  const resetZoom = (e: React.MouseEvent) => { 
    e.stopPropagation(); 
    setScale(1); 
    setPosition({ x: 0, y: 0 }); 
  };

  // --- Pan Logic ---
  const handlePointerDown = (e: React.PointerEvent) => {
    if (isVideo || scale <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-200 overflow-hidden font-['Plus_Jakarta_Sans']"
      onClick={onClose}
    >
        {/* Main Content (Image/Video) */}
        <div 
            className={`
                relative h-full transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] flex items-center justify-center p-4 md:p-10
                ${showDetails ? 'w-full md:w-[calc(100%-400px)]' : 'w-full'}
            `}
            onWheel={handleWheel}
        >
            <div 
                onClick={(e) => e.stopPropagation()}
                className="relative shadow-2xl shadow-black/50 transition-transform duration-75 ease-out"
                style={{
                    transform: !isVideo ? `translate(${position.x}px, ${position.y}px) scale(${scale})` : 'none',
                    cursor: isDragging ? 'grabbing' : (scale > 1 ? 'grab' : 'default')
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
            >
                {!isVideo ? (
                    <img 
                    ref={imgRef}
                    src={item.url} 
                    alt="Fullscreen View" 
                    className="max-w-full max-h-[85vh] object-contain rounded-lg select-none pointer-events-none"
                    style={{ pointerEvents: 'none' }} 
                    />
                ) : (
                    <video 
                    src={item.url} 
                    controls 
                    autoPlay 
                    className="max-w-full max-h-[85vh] rounded-lg bg-black outline-none border border-white/10"
                    />
                )}
            </div>

            {/* Floating Image Controls (Bottom Center) - Only for Images */}
            {!isVideo && (
                <div 
                className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 p-2 bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-lg"
                onClick={(e) => e.stopPropagation()}
                >
                    <button onClick={zoomOut} className="p-2 hover:bg-white/20 rounded-xl text-white transition-colors" title="Diminuir Zoom">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                    </button>
                    <span className="w-12 text-center text-xs font-mono font-bold text-white select-none">
                        {Math.round(scale * 100)}%
                    </span>
                    <button onClick={zoomIn} className="p-2 hover:bg-white/20 rounded-xl text-white transition-colors" title="Aumentar Zoom">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    </button>
                    
                    <div className="w-[1px] h-6 bg-white/20 mx-1"></div>
                    
                    <button onClick={resetZoom} className="px-3 py-1.5 hover:bg-white/20 rounded-xl text-white text-[10px] uppercase font-bold tracking-wide transition-colors">
                        Ajustar
                    </button>
                </div>
            )}
        </div>

        {/* Sidebar / Details Panel */}
        <div 
            className={`
                fixed top-0 right-0 h-full bg-[#0f172a] border-l border-white/10 shadow-2xl z-50 transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]
                w-full md:w-[400px] flex flex-col
                ${showDetails ? 'translate-x-0' : 'translate-x-full'}
            `}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#020617]/50">
                <div>
                   <h2 className="text-lg font-bold text-white">Detalhes do Criativo</h2>
                   <p className="text-xs text-slate-400 mt-0.5">{new Date(item.createdAt).toLocaleString('pt-BR')}</p>
                </div>
                <button 
                   onClick={() => setShowDetails(false)}
                   className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors md:hidden"
                >
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                <button 
                   onClick={onClose}
                   className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors hidden md:block"
                   title="Fechar"
                >
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
                
                {/* Prompt Section */}
                <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Prompt Utilizado</label>
                    <div className="bg-black/30 rounded-xl p-4 border border-white/5 text-sm text-slate-300 leading-relaxed font-medium">
                        {item.prompt}
                    </div>
                    <button 
                        onClick={handleCopyPrompt}
                        className="flex items-center gap-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                        Copiar Prompt
                    </button>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Modelo</label>
                        <p className="text-white text-xs font-bold">{item.type}</p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Proporção</label>
                        <p className="text-white text-xs font-bold">{item.aspectRatio}</p>
                    </div>
                    {!isVideo && (
                        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Qualidade</label>
                            <p className="text-white text-xs font-bold">{item.quality || 'N/A'}</p>
                        </div>
                    )}
                     <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Créditos</label>
                        <p className="text-indigo-400 text-xs font-black">{getCreditCost()} CR</p>
                    </div>
                </div>

            </div>

            {/* Footer Actions */}
            <div className="p-6 border-t border-white/10 bg-[#020617]/50 flex gap-3">
                <button 
                   onClick={handleDownload}
                   className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95 flex items-center justify-center gap-2"
                >
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                   Baixar {isVideo ? 'Vídeo' : 'Imagem'}
                </button>
            </div>
        </div>

        {/* Floating Toggle Button (When sidebar is hidden or on Mobile) */}
        {!showDetails && (
             <button 
                onClick={(e) => { e.stopPropagation(); setShowDetails(true); }}
                className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md border border-white/10 z-40 shadow-xl"
                title="Ver Detalhes"
             >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             </button>
        )}
    </div>
  );
};

export default FullscreenViewer;
