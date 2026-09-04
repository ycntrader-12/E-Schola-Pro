'use client';

import { useState, useRef, useEffect } from 'react';
import Link from "next/link";
import {
  ArrowRight,
  Sparkles,
  Volume2,
  VolumeX,
  BookOpen,
  Video,
  MessageSquare,
  ShieldCheck,
  Cpu,
  GraduationCap,
  Users,
  CheckCircle2,
  ChevronDown,
  Award,
  Lock,
  Server,
  Zap,
  UserCheck,
  School,
} from "lucide-react";
import { useTranslations } from 'next-intl';

export default function Home() {
  const t = useTranslations('Landing');
  const tAbout = useTranslations('About');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Sound ON by default
    video.muted = false;
    video.volume = 1.0;

    const attemptPlayWithSound = async () => {
      try {
        await video.play();
        setIsMuted(false);
      } catch {
        // If browser policy blocks unmuted autoplay before user interaction,
        // start playing muted and automatically unmute on first user interaction anywhere
        video.muted = true;
        setIsMuted(true);
        await video.play().catch(() => {});

        const handleUserInteraction = () => {
          if (video) {
            video.muted = false;
            setIsMuted(false);
            video.play().catch(() => {});
          }
          window.removeEventListener('click', handleUserInteraction);
          window.removeEventListener('keydown', handleUserInteraction);
          window.removeEventListener('touchstart', handleUserInteraction);
        };

        window.addEventListener('click', handleUserInteraction, { once: true });
        window.addEventListener('keydown', handleUserInteraction, { once: true });
        window.addEventListener('touchstart', handleUserInteraction, { once: true });
      }
    };

    attemptPlayWithSound();
  }, []);

  const toggleSound = () => {
    if (videoRef.current) {
      const nextMuteState = !isMuted;
      videoRef.current.muted = nextMuteState;
      setIsMuted(nextMuteState);
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      }
    }
  };

  const scrollToAbout = () => {
    const element = document.getElementById('about');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="relative w-full overflow-x-hidden select-none bg-slate-950 text-slate-100">
      
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 1. HERO SECTION : FULLSCREEN IMMERSIVE VIDEO CANVAS             */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="relative w-full h-[calc(100vh-4rem)] min-h-[600px] overflow-hidden flex flex-col justify-end items-center pb-6 sm:pb-8 px-4">
        
        {/* 100% Full Visual Canvas Video */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <video 
            ref={videoRef}
            src="/videos/vids_anime.mp4" 
            autoPlay 
            loop 
            playsInline
            className="w-full h-full object-cover object-center" 
          />
          {/* Subtle bottom shadow to ensure floating controls are crisp */}
          <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent pointer-events-none" />
        </div>

        {/* Minimized Floating Glass Action Bar */}
        <div className="relative z-10 w-full max-w-2xl animate-fade-in-up">
          <div className="bg-white/95 hover:bg-white backdrop-blur-2xl border border-white/90 shadow-2xl shadow-slate-950/40 rounded-2xl p-3 sm:px-6 sm:py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 transition-all duration-300">
            
            {/* Brand & Mini Tagline */}
            <div className="flex items-center gap-3 text-center sm:text-left">
              <div className="w-9 h-9 rounded-xl bg-[#1877f2] flex items-center justify-center text-white shadow-md shadow-blue-500/30 shrink-0">
                <Sparkles size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-black tracking-tight text-slate-900">
                    E-Schola <span className="text-[#1877f2]">Pro</span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                  {t('tagline')}
                </p>
              </div>
            </div>

            {/* Actions + Sound Toggle + About Jump Button */}
            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-center flex-wrap sm:flex-nowrap">
              <button
                onClick={toggleSound}
                type="button"
                className="p-2 rounded-xl text-slate-700 bg-slate-100/90 hover:bg-slate-200/90 border border-slate-200/80 active:scale-95 transition-all cursor-pointer flex items-center justify-center shrink-0"
                title={isMuted ? "Activer le son" : "Désactiver le son"}
                aria-label={isMuted ? "Activer le son" : "Désactiver le son"}
              >
                {isMuted ? (
                  <VolumeX size={17} className="text-slate-500" />
                ) : (
                  <Volume2 size={17} className="text-[#1877f2] animate-pulse" />
                )}
              </button>

              <button
                onClick={scrollToAbout}
                type="button"
                className="px-3 py-2 rounded-xl font-bold text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                title={tAbout('nav_link')}
              >
                <span>{tAbout('nav_link')}</span>
                <ChevronDown size={14} className="text-[#1877f2]" />
              </button>

              <Link 
                href="/login" 
                className="px-4 py-2 rounded-xl font-bold text-xs text-white bg-[#1877f2] hover:bg-[#166fe5] hover:shadow-md hover:shadow-blue-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-blue-500/20 cursor-pointer"
              >
                <span>{t('cta_login')}</span>
                <ArrowRight size={13} />
              </Link>

              <Link 
                href="/register" 
                className="px-3.5 py-2 rounded-xl font-bold text-xs text-[#1877f2] bg-blue-50/90 hover:bg-blue-100 border border-blue-200 active:scale-[0.98] transition-all shadow-xs cursor-pointer flex items-center justify-center"
              >
                <span>{t('cta_register')}</span>
              </Link>
            </div>

          </div>
        </div>

        {/* Floating Scroll Indicator */}
        <button
          onClick={scrollToAbout}
          type="button"
          className="relative z-10 mt-3 text-white/80 hover:text-white flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase transition-colors cursor-pointer animate-bounce"
        >
          <span>{tAbout('nav_link')}</span>
          <ChevronDown size={16} />
        </button>

      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 2. SECTION À PROPOS (ABOUT E-SCHOLA PRO)                        */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section id="about" className="relative z-10 w-full py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[250px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-6xl mx-auto space-y-16">
          
          {/* Section Header */}
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[#38bdf8] text-xs font-extrabold uppercase tracking-wider">
              <Sparkles size={14} className="text-blue-400" />
              <span>{tAbout('badge')}</span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
              {tAbout('title')}
            </h2>

            <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
              {tAbout('subtitle')}
            </p>
          </div>

          {/* Mission Card */}
          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-blue-900/20 via-slate-900 to-indigo-900/20 border border-blue-500/20 shadow-xl backdrop-blur-xl flex flex-col md:flex-row items-center gap-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-500/25">
              <School size={28} />
            </div>
            <div className="space-y-2 text-center md:text-left">
              <h3 className="text-xl font-black text-white tracking-tight">
                {tAbout('mission_title')}
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                {tAbout('mission_desc')}
              </p>
            </div>
          </div>

          {/* 4 Pillars of Excellence */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            
            {/* Pillar 1 */}
            <div className="p-6 rounded-2xl bg-slate-900/60 hover:bg-slate-900/90 border border-slate-800 hover:border-blue-500/40 transition-all duration-300 group space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-11 h-11 rounded-xl bg-blue-500/10 group-hover:bg-blue-500/20 text-blue-400 flex items-center justify-center transition-colors">
                  <BookOpen size={22} />
                </div>
                <h4 className="text-base font-bold text-white tracking-tight group-hover:text-blue-400 transition-colors">
                  {tAbout('pillar1_title')}
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {tAbout('pillar1_desc')}
                </p>
              </div>
              <div className="pt-3 border-t border-slate-800/80 flex items-center gap-1.5 text-[11px] font-bold text-blue-400">
                <CheckCircle2 size={13} />
                <span>Cours & Vidéos HD</span>
              </div>
            </div>

            {/* Pillar 2 */}
            <div className="p-6 rounded-2xl bg-slate-900/60 hover:bg-slate-900/90 border border-slate-800 hover:border-emerald-500/40 transition-all duration-300 group space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/10 group-hover:bg-emerald-500/20 text-emerald-400 flex items-center justify-center transition-colors">
                  <Video size={22} />
                </div>
                <h4 className="text-base font-bold text-white tracking-tight group-hover:text-emerald-400 transition-colors">
                  {tAbout('pillar2_title')}
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {tAbout('pillar2_desc')}
                </p>
              </div>
              <div className="pt-3 border-t border-slate-800/80 flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
                <CheckCircle2 size={13} />
                <span>Visioconférence & Partage</span>
              </div>
            </div>

            {/* Pillar 3 */}
            <div className="p-6 rounded-2xl bg-slate-900/60 hover:bg-slate-900/90 border border-slate-800 hover:border-purple-500/40 transition-all duration-300 group space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-11 h-11 rounded-xl bg-purple-500/10 group-hover:bg-purple-500/20 text-purple-400 flex items-center justify-center transition-colors">
                  <MessageSquare size={22} />
                </div>
                <h4 className="text-base font-bold text-white tracking-tight group-hover:text-purple-400 transition-colors">
                  {tAbout('pillar3_title')}
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {tAbout('pillar3_desc')}
                </p>
              </div>
              <div className="pt-3 border-t border-slate-800/80 flex items-center gap-1.5 text-[11px] font-bold text-purple-400">
                <CheckCircle2 size={13} />
                <span>Inbox & Anti-XSS</span>
              </div>
            </div>

            {/* Pillar 4 */}
            <div className="p-6 rounded-2xl bg-slate-900/60 hover:bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 transition-all duration-300 group space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-11 h-11 rounded-xl bg-amber-500/10 group-hover:bg-amber-500/20 text-amber-400 flex items-center justify-center transition-colors">
                  <Cpu size={22} />
                </div>
                <h4 className="text-base font-bold text-white tracking-tight group-hover:text-amber-400 transition-colors">
                  {tAbout('pillar4_title')}
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {tAbout('pillar4_desc')}
                </p>
              </div>
              <div className="pt-3 border-t border-slate-800/80 flex items-center gap-1.5 text-[11px] font-bold text-amber-400">
                <CheckCircle2 size={13} />
                <span>Railway Cloud & WebP</span>
              </div>
            </div>

          </div>

          {/* Key Metrics / Stat Counters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 sm:p-8 rounded-3xl bg-slate-900/40 border border-slate-800 backdrop-blur-xl">
            <div className="text-center space-y-1 p-3">
              <div className="text-3xl sm:text-4xl font-black text-[#38bdf8] tracking-tight">
                {tAbout('stat1_value')}
              </div>
              <div className="text-xs text-slate-400 font-medium">
                {tAbout('stat1_label')}
              </div>
            </div>

            <div className="text-center space-y-1 p-3 border-l border-slate-800">
              <div className="text-3xl sm:text-4xl font-black text-[#818cf8] tracking-tight">
                {tAbout('stat2_value')}
              </div>
              <div className="text-xs text-slate-400 font-medium">
                {tAbout('stat2_label')}
              </div>
            </div>

            <div className="text-center space-y-1 p-3 border-l-0 md:border-l border-slate-800">
              <div className="text-3xl sm:text-4xl font-black text-[#34d399] tracking-tight">
                {tAbout('stat3_value')}
              </div>
              <div className="text-xs text-slate-400 font-medium">
                {tAbout('stat3_label')}
              </div>
            </div>

            <div className="text-center space-y-1 p-3 border-l border-slate-800">
              <div className="text-3xl sm:text-4xl font-black text-[#f59e0b] tracking-tight">
                {tAbout('stat4_value')}
              </div>
              <div className="text-xs text-slate-400 font-medium">
                {tAbout('stat4_label')}
              </div>
            </div>
          </div>

          {/* User Roles Dedicated Cards */}
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {tAbout('roles_title')}
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Students */}
              <div className="p-6 rounded-2xl bg-gradient-to-b from-blue-950/30 to-slate-900 border border-blue-500/20 space-y-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold">
                  <GraduationCap size={24} />
                </div>
                <h4 className="text-lg font-bold text-white">
                  {tAbout('role_student_title')}
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {tAbout('role_student_desc')}
                </p>
              </div>

              {/* Trainers */}
              <div className="p-6 rounded-2xl bg-gradient-to-b from-purple-950/30 to-slate-900 border border-purple-500/20 space-y-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold">
                  <UserCheck size={24} />
                </div>
                <h4 className="text-lg font-bold text-white">
                  {tAbout('role_trainer_title')}
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {tAbout('role_trainer_desc')}
                </p>
              </div>

              {/* Admins */}
              <div className="p-6 rounded-2xl bg-gradient-to-b from-amber-950/30 to-slate-900 border border-amber-500/20 space-y-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
                  <ShieldCheck size={24} />
                </div>
                <h4 className="text-lg font-bold text-white">
                  {tAbout('role_admin_title')}
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {tAbout('role_admin_desc')}
                </p>
              </div>

            </div>
          </div>

          {/* Security & Confidentiality Banner */}
          <div className="p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                <Lock size={22} />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">
                  {tAbout('security_title')}
                </h4>
                <p className="text-xs text-slate-400">
                  Normes de protection de niveau bancaire et universitaire
                </p>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {tAbout('security_desc')}
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <span className="px-3 py-1 rounded-lg text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                🔐 Hachage Bcrypt
              </span>
              <span className="px-3 py-1 rounded-lg text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                🛡️ Headers OWASP Hardened
              </span>
              <span className="px-3 py-1 rounded-lg text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                ⚡ Rate Limiting Anti-DoS
              </span>
              <span className="px-3 py-1 rounded-lg text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                🐘 PostgreSQL Railway Cloud
              </span>
              <span className="px-3 py-1 rounded-lg text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                🖼️ Avatars WebP Base64 Intégrés
              </span>
            </div>
          </div>

          {/* Bottom Call to Action (CTA) */}
          <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-blue-600 via-[#1877f2] to-indigo-600 text-white shadow-2xl shadow-blue-500/25 text-center space-y-6">
            <div className="max-w-2xl mx-auto space-y-3">
              <h3 className="text-2xl sm:text-4xl font-black tracking-tight">
                {tAbout('cta_title')}
              </h3>
              <p className="text-sm sm:text-base text-blue-100">
                {tAbout('cta_subtitle')}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/register"
                className="px-6 py-3 rounded-xl bg-white text-[#1877f2] font-black text-sm hover:bg-blue-50 hover:shadow-lg active:scale-95 transition-all shadow-md flex items-center gap-2"
              >
                <span>{tAbout('cta_button')}</span>
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/login"
                className="px-6 py-3 rounded-xl bg-blue-700/60 hover:bg-blue-700 border border-white/30 text-white font-bold text-sm active:scale-95 transition-all"
              >
                <span>{t('cta_login')}</span>
              </Link>
            </div>
          </div>

          {/* Footer Bar */}
          <div className="pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="font-semibold text-slate-300">E-Schola Pro v1.0.0</span>
              <span>— {tAbout('footer_rights')}</span>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-slate-400">FastAPI • Next.js 15 • PostgreSQL Railway</span>
            </div>
          </div>

        </div>

      </section>

    </div>
  );
}
