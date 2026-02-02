
import React, { useState, useMemo } from 'react';
import { LibraryItem, CreationType, ReferenceRole } from '../types';

interface LibraryScreenProps {
  onUseItem: (item: LibraryItem, mode: 'MODEL' | 'REFERENCE') => void;
}

// MOCK DATA - PLACEHOLDERS
// In a real app, these images would be hosted on a CDN or retrieved from a backend.
// Using Unsplash source for high quality placeholders.
const LIBRARY_DATA: LibraryItem[] = [
  {
    id: 'lib_1',
    title: 'Estética Premium',
    niche: 'Saúde / Estética',
    objective: 'Vendas',
    platform: 'Instagram',
    isPremium: true,
    thumbnail: 'https://images.unsplash.com/photo-1556228552-6c330571442f?w=600&auto=format&fit=crop&q=60',
    url: 'https://images.unsplash.com/photo-1556228552-6c330571442f?w=1200&auto=format&fit=crop&q=80',
    promptSuggestion: 'Frasco de skincare minimalista em pódio branco, iluminação suave, sombras delicadas, alta resolução.'
  },
  {
    id: 'lib_2',
    title: 'Gadget High-Tech',
    niche: 'E-commerce',
    objective: 'Autoridade',
    platform: 'LinkedIn',
    isPremium: true,
    thumbnail: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600&auto=format&fit=crop&q=60',
    url: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&auto=format&fit=crop&q=80',
    promptSuggestion: 'Workspace tecnológico moderno, laptop aberto com código, iluminação azul neon e laranja, profundidade de campo.'
  },
  {
    id: 'lib_3',
    title: 'Personal Trainer',
    niche: 'Mentores / Coaches',
    objective: 'Engajamento',
    platform: 'Instagram',
    isPremium: false,
    thumbnail: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&auto=format&fit=crop&q=60',
    url: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1200&auto=format&fit=crop&q=80',
    promptSuggestion: 'Pessoa treinando em academia moderna, movimento dinâmico, iluminação contrastante, foco na determinação.'
  },
  {
    id: 'lib_4',
    title: 'Burguer Artesanal',
    niche: 'Negócios Locais',
    objective: 'Vendas',
    platform: 'Instagram',
    isPremium: true,
    thumbnail: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=60',
    url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1200&auto=format&fit=crop&q=80',
    promptSuggestion: 'Hambúrguer artesanal suculento, queijo derretendo, fundo escuro rústico, fumaça sutil, fotografia de alimentos macro.'
  },
  {
    id: 'lib_5',
    title: 'Advocacia Corporativa',
    niche: 'Advocacia / Profissionais Liberais',
    objective: 'Autoridade',
    platform: 'LinkedIn',
    isPremium: false,
    thumbnail: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=600&auto=format&fit=crop&q=60',
    url: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1200&auto=format&fit=crop&q=80',
    promptSuggestion: 'Profissionais em reunião de negócios, escritório moderno com vidro, luz natural, atmosfera de colaboração e sucesso.'
  },
  {
    id: 'lib_6',
    title: 'Coleção Outono',
    niche: 'E-commerce',
    objective: 'Vendas',
    platform: 'Instagram',
    isPremium: true,
    thumbnail: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&auto=format&fit=crop&q=60',
    url: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1200&auto=format&fit=crop&q=80',
    promptSuggestion: 'Modelo fashion street style, casaco elegante, cidade ao fundo desocada, iluminação golden hour.'
  },
  {
    id: 'lib_7',
    title: 'Apartamento Luxo',
    niche: 'Imobiliário',
    objective: 'Engajamento',
    platform: 'Pinterest',
    isPremium: false,
    thumbnail: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?w=600&auto=format&fit=crop&q=60',
    url: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4f9d?w=1200&auto=format&fit=crop&q=80',
    promptSuggestion: 'Sala de estar escandinava aconchegante, luz solar suave, plantas, tons neutros e madeira clara.'
  },
  {
    id: 'lib_8',
    title: 'Curso Online Gamer',
    niche: 'Infoprodutos',
    objective: 'Engajamento',
    platform: 'TikTok',
    isPremium: true,
    thumbnail: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=600&auto=format&fit=crop&q=60',
    url: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1200&auto=format&fit=crop&q=80',
    promptSuggestion: 'Setup gamer com luzes RGB, teclado mecânico, monitor curvo, atmosfera imersiva e vibrante.'
  }
];

const NICHES = [
  'Todos',
  'Mentores / Coaches',
  'Infoprodutos',
  'Negócios Locais',
  'E-commerce',
  'Imobiliário',
  'Saúde / Estética',
  'Advocacia / Profissionais Liberais'
];

const LibraryScreen: React.FC<LibraryScreenProps> = ({ onUseItem }) => {
  const [selectedNiche, setSelectedNiche] = useState('Todos');
  const [search, setSearch] = useState('');
  const [showUnlockModal, setShowUnlockModal] = useState(false);

  const filteredItems = useMemo(() => {
    return LIBRARY_DATA.filter(item => {
      const matchNiche = selectedNiche === 'Todos' || item.niche === selectedNiche;
      const matchSearch = item.title.toLowerCase().includes(search.toLowerCase()) || 
                          item.niche.toLowerCase().includes(search.toLowerCase());
      return matchNiche && matchSearch;
    });
  }, [selectedNiche, search]);

  return (
    <div className="max-w-7xl mx-auto min-h-screen animate-in fade-in zoom-in-95 duration-300 pb-20">
      
      {/* Header */}
      <div className="mb-10 text-center md:text-left">
        <div className="inline-flex items-center gap-3 mb-4 bg-indigo-500/10 px-4 py-1.5 rounded-full border border-indigo-500/20">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
            <span className="text-xs font-bold text-indigo-300 uppercase tracking-widest">Acervo Oficial</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">
          Criativos <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">Prontos</span>
        </h1>
        <p className="text-slate-400 max-w-2xl text-lg leading-relaxed">
          Explore nossa biblioteca de referências visuais validadas. Use como modelo para seus próprios criativos ou como inspiração direta.
        </p>
      </div>

      {/* Filters Bar */}
      <div className="glass p-4 rounded-2xl mb-8 flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-900/50 border border-white/5">
         
         <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
             {/* Search */}
             <div className="relative group/search w-full md:w-64">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/search:text-indigo-400 transition-colors">
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <input 
                   type="text" 
                   placeholder="Buscar criativos..." 
                   value={search}
                   onChange={(e) => setSearch(e.target.value)}
                   className="w-full bg-black/20 hover:bg-black/40 focus:bg-black/40 border border-white/10 focus:border-indigo-500/50 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-all"
                />
             </div>

             {/* Niche Dropdown */}
             <div className="relative group/niche w-full md:w-48">
                <select 
                   value={selectedNiche}
                   onChange={(e) => setSelectedNiche(e.target.value)}
                   className="w-full bg-black/20 hover:bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none cursor-pointer appearance-none"
                >
                   {NICHES.map(n => <option key={n} value={n} className="bg-slate-900">{n}</option>)}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
             </div>
         </div>

         <div className="text-slate-500 text-xs font-bold uppercase tracking-widest hidden md:block">
            {filteredItems.length} Resultados
         </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredItems.length > 0 && filteredItems.map((item) => (
            <div key={item.id} className="group relative bg-[#0f172a] border border-white/10 rounded-2xl overflow-hidden hover:border-indigo-500/50 hover:shadow-2xl transition-all duration-300 flex flex-col">
                {/* Image Container */}
                <div className="aspect-[4/5] relative overflow-hidden bg-black">
                    <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-90 group-hover:opacity-100" />
                    
                    {/* Overlay Actions */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 p-6 backdrop-blur-sm">
                    <button 
                        onClick={() => onUseItem(item, 'MODEL')}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-widest rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                        Modelar Criativo
                    </button>
                    <button 
                        onClick={() => onUseItem(item, 'REFERENCE')}
                        className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-widest rounded-xl border border-white/20 transition-transform active:scale-95 flex items-center justify-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        Usar Referência
                    </button>
                    </div>

                    {/* Badges */}
                    <div className="absolute top-3 left-3 flex flex-wrap gap-2 pointer-events-none">
                    {item.isPremium && (
                        <span className="px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg">Premium</span>
                    )}
                    <span className="px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wide bg-black/60 text-white backdrop-blur-md border border-white/10">{item.platform}</span>
                    </div>
                </div>

                {/* Info */}
                <div className="p-4 bg-[#0f172a] border-t border-white/5 flex-1 flex flex-col">
                    <h3 className="text-sm font-bold text-white mb-1 group-hover:text-indigo-400 transition-colors">{item.title}</h3>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium uppercase tracking-wide mt-auto">
                    <span className="bg-white/5 px-2 py-0.5 rounded">{item.niche}</span>
                    <span>•</span>
                    <span className="text-indigo-400">{item.objective}</span>
                    </div>
                </div>
            </div>
        ))}

        {/* UNLOCK CARD */}
        <div 
            onClick={() => setShowUnlockModal(true)}
            className="group relative bg-[#0f172a]/50 border-2 border-dashed border-white/10 hover:border-indigo-500/50 rounded-2xl overflow-hidden hover:bg-white/5 transition-all duration-300 flex flex-col items-center justify-center cursor-pointer min-h-[320px]"
        >
            <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mb-6 text-indigo-400 group-hover:scale-110 group-hover:text-indigo-300 transition-all border border-indigo-500/20 group-hover:border-indigo-500/50 shadow-lg group-hover:shadow-indigo-500/20">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            </div>
            
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-2 text-center px-4 group-hover:text-indigo-300 transition-colors">
                Mais criativos deste tipo
            </h3>
            
            <p className="text-[10px] text-slate-400 font-medium text-center px-6 leading-relaxed mb-6">
                Desbloqueie modelos prontos para este nicho e escale sua produção.
            </p>
            
            <button className="px-5 py-2 bg-white/10 hover:bg-indigo-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border border-white/10 group-hover:border-transparent shadow-lg active:scale-95">
                Desbloquear Agora
            </button>
        </div>
      </div>

      {/* No Results Fallback */}
      {filteredItems.length === 0 && (
         <div className="py-20 text-center text-slate-500 bg-slate-900/30 rounded-3xl border border-white/5 border-dashed mt-4">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <p className="text-lg font-medium">Nenhum criativo encontrado.</p>
            <p className="text-sm opacity-60">Tente ajustar seus filtros.</p>
         </div>
      )}

      {/* Unlock Modal */}
      {showUnlockModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowUnlockModal(false)}>
            <div 
                className="bg-slate-900 border border-white/10 rounded-3xl p-8 max-w-md w-full text-center relative overflow-hidden shadow-2xl" 
                onClick={(e) => e.stopPropagation()}
            >
                {/* Background Glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-indigo-600/20 rounded-full blur-[80px] pointer-events-none"></div>

                <div className="relative z-10">
                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl transform rotate-3">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                    </div>

                    <h2 className="text-2xl font-black text-white mb-2">Desbloqueie o Pack Premium</h2>
                    <p className="text-slate-400 text-sm mb-8 leading-relaxed">
                        Tenha acesso a +50 templates validados para {selectedNiche === 'Todos' ? 'todos os nichos' : `o nicho de ${selectedNiche}`}.
                    </p>

                    <div className="space-y-3">
                        <button 
                            onClick={() => { alert('Pack desbloqueado com sucesso! (Simulação)'); setShowUnlockModal(false); }}
                            className="w-full py-4 bg-white text-slate-900 font-bold rounded-xl hover:bg-slate-100 transition-colors shadow-lg active:scale-95 flex items-center justify-center gap-2"
                        >
                            <span>Comprar Pack (R$ 29,90)</span>
                        </button>
                        
                        <button 
                            onClick={() => { alert('Desbloqueado com 200 Créditos! (Simulação)'); setShowUnlockModal(false); }}
                            className="w-full py-4 bg-indigo-600/10 text-indigo-400 font-bold rounded-xl hover:bg-indigo-600/20 transition-colors border border-indigo-500/20 active:scale-95 flex items-center justify-center gap-2"
                        >
                            Usar 200 Créditos
                        </button>
                    </div>

                    <button 
                        onClick={() => setShowUnlockModal(false)}
                        className="mt-6 text-xs text-slate-500 hover:text-white transition-colors uppercase font-bold tracking-widest"
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default LibraryScreen;
