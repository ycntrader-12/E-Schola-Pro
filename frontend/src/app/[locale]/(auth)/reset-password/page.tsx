'use client';

import { useState, useEffect, Suspense } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { Link, useRouter } from '@/i18n/routing';
import { apiClient } from '@/lib/api';
import { Eye, EyeOff, CheckCircle2, AlertCircle, ShieldCheck, Lock, ArrowRight, RefreshCw, Key, Binary } from 'lucide-react';
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlToken = searchParams.get('token') || '';

  const t = useTranslations('Auth');
  const tCommon = useTranslations('Common');

  const [activeToken, setActiveToken] = useState(urlToken);
  const [manualCode, setManualCode] = useState('');

  const [verifying, setVerifying] = useState(false);
  const [tokenValid, setTokenValid] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [verifyMessage, setVerifyMessage] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [formError, setFormError] = useState('');

  const verifyCodeOrToken = async (targetToken: string) => {
    if (!targetToken.trim()) return;
    setVerifying(true);
    setVerifyMessage('');
    setFormError('');

    try {
      const res = await apiClient.get(`/password-reset/verify-token/${encodeURIComponent(targetToken.trim())}`);
      if (res.data?.valid) {
        setTokenValid(true);
        setActiveToken(targetToken.trim());
        setMaskedEmail(res.data?.masked_email || null);
      } else {
        setTokenValid(false);
        setVerifyMessage(res.data?.message || "Le lien ou code de réinitialisation est invalide ou expiré.");
      }
    } catch (err: any) {
      setTokenValid(false);
      setVerifyMessage("Impossible de vérifier la validité du code. Veuillez vérifier votre connexion.");
    } finally {
      setVerifying(false);
    }
  };

  // Auto-verify token from URL on mount
  useEffect(() => {
    if (urlToken) {
      verifyCodeOrToken(urlToken);
    }
  }, [urlToken]);

  const handleManualVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      verifyCodeOrToken(manualCode.trim());
    }
  };

  // Password strength logic
  const getPasswordStrength = (pwd: string): { label: string; color: string; score: number } => {
    if (!pwd) return { label: '', color: 'bg-slate-200', score: 0 };
    let score = 0;
    if (pwd.length >= 6) score += 1;
    if (pwd.length >= 10) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 1) return { label: 'Faible', color: 'bg-rose-500', score: 20 };
    if (score <= 3) return { label: 'Moyen', color: 'bg-amber-500', score: 60 };
    return { label: 'Fort', color: 'bg-emerald-500', score: 100 };
  };

  const strength = getPasswordStrength(newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (newPassword.length < 6) {
      setFormError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);

    try {
      await apiClient.post('/password-reset/reset-password', {
        token: activeToken,
        new_password: newPassword,
      });
      setResetSuccess(true);
    } catch (err: any) {
      const detailMsg = err?.response?.data?.detail;
      setFormError(detailMsg || 'Une erreur est survenue lors de la réinitialisation. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative z-10 w-full max-w-md p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-xl space-y-5 my-auto transition-all">
      {/* Header */}
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
          <ShieldCheck size={13} className="text-[#1877f2]" />
          <span>Réinitialisation Sécurisée</span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Nouveau mot de passe
        </h2>
        <p className="text-slate-500 text-xs sm:text-sm leading-relaxed">
          Validez votre code à 6 chiffres ou votre lien puis définissez votre nouveau mot de passe.
        </p>
      </div>

      {/* Loading state while verifying token */}
      {verifying && (
        <div className="py-12 text-center space-y-3">
          <RefreshCw size={28} className="animate-spin text-[#1877f2] mx-auto" />
          <p className="text-slate-600 text-xs font-semibold">Vérification de la validité du code...</p>
        </div>
      )}

      {/* Reset Success View */}
      {resetSuccess && (
        <div className="space-y-5 py-2 animate-fade-in">
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2 text-xs">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 size={22} className="text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-emerald-950 text-sm">Mot de passe mis à jour !</p>
                <p className="leading-relaxed text-emerald-800 text-[11px]">
                  Votre mot de passe a été modifié avec succès. Vous pouvez désormais accéder à votre compte E-Schola Pro.
                </p>
              </div>
            </div>
          </div>

          <Link
            href="/login"
            className="w-full py-3 rounded-xl text-xs font-extrabold text-white bg-[#1877f2] hover:bg-[#166fe5] transition-all shadow-md shadow-blue-500/25 flex items-center justify-center gap-2"
          >
            <span>Se connecter maintenant</span>
            <ArrowRight size={15} />
          </Link>
        </div>
      )}

      {/* Manual Code Input View (If no token or token invalid) */}
      {!verifying && !tokenValid && !resetSuccess && (
        <div className="space-y-4 py-1 animate-fade-in">
          {verifyMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2.5">
              <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
              <span>{verifyMessage}</span>
            </div>
          )}

          <form onSubmit={handleManualVerify} className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Code de confirmation à 6 chiffres
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase().trim())}
                  required
                  maxLength={64}
                  className="w-full px-3.5 py-2.5 pl-10 rounded-xl bg-white border border-slate-300 focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 text-slate-900 font-mono tracking-widest text-center text-sm font-bold outline-none transition-all placeholder-slate-400 shadow-xs uppercase"
                  placeholder="EX: 849201"
                />
                <Binary size={16} className="absolute inset-y-0 left-3 my-auto text-slate-400 pointer-events-none" />
              </div>
            </div>

            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="w-full py-2.5 rounded-xl text-xs font-extrabold text-white bg-[#1877f2] hover:bg-[#166fe5] disabled:opacity-50 transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Key size={15} />
              <span>Valider le code de confirmation</span>
            </button>
          </form>

          <div className="pt-2 text-center">
            <Link href="/forgot-password" className="text-xs text-slate-500 hover:text-[#1877f2] font-semibold underline">
              Demander un nouveau code par email
            </Link>
          </div>
        </div>
      )}

      {/* Reset Password Form */}
      {!verifying && tokenValid && !resetSuccess && (
        <form onSubmit={handleSubmit} className="space-y-4 text-xs animate-fade-in">
          {maskedEmail && (
            <div className="p-2.5 bg-blue-50/70 rounded-xl border border-blue-100 text-[11px] text-blue-900 flex items-center justify-between">
              <span className="font-medium text-slate-600">Compte vérifié :</span>
              <span className="font-mono font-bold text-blue-800">{maskedEmail}</span>
            </div>
          )}

          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs font-medium flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-red-500" />
              <span>{formError}</span>
            </div>
          )}

          {/* New Password Input */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Nouveau mot de passe
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
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

            {/* Password strength indicator */}
            {newPassword.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold">
                  <span>Robustesse :</span>
                  <span className={strength.color.replace('bg-', 'text-')}>{strength.label}</span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${strength.color}`}
                    style={{ width: `${strength.score}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password Input */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
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
            disabled={loading || !newPassword || !confirmPassword}
            className="w-full py-3 mt-2 rounded-xl text-xs font-extrabold text-white bg-[#1877f2] hover:bg-[#166fe5] hover:scale-[1.005] active:scale-[0.99] disabled:opacity-50 transition-all shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Lock size={15} />
            <span>{loading ? tCommon('loading') : 'Réinitialiser le mot de passe'}</span>
          </button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen relative flex items-center justify-center pt-24 pb-12 px-4 select-none bg-white">
      {/* Back Button */}
      <div className="absolute top-6 left-6 z-20">
        <BackButton />
      </div>

      <Suspense
        fallback={
          <div className="relative z-10 w-full max-w-md p-8 rounded-3xl bg-white border border-slate-200 shadow-xl text-center space-y-3">
            <RefreshCw size={28} className="animate-spin text-[#1877f2] mx-auto" />
            <p className="text-slate-600 text-xs font-semibold">Chargement de l'interface...</p>
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
