
import React from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { View, User } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentView: View;
  onViewChange: (view: View) => void;
  credits: number;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  onSignOut: () => void;
  user: User | null;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  currentView, 
  onViewChange, 
  credits, 
  theme, 
  toggleTheme, 
  onSignOut,
  user
}) => {
  const isEditor = currentView === View.EDITOR;

  return (
    // ALWAYS enforce 'dark' class so UI components (Sidebar, TopBar, Blocks) render in dark mode styles.
    // The 'theme' prop is passed down but only affects the Canvas container inside children (App.tsx).
    <div className="min-h-screen transition-colors duration-500 dark bg-[#020617] text-white">
      <Sidebar currentView={currentView} onViewChange={onViewChange} user={user} credits={credits} />
      <TopBar 
        credits={credits} 
        theme={theme} 
        toggleTheme={toggleTheme} 
        onSignOut={onSignOut} 
        onOpenCredits={() => onViewChange(View.CREDITS)}
      />
      
      <main className={`
          ml-20 
          relative 
          transition-all 
          duration-300
          ${isEditor 
            ? 'pt-16 h-screen overflow-hidden' // Editor: Full height, no padding, hidden overflow (canvas handles scrolling/panning)
            : 'pt-24 px-8 pb-12 min-h-screen overflow-x-hidden' // Others: Standard padded layout
          }
      `}>
        <div className={`
          relative z-10 
          ${isEditor 
            ? 'w-full h-full' // Editor: Full space
            : 'max-w-[1600px] mx-auto' // Others: Centered container
          }
        `}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
