
import React from 'react';

export const FEATURE_FLAGS = {
  CAROUSEL: false, // Set to true to enable the Carousel feature
  VIDEO_MODELS_ENABLED: true, // Set to false to temporarily disable all video generation features
  DRAG_DROP_ENABLED: false, // Set to false to completely disable drag and drop interactions
  TAGS_ENABLED: false, // Set to false to temporarily hide Gallery Tags UI
};

export const CREDIT_COSTS = {
  IMAGE: {
    '1K': 18,
    '2K': 20,
    '4K': 25,
  },
  AVATAR: {
    '1K': 18,
    '2K': 20,
    '4K': 25,
  },
  VIDEO: 20,
  IMAGE_TO_VIDEO: 25,
  FACE_TO_VIDEO: 30,
  // Tabela Atualizada para Imitar Movimento (Resolution x Duration)
  MIMIC: {
    '720p': {
      '5': 60,
      '10': 120,
      '15': 180,
      '20': 240
    },
    '1080p': {
      '5': 75,
      '10': 150,
      '15': 225,
      '20': 300
    }
  },
  // CREATIVE_MODEL cost is now dynamic and mirrors IMAGE cost logic in CreationBlock
  CAROUSEL: 15, // Custo fixo para geração de roteiro de carrossel
};

export const PACKAGES = [
  { id: 'p1', name: 'Pacote Lite', credits: 500, price: 37.00, unitPrice: 'R$ 7,40 por 100 créditos', priceId: 'price_1SxyCHJGlMGDBDQlhXbYLX07' },
  { id: 'p2', name: 'Pacote Popular', credits: 1000, price: 67.00, popular: true, unitPrice: 'R$ 6,70 por 100 créditos', priceId: 'price_1SxyCHJGlMGDBDQltjoyQ0AW' },
  { id: 'p3', name: 'Estúdio Pro', credits: 2000, price: 97.00, unitPrice: 'R$ 4,85 por 100 créditos', priceId: 'price_1SxyCHJGlMGDBDQlmlkGTOa8' },
];