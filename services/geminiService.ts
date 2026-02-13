
// IMPORTAÇÃO COMENTADA: Projeto não usa mais a API Google Gemini
// import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { CreationType, AspectRatio, Quality, VideoDuration, VideoResolution, ExtraReference, ReferenceRole, CarouselSlide, ImageFormat } from "../types";
import { uploadFromDataUrl } from './uploadService';
import { getCurrentUser } from './authService';
import { createGeneration, updateGenerationResult } from './generationsService';

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
        while (n--) {
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

// =================================================================
// FUNÇÕES DESABILITADAS - MIGRADAS PARA WEBHOOK N8N
// =================================================================

export const enhancePrompt = async (prompt: string): Promise<string> => {
  console.warn("enhancePrompt desabilitado - retornando prompt original");
  return prompt;
};

export const generateImage = async (...args: any[]): Promise<{ url: string, id: string | null }> => {
  console.log('🚀 [generateImage] Chamado com argumentos:', args);
  // ... (keep existing implementation until return)


  const [
    prompt,
    aspectRatio,
    quality,
    type,
    mainPreview,
    stylePreview,
    extraRefs,
    format,
    referencePreview,
    referenceRole,
    onRetryStatus,
    cost // Adicionado cost aos argumentos desestruturados
  ] = args;

  // Obter usuário autenticado
  let userId = 'anonymous';
  try {
    const user = await getCurrentUser();
    userId = user?.id || 'anonymous';
    console.log('👤 [generateImage] Usuário:', userId);
  } catch (error) {
    console.warn('⚠️ [generateImage] Não foi possível obter usuário autenticado, usando anonymous');
  }

  console.log('📤 [generateImage] Fazendo upload de imagens base64 para Supabase...');

  // LOG CRÍTICO: Verificar qual mainPreview está sendo passado
  console.log('🔍 [generateImage] mainPreview recebido:', {
    exists: !!mainPreview,
    type: mainPreview ? (mainPreview.startsWith('data:') ? 'data URL' : mainPreview.startsWith('blob:') ? 'blob URL' : 'unknown') : 'null',
    preview: mainPreview ? mainPreview.substring(0, 100) + '...' : 'null',
    length: mainPreview ? mainPreview.length : 0
  });

  // Converter base64 para URLs públicas do Supabase
  let mainPublicUrl = mainPreview;
  let stylePublicUrl = stylePreview;
  let referencePublicUrl = referencePreview;

  if (mainPreview && (mainPreview.startsWith('data:') || mainPreview.startsWith('blob:'))) {
    try {
      const ext = getFileExtensionFromDataUrl(mainPreview, 'jpg'); // DEFAULT JPG PARA IMAGENS
      console.log(`📤 Uploading mainPreview como .${ext}...`);

      const uploadedUrl = await uploadFromDataUrl(mainPreview, userId, `main_${Date.now()}.${ext}`);
      if (uploadedUrl) {
        mainPublicUrl = uploadedUrl;
        console.log('✅ mainPreview URL:', mainPublicUrl);
      } else {
        console.warn('⚠️ Upload retornou null, usando base64 original');
        mainPublicUrl = mainPreview; // Fallback para base64
      }
    } catch (error) {
      console.error('❌ Erro ao fazer upload de mainPreview:', error);
      mainPublicUrl = mainPreview; // Fallback para base64
    }
  }

  if (stylePreview && (stylePreview.startsWith('data:') || stylePreview.startsWith('blob:'))) {
    try {
      const ext = getFileExtensionFromDataUrl(stylePreview, 'jpg'); // DEFAULT JPG
      console.log(`📤 Uploading stylePreview como .${ext}...`);

      const uploadedUrl = await uploadFromDataUrl(stylePreview, userId, `style_${Date.now()}.${ext}`);
      if (uploadedUrl) {
        stylePublicUrl = uploadedUrl;
        console.log('✅ stylePreview URL:', stylePublicUrl);
      } else {
        console.warn('⚠️ Upload retornou null, usando base64 original');
        stylePublicUrl = stylePreview; // Fallback para base64
      }
    } catch (error) {
      console.error('❌ Erro ao fazer upload de stylePreview:', error);
      stylePublicUrl = stylePreview; // Fallback para base64
    }
  }

  if (referencePreview && (referencePreview.startsWith('data:') || referencePreview.startsWith('blob:'))) {
    try {
      const ext = getFileExtensionFromDataUrl(referencePreview, 'jpg'); // DEFAULT JPG
      console.log(`📤 Uploading referencePreview como .${ext}...`);

      const uploadedUrl = await uploadFromDataUrl(referencePreview, userId, `reference_${Date.now()}.${ext}`);
      if (uploadedUrl) {
        referencePublicUrl = uploadedUrl;
        console.log('✅ referencePreview URL:', referencePublicUrl);
      } else {
        console.warn('⚠️ Upload retornou null, usando base64 original');
        referencePublicUrl = referencePreview; // Fallback para base64
      }
    } catch (error) {
      console.error('❌ Erro ao fazer upload de referencePreview:', error);
      referencePublicUrl = referencePreview; // Fallback para base64
    }
  }

  // Upload de referências extras
  const uploadedExtraRefs = await Promise.all(
    (extraRefs || []).map(async (ref: any) => {
      if (ref.preview && (ref.preview.startsWith('data:') || ref.preview.startsWith('blob:'))) {
        try {
          const ext = getFileExtensionFromDataUrl(ref.preview, 'jpg'); // DEFAULT JPG
          const publicUrl = await uploadFromDataUrl(ref.preview, userId, `extra_${Date.now()}.${ext}`);
          return { ...ref, preview: publicUrl || ref.preview };
        } catch (error) {
          console.error('❌ Erro ao fazer upload de extraRef:', error);
          return ref; // Fallback para base64
        }
      }
      return ref;
    })
  );

  const payload = {
    type,
    prompt,
    aspectRatio,
    quality,
    format,
    mainPreview: mainPublicUrl,
    stylePreview: stylePublicUrl,
    referencePreview: referencePublicUrl,
    referenceRole,
    extraRefs: uploadedExtraRefs,
    userId, // Adicionado userId
    cost: cost || 0, // Adicionado cost com fallback
    timestamp: new Date().toISOString()
  };

  // Criar registro da geração no Supabase (Status: Processando)
  let generationId: string | null = null;
  if (userId !== 'anonymous') {
    generationId = await createGeneration(userId, type, prompt, cost || 0, {
      aspectRatio,
      quality,
      format,
      extraRefs, // Salva referências extras (JSON)
      referenceRole
    });
  }

  console.log('🌐 [generateImage] Enviando URLs públicas para webhook n8n:', payload);


  try {
    const response = await fetch('https://n8n.prosperamentor.com.br/webhook/7725c65b-f234-411a-b5b0-d90150846bbb', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    console.log('📥 [generateImage] Resposta do webhook:', response.status, response.statusText);

    if (response.status === 503) {
      console.warn('⚠️ [generateImage] Webhook retornou 503 (Serviço Indisponível/Sobrecarregado).');
      if (onRetryStatus) onRetryStatus(503); // Notificar UI sobre retry se necessário
      // Opcional: Implementar retry automático aqui se desejado, mas o loop na UI já faz isso
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [generateImage] Erro:', errorText);
      throw new Error(`Erro no webhook: ${response.status} - ${response.statusText}`);
    }

    // Verificar se há conteúdo na resposta
    const responseText = await response.text();
    if (!responseText || responseText.trim() === '') {
      console.error('❌ [generateImage] Webhook retornou resposta vazia');
      // throw new Error('Webhook não retornou dados. Verifique o n8n.');
      // Se for apenas fire-and-forget, ok. Mas aqui esperamos a imagem.
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      // Se não for JSON, pode ser a URL direta string?
      if (responseText.startsWith('http')) {
        result = { url: responseText };
      } else {
        throw new Error("Resposta inválida do webhook (não é JSON nem URL).");
      }
    }

    console.log('✅ [generateImage] Resultado do webhook:', result);

    // O webhook do n8n deve retornar { "url": "..." } ou { "output": "..." }
    // Ajuste conforme seu output real do n8n
    const finalUrl = result.url || result.output || result.image_url || 'https://placeholder.com/image.png';
    console.log('🖼️ [generateImage] URL final extraída:', finalUrl);

    // Atualizar registro no Supabase com a URL final
    if (generationId && finalUrl) {
      console.log(`🔄 [generateImage] Chamando updateGenerationResult para generationId: ${generationId}`);
      await updateGenerationResult(generationId, finalUrl);
    } else {
      console.warn('⚠️ [generateImage] Não foi possível atualizar:', { generationId, finalUrl });
    }

    return { url: finalUrl, id: generationId };
  } catch (error) {
    console.error('❌ [generateImage] Erro ao chamar webhook:', error);
    throw error;
  }
};

// Helper: Detectar extensão correta baseada no MIME type da string data/blob
const getFileExtensionFromDataUrl = (dataUrl: string, defaultExt: string = 'mp4'): string => {
  if (!dataUrl) return 'bin';

  // Se for data URL, extrair MIME type do cabeçalho
  if (dataUrl.startsWith('data:')) {
    const mimeMatch = dataUrl.match(/^data:(.*?)(;|,)/);
    const mimeType = mimeMatch ? mimeMatch[1] : '';

    // Mapear MIME type para extensão
    if (mimeType.startsWith('image/')) {
      if (mimeType.includes('png')) return 'png';
      if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
      if (mimeType.includes('gif')) return 'gif';
      if (mimeType.includes('webp')) return 'webp';
      return 'jpg'; // fallback para imagem
    } else if (mimeType.startsWith('video/')) {
      if (mimeType.includes('mp4')) return 'mp4';
      if (mimeType.includes('webm')) return 'webm';
      if (mimeType.includes('quicktime')) return 'mov';
      return 'mp4'; // fallback para vídeo
    }
  }

  // Se for blob URL, não temos como saber o tipo sem fetch síncrono (impossível aqui) ou async (complexo alterar fluxo)
  // Usamos o defaultExt passado pelo contexto (ex: 'jpg' se for img2vid, 'mp4' se for mimic)
  return defaultExt;
};

export const generateVideo = async (...args: any[]): Promise<{ url: string, id: string | null }> => {
  console.log('🚀 [generateVideo] Chamado com argumentos:', args);

  const [
    prompt,
    aspectRatio,
    duration,
    videoResolution,
    mainPreview,
    extraRefs,
    type,
    _,
    mainId,
    styleId,
    stylePreview,
    referencePreview,
    referenceRole,
    onRetryStatus,
    cost // Novo parâmetro esperado no final
  ] = args;

  console.log('🔍 [generateVideo] Previews recebidos:', {
    mainPreview: mainPreview ? `${mainPreview.substring(0, 50)}... (${mainPreview.length} chars)` : 'NULL',
    stylePreview: stylePreview ? `${stylePreview.substring(0, 50)}... (${stylePreview.length} chars)` : 'NULL',
    mainId,
    styleId,
    cost
  });

  // Obter usuário autenticado
  let userId = 'anonymous';
  try {
    const user = await getCurrentUser();
    userId = user?.id || 'anonymous';
    console.log('👤 [generateVideo] Usuário:', userId);
  } catch (error) {
    console.warn('⚠️ [generateVideo] Não foi possível obter usuário autenticado, usando anonymous');
  }

  console.log('📤 [generateVideo] Fazendo upload de vídeos/imagens base64 para Supabase...');

  // Converter base64 para URLs públicas do Supabase
  let mainPublicUrl = mainPreview;
  let stylePublicUrl = stylePreview;

  // Determinar extensão padrão baseada no tipo de criação
  // MIMIC = Video Input, Outros (Img2Vid) = Image Input
  const isMainVideo = type === CreationType.MIMIC || type === CreationType.VIDEO;
  const mainDefaultExt = isMainVideo ? 'mp4' : 'jpg';

  // 🔧 FIX: Para MIMIC, se mainId existe, recuperar o vídeo real do IndexedDB
  if (mainId && isMainVideo) {
    try {
      console.log(`🎬 [generateVideo] Recuperando vídeo real do IndexedDB (ID: ${mainId})...`);
      const fileData = await fileStorage.getFile(mainId);

      if (fileData && fileData.data) {
        // Criar blob URL do vídeo real
        const videoBlob = fileData.data;
        const videoBlobUrl = URL.createObjectURL(videoBlob);

        console.log(`✅ [generateVideo] Vídeo recuperado do IndexedDB:`, {
          type: fileData.type,
          size: `${(videoBlob.size / 1024).toFixed(2)} KB`,
          blobUrl: videoBlobUrl.substring(0, 50) + '...'
        });

        // Detectar extensão do vídeo
        const ext = getFileExtensionFromDataUrl(`data:${fileData.type};base64,`, mainDefaultExt);
        console.log(`📤 Uploading mainPreview (VÍDEO REAL) como .${ext}...`);

        const uploadedUrl = await uploadFromDataUrl(videoBlobUrl, userId, `video_main_${Date.now()}.${ext}`);
        if (uploadedUrl) {
          mainPublicUrl = uploadedUrl;
          console.log('✅ mainPreview URL (VÍDEO):', mainPublicUrl);
        } else {
          console.warn('⚠️ Upload retornou null, usando blob URL original');
          mainPublicUrl = videoBlobUrl;
        }

        // Limpar blob URL após upload
        URL.revokeObjectURL(videoBlobUrl);
      } else {
        console.warn('⚠️ [generateVideo] Arquivo não encontrado no IndexedDB, usando thumbnail');
      }
    } catch (error) {
      console.error('❌ [generateVideo] Erro ao recuperar vídeo do IndexedDB:', error);
      console.warn('⚠️ Fallback: usando thumbnail');
    }
  }
  // Para outros casos (não-MIMIC ou sem mainId), processar normalmente
  else if (mainPreview && (mainPreview.startsWith('data:') || mainPreview.startsWith('blob:'))) {

    try {
      // DETECTAR EXTENSÃO CORRETA
      const ext = getFileExtensionFromDataUrl(mainPreview, mainDefaultExt);
      console.log(`📤 Uploading mainPreview como .${ext} (Default: ${mainDefaultExt})...`);

      const uploadedUrl = await uploadFromDataUrl(mainPreview, userId, `video_main_${Date.now()}.${ext}`);
      if (uploadedUrl) {
        mainPublicUrl = uploadedUrl;
        console.log('✅ mainPreview URL:', mainPublicUrl);
      } else {
        console.warn('⚠️ Upload retornou null, usando base64 original');
        mainPublicUrl = mainPreview;
      }
    } catch (error) {
      console.error('❌ Erro ao fazer upload de mainPreview:', error);
      mainPublicUrl = mainPreview;
    }
  }

  if (stylePreview && (stylePreview.startsWith('data:') || stylePreview.startsWith('blob:'))) {
    try {
      // Estilo é quase sempre imagem
      const ext = getFileExtensionFromDataUrl(stylePreview, 'jpg');
      console.log(`📤 Uploading stylePreview como .${ext}...`);

      const uploadedUrl = await uploadFromDataUrl(stylePreview, userId, `video_style_${Date.now()}.${ext}`);
      if (uploadedUrl) {
        stylePublicUrl = uploadedUrl;
        console.log('✅ stylePreview URL:', stylePublicUrl);
      } else {
        console.warn('⚠️ Upload retornou null, usando base64 original');
        stylePublicUrl = stylePreview;
      }
    } catch (error) {
      console.error('❌ Erro ao fazer upload de stylePreview:', error);
      stylePublicUrl = stylePreview;
    }
  }

  // Upload de referências extras
  const uploadedExtraRefs = await Promise.all(
    (extraRefs || []).map(async (ref: any) => {
      if (ref.preview && (ref.preview.startsWith('data:') || ref.preview.startsWith('blob:'))) {
        try {
          const ext = getFileExtensionFromDataUrl(ref.preview, 'jpg'); // Assume imagem para extras
          const publicUrl = await uploadFromDataUrl(ref.preview, userId, `video_extra_${Date.now()}.${ext}`);
          return { ...ref, preview: publicUrl || ref.preview };
        } catch (error) {
          console.error('❌ Erro ao fazer upload de extraRef:', error);
          return ref;
        }
      }
      return ref;
    })
  );

  const payload = {
    type,
    prompt,
    aspectRatio,
    duration,
    videoResolution,
    mainPreview: mainPublicUrl,
    mainId,
    styleId,
    stylePreview: stylePublicUrl,
    extraRefs: uploadedExtraRefs,
    userId, // Adicionado userId
    cost: cost || 0, // Adicionado cost
    timestamp: new Date().toISOString()
  };

  // Criar registro da geração no Supabase
  let generationId: string | null = null;
  if (userId !== 'anonymous') {
    generationId = await createGeneration(userId, type, prompt, cost || 0, {
      aspectRatio,
      duration,
      videoResolution,
      extraRefs,
      mainId,
      styleId
    });
  }

  console.log('🌐 [generateVideo] Enviando URLs públicas para webhook n8n:', payload);

  try {
    const response = await fetch('https://n8n.prosperamentor.com.br/webhook/7725c65b-f234-411a-b5b0-d90150846bbb', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    console.log('📥 [generateVideo] Resposta do webhook:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [generateVideo] Erro:', errorText);
      throw new Error(`Erro no webhook: ${response.status} - ${response.statusText}`);
    }

    // Verificar se há conteúdo na resposta
    const responseText = await response.text();
    if (!responseText || responseText.trim() === '') {
      console.error('❌ [generateVideo] Webhook retornou resposta vazia');
      throw new Error('Webhook não retornou dados. Configure o nó "Respond to Webhook" no n8n para retornar {"url": "..."}');
    }

    const result = JSON.parse(responseText);
    console.log('✅ [generateVideo] Resultado do webhook:', result);

    // Retornar URL do vídeo gerado
    const finalUrl = result.url || result.videoUrl || result.video_url || 'https://placeholder-video.com';
    console.log('🎬 [generateVideo] URL final extraída:', finalUrl);

    // Atualizar registro no Supabase com a URL final
    if (generationId && finalUrl) {
      console.log(`🔄 [generateVideo] Chamando updateGenerationResult para generationId: ${generationId}`);
      await updateGenerationResult(generationId, finalUrl);
    } else {
      console.warn('⚠️ [generateVideo] Não foi possível atualizar:', { generationId, finalUrl });
    }

    return { url: finalUrl, id: generationId };
  } catch (error) {
    console.error('❌ [generateVideo] Erro ao chamar webhook:', error);
    throw error;
  }
};

export const generateCarouselScript = async (...args: any[]): Promise<CarouselSlide[]> => {
  throw new Error("generateCarouselScript desabilitado - use o webhook n8n");
};