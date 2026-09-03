import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { useTranslations } from 'next-intl';

export default function Home() {
  const t = useTranslations('Landing');
  const tNav = useTranslations('Navigation');

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] min-h-[550px] overflow-hidden flex flex-col justify-end items-center pb-6 sm:pb-8 px-4 select-none bg-slate-900">
      
      {/* 100% Full Visual Canvas */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <video 
          src="/videos/vids_anime.mp4" 
          autoPlay 
          loop 
          muted 
          playsInline
          className="w-full h-full object-cover object-center" 
        />
        {/* Subtle bottom shadow to ensure floating controls are crisp */}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-slate-950/40 to-transparent pointer-events-none" />
      </div>

      {/* Minimized Floating Glass Action Bar */}
      <div className="relative z-10 w-full max-w-xl animate-fade-in-up">
        <div className="bg-white/90 hover:bg-white/95 backdrop-blur-xl border border-white/80 shadow-2xl shadow-slate-950/25 rounded-2xl px-5 py-3 sm:px-6 sm:py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 transition-all duration-300">
          
          {/* Brand & Mini Tagline */}
          <div className="flex items-center gap-2.5 text-center sm:text-left">
            <div className="w-8 h-8 rounded-xl bg-[#1877f2] flex items-center justify-center text-white shadow-xs shrink-0">
              <Sparkles size={16} />
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

          {/* Minimized Actions */}
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-center">
            <Link 
              href="/login" 
              className="flex-1 sm:flex-initial px-4 py-2 rounded-xl font-bold text-xs text-white bg-[#1877f2] hover:bg-[#166fe5] hover:shadow-md hover:shadow-blue-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-blue-500/20 cursor-pointer"
            >
              <span>{t('cta_login')}</span>
              <ArrowRight size={13} />
            </Link>

            <Link 
              href="/register" 
              className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl font-bold text-xs text-[#1877f2] bg-blue-50/90 hover:bg-blue-100 border border-blue-200 active:scale-[0.98] transition-all shadow-xs cursor-pointer flex items-center justify-center"
            >
              <span>{t('cta_register')}</span>
            </Link>
          </div>

        </div>
      </div>

    </div>
  );
}

