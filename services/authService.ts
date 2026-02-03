import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';

/**
 * Serviço de Autenticação usando Supabase Auth
 * Suporta login social (Google, etc)
 */

// Login com Google
export const signInWithGoogle = async () => {
    try {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
            },
        });

        if (error) throw error;
        return { success: true, data };
    } catch (error: any) {
        console.error('Erro no login com Google:', error);
        return { success: false, error: error.message };
    }
};

// Obter usuário atual
export const getCurrentUser = async (): Promise<User | null> => {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        return user;
    } catch (error) {
        console.error('Erro ao obter usuário:', error);
        return null;
    }
};

// Obter sessão atual
export const getCurrentSession = async () => {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        return session;
    } catch (error) {
        console.error('Erro ao obter sessão:', error);
        return null;
    }
};

// Logout
export const signOut = async () => {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        return { success: true };
    } catch (error: any) {
        console.error('Erro no logout:', error);
        return { success: false, error: error.message };
    }
};

// Listener de mudanças no estado de autenticação
export const onAuthStateChange = (callback: (user: User | null) => void) => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
            console.log('Auth event:', event);
            callback(session?.user ?? null);
        }
    );

    // Retorna função para cancelar a inscrição
    return () => subscription.unsubscribe();
};

// Verificar se o usuário está autenticado
export const isAuthenticated = async (): Promise<boolean> => {
    const session = await getCurrentSession();
    return session !== null;
};
