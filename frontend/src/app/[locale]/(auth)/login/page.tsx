'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Link, useRouter } from '@/i18n/routing';
import { apiClient } from '@/lib/api';
import { Cpu, Eye, EyeOff, Mail, ShieldAlert, AlertCircle } from 'lucide-react';
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
  const [isAccountDeactivated, setIsAccountDeactivated] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsAccountDeactivated(false);
    setLoading(true);
    try {
      const response = await apiClient.post('/login/access-token', {
        username: email,
        email: email,
        password: password
      });
      
      localStorage.setItem('access_token', response.data.access_token);
      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
      document.cookie = `access_token=${response.data.access_token}; path=/; max-age=86400; SameSite=Lax${isHttps ? '; Secure' : ''}`;
      try {
        const parts = response.data.access_token.split('.');
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(decodeURIComponent(escape(atob(base64))));
        if (payload.role) {
          localStorage.setItem('user_role', String(payload.role).trim().toLowerCase());
        }
      } catch {}
      router.push('/dashboard');
    } catch (err: any) {
      const detailMsg = err?.response?.data?.detail || '';
      const isForbidden = err?.response?.status === 403;
      const isDeactivated = isForbidden || detailMsg.toLowerCase().includes('désactivé') || detailMsg.toLowerCase().includes('desactive');

      if (isDeactivated) {
        setIsAccountDeactivated(true);
        setError(detailMsg || "Votre compte a été désactivé par l'administration. Veuillez contacter l'administration pour réactiver votre accès.");
      } else if (err?.response?.status === 400 || err?.response?.status === 401) {
        setError(detailMsg || t('error') || 'Identifiants incorrects (email ou mot de passe)');
      } else if (err?.response?.status >= 500) {
        setError('Le serveur backend est temporairement indisponible (Erreur 500/502).');
      } else if (err?.message === 'Network Error' || !err?.response) {
        setError('Impossible de contacter le serveur backend. Vérifiez votre connexion.');
      } else {
        setError(detailMsg || t('error') || 'Une erreur est survenue lors de la connexion');
      }
    } finally {
      setLoading(false);
    }
  };

  const contactAdminMailto = `mailto:contact@eschola.pro?subject=${encodeURIComponent('Demande de réactivation de compte E-Schola Pro')}&body=${encodeURIComponent(`Bonjour l'administration E-Schola Pro,\n\nMon compte (${email.trim() || 'mon email'}) a été désactivé. Je sollicite la réactivation de mes accès à la plateforme.\n\nIdentifiant/Email : ${email.trim() || 'N/A'}\n\nMerci d'avance.`)}`;

  return (
    <div className="min-h-screen relative flex items-center justify-center pt-24 pb-12 px-4 select-none bg-white">
      
      {/* Back Button */}
      <div className="absolute top-6 left-6 z-20">
        <BackButton />
      </div>

      {/* Login Card (Pure White with Crisp Slate Borders) */}
      <div className="relative z-10 w-full max-w-md p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-xl space-y-5 my-auto transition-all">
        
        {/* Header with Tech Chip Badge */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <Link href="/" className="inline-block group" title="Accueil E-Schola Pro">
              <div className="relative w-14 h-14 rounded-2xl overflow-hidden shadow-md shadow-blue-500/10 group-hover:scale-105 transition-transform">
                <Image
                  src="/images/logo_icon_transparent.png"
                  alt="E-Schola Pro"
                  width={56}
                  height={56}
                  className="w-full h-full object-contain"
                  priority
                />
              </div>
            </Link>
          </div>

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

        {/* Error Alert / Deactivated Account Alert */}
        {error && (
          isAccountDeactivated ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-3 shadow-xs animate-fade-in">
              <div className="flex items-start gap-2.5">
                <ShieldAlert size={20} className="text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-rose-900">Accès Compte Désactivé</p>
                  <p className="leading-relaxed text-[11px] text-rose-700">{error}</p>
                </div>
              </div>
              <div className="pt-2 border-t border-rose-200/60 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <a
                  href={contactAdminMailto}
                  className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] flex items-center justify-center gap-2 transition-colors shadow-xs"
                >
                  <Mail size={14} />
                  <span>Contacter l'Administration</span>
                </a>
                <span className="text-[10px] text-rose-600 font-mono text-center sm:text-left self-center">
                  contact@eschola.pro
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-xs text-center font-semibold flex items-center justify-center gap-2">
              <AlertCircle size={15} className="shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )
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
