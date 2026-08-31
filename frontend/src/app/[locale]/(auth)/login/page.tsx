'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { ShieldCheck, Cpu, Eye, EyeOff } from 'lucide-react';
import BackButton from '@/components/BackButton';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('username', email);
      formData.append('password', password);

      const response = await apiClient.post('/login/access-token', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      
      localStorage.setItem('access_token', response.data.access_token);
      document.cookie = `access_token=${response.data.access_token}; path=/; max-age=86400; SameSite=Lax`;
      router.push('/dashboard');
    } catch {
      setError('Identifiants incorrects (email ou mot de passe)');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center pt-24 pb-12 px-4 overflow-y-auto select-none">
      


      {/* Back Button */}
      <div className="absolute top-6 left-6 z-20">
        <BackButton />
      </div>

      {/* 3. Ambient Glowing Red Lights */}
      <div className="fixed top-1/4 left-1/4 w-96 h-96 bg-red-500/15 dark:bg-red-600/25 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="fixed bottom-1/4 right-1/4 w-96 h-96 bg-rose-500/15 dark:bg-rose-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* 4. Login Card (Adaptive: Pure Glass in Light Mode, Smoked Glass in Dark Mode) */}
      <div className="relative z-10 w-full max-w-md p-6 sm:p-8 rounded-3xl backdrop-blur-2xl bg-white/80 dark:bg-black/65 border border-red-500/20 dark:border-red-500/40 shadow-2xl shadow-red-950/10 dark:shadow-[0_0_60px_-10px_rgba(220,38,38,0.45)] space-y-4 my-auto transition-all">
        
        {/* Header with Tech Chip Badge */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-red-500/10 dark:bg-red-500/20 border border-red-500/30 dark:border-red-500/40 text-red-700 dark:text-red-300 text-[10px] font-extrabold uppercase tracking-wider backdrop-blur-md">
            <Cpu size={12} className="text-red-600 dark:text-red-400 animate-pulse" />
            <span>Plateforme Sécurisée E-Schola</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Bienvenue
          </h2>
          <p className="text-slate-600 dark:text-gray-400 text-xs sm:text-sm">
            Connectez-vous à votre espace académique
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/40 text-red-600 dark:text-red-400 p-3 rounded-xl text-xs text-center font-semibold">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider mb-1">
              Email ou Nom d'utilisateur
            </label>
            <input 
              type="text" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/90 dark:bg-black/60 border border-slate-200 dark:border-white/10 focus:border-red-600 dark:focus:border-red-500 text-slate-900 dark:text-white text-xs outline-none transition-all placeholder-gray-400 dark:placeholder-gray-500 shadow-sm"
              placeholder="you@example.com ou admin"
            />
          </div>
          
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider mb-1">
              Mot de Passe
            </label>
            <div className="relative">
              <input 
                type={showPassword ? 'text' : 'password'} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-white/90 dark:bg-black/60 border border-slate-200 dark:border-white/10 focus:border-red-600 dark:focus:border-red-500 text-slate-900 dark:text-white text-xs outline-none transition-all placeholder-gray-400 dark:placeholder-gray-500 shadow-sm"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-500 transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 mt-1 rounded-xl text-xs font-extrabold text-white bg-gradient-to-r from-red-600 via-red-500 to-rose-600 hover:from-red-500 hover:to-rose-500 hover:scale-[1.01] active:scale-[0.99] transition-all shadow-lg shadow-red-600/30 dark:shadow-red-600/35 border border-red-400/30 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>{loading ? 'Connexion en cours...' : 'Se Connecter'}</span>
          </button>
        </form>

        {/* Sign up prompt */}
        <div className="text-center text-xs text-slate-600 dark:text-gray-400 pt-2 border-t border-slate-200 dark:border-white/10">
          Vous n'avez pas de compte ?{' '}
          <Link href="/register" className="text-red-600 dark:text-red-400 font-bold hover:underline">
            S'inscrire
          </Link>
        </div>

      </div>

    </div>
  );
}
