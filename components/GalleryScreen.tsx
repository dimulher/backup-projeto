
import React, { useState } from 'react';
import { CreationItem, Folder, CreationType, GALLERY_TAGS } from '../types';
import { FEATURE_FLAGS } from '../constants';

interface GalleryScreenProps {
  items: CreationItem[];
  folders: Folder[];
  onDelete: (id: string) => void;
  onMove: (itemId: string, folderId: string) => void;
  onAddFolder: (name: string) => void;
  onViewItem: (item: CreationItem) => void;
  onUpdateTags: (itemId: string, tags: string[]) => void;
}

const GalleryScreen: React.FC<GalleryScreenProps> = ({ 
  items, 
  folders, 
  onDelete, 
  onMove, 
  onAddFolder,
  onViewItem,
  onUpdateTags
}) => {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  // Tag Filtering State
  const [selectedFilterTags, setSelectedFilterTags] = useState<string[]>([]);
  
  // Media Type Filtering State
  const [mediaFilter, setMediaFilter] = useState<'ALL' | 'IMAGE' | 'VIDEO'>('ALL');

  // Toggle dropdown state per item (store ID of item with open dropdown)
  const [openTagDropdownId, setOpenTagDropdownId] = useState<string | null>(null);

  // Filter items: Must be explicitly savedToGallery OR be from previous version (undefined)
  const savedItems = items.filter(i => i.savedToGallery === true || i.savedToGallery === undefined);

  const filteredItems = savedItems.filter(i => {
    // Folder Filter
    const matchFolder = selectedFolderId ? i.folderId === selectedFolderId : true;
    
    // Media Type Filter
    const isVideo = [CreationType.VIDEO, CreationType.IMAGE_TO_VIDEO, CreationType.MIMIC, CreationType.FACE_TO_VIDEO].includes(i.type);
    let matchType = true;
    if (mediaFilter === 'IMAGE') matchType = !isVideo;
    if (mediaFilter === 'VIDEO') matchType = isVideo;

    // Tag Filter (OR logic: if item has ANY of the selected tags, show it)
    // If no tags selected, show all.
    let matchTags = true;
    if (FEATURE_FLAGS.TAGS_ENABLED && selectedFilterTags.length > 0) {
       matchTags = i.tags ? i.tags.some(tag => selectedFilterTags.includes(tag)) : false;
    }

    return matchFolder && matchTags && matchType;
  });

  const handleDownload = async (item: CreationItem) => {
    // Correctly identify all video types
    const isVideo = [
        CreationType.VIDEO, 
        CreationType.IMAGE_TO_VIDEO, 
        CreationType.MIMIC, 
        CreationType.FACE_TO_VIDEO
    ].includes(item.type);

    const extension = isVideo ? 'mp4' : 'png';
    const mimeType = isVideo ? 'video/mp4' : 'image/png';
    const filename = `${item.prompt.substring(0, 15) || 'creativeflow'}-${item.id}.${extension}`;

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
      console.error("Download error", error);
      const link = document.createElement('a');
      link.href = item.url;
      link.download = filename;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFolderName.trim()) {
      onAddFolder(newFolderName.trim());
      setNewFolderName('');
      setIsCreatingFolder(false);
    }
  };

  const toggleFilterTag = (tag: string) => {
    setSelectedFilterTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const toggleItemTag = (itemId: string, tag: string, currentTags: string[] = []) => {
      const newTags = currentTags.includes(tag) 
        ? currentTags.filter(t => t !== tag)
        : [...currentTags, tag];
      
      onUpdateTags(itemId, newTags);
  };

  const getTagColor = (tag: string) => {
     switch(tag) {
         case GALLERY_TAGS.ACTIVE: return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
         case GALLERY_TAGS.WINNER: return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
         case GALLERY_TAGS.TEST: return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
         case GALLERY_TAGS.IDEA: return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
         default: return 'bg-slate-700 text-slate-300 border-slate-600';
     }
  };

  // Close dropdown when clicking outside (simple implementation for now handled by conditional rendering and click overlay)
  
  return (
    <div className="flex flex-col md:flex-row gap-10 min-h-screen" onClick={() => setOpenTagDropdownId(null)}>
      
      {/* Sidebar */}
      <aside className="w-full md:w-72 flex flex-col gap-6" onClick={(e) => e.stopPropagation()}>
        <div className="glass p-6 rounded-[2rem] bg-[#0f172a]/80 backdrop-blur-xl border border-white/10">
           
           {/* Media Type Filter */}
           <div className="mb-6">
              <h3 className="font-bold text-slate-400 text-xs uppercase tracking-widest mb-3">Tipo de Mídia</h3>
              <div className="grid grid-cols-3 gap-1 bg-black/20 p-1 rounded-xl border border-white/5">
                 <button 
                    onClick={() => setMediaFilter('ALL')}
                    className={`text-[10px] font-bold uppercase py-2 rounded-lg transition-all ${mediaFilter === 'ALL' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                 >
                    Tudo
                 </button>
                 <button 
                    onClick={() => setMediaFilter('IMAGE')}
                    className={`text-[10px] font-bold uppercase py-2 rounded-lg transition-all ${mediaFilter === 'IMAGE' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                 >
                    Img
                 </button>
                 <button 
                    onClick={() => setMediaFilter('VIDEO')}
                    className={`text-[10px] font-bold uppercase py-2 rounded-lg transition-all ${mediaFilter === 'VIDEO' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                 >
                    Vid
                 </button>
              </div>
           </div>

           {/* Folders Section */}
           <div className="mb-8">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-slate-400 text-xs uppercase tracking-widest">Pastas</h3>
                  <button 
                    onClick={() => setIsCreatingFolder(true)}
                    className="text-white hover:bg-white/10 w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                    title="Nova Pasta"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  </button>
               </div>
               
               {isCreatingFolder && (
                 <form onSubmit={handleCreateFolder} className="mb-4 animate-in slide-in-from-top-2">
                   <div className="flex gap-2">
                     <input 
                       autoFocus
                       type="text" 
                       value={newFolderName}
                       onChange={e => setNewFolderName(e.target.value)}
                       placeholder="Nome da pasta..."
                       className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                     />
                     <button type="submit" className="bg-indigo-600 text-white px-3 rounded-lg text-xs font-bold hover:bg-indigo-500">
                       OK
                     </button>
                   </div>
                 </form>
               )}

               <nav className="space-y-2 max-h-[30vh] overflow-y-auto pr-2 scrollbar-hide">
                  <button 
                    onClick={() => setSelectedFolderId(null)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all border ${!selectedFolderId ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'border-transparent text-slate-400 hover:bg-white/5 hover:text-white'}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                    <span className="font-medium text-sm">Todos os Assets</span>
                    <span className="ml-auto text-[10px] opacity-60 bg-black/20 px-2 py-0.5 rounded-md">{savedItems.length}</span>
                  </button>
                  
                  {folders.map(f => {
                    const count = savedItems.filter(i => i.folderId === f.id).length;
                    return (
                      <button 
                        key={f.id}
                        onClick={() => setSelectedFolderId(f.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all border ${selectedFolderId === f.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'border-transparent text-slate-400 hover:bg-white/5 hover:text-white'}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                        <span className="font-medium text-sm truncate">{f.name}</span>
                        <span className="ml-auto text-[10px] opacity-60 bg-black/20 px-2 py-0.5 rounded-md">{count}</span>
                      </button>
                    );
                  })}
               </nav>
           </div>
           
           {/* Tags Filter Section - FEATURE FLAG CHECK */}
           {FEATURE_FLAGS.TAGS_ENABLED && (
           <div className="animate-in fade-in slide-in-from-left-2">
              <h3 className="font-bold text-slate-400 text-xs uppercase tracking-widest mb-4">Filtrar por Tags</h3>
              <div className="space-y-2">
                 {Object.values(GALLERY_TAGS).map(tag => {
                    const isSelected = selectedFilterTags.includes(tag);
                    return (
                        <button
                           key={tag}
                           onClick={() => toggleFilterTag(tag)}
                           className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all border ${
                               isSelected 
                               ? getTagColor(tag) + ' shadow-sm' 
                               : 'bg-transparent border-transparent text-slate-500 hover:bg-white/5 hover:text-white'
                           }`}
                        >
                           <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-current' : 'bg-slate-600'}`}></div>
                           {tag}
                           {isSelected && <svg className="w-3 h-3 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </button>
                    );
                 })}
              </div>
           </div>
           )}

        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1" onClick={() => setOpenTagDropdownId(null)}>
        {filteredItems.length === 0 ? (
          <div className="h-[60vh] flex flex-col items-center justify-center text-slate-500">
            <div className="w-24 h-24 rounded-full bg-slate-900/50 flex items-center justify-center mb-6 border border-white/5">
               <svg className="w-10 h-10 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
            <p className="font-bold text-xl text-slate-300">Nenhum criativo encontrado</p>
            <p className="text-sm mt-2 max-w-xs text-center">Gere novos criativos ou ajuste seus filtros de busca.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
            {filteredItems.map(item => {
              const isVideo = [CreationType.VIDEO, CreationType.IMAGE_TO_VIDEO, CreationType.MIMIC, CreationType.FACE_TO_VIDEO].includes(item.type);
              
              return (
              <div key={item.id} className="group relative bg-[#0f172a] border border-white/10 rounded-[1.5rem] overflow-visible hover:border-indigo-500/50 hover:shadow-2xl transition-all duration-300 animate-in fade-in zoom-in-95">
                <div 
                   onClick={() => onViewItem(item)}
                   className="aspect-square relative overflow-hidden bg-slate-900 cursor-pointer rounded-t-[1.5rem]"
                >
                  {!isVideo ? (
                    <img src={item.url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="Gerado" />
                  ) : (
                    <video src={item.url} className="w-full h-full object-cover" autoPlay loop muted playsInline />
                  )}
                  
                  {/* Badges */}
                  <div className="absolute top-3 left-3 flex flex-wrap gap-2 max-w-[80%]">
                    <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest shadow-lg border border-black/20 ${!isVideo ? 'bg-indigo-500 text-white' : 'bg-purple-500 text-white'}`}>
                      {!isVideo ? 'IMG' : 'VID'}
                    </span>
                    {item.folderId && (
                       <span className="px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wide bg-slate-900/80 text-slate-300 backdrop-blur-md border border-white/10">
                         {folders.find(f => f.id === item.folderId)?.name}
                       </span>
                    )}
                    {/* Tag Badges on Image - FEATURE FLAG CHECK */}
                    {FEATURE_FLAGS.TAGS_ENABLED && item.tags?.map(tag => (
                        <span key={tag} className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wide border shadow-md backdrop-blur-md ${getTagColor(tag)}`}>
                            {tag}
                        </span>
                    ))}
                  </div>

                  {/* View Badge Overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                     <span className="bg-white/20 backdrop-blur-md border border-white/30 text-white px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest">
                        Visualizar
                     </span>
                  </div>
                </div>

                {/* Footer Info */}
                <div className="p-4 border-t border-white/5 relative bg-[#0f172a] rounded-b-[1.5rem]">
                   <p className="text-white text-[11px] font-medium line-clamp-2 leading-relaxed opacity-80 h-8 mb-4 group-hover:text-indigo-300 transition-colors">
                      {item.prompt}
                   </p>
                   
                   <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleDownload(item)}
                        className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors border border-white/5 shrink-0"
                        title={isVideo ? "Baixar MP4" : "Baixar"}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      </button>
                      
                      {/* Folder Mover */}
                      <div className="relative group/move flex-1">
                        <select 
                          value={item.folderId || ""} 
                          onChange={(e) => onMove(item.id, e.target.value)}
                          className="w-full h-8 appearance-none bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-bold uppercase rounded-lg border border-white/5 outline-none text-center cursor-pointer pl-2 pr-6"
                        >
                          <option value="" className="bg-slate-900 text-slate-400">Sem Pasta</option>
                          {folders.map(f => <option key={f.id} value={f.id} className="bg-slate-900">{f.name}</option>)}
                        </select>
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                           <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </div>

                      {/* Tag Manager Button - FEATURE FLAG CHECK */}
                      {FEATURE_FLAGS.TAGS_ENABLED && (
                      <div className="relative" onClick={(e) => e.stopPropagation()}>
                          <button 
                             onClick={() => setOpenTagDropdownId(openTagDropdownId === item.id ? null : item.id)}
                             className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors border ${openTagDropdownId === item.id ? 'bg-indigo-500 text-white border-indigo-400' : 'bg-slate-800 text-slate-400 hover:text-white border-white/5'}`}
                             title="Gerenciar Tags"
                          >
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                          </button>
                          
                          {/* Dropdown Menu */}
                          {openTagDropdownId === item.id && (
                              <div className="absolute bottom-full right-0 mb-2 w-48 bg-slate-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[50] animate-in slide-in-from-bottom-2 fade-in">
                                  <div className="px-3 py-2 border-b border-white/5 bg-black/20">
                                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Adicionar Tags</p>
                                  </div>
                                  <div className="p-1">
                                      {Object.values(GALLERY_TAGS).map(tag => {
                                          const hasTag = item.tags?.includes(tag);
                                          return (
                                              <button
                                                  key={tag}
                                                  onClick={() => toggleItemTag(item.id, tag, item.tags)}
                                                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-lg mb-0.5 transition-colors ${
                                                      hasTag ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-white/10 hover:text-white'
                                                  }`}
                                              >
                                                  <div className={`w-2 h-2 rounded-full border ${hasTag ? 'bg-white border-white' : 'border-slate-500'}`}></div>
                                                  {tag}
                                              </button>
                                          );
                                      })}
                                  </div>
                              </div>
                          )}
                      </div>
                      )}

                      <button 
                        onClick={() => onDelete(item.id)}
                        className="w-8 h-8 flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors border border-red-500/10 shrink-0"
                        title="Excluir"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                   </div>
                </div>
              </div>
            )})}
          </div>
        )}
      </div>
    </div>
  );
};

export default GalleryScreen;
