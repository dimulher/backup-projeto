
export enum View {
  EDITOR = 'editor',
  GALLERY = 'gallery',
  LIBRARY = 'library', // Nova view
  CREDITS = 'credits',
  SETTINGS = 'settings',
  PROMPTS = 'prompts',
  CAROUSEL = 'carousel',
}

export enum CreationType {
  IMAGE = 'IMAGE',
  AVATAR = 'AVATAR',
  VIDEO = 'VIDEO',
  IMAGE_TO_VIDEO = 'IMAGE_TO_VIDEO',
  FACE_TO_VIDEO = 'FACE_TO_VIDEO',
  MIMIC = 'MIMIC',
  CAROUSEL = 'CAROUSEL',
  CREATIVE_MODEL = 'CREATIVE_MODEL',
  PROFESSIONAL_PHOTO = 'PROFESSIONAL_PHOTO',
}

export enum AspectRatio {
  SQUARE = '1:1',
  LANDSCAPE = '16:9',
  PORTRAIT = '9:16',
  // Extended Image Formats
  R_2_3 = '2:3',
  R_3_2 = '3:2',
  R_3_4 = '3:4',
  R_4_3 = '4:3',
  R_4_5 = '4:5',
  R_5_4 = '5:4',
  R_21_9 = '21:9',
  AUTO = 'Auto',
}

export enum Quality {
  K1 = '1K',
  K2 = '2K',
  K4 = '4K',
}

export enum ImageFormat {
  PNG = 'PNG',
  JPG = 'JPG',
}

export enum VideoDuration {
  SEC_5 = '5',
  SEC_10 = '10',
  SEC_15 = '15',
  SEC_20 = '20',
}

export enum VideoResolution {
  RES_720P = '720p',
  RES_1080P = '1080p',
}

export enum ReferenceRole {
  FREE = 'Geral',
  STYLE = 'Estilo visual',
  PALETTE = 'Paleta de cores',
  BACKGROUND = 'Fundo / cenário',
  COMPOSITION = 'Composição / layout',
  // Legacy / Extra
  PRODUCT = 'Produto / Objeto',
  LOGO = 'Logo / Marca',
  TEXT = 'Texto / Tipografia',
  EXAMPLE = 'Exemplo / Anúncio',
}

export const GALLERY_TAGS = {
  ACTIVE: 'Anúncio ativo',
  TEST: 'Teste',
  WINNER: 'Vencedor',
  IDEA: 'Ideia futura'
} as const;

export interface ExtraReference {
  id: string;      // Unique ID for the reference slot
  fileId: string;  // ID used in IndexedDB
  preview: string; // Lightweight Base64 for UI or Blob URL
  role: ReferenceRole;
  note: string;
  createdAt: number;
}

export interface EditorBlockData {
  type: CreationType;
  prompt: string;
  aspectRatio: AspectRatio;
  quality: Quality;
  format?: ImageFormat; // Novo campo
  duration?: VideoDuration;
  videoResolution?: VideoResolution; // Novo campo para resolução de vídeo
  
  // Slot 1 (Primary / Motion Source / Face Reference)
  refMain?: string | null; // Preview (Base64 or Blob URL)
  refMainId?: string | null; // IDB File ID (for videos)
  refMainAssetId?: string | null; // IDB Asset ID (for migrated images)
  refMainType?: 'image' | 'video';

  // Slot 2 (Style / Avatar Visual)
  refStyle?: string | null; // Preview (Base64 or Blob URL)
  refStyleId?: string | null; // IDB File ID (for videos)
  refStyleAssetId?: string | null; // IDB Asset ID (for migrated images)
  refStyleType?: 'image' | 'video';

  // Slot 3 (Reference / Creative Model - NEW)
  refReference?: string | null;
  refReferenceId?: string | null;
  refReferenceAssetId?: string | null;
  refReferenceType?: 'image' | 'video';
  refReferenceRole?: ReferenceRole; // NEW: Function selector for reference

  // Specific for Mimic/Video modes
  refVideo?: string | null; // Legacy/Fallback ID

  extraRefs?: ExtraReference[];
  lastGeneratedUrl?: string;
  lastGeneratedAssetId?: string; // IDB Link for generated result
  lastPromptUpdate?: number; // Timestamp para forçar atualização do prompt via biblioteca
}

export interface EditorBlockInstance {
  id: string;
  name: string; // Nome amigável ex: "Bloco 1"
  position: { x: number; y: number };
  data: EditorBlockData;
  createdAt: number;
  updatedAt: number;
}

export interface CreationItem {
  id: string;
  type: CreationType;
  url: string; // Blob URL (Runtime) or Base64
  assetId?: string; // IndexedDB ID (Storage)
  prompt: string; // Para Carousel, armazena o conteúdo JSON
  createdAt: number;
  folderId?: string;
  quality?: Quality;
  aspectRatio: AspectRatio;
  position?: { x: number; y: number };
  savedToGallery?: boolean;
  tags?: string[]; // Array of tag strings
}

export interface Folder {
  id: string;
  name: string;
}

export interface User {
  email: string;
  name?: string; // Optional display name
  credits: number;
}

export interface PurchaseHistory {
  id: string;
  date: number;
  plan: string;
  amount: number;
}

export interface CreationPreset {
  id: string;
  name: string;
  type: CreationType;
  aspectRatio: AspectRatio;
  quality: Quality;
}

export interface CarouselSlide {
  slide: number;
  title: string;
  text: string;
  visualHook?: string; 
}

// --- NODE SYSTEM TYPES ---
export interface Connection {
  id: string;
  sourceId: string; // CreationItem ID (Asset)
  targetId: string; // Block ID
  targetHandle: 'main' | 'style'; // Slot type
}

// --- LIBRARY TYPES ---
export interface LibraryItem {
  id: string;
  url: string; // External URL or Asset Path
  thumbnail: string;
  title: string;
  niche: string;
  objective: string;
  platform: string;
  isPremium: boolean;
  promptSuggestion?: string;
}