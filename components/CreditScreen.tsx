import React, { useState, useEffect } from 'react';
import { PACKAGES } from '../constants';
import { PurchaseHistory } from '../types';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { createCheckoutSession } from '../services/checkoutService';
import { getCurrentUser } from '../services/authService';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

interface CreditScreenProps {
  credits: number;
  history: PurchaseHistory[];
  onAddCredits: (amount: number, planName: string, price: number) => void;
}

const CreditScreen: React.FC<CreditScreenProps> = ({ credits, history, onAddCredits }) => {
  const [isBuying, setIsBuying] = useState<any | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoadingCheckout, setIsLoadingCheckout] = useState(false);

  // Check for success via URL query params (Stripe redirect)
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get('success')) {
      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 5000);
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleInitiateCheckout = async (pkg: any) => {
    setIsBuying(pkg);
    setIsLoadingCheckout(true);
    setClientSecret(null);

    try {
      const user = await getCurrentUser();
      const email = user?.email || undefined;

      const session = await createCheckoutSession(pkg.priceId, email);

      if (session && session.clientSecret) {
        setClientSecret(session.clientSecret);
      } else {
        alert("Erro ao iniciar checkout. Tente novamente.");
        setIsBuying(null);
      }
    } catch (error: any) {
      console.error("Checkout initiation failed:", error);
      alert(`Erro: ${error.message || "Erro desconhecido ao conectar com o servidor."}`);
      setIsBuying(null);
    } finally {
      setIsLoadingCheckout(false);
    }
  };

  const handleCloseModal = () => {
    setIsBuying(null);
    setClientSecret(null);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-12">
      <div className="relative overflow-hidden rounded-[3rem] bg-indigo-600 p-12 text-white">
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
          <div>
            <h1 className="text-5xl font-extrabold mb-4">Seu Combustível Criativo</h1>
            <p className="text-indigo-100 text-lg opacity-80 max-w-md">Cada criação consome energia. Abasteça seu estúdio para continuar construindo o futuro da arte.</p>
          </div>
          <div className="text-center md:text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">Saldo Atual</p>
            <p className="text-7xl font-black">{credits}</p>
            <p className="text-sm font-medium opacity-80">Créditos disponíveis</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {PACKAGES.map((pkg) => (
          <div key={pkg.id} className={`group relative glass p-8 rounded-[2.5rem] transition-all hover:-translate-y-2 border-2 ${pkg.popular ? 'border-indigo-500/50 ring-4 ring-indigo-500/10' : 'border-transparent'}`}>
            {pkg.popular && <span className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-tighter rounded-full">Mais Popular</span>}
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{pkg.name}</h3>
              <p className="text-indigo-600 font-black text-4xl mt-2">{pkg.credits} Créditos</p>
            </div>
            <div className="space-y-4 mb-8">
              <p className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                Geração Prioritária
              </p>
              <p className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                Sem Marcas d'Água
              </p>
            </div>
            <button
              onClick={() => handleInitiateCheckout(pkg)}
              className="w-full py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold hover:opacity-90 transition-opacity"
            >
              Comprar por R$ {pkg.price.toFixed(2)}
            </button>
            <p className="text-center text-xs text-slate-400 font-medium mt-3 opacity-80">
              {pkg.unitPrice}
            </p>
          </div>
        ))}
      </div>

      <div className="glass rounded-[2.5rem] p-10">
        <h2 className="text-2xl font-bold mb-8">Histórico de Transações</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/5">
                <th className="pb-4 font-bold text-slate-400 text-xs uppercase">Data</th>
                <th className="pb-4 font-bold text-slate-400 text-xs uppercase">Plano</th>
                <th className="pb-4 font-bold text-slate-400 text-xs uppercase">Créditos</th>
                <th className="pb-4 font-bold text-slate-400 text-xs uppercase text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {history.map((item) => {
                const pkg = PACKAGES.find(p => p.name === item.plan) ||
                  (item.plan.includes('500') ? PACKAGES.find(p => p.credits === 500) : null) ||
                  (item.plan.includes('1000') ? PACKAGES.find(p => p.credits === 1000) : null) ||
                  (item.plan.includes('2000') ? PACKAGES.find(p => p.credits === 2000) : null);

                return (
                  <tr key={item.id} className="group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <td className="py-4 text-slate-600 dark:text-slate-300 font-medium">
                      {new Date(item.date).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-4 font-bold">{pkg ? pkg.name : item.plan}</td>
                    <td className="py-4 font-bold text-indigo-600">{pkg ? pkg.credits : 0}</td>
                    <td className="py-4 text-right font-medium">R$ {item.amount.toFixed(2)}</td>
                  </tr>
                );
              })}
              {history.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400 font-medium">Nenhuma transação encontrada</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Success Modal */}
      {isSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-xl bg-slate-900/60">
          <div className="glass w-full max-w-md bg-white dark:bg-slate-900 rounded-[3rem] p-10 shadow-3xl animate-in zoom-in-95 duration-200 text-center">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 className="text-3xl font-black mb-2">Sucesso!</h3>
            <p className="text-slate-500">Seu pagamento foi processado com sucesso.</p>
            <button
              onClick={() => setIsSuccess(false)}
              className="mt-8 w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-2xl"
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {isBuying && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-xl bg-slate-900/60">
          <div className="glass w-full max-w-4xl h-[85vh] bg-white dark:bg-slate-900 rounded-[2rem] shadow-3xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col relative">

            <div className="p-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-white/50 dark:bg-black/20 backdrop-blur-md z-10">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">Checkout Seguro</h3>
                <p className="text-sm text-slate-500">{isBuying.name} • {isBuying.credits} Créditos</p>
              </div>
              <button onClick={handleCloseModal} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
                <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#0B0F19] relative">
              {isLoadingCheckout ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-slate-500 font-medium animate-pulse">Iniciando pagamento seguro...</p>
                </div>
              ) : clientSecret ? (
                <EmbeddedCheckoutProvider
                  stripe={stripePromise}
                  options={{ clientSecret }}
                >
                  <EmbeddedCheckout className="h-full w-full" />
                </EmbeddedCheckoutProvider>
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-400">
                  <p>Não foi possível carregar o checkout.</p>
                  <button onClick={handleCloseModal} className="mt-4 text-indigo-500 font-bold hover:underline">Tentar novamente</button>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-100 dark:bg-white/5 text-center text-[10px] text-slate-400 font-medium uppercase tracking-widest border-t border-slate-200 dark:border-white/5">
              Pagamento processado por Stripe • Criptografia SSL 256-bits
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreditScreen;
