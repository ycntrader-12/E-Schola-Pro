'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { UserPlus, Eye, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';

export default function RegisterPage() {
  const router = useRouter();
  const t = useTranslations('Auth');
  const tRoles = useTranslations('Roles');
  const tCommon = useTranslations('Common');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [role, setRole] = useState('étudiant');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t('confirm_password') + ' != ' + t('password'));
      return;
    }

    if (['formateur', 'admin', 'admin_manager', 'admin_limited', 'pedagogique'].includes(role)) {
      setError("Ce rôle privilégié ne peut pas être choisi lors de l'inscription publique.");
      return;
    }

    setLoading(true);
    try {
      // 1. Create the user
      await apiClient.post('/users/', {
        email,
        password,
        role
      });

      // 2. Automatically log them in
      const loginResponse = await apiClient.post('/login/access-token', {
        username: email,
        email: email,
        password: password
      });
      
      localStorage.setItem('access_token', loginResponse.data.access_token);
      document.cookie = `access_token=${loginResponse.data.access_token}; path=/; max-age=86400; SameSite=Lax`;
      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.detail || tCommon('error'));
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

      {/* Registration Card (Pure White with Crisp Slate Borders) */}
      <div className="relative z-10 w-full max-w-md p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-xl space-y-4 my-auto transition-all">
        
        {/* Header with Badge */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-[#1877f2] text-[10px] font-extrabold uppercase tracking-wider shadow-xs">
            <UserPlus size={12} className="text-[#1877f2]" />
            <span>E-Schola Pro</span>
          </div>

          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            {t('register_title')}
          </h2>
          <p className="text-slate-500 text-xs">
            {t('register_subtitle')}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-2.5 rounded-xl text-xs text-center font-semibold">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleRegister} className="space-y-3 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              {t('email')}
            </label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 text-slate-900 text-xs outline-none transition-all placeholder-slate-400 shadow-xs"
              placeholder="etudiant@eschola.pro"
            />
          </div>
          
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              {t('role')}
            </label>
            <select 
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 text-slate-900 text-xs outline-none transition-all cursor-pointer shadow-xs font-medium"
            >
              <option value="étudiant">{tRoles('etudiant')}</option>
              <option value="stagiaire">{tRoles('stagiaire')}</option>
              <option value="employer">{tRoles('employer')}</option>
            </select>
          </div>
          
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
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

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              {t('confirm_password')}
            </label>
            <div className="relative">
              <input 
                type={showConfirmPassword ? 'text' : 'password'} 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-white border border-slate-300 focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 text-slate-900 text-xs outline-none transition-all placeholder-slate-400 shadow-xs"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-[#1877f2] transition-colors cursor-pointer"
                title={showConfirmPassword ? t('hide_password') : t('show_password')}
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 mt-1 rounded-xl text-xs font-extrabold text-white bg-[#1877f2] hover:bg-[#166fe5] hover:scale-[1.005] active:scale-[0.99] transition-all shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>{loading ? tCommon('loading') : t('submit_register')}</span>
          </button>
        </form>

        {/* Sign in prompt */}
        <div className="text-center text-xs text-slate-500 pt-2 border-t border-slate-100">
          {t('already_account')}{' '}
          <Link href="/login" className="text-[#1877f2] font-bold hover:underline">
            {t('sign_in_link')}
          </Link>
        </div>

      </div>

    </div>
  );
}
