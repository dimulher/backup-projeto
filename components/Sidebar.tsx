
import React, { useState } from 'react';
import { View, User } from '../types';
import { FEATURE_FLAGS } from '../constants';

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  user: User | null;
  credits: number;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, user, credits }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const menuItems = [
    { id: View.EDITOR, label: 'Editor', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>
    )},
    ...(FEATURE_FLAGS.CAROUSEL ? [{ id: View.CAROUSEL, label: 'Criar Carrossel', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
    )}] : []),
    { 
      id: View.LIBRARY, 
      label: 'Criativos Prontos', 
      disabled: true,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
      )
    },
    { id: View.PROMPTS, label: 'Prompts', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
    )},
    { id: View.GALLERY, label: 'Galeria', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
    )},
    { id: View.CREDITS, label: 'Créditos', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
    )},
  ];

  return (
    <aside 
      className={`h-screen fixed left-0 top-0 z-50 transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${isExpanded ? 'w-64' : 'w-20'} flex flex-col shadow-2xl shadow-black/50 bg-[#0f172a]/60 backdrop-blur-xl border-r border-white/5`}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div className="p-6 mb-4 flex items-center justify-center h-24">
        {/* AdGenius Logo Icon */}
        <div className="w-10 h-10 flex items-center justify-center relative">
            <svg viewBox="0 0 512 512" className="w-full h-full drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                   <linearGradient id="sidebarLogoGrad" x1="0" y1="1" x2="1" y2="0">
                      <stop offset="0" stopColor="#22d3ee" /> {/* Cyan */}
                      <stop offset="0.5" stopColor="#818cf8" /> {/* Indigo */}
                      <stop offset="1" stopColor="#d946ef" /> {/* Fuchsia */}
                   </linearGradient>
                </defs>

                {/* Brain Outline */}
                <path d="M 256 112 C 176.7 112 112 176.7 112 256 C 112 300 132 340 162 365" stroke="url(#sidebarLogoGrad)" strokeWidth="30" strokeLinecap="round" />
                <path d="M 350 365 C 380 340 400 300 400 256 C 400 176.7 335.3 112 256 112" stroke="url(#sidebarLogoGrad)" strokeWidth="30" strokeLinecap="round" strokeDasharray="50 30" opacity="0.9" />

                {/* Circuit Nodes */}
                <circle cx="180" cy="200" r="20" fill="#22d3ee" />
                <circle cx="330" cy="200" r="20" fill="#d946ef" />
                
                {/* Brush Handle */}
                <path d="M 310 202 L 430 82" stroke="white" strokeWidth="50" strokeLinecap="round" />
                <path d="M 310 202 L 430 82" stroke="url(#sidebarLogoGrad)" strokeWidth="34" strokeLinecap="round" />

                {/* Brush Tip Painting */}
                <path d="M 290 222 L 200 312" stroke="white" strokeWidth="40" strokeLinecap="round" />
                <path d="M 200 312 C 170 342 160 360 180 380 C 200 400 220 390 250 360 L 290 222" fill="url(#sidebarLogoGrad)" />
            </svg>
        </div>
        
        {isExpanded && (
           <div className="ml-3 flex flex-col">
              <span className="font-extrabold text-xl text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-400 tracking-tight animate-in fade-in duration-300 leading-none drop-shadow-sm">AdGenius</span>
           </div>
        )}
      </div>

      <nav className="flex-1 space-y-2 px-3">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => !item.disabled && onViewChange(item.id)}
            disabled={item.disabled}
            className={`w-full flex items-center gap-4 p-3.5 rounded-xl transition-all duration-300 group relative overflow-hidden ${
              item.disabled
                ? 'opacity-40 cursor-not-allowed bg-transparent text-slate-500'
                : currentView === item.id 
                  ? 'bg-white/10 text-white shadow-sm border border-white/5' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            {/* Active Indicator */}
            {!item.disabled && currentView === item.id && (
               <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-500 rounded-r-full shadow-[0_0_10px_rgba(99,102,241,0.6)]"></div>
            )}
            
            {/* Icon */}
            <div className={`flex-shrink-0 transition-transform duration-300 ${!item.disabled && currentView === item.id ? 'scale-110 text-indigo-400' : ''}`}>
              {item.icon}
            </div>
            
            {/* Label and Badge */}
            {isExpanded && (
              <div className="flex items-center justify-between w-full animate-in fade-in slide-in-from-left-2 duration-300">
                <span className="font-medium text-sm whitespace-nowrap">{item.label}</span>
                {item.disabled && (
                  <span className="text-[9px] font-bold uppercase tracking-wide bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md border border-white/5 ml-2 whitespace-nowrap">
                    Em breve
                  </span>
                )}
              </div>
            )}
          </button>
        ))}
      </nav>

      <div className="p-4 mt-auto">
        <div className={`p-3 rounded-2xl border border-white/5 bg-white/5 backdrop-blur-md transition-all duration-500 overflow-hidden ${isExpanded ? 'opacity-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
           <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-700 to-slate-600 border border-white/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-white">
                    {user?.name ? user.name.charAt(0).toUpperCase() : (user?.email?.charAt(0).toUpperCase() || 'U')}
                </span>
              </div>
              <div className="overflow-hidden flex flex-col justify-center">
                <p className="text-xs font-semibold text-white truncate">
                    {user?.name || "Usuário"}
                </p>
                <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider truncate">
                    {credits !== undefined ? `${credits} CR` : "— CR"}
                </p>
              </div>
           </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
