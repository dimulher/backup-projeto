import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children?: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(" [CreativeFlow Critical Error]:", error, errorInfo);
    this.setState({ error, errorInfo });
    
    if (window.console && window.console.group) {
        console.group("Canvas Crash Report");
        console.log("Time:", new Date().toISOString());
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        console.log("Memory:", (performance as any).memory || 'N/A');
        console.log("Stack:", error.stack);
        console.groupEnd();
    }
  }

  handleCopyLogs = () => {
    const logData = {
        message: this.state.error?.message,
        stack: this.state.error?.stack,
        componentStack: this.state.errorInfo?.componentStack,
        time: new Date().toISOString(),
        userAgent: navigator.userAgent
    };
    navigator.clipboard.writeText(JSON.stringify(logData, null, 2));
    alert("Logs copiados para a área de transferência.");
  };

  handleHardReset = () => {
      // Emergency clear of potentially corrupted view state
      try {
          // Keep auth but clear view state
          const user = localStorage.getItem('creativeflow_user');
          const credits = localStorage.getItem('creativeflow_credits');
          localStorage.clear();
          if(user) localStorage.setItem('creativeflow_user', user);
          if(credits) localStorage.setItem('creativeflow_credits', credits);
          window.location.reload();
      } catch (e) {
          window.location.reload();
      }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-slate-950 text-white p-6 font-sans">
          <div className="max-w-md w-full bg-slate-900 border border-red-500/30 rounded-2xl p-8 shadow-2xl">
            <div className="flex items-center gap-3 text-red-500 mb-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <h2 className="text-xl font-bold">O Editor encontrou um problema</h2>
            </div>
            
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                Algo inesperado aconteceu com a renderização do canvas. Isso geralmente ocorre devido a sobrecarga de memória ou cálculo de posições inválidas.
            </p>

            <div className="bg-black/50 rounded-lg p-4 mb-6 overflow-auto max-h-32 text-[10px] font-mono text-red-200 border border-red-900/50">
                {this.state.error?.toString()}
            </div>

            <div className="grid grid-cols-2 gap-3">
                <button 
                    onClick={() => {
                        this.setState({ hasError: false, error: null, errorInfo: null });
                        if (this.props.onReset) this.props.onReset();
                    }}
                    className="py-3 px-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors"
                >
                    Tentar Restaurar
                </button>
                <button 
                    onClick={this.handleHardReset}
                    className="py-3 px-4 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors text-slate-300"
                >
                    Resetar Tudo
                </button>
            </div>
            
            <button 
                onClick={this.handleCopyLogs}
                className="w-full mt-4 py-2 text-slate-500 hover:text-white text-[10px] uppercase font-bold tracking-widest underline decoration-slate-700 hover:decoration-white transition-all"
            >
                Copiar Logs para Suporte
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}