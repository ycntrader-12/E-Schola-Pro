'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { Cpu, Eye, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations('Auth');
  const tCommon = useTranslations('Common');
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
      const response = await apiClient.post('/login/access-token', {
        username: email,
        email: email,
        password: password
      });
      
      localStorage.setItem('access_token', response.data.access_token);
      document.cookie = `access_token=${response.data.access_token}; path=/; max-age=86400; SameSite=Lax`;
      router.push('/dashboard');
    } catch (err: any) {
      if (err?.response?.status === 400 || err?.response?.status === 401) {
        setError(err?.response?.data?.detail || t('error') || 'Identifiants incorrects (email ou mot de passe)');
      } else if (err?.response?.status >= 500) {
        setError('Le serveur backend est temporairement indisponible (Erreur 500/502).');
      } else if (err?.message === 'Network Error' || !err?.response) {
        setError('Impossible de contacter le serveur backend. Vérifiez votre connexion.');
      } else {
        setError(err?.response?.data?.detail || t('error') || 'Une erreur est survenue lors de la connexion');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center pt-24 pb-12 px-4 select-none bg-white">
      
      {/* Back Button */}
      <div className="absolute top-6 left-6 z-20">
        <BackButton />
      </div>

      {/* Login Card (Pure White with Crisp Slate Borders) */}
      <div className="relative z-10 w-full max-w-md p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-xl space-y-5 my-auto transition-all">
        
        {/* Header with Tech Chip Badge */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#1877f2] text-[10px] font-extrabold uppercase tracking-wider shadow-xs">
            <Cpu size={13} className="text-[#1877f2] animate-pulse" />
            <span>E-Schola Pro Security</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {t('login_title')}
          </h2>
          <p className="text-slate-500 text-xs sm:text-sm">
            {t('login_subtitle')}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-xs text-center font-semibold">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              {t('email')}
            </label>
            <input 
              type="text" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 text-slate-900 text-xs outline-none transition-all placeholder-slate-400 shadow-xs"
              placeholder="you@example.com ou admin"
            />
          </div>
          
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              {t('password')}
            </label>
            <div className="relative">
              <input 
                type={showPassword ? 'text' : 'password'} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-white border border-slate-300 focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 text-slate-900 text-xs outline-none transition-all placeholder-slate-400 shadow-xs"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-[#1877f2] transition-colors cursor-pointer"
                title={showPassword ? t('hide_password') : t('show_password')}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 mt-2 rounded-xl text-xs font-extrabold text-white bg-[#1877f2] hover:bg-[#166fe5] hover:scale-[1.005] active:scale-[0.99] transition-all shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>{loading ? tCommon('loading') : t('submit_login')}</span>
          </button>
        </form>

        {/* Sign up prompt */}
        <div className="text-center text-xs text-slate-500 pt-3 border-t border-slate-100">
          {t('no_account')}{' '}
          <Link href="/register" className="text-[#1877f2] font-bold hover:underline">
            {t('sign_up_link')}
          </Link>
        </div>

      </div>

    </div>
  );
}
