'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Link } from '@/i18n/routing';
import { apiClient } from '@/lib/api';
import {
  Mail,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  KeyRound,
  ShieldCheck,
  Binary,
  RefreshCw,
  Eye,
  EyeOff,
  Lock,
  Check,
  Clock,
  RotateCcw,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButton';

type Step = 'email' | 'code' | 'password' | 'success';

export default function ForgotPasswordPage() {
  const t = useTranslations('Auth');
  const tCommon = useTranslations('Common');

  const [step, setStep] = useState<Step>('email');

  // Étape 1 : Email
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailMessage, setEmailMessage] = useState('');
  const [emailError, setEmailError] = useState('');

  // Étape 2 : Code OTP de confirmation
  const [validationCode, setValidationCode] = useState('');
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [resendingCode, setResendingCode] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // État du serveur SMTP
  const [smtpActive, setSmtpActive] = useState<boolean | null>(null);

  // Cooldown timer pour le renvoi de code (évite les abus & fuites de mémoire)
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Étape 3 : Nouveau mot de passe
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Calcul de la robustesse du mot de passe
  const getPasswordStrength = (pwd: string): { label: string; color: string; textColor: string; score: number } => {
    if (!pwd) return { label: '', color: 'bg-slate-200', textColor: 'text-slate-400', score: 0 };
    let score = 0;
    if (pwd.length >= 6) score += 1;
    if (pwd.length >= 10) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 1) return { label: 'Faible', color: 'bg-rose-500', textColor: 'text-rose-600', score: 25 };
    if (score <= 3) return { label: 'Moyen', color: 'bg-amber-500', textColor: 'text-amber-600', score: 65 };
    return { label: 'Fort', color: 'bg-emerald-500', textColor: 'text-emerald-600', score: 100 };
  };

  const strength = getPasswordStrength(newPassword);

  // Envoi initial de la demande par email
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    setEmailMessage('');
    setLoading(true);

    try {
      const response = await apiClient.post('/auth/forgot-password', {
        email: email.trim(),
      });
      const data = response.data || {};
      setEmailMessage(
        data.message ||
        "Si l'adresse saisie correspond à un compte actif sur la plateforme, un code de validation à 6 chiffres vous a été envoyé par e-mail."
      );
      setSmtpActive(data.smtp_active ?? false);
      setValidationCode('');
      setResendCooldown(60);
      setRemainingAttempts(5);
      setIsLocked(false);
      setStep('code');
    } catch (err: unknown) {
      const errorObj = err as { response?: { status?: number; data?: { detail?: string } }; message?: string };
      const detailMsg = errorObj?.response?.data?.detail;
      if (errorObj?.response?.status === 429) {
        setEmailError("Trop de tentatives effectuées. Veuillez patienter quelques minutes avant de réessayer.");
      } else if (errorObj?.message === 'Network Error' || !errorObj?.response) {
        setEmailError("Impossible de contacter le serveur backend. Veuillez vérifier votre connexion.");
      } else {
        setEmailError(detailMsg || "Une erreur est survenue lors de l'envoi de la demande. Veuillez réessayer.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Renvoi d'un nouveau code OTP avec cooldown anti-abus
  const handleResendCode = async () => {
    if (resendCooldown > 0 || resendingCode) return;
    setResendingCode(true);
    setCodeError('');

    try {
      const response = await apiClient.post('/auth/forgot-password', {
        email: email.trim(),
      });
      const data = response.data || {};
      setEmailMessage(
        data.message ||
        "Un nouveau code de validation à 6 chiffres vous a été envoyé par e-mail."
      );
      setSmtpActive(data.smtp_active ?? false);
      setValidationCode('');
      setResendCooldown(60);
      setIsLocked(false);
      setRemainingAttempts(5);
    } catch (err: unknown) {
      const errorObj = err as { response?: { status?: number; data?: { detail?: string } } };
      if (errorObj?.response?.status === 429) {
        setCodeError("Limite de demandes atteinte. Veuillez patienter avant de renvoyer un code.");
      } else {
        setCodeError("Impossible de renvoyer un code. Veuillez réessayer.");
      }
    } finally {
      setResendingCode(false);
    }
  };


  // Validation sécurisée du code OTP
  const handleConfirmCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) {
      setCodeError("Ce code est bloqué suite à trop d'échecs. Veuillez faire une nouvelle demande.");
      return;
    }

    const cleanCode = validationCode.trim().replace(/\s+/g, '');
    if (!cleanCode) {
      setCodeError('Veuillez saisir votre code de validation.');
      return;
    }
    if (cleanCode.length < 4) {
      setCodeError('Le code de validation semble incomplet.');
      return;
    }

    setCodeError('');
    setVerifyingCode(true);

    try {
      const response = await apiClient.post('/auth/verify-reset-code', {
        email: email.trim(),
        code: cleanCode,
      });

      if (response.data && response.data.valid) {
        setResetToken(response.data.reset_token);
        setMaskedEmail(response.data.masked_email || null);
        setStep('password');
      } else {
        const remaining = response.data?.remaining_attempts;
        if (remaining !== undefined) {
          setRemainingAttempts(remaining);
          if (remaining === 0) {
            setIsLocked(true);
          }
        }
        setCodeError(response.data?.message || "Code de validation incorrect ou expiré.");
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { status?: number; data?: { detail?: string } } };
      const detailMsg = errorObj?.response?.data?.detail;
      if (errorObj?.response?.status === 429) {
        setCodeError("Trop d'essais infructueux. Veuillez patienter un instant.");
      } else {
        setCodeError(detailMsg || "Code invalide ou expiré. Veuillez vérifier le code reçu par email.");
      }
    } finally {
      setVerifyingCode(false);
    }
  };

  // Enregistrement définitif du nouveau mot de passe avec le reset_token
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (newPassword.length < 6) {
      setPasswordError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setResettingPassword(true);

    try {
      await apiClient.post('/auth/reset-password', {
        reset_token: resetToken,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setStep('success');
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { detail?: string } } };
      const detailMsg = errorObj?.response?.data?.detail;
      setPasswordError(detailMsg || "Une erreur est survenue lors de la réinitialisation. Veuillez réessayer.");
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center pt-24 pb-12 px-4 select-none bg-white">
      {/* Back Button */}
      <div className="absolute top-6 left-6 z-20">
        <BackButton />
      </div>

      {/* Main Card */}
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

          {step === 'email' && (
            <>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#1877f2] text-[10px] font-extrabold uppercase tracking-wider shadow-xs">
                <ShieldCheck size={13} className="text-[#1877f2]" />
                <span>Récupération Sécurisée</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Mot de passe oublié ?
              </h2>
              <p className="text-slate-500 text-xs sm:text-sm leading-relaxed">
                Saisissez votre adresse email. Nous vous enverrons un code de validation OTP à 6 chiffres.
              </p>
            </>
          )}

          {step === 'code' && (
            <>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#1877f2] text-[10px] font-extrabold uppercase tracking-wider shadow-xs">
                <Binary size={13} className="text-[#1877f2]" />
                <span>Vérification du Code OTP</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Confirmer le code
              </h2>
              <p className="text-slate-500 text-xs sm:text-sm leading-relaxed">
                Saisissez le code à 6 chiffres reçu dans votre boîte de réception.
              </p>
            </>
          )}

          {step === 'password' && (
            <>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-extrabold uppercase tracking-wider shadow-xs">
                <KeyRound size={13} className="text-emerald-600" />
                <span>Nouveau Mot de Passe</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Nouveau mot de passe
              </h2>
              <p className="text-slate-500 text-xs sm:text-sm leading-relaxed">
                Définissez et confirmez votre nouveau mot de passe sécurisé.
              </p>
            </>
          )}

          {step === 'success' && (
            <>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-extrabold uppercase tracking-wider shadow-xs">
                <CheckCircle2 size={13} className="text-emerald-600" />
                <span>Opération Réussie</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Félicitations !
              </h2>
              <p className="text-slate-500 text-xs sm:text-sm leading-relaxed">
                Votre mot de passe a été mis à jour et vos sessions précédentes ont été révoquées.
              </p>
            </>
          )}
        </div>

        {/* ÉTAPE 1 : Formulaire Email */}
        {step === 'email' && (
          <div className="space-y-4 animate-fade-in">
            {emailError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl text-xs font-medium flex items-center gap-2.5 animate-fade-in">
                <AlertCircle size={17} className="shrink-0 text-red-500" />
                <span>{emailError}</span>
              </div>
            )}

            <form onSubmit={handleEmailSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {t('email')}
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 pl-10 rounded-xl bg-white border border-slate-300 focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 text-slate-900 text-xs outline-none transition-all placeholder-slate-400 shadow-xs"
                    placeholder="votre.email@exemple.com"
                  />
                  <Mail size={16} className="absolute inset-y-0 left-3 my-auto text-slate-400 pointer-events-none" />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full py-3 mt-2 rounded-xl text-xs font-extrabold text-white bg-[#1877f2] hover:bg-[#166fe5] hover:scale-[1.005] active:scale-[0.99] disabled:opacity-50 transition-all shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer"
              >
                <KeyRound size={15} />
                <span>{loading ? tCommon('loading') : 'Envoyer le code OTP'}</span>
              </button>
            </form>

            <div className="text-center text-xs text-slate-500 pt-3 border-t border-slate-100">
              <Link href="/login" className="text-[#1877f2] font-bold hover:underline inline-flex items-center gap-1.5">
                <ArrowLeft size={14} />
                <span>Retour à la connexion</span>
              </Link>
            </div>
          </div>
        )}

        {/* ÉTAPE 2 : Saisie & Vérification du Code OTP */}
        {step === 'code' && (
          <div className="space-y-4 py-1 animate-fade-in">
            {/* Notification de transmission sécurisée par e-mail */}
            <div className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200 text-blue-950 space-y-2 text-xs animate-fade-in shadow-xs">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 size={18} className="text-[#1877f2] shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-900 text-xs">Code OTP transmis par e-mail</p>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-[#1877f2] border border-blue-200">
                      Confidentiel
                    </span>
                  </div>
                  <p className="leading-relaxed text-slate-600 text-[11px]">
                    {emailMessage}
                  </p>
                  <p className="text-[10px] text-slate-500 pt-0.5">
                    Veuillez vérifier votre boîte de réception ainsi que votre dossier Courriers indésirables / Spams. Le code reçu est strictement personnel et à usage unique.
                  </p>
                </div>
              </div>
            </div>


            {/* Boîte de confirmation du code */}
            <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-3">
              <div className="flex items-center justify-between text-slate-900">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Binary size={16} />
                  </div>
                  <div>
                    <h3 className="font-bold text-xs text-slate-900">Code de validation (6 chiffres)</h3>
                    <p className="text-[11px] text-slate-500">Valable 10 minutes</p>
                  </div>
                </div>

                {remainingAttempts !== null && (
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                    remainingAttempts > 2
                      ? 'bg-blue-100 text-blue-800 border-blue-200'
                      : 'bg-rose-100 text-rose-800 border-rose-200'
                  }`}>
                    {remainingAttempts} essai{remainingAttempts > 1 ? 's' : ''} restant{remainingAttempts > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {codeError && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-2.5 rounded-xl text-[11px] font-medium flex items-center gap-2 animate-fade-in">
                  <AlertCircle size={14} className="shrink-0 text-red-500" />
                  <span>{codeError}</span>
                </div>
              )}

              <form onSubmit={handleConfirmCode} className="space-y-2.5">
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={10}
                    disabled={isLocked}
                    value={validationCode}
                    onChange={(e) => {
                      setValidationCode(e.target.value.toUpperCase());
                      if (codeError) setCodeError('');
                    }}
                    placeholder="Ex: 849201"
                    className="w-full px-3.5 py-2.5 pl-10 rounded-xl bg-white border border-blue-200 focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 text-slate-900 font-mono font-bold text-sm tracking-widest text-center outline-none transition-all placeholder:text-slate-300 placeholder:font-normal placeholder:tracking-normal shadow-xs disabled:opacity-50"
                  />
                  <KeyRound size={15} className="absolute inset-y-0 left-3.5 my-auto text-blue-500 pointer-events-none" />
                </div>

                <button
                  type="submit"
                  disabled={verifyingCode || isLocked || !validationCode.trim()}
                  className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-[#1877f2] hover:bg-[#166fe5] active:scale-[0.99] disabled:opacity-50 transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {verifyingCode ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Vérification du code...</span>
                    </>
                  ) : (
                    <>
                      <span>Vérifier le code</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </form>

              {/* Bouton de renvoi avec cooldown anti-abus */}
              <div className="pt-1 flex items-center justify-between text-[11px] text-slate-500">
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  <span>Pas reçu ?</span>
                </span>
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resendCooldown > 0 || resendingCode}
                  className="font-bold text-[#1877f2] hover:underline disabled:opacity-50 disabled:no-underline flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                >
                  <RotateCcw size={12} className={resendingCode ? 'animate-spin' : ''} />
                  <span>
                    {resendCooldown > 0
                      ? `Renvoyer un code (${resendCooldown}s)`
                      : 'Renvoyer un nouveau code'}
                  </span>
                </button>
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <Link
                href="/login"
                className="w-full py-2.5 rounded-xl text-xs font-extrabold text-white bg-slate-800 hover:bg-slate-900 transition-all shadow-md shadow-slate-900/10 flex items-center justify-center gap-2"
              >
                <ArrowLeft size={15} />
                <span>Retour à la page de connexion</span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setEmailMessage('');
                  setValidationCode('');
                  setCodeError('');
                  setIsLocked(false);
                }}
                className="w-full py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                Changer d'adresse email
              </button>
            </div>
          </div>
        )}

        {/* ÉTAPE 3 : Définition du Nouveau Mot de Passe */}
        {step === 'password' && (
          <form onSubmit={handleResetPassword} className="space-y-4 text-xs animate-fade-in">
            {maskedEmail && (
              <div className="p-2.5 bg-blue-50/70 rounded-xl border border-blue-100 text-[11px] text-blue-900 flex items-center justify-between">
                <span className="font-medium text-slate-600">Compte validé :</span>
                <span className="font-mono font-bold text-blue-800">{maskedEmail}</span>
              </div>
            )}

            {passwordError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs font-medium flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0 text-red-500" />
                <span>{passwordError}</span>
              </div>
            )}

            {/* Nouveau mot de passe */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Nouveau mot de passe
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (passwordError) setPasswordError('');
                  }}
                  required
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 pl-10 pr-10 rounded-xl bg-white border border-slate-300 focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 text-slate-900 text-xs outline-none transition-all placeholder-slate-400 shadow-xs"
                />
                <Lock size={15} className="absolute inset-y-0 left-3.5 my-auto text-slate-400 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-[#1877f2] transition-colors cursor-pointer"
                  title={showPassword ? t('hide_password') : t('show_password')}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Barre de robustesse */}
              {newPassword.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold">
                    <span>Robustesse :</span>
                    <span className={strength.textColor}>{strength.label}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${strength.color}`}
                      style={{ width: `${strength.score}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Confirmer le mot de passe */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Confirmer le nouveau mot de passe
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (passwordError) setPasswordError('');
                  }}
                  required
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 pl-10 pr-10 rounded-xl bg-white border border-slate-300 focus:border-[#1877f2] focus:ring-2 focus:ring-blue-100 text-slate-900 text-xs outline-none transition-all placeholder-slate-400 shadow-xs"
                />
                <Lock size={15} className="absolute inset-y-0 left-3.5 my-auto text-slate-400 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-[#1877f2] transition-colors cursor-pointer"
                  title={showConfirmPassword ? t('hide_password') : t('show_password')}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {confirmPassword.length > 0 && (
                <p className={`text-[10px] mt-1.5 font-semibold flex items-center gap-1 ${
                  newPassword === confirmPassword ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {newPassword === confirmPassword ? (
                    <>
                      <Check size={12} />
                      <span>Les mots de passe correspondent</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={12} />
                      <span>Les mots de passe ne correspondent pas</span>
                    </>
                  )}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={resettingPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword || newPassword.length < 6}
              className="w-full py-3 rounded-xl text-xs font-extrabold text-white bg-[#1877f2] hover:bg-[#166fe5] hover:scale-[1.005] active:scale-[0.99] disabled:opacity-50 transition-all shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer"
            >
              {resettingPassword ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  <span>Réinitialisation en cours...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={15} />
                  <span>Réinitialiser le mot de passe</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep('code');
                setPasswordError('');
                setNewPassword('');
                setConfirmPassword('');
              }}
              className="w-full py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
            >
              ← Saisir un autre code
            </button>
          </form>
        )}

        {/* ÉTAPE 4 : Succès Final */}
        {step === 'success' && (
          <div className="space-y-5 py-2 animate-fade-in">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2 text-xs">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 size={22} className="text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-emerald-950 text-sm">Mot de passe modifié avec succès !</p>
                  <p className="leading-relaxed text-emerald-800 text-[11px]">
                    Votre nouveau mot de passe a été enregistré avec succès. Toutes vos sessions antérieures ont été révoquées pour votre sécurité.
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
      </div>
    </div>
  );
}
