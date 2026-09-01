import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BrainCircuit } from "lucide-react";

export default function Home() {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-28 pb-20 text-center overflow-hidden select-none bg-slate-50">
      
      {/* High-Clarity Ecosystem Background Illustration */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <Image 
          src="/images/landing-bg.jpg" 
          alt="E-Schola Pro Connect LMS Ecosystem" 
          fill 
          priority
          className="object-cover object-center opacity-90 scale-100" 
          unoptimized 
        />
        {/* Soft edge blending gradient for optimal readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-white/60 via-transparent to-white/40" />
      </div>

      {/* Hero Section with Pure White Floating Card */}
      <div className="relative z-10 max-w-3xl mx-auto space-y-7 animate-fade-in-up p-8 sm:p-12 rounded-3xl bg-white/95 backdrop-blur-xl border border-slate-200 shadow-2xl shadow-slate-900/10">
        
        {/* Soft Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold bg-blue-50 text-[#1877f2] border border-blue-200 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-[#1877f2] animate-pulse" />
          <BrainCircuit size={15} />
          <span>Plateforme d'Apprentissage &amp; Intelligence Artificielle</span>
        </div>
        
        {/* Main Title - Crystal Clear */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-tight text-[#0f172a]">
          Propulsez Vos Compétences avec <br className="hidden sm:block" />
          <span className="text-[#1877f2]">
            E-Schola Pro
          </span>
        </h1>
        
        {/* Subtitle */}
        <p className="text-base sm:text-lg text-[#475569] max-w-2xl mx-auto leading-relaxed font-medium">
          L'écosystème numérique d'excellence pour l'apprentissage académique et professionnel. Profitez de classes virtuelles HD, d'une messagerie intégrée et de parcours sur-mesure.
        </p>
        
        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          {/* Primary Button: Solid Application Blue */}
          <Link 
            href="/login" 
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-extrabold text-sm text-white bg-[#1877f2] hover:bg-[#166fe5] hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 cursor-pointer"
          >
            <span>Se Connecter</span>
            <ArrowRight size={17} />
          </Link>

          {/* Secondary Button: Application Blue Outline */}
          <Link 
            href="/register" 
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-extrabold text-sm text-[#1877f2] bg-blue-50/80 hover:bg-blue-100/80 border-2 border-[#1877f2] hover:scale-[1.01] active:scale-[0.99] transition-all shadow-xs cursor-pointer flex items-center justify-center"
          >
            <span>Créer un Compte</span>
          </Link>
        </div>

      </div>

    </div>
  );
}
