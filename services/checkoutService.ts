import { supabase } from './supabase';

export interface CheckoutSessionResponse {
    clientSecret: string;
    sessionId: string;
    error?: string;
}

export const createCheckoutSession = async (priceId: string, customerEmail?: string): Promise<CheckoutSessionResponse> => {
    try {
        const { data, error } = await supabase.functions.invoke('create-checkout', {
            body: { priceId, customerEmail },
        });

        if (error) {
            console.error('Supabase Function Invoke Error:', error);
            throw error;
        }

        if (data.error) {
            throw new Error(data.error);
        }

        return data as CheckoutSessionResponse;
    } catch (error) {
        console.error('Checkout Service Error:', error);
        throw error;
    }
};
