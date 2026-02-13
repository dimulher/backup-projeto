
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, CreationItem, Folder, User, PurchaseHistory, CreationType, AspectRatio, Quality, EditorBlockInstance, EditorBlockData, ReferenceRole, Connection, LibraryItem } from './types';
import Layout from './components/Layout';
import CreationBlock from './components/CreationBlock';
import GalleryScreen from './components/GalleryScreen';
import CreditScreen from './components/CreditScreen';
import LoginScreen from './components/LoginScreen';
import DraggableResult from './components/DraggableResult';
import FullscreenViewer from './components/FullscreenViewer';
import PromptLibrary from './components/PromptLibrary';
import CarouselGenerator from './components/CarouselGenerator';
import LibraryScreen from './components/LibraryScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { fileStorage } from './services/geminiService';
import { FEATURE_FLAGS } from './constants';
import { onAuthStateChange, getCurrentUser, signOut as supabaseSignOut } from './services/authService';
import { getUserCredits, subscribeToCredits, createUserIfNotExists } from './services/creditsService';
import { getUserGenerations } from './services/generationsService';
import type { User as SupabaseUser } from '@supabase/supabase-js';

// Safe checking for NaN/Infinity to prevent layout engine crashes
const safeValue = (val: number, fallback: number) => {
  if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) return fallback;
  return val;
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [currentView, setCurrentView] = useState<View>(View.EDITOR);
  const [credits, setCredits] = useState(150);
  const creditsRef = useRef(150);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const [items, setItems] = useState<CreationItem[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistory[]>([]);
  const [presets, setPresets] = useState<any[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [apiKeySelected, setApiKeySelected] = useState<boolean | null>(null);
  const [isZoomExpanded, setIsZoomExpanded] = useState(true);
  const [viewingItem, setViewingItem] = useState<CreationItem | null>(null);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  // --- LAYERS PANEL STATE ---
  const [isLayersPanelExpanded, setIsLayersPanelExpanded] = useState(true);
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [layerSearch, setLayerSearch] = useState('');

  // Global Canvas State - Protected
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [isDragOverCanvas, setIsDragOverCanvas] = useState(false);

  // Refs for Event Handling & Throttling
  const panStart = useRef<{ x: number; y: number; transformX: number; transformY: number } | null>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null); // Request Animation Frame ref

  const [editorBlocks, setEditorBlocks] = useState<EditorBlockInstance[]>([]);
  const [editorHistoryIds, setEditorHistoryIds] = useState<string[]>([]);

  // --- ERROR MONITORING ---
  useEffect(() => {
    const errorHandler = (event: ErrorEvent) => {
      console.error("Global Error Caught:", event.error);
    };
    const rejectionHandler = (event: PromiseRejectionEvent) => {
      console.error("Unhandled Promise Rejection:", event.reason);
    };

    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', rejectionHandler);
    return () => {
      window.removeEventListener('error', errorHandler);
      window.removeEventListener('unhandledrejection', rejectionHandler);
    };
  }, []);

  // Sync ref
  useEffect(() => {
    creditsRef.current = credits;
  }, [credits]);

  // --- SUPABASE AUTHENTICATION ---
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let creditsUnsubscribe: (() => void) | null = null;

    const initAuth = async () => {
      // Verificar usuário atual
      const currentUser = await getCurrentUser();

      if (currentUser) {
        setSupabaseUser(currentUser);
        setUser({
          email: currentUser.email || '',
          name: currentUser.user_metadata?.full_name,
          credits: 0
        });

        // Criar usuário no banco se não existir
        await createUserIfNotExists(currentUser.id, currentUser.email || '');

        // Buscar créditos do banco
        const userCredits = await getUserCredits(currentUser.id);
        setCredits(userCredits);
        creditsRef.current = userCredits;

        // Subscribe para mudanças em tempo real nos créditos
        creditsUnsubscribe = subscribeToCredits(currentUser.id, (newCredits) => {
          console.log('💰 Créditos atualizados em tempo real:', newCredits);
          setCredits(newCredits);
          creditsRef.current = newCredits;
        });

        // BUSCAR GERAÇÕES DO BANCO
        try {
          const gens = await getUserGenerations(currentUser.id);
          const mappedGens: CreationItem[] = gens.map(g => {
            const meta = g.metadata || {};
            return {
              id: g.id, // UUID do banco
              type: (g.type as CreationType) || CreationType.IMAGE,
              url: g.image_url || '',
              prompt: g.prompt,
              createdAt: new Date(g.created_at).getTime(),
              aspectRatio: meta.aspectRatio || AspectRatio.SQUARE,
              quality: meta.quality || Quality.K1,
              savedToGallery: true,
              tags: meta.tags || [],
              folderId: meta.folderId,
            } as CreationItem;
          });

          // Filtrar apenas os que tem URL válida
          const validGens = mappedGens.filter(i => i.url && i.url.length > 5);

          setItems(prev => {
            // Merge evitando duplicatas de URL se possível, ou apenas adicionar
            // Prioridade para o banco
            const prevUrls = new Set(prev.map(p => p.url));
            const newItems = validGens.filter(g => !prevUrls.has(g.url));
            return [...newItems, ...prev];
          });
        } catch (error) {
          console.error("Erro ao buscar gerações:", error);
        }

      }

      setIsAuthLoading(false);

      // Listener de mudanças de autenticação
      unsubscribe = onAuthStateChange(async (user) => {
        setSupabaseUser(user);

        if (user) {
          setUser({
            email: user.email || '',
            name: user.user_metadata?.full_name,
            credits: 0
          });

          // Criar usuário no banco se não existir
          await createUserIfNotExists(user.id, user.email || '');

          // Buscar créditos
          const userCredits = await getUserCredits(user.id);
          setCredits(userCredits);
          creditsRef.current = userCredits;

          // BUSCAR GERAÇÕES DO BANCO (Repetido para login)
          try {
            const gens = await getUserGenerations(user.id);
            const mappedGens: CreationItem[] = gens.map(g => {
              const meta = g.metadata || {};
              return {
                id: g.id, // UUID do banco
                type: (g.type as CreationType) || CreationType.IMAGE,
                url: g.image_url || '',
                prompt: g.prompt,
                createdAt: new Date(g.created_at).getTime(),
                aspectRatio: meta.aspectRatio || AspectRatio.SQUARE,
                quality: meta.quality || Quality.K1,
                savedToGallery: true,
                tags: meta.tags || [],
                folderId: meta.folderId,
              } as CreationItem;
            });

            const validGens = mappedGens.filter(i => i.url && i.url.length > 5);

            setItems(prev => {
              const prevIds = new Set(prev.map(p => p.id));
              const prevUrls = new Set(prev.map(p => p.url));

              const newItems = validGens.filter(g => {
                // Strict deduplication: Check ID first (from DB), then URL
                if (prevIds.has(g.id)) return false;
                if (prevUrls.has(g.url)) return false;
                return true;
              });

              if (newItems.length === 0) return prev;
              return [...newItems, ...prev];
            });
          } catch (error) {
            console.error("Erro ao buscar gerações no login:", error);
          }

          // Subscribe créditos
          if (creditsUnsubscribe) creditsUnsubscribe();
          creditsUnsubscribe = subscribeToCredits(user.id, (newCredits) => {
            setCredits(newCredits);
            creditsRef.current = newCredits;
          });
        } else {
          setUser(null);
          setCredits(0);
          creditsRef.current = 0;
          setItems([]); // Limpar itens ao deslogar
          setEditorBlocks([]); // Limpar blocos
          setActiveLayerId(null); // Limpar layer ativa
          setEditorHistoryIds([]); // Limpar histórico
          setFolders([]); // Limpar pastas
          setPurchaseHistory([]); // Limpar histórico de compras
          setPresets([]); // Limpar presets
          if (creditsUnsubscribe) creditsUnsubscribe();
        }
      });
    };

    initAuth();

    return () => {
      if (unsubscribe) unsubscribe();
      if (creditsUnsubscribe) creditsUnsubscribe();
    };
  }, []);

  // --- FEATURE FLAG PROTECTION ---
  useEffect(() => {
    // If the user lands on a disabled view (e.g. Carousel), redirect to Editor
    if (currentView === View.CAROUSEL && !FEATURE_FLAGS.CAROUSEL) {
      console.warn("Feature disabled: Redirecting to Editor");
      setCurrentView(View.EDITOR);
    }
  }, [currentView]);

  // --- HYDRATION HELPER ---
  const hydrateState = async (
    rawItems: CreationItem[],
    rawBlocks: EditorBlockInstance[]
  ): Promise<{ items: CreationItem[], blocks: EditorBlockInstance[] }> => {

    const hydratedItems = await Promise.all(rawItems.map(async (item) => {
      if (item.assetId && (!item.url || !item.url.startsWith('blob:'))) {
        const url = await fileStorage.getAssetUrl(item.assetId);
        if (url) return { ...item, url };
      }
      return item;
    }));

    const hydratedBlocks = await Promise.all(rawBlocks.map(async (block) => {
      const newData = { ...block.data };
      let changed = false;

      if (newData.refMainAssetId && (!newData.refMain || !newData.refMain.startsWith('blob:'))) {
        const url = await fileStorage.getAssetUrl(newData.refMainAssetId);
        if (url) { newData.refMain = url; changed = true; }
      }

      if (newData.refStyleAssetId && (!newData.refStyle || !newData.refStyle.startsWith('blob:'))) {
        const url = await fileStorage.getAssetUrl(newData.refStyleAssetId);
        if (url) { newData.refStyle = url; changed = true; }
      }

      if (newData.refReferenceAssetId && (!newData.refReference || !newData.refReference.startsWith('blob:'))) {
        const url = await fileStorage.getAssetUrl(newData.refReferenceAssetId);
        if (url) { newData.refReference = url; changed = true; }
      }

      if (newData.lastGeneratedAssetId && (!newData.lastGeneratedUrl || !newData.lastGeneratedUrl.startsWith('blob:'))) {
        const url = await fileStorage.getAssetUrl(newData.lastGeneratedAssetId);
        if (url) { newData.lastGeneratedUrl = url; changed = true; }
      }

      return changed ? { ...block, data: newData } : block;
    }));

    return { items: hydratedItems, blocks: hydratedBlocks };
  };

  // --- DEHYDRATION HELPER (PERSISTENCE) ---
  const persistState = async (
    currentItems: CreationItem[],
    currentBlocks: EditorBlockInstance[]
  ): Promise<{ items: CreationItem[], blocks: EditorBlockInstance[] }> => {

    const persistedItems = await Promise.all(currentItems.map(async (item) => {
      if (!item.assetId && item.url && (item.url.startsWith('data:') || item.url.startsWith('blob:'))) {
        try {
          let blob: Blob;
          if (item.url.startsWith('blob:')) {
            const r = await fetch(item.url);
            blob = await r.blob();
          } else {
            blob = await (await fetch(item.url)).blob();
          }
          const newAssetId = await fileStorage.saveAsset(blob);
          return { ...item, assetId: newAssetId, url: '' };
        } catch (e) {
          console.warn("Failed to persist item asset", e);
          return item;
        }
      }
      if (item.assetId) {
        return { ...item, url: '' };
      }
      return item;
    }));

    const persistedBlocks = await Promise.all(currentBlocks.map(async (block) => {
      const newData = { ...block.data };
      let changed = false;

      const processField = async (field: 'refMain' | 'refStyle' | 'refReference' | 'lastGeneratedUrl', idField: 'refMainAssetId' | 'refStyleAssetId' | 'refReferenceAssetId' | 'lastGeneratedAssetId') => {
        if (!newData[idField] && newData[field] && (newData[field]?.startsWith('data:') || newData[field]?.startsWith('blob:'))) {
          try {
            let blob: Blob;
            if (newData[field]!.startsWith('blob:')) {
              const r = await fetch(newData[field]!);
              blob = await r.blob();
            } else {
              blob = await (await fetch(newData[field]!)).blob();
            }
            const newId = await fileStorage.saveAsset(blob);
            newData[idField] = newId;
            newData[field] = '';
            changed = true;
          } catch (e) {
            console.warn(`Failed to persist block asset ${field}`, e);
          }
        } else if (newData[idField]) {
          newData[field] = '';
          changed = true;
        }
      };

      await processField('refMain', 'refMainAssetId');
      await processField('refStyle', 'refStyleAssetId');
      await processField('refReference', 'refReferenceAssetId');
      await processField('lastGeneratedUrl', 'lastGeneratedAssetId');

      return changed ? { ...block, data: newData } : block;
    }));

    return { items: persistedItems, blocks: persistedBlocks };
  };

  // Load Data
  useEffect(() => {
    const checkApiKey = async () => {
      if ((window as any).aistudio) {
        try {
          const hasKey = await (window as any).aistudio.hasSelectedApiKey();
          setApiKeySelected(hasKey);
        } catch (e) {
          console.warn("AI Studio bridge error", e);
          setApiKeySelected(true);
        }
      } else {
        setApiKeySelected(true);
      }
    };
    checkApiKey();

    const loadData = async () => {
      try {
        const savedUser = localStorage.getItem('creativeflow_user');
        const savedItems = localStorage.getItem('creativeflow_items');
        const savedCredits = localStorage.getItem('creativeflow_credits');
        const savedFolders = localStorage.getItem('creativeflow_folders');
        const savedHistory = localStorage.getItem('creativeflow_history');
        const savedPresets = localStorage.getItem('creativeflow_presets');
        const savedTheme = localStorage.getItem('creativeflow_theme');
        const savedEditorHistory = localStorage.getItem('creativeflow_editor_history');
        const savedEditorBlocks = localStorage.getItem('creativeflow_editor_blocks');
        const savedLayersExpanded = localStorage.getItem('creativeflow_layers_expanded');

        if (savedUser) setUser(JSON.parse(savedUser));
        if (savedCredits) {
          const parsedCredits = parseInt(savedCredits);
          setCredits(safeValue(parsedCredits, 150));
          creditsRef.current = safeValue(parsedCredits, 150);
        }
        if (savedFolders) setFolders(JSON.parse(savedFolders));
        if (savedHistory) setPurchaseHistory(JSON.parse(savedHistory));
        if (savedPresets) setPresets(JSON.parse(savedPresets));
        if (savedTheme) setTheme(savedTheme as 'light' | 'dark');
        if (savedEditorHistory) setEditorHistoryIds(JSON.parse(savedEditorHistory));
        if (savedLayersExpanded !== null) setIsLayersPanelExpanded(savedLayersExpanded === 'true');

        let rawItems = savedItems ? JSON.parse(savedItems) : [];
        let rawBlocks = savedEditorBlocks ? JSON.parse(savedEditorBlocks) : [];

        const { items: loadedItems, blocks: loadedBlocks } = await hydrateState(rawItems, rawBlocks);

        setItems(loadedItems);

        if (loadedBlocks.length > 0) {
          setEditorBlocks(loadedBlocks.map((b: any) => ({
            ...b,
            position: { x: safeValue(b.position?.x, 0), y: safeValue(b.position?.y, 0) }
          })));
          setActiveLayerId(loadedBlocks[0].id);
        } else {
          const initId = 'block-init';
          setEditorBlocks([{
            id: initId,
            name: 'Bloco Inicial',
            position: { x: window.innerWidth / 2 - 200, y: 300 },
            data: {
              type: CreationType.IMAGE,
              prompt: '',
              aspectRatio: AspectRatio.SQUARE,
              quality: Quality.K1
            },
            createdAt: Date.now(),
            updatedAt: Date.now()
          }]);
          setActiveLayerId(initId);
        }

        setIsHydrated(true);

      } catch (e) {
        console.error("Error loading state from localstorage", e);
        setIsHydrated(true);
      }
    };
    loadData();
  }, []);

  // Save Data
  useEffect(() => {
    if (!isHydrated) return;

    const saveTimeout = setTimeout(async () => {
      try {
        localStorage.setItem('creativeflow_user', JSON.stringify(user));
        localStorage.setItem('creativeflow_credits', credits.toString());
        localStorage.setItem('creativeflow_folders', JSON.stringify(folders));
        localStorage.setItem('creativeflow_history', JSON.stringify(purchaseHistory));
        localStorage.setItem('creativeflow_presets', JSON.stringify(presets));
        localStorage.setItem('creativeflow_theme', theme);

        const safeHistory = editorHistoryIds.slice(0, 50);
        localStorage.setItem('creativeflow_editor_history', JSON.stringify(safeHistory));
        localStorage.setItem('creativeflow_layers_expanded', String(isLayersPanelExpanded));

        const { items: safeItems, blocks: safeBlocks } = await persistState(items, editorBlocks);
        const recentItems = safeItems.slice(0, 50);

        try {
          localStorage.setItem('creativeflow_items', JSON.stringify(recentItems));
          localStorage.setItem('creativeflow_editor_blocks', JSON.stringify(safeBlocks));
        } catch (storageError: any) {
          if (storageError.name === 'QuotaExceededError' || storageError.code === 22) {
            console.warn("LocalStorage Full! Trimming history...");
            localStorage.setItem('creativeflow_items', JSON.stringify(recentItems.slice(0, 10)));
          } else {
            console.error("Storage Error:", storageError);
          }
        }

      } catch (e) {
        console.error("LocalStorage General Failure:", e);
      }
    }, 2000);

    return () => clearTimeout(saveTimeout);
  }, [user, items, credits, folders, purchaseHistory, presets, theme, editorHistoryIds, editorBlocks, isLayersPanelExpanded, isHydrated]);

  const handleLogin = useCallback((email: string, name?: string) => {
    // Este callback é mantido para compatibilidade, mas a autent icação real vem do Supabase
    setUser({ email, name, credits: 150 });
  }, []);

  const handleSignOut = useCallback(async () => {
    await supabaseSignOut();
    setUser(null);
    setSupabaseUser(null);
    setCredits(0);
  }, []);

  const toggleTheme = useCallback(() => setTheme(prev => prev === 'dark' ? 'light' : 'dark'), []);

  const handleOpenApiKeyDialog = useCallback(async () => {
    if ((window as any).aistudio) {
      await (window as any).aistudio.openSelectKey();
      setApiKeySelected(true);
    }
  }, []);

  const deductCredits = useCallback((amount: number) => {
    if (creditsRef.current >= amount) {
      creditsRef.current -= amount;
      setCredits(prev => prev - amount);
      return true;
    }
    return false;
  }, []);

  const addCredits = useCallback((amount: number, planName: string, price: number) => {
    setCredits(prev => prev + amount);
    setPurchaseHistory(prev => [
      { id: Date.now().toString(), date: Date.now(), plan: planName, amount: price },
      ...prev
    ]);
  }, []);

  const handleSaveAuxiliaryCreation = useCallback((type: CreationType, content: string) => {
    const newItemId = Date.now().toString();
    const isUrl = content.startsWith('http') || content.startsWith('data:') || content.startsWith('blob:');

    const newItem: CreationItem = {
      id: newItemId,
      type,
      url: isUrl ? content : '',
      prompt: isUrl ? 'Imagem Carrossel' : content,
      createdAt: Date.now(),
      aspectRatio: AspectRatio.SQUARE,
      savedToGallery: true
    };
    setItems(prev => [newItem, ...prev]);
  }, []);

  const handleManualUpload = useCallback(async (file: File) => {
    try {
      const newItemId = `upload_${Date.now()}`;
      const assetId = await fileStorage.saveAsset(file);
      const blobUrl = URL.createObjectURL(file);
      const newItem: CreationItem = {
        id: newItemId,
        type: CreationType.IMAGE,
        url: blobUrl,
        assetId: assetId,
        prompt: `Upload: ${file.name}`,
        createdAt: Date.now(),
        aspectRatio: AspectRatio.SQUARE,
        quality: Quality.K1,
        position: { x: 0, y: 0 },
        savedToGallery: true
      };

      setItems(prev => [newItem, ...prev]);
      return newItem;
    } catch (e) {
      console.error("Manual upload failed", e);
      alert("Não foi possível enviar a imagem. Tente novamente.");
      return null;
    }
  }, []);

  // --- LIBRARY USAGE HANDLER ---
  const handleUseLibraryItem = useCallback(async (item: LibraryItem, mode: 'MODEL' | 'REFERENCE') => {
    // 1. Fetch image and convert to blob to avoid CORS issues later if using external URL directly in canvas sometimes
    // For now we assume the URL is usable. We'll store it as a new asset.
    let finalUrl = item.url;
    try {
      // If it's an external URL, fetch and store to avoid issues
      if (item.url.startsWith('http')) {
        const resp = await fetch(item.url);
        const blob = await resp.blob();
        const assetId = await fileStorage.saveAsset(blob);
        const blobUrl = await fileStorage.getAssetUrl(assetId);
        if (blobUrl) finalUrl = blobUrl;
      }
    } catch (e) {
      console.warn("Could not cache library item locally, using direct URL", e);
    }

    setEditorBlocks(prev => {
      const lastBlock = prev[prev.length - 1];
      const newX = lastBlock ? lastBlock.position.x + 450 : 200;
      const newY = lastBlock ? lastBlock.position.y : 300;
      const newId = `block-${Date.now()}`;

      // Define Block Data based on Mode
      const blockData: EditorBlockData = {
        type: mode === 'MODEL' ? CreationType.CREATIVE_MODEL : CreationType.IMAGE,
        prompt: item.promptSuggestion || '',
        aspectRatio: AspectRatio.SQUARE,
        quality: Quality.K1,
        // If MODEL mode, use as Style Ref (Slot 2)
        refStyle: mode === 'MODEL' ? finalUrl : undefined,
        refStyleType: 'image',
        // If REFERENCE mode, use as Reference (Slot 3)
        refReference: mode === 'REFERENCE' ? finalUrl : undefined,
        refReferenceType: 'image',
        refReferenceRole: ReferenceRole.COMPOSITION // Default role for simple reference usage
      };

      const newBlock = {
        id: newId,
        name: `Criativo: ${item.title}`,
        position: { x: safeValue(newX, 200), y: safeValue(newY, 300) },
        data: blockData,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      setActiveLayerId(newId);
      setIsLayersPanelExpanded(true);

      // Switch view
      setCurrentView(View.EDITOR);

      // Center view on new block
      setTimeout(() => scrollToBlock(newId), 100);

      return [...prev, newBlock];
    });
  }, []); // Dependencies will be added implicitly or keep empty if stable

  // --- ZOOM & PAN LOGIC ---

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (rafRef.current) return;

    rafRef.current = requestAnimationFrame(() => {
      const scaleAmount = -e.deltaY * 0.001;
      setTransform(prev => {
        const rawScale = prev.scale + scaleAmount;
        const newScale = Math.min(Math.max(rawScale, 0.4), 2.0);
        if (isNaN(newScale) || !isFinite(newScale)) return prev;
        return { ...prev, scale: newScale };
      });
      rafRef.current = null;
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;

    if ((e.target as HTMLElement).closest('.stop-pan')) return;

    setIsPanning(true);
    panStart.current = {
      x: e.clientX,
      y: e.clientY,
      transformX: transform.x,
      transformY: transform.y
    };
  }, [transform]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning || !panStart.current) return;

    e.preventDefault();

    if (rafRef.current) return;

    rafRef.current = requestAnimationFrame(() => {
      if (!panStart.current) { rafRef.current = null; return; }

      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;

      const nextX = panStart.current.transformX + dx;
      const nextY = panStart.current.transformY + dy;

      if (isNaN(nextX) || isNaN(nextY)) {
        rafRef.current = null;
        return;
      }

      setTransform(prev => ({
        ...prev,
        x: nextX,
        y: nextY
      }));
      rafRef.current = null;
    });
  }, [isPanning, transform]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    panStart.current = null;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // --- DRAG & DROP ON CANVAS (UPLOAD) ---
  const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // FEATURE FLAG CHECK: Disable drag functionality if flag is false
    if (!FEATURE_FLAGS.DRAG_DROP_ENABLED) return;

    if (!isDragOverCanvas) setIsDragOverCanvas(true);
  }, [isDragOverCanvas]);

  const handleCanvasDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // FEATURE FLAG CHECK: Disable drag functionality if flag is false
    if (!FEATURE_FLAGS.DRAG_DROP_ENABLED) return;

    if (e.currentTarget === e.target) {
      setIsDragOverCanvas(false);
    }
  }, []);

  const handleCanvasDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // FEATURE FLAG CHECK: Disable drag functionality if flag is false
    if (!FEATURE_FLAGS.DRAG_DROP_ENABLED) return;

    setIsDragOverCanvas(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files: File[] = Array.from(e.dataTransfer.files);

      const imageFiles = files.filter(f => f.type.startsWith('image/'));

      if (imageFiles.length === 0) {
        alert("Formato não suportado. Envie PNG, JPG ou WEBP.");
        return;
      }

      const newIds: string[] = [];
      const worldX = (e.clientX - transform.x) / transform.scale;
      const worldY = (e.clientY - transform.y) / transform.scale;

      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const newItem = await handleManualUpload(file);

        if (newItem) {
          newItem.position = { x: worldX + (i * 20), y: worldY + (i * 20) };
          setItems(prev => prev.map(item => item.id === newItem.id ? newItem : item));
          newIds.push(newItem.id);
        }
      }

      if (newIds.length > 0) {
        setEditorHistoryIds(prev => [...newIds, ...prev]);
      }
    }
  }, [transform, handleManualUpload]);


  // --- Block & Item Management ---

  const onGenerated = useCallback(async (type: CreationType, url: string, prompt: string, details: any, blockId: string, dbId?: string) => {
    const newItemId = dbId || Date.now().toString();

    let assetId = '';
    let displayUrl = url;

    // FORCE LOCAL BLOB STORAGE for all generations to enable direct downloads
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      assetId = await fileStorage.saveAsset(blob);
      const storedUrl = await fileStorage.getAssetUrl(assetId);
      if (storedUrl) displayUrl = storedUrl;
    } catch (e) {
      console.error("Failed to save generated asset immediately", e);
      // Fallback to original URL if fetch fails
    }

    setEditorBlocks(prev => {
      const block = prev.find(b => b.id === blockId);
      if (!block) return prev;

      return prev.map(b => b.id === blockId ? {
        ...b,
        data: {
          ...b.data,
          lastGeneratedUrl: displayUrl,
          lastGeneratedAssetId: assetId || undefined
        }
      } : b);
    });

    const newItem: CreationItem = {
      id: newItemId,
      type,
      url: displayUrl,
      assetId: assetId || undefined,
      prompt,
      createdAt: Date.now(),
      aspectRatio: details.aspectRatio,
      quality: details.quality,
      position: { x: 0, y: 0 },
      savedToGallery: true
    };

    setItems(itemsPrev => {
      const block = editorBlocks.find(b => b.id === blockId);
      const isDesktop = window.innerWidth >= 1024;

      // Default Position (Right of block)
      let refX = block ? block.position.x : 0;
      let refY = block ? block.position.y : 0;

      let candidateX = isDesktop ? refX + 440 : refX;
      let candidateY = isDesktop ? refY : refY + 650;

      // Collision Detection: Shift right until we find a spot not occupied by another result
      // We check if any existing item is within a small threshold of the candidate position
      const collisionThreshold = 50;
      let collision = true;
      let attempts = 0;

      while (collision && attempts < 10) {
        collision = itemsPrev.some(item =>
          Math.abs((item.position?.x || 0) - candidateX) < collisionThreshold &&
          Math.abs((item.position?.y || 0) - candidateY) < collisionThreshold
        );

        if (collision) {
          candidateX += 340; // Shift right by width of result card + gap
          attempts++;
        }
      }

      newItem.position = {
        x: candidateX,
        y: candidateY
      };
      return [newItem, ...itemsPrev];
    });

    setEditorHistoryIds(historyPrev => [newItemId, ...historyPrev]);
  }, [editorBlocks]);

  const updateBlockData = useCallback(async (id: string, data: Partial<EditorBlockData>) => {
    setEditorBlocks(prev => prev.map(block =>
      block.id === id ? { ...block, data: { ...block.data, ...data }, updatedAt: Date.now() } : block
    ));
  }, []);

  const duplicateBlock = useCallback((id: string) => {
    setEditorBlocks(prev => {
      const source = prev.find(b => b.id === id);
      if (!source) return prev;

      const newId = `block-${Date.now()}`;
      const newBlock = {
        ...source,
        id: newId,
        name: `${source.name} (Cópia)`,
        position: { x: source.position.x + 50, y: source.position.y + 50 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        data: { ...source.data }
      };

      setActiveLayerId(newId);
      return [...prev, newBlock];
    });
  }, []);

  const updateBlockPosition = useCallback((id: string, x: number, y: number) => {
    if (isNaN(x) || isNaN(y)) return;
    setEditorBlocks(prev => prev.map(b => b.id === id ? { ...b, position: { x, y } } : b));
    setActiveLayerId(id);
  }, []);

  const removeBlock = useCallback((id: string) => {
    setEditorBlocks(prev => prev.length > 1 ? prev.filter(b => b.id !== id) : prev);
    if (activeLayerId === id) setActiveLayerId(null);
  }, [activeLayerId]);

  const addNewBlock = useCallback(() => {
    setEditorBlocks(prev => {
      const lastBlock = prev[prev.length - 1];
      const newX = lastBlock ? lastBlock.position.x + 450 : 200;
      const newY = lastBlock ? lastBlock.position.y : 300;
      const newId = `block-${Date.now()}`;

      const newBlock = {
        id: newId,
        name: `Bloco ${prev.length + 1}`,
        position: { x: safeValue(newX, 200), y: safeValue(newY, 300) },
        data: {
          type: CreationType.IMAGE,
          prompt: '',
          aspectRatio: AspectRatio.SQUARE,
          quality: Quality.K1
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      setActiveLayerId(newId);
      setIsLayersPanelExpanded(true);
      return [...prev, newBlock];
    });
  }, []);

  const scrollToBlock = useCallback((blockId: string) => {
    const block = editorBlocks.find(b => b.id === blockId);
    if (block) {
      setTransform(prev => ({
        scale: prev.scale,
        x: safeValue(-block.position.x * prev.scale + window.innerWidth / 2, 0),
        y: safeValue(-block.position.y * prev.scale + window.innerHeight / 2, 0)
      }));
      setActiveLayerId(blockId);
      setIsLayersPanelExpanded(true);
    }
  }, [editorBlocks]);

  const startRenaming = useCallback((id: string, currentName: string) => {
    setEditingLayerId(id);
    setEditingName(currentName);
  }, []);

  const saveLayerName = useCallback(() => {
    if (editingLayerId) {
      const finalName = editingName.trim() || `Bloco ${Date.now().toString().slice(-4)}`;
      setEditorBlocks(prev => prev.map(b => b.id === editingLayerId ? { ...b, name: finalName } : b));
      setEditingLayerId(null);
      setEditingName('');
    }
  }, [editingLayerId, editingName]);

  const handleLayerNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveLayerName();
    if (e.key === 'Escape') {
      setEditingLayerId(null);
      setEditingName('');
    }
  };

  const updateItemPosition = useCallback((id: string, x: number, y: number) => {
    if (isNaN(x) || isNaN(y)) return;
    setItems(prev => prev.map(item => item.id === id ? { ...item, position: { x, y } } : item));
  }, []);

  const deleteItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    setEditorHistoryIds(prev => prev.filter(i => i !== id));
  }, []);

  const moveItem = useCallback((itemId: string, folderId: string) => {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, folderId: folderId || undefined } : i));
  }, []);

  // Update Tags Implementation
  const handleUpdateTags = useCallback((itemId: string, tags: string[]) => {
    setItems(prev => prev.map(item => item.id === itemId ? { ...item, tags } : item));
  }, []);

  const saveToGallery = useCallback((id: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, savedToGallery: true } : i));
  }, []);

  const addFolder = useCallback((name: string) => setFolders(prev => [...prev, { id: Date.now().toString(), name }]), []);

  const expandItem = useCallback((itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (item) setViewingItem(item);
  }, [items]);


  // --- Virtualization Logic ---
  const visibleBlocks = useMemo(() => {
    if (isNaN(transform.x) || isNaN(transform.y) || isNaN(transform.scale)) {
      return editorBlocks.slice(0, 2);
    }

    if (editorBlocks.length < 10) return editorBlocks;

    const buffer = 1500;
    const viewportLeft = -transform.x / transform.scale;
    const viewportTop = -transform.y / transform.scale;
    const viewportRight = (window.innerWidth - transform.x) / transform.scale;
    const viewportBottom = (window.innerHeight - transform.y) / transform.scale;

    return editorBlocks.filter(block => {
      const bx = block.position.x;
      const by = block.position.y;
      return (
        bx > viewportLeft - buffer &&
        bx < viewportRight + buffer &&
        by > viewportTop - buffer &&
        by < viewportBottom + buffer
      );
    });
  }, [editorBlocks, transform]);

  // --- COMPONENT MEMOS ---

  const MemoizedCreationBlocks = useMemo(() => {
    return visibleBlocks.map((block) => {
      return (
        <CreationBlock
          key={`${block.id}-${block.data.lastPromptUpdate || 0}`}
          id={block.id}
          name={block.name}
          position={block.position}
          initialData={block.data}
          onUpdate={updateBlockData}
          onDuplicate={duplicateBlock}
          credits={credits}
          deductCredits={deductCredits}
          onGenerated={(type, url, prompt, details) => onGenerated(type, url, prompt, details, block.id)}
          onPositionChange={(x, y) => updateBlockPosition(block.id, x, y)}
          onRemove={() => removeBlock(block.id)}
          onUpload={handleManualUpload}
          isSingle={editorBlocks.length === 1}
          scale={transform.scale}
        />
      );
    });
  }, [visibleBlocks, credits, deductCredits, onGenerated, presets, updateBlockPosition, removeBlock, duplicateBlock, updateBlockData, transform.scale, handleManualUpload, items]);

  const MemoizedDraggableResult = useMemo(() => {
    // Reverse the order so new items (which are added to the front of the array)
    // are rendered LAST in the DOM, appearing ON TOP of older items.
    return [...editorHistoryIds].reverse().map((id, index) => {
      const item = items.find(i => i.id === id);
      if (!item) return null;
      return (
        <DraggableResult
          key={item.id}
          item={item}
          isTop={index === editorHistoryIds.length - 1} // Newest item
          zIndex={10 + index} // Base Z-Index matching render order
          onDelete={deleteItem}
          onUpdatePosition={updateItemPosition}
          onSaveToGallery={saveToGallery}
          onExpand={expandItem}
          scale={transform.scale}
        />
      );
    });
  }, [editorHistoryIds, items, deleteItem, updateItemPosition, saveToGallery, expandItem, transform.scale]);

  // --- Render Helpers ---

  const filteredBlocks = useMemo(() => {
    if (!layerSearch.trim()) return editorBlocks;
    return editorBlocks.filter(b => b.name.toLowerCase().includes(layerSearch.toLowerCase()));
  }, [editorBlocks, layerSearch]);

  const visibleLayersList = useMemo(() => {
    if (layerSearch.trim()) return filteredBlocks;
    if (isLayersPanelExpanded) return filteredBlocks;
    const active = filteredBlocks.find(b => b.id === activeLayerId);
    return active ? [active] : [filteredBlocks[filteredBlocks.length - 1]];
  }, [isLayersPanelExpanded, filteredBlocks, activeLayerId, layerSearch]);

  const hiddenLayersCount = filteredBlocks.length - visibleLayersList.length;

  if (!user) return <LoginScreen onLogin={handleLogin} />;

  if (apiKeySelected === false) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8 text-center text-white">
        <div className="max-w-md space-y-6">
          <h1 className="text-3xl font-black">Configuração de Chave Requerida</h1>
          <button
            onClick={handleOpenApiKeyDialog}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl shadow-xl shadow-indigo-500/20 transition-all active:scale-95"
          >
            Configurar Chave de API
          </button>
        </div>
      </div>
    );
  }

  const showEditor = currentView === View.EDITOR;

  return (
    <Layout
      currentView={currentView}
      onViewChange={setCurrentView}
      credits={credits}
      theme={theme}
      toggleTheme={toggleTheme}
      onSignOut={handleSignOut}
      user={user}
    >
      {showEditor && (
        <ErrorBoundary
          onReset={() => setTransform({ x: 0, y: 0, scale: 1 })}
          fallback={undefined}
        >
          {/* Main Global Canvas */}
          <div
            ref={editorContainerRef}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            // Drag and Drop Handlers
            onDragOver={handleCanvasDragOver}
            onDragLeave={handleCanvasDragLeave}
            onDrop={handleCanvasDrop}
            style={{
              backgroundPosition: `${transform.x}px ${transform.y}px`,
              backgroundSize: `${32 * transform.scale}px ${32 * transform.scale}px`
            }}
            className={`
                relative w-full h-full overflow-hidden transition-colors duration-500 outline-none
                ${isPanning ? 'cursor-grabbing select-none' : 'cursor-grab'}
                ${isDragOverCanvas ? 'ring-4 ring-indigo-500/50 scale-[1.01]' : ''}
                ${theme === 'light'
                ? 'bg-[#F6F7FB] bg-grid-light'
                : 'bg-[#020617] bg-grid'
              }
            `}
          >
            {/* Visual Drop Hint */}
            {isDragOverCanvas && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-indigo-500/10 backdrop-blur-sm pointer-events-none animate-in fade-in duration-200">
                <div className="bg-slate-900/80 p-6 rounded-3xl border border-indigo-500/50 shadow-2xl flex flex-col items-center gap-4">
                  <svg className="w-16 h-16 text-indigo-400 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  <h3 className="text-xl font-bold text-white">Solte para Adicionar Asset</h3>
                  <p className="text-sm text-slate-300">Será adicionado à Galeria e ao canvas</p>
                </div>
              </div>
            )}

            <div
              style={{
                transform: `translate(${transform.x}px, ${transform.y}px)`,
                width: '100%',
                height: '100%',
              }}
              className="absolute top-0 left-0"
            >
              {MemoizedDraggableResult}
              {MemoizedCreationBlocks}
            </div>

            {/* Actions UI (Fixed Overlay) */}
            <div className="absolute top-8 left-8 z-40 stop-pan">
              <button
                onClick={addNewBlock}
                className="flex items-center gap-3 px-5 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-xl shadow-indigo-900/30 hover:shadow-indigo-600/50 transition-all hover:-translate-y-0.5 active:translate-y-0 border border-indigo-400/30 group"
              >
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center group-hover:bg-white/30 transition-colors">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                </div>
                <div className="flex flex-col items-start text-left">
                  <span className="font-black text-xs uppercase tracking-widest leading-none drop-shadow-sm">Novo Bloco</span>
                  <span className="text-[9px] opacity-80 font-semibold leading-tight mt-1 text-indigo-100">Adicionar ao Canvas</span>
                </div>
              </button>
            </div>

            {/* Reset View Button */}
            <div className="absolute bottom-8 left-8 z-40 stop-pan">
              <button
                onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}
                className="px-5 py-2.5 bg-slate-950/90 backdrop-blur-xl text-white text-[10px] font-bold uppercase rounded-xl border border-white/10 hover:bg-indigo-600 hover:text-white transition-all shadow-lg hover:shadow-indigo-500/20"
              >
                Resetar Visão
              </button>
            </div>

            {/* Layers Panel */}
            <div className={`absolute top-8 right-8 z-30 stop-pan flex flex-col items-end gap-0 w-72 pointer-events-none transition-all duration-300 ease-in-out ${!isLayersPanelExpanded && !layerSearch ? 'h-auto' : 'h-auto max-h-[calc(100%-8rem)]'}`}>
              <div className="pointer-events-auto w-full bg-slate-950/90 border border-slate-800 backdrop-blur-xl shadow-2xl rounded-t-xl overflow-hidden z-10 flex flex-col">
                <div className="px-4 py-3 flex items-center justify-between border-b border-white/5 bg-slate-900/50">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Camadas ({filteredBlocks.length})</span>
                  </div>
                  {filteredBlocks.length > 2 && !layerSearch && (
                    <button
                      onClick={() => setIsLayersPanelExpanded(!isLayersPanelExpanded)}
                      className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                      title={isLayersPanelExpanded ? "Recolher Torre" : "Expandir Torre"}
                    >
                      {isLayersPanelExpanded ? (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      )}
                    </button>
                  )}
                </div>
                <div className="px-3 py-2 bg-slate-950 border-b border-white/5">
                  <div className="relative group/search">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/search:text-indigo-400 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Buscar bloco..."
                      value={layerSearch}
                      onChange={(e) => {
                        setLayerSearch(e.target.value);
                        if (!isLayersPanelExpanded && e.target.value.length > 0) setIsLayersPanelExpanded(true);
                      }}
                      className="w-full bg-black/20 hover:bg-black/40 focus:bg-black/40 border border-slate-800 focus:border-indigo-500/50 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-600 outline-none transition-all"
                    />
                    {layerSearch && (
                      <button onClick={() => setLayerSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className={`pointer-events-auto w-full bg-slate-900/90 border-x border-b border-slate-800 backdrop-blur-md shadow-2xl overflow-y-auto scrollbar-hide rounded-b-xl transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] flex flex-col ${isLayersPanelExpanded || layerSearch ? 'max-h-[50vh] opacity-100' : 'max-h-24 opacity-100'}`}>
                {visibleLayersList.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="text-[10px] text-slate-500 font-medium">Nenhum bloco encontrado.</p>
                  </div>
                ) : (
                  visibleLayersList.map((block) => {
                    const isActive = activeLayerId === block.id;
                    return (
                      <div
                        key={block.id}
                        onClick={() => {
                          scrollToBlock(block.id);
                          if (!isLayersPanelExpanded && !layerSearch) setIsLayersPanelExpanded(true);
                        }}
                        className={`group flex items-center gap-3 p-3 transition-all border-b border-white/5 cursor-pointer relative last:border-0
                            ${isActive
                            ? 'bg-indigo-600/10 border-l-4 border-l-indigo-500 pl-2'
                            : 'hover:bg-white/5 border-l-4 border-l-transparent pl-2'
                          }
                          `}
                      >
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden border shrink-0 transition-colors shadow-sm ml-1 ${isActive
                          ? 'bg-indigo-600 border-indigo-400 text-white shadow-indigo-500/20'
                          : 'bg-slate-950 border-slate-800 text-slate-500 group-hover:border-slate-600'
                          }`}>
                          <span className="text-[8px] font-black uppercase tracking-tighter">BLK</span>
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          {editingLayerId === block.id ? (
                            <input
                              autoFocus
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onBlur={saveLayerName}
                              onKeyDown={handleLayerNameKeyDown}
                              onClick={(e) => e.stopPropagation()}
                              maxLength={32}
                              className="w-full bg-black/40 border border-indigo-500 rounded px-2 py-1 text-xs text-white outline-none focus:ring-1 focus:ring-indigo-500/50"
                            />
                          ) : (
                            <div className="flex items-center justify-between w-full group/row">
                              <div className="flex-1 min-w-0 pr-2">
                                <p
                                  className={`text-xs font-bold truncate transition-colors cursor-text ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}
                                  title="Clique duplo para renomear"
                                  onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    startRenaming(block.id, block.name);
                                  }}
                                >
                                  {block.name}
                                </p>
                                <p className={`text-[9px] truncate mt-0.5 ${isActive ? 'text-indigo-200/70' : 'text-slate-600'}`}>
                                  {block.data.prompt ? block.data.prompt : <span className="italic opacity-50">Sem prompt...</span>}
                                </p>
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); startRenaming(block.id, block.name); }}
                                className={`p-1.5 rounded-md transition-all opacity-0 group-hover:opacity-100 ${isActive ? 'text-indigo-300 hover:bg-indigo-500/30 hover:text-white' : 'text-slate-500 hover:bg-white/10 hover:text-white'}`}
                                title="Renomear Bloco"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                {!isLayersPanelExpanded && !layerSearch && hiddenLayersCount > 0 && (
                  <div className="bg-gradient-to-b from-slate-900 to-slate-950 py-2 text-center border-t border-white/5 cursor-pointer hover:bg-slate-900 transition-colors" onClick={() => setIsLayersPanelExpanded(true)}>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 13l-7 7-7-7m14-8l-7 7-7-7" /></svg>
                      +{hiddenLayersCount} Ocultos
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="absolute bottom-8 right-8 z-40 flex items-center gap-3 stop-pan">
              <div className={`flex items-center gap-1 p-2 bg-slate-950/90 backdrop-blur-xl rounded-2xl border border-slate-800 shadow-2xl transition-all duration-300 ${isZoomExpanded ? 'px-3' : 'w-14 h-14 justify-center'}`}>
                {isZoomExpanded ? (
                  <>
                    <button
                      onClick={() => setTransform(prev => ({ ...prev, scale: Math.max(prev.scale - 0.1, 0.4) }))}
                      className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition-colors border border-slate-700 hover:border-slate-500"
                      title="Diminuir Zoom"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" /></svg>
                    </button>
                    <div className="w-16 text-center font-mono text-sm font-black text-white drop-shadow-md select-none">
                      {Math.round(transform.scale * 100)}%
                    </div>
                    <button
                      onClick={() => setTransform(prev => ({ ...prev, scale: Math.min(prev.scale + 0.1, 2.0) }))}
                      className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition-colors border border-slate-700 hover:border-slate-500"
                      title="Aumentar Zoom"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                    </button>
                    <div className="w-[1px] h-6 bg-slate-700 mx-2"></div>
                    <button onClick={() => setIsZoomExpanded(false)} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  </>
                ) : (
                  <button onClick={() => setIsZoomExpanded(true)} className="w-full h-full flex items-center justify-center text-white hover:scale-110 transition-transform">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        </ErrorBoundary>
      )}

      {/* View Switchers */}
      {currentView === View.CAROUSEL && FEATURE_FLAGS.CAROUSEL && <CarouselGenerator credits={credits} deductCredits={deductCredits} onSaved={handleSaveAuxiliaryCreation} />}
      {currentView === View.PROMPTS && <PromptLibrary />}
      {currentView === View.LIBRARY && <LibraryScreen onUseItem={handleUseLibraryItem} />}
      {currentView === View.GALLERY && <GalleryScreen items={items} folders={folders} onDelete={deleteItem} onMove={moveItem} onAddFolder={addFolder} onViewItem={(item) => setViewingItem(item)} onUpdateTags={handleUpdateTags} />}
      {currentView === View.CREDITS && <CreditScreen credits={credits} history={purchaseHistory} onAddCredits={addCredits} />}
      {currentView === View.SETTINGS && (
        <div className="max-w-2xl mx-auto glass p-10 rounded-[2.5rem] animate-in slide-in-from-bottom-5 duration-500">
          <h2 className="text-3xl font-black mb-10 text-slate-800 dark:text-white">Configurações</h2>
          <div className="space-y-4 text-center">
            <button onClick={() => localStorage.clear()} className="text-red-500 underline">Resetar Cache</button>
          </div>
        </div>
      )}

      <FullscreenViewer item={viewingItem} onClose={() => setViewingItem(null)} />
    </Layout>
  );
};

export default App;
