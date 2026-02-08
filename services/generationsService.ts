import { supabase } from './supabase';
import type { Generation } from './supabase';

/**
 * Serviço de Gerenciamento de Gerações
 * Gerencia o CRUD de gerações no Supabase com suporte a Realtime
 */

// Criar nova geração no banco
export const createGeneration = async (
    userId: string,
    type: string,
    prompt: string,
    cost: number,
    metadata: any = {}
): Promise<string | null> => {
    try {
        const { data, error } = await supabase
            .from('generations')
            .insert({
                user_id: userId,
                type,
                prompt,
                cost,
                metadata,
                image_url: null, // Será preenchido quando o webhook retornar
                created_at: new Date().toISOString()
            })
            .select('id')
            .single();

        if (error) throw error;

        console.log(`✅ Geração criada: ${data.id}`);
        return data.id;
    } catch (error) {
        console.error('Erro ao criar geração:', error);
        return null;
    }
};

// Atualizar image_url da geração quando webhook retornar
export const updateGenerationResult = async (
    generationId: string,
    imageUrl: string
): Promise<boolean> => {
    try {
        console.log(`🔄 [updateGenerationResult] Atualizando image_url no Supabase...`, {
            generationId,
            imageUrl: imageUrl.substring(0, 100) + '...'
        });

        const { error } = await supabase
            .from('generations')
            .update({ image_url: imageUrl })
            .eq('id', generationId);

        if (error) {
            console.error('❌ [updateGenerationResult] Erro ao atualizar:', error);
            throw error;
        }

        console.log(`✅ [updateGenerationResult] Geração atualizada com sucesso: ${generationId}`);
        return true;
    } catch (error) {
        console.error('❌ [updateGenerationResult] Erro ao atualizar geração:', error);
        return false;
    }
};

// Buscar todas as gerações de um usuário
export const getUserGenerations = async (userId: string): Promise<Generation[]> => {
    try {
        const { data, error } = await supabase
            .from('generations')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return data ?? [];
    } catch (error) {
        console.error('Erro ao buscar gerações:', error);
        return [];
    }
};

// Buscar uma geração específica
export const getGeneration = async (generationId: string): Promise<Generation | null> => {
    try {
        const { data, error } = await supabase
            .from('generations')
            .select('*')
            .eq('id', generationId)
            .single();

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('Erro ao buscar geração:', error);
        return null;
    }
};

// Subscribe para mudanças em tempo real em uma geração específica
export const subscribeToGeneration = (
    generationId: string,
    callback: (generation: Generation) => void
) => {
    const channel = supabase
        .channel(`generation:${generationId}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'generations',
                filter: `id=eq.${generationId}`,
            },
            (payload) => {
                console.log('Generation updated:', payload);
                callback(payload.new as Generation);
            }
        )
        .subscribe();

    // Retorna função para cancelar a inscrição
    return () => {
        supabase.removeChannel(channel);
    };
};

// Subscribe para todas as gerações de um usuário
export const subscribeToUserGenerations = (
    userId: string,
    callback: (generation: Generation) => void
) => {
    const channel = supabase
        .channel(`user_generations:${userId}`)
        .on(
            'postgres_changes',
            {
                event: '*', // INSERT, UPDATE, DELETE
                schema: 'public',
                table: 'generations',
                filter: `user_id=eq.${userId}`,
            },
            (payload) => {
                console.log('User generation changed:', payload);
                callback(payload.new as Generation);
            }
        )
        .subscribe();

    // Retorna função para cancelar a inscrição
    return () => {
        supabase.removeChannel(channel);
    };
};

// Deletar geração
export const deleteGeneration = async (generationId: string): Promise<boolean> => {
    try {
        const { error } = await supabase
            .from('generations')
            .delete()
            .eq('id', generationId);

        if (error) throw error;

        console.log(`🗑️ Geração deletada: ${generationId}`);
        return true;
    } catch (error) {
        console.error('Erro ao deletar geração:', error);
        return false;
    }
};
