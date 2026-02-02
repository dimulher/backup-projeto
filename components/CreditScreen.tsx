
import React, { useState } from 'react';
import { PACKAGES } from '../constants';
import { PurchaseHistory } from '../types';

interface CreditScreenProps {
  credits: number;
  history: PurchaseHistory[];
  onAddCredits: (amount: number, planName: string, price: number) => void;
}

const CreditScreen: React.FC<CreditScreenProps> = ({ credits, history, onAddCredits }) => {
  const [isBuying, setIsBuying] = useState<any | null>(null);
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    setTimeout(() => {
      onAddCredits(isBuying.credits, isBuying.name, isBuying.price);
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setIsBuying(null);
      }, 2000);
    }, 1500);
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
              onClick={() => setIsBuying(pkg)}
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
              {history.map((item) => (
                <tr key={item.id} className="group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                  <td className="py-4 text-slate-600 dark:text-slate-300 font-medium">
                    {new Date(item.date).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="py-4 font-bold">{item.plan}</td>
                  <td className="py-4 font-bold text-indigo-600">{PACKAGES.find(p => p.name === item.plan)?.credits || 0}</td>
                  <td className="py-4 text-right font-medium">R$ {item.amount.toFixed(2)}</td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400 font-medium">Nenhuma transação encontrada</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isBuying && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-xl bg-slate-900/60">
          <div className="glass w-full max-w-md bg-white dark:bg-slate-900 rounded-[3rem] p-10 shadow-3xl animate-in zoom-in-95 duration-200">
            {isSuccess ? (
              <div className="text-center py-8">
                <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="text-3xl font-black mb-2">Sucesso!</h3>
                <p className="text-slate-500">Créditos adicionados à sua conta.</p>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-2xl font-bold">Pagamento Seguro</h3>
                  <button onClick={() => setIsBuying(null)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="mb-8 p-6 bg-slate-50 dark:bg-white/5 rounded-3xl">
                   <p className="text-xs font-bold text-slate-400 uppercase mb-1">Total a pagar</p>
                   <p className="text-3xl font-black">R$ {isBuying.price.toFixed(2)}</p>
                </div>
                <form onSubmit={handleCheckout} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase ml-2">Nome no Cartão</label>
                    <input 
                      required 
                      value={cardName} 
                      onChange={e => setCardName(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-100 dark:bg-black/20 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none" 
                      placeholder="NOME COMPLETO" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase ml-2">Número do Cartão</label>
                    <input 
                      required 
                      value={cardNumber}
                      onChange={e => setCardNumber(e.target.value.replace(/\D/g,'').substring(0,16))}
                      className="w-full px-6 py-4 bg-slate-100 dark:bg-black/20 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none" 
                      placeholder="0000 0000 0000 0000" 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase ml-2">Expiração</label>
                        <input required className="w-full px-6 py-4 bg-slate-100 dark:bg-black/20 rounded-2xl outline-none" placeholder="MM/AA" />
                     </div>
                     <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase ml-2">CVV</label>
                        <input required className="w-full px-6 py-4 bg-slate-100 dark:bg-black/20 rounded-2xl outline-none" placeholder="123" />
                     </div>
                  </div>
                  <button className="w-full py-5 bg-indigo-600 text-white font-bold rounded-2xl shadow-xl shadow-indigo-500/30 mt-4 active:scale-95 transition-all">
                    Finalizar Compra
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CreditScreen;
