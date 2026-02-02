
import React from 'react';

interface TopBarProps {
  credits: number;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  onSignOut: () => void;
  onOpenCredits: () => void;
}

const TopBar: React.FC<TopBarProps> = ({ credits, theme, toggleTheme, onSignOut, onOpenCredits }) => {
  return (
    <header className="h-16 fixed top-0 right-0 left-20 z-40 px-8 flex items-center justify-between pointer-events-none">
      <div className="pointer-events-auto">
      </div>

      <div className="flex items-center gap-4 pointer-events-auto">
        {/* Credits Chip - Always Dark style */}
        <div className="px-4 py-2 rounded-2xl flex items-center gap-2 shadow-sm border border-white/5 bg-slate-900/50 backdrop-blur-xl text-white">
          <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05l-3.293 3.293a1 1 0 01-1.414 0l-3.293-3.293a1 1 0 01-.285-1.05l1.738-5.42-1.233-.616a1 1 0 01.894-1.79l1.599.8L9 4.323V3a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          <span className="font-bold text-slate-200">{credits} Créditos</span>
          <button 
            onClick={onOpenCredits}
            title="Comprar créditos"
            className="ml-2 p-1 hover:bg-white/10 rounded-lg transition-colors cursor-pointer group"
          >
            <svg className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
          </button>
        </div>

        {/* Theme Toggle - Always Dark style base */}
        <button 
          onClick={toggleTheme}
          className="p-3 rounded-2xl hover:bg-white/10 transition-colors shadow-sm border border-white/5 bg-slate-900/50 backdrop-blur-xl text-white"
          title="Alternar Tema dos Blocos"
        >
          {theme === 'dark' ? (
             <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M16.95 16.95l.707.707M7.05 7.05l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z" /></svg>
          ) : (
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
          )}
        </button>

        <button 
          onClick={onSignOut}
          className="px-6 py-2.5 bg-slate-100 text-slate-900 rounded-2xl font-bold shadow-sm hover:shadow-md border border-white transition-all active:scale-95"
        >
          Sair
        </button>
      </div>
    </header>
  );
};

export default TopBar;
