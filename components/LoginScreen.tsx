
import React, { useState } from 'react';
import { signInWithGoogle } from '../services/authService';

interface LoginScreenProps {
  onLogin: (email: string, name?: string) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Signup specific fields
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Login com Google
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await signInWithGoogle();

      if (!result.success) {
        setError(result.error || 'Erro ao fazer login com Google');
      }
      // O redirecionamento será automático após o OAuth
    } catch (err: any) {
      setError(err.message || 'Erro ao conectar com Google');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic Validation
    if (!email || !password) {
      setError("Preencha todos os campos obrigatórios.");
      return;
    }

    if (mode === 'signup') {
      if (!name.trim()) {
        setError("Por favor, informe seu nome.");
        return;
      }
      if (password !== confirmPassword) {
        setError("As senhas não coincidem.");
        return;
      }
      if (password.length < 6) {
        setError("A senha deve ter pelo menos 6 caracteres.");
        return;
      }
    }

    // Success
    onLogin(email, name);
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError(null);
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 relative overflow-hidden font-['Plus_Jakarta_Sans']">
      {/* Background Ambience - Deep Tech Colors */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] bg-indigo-900/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-blue-900/20 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '8s' }}></div>
        <div className="absolute top-[40%] left-[50%] -translate-x-1/2 w-[40vw] h-[40vw] bg-purple-900/10 rounded-full blur-[100px]"></div>
      </div>

      <div className="w-full max-w-md relative z-10 flex flex-col items-center">

        {/* Branding Section - AdGenius */}
        <div className="text-center mb-10 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Logo Icon - AdGenius Brain/Brush */}
          <div className="w-40 h-40 mb-4 relative flex items-center justify-center">
            <div className="absolute inset-0 bg-cyan-500/10 blur-3xl rounded-full"></div>
            {/* New Logo: Neon Brain + Paintbrush */}
            <svg viewBox="0 0 512 512" className="w-full h-full drop-shadow-[0_0_30px_rgba(6,182,212,0.5)]" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="logoGrad" x1="0" y1="1" x2="1" y2="0">
                  <stop offset="0" stopColor="#22d3ee" /> {/* Cyan */}
                  <stop offset="0.5" stopColor="#818cf8" /> {/* Indigo */}
                  <stop offset="1" stopColor="#d946ef" /> {/* Fuchsia */}
                </linearGradient>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="6" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <path d="M 256 112 C 176.7 112 112 176.7 112 256 C 112 300 132 340 162 365" stroke="url(#logoGrad)" strokeWidth="12" strokeLinecap="round" filter="url(#glow)" />
              <path d="M 350 365 C 380 340 400 300 400 256 C 400 176.7 335.3 112 256 112" stroke="url(#logoGrad)" strokeWidth="12" strokeLinecap="round" filter="url(#glow)" strokeDasharray="30 15" opacity="0.8" />
              <circle cx="180" cy="200" r="10" fill="#22d3ee" filter="url(#glow)" />
              <path d="M 180 200 L 220 240" stroke="#22d3ee" strokeWidth="6" strokeLinecap="round" opacity="0.6" />
              <circle cx="330" cy="200" r="10" fill="#d946ef" filter="url(#glow)" />
              <path d="M 330 200 L 290 240" stroke="#d946ef" strokeWidth="6" strokeLinecap="round" opacity="0.6" />
              <circle cx="256" cy="350" r="10" fill="#818cf8" filter="url(#glow)" />
              <path d="M 256 350 L 256 300" stroke="#818cf8" strokeWidth="6" strokeLinecap="round" opacity="0.6" />
              <path d="M 310 202 L 430 82" stroke="white" strokeWidth="24" strokeLinecap="round" filter="url(#glow)" />
              <path d="M 310 202 L 430 82" stroke="url(#logoGrad)" strokeWidth="16" strokeLinecap="round" />
              <path d="M 290 222 L 310 202" stroke="#e2e8f0" strokeWidth="24" strokeLinecap="round" />
              <path d="M 290 222 L 200 312" stroke="white" strokeWidth="20" strokeLinecap="round" filter="url(#glow)" />
              <path d="M 200 312 C 170 342 160 360 180 380 C 200 400 220 390 250 360 L 290 222" fill="url(#logoGrad)" filter="url(#glow)" opacity="0.9" />
              <line x1="440" y1="60" x2="470" y2="30" stroke="#d946ef" strokeWidth="6" strokeLinecap="round" filter="url(#glow)" />
              <line x1="460" y1="90" x2="490" y2="60" stroke="#22d3ee" strokeWidth="6" strokeLinecap="round" filter="url(#glow)" />
            </svg>
          </div>

          <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-indigo-400 to-fuchsia-400 mb-2 tracking-tighter drop-shadow-[0_0_15px_rgba(6,182,212,0.5)] font-['Plus_Jakarta_Sans']">
            AdGenius
          </h1>
          <p className="text-slate-400 font-medium text-lg tracking-wide">
            {mode === 'login' ? 'Eleve sua visão à realidade.' : 'Crie sua conta Premium.'}
          </p>
        </div>

        {/* Login/Signup Form */}
        <div className="w-full glass bg-[#0f172a]/50 backdrop-blur-2xl p-8 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden group animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>

          <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold px-4 py-3 rounded-xl animate-in slide-in-from-top-2">
                {error}
              </div>
            )}

            {mode === 'signup' && (
              <div className="space-y-2 animate-in slide-in-from-left-4 fade-in duration-300">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                <div className="relative group/input">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-indigo-400 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  </div>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-black/20 hover:bg-black/30 rounded-xl border border-white/10 text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 outline-none transition-all placeholder:text-slate-600 font-medium text-sm"
                    placeholder="Seu Nome"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">E-mail Corporativo</label>
              <div className="relative group/input">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-indigo-400 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" /></svg>
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-black/20 hover:bg-black/30 rounded-xl border border-white/10 text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 outline-none transition-all placeholder:text-slate-600 font-medium text-sm"
                  placeholder="voce@empresa.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Senha</label>
              <div className="relative group/input">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-indigo-400 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-black/20 hover:bg-black/30 rounded-xl border border-white/10 text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 outline-none transition-all placeholder:text-slate-600 font-medium text-sm"
                  placeholder={mode === 'signup' ? "Mínimo 6 caracteres" : "••••••••"}
                />
              </div>
            </div>

            {mode === 'signup' && (
              <div className="space-y-2 animate-in slide-in-from-left-4 fade-in duration-300">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Confirmar Senha</label>
                <div className="relative group/input">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-indigo-400 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-black/20 hover:bg-black/30 rounded-xl border border-white/10 text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 outline-none transition-all placeholder:text-slate-600 font-medium text-sm"
                    placeholder="Repita a senha"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-4 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-sm uppercase tracking-wider rounded-xl shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              <span>{mode === 'login' ? 'Acessar Plataforma' : 'Criar Conta'}</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#0f172a] px-4 text-slate-500 font-bold tracking-wider">ou</span>
            </div>
          </div>

          {/* Login com Google */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full py-4 bg-white hover:bg-gray-50 text-gray-800 font-bold text-sm rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-3 border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span>{isLoading ? 'Conectando...' : 'Continuar com Google'}</span>
          </button>

          {/* Toggle Login/Signup */}
          <div className="mt-6 pt-6 border-t border-white/5 text-center space-y-4">
            <button
              onClick={toggleMode}
              className="text-sm font-medium text-white hover:text-cyan-300 transition-colors"
            >
              {mode === 'login'
                ? <>Não tem uma conta? <span className="font-bold underline decoration-indigo-500 underline-offset-4">Criar conta</span></>
                : <>Já tem uma conta? <span className="font-bold underline decoration-indigo-500 underline-offset-4">Entrar</span></>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
