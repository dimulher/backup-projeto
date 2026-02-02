
import React, { useState, useMemo } from 'react';
import { CreationType } from '../types';
import { FEATURE_FLAGS } from '../constants';

interface PromptDef {
  id: string;
  category: string;
  model: CreationType;
  title: string;
  description: string;
  text: string;
}

const PREMIUM_PROMPTS: PromptDef[] = [
  // ========================
  // 🖼️ MODELO: TEXTO PARA IMAGEM
  // ========================
  {
    id: 't2i-pro-1',
    category: 'Profissional',
    model: CreationType.IMAGE,
    title: 'Criação Visual Profissional',
    description: 'Foco em realismo e acabamento fotográfico.',
    text: 'Gere uma imagem altamente realista com base no texto fornecido. Respeite fielmente o estilo descrito, com iluminação natural, composição equilibrada, cores coerentes e acabamento profissional. O resultado deve parecer uma imagem fotográfica real, sem aparência artificial.'
  },
  {
    id: 't2i-ads-1',
    category: 'Marketing',
    model: CreationType.IMAGE,
    title: 'Criativo Publicitário',
    description: 'Estética premium para impacto visual.',
    text: 'Crie uma imagem com estética premium, foco em impacto visual e clareza da mensagem. Utilize iluminação cinematográfica, enquadramento estratégico e alto nível de realismo, adequada para uso em campanhas de marketing e criativos profissionais.'
  },
  {
    id: 't2i-cine-1',
    category: 'Cinema',
    model: CreationType.IMAGE,
    title: 'Imagem Cinematográfica',
    description: 'Profundidade e iluminação dramática.',
    text: 'Gere uma imagem com estilo cinematográfico, profundidade de campo bem definida, iluminação dramática e composição avançada. O resultado deve transmitir realismo, emoção e qualidade visual elevada.'
  },
  {
    id: 't2i-clean-1',
    category: 'Comercial',
    model: CreationType.IMAGE,
    title: 'Imagem Clean e Comercial',
    description: 'Estética moderna e visualmente equilibrada.',
    text: 'Crie uma imagem limpa, profissional e visualmente equilibrada, com foco em clareza, estética moderna e aparência realista. Ideal para uso comercial, branding ou anúncios.'
  },

  // ========================
  // 🔁 MODELO: IMAGEM PARA IMAGEM (Usando CreationType.IMAGE como base)
  // ========================
  {
    id: 'i2i-swap-1',
    category: 'Edição',
    model: CreationType.IMAGE,
    title: 'Substituição Total de Pessoa',
    description: 'Troca de sujeito mantendo o cenário.',
    text: 'Substitua completamente a pessoa da segunda imagem pela pessoa da primeira imagem (imagem de referência). Remova totalmente a pessoa original, preservando cenário, iluminação, pose, enquadramento e proporções. O resultado deve ser hiper-realista, sem vestígios de edição.'
  },
  {
    id: 'i2i-identity-1',
    category: 'Edição',
    model: CreationType.IMAGE,
    title: 'Troca de Identidade Visual',
    description: 'Integração visual perfeita.',
    text: 'Utilize a pessoa da primeira imagem como identidade principal e substitua integralmente a pessoa presente na segunda imagem. Mantenha o mesmo ambiente, iluminação, pose e enquadramento, garantindo integração visual perfeita e aparência natural.'
  },
  {
    id: 'i2i-scene-1',
    category: 'Edição',
    model: CreationType.IMAGE,
    title: 'Preservação de Cena',
    description: 'Manter perspectiva e iluminação.',
    text: 'Remova completamente a pessoa da segunda imagem e insira a pessoa da primeira imagem no mesmo local, respeitando rigorosamente pose, escala, iluminação e perspectiva. O resultado deve parecer uma foto original.'
  },
  {
    id: 'i2i-pro-sub-1',
    category: 'Edição',
    model: CreationType.IMAGE,
    title: 'Substituição Profissional',
    description: 'Manutenção de profundidade de campo.',
    text: 'Substitua integralmente a pessoa da segunda imagem pela pessoa da primeira imagem, mantendo cenário, iluminação, composição e profundidade de campo. Nenhum traço da pessoa original deve permanecer.'
  },

  // ========================
  // 🎥 MODELO: TEXTO PARA VÍDEO
  // ========================
  {
    id: 't2v-cine-1',
    category: 'Cinema',
    model: CreationType.VIDEO,
    title: 'Vídeo Cinematográfico',
    description: 'Movimento natural e aparência fluida.',
    text: 'Gere um vídeo realista com base no texto fornecido, mantendo movimento natural, iluminação coerente, enquadramento estável e aparência cinematográfica. O vídeo deve ser fluido e profissional.'
  },
  {
    id: 't2v-ads-1',
    category: 'Marketing',
    model: CreationType.VIDEO,
    title: 'Vídeo Publicitário',
    description: 'Ritmo dinâmico e alta qualidade.',
    text: 'Crie um vídeo com estética premium, ritmo dinâmico e alta qualidade visual, adequado para campanhas de marketing e anúncios digitais. O movimento deve ser natural e contínuo.'
  },
  {
    id: 't2v-real-1',
    category: 'Realismo',
    model: CreationType.VIDEO,
    title: 'Vídeo Realista',
    description: 'Iluminação equilibrada e transições suaves.',
    text: 'Gere um vídeo com aparência realista, iluminação equilibrada e transições suaves. Evite movimentos artificiais ou distorções visuais.'
  },
  {
    id: 't2v-clean-1',
    category: 'Comercial',
    model: CreationType.VIDEO,
    title: 'Vídeo Clean',
    description: 'Foco em estabilidade e consistência.',
    text: 'Produza um vídeo limpo, fluido e visualmente consistente, com foco em naturalidade, estabilidade e qualidade profissional.'
  },

  // ========================
  // 🎞️ MODELO: IMAGEM PARA VÍDEO
  // ========================
  {
    id: 'i2v-anim-1',
    category: 'Animação',
    model: CreationType.IMAGE_TO_VIDEO,
    title: 'Animação Realista',
    description: 'Fidelidade total à aparência original.',
    text: 'Gere um vídeo animado a partir da imagem fornecida, mantendo fidelidade total à aparência original. Os movimentos devem ser sutis, naturais e coerentes com iluminação e perspectiva.'
  },
  {
    id: 'i2v-fluid-1',
    category: 'Animação',
    model: CreationType.IMAGE_TO_VIDEO,
    title: 'Vídeo Fluido',
    description: 'Movimentos leves preservando identidade.',
    text: 'Transforme a imagem fornecida em um vídeo curto com movimentos leves e realistas, preservando identidade visual, enquadramento e iluminação.'
  },
  {
    id: 'i2v-cine-1',
    category: 'Cinema',
    model: CreationType.IMAGE_TO_VIDEO,
    title: 'Animação Cinematográfica',
    description: 'Profundidade de campo e suavidade.',
    text: 'Crie um vídeo a partir da imagem fornecida, aplicando movimentos suaves, profundidade de campo e iluminação cinematográfica para um resultado natural e profissional.'
  },
  {
    id: 'i2v-subtle-1',
    category: 'Sutil',
    model: CreationType.IMAGE_TO_VIDEO,
    title: 'Movimento Sutil',
    description: 'Animação discreta sem exageros.',
    text: 'Anime a imagem de forma discreta e realista, evitando exageros. O vídeo deve manter coerência visual e aparência natural.'
  },

  // ========================
  // 🧍 MODELO: IMITAR MOVIMENTO
  // ========================
  {
    id: 'mimic-full-1',
    category: 'Mímica',
    model: CreationType.MIMIC,
    title: 'Imitação Total de Movimento',
    description: 'Sincronização de movimento e fala.',
    text: 'Utilize o vídeo enviado como referência principal de movimento e fala. Represente esses movimentos e sincronização labial no avatar fornecido, substituindo completamente a aparência do usuário pelo avatar. O resultado deve ser natural, fluido e realista.'
  },
  {
    id: 'mimic-real-1',
    category: 'Mímica',
    model: CreationType.MIMIC,
    title: 'Avatar com Movimento Real',
    description: 'Preservar ritmo e expressões.',
    text: 'Aplique fielmente os movimentos corporais e a fala do vídeo de referência ao avatar selecionado. Preserve ritmo, expressões e enquadramento, garantindo naturalidade total.'
  },
  {
    id: 'mimic-clone-1',
    category: 'Mímica',
    model: CreationType.MIMIC,
    title: 'Clonagem de Movimento',
    description: 'Replicação precisa sem traços originais.',
    text: 'Replique todos os movimentos e a fala do vídeo de referência no avatar fornecido, mantendo sincronização labial precisa, fluidez e aparência realista. Nenhum traço do usuário original deve permanecer.'
  },
  {
    id: 'mimic-pro-1',
    category: 'Profissional',
    model: CreationType.MIMIC,
    title: 'Imitação Profissional',
    description: 'Transferência de alta coerência visual.',
    text: 'Utilize o vídeo de referência para transferir movimentos e fala ao avatar, garantindo realismo, coerência visual e fluidez natural no resultado final.'
  },

  // --- MANTENDO PROMPTS ORIGINAIS RELEVANTES ---
  {
    id: 'f2v-presentation',
    category: 'Marketing',
    model: CreationType.FACE_TO_VIDEO,
    title: 'Apresentação Corporativa',
    description: 'Avatar falando em ambiente de escritório.',
    text: 'O avatar está em pé em um escritório moderno com vidro ao fundo, gesticulando suavemente com as mãos enquanto explica um conceito, expressão confiante e profissional, iluminação natural vindo da janela lateral.'
  },
  {
    id: 'avatar-tech-1',
    category: 'Influencer', // Updated category
    model: CreationType.AVATAR,
    title: 'Influenciador Tech',
    description: 'Jovem profissional para tutoriais e reviews.',
    text: 'Mulher jovem de 25 anos, descendência asiática, cabelo curto roxo escuro com corte moderno (bob cut), usando óculos de armação fina e um blazer casual cinza sobre camiseta branca. Expressão inteligente e amigável, iluminação de estúdio suave, fundo degradê neutro.'
  },
  {
    id: 'img-ads-1',
    category: 'Marketing',
    model: CreationType.IMAGE,
    title: 'Hero Shot Cosmético',
    description: 'Foco em produtos de luxo com iluminação rim light.',
    text: 'Fotografia publicitária macro de um frasco de sérum luxuoso dourado sobre uma pedra de mármore preto molhada, iluminação rim light dramática, gotas de água realistas, fundo escuro com bokeh suave, qualidade 8k, renderização estilo Octane, fotorrealismo extremo.'
  }
];

const PromptLibrary: React.FC = () => {
  const [activeTab, setActiveTab] = useState<CreationType>(CreationType.IMAGE);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');

  // Categorias dinâmicas baseadas na aba atual
  const categories = useMemo(() => {
    const modelPrompts = PREMIUM_PROMPTS.filter(p => p.model === activeTab);
    const uniqueCats = Array.from(new Set(modelPrompts.map(p => p.category)));
    return ['Todos', ...uniqueCats];
  }, [activeTab]);

  const filteredPrompts = useMemo(() => {
    return PREMIUM_PROMPTS.filter(p => 
      p.model === activeTab && 
      (selectedCategory === 'Todos' || p.category === selectedCategory)
    );
  }, [activeTab, selectedCategory]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Prompt copiado para a área de transferência.");
  };

  const getTabLabel = (type: CreationType) => {
    switch(type) {
      case CreationType.IMAGE: return 'Texto / Imagem'; // Abrange T2I e I2I
      case CreationType.AVATAR: return 'Criar Influencer'; // Updated label
      case CreationType.FACE_TO_VIDEO: return 'Rosto para Vídeo';
      case CreationType.VIDEO: return 'Texto para Vídeo';
      case CreationType.IMAGE_TO_VIDEO: return 'Imagem para Vídeo';
      case CreationType.MIMIC: return 'Imitar Movimento';
      default: return type;
    }
  };

  return (
    <div className="max-w-7xl mx-auto min-h-screen animate-in fade-in zoom-in-95 duration-300">
      
      {/* Header Section */}
      <div className="mb-10 text-center md:text-left">
        <div className="inline-flex items-center gap-3 mb-4 bg-indigo-500/10 px-4 py-1.5 rounded-full border border-indigo-500/20">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
            <span className="text-xs font-bold text-indigo-300 uppercase tracking-widest">Biblioteca Premium</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">
          Prompts de <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Alta Conversão</span>
        </h1>
        <p className="text-slate-400 max-w-2xl text-lg leading-relaxed">
          Uma coleção curada de comandos otimizados para marketing, branding e criação de conteúdo. 
          Selecione um modelo, encontre o prompt ideal e copie para usar no editor.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8 border-b border-white/5 pb-1">
         
         {/* Model Tabs */}
         <div className="flex p-1 bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-white/5 overflow-x-auto max-w-full">
            {Object.values(CreationType)
              .filter(type => {
                  // Filter out CAROUSEL and CREATIVE_MODEL as requested
                  if (type === CreationType.CAROUSEL || type === CreationType.CREATIVE_MODEL) return false;

                  const isVideo = [CreationType.VIDEO, CreationType.IMAGE_TO_VIDEO, CreationType.FACE_TO_VIDEO, CreationType.MIMIC].includes(type);
                  return !isVideo || FEATURE_FLAGS.VIDEO_MODELS_ENABLED;
              })
              .map((type) => (
              <button
                key={type}
                onClick={() => { setActiveTab(type); setSelectedCategory('Todos'); }}
                className={`
                  px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap
                  ${activeTab === type 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                    : 'text-slate-500 hover:text-white hover:bg-white/5'}
                `}
              >
                {getTabLabel(type)}
              </button>
            ))}
         </div>

         {/* Category Filters */}
         <div className="flex gap-2 overflow-x-auto max-w-full pb-2 md:pb-0 scrollbar-hide">
            {categories.map((cat) => (
               <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`
                     px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-wide border transition-all whitespace-nowrap
                     ${selectedCategory === cat 
                        ? 'bg-white text-slate-900 border-white' 
                        : 'bg-transparent text-slate-400 border-white/10 hover:border-white/30 hover:text-white'}
                  `}
               >
                  {cat}
               </button>
            ))}
         </div>
      </div>

      {/* Prompts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
         {filteredPrompts.length === 0 ? (
            <div className="col-span-full py-20 text-center text-slate-500 bg-slate-900/30 rounded-3xl border border-white/5 border-dashed">
               <svg className="w-12 h-12 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
               <p className="text-sm font-medium">Nenhum prompt encontrado para esta combinação.</p>
            </div>
         ) : (
             filteredPrompts.map(prompt => (
                <div key={prompt.id} className="group relative bg-[#0f172a]/80 backdrop-blur-sm border border-white/10 hover:border-indigo-500/50 rounded-3xl p-6 transition-all hover:shadow-2xl hover:shadow-indigo-900/20 hover:-translate-y-1 flex flex-col h-full">
                   
                   <div className="flex justify-between items-start mb-4">
                      <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg text-slate-950 ${
                             prompt.category === 'Marketing' ? 'bg-emerald-400' :
                             prompt.category === 'Edição' ? 'bg-amber-400' :
                             prompt.category === 'Mímica' ? 'bg-orange-400' :
                             prompt.category === 'Animação' ? 'bg-cyan-400' :
                             prompt.category === 'Cinema' ? 'bg-purple-400' :
                             'bg-indigo-400'
                          }`}>
                          {prompt.category}
                      </span>
                      <div className="p-2 bg-white/5 rounded-full text-slate-400">
                        {activeTab === CreationType.VIDEO || activeTab === CreationType.IMAGE_TO_VIDEO || activeTab === CreationType.FACE_TO_VIDEO ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        )}
                      </div>
                   </div>

                   <h3 className="text-lg font-bold text-white mb-2 group-hover:text-indigo-300 transition-colors">{prompt.title}</h3>
                   <p className="text-xs text-slate-400 font-medium mb-6 italic">
                      "{prompt.description}"
                   </p>

                   {/* Code/Prompt Box */}
                   <div className="bg-black/40 rounded-xl p-4 border border-white/5 mb-6 group-hover:bg-black/60 transition-colors flex-1">
                      <p className="text-xs text-slate-300 leading-relaxed font-mono line-clamp-4 group-hover:line-clamp-none transition-all">
                        {prompt.text}
                      </p>
                   </div>
                   
                   {/* Action Buttons - Only COPY */}
                   <div className="mt-auto">
                     <button 
                       onClick={() => handleCopy(prompt.text)}
                       className="w-full py-3 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-white/5 hover:border-white/20 active:scale-95 flex items-center justify-center gap-2"
                     >
                       <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                       <span>Copiar</span>
                     </button>
                   </div>

                </div>
             ))
         )}
      </div>

    </div>
  );
};

export default PromptLibrary;
