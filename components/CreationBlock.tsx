
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CreationType, AspectRatio, Quality, EditorBlockData, VideoDuration, VideoResolution, ReferenceRole, ExtraReference, CreationItem, ImageFormat } from '../types';
import { CREDIT_COSTS, FEATURE_FLAGS } from '../constants';
import { enhancePrompt, generateImage, generateVideo, fileStorage } from '../services/geminiService';
import { ErrorBoundary } from './ErrorBoundary';

interface CreationBlockProps {
  id: string;
  name: string;
  position: { x: number; y: number };
  initialData: EditorBlockData;
  onUpdate: (id: string, data: Partial<EditorBlockData>) => void;
  onDuplicate: (id: string) => void;
  onGenerated: (type: CreationType, url: string, prompt: string, details: any) => void;
  credits: number;
  deductCredits: (amount: number) => boolean;
  onPositionChange: (x: number, y: number) => void;
  onRemove: () => void;
  onUpload: (file: File) => void; 
  isSingle: boolean;
  scale: number;
}

// Helper: Resize image for UI Preview
const optimizeImageForPreview = async (file: File): Promise<string> => {
  const MAX_WIDTH = 600;
  const QUALITY = 0.7;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > MAX_WIDTH) { height = Math.round((height * MAX_WIDTH) / width); width = MAX_WIDTH; }
      } else {
        if (height > MAX_WIDTH) { width = Math.round((width * MAX_WIDTH) / height); height = MAX_WIDTH; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', QUALITY));
      } else {
        reject(new Error("Canvas error"));
      }
    };
    img.onerror = () => reject(new Error("Invalid image"));
    img.src = url;
  });
};

// Helper: Generate Thumbnail from Video
const generateVideoThumbnail = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;
        const url = URL.createObjectURL(file);
        video.src = url;

        video.onloadeddata = () => {
            // Seek to 1s or 25% to avoid black frames
            video.currentTime = Math.min(video.duration * 0.25, 1.0);
        };

        video.onseeked = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 480;
            canvas.height = 270;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(url);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            } else {
                reject(new Error("Canvas context failed"));
            }
        };

        video.onerror = () => {
             URL.revokeObjectURL(url);
             reject(new Error("Video load failed"));
        };
    });
};

// --- SIMILARITY CHECK HELPER (CLIENT SIDE) ---
const areImagesSimilar = async (img1Url: string, img2Url: string): Promise<boolean> => {
    const loadImage = (url: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
        });
    };

    const getImageData = (img: HTMLImageElement, size = 64): Uint8ClampedArray => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Canvas context missing");
        ctx.drawImage(img, 0, 0, size, size);
        return ctx.getImageData(0, 0, size, size).data;
    };

    try {
        const [img1, img2] = await Promise.all([loadImage(img1Url), loadImage(img2Url)]);
        const data1 = getImageData(img1);
        const data2 = getImageData(img2);

        // Calculate Root Mean Square Error (RMSE)
        let sumSquaredError = 0;
        for (let i = 0; i < data1.length; i += 4) {
            // RGB distance
            const rDiff = data1[i] - data2[i];
            const gDiff = data1[i+1] - data2[i+1];
            const bDiff = data1[i+2] - data2[i+2];
            sumSquaredError += (rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);
        }

        const mse = sumSquaredError / (data1.length / 4); // Mean Squared Error per pixel
        const rmse = Math.sqrt(mse);
        
        // Threshold: Lower RMSE means more similar. 
        console.log(`[Similarity Check] RMSE: ${rmse}`);
        return rmse < 45; 

    } catch (e) {
        console.warn("Similarity check failed:", e);
        return false; // Assume different if check fails
    }
};


const CreationBlock: React.FC<CreationBlockProps> = ({ 
  id,
  name,
  position,
  initialData,
  onUpdate,
  onDuplicate,
  onGenerated, 
  credits, 
  deductCredits,
  onPositionChange,
  onRemove,
  onUpload,
  isSingle,
  scale,
}) => {
  const [type, setType] = useState<CreationType>(initialData.type || CreationType.IMAGE);
  const [prompt, setPrompt] = useState(initialData.prompt || '');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(initialData.aspectRatio || AspectRatio.SQUARE);
  const [quality, setQuality] = useState<Quality>(initialData.quality || Quality.K1);
  const [format, setFormat] = useState<ImageFormat>(initialData.format || ImageFormat.PNG);
  const [duration, setDuration] = useState<VideoDuration>(initialData.duration || VideoDuration.SEC_5);
  const [videoResolution, setVideoResolution] = useState<VideoResolution>(initialData.videoResolution || VideoResolution.RES_720P);
  
  // Ref 1 (Slot 1 - Subject)
  const [mainPreview, setMainPreview] = useState<string | null>(initialData.refMain || null);
  const [mainId, setMainId] = useState<string | null>(initialData.refMainId || null);
  const [mainType, setMainType] = useState<'image' | 'video'>(initialData.refMainType || 'image');

  // Ref 2 (Slot 2 - Style)
  const [stylePreview, setStylePreview] = useState<string | null>(initialData.refStyle || null);
  const [styleId, setStyleId] = useState<string | null>(initialData.refStyleId || null);
  const [styleType, setStyleType] = useState<'image' | 'video'>(initialData.refStyleType || 'image');

  // Ref 3 (Slot 3 - Reference / Creative Model)
  const [referencePreview, setReferencePreview] = useState<string | null>(initialData.refReference || null);
  const [referenceId, setReferenceId] = useState<string | null>(initialData.refReferenceId || null);
  const [referenceType, setReferenceType] = useState<'image' | 'video'>(initialData.refReferenceType || 'image');
  const [referenceRole, setReferenceRole] = useState<ReferenceRole>(initialData.refReferenceRole || ReferenceRole.FREE);
  
  // Advanced Refs
  const [extraRefs, setExtraRefs] = useState<ExtraReference[]>(initialData.extraRefs || []);

  // NEW: Track Active Slot for Paste
  const [activeSlot, setActiveSlot] = useState<'main' | 'style' | 'reference' | 'extra' | null>(null);

  // --- PROMPT MODAL STATE ---
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [tempPrompt, setTempPrompt] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState('');

  // Dropdown UI State
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isFormatDropdownOpen, setIsFormatDropdownOpen] = useState(false);
  const [isQualityDropdownOpen, setIsQualityDropdownOpen] = useState(false); 
  const [isImgFormatDropdownOpen, setIsImgFormatDropdownOpen] = useState(false);
  const [isResDropdownOpen, setIsResDropdownOpen] = useState(false);

  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const formatDropdownRef = useRef<HTMLDivElement>(null);
  const qualityDropdownRef = useRef<HTMLDivElement>(null);
  const imgFormatDropdownRef = useRef<HTMLDivElement>(null);
  const resDropdownRef = useRef<HTMLDivElement>(null);

  // Drag Refs (Window D&D)
  const elementRef = useRef<HTMLDivElement>(null);
  const dragInfo = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0, isDragging: false });
  const [isDraggingVisual, setIsDraggingVisual] = useState(false);

  // Drag Refs (File Drop)
  const [isDragOverMain, setIsDragOverMain] = useState(false);
  const [isDragOverStyle, setIsDragOverStyle] = useState(false);
  const [isDragOverReference, setIsDragOverReference] = useState(false);
  const [isDragOverExtra, setIsDragOverExtra] = useState(false);

  // File Input Refs
  const fileInputRefMain = useRef<HTMLInputElement>(null);
  const fileInputRefStyle = useRef<HTMLInputElement>(null);
  const fileInputRefReference = useRef<HTMLInputElement>(null);
  const fileInputRefExtra = useRef<HTMLInputElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Clear active slot if clicked outside of any slot
      // We rely on stopPropagation in slot click handler
      if (activeSlot) {
         // This listener runs on bubble, so if slot wasn't clicked (which stops prop), we assume outside.
         setActiveSlot(null);
      }

      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
      if (formatDropdownRef.current && !formatDropdownRef.current.contains(event.target as Node)) {
        setIsFormatDropdownOpen(false);
      }
      if (qualityDropdownRef.current && !qualityDropdownRef.current.contains(event.target as Node)) {
        setIsQualityDropdownOpen(false);
      }
      if (imgFormatDropdownRef.current && !imgFormatDropdownRef.current.contains(event.target as Node)) {
        setIsImgFormatDropdownOpen(false);
      }
      if (resDropdownRef.current && !resDropdownRef.current.contains(event.target as Node)) {
        setIsResDropdownOpen(false);
      }
    };
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, [activeSlot]);

  // Modal ESC Key Listener
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && isPromptModalOpen) {
            setIsPromptModalOpen(false);
        }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isPromptModalOpen]);

  // Validate Duration when switching models
  useEffect(() => {
     const isMimic = type === CreationType.MIMIC;
     const validDurations = isMimic 
        ? [VideoDuration.SEC_5, VideoDuration.SEC_10, VideoDuration.SEC_15, VideoDuration.SEC_20] 
        : [VideoDuration.SEC_5, VideoDuration.SEC_10];
     
     if (!validDurations.includes(duration)) {
         setDuration(VideoDuration.SEC_5);
     }
  }, [type, duration]);

  // Sync basic fields
  useEffect(() => {
    const timer = setTimeout(() => {
      onUpdate(id, { 
          type, prompt, aspectRatio, quality, format, duration, videoResolution, extraRefs,
          refMain: mainPreview, refMainId: mainId, refMainType: mainType,
          refStyle: stylePreview, refStyleId: styleId, refStyleType: styleType,
          refReference: referencePreview, refReferenceId: referenceId, refReferenceType: referenceType, refReferenceRole: referenceRole
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [type, prompt, aspectRatio, quality, format, duration, videoResolution, extraRefs, id, onUpdate, mainPreview, mainId, mainType, stylePreview, styleId, styleType, referencePreview, referenceId, referenceType, referenceRole]);

  // Determine Cost
  let cost = 0;
  if (type === CreationType.IMAGE || type === CreationType.CREATIVE_MODEL || type === CreationType.PROFESSIONAL_PHOTO) {
    cost = (CREDIT_COSTS.IMAGE as any)[quality];
  }
  else if (type === CreationType.AVATAR) cost = CREDIT_COSTS.AVATAR;
  else if (type === CreationType.MIMIC) {
      // Dynamic Cost for Mimic: Based on Resolution and Duration
      const mimicTable = CREDIT_COSTS.MIMIC as any;
      const resKey = videoResolution || VideoResolution.RES_720P;
      const durKey = duration || VideoDuration.SEC_5;
      
      // Safety check for table existence
      if (mimicTable && mimicTable[resKey] && mimicTable[resKey][durKey]) {
          cost = mimicTable[resKey][durKey];
      } else {
          cost = 60; // Fallback default
      }
  }
  else if (type === CreationType.IMAGE_TO_VIDEO) cost = CREDIT_COSTS.IMAGE_TO_VIDEO;
  else if (type === CreationType.FACE_TO_VIDEO) cost = CREDIT_COSTS.FACE_TO_VIDEO;
  else cost = CREDIT_COSTS.VIDEO;

  const isDualMode = !!(mainPreview && stylePreview && type === CreationType.IMAGE);
  const isVideoMode = type === CreationType.VIDEO || type === CreationType.IMAGE_TO_VIDEO || type === CreationType.MIMIC || type === CreationType.FACE_TO_VIDEO;
  const isAvatarMode = type === CreationType.AVATAR;
  const isCreativeModel = type === CreationType.CREATIVE_MODEL;
  const isProfessionalPhoto = type === CreationType.PROFESSIONAL_PHOTO;

  // --- PROMPT MODAL HANDLERS ---
  const openPromptModal = () => {
      if (isGenerating) return;
      setTempPrompt(prompt);
      setIsPromptModalOpen(true);
  };

  const savePromptModal = () => {
      setPrompt(tempPrompt);
      setIsPromptModalOpen(false);
  };

  const copyFromModal = () => {
      navigator.clipboard.writeText(tempPrompt);
  };

  // --- DRAG HANDLERS (Block Position) ---
  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.no-drag')) return;
    e.stopPropagation(); e.preventDefault();
    const element = elementRef.current;
    if (!element) return;
    element.setPointerCapture(e.pointerId);
    setIsDraggingVisual(true);
    dragInfo.current = { isDragging: true, startX: e.clientX, startY: e.clientY, initialX: position.x, initialY: position.y };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragInfo.current.isDragging || !elementRef.current) return;
    e.stopPropagation(); e.preventDefault();
    
    // Calculate delta in "Unscaled World Coordinates"
    const deltaX = (e.clientX - dragInfo.current.startX) / scale;
    const deltaY = (e.clientY - dragInfo.current.startY) / scale;
    
    // Current world position (unscaled)
    const currentWorldX = dragInfo.current.initialX + deltaX;
    const currentWorldY = dragInfo.current.initialY + deltaY;

    elementRef.current.style.transform = `translate(${currentWorldX * scale}px, ${currentWorldY * scale}px) scale(${scale})`;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragInfo.current.isDragging) return;
    e.stopPropagation(); e.preventDefault();
    if (elementRef.current) elementRef.current.releasePointerCapture(e.pointerId);
    setIsDraggingVisual(false);
    dragInfo.current.isDragging = false;
    
    const deltaX = (e.clientX - dragInfo.current.startX) / scale;
    const deltaY = (e.clientY - dragInfo.current.startY) / scale;
    
    // Commit unscaled coordinates to state
    onPositionChange(dragInfo.current.initialX + deltaX, dragInfo.current.initialY + deltaY);
  };

  // --- FILE LOGIC ---

  const processFile = useCallback(async (file: File, slot: 'main' | 'style' | 'reference' | 'extra') => {
    setErrorMsg(null);
    setIsProcessingUpload(true);
    
    try {
        const isVideo = file.type.startsWith('video/');
        const isImage = file.type.startsWith('image/');
        const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        if (!isVideo && !isImage) throw new Error("Formato não suportado. Envie PNG, JPG ou WEBP.");

        if (type === CreationType.MIMIC && slot === 'main') {
            if (!isVideo) throw new Error("O campo 'Seu Vídeo' exige um arquivo de vídeo (MP4).");
        }
        if ((type === CreationType.IMAGE_TO_VIDEO || type === CreationType.FACE_TO_VIDEO) && slot === 'main' && !isImage) {
            throw new Error("Este modelo exige uma imagem.");
        }

        // Processing
        if (isVideo) {
            if (file.size > 20 * 1024 * 1024) throw new Error("Vídeo muito grande (Max 20MB).");
            await fileStorage.saveFile(fileId, file);
            const thumb = await generateVideoThumbnail(file);
            
            if (slot === 'main') {
                setMainId(fileId); setMainPreview(thumb); setMainType('video');
            } else if (slot === 'style') {
                setStyleId(fileId); setStylePreview(thumb); setStyleType('video');
            } else if (slot === 'reference') {
                setReferenceId(fileId); setReferencePreview(thumb); setReferenceType('video');
            }
        } else if (isImage) {
            if (file.size > 10 * 1024 * 1024) throw new Error("Imagem muito grande (Max 10MB).");
            const preview = await optimizeImageForPreview(file);
            
            if (slot === 'main') {
                setMainId(null); setMainPreview(preview); setMainType('image');
            } else if (slot === 'style') {
                setStyleId(null); setStylePreview(preview); setStyleType('image');
            } else if (slot === 'reference') {
                setReferenceId(null); setReferencePreview(preview); setReferenceType('image');
            } else if (slot === 'extra') {
               await fileStorage.saveFile(fileId, file);
               const newRef: ExtraReference = {
                  id: `ref_${Date.now()}`,
                  fileId,
                  preview,
                  role: ReferenceRole.FREE,
                  note: 'Upload Manual',
                  createdAt: Date.now()
               };
               setExtraRefs(prev => [...prev, newRef]);
            }
        }
    } catch (err: any) {
        console.error("Upload error", err);
        setErrorMsg(err.message || "Erro no upload.");
    } finally {
        setIsProcessingUpload(false);
    }
  }, [type]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, slot: 'main' | 'style' | 'reference') => {
    const file = e.target.files?.[0];
    if (file) {
        processFile(file, slot);
        e.target.value = '';
    }
  };

  const handleExtraFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        processFile(file, 'extra');
        e.target.value = '';
    }
  };

  // --- WINDOW PASTE LISTENER ---
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
        // Only process if THIS block has an active slot selected
        if (!activeSlot) return;

        if (e.clipboardData && e.clipboardData.items) {
            const items = e.clipboardData.items;
            for (let i = 0; i < items.length; i++) {
                // Look for image items in clipboard
                if (items[i].type.indexOf("image") !== -1) {
                    e.preventDefault(); // Stop standard paste
                    e.stopPropagation();
                    
                    const file = items[i].getAsFile();
                    if (file) {
                        // Process using our robust file handler
                        processFile(file, activeSlot);
                        // Provide UI Feedback
                        setLoadingStep('Imagem colada!');
                        setTimeout(() => setLoadingStep(''), 1500);
                    }
                    return; // Stop after finding first image
                }
            }
        }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [activeSlot, processFile]);

  const handleSlotClick = (e: React.MouseEvent, slot: 'main' | 'style' | 'reference' | 'extra') => {
      e.stopPropagation(); // Stop propagation so the window click listener doesn't immediately clear activeSlot
      setActiveSlot(slot);
  };

  const handleSlotDragOver = (e: React.DragEvent, slot: 'main' | 'style' | 'reference' | 'extra') => {
      e.preventDefault();
      e.stopPropagation();

      // FEATURE FLAG CHECK: Disable drag functionality if flag is false
      if (!FEATURE_FLAGS.DRAG_DROP_ENABLED) return;

      if (slot === 'main') setIsDragOverMain(true);
      if (slot === 'style') setIsDragOverStyle(true);
      if (slot === 'reference') setIsDragOverReference(true);
      if (slot === 'extra') setIsDragOverExtra(true);
  };

  const handleSlotDragLeave = (e: React.DragEvent, slot: 'main' | 'style' | 'reference' | 'extra') => {
      e.preventDefault();
      e.stopPropagation();

      // FEATURE FLAG CHECK: Disable drag functionality if flag is false
      if (!FEATURE_FLAGS.DRAG_DROP_ENABLED) return;

      if (slot === 'main') setIsDragOverMain(false);
      if (slot === 'style') setIsDragOverStyle(false);
      if (slot === 'reference') setIsDragOverReference(false);
      if (slot === 'extra') setIsDragOverExtra(false);
  };

  const handleSlotDrop = (e: React.DragEvent, slot: 'main' | 'style' | 'reference' | 'extra') => {
      e.preventDefault();
      e.stopPropagation();

      // FEATURE FLAG CHECK: Disable drag functionality if flag is false
      if (!FEATURE_FLAGS.DRAG_DROP_ENABLED) return;

      setIsDragOverMain(false);
      setIsDragOverStyle(false);
      setIsDragOverReference(false);
      setIsDragOverExtra(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const file = e.dataTransfer.files[0]; 
          processFile(file, slot);
      }
  };

  const updateExtraRef = (refId: string, updates: Partial<ExtraReference>) => {
    setExtraRefs(prev => prev.map(r => r.id === refId ? { ...r, ...updates } : r));
  };

  const removeExtraRef = (refId: string) => {
    setExtraRefs(prev => {
      const refToRemove = prev.find(r => r.id === refId);
      if (refToRemove) {
        fileStorage.deleteFile(refToRemove.fileId).catch(console.warn);
      }
      return prev.filter(r => r.id !== refId);
    });
  };

  const handleGenerate = async () => {
    if (isGenerating || isProcessingUpload) return;

    if (isVideoMode && !FEATURE_FLAGS.VIDEO_MODELS_ENABLED) {
        setErrorMsg("Modelos de vídeo estão temporariamente desativados. Em breve serão liberados.");
        return;
    }

    setErrorMsg(null);
    setLoadingStep('Validando...');
    setIsGenerating(true);

    // Callback to update UI during retries (e.g. 503 Overloaded)
    const onRetryStatus = (attempt: number) => {
        setLoadingStep(`IA ocupada. Tentando novamente... (${attempt}/3)`);
    };

    try {
      if (credits < cost) throw new Error(`Saldo insuficiente. Necessário: ${cost}, Disponível: ${credits}`);
      
      if (type === CreationType.MIMIC) {
          if (!mainPreview || !mainId) throw new Error("Obrigatório: Vídeo de Movimento (Slot 1).");
          if (!stylePreview) throw new Error("Obrigatório: Avatar (Slot 2).");
      } else if (type === CreationType.IMAGE_TO_VIDEO) {
          if (!mainPreview) throw new Error("Obrigatório: Imagem Base (Slot 1).");
      } else if (type === CreationType.FACE_TO_VIDEO) {
          if (!mainPreview) throw new Error("Obrigatório: Rosto do Avatar (Slot 1).");
          if (!prompt) throw new Error("Obrigatório: Contexto do Vídeo (Prompt).");
      } else if (type === CreationType.CREATIVE_MODEL) {
          if (!mainPreview) throw new Error("Obrigatório: Sua Imagem (Slot 1).");
          if (!stylePreview) throw new Error("Obrigatório: Imagem de Referência/Modelo (Slot 2).");
      } else if (type === CreationType.PROFESSIONAL_PHOTO) {
          if (!mainPreview) throw new Error("Obrigatório: Sujeito Principal (Slot 1).");
      } else {
          if (!prompt && !mainPreview && !stylePreview && !referencePreview) throw new Error("Preencha o prompt ou adicione referências.");
          if (isDualMode && (!mainPreview || !stylePreview)) throw new Error("Modo modelagem requer ambas as imagens.");
      }

      let resultUrl = '';
      
      // --- RETRY LOOP FOR ANTI-DUPLICATION (Creative Model) ---
      let attempts = 0;
      const maxAttempts = 2; // Initial + 1 retry for duplication

      while (attempts < maxAttempts) {
          attempts++;
          
          // Generate
          if (type === CreationType.IMAGE || type === CreationType.AVATAR || type === CreationType.CREATIVE_MODEL || type === CreationType.PROFESSIONAL_PHOTO) {
            setLoadingStep(attempts > 1 ? 'Tentando novamente (Anti-duplicação)...' : 'Processando...');
            resultUrl = await generateImage(
                 prompt, 
                 aspectRatio, 
                 quality, 
                 type, 
                 mainPreview || undefined, 
                 stylePreview || undefined, 
                 extraRefs,
                 format, 
                 referencePreview || undefined,
                 referenceRole,
                 onRetryStatus // Pass the retry callback
            );
          } else {
            setLoadingStep('Renderizando...');
            resultUrl = await generateVideo(
                prompt, aspectRatio, duration, videoResolution,
                mainPreview || undefined, 
                extraRefs, 
                type, 
                undefined, 
                mainId || undefined, 
                styleId || undefined, 
                stylePreview || undefined,
                onRetryStatus // Pass the retry callback
            );
          }

          if (!resultUrl) throw new Error("A API não retornou dados.");

          // --- CRITICAL: ANTI-DUPLICATION CHECK FOR CREATIVE MODEL ---
          if (type === CreationType.CREATIVE_MODEL && stylePreview) {
              setLoadingStep("Validando resultado...");
              const isDuplicate = await areImagesSimilar(resultUrl, stylePreview);
              
              if (isDuplicate) {
                  console.warn(`[Anti-Duplication] Result identical to reference. Attempt ${attempts}/${maxAttempts}`);
                  
                  if (attempts < maxAttempts) {
                      setLoadingStep("Detectamos que o resultado ficou igual à referência. Tentando novamente...");
                      await new Promise(r => setTimeout(r, 2000)); // Small delay for UX
                      continue; // Retry generation
                  } else {
                      // Failed after retry
                      throw new Error("Falha ao modelar: O resultado ficou igual à referência. Tente usar um sujeito mais nítido ou outra referência. Nenhum crédito foi consumido.");
                  }
              }
          }

          // If we pass validation or it's another mode, break the loop
          break; 
      }

      // CRITICAL: Deduct credits ONLY if we have a success result URL AND passed validation
      if (deductCredits(cost)) {
        onGenerated(type, resultUrl, prompt, { quality, aspectRatio });
        onUpdate(id, { lastGeneratedUrl: resultUrl });
      } else {
          // Should not happen if validation passed, but safety check
          throw new Error("Erro ao debitar créditos.");
      }

    } catch (err: any) {
      console.error(`[Block ${id}] ERROR:`, err);
      // Ensure error message is user friendly
      setErrorMsg(err.message || "Erro desconhecido. Tente novamente.");
    } finally {
      setIsGenerating(false);
      setLoadingStep('');
    }
  };

  // --- SLOT LABELS & CONFIG ---
  const getSlot1Label = () => {
      if (type === CreationType.MIMIC) return 'Seu Vídeo (Movimento)';
      if (type === CreationType.IMAGE_TO_VIDEO) return 'Imagem Base';
      if (type === CreationType.FACE_TO_VIDEO) return 'Rosto / Avatar';
      if (type === CreationType.CREATIVE_MODEL) return 'Sua Imagem (Assunto)';
      if (type === CreationType.PROFESSIONAL_PHOTO) return 'Sujeito / Produto';
      return 'Sujeito (Img 1)';
  };

  const getSlot2Label = () => {
      if (type === CreationType.MIMIC) return 'Avatar (Visual)';
      if (type === CreationType.CREATIVE_MODEL) return 'Referência (Modelo)';
      return 'Estilo (Img 2)';
  };

  const getSlot1Accept = () => {
      if (type === CreationType.MIMIC) return 'video/mp4';
      if (type === CreationType.IMAGE_TO_VIDEO) return 'image/*';
      if (type === CreationType.FACE_TO_VIDEO) return 'image/*';
      return 'image/*';
  };

  const getSlot2Accept = () => {
      if (type === CreationType.MIMIC) return 'image/*, video/mp4';
      return 'image/*';
  };

  const shouldShowSlot2 = type !== CreationType.IMAGE_TO_VIDEO && type !== CreationType.AVATAR && type !== CreationType.FACE_TO_VIDEO && type !== CreationType.PROFESSIONAL_PHOTO;
  const shouldShowSlot1 = type !== CreationType.AVATAR; 
  // Reference slot is generally available for image generation tasks
  const shouldShowReference = (type === CreationType.IMAGE || type === CreationType.CREATIVE_MODEL);

  const getImageAspectOptions = () => [
    { value: '1:1', label: '1:1' },
    { value: '2:3', label: '2:3' },
    { value: '3:2', label: '3:2' },
    { value: '3:4', label: '3:4' },
    { value: '4:3', label: '4:3' },
    { value: '4:5', label: '4:5' },
    { value: '5:4', label: '5:4' },
    { value: '9:16', label: '9:16 (Vertical)' },
    { value: '16:9', label: '16:9 (Horizontal)' },
    { value: '21:9', label: '21:9 (Ultra-wide)' },
    { value: 'Auto', label: 'Auto' },
  ];

  const getVideoDurationOptions = () => {
      if (type === CreationType.MIMIC) {
          return [
              { value: VideoDuration.SEC_5, label: '5 Segundos' },
              { value: VideoDuration.SEC_10, label: '10 Segundos' },
              { value: VideoDuration.SEC_15, label: '15 Segundos' },
              { value: VideoDuration.SEC_20, label: '20 Segundos' },
          ];
      }
      return [
          { value: VideoDuration.SEC_5, label: '5 Segundos' },
          { value: VideoDuration.SEC_10, label: '10 Segundos' },
      ];
  };

  const getVideoResolutionOptions = () => [
    { value: VideoResolution.RES_720P, label: '720p' },
    { value: VideoResolution.RES_1080P, label: '1080p' },
  ];

  const getVideoAspectOptions = () => [
    { value: AspectRatio.SQUARE, label: '1:1' },
    { value: AspectRatio.LANDSCAPE, label: '16:9' },
    { value: AspectRatio.PORTRAIT, label: '9:16' },
  ];

  const getQualityOptions = () => [
    { value: Quality.K1, label: 'HD' },
    { value: Quality.K2, label: '2K' },
    { value: Quality.K4, label: '4K' },
  ];

  const activeAspectOptions = (type === CreationType.IMAGE || type === CreationType.AVATAR || type === CreationType.CREATIVE_MODEL || type === CreationType.PROFESSIONAL_PHOTO) ? getImageAspectOptions() : getVideoAspectOptions();

  return (
    <ErrorBoundary>
      <div 
        ref={elementRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ 
            transform: `translate(${position.x * scale}px, ${position.y * scale}px) scale(${scale})`, 
            transformOrigin: '0 0',
            touchAction: 'none' 
        }}
        className={`stop-pan w-[380px] absolute top-0 left-0 group flex flex-col p-6 z-30 transition-shadow duration-200 select-none animate-in fade-in zoom-in-95 sharp-render
            ${isDraggingVisual ? 'ring-1 ring-indigo-500/30 z-50' : ''}
            bg-[#F8FAFC] text-slate-900 border border-slate-200 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.3)]
            dark:bg-[#0f172a] dark:text-white dark:border-white/10 dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)]
            backdrop-blur-[24px] rounded-[1.5rem]`}
      >
        {/* Error message handling */}
        {errorMsg && (
          <div className="absolute -top-12 left-0 right-0 mx-auto w-max max-w-[95%] bg-red-500/90 backdrop-blur-md text-white text-[10px] font-bold px-4 py-3 rounded-2xl flex items-center justify-between shadow-2xl z-50 animate-in slide-in-from-bottom-2 no-drag border border-red-400/50">
            <span className="mr-4 leading-tight">{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="p-1 hover:bg-white/20 rounded-full transition-colors no-drag"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg></button>
          </div>
        )}

        {/* Header */}
        <div onPointerDown={handlePointerDown} className={`flex justify-between items-center mb-4 px-1 py-1 rounded-lg ${isDraggingVisual ? 'cursor-grabbing' : 'cursor-grab hover:bg-black/5 dark:hover:bg-white/5'}`}>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate max-w-[200px]" title={name}>{name}</span>
          <div className="flex items-center gap-2 no-drag pointer-events-auto flex-shrink-0">
            <button onClick={(e) => { e.stopPropagation(); onDuplicate(id); }} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all focus:outline-none"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 01-2-2V5a2 2 0 012-2h4.586" /></svg></button>
            {!isSingle && (
              <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all focus:outline-none"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            )}
          </div>
        </div>

        <div className="space-y-5 no-drag flex-1 cursor-default">
          
          {/* Model Selector */}
          <div className="no-drag" ref={modelDropdownRef}>
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-200 uppercase tracking-widest px-1 mb-2 block">Modelo</label>
            <div className="relative">
                <button
                    onClick={() => !isGenerating && setIsModelDropdownOpen(!isModelDropdownOpen)}
                    disabled={isGenerating}
                    className={`w-full flex items-center justify-between bg-[#0B1220] border border-[#8C5CFF]/25 rounded-xl px-4 py-3.5 text-xs font-bold text-[#E6E8EE] outline-none transition-all shadow-sm group ${isModelDropdownOpen ? 'ring-1 ring-[#8C5CFF]/50 border-[#8C5CFF]/50' : 'hover:border-[#8C5CFF]/50'}`}
                >
                    <span className="truncate mr-2">
                        {type === CreationType.IMAGE && 'Texto para Imagem'}
                        {type === CreationType.AVATAR && 'Criar Influencer'}
                        {type === CreationType.CREATIVE_MODEL && 'Modelar Criativo'}
                        {type === CreationType.PROFESSIONAL_PHOTO && 'Foto Profissional (Estúdio)'}
                        {type === CreationType.FACE_TO_VIDEO && 'Rosto para Vídeo'}
                        {type === CreationType.VIDEO && 'Texto para Vídeo'}
                        {type === CreationType.IMAGE_TO_VIDEO && 'Imagem para Vídeo'}
                        {type === CreationType.MIMIC && 'Imitar Movimento'}
                    </span>
                    <svg className={`w-4 h-4 text-[#8C5CFF] transition-transform duration-200 ${isModelDropdownOpen ? 'rotate-180 text-[#A78BFA]' : 'group-hover:text-[#A78BFA]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {isModelDropdownOpen && (
                    <div className="absolute top-full left-0 w-full mt-2 bg-[#0B1220] border border-[#8C5CFF]/25 rounded-xl shadow-2xl z-[100] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 max-h-[240px] overflow-y-auto">
                        {[
                            { value: CreationType.IMAGE, label: 'Texto para Imagem' },
                            { value: CreationType.AVATAR, label: 'Criar Influencer' },
                            { value: CreationType.CREATIVE_MODEL, label: 'Modelar Criativo' },
                            { value: CreationType.PROFESSIONAL_PHOTO, label: 'Foto Profissional (Estúdio)' },
                            { value: CreationType.FACE_TO_VIDEO, label: 'Rosto para Vídeo' },
                            { value: CreationType.VIDEO, label: 'Texto para Vídeo' },
                            { value: CreationType.IMAGE_TO_VIDEO, label: 'Imagem para Vídeo' },
                            { value: CreationType.MIMIC, label: 'Imitar Movimento' }
                        ]
                        .filter(opt => {
                            const isVideo = [CreationType.VIDEO, CreationType.IMAGE_TO_VIDEO, CreationType.FACE_TO_VIDEO, CreationType.MIMIC].includes(opt.value);
                            return !isVideo || FEATURE_FLAGS.VIDEO_MODELS_ENABLED;
                        })
                        .map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => {
                                    if (!isGenerating) {
                                        setType(opt.value);
                                        setIsModelDropdownOpen(false);
                                    }
                                }}
                                className={`w-full text-left px-4 py-3 text-xs transition-all flex items-center justify-between
                                    ${type === opt.value 
                                        ? 'bg-gradient-to-r from-[#7B61FF] to-[#9B7CFF] text-white font-semibold shadow-inner' 
                                        : 'text-[#E6E8EE] hover:bg-[#8C5CFF]/10 hover:text-white'
                                    }
                                `}
                            >
                                <span>{opt.label}</span>
                                {type === opt.value && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                            </button>
                        ))}
                    </div>
                )}
            </div>
          </div>

          {/* Prompt */}
          <div className="relative group/prompt">
            {/* ... prompt input label and area ... */}
            <div className="flex justify-between items-center px-1 mb-2">
              <div className="flex items-center gap-2">
                 <label className="text-[10px] font-bold text-slate-500 dark:text-slate-200 uppercase tracking-widest">
                    {isCreativeModel ? 'Prompt' : 'Prompt'}
                 </label>
                 {isDualMode && <span className="px-2 py-0.5 bg-indigo-500 text-white text-[8px] font-black uppercase tracking-wider rounded-md animate-in fade-in">Modo Modelagem</span>}
                 {isAvatarMode && <span className="px-2 py-0.5 bg-emerald-500 text-white text-[8px] font-black uppercase tracking-wider rounded-md animate-in fade-in">Modo Identidade</span>}
                 {isCreativeModel && <span className="px-2 py-0.5 bg-pink-500 text-white text-[8px] font-black uppercase tracking-wider rounded-md animate-in fade-in">Cópia Criativa</span>}
                 {isProfessionalPhoto && <span className="px-2 py-0.5 bg-amber-500 text-white text-[8px] font-black uppercase tracking-wider rounded-md animate-in fade-in">Estúdio Pro</span>}
                 {type === CreationType.FACE_TO_VIDEO && <span className="px-2 py-0.5 bg-blue-500 text-white text-[8px] font-black uppercase tracking-wider rounded-md animate-in fade-in">Alta Fidelidade</span>}
              </div>

              {/* Expand Button */}
              <button 
                  onClick={openPromptModal}
                  className="p-1 hover:bg-slate-200 dark:hover:bg-white/10 rounded-md text-slate-400 hover:text-indigo-400 transition-colors"
                  title="Expandir Editor"
                  disabled={isGenerating}
              >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
              </button>
            </div>
            <textarea 
               value={prompt} 
               onChange={(e) => setPrompt(e.target.value)} 
               disabled={isGenerating} 
               placeholder={
                  isAvatarMode 
                  ? "Descreva seu influencer (ex: Mulher jovem, profissional de tech, cabelo curto, óculos, blazer azul)..." 
                  : isCreativeModel
                    ? "Digite a Manchete ou Oferta para o criativo (ex: 'Promoção de Verão', 'Desconto Exclusivo')..."
                    : isProfessionalPhoto
                      ? "Descreva a cena, iluminação ou pose desejada (ex: Iluminação dramática lateral, fundo preto, olhar sério)..."
                    : type === CreationType.MIMIC 
                      ? "Descreva o ambiente e iluminação (o movimento virá do vídeo)..." 
                      : type === CreationType.FACE_TO_VIDEO
                      ? "Descreva o contexto do vídeo (ex: Falando com confiança em um escritório moderno, iluminação suave)..."
                      : "Descreva sua imaginação..."
               } 
               className={`w-full h-28 rounded-xl p-4 text-sm font-medium outline-none transition-all resize-none scrollbar-hide shadow-inner leading-relaxed bg-slate-50 dark:bg-black/30 text-slate-900 dark:text-white placeholder-slate-400 border focus:ring-1 focus:ring-indigo-500/50 ${isDualMode ? 'border-indigo-500/30' : 'border-slate-200 dark:border-white/10 focus:border-indigo-500'}`} 
            />
          </div>

          {/* Configs (Proportion | Quality/Duration | Format/Resolution) */}
          <div className="grid gap-4 grid-cols-3">
            
            {/* Proportion (Previously Format) */}
            <div className="space-y-2" ref={formatDropdownRef}>
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-200 uppercase px-1">Proporção</label>
              <div className="relative">
                <button
                    onClick={() => !isGenerating && setIsFormatDropdownOpen(!isFormatDropdownOpen)}
                    disabled={isGenerating}
                    className={`w-full flex items-center justify-between bg-[#0B1220] border border-[#8C5CFF]/25 rounded-xl px-2 py-3.5 text-xs font-bold text-[#E6E8EE] outline-none transition-all shadow-sm group ${isFormatDropdownOpen ? 'ring-1 ring-[#8C5CFF]/50 border-[#8C5CFF]/50' : 'hover:border-[#8C5CFF]/50'}`}
                >
                    <span className="truncate mr-1">
                       {activeAspectOptions.find(o => o.value === aspectRatio)?.label || aspectRatio}
                    </span>
                    <svg className={`w-3 h-3 text-[#8C5CFF] transition-transform duration-200 ${isFormatDropdownOpen ? 'rotate-180 text-[#A78BFA]' : 'group-hover:text-[#A78BFA]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {isFormatDropdownOpen && (
                    <div className="absolute top-full left-0 w-full mt-2 bg-[#0B1220] border border-[#8C5CFF]/25 rounded-xl shadow-2xl z-[100] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 max-h-[240px] overflow-y-auto">
                        {activeAspectOptions.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => {
                                    if (!isGenerating) {
                                        setAspectRatio(opt.value as AspectRatio);
                                        setIsFormatDropdownOpen(false);
                                    }
                                }}
                                className={`w-full text-left px-4 py-3 text-xs transition-all flex items-center justify-between
                                    ${aspectRatio === opt.value 
                                        ? 'bg-gradient-to-r from-[#7B61FF] to-[#9B7CFF] text-white font-semibold shadow-inner' 
                                        : 'text-[#E6E8EE] hover:bg-[#8C5CFF]/10 hover:text-white'
                                    }
                                `}
                            >
                                <span>{opt.label}</span>
                                {aspectRatio === opt.value && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                            </button>
                        ))}
                    </div>
                )}
              </div>
            </div>
            
            {/* Quality / Duration */}
            <div className="space-y-2" ref={qualityDropdownRef}>
               <label className="text-[10px] font-bold text-slate-500 dark:text-slate-200 uppercase px-1">
                 {isVideoMode ? 'Duração' : 'Qualidade'}
               </label>
               <div className="relative">
                  <button
                      onClick={() => !isGenerating && setIsQualityDropdownOpen(!isQualityDropdownOpen)}
                      disabled={isGenerating}
                      className={`w-full flex items-center justify-between bg-[#0B1220] border border-[#8C5CFF]/25 rounded-xl px-2 py-3.5 text-xs font-bold text-[#E6E8EE] outline-none transition-all shadow-sm group ${isQualityDropdownOpen ? 'ring-1 ring-[#8C5CFF]/50 border-[#8C5CFF]/50' : 'hover:border-[#8C5CFF]/50'}`}
                  >
                      <span className="truncate mr-1">
                          {isVideoMode 
                             ? `${duration}s`
                             : (getQualityOptions().find(o => o.value === quality)?.label || quality)
                          }
                      </span>
                      <svg className={`w-3 h-3 text-[#8C5CFF] transition-transform duration-200 ${isQualityDropdownOpen ? 'rotate-180 text-[#A78BFA]' : 'group-hover:text-[#A78BFA]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                  </button>

                  {isQualityDropdownOpen && (
                      <div className="absolute top-full left-0 w-full mt-2 bg-[#0B1220] border border-[#8C5CFF]/25 rounded-xl shadow-2xl z-[100] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 max-h-[240px] overflow-y-auto">
                          {isVideoMode ? (
                             getVideoDurationOptions().map((opt) => (
                               <button 
                                  key={opt.value}
                                  onClick={() => { setDuration(opt.value); setIsQualityDropdownOpen(false); }} 
                                  className={`w-full text-left px-4 py-3 text-xs transition-all flex items-center justify-between ${duration === opt.value ? 'bg-gradient-to-r from-[#7B61FF] to-[#9B7CFF] text-white font-semibold' : 'text-[#E6E8EE] hover:bg-[#8C5CFF]/10 hover:text-white'}`}
                               >
                                  <span>{opt.label}</span>
                                  {duration === opt.value && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                               </button>
                             ))
                          ) : (
                             getQualityOptions().map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => {
                                        if (!isGenerating) {
                                            setQuality(opt.value as Quality);
                                            setIsQualityDropdownOpen(false);
                                        }
                                    }}
                                    className={`w-full text-left px-4 py-3 text-xs transition-all flex items-center justify-between
                                        ${quality === opt.value 
                                            ? 'bg-gradient-to-r from-[#7B61FF] to-[#9B7CFF] text-white font-semibold shadow-inner' 
                                            : 'text-[#E6E8EE] hover:bg-[#8C5CFF]/10 hover:text-white'
                                        }
                                    `}
                                >
                                    <span>{opt.label}</span>
                                    {quality === opt.value && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                </button>
                             ))
                          )}
                      </div>
                  )}
               </div>
            </div>

            {/* Format (Image) / Resolution (Video) */}
            <div className="space-y-2" ref={isVideoMode ? resDropdownRef : imgFormatDropdownRef}>
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-200 uppercase px-1">
                  {isVideoMode ? 'Resolução' : 'Formato'}
              </label>
              <div className="relative">
                <button
                    onClick={() => {
                        if (isGenerating) return;
                        if (isVideoMode) setIsResDropdownOpen(!isResDropdownOpen);
                        else setIsImgFormatDropdownOpen(!isImgFormatDropdownOpen);
                    }}
                    disabled={isGenerating}
                    className={`w-full flex items-center justify-between bg-[#0B1220] border border-[#8C5CFF]/25 rounded-xl px-2 py-3.5 text-xs font-bold text-[#E6E8EE] outline-none transition-all shadow-sm group ${
                        (isVideoMode ? isResDropdownOpen : isImgFormatDropdownOpen) ? 'ring-1 ring-[#8C5CFF]/50 border-[#8C5CFF]/50' : 'hover:border-[#8C5CFF]/50'
                    }`}
                >
                    <span className="truncate mr-1">
                        {isVideoMode ? videoResolution : format}
                    </span>
                    <svg className={`w-3 h-3 text-[#8C5CFF] transition-transform duration-200 ${
                        (isVideoMode ? isResDropdownOpen : isImgFormatDropdownOpen) ? 'rotate-180 text-[#A78BFA]' : 'group-hover:text-[#A78BFA]'
                    }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {/* Video Resolution Dropdown */}
                {isVideoMode && isResDropdownOpen && (
                    <div className="absolute top-full left-0 w-full mt-2 bg-[#0B1220] border border-[#8C5CFF]/25 rounded-xl shadow-2xl z-[100] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
                        {getVideoResolutionOptions().map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => {
                                    if (!isGenerating) {
                                        setVideoResolution(opt.value);
                                        setIsResDropdownOpen(false);
                                    }
                                }}
                                className={`w-full text-left px-4 py-3 text-xs transition-all flex items-center justify-between
                                    ${videoResolution === opt.value 
                                        ? 'bg-gradient-to-r from-[#7B61FF] to-[#9B7CFF] text-white font-semibold shadow-inner' 
                                        : 'text-[#E6E8EE] hover:bg-[#8C5CFF]/10 hover:text-white'
                                    }
                                `}
                            >
                                <span>{opt.label}</span>
                                {videoResolution === opt.value && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                            </button>
                        ))}
                    </div>
                )}

                {/* Image Format Dropdown */}
                {!isVideoMode && isImgFormatDropdownOpen && (
                    <div className="absolute top-full left-0 w-full mt-2 bg-[#0B1220] border border-[#8C5CFF]/25 rounded-xl shadow-2xl z-[100] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
                        {Object.values(ImageFormat).map((fmt) => (
                            <button
                                key={fmt}
                                onClick={() => {
                                    if (!isGenerating) {
                                        setFormat(fmt);
                                        setIsImgFormatDropdownOpen(false);
                                    }
                                }}
                                className={`w-full text-left px-4 py-3 text-xs transition-all flex items-center justify-between
                                    ${format === fmt 
                                        ? 'bg-gradient-to-r from-[#7B61FF] to-[#9B7CFF] text-white font-semibold shadow-inner' 
                                        : 'text-[#E6E8EE] hover:bg-[#8C5CFF]/10 hover:text-white'
                                    }
                                `}
                            >
                                <span>{fmt}</span>
                                {format === fmt && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                            </button>
                        ))}
                    </div>
                )}
              </div>
            </div>
          </div>

          {/* Slots Section */}
          <div className="pt-2 flex flex-col gap-4">
            
            {/* Top Row: Subject & Style */}
            <div className={`grid gap-4 ${shouldShowSlot2 && shouldShowSlot1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              
              {/* Slot 1: Subject */}
              {shouldShowSlot1 && (
              <div className="relative group/upload">
                 <div className="flex justify-between items-center px-1 mb-2">
                    <label className={`text-[10px] font-bold uppercase flex items-center gap-1 ${type === CreationType.MIMIC ? 'text-amber-500' : 'text-slate-500 dark:text-slate-200'}`}>
                        {getSlot1Label()}
                    </label>
                    {mainPreview && !isGenerating && !isProcessingUpload && <button onClick={() => { setMainPreview(null); setMainId(null); setMainType('image'); }} className="text-slate-400 hover:text-red-400 font-bold px-2">✕</button>}
                 </div>
                 
                 <div 
                   tabIndex={0}
                   onClick={(e) => { 
                       if (isGenerating || isProcessingUpload) return;
                       e.stopPropagation(); 
                       setActiveSlot('main'); 
                       // Only trigger file dialog if clicked directly, let drag/paste handle otherwise?
                       // Or file dialog only if clicked specifically.
                       // For simplicity, click triggers file dialog, but also sets active state for paste.
                       // To allow paste without dialog, user might click "around" or we rely on them closing dialog.
                       // Better UX: Click opens dialog. Paste works if element focused.
                       // BUT prompt asked for click to set active state.
                       // We'll open dialog, but paste will work if they cancel and element is focused/active.
                       fileInputRefMain.current?.click();
                   }} 
                   onDragOver={(e) => handleSlotDragOver(e, 'main')}
                   onDragLeave={(e) => handleSlotDragLeave(e, 'main')}
                   onDrop={(e) => handleSlotDrop(e, 'main')}
                   className={`h-36 md:h-44 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all overflow-hidden relative active:scale-[0.98] outline-none
                      ${isGenerating || isProcessingUpload ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} 
                      ${activeSlot === 'main' ? 'ring-2 ring-indigo-500 border-indigo-500' : ''}
                      ${isDragOverMain ? 'border-indigo-500 bg-indigo-500/10' : (type === CreationType.MIMIC ? 'border-amber-500/30 group-hover/upload:border-amber-500/60 bg-slate-50 dark:bg-black/20' : 'border-slate-300 dark:border-white/10 group-hover/upload:border-indigo-500/50 bg-slate-50 dark:bg-black/20 hover:bg-slate-100 dark:hover:bg-black/30')}
                   `}
                 >
                   {mainPreview ? (
                     <div className="w-full h-full p-2 flex flex-col items-center justify-center bg-slate-200/50 dark:bg-black/40 rounded-xl pointer-events-none">
                         <img src={mainPreview} className="w-full h-full object-contain drop-shadow-sm" alt="Preview 1" />
                         {mainType === 'video' &&
                         <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px] rounded-xl">
                            <svg className="w-8 h-8 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" /></svg>
                         </div>
                         }
                     </div>
                 ) : (
                     <div className="text-center group-hover/upload:scale-105 transition-transform duration-300">
                        <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover/upload:text-indigo-500 group-hover/upload:bg-white transition-colors">
                           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        </div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover/upload:text-indigo-400 transition-colors">Clique para Upload</p>
                        <p className="text-[8px] text-slate-400 mt-1 opacity-70">{getSlot1Accept() === 'video/mp4' ? 'MP4 (Max 20MB)' : 'PNG, JPG'}</p>
                     </div>
                 )}
                 <input 
                    ref={fileInputRefMain} 
                    type="file" 
                    accept={getSlot1Accept()} 
                    onChange={(e) => handleFileChange(e, 'main')} 
                    className="hidden" 
                 />
               </div>
              </div>
              )}
              
              {/* Slot 2: Style */}
              {shouldShowSlot2 && (
               <div className="relative group/upload-style">
                 <div className="flex justify-between items-center px-1 mb-2">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-200 uppercase tracking-widest flex items-center gap-1">
                        {getSlot2Label()}
                    </label>
                    {stylePreview && !isGenerating && !isProcessingUpload && <button onClick={() => { setStylePreview(null); setStyleId(null); setStyleType('image'); }} className="text-slate-400 hover:text-red-400 font-bold px-2">✕</button>}
                 </div>

                 <div 
                   tabIndex={0}
                   onClick={(e) => { 
                       if (isGenerating || isProcessingUpload) return;
                       e.stopPropagation();
                       setActiveSlot('style');
                       fileInputRefStyle.current?.click();
                   }} 
                   onDragOver={(e) => handleSlotDragOver(e, 'style')}
                   onDragLeave={(e) => handleSlotDragLeave(e, 'style')}
                   onDrop={(e) => handleSlotDrop(e, 'style')}
                   className={`h-36 md:h-44 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all overflow-hidden relative active:scale-[0.98] outline-none
                      ${isGenerating || isProcessingUpload ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} 
                      ${activeSlot === 'style' ? 'ring-2 ring-pink-500 border-pink-500' : ''}
                      ${isDragOverStyle ? 'border-pink-500 bg-pink-500/10' : (type === CreationType.MIMIC ? 'border-slate-300 dark:border-white/10' : 'border-slate-300 dark:border-white/10 group-hover/upload-style:border-pink-500/50 bg-slate-50 dark:bg-black/20 hover:bg-slate-100 dark:hover:bg-black/30')}
                   `}
                 >
                   {stylePreview ? (
                     <div className="w-full h-full p-2 flex flex-col items-center justify-center bg-slate-200/50 dark:bg-black/40 rounded-xl pointer-events-none">
                         <img src={stylePreview} className="w-full h-full object-contain drop-shadow-sm" alt="Preview 2" />
                         {styleType === 'video' &&
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px] rounded-xl">
                               <svg className="w-8 h-8 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" /></svg>
                            </div>
                         }
                     </div>
                   ) : (
                       <div className="text-center group-hover/upload-style:scale-105 transition-transform duration-300">
                          <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover/upload-style:text-pink-500 group-hover/upload-style:bg-white transition-colors">
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          </div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover/upload-style:text-pink-400 transition-colors">Estilo</p>
                          <p className="text-[8px] text-slate-400 mt-1 opacity-70">{getSlot2Accept().includes('video') ? 'MP4, PNG, JPG' : 'PNG, JPG'}</p>
                       </div>
                   )}
                   <input 
                      ref={fileInputRefStyle} 
                      type="file" 
                      accept={getSlot2Accept()} 
                      onChange={(e) => handleFileChange(e, 'style')} 
                      className="hidden" 
                   />
                 </div>
               </div>
              )}
            </div>

            {/* Slot 3: Reference (Full Width below Subject/Style) */}
            {shouldShowReference && (
              <div className="relative group/upload-ref">
                 <div className="flex justify-between items-center px-1 mb-2">
                    <div className="flex items-center gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-200 uppercase tracking-widest flex items-center gap-1">
                            REFERÊNCIA
                        </label>
                        <span className="text-[9px] text-slate-400 block leading-none mt-0.5">Criativo modelo (opcional)</span>
                      </div>
                      
                      {/* Add Reference Button */}
                      <button 
                          onClick={() => fileInputRefExtra.current?.click()}
                          disabled={extraRefs.length >= 4 || isGenerating || isProcessingUpload}
                          className="w-5 h-5 rounded-full bg-slate-200 dark:bg-white/10 hover:bg-indigo-500 dark:hover:bg-indigo-500 hover:text-white flex items-center justify-center text-slate-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm border border-transparent hover:border-indigo-400 ml-2"
                          title="Adicionar outra referência"
                      >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                      </button>
                    </div>
                    
                    {referencePreview && !isGenerating && !isProcessingUpload && <button onClick={() => { setReferencePreview(null); setReferenceId(null); setReferenceType('image'); }} className="text-slate-400 hover:text-red-400 font-bold px-2">✕</button>}
                 </div>

                 {/* Main Reference Slot */}
                 <div 
                   tabIndex={0}
                   onClick={(e) => {
                       if (isGenerating || isProcessingUpload) return;
                       e.stopPropagation();
                       setActiveSlot('reference');
                       if (!referencePreview) fileInputRefReference.current?.click();
                   }} 
                   onDragOver={(e) => handleSlotDragOver(e, 'reference')}
                   onDragLeave={(e) => handleSlotDragLeave(e, 'reference')}
                   onDrop={(e) => handleSlotDrop(e, 'reference')}
                   className={`h-24 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all overflow-hidden relative active:scale-[0.98] outline-none
                      ${isGenerating || isProcessingUpload ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} 
                      ${activeSlot === 'reference' ? 'ring-2 ring-cyan-500 border-cyan-500' : ''}
                      ${isDragOverReference ? 'border-cyan-500 bg-cyan-500/10' : 'border-slate-300 dark:border-white/10 group-hover/upload-ref:border-cyan-500/50 bg-slate-50 dark:bg-black/20 hover:bg-slate-100 dark:hover:bg-black/30'}
                   `}
                 >
                   {referencePreview ? (
                     <div className="w-full h-full flex items-center gap-4 px-4 bg-slate-200/50 dark:bg-black/40 rounded-xl">
                         {/* Thumbnail */}
                         <div className="h-20 py-2 shrink-0 cursor-pointer" onClick={() => fileInputRefReference.current?.click()}>
                            <img src={referencePreview} className="h-full object-contain drop-shadow-sm rounded-md" alt="Reference Preview" />
                         </div>
                         
                         {/* Function Selector */}
                         <div className="flex-1 flex flex-col justify-center no-drag" onClick={(e) => e.stopPropagation()}>
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Usar como:</label>
                            <select 
                                value={referenceRole}
                                onChange={(e) => setReferenceRole(e.target.value as ReferenceRole)}
                                className="w-full bg-slate-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-cyan-500 cursor-pointer"
                            >
                                <option value={ReferenceRole.FREE}>Geral</option>
                                <option value={ReferenceRole.STYLE}>Estilo visual</option>
                                <option value={ReferenceRole.PALETTE}>Paleta de cores</option>
                                <option value={ReferenceRole.BACKGROUND}>Fundo / cenário</option>
                                <option value={ReferenceRole.COMPOSITION}>Composição / layout</option>
                            </select>
                         </div>
                     </div>
                   ) : (
                       <div className="flex items-center gap-3 opacity-70 group-hover/upload-ref:opacity-100 transition-opacity">
                          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover/upload-ref:text-cyan-500 group-hover/upload-ref:bg-white transition-colors">
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          </div>
                          <div className="text-left">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover/upload-ref:text-cyan-400 transition-colors">Adicionar Modelo</p>
                            <p className="text-[8px] text-slate-400 opacity-70">PNG, JPG</p>
                          </div>
                       </div>
                   )}
                   <input 
                      ref={fileInputRefReference} 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => handleFileChange(e, 'reference')} 
                      className="hidden" 
                   />
                 </div>

                 {/* Extra References List */}
                 {extraRefs.length > 0 && (
                    <div className="mt-2 space-y-2 animate-in slide-in-from-top-2">
                        {extraRefs.map((ref) => (
                            <div key={ref.id} className="relative w-full h-16 flex items-center gap-3 px-3 bg-slate-100 dark:bg-black/30 rounded-xl border border-slate-200 dark:border-white/5 hover:border-indigo-500/30 transition-colors group/extra">
                                <div className="h-12 w-12 shrink-0 rounded-lg overflow-hidden bg-black/50 border border-white/5">
                                    <img src={ref.preview} className="w-full h-full object-cover" alt="Extra Ref" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <select 
                                        value={ref.role}
                                        onChange={(e) => updateExtraRef(ref.id, { role: e.target.value as ReferenceRole })}
                                        className="w-full bg-transparent text-xs text-slate-700 dark:text-slate-300 font-medium outline-none cursor-pointer hover:text-indigo-400 transition-colors"
                                    >
                                        <option value={ReferenceRole.FREE} className="bg-slate-900 text-white">Geral</option>
                                        <option value={ReferenceRole.STYLE} className="bg-slate-900 text-white">Estilo visual</option>
                                        <option value={ReferenceRole.PALETTE} className="bg-slate-900 text-white">Paleta de cores</option>
                                        <option value={ReferenceRole.BACKGROUND} className="bg-slate-900 text-white">Fundo / cenário</option>
                                        <option value={ReferenceRole.COMPOSITION} className="bg-slate-900 text-white">Composição / layout</option>
                                    </select>
                                    <div className="h-[1px] w-full bg-slate-300 dark:bg-white/10 mt-0.5"></div>
                                </div>
                                <button 
                                    onClick={() => removeExtraRef(ref.id)}
                                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                    title="Remover"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        ))}
                    </div>
                 )}

                 {/* Hidden Input for Extra Refs */}
                 <input 
                    ref={fileInputRefExtra} 
                    type="file" 
                    accept="image/*" 
                    onChange={handleExtraFileChange} 
                    className="hidden" 
                 />
              </div>
            )}
          </div>

          {/* Generate Button */}
          <div className="mt-6">
              <button 
                  onClick={handleGenerate}
                  disabled={isGenerating || isProcessingUpload}
                  className={`
                    w-full py-4 rounded-xl font-bold text-sm transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3
                    ${isGenerating 
                        ? 'bg-slate-800 text-slate-400 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-[length:200%_auto] hover:bg-[position:right_center] text-white hover:shadow-indigo-500/30'
                    }
                  `}
              >
                  {isGenerating ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        <span>{loadingStep || 'Processando...'}</span>
                      </>
                  ) : (
                      <span>
                          {isVideoMode ? 'Gerar Vídeo' : 'Gerar Criativo'} ({cost} créditos)
                      </span>
                  )}
              </button>
          </div>

        </div>
      </div>

      {/* EXPANDED PROMPT EDITOR MODAL (PORTAL) */}
      {isPromptModalOpen && createPortal(
          <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div 
                  className="w-full max-w-4xl h-[85vh] bg-slate-900 border border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
                  onClick={(e) => e.stopPropagation()}
              >
                  {/* Header */}
                  <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-slate-950/50">
                      <div className="flex items-center gap-3">
                          <div className="p-2 bg-indigo-500/10 rounded-lg">
                             <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </div>
                          <div>
                              <h3 className="text-lg font-bold text-white leading-tight">Editor de Prompt</h3>
                              <p className="text-xs text-slate-400">Expanda sua criatividade com mais espaço.</p>
                          </div>
                      </div>
                      <button 
                          onClick={() => setIsPromptModalOpen(false)}
                          className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"
                      >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                  </div>

                  {/* Body */}
                  <div className="flex-1 p-6 bg-black/20 relative">
                      <textarea
                          autoFocus
                          value={tempPrompt}
                          onChange={(e) => setTempPrompt(e.target.value)}
                          placeholder="Digite seu prompt detalhado aqui..."
                          className="w-full h-full bg-transparent text-slate-200 text-lg leading-relaxed font-medium outline-none resize-none placeholder-slate-600 scrollbar-hide"
                          spellCheck={false}
                      />
                  </div>

                  {/* Footer */}
                  <div className="px-6 py-4 border-t border-white/5 bg-slate-950/50 flex items-center justify-between">
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                          {tempPrompt.length} Caracteres
                      </div>
                      <div className="flex items-center gap-3">
                          <button 
                              onClick={copyFromModal}
                              className="px-4 py-2.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
                          >
                              Copiar Texto
                          </button>
                          <button 
                              onClick={() => setIsPromptModalOpen(false)}
                              className="px-6 py-2.5 text-slate-300 hover:text-white hover:bg-white/5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors border border-transparent hover:border-white/10"
                          >
                              Cancelar
                          </button>
                          <button 
                              onClick={savePromptModal}
                              className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
                          >
                              Salvar Alterações
                          </button>
                      </div>
                  </div>
              </div>
          </div>,
          document.body
      )}

    </ErrorBoundary>
  );
};

export default CreationBlock;
