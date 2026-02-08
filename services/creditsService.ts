import { supabase } from './supabase';
import type { User } from './supabase';

/**
 * Serviço de Gerenciamento de Créditos
 * Gerencia o saldo de créditos dos usuários no Supabase
 */

// Buscar saldo de créditos do usuário
export const getUserCredits = async (userId: string): Promise<number> => {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('credits')
            .eq('id', userId)
            .single();

        if (error) throw error;
        return data?.credits ?? 0;
    } catch (error) {
        console.error('Erro ao buscar créditos:', error);
        return 0;
    }
};

// Deduzir créditos do usuário (com validação)
export const deductCredits = async (userId: string, amount: number): Promise<boolean> => {
    try {
        // Primeiro verifica se tem créditos suficientes
        const currentCredits = await getUserCredits(userId);

        if (currentCredits < amount) {
            console.error('Créditos insuficientes');
            return false;
        }

        // Deduz os créditos
        const { error } = await supabase
            .from('profiles')
            .update({
                credits: currentCredits - amount
                // profiles doesn't have updated_at by default usually, removing it for now or check schema
            })
            .eq('id', userId);

        if (error) throw error;

        console.log(`✅ ${amount} créditos deduzidos com sucesso`);
        return true;
    } catch (error) {
        console.error('Erro ao deduzir créditos:', error);
        return false;
    }
};

// Adicionar créditos ao usuário
export const addCredits = async (userId: string, amount: number): Promise<boolean> => {
    try {
        const currentCredits = await getUserCredits(userId);

        const { error } = await supabase
            .from('profiles')
            .update({
                credits: currentCredits + amount
            })
            .eq('id', userId);

        if (error) throw error;

        console.log(`✅ ${amount} créditos adicionados com sucesso`);
        return true;
    } catch (error) {
        console.error('Erro ao adicionar créditos:', error);
        return false;
    }
};

// Subscribe para mudanças em tempo real no saldo de créditos
export const subscribeToCredits = (userId: string, callback: (credits: number) => void) => {
    const channel = supabase
        .channel(`credits:${userId}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'profiles',
                filter: `id=eq.${userId}`,
            },
            (payload) => {
                console.log('Credits updated:', payload);
                const newCredits = (payload.new as any).credits;
                callback(newCredits);
            }
        )
        .subscribe();

    // Retorna função para cancelar a inscrição
    return () => {
        supabase.removeChannel(channel);
    };
};

// Criar usuário inicial com créditos (usado após primeiro login)
// DEPRECATED: profiles is handled by trigger, but we keep this as fallback or update it to use profiles
export const createUserIfNotExists = async (userId: string, email: string): Promise<boolean> => {
    try {
        // Verifica se usuário já existe
        const { data: existingUser } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', userId)
            .single();

        if (existingUser) {
            console.log('Usuário já existe');
            return true;
        }

        // Cria novo usuário com 100 créditos iniciais se não existir
        const { error } = await supabase
            .from('profiles')
            .insert({
                id: userId,
                email: email,
                credits: 70,
                full_name: email.split('@')[0]
            });

        if (error) throw error;

        console.log('✅ Novo usuário criado com 70 créditos');
        return true;
    } catch (error) {
        console.error('Erro ao criar usuário:', error);
        return false;
    }
};
