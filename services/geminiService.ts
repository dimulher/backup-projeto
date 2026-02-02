
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { CreationType, AspectRatio, Quality, VideoDuration, VideoResolution, ExtraReference, ReferenceRole, CarouselSlide, ImageFormat } from "../types";

// --- INDEXED DB STORAGE UTILS ---
// Used to store large reference files (up to 10MB) to avoid LocalStorage quotas

const DB_NAME = 'CreativeFlowDB';
const STORE_NAME = 'files';
const ASSETS_STORE_NAME = 'assets'; // New store for generated assets
const DB_VERSION = 2; // Incremented version

class LocalFileStorage {
  private dbPromise: Promise<IDBDatabase>;

  constructor() {
    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error("IndexedDB not supported"));
        return;
      }
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(ASSETS_STORE_NAME)) {
          db.createObjectStore(ASSETS_STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  }

  // --- GENERIC ASSET MANAGEMENT (Images/Videos) ---

  async saveAsset(data: Blob | string, existingId?: string): Promise<string> {
     const db = await this.dbPromise;
     const id = existingId || `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
     
     let blob: Blob;
     if (typeof data === 'string') {
        if (data.startsWith('data:')) {
           // Convert Base64 to Blob
           const arr = data.split(',');
           const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
           const bstr = atob(arr[1]);
           let n = bstr.length;
           const u8arr = new Uint8Array(n);
           while(n--){
               u8arr[n] = bstr.charCodeAt(n);
           }
           blob = new Blob([u8arr], { type: mime });
        } else {
           throw new Error("Invalid data format for asset save");
        }
     } else {
        blob = data;
     }

     return new Promise((resolve, reject) => {
        const tx = db.transaction(ASSETS_STORE_NAME, 'readwrite');
        const store = tx.objectStore(ASSETS_STORE_NAME);
        const request = store.put({ id, data: blob, type: blob.type, timestamp: Date.now() });
        
        request.onsuccess = () => resolve(id);
        request.onerror = () => reject(request.error);
     });
  }

  async getAssetUrl(id: string): Promise<string | null> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
        const tx = db.transaction(ASSETS_STORE_NAME, 'readonly');
        const store = tx.objectStore(ASSETS_STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => {
           if (request.result) {
              const blob = request.result.data;
              const url = URL.createObjectURL(blob);
              resolve(url);
           } else {
              resolve(null);
           }
        };
        request.onerror = () => reject(request.error);
    });
  }

  // --- ORIGINAL FILE METHODS (Ref Input) ---

  async saveFile(id: string, file: File | Blob): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put({ id, data: file, type: file.type, timestamp: Date.now() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getFile(id: string): Promise<{ data: Blob, type: string } | null> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result ? { data: request.result.data, type: request.result.type } : null);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteFile(id: string): Promise<void> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const fileStorage = new LocalFileStorage();

// --- API HELPERS ---

const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("A requisição expirou (timeout). Verifique sua conexão.")), ms)
    ),
  ]);
};

// Enhanced Retry Logic for 503/Overloaded
const withRetry = async <T>(
  fn: () => Promise<T>, 
  retries = 3, 
  onRetry?: (attempt: number) => void
): Promise<T> => {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      const msg = error?.message || JSON.stringify(error);
      // Check for transient errors (503 Service Unavailable, 429 Quota/Rate Limit, Overloaded)
      const isRetryable = msg.includes("503") || msg.includes("Overloaded") || msg.includes("capacity") || msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED");
      
      if (attempt < retries && isRetryable) {
        attempt++;
        // Exponential backoff: 2s, 5s, 10s
        const backoff = attempt === 1 ? 2000 : attempt === 2 ? 5000 : 10000;
        console.warn(`[Gemini Service] Retryable error detected (${attempt}/${retries}). Waiting ${backoff}ms. Error: ${msg}`);
        
        if (onRetry) {
            onRetry(attempt);
        }
        
        await sleep(backoff);
        continue;
      }
      throw error;
    }
  }
};

const handleApiError = (error: any): never => {
  console.error("[Gemini Service Error]", error);
  const msg = error?.message || JSON.stringify(error);

  if (msg.includes("429") || msg.includes("quota")) throw new Error("Limite de cota da API excedido (429).");
  if (msg.includes("503") || msg.includes("Overloaded") || msg.includes("capacity")) throw new Error("IA indisponível agora (503). Tente novamente em instantes.");
  if (msg.includes("SAFETY")) throw new Error("Conteúdo bloqueado pelos filtros de segurança.");
  if (msg.includes("API_KEY")) throw new Error("Chave de API inválida.");
  
  throw new Error(error.message || "Erro desconhecido na geração.");
};

// Helper to convert Blob to Base64 for API
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g. "data:image/png;base64,")
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const enhancePrompt = async (prompt: string): Promise<string> => {
  const ai = getAIClient();
  try {
    const response = await withRetry(() => withTimeout<GenerateContentResponse>(
      ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Como diretor criativo, expanda este prompt em uma descrição visual detalhada (iluminação, textura, ângulo) para IA. Responda apenas com o prompt em português. Prompt: "${prompt}"`,
        config: { thinkingConfig: { thinkingBudget: 2000 } }
      }),
      15000
    ));
    return response.text || prompt;
  } catch (error) {
    console.warn("Enhance prompt failed:", error);
    return prompt;
  }
};

// --- SYSTEM INSTRUCTIONS ---

const AVATAR_SYSTEM_PROMPT = `[MODELO: TEXTO PARA AVATAR]
OBJETIVO: Gerar UMA ÚNICA IMAGEM estática de alta fidelidade (Avatar).
PROIBIDO: Não gerar vídeos, gifs ou sequências.

DIRETRIZES DE ESTILO:
1. FOTORREALISMO: O avatar deve ter textura de pele realista, poros visíveis, iluminação de estúdio e profundidade de campo.
2. ENQUADRAMENTO: Plano médio ou close-up (Busto), focado no rosto e ombros.
3. IDENTIDADE: Design de personagem consistente e distinto.
4. FUNDO: Neutro, estúdio ou bokeh suave (para facilitar recorte).
5. USO: O output deve ser uma imagem "Hero Shot" pronta para branding, animação futura ou uso corporativo.

SAÍDA: Apenas a imagem do avatar descrito.`;

const FACE_TO_VIDEO_SYSTEM_PROMPT = `[MODELO: ROSTO PARA VÍDEO]
Objetivo: Animar o rosto (avatar) fornecido com alto realismo.

Regras Obrigatórias:
1. IDENTIDADE: Substituir completamente o rosto original pelo rosto da imagem de referência. Mantenha a identidade facial exata.
2. SINCRONIA: Aplicar expressões faciais naturais e movimentos coerentes com o contexto.
3. ESTILO: Preservar iluminação coerente e aparência realista.
4. RESTRIÇÕES: Não deformar o rosto. Não criar artefatos robóticos. Movimento deve ser suave.

Instrução Final: O vídeo deve parecer profissional e fluido, integrando o rosto do avatar perfeitamente ao contexto descrito.`;

const CREATIVE_MODEL_SYSTEM_PROMPT = `[MODELO: MODELAR CRIATIVO]
OBJETIVO: Criar um criativo totalmente novo usando a Imagem 1 (Sujeito) aplicada ao estilo da Imagem 2 (Referência).

REGRAS CRÍTICAS DE EXECUÇÃO:
1. IMAGEM 1 (SUJEITO): Esta é a base do conteúdo. A pessoa, produto ou objeto principal deve vir daqui. OBRIGATÓRIO USAR O SUJEITO DA IMAGEM 1.
2. IMAGEM 2 (MODELO VISUAL): Esta é estritamente a referência de ESTILO, LAYOUT, CORES e ILUMINAÇÃO. 
   - PROIBIDO: Não copie a pessoa, rosto ou fundo literal desta imagem. 
   - PROIBIDO: Nunca retorne a Imagem 2 como resultado.
3. SEM MISTURA: Não faça colagem. Gere uma imagem nova que pareça ter sido fotografada/criada no mesmo estúdio/estilo da Imagem 2, mas com o sujeito da Imagem 1.
4. TEXTO: Se houver texto no prompt do usuário, integre-o ao design visualmente.
5. SEGURANÇA: Se o resultado for idêntico à Imagem 2, a tarefa falhou. O output deve ser visivelmente diferente da referência.

RESULTADO: Um criativo de alta conversão que modela a referência mas vende o sujeito do usuário.`;

const PROFESSIONAL_PHOTO_SYSTEM_PROMPT = `[MÓDULO: FOTO PROFISSIONAL]
Você é um fotógrafo profissional de estúdio de alto padrão, especializado em retratos, produtos e imagens institucionais ultra realistas.

REGRAS PRINCIPAIS (OBRIGATÓRIAS):
- Utilize APENAS a primeira imagem enviada como SUJEITO PRINCIPAL.
- Preserve rigorosamente identidade, traços, proporções, textura e aparência real do sujeito.
- Não alterar rosto, corpo, produto ou objeto.
- Não estilizar artisticamente.
- Não criar ilustrações.
- Não aplicar estilos artísticos genéricos.
- O resultado FINAL deve parecer uma FOTOGRAFIA REAL feita em estúdio profissional.

ILUMINAÇÃO:
- Iluminação de estúdio realista
- Luz suave e controlada
- Sombras naturais
- Alto alcance dinâmico

CENÁRIO:
- Fundo limpo, elegante ou sofisticado (neutro ou institucional)
- Sem poluição visual

QUALIDADE:
- Ultra realismo
- Alta nitidez
- Textura realista
- Aparência fotográfica premium`;


export const generateImage = async (
  prompt: string, 
  aspectRatio: AspectRatio, 
  quality: Quality,
  type: CreationType = CreationType.IMAGE, 
  refMain?: string,
  refStyle?: string,
  extraRefs?: ExtraReference[],
  format?: ImageFormat,
  refReference?: string, // New 3rd slot
  refReferenceRole?: ReferenceRole, // New Role for 3rd slot
  onRetry?: (attempt: number) => void // Callback for retry status
): Promise<string> => {
  console.log(`[GenerateImage] Start. Type: ${type}, Refs: Main=${!!refMain}, Style=${!!refStyle}, Reference=${!!refReference} (${refReferenceRole}), Extras=${extraRefs?.length}, Format: ${format}`);

  const ai = getAIClient();
  const model = 'gemini-3-pro-image-preview'; 

  let finalPrompt = prompt || "Geração artística de alta qualidade";
  const parts: any[] = [];
  let partIndex = 1;

  // --- 0. Special Handling for Specific Modes ---
  if (type === CreationType.AVATAR) {
     finalPrompt = `${AVATAR_SYSTEM_PROMPT}\n\n[DESCRIÇÃO DO AVATAR]: ${prompt}`;
  } else if (type === CreationType.CREATIVE_MODEL) {
     finalPrompt = `${CREATIVE_MODEL_SYSTEM_PROMPT}\n\n[NOVA MANCHETE/TEXTO]: ${prompt || 'Sem texto adicional, focar no visual.'}`;
  } else if (type === CreationType.PROFESSIONAL_PHOTO) {
     finalPrompt = `${PROFESSIONAL_PHOTO_SYSTEM_PROMPT}\n\n[CONTEXTO/PEDIDO DO USUÁRIO]: ${prompt}`;
  }

  // --- 1. Construct Logic for Identity/Style (Primary Slots) ---
  // Standard logic only applies if NOT using custom system prompts like PROFESSIONAL_PHOTO or CREATIVE_MODEL
  if (type !== CreationType.CREATIVE_MODEL && type !== CreationType.PROFESSIONAL_PHOTO) {
      // Default logic for Standard Generation
      if (refMain && refStyle) {
        finalPrompt = `[SYSTEM: IDENTITY REPLACEMENT MODE]
1. Image 1 is the SUBJECT IDENTITY (Person).
2. Image 2 is the STYLE/COMPOSITION REFERENCE.
3. TASK: Completely REMOVE the person from Image 2. INSERT the person from Image 1 into that scene.
4. CONSTRAINT: Maintain Image 2's lighting, angle, and style exactly. Do NOT mix faces. Use Image 1's face/body structure.
5. User Context: ${prompt}`;
      } else if (refMain) {
        finalPrompt = `[SYSTEM: IMAGE REFERENCE MODE]
Use Image 1 as the primary visual reference for the subject.
User Context: ${prompt}`;
      } else if (refStyle) {
        finalPrompt = `[SYSTEM: STYLE TRANSFER MODE]
Use Image 1 as the primary style/composition reference.
User Context: ${prompt}`;
      }
  }

  // --- 2. Append Primary Images ---
  if (refMain) {
     let cleanData = refMain;
     if (refMain.startsWith('blob:')) {
         const resp = await fetch(refMain);
         const blob = await resp.blob();
         cleanData = await blobToBase64(blob);
     } else if (refMain.startsWith('data:')) {
         cleanData = refMain.split(',')[1];
     }
     parts.push({ inlineData: { data: cleanData, mimeType: 'image/png' } });
     partIndex++;
  }
  
  // Style slot is ignored for PROFESSIONAL_PHOTO as per rules
  if (refStyle && type !== CreationType.PROFESSIONAL_PHOTO) {
     let cleanData = refStyle;
     if (refStyle.startsWith('blob:')) {
         const resp = await fetch(refStyle);
         const blob = await resp.blob();
         cleanData = await blobToBase64(blob);
     } else if (refStyle.startsWith('data:')) {
         cleanData = refStyle.split(',')[1];
     }
     parts.push({ inlineData: { data: cleanData, mimeType: 'image/png' } });
     partIndex++;
  }

  // --- 3. Append Reference Image (Slot 3) ---
  if (refReference && type !== CreationType.PROFESSIONAL_PHOTO) {
     let cleanData = refReference;
     if (refReference.startsWith('blob:')) {
         const resp = await fetch(refReference);
         const blob = await resp.blob();
         cleanData = await blobToBase64(blob);
     } else if (refReference.startsWith('data:')) {
         cleanData = refReference.split(',')[1];
     }
     
     // Construct prompt based on specific Role
     const role = refReferenceRole || ReferenceRole.FREE;
     let roleInstruction = "";
     
     if (role === ReferenceRole.PALETTE) {
         roleInstruction = "Use Image ${partIndex} strictly as the COLOR PALETTE source. Extract the colors and apply them to the final image. Do not copy the subject.";
     } else if (role === ReferenceRole.STYLE) {
         roleInstruction = "Use Image ${partIndex} as the VISUAL STYLE reference. Mimic the lighting, texture, and artistic rendering style.";
     } else if (role === ReferenceRole.BACKGROUND) {
         roleInstruction = "Use Image ${partIndex} as the BACKGROUND reference. Place the subject into this environment.";
     } else if (role === ReferenceRole.COMPOSITION) {
         roleInstruction = "Use Image ${partIndex} as the STRUCTURE/LAYOUT/COMPOSITION reference. Match the camera angle and object placement.";
     } else {
         roleInstruction = "Use Image ${partIndex} as a general creative reference/model for the output.";
     }

     finalPrompt += `\n\n[VISUAL REFERENCE: ${role}]\n${roleInstruction.replace('${partIndex}', partIndex.toString())}`;
     
     parts.push({ inlineData: { data: cleanData, mimeType: 'image/png' } });
     partIndex++;
  }

  // --- 4. Process Advanced References (IndexedDB) ---
  if (extraRefs && extraRefs.length > 0) {
    finalPrompt += `\n\n[ADDITIONAL REFERENCES]`;
    
    for (const ref of extraRefs) {
      try {
        const fileData = await fileStorage.getFile(ref.fileId);
        let base64Data = "";
        
        if (fileData) {
          base64Data = await blobToBase64(fileData.data);
        } else {
          // Fallback to preview if IDB fails/missing
          console.warn(`[Generate] File ${ref.fileId} not found in DB, using preview.`);
          base64Data = ref.preview.split(',')[1];
        }

        // Apply Role logic for extra refs as well
        const role = ref.role;
        let roleInstruction = "";
        
        if (role === ReferenceRole.PALETTE) {
             roleInstruction = "strictly as the COLOR PALETTE source.";
        } else if (role === ReferenceRole.STYLE) {
             roleInstruction = "as the VISUAL STYLE reference.";
        } else if (role === ReferenceRole.BACKGROUND) {
             roleInstruction = "as the BACKGROUND reference.";
        } else if (role === ReferenceRole.COMPOSITION) {
             roleInstruction = "as the STRUCTURE/LAYOUT/COMPOSITION reference.";
        } else if (role === ReferenceRole.LOGO) {
             roleInstruction = "Apply this logo overlay cleanly.";
        } else if (role === ReferenceRole.PRODUCT) {
             roleInstruction = "Keep this object exact and unmodified.";
        } else {
             roleInstruction = "as a general reference.";
        }

        // Add instructions for this specific reference
        finalPrompt += `\n- Image ${partIndex} [Role: ${role}]: Use this image ${roleInstruction} ${ref.note || ''}`;

        // Add the image part
        parts.push({ inlineData: { data: base64Data, mimeType: 'image/png' } }); // Sending as PNG usually safe for Gemini
        partIndex++;

      } catch (err) {
        console.error(`Failed to load extra ref ${ref.id}`, err);
      }
    }
  }

  // Add the text prompt at the very beginning
  parts.unshift({ text: finalPrompt });

  // Handle Auto or custom values
  let ratioParam = aspectRatio;
  if (aspectRatio === AspectRatio.AUTO) ratioParam = AspectRatio.SQUARE; // Fallback for API if 'Auto' is selected

  const imageConfig: any = {
    aspectRatio: ratioParam,
    imageSize: quality
  };

  try {
    const response = await withRetry(
      () => withTimeout<GenerateContentResponse>(
        ai.models.generateContent({
          model,
          contents: { parts },
          config: { imageConfig }
        }),
        90000 // 90s timeout for complex multi-image tasks
      ),
      3, // Retries
      onRetry
    );

    if (response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];
      
      // Check for safety finish reason
      if (candidate.finishReason === 'SAFETY') {
         throw new Error("A geração foi bloqueada pelos filtros de segurança da IA. (Tente um prompt menos específico sobre pessoas reais)");
      }

      if (candidate.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData?.data) {
            return `data:image/png;base64,${part.inlineData.data}`;
          }
        }
        
        // If we are here, we have parts but no image. Check for text explanation.
        const textPart = candidate.content.parts.find((p: any) => p.text);
        if (textPart && textPart.text) {
            console.warn("Model returned text instead of image:", textPart.text);
            // Return the text as an error to inform the user
            throw new Error(`A IA recusou o pedido: "${textPart.text.slice(0, 150)}..."`);
        }
      }
    }
    throw new Error("A IA processou o pedido mas não retornou dados de imagem.");

  } catch (error: any) {
    handleApiError(error);
    return "";
  }
};

export const generateVideo = async (
  prompt: string,
  aspectRatio: AspectRatio,
  duration: VideoDuration,
  resolution: VideoResolution,
  refMain?: string,
  extraRefs?: ExtraReference[],
  type?: CreationType,
  refVideoId?: string,
  // New Params for Advanced Mimic
  refMainId?: string,
  refStyleId?: string,
  refStyle?: string,
  onRetry?: (attempt: number) => void // Callback for retry status
): Promise<string> => {
  const ai = getAIClient();
  const model = 'veo-3.1-fast-generate-preview';
  
  // --- VALIDATION FOR DURATION ---
  const isMimic = type === CreationType.MIMIC;
  const allowedDurations = isMimic ? ['5','10','15','20'] : ['5','10'];
  if (!allowedDurations.includes(duration)) {
      throw new Error("Duração inválida para este modelo. Selecione uma duração disponível.");
  }

  // --- VALIDATION FOR RESOLUTION ---
  const allowedResolutions = ['720p', '1080p'];
  if (!allowedResolutions.includes(resolution)) {
      throw new Error("Resolução inválida. Selecione 720p ou 1080p.");
  }

  let detailedPrompt = `${prompt} (Target Duration: ${duration} seconds)`;
  
  // --- SPECIAL HANDLING FOR FACE_TO_VIDEO ---
  if (type === CreationType.FACE_TO_VIDEO) {
      detailedPrompt = `${FACE_TO_VIDEO_SYSTEM_PROMPT}\n\n[CONTEXTO DO VÍDEO]: ${prompt}`;
  }

  if (extraRefs && extraRefs.length > 0) {
    detailedPrompt += `\n[Context from additional refs: ${extraRefs.map(r => r.role).join(', ')}]`;
  }

  // For video, we only support standard 16:9 or 9:16 regardless of input enum if mapped incorrectly, 
  // but usually UI restricts this. We default to 16:9 if something exotic comes in.
  const isPortrait = aspectRatio === AspectRatio.PORTRAIT;
  const finalAspectRatio = isPortrait ? '9:16' : '16:9';

  const generationPayload: any = {
    model,
    prompt: detailedPrompt,
    config: {
        numberOfVideos: 1,
        resolution: resolution,
        aspectRatio: finalAspectRatio
    }
  };

  // --- HANDLE IMAGE/VIDEO INPUTS (Convert Blob URLs to Base64 if needed) ---
  const resolveData = async (input: string | undefined): Promise<string | undefined> => {
     if (!input) return undefined;
     if (input.startsWith('blob:')) {
         const r = await fetch(input);
         const b = await r.blob();
         return blobToBase64(b);
     }
     if (input.startsWith('data:')) return input.split(',')[1];
     return undefined; // Should not happen for valid inputs
  };

  // --- MIMIC MOTION MODE ---
  if (type === CreationType.MIMIC) {
     if (refStyle) {
        const styleData = await resolveData(refStyle);
        if (styleData) {
            generationPayload.image = {
                imageBytes: styleData,
                mimeType: 'image/png' 
            };
        }
     } 
     
     if (refMainId) {
        generationPayload.prompt = `[SYSTEM: MOTION TRANSFER]
1. VISUAL SUBJECT: Use the provided image (Avatar) as the character appearance.
2. MOTION SOURCE: (User provided a reference video for motion).
3. TASK: Animate the visual subject to match the movements, expression, and pacing of the reference motion exactly.
4. CONTEXT: ${prompt}`;
     }
  } 
  // --- FACE TO VIDEO MODE ---
  else if (type === CreationType.FACE_TO_VIDEO) {
     if (refMain) {
       const mainData = await resolveData(refMain);
       if (mainData) {
           generationPayload.image = {
                imageBytes: mainData,
                mimeType: 'image/png'
           };
       }
     }
  }
  // --- IMAGE TO VIDEO MODE ---
  else if (type === CreationType.IMAGE_TO_VIDEO) {
     if (refMain) {
       const mainData = await resolveData(refMain);
       if (mainData) {
            generationPayload.image = {
                imageBytes: mainData,
                mimeType: 'image/png'
            };
       }
     }
  }
  // --- STANDARD TEXT TO VIDEO MODE (with optional ref if legacy/extra) ---
  else if (refMain) {
    const mainData = await resolveData(refMain);
    if (mainData) {
        generationPayload.image = {
            imageBytes: mainData,
            mimeType: 'image/png'
        };
    }
  }

  try {
    let operation: any = await withRetry(
        () => ai.models.generateVideos(generationPayload),
        3, 
        onRetry
    );
    
    let attempts = 0;
    while (!operation.done && attempts < 60) {
      await sleep(10000);
      attempts++;
      operation = await withRetry(() => getAIClient().operations.getVideosOperation({ operation }));
    }

    if (!operation.done) throw new Error("Timeout na geração de vídeo.");

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("Link de vídeo não encontrado.");

    const response = await withRetry(() => fetch(`${downloadLink}&key=${process.env.API_KEY}`));
    const arrayBuffer = await response.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: 'video/mp4' });
    return URL.createObjectURL(blob);
  } catch (error: any) {
    handleApiError(error);
    return "";
  }
};

export const generateCarouselScript = async (params: {
  topic: string;
  goal: string;
  audience: string;
  tone: string;
  count: number;
  cta?: string;
  platform?: string;
  colors?: string; // New: Manual Colors
}): Promise<CarouselSlide[]> => {
  const ai = getAIClient();
  const model = 'gemini-3-flash-preview';

  // --- DEFAULT PREMIUM PALETTE ---
  const DEFAULT_PREMIUM_PALETTE = `
  - Dourado claro: #E2C28A
  - Azul profundo: #0A1B3D
  - Cinza claro: #E5E6E6
  - Cinza médio: #6F6866
  - Preto azulado: #38302E`;

  const paletteInstruction = params.colors 
      ? `PALETA OBRIGATÓRIA DO USUÁRIO: ${params.colors}`
      : `PALETA PREMIUM (PADRÃO): ${DEFAULT_PREMIUM_PALETTE} (Use estas cores na descrição visual se nenhuma outra for solicitada).`;

  const prompt = `
  ATUE COMO: Diretor de Arte e Copywriter Premium especializado em carrosséis editoriais de autoridade.
  
  CONTEXTO:
  - Tema: ${params.topic}
  - Objetivo: ${params.goal}
  - Público: ${params.audience}
  - Tom: ${params.tone}
  ${params.cta ? `- CTA: ${params.cta}` : ''}
  - Plataforma: ${params.platform || 'Instagram'}
  
  ESTRUTURA NARRATIVA OBRIGATÓRIA (Adaptar para ${params.count} slides):
  1. ABERTURA (IMPACTO): Headline forte e curta (máx 6 palavras). Apresente o tema como verdade ou ruptura. Visual: Elemento central imponente.
  2. O PROBLEMA: Mostre o erro da maioria. Visual: Algo incompleto, rachado, sombra.
  3. CONSEQUÊNCIA: Impacto negativo. Tom sério. Visual: Muralha frágil, caminho perdido, ruína.
  4. A VIRADA (VISÃO): Introduza o conceito de construção correta. Autoridade. Visual: Colunas alinhadas, horizonte, luz.
  5. O PRINCÍPIO-CHAVE: Conceito central estratégico. Visual: Portão, livro antigo, símbolo de poder.
  6. FECHAMENTO (LEGADO/CTA): Mensagem atemporal. Visual: Castelo completo, estrutura sólida, luz dourada.
  
  REGRAS DE COMPOSIÇÃO VISUAL (CRÍTICAS para o campo 'visualHook'):
  - Estilo Editorial Premium, Iluminação Cinematográfica.
  - Elementos arquitetônicos clássicos (ou metáforas visuais equivalentes ao nicho: ex: Prédios para Business, Montanhas para Superação).
  - Fundo limpo e elegante, Alto contraste.
  - NÃO peça grids, colagens ou muitos elementos. UM único elemento focal por slide.
  - ${paletteInstruction}

  SAÍDA JSON (Array de objetos, sem markdown):
  [{ "slide": 1, "title": "HEADLINE CURTA", "text": "Texto de apoio curto (2-4 linhas)", "visualHook": "Descrição detalhada da imagem para IA geradora (prompt visual)" }]
  `;

  try {
    const response = await withRetry(() => withTimeout<GenerateContentResponse>(
      ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                slide: { type: Type.INTEGER },
                title: { type: Type.STRING },
                text: { type: Type.STRING },
                visualHook: { type: Type.STRING }
              },
              required: ["slide", "title", "text", "visualHook"]
            }
          }
        }
      }),
      20000
    ));

    const text = response.text || "[]";
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error("JSON Parse Error", e);
      // Fallback manual cleanup if model fails strict JSON
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    }
  } catch (error: any) {
    handleApiError(error);
    return [];
  }
};