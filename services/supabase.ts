import { createClient } from '@supabase/supabase-js';

// Configurações do Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://thjvbbcnlonvkgmkecoj.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_20PgCFitQP2jyMSYbmaIlw_0QGJ1EcD';

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('⚠️ Supabase URL ou chave não configurada. Verifique o arquivo .env');
}

// Criar cliente Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
    },
});

// Helper para verificar conexão
export const testSupabaseConnection = async () => {
    try {
        const { data, error } = await supabase.from('users').select('count').limit(1);
        if (error) throw error;
        console.log('✅ Conexão com Supabase estabelecida com sucesso!');
        return true;
    } catch (error) {
        console.error('❌ Erro ao conectar com Supabase:', error);
        return false;
    }
};

// Tipos para as tabelas baseados na estrutura real do Supabase
export interface User {
    id: string;
    email: string;
    credits: number;
    created_at?: string;
    updated_at?: string;
}

export interface Generation {
    id: string;
    user_id: string;
    type: string;
    prompt: string;
    cost: number;
    image_url: string | null;
    metadata?: any; // JSONB column
    created_at: string;
}

// Funções auxiliares para Storage
export const uploadToStorage = async (
    bucket: string,
    path: string,
    file: File | Blob
): Promise<string | null> => {
    try {
        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(path, file, {
                cacheControl: '3600',
                upsert: false,
            });

        if (error) throw error;

        // Obter URL pública
        const { data: urlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(data.path);

        return urlData.publicUrl;
    } catch (error) {
        console.error('Erro ao fazer upload:', error);
        return null;
    }
};

export const getPublicUrl = (bucket: string, path: string): string => {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
};
