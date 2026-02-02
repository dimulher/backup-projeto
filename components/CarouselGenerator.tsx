
import React, { useState, useRef } from 'react';
import { generateCarouselScript, generateImage } from '../services/geminiService';
import { CarouselSlide, CreationType, AspectRatio, Quality } from '../types';
import { CREDIT_COSTS } from '../constants';

interface CarouselGeneratorProps {
  credits: number;
  deductCredits: (amount: number) => boolean;
  onSaved: (type: CreationType, url: string) => void;
}

const CarouselGenerator: React.FC<CarouselGeneratorProps> = ({ credits, deductCredits, onSaved }) => {
  // Form State
  const [topic, setTopic] = useState('');
  const [goal, setGoal] = useState('Educar');
  const [audience, setAudience] = useState('');
  const [tone, setTone] = useState('Profissional');
  const [count, setCount] = useState(5);
  const [cta, setCta] = useState('');
  const [platform, setPlatform] = useState('Instagram');
  
  // New Identity Fields
  const [manualColors, setManualColors] = useState('');
  const [refImage, setRefImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // UI State
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [generatedImages, setGeneratedImages] = useState<{slide: number, url: string, prompt: string}[]>([]);
  const [error, setError] = useState<string | null>(null);

  const GOAL_OPTIONS = ['Educar', 'Autoridade', 'Vendas/Conversão', 'Engajamento', 'Viralização'];
  const TONE_OPTIONS = ['Profissional', 'Descontraído', 'Direto', 'Inspirador', 'Técnico', 'Polêmico'];
  const PLATFORM_OPTIONS = ['Instagram', 'LinkedIn', 'Twitter/X Thread', 'TikTok (Roteiro)'];

  const IMAGE_COST = (CREDIT_COSTS.IMAGE as any)['1K']; // Default 1K cost for carousel images
  const TOTAL_ESTIMATED_COST = CREDIT_COSTS.CAROUSEL + (count * IMAGE_COST);

  const handleRefImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Basic validation
      if (file.size > 5 * 1024 * 1024) {
         alert("Imagem muito grande. Máximo 5MB.");
         return;
      }
      
      const reader = new FileReader();
      reader.onload = (ev) => {
         if (ev.target?.result) {
            setRefImage(ev.target.result as string);
         }
      };
      reader.readAsDataURL(file);
    }
    // Reset input
    e.target.value = '';
  };

  const handleGenerate = async () => {
    if (!topic || !audience) {
      setError("Por favor, preencha o Tema e o Público-alvo.");
      return;
    }

    if (credits < TOTAL_ESTIMATED_COST) {
      setError(`Créditos insuficientes. Necessário: ${TOTAL_ESTIMATED_COST} CR`);
      return;
    }

    setIsGenerating(true);
    setLoadingStep('Criando roteiro e conceito visual...');
    setError(null);
    setGeneratedImages([]);

    try {
      // 1. Generate Script / Visual Hooks
      const slides = await generateCarouselScript({
        topic,
        goal,
        audience,
        tone,
        count,
        cta,
        platform,
        colors: manualColors // Pass manual colors to script generator for prompt inclusion
      });

      if (!slides || slides.length === 0) throw new Error("Falha ao gerar roteiro.");

      // 2. Validate Credits before heavy lifting
      if (!deductCredits(TOTAL_ESTIMATED_COST)) {
         throw new Error("Erro ao processar créditos.");
      }

      // 3. Generate Images for each slide
      const images: {slide: number, url: string, prompt: string}[] = [];
      
      // LOGIC: Maintain consistency. 
      // If user provided a refImage, use it for all.
      // If NOT, use the generated image of Slide 1 as reference for Slide 2, 3, etc.
      let dynamicRefStyle = refImage; 

      for (let i = 0; i < slides.length; i++) {
         setLoadingStep(`Gerando slide ${i + 1} de ${slides.length}...`);
         const slide = slides[i];
         
         // Combine visual hook with title overlay instruction using structured prompt
         const imagePrompt = `
SLIDE ${i + 1} de ${slides.length}

Nicho: ${topic}
Objetivo do carrossel: ${goal}

Paleta de cores:
${manualColors || 'Automática, harmônica e profissional'}

Conteúdo do slide (usar como texto principal do criativo):
"${slide.title}"

Descrição Visual Específica:
${slide.visualHook}

Direção visual:
- Design premium, editorial, alto contraste e alta legibilidade
- Hierarquia tipográfica clara (título forte + apoio curto se necessário)
- Manter consistência com os demais slides do carrossel
`;
         
         // Use dynamicRefStyle (Slot 2 - Style)
         const imageUrl = await generateImage(
             imagePrompt,
             AspectRatio.SQUARE, // Enforce 1:1 as requested
             Quality.K1,
             CreationType.IMAGE,
             undefined, // refMain
             dynamicRefStyle || undefined // refStyle: Enforces visual identity
         );
         
         if (imageUrl) {
             images.push({
                 slide: slide.slide,
                 url: imageUrl,
                 prompt: imagePrompt
             });
             // Add to local state progressively
             setGeneratedImages(prev => [...prev, { slide: slide.slide, url: imageUrl, prompt: imagePrompt }]);

             // If we didn't have an initial reference, use the first result as the style anchor for the rest
             if (i === 0 && !dynamicRefStyle) {
                 dynamicRefStyle = imageUrl;
             }
         }
      }

      setLoadingStep('Finalizando...');

    } catch (err: any) {
      setError(err.message || "Erro ao gerar carrossel.");
      // Note: We don't refund credits here to avoid complexity.
    } finally {
      setIsGenerating(false);
      setLoadingStep('');
    }
  };

  const handleSaveToGallery = (img: {url: string, prompt: string}) => {
      onSaved(CreationType.IMAGE, img.url); 
      alert("Imagem salva na galeria!");
  };

  return (
    <div className="max-w-7xl mx-auto min-h-screen flex flex-col md:flex-row gap-8 p-4 md:p-0 animate-in fade-in zoom-in-95 duration-300">
      
      {/* Left Column: Config Form */}
      <div className="w-full md:w-1/3 space-y-6">
        <div className="glass p-8 rounded-[2rem] bg-slate-900/50 backdrop-blur-xl border border-white/10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            </div>
            <div>
                <h2 className="text-xl font-black text-white">Carrossel Visual</h2>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{TOTAL_ESTIMATED_COST} Créditos (Total)</p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tema Principal</label>
              <textarea 
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Ex: 3 Pilares da Produtividade..."
                className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-indigo-500 outline-none h-16 resize-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Público Alvo</label>
              <input 
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="Ex: Empreendedores digitais..."
                className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-indigo-500 outline-none"
              />
            </div>
            
            {/* Identity Control Section */}
            <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-4">
               <h3 className="text-xs font-black text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                   <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
                   Identidade Visual (Opcional)
               </h3>
               
               {/* Reference Image Upload */}
               <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Imagem de Referência (Estilo)</label>
                  <div 
                     onClick={() => fileInputRef.current?.click()}
                     className={`w-full h-24 border-2 border-dashed rounded-xl flex items-center justify-center cursor-pointer transition-colors overflow-hidden relative ${refImage ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-600 hover:border-indigo-400 hover:bg-white/5'}`}
                  >
                      {refImage ? (
                          <>
                             <img src={refImage} className="w-full h-full object-cover opacity-60" alt="Ref" />
                             <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-[10px] font-bold bg-black/50 px-2 py-1 rounded text-white backdrop-blur-sm">Trocar Imagem</span>
                             </div>
                          </>
                      ) : (
                          <div className="text-center">
                             <span className="text-xs text-slate-400 font-medium">Clique para enviar</span>
                          </div>
                      )}
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleRefImageUpload} />
                  </div>
                  {refImage && <button onClick={(e) => { e.stopPropagation(); setRefImage(null); }} className="text-[9px] text-red-400 mt-1 hover:underline">Remover referência</button>}
               </div>

               {/* Manual Colors */}
               <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Cores Manuais</label>
                  <input 
                    value={manualColors}
                    onChange={(e) => setManualColors(e.target.value)}
                    placeholder="Ex: Azul Marinho e Dourado (#FFD700)..."
                    className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-xs text-white focus:border-indigo-500 outline-none"
                  />
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Objetivo</label>
                  <select value={goal} onChange={(e) => setGoal(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-xs text-white outline-none cursor-pointer">
                    {GOAL_OPTIONS.map(o => <option key={o} value={o} className="bg-slate-900">{o}</option>)}
                  </select>
               </div>
               <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tom</label>
                  <select value={tone} onChange={(e) => setTone(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-xs text-white outline-none cursor-pointer">
                    {TONE_OPTIONS.map(o => <option key={o} value={o} className="bg-slate-900">{o}</option>)}
                  </select>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Plataforma</label>
                  <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-xs text-white outline-none cursor-pointer">
                    {PLATFORM_OPTIONS.map(o => <option key={o} value={o} className="bg-slate-900">{o}</option>)}
                  </select>
               </div>
               <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Slides (Até 6)</label>
                  <div className="flex items-center gap-2 bg-black/20 border border-white/10 rounded-xl p-2.5">
                     <button onClick={() => setCount(Math.max(3, count - 1))} className="p-1 hover:text-indigo-400 text-slate-400 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                     </button>
                     <span className="flex-1 text-center text-sm font-bold">{count}</span>
                     <button onClick={() => setCount(Math.min(6, count + 1))} className="p-1 hover:text-indigo-400 text-slate-400 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                     </button>
                  </div>
               </div>
            </div>

            {error && <p className="text-red-400 text-xs font-bold bg-red-500/10 p-2 rounded-lg border border-red-500/20">{error}</p>}

            <button 
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-indigo-900/40 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                  <>
                     <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                     <span>{loadingStep}</span>
                  </>
              ) : 'Gerar Carrossel'}
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Preview / Result */}
      <div className="w-full md:w-2/3">
         {generatedImages.length === 0 && !isGenerating ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-white/5 rounded-[2rem] bg-white/5 p-10">
               <div className="w-24 h-24 bg-indigo-500/10 rounded-full flex items-center justify-center mb-6 animate-pulse">
                  <svg className="w-10 h-10 text-indigo-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
               </div>
               <h3 className="text-xl font-bold text-slate-300">Carrossel Automático</h3>
               <p className="text-sm mt-2 max-w-sm text-center">Defina o tema, cores e estilo para gerar slides visuais prontos. Use uma imagem de referência para manter a identidade da marca.</p>
            </div>
         ) : (
            <div className="h-full flex flex-col">
               <div className="flex justify-between items-center mb-6 px-2">
                  <h3 className="text-2xl font-bold text-white">
                      {isGenerating ? 'Gerando Slides...' : 'Carrossel Gerado'}
                  </h3>
               </div>

               <div className="grid grid-cols-2 md:grid-cols-3 gap-4 overflow-y-auto pb-20 scrollbar-hide">
                  {generatedImages.map((img, index) => (
                     <div key={index} className="group relative bg-slate-900 border border-white/10 rounded-2xl overflow-hidden hover:border-indigo-500/50 transition-all hover:shadow-xl animate-in fade-in zoom-in-95 duration-500">
                        {/* Aspect Ratio Container (Square 1:1) */}
                        <div className="aspect-square bg-black relative">
                            <img src={img.url} className="w-full h-full object-cover" alt={`Slide ${img.slide}`} />
                            <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] font-black uppercase text-white border border-white/10">
                                Slide {img.slide}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-4">
                             <button 
                               onClick={() => handleSaveToGallery(img)}
                               className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-indigo-500 w-full"
                             >
                                Salvar
                             </button>
                             <a 
                               href={img.url} 
                               download={`slide-${img.slide}.png`}
                               className="px-4 py-2 bg-white/10 text-white rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-white/20 w-full text-center"
                             >
                                Baixar
                             </a>
                        </div>
                     </div>
                  ))}
                  
                  {/* Skeleton Loaders while generating */}
                  {isGenerating && Array.from({ length: count - generatedImages.length }).map((_, i) => (
                      <div key={`skel-${i}`} className="bg-white/5 rounded-2xl aspect-square animate-pulse border border-white/5 flex items-center justify-center">
                          <svg className="w-8 h-8 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </div>
                  ))}
               </div>
            </div>
         )}
      </div>
    </div>
  );
};

export default CarouselGenerator;
