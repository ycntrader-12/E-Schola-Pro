import Link from "next/link";
import { ArrowRight, BookOpen, BrainCircuit, Users, Video, ShieldCheck, CheckCircle2 } from "lucide-react";

export default function Home() {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-28 pb-20 text-center overflow-hidden select-none">
      
      {/* 1. Background Image - Light Mode Tech Laboratory */}
      <div 
        className="fixed inset-0 bg-cover bg-center transition-all duration-700 scale-105 dark:hidden"
        style={{ backgroundImage: "url('/images/hd_tech_ai_server_light.jpg')" }}
      />

      {/* 1. Background Image - Dark Mode Tech AI Supercomputer */}
      <div 
        className="fixed inset-0 bg-cover bg-center transition-all duration-700 scale-105 hidden dark:block"
        style={{ backgroundImage: "url('/images/hd_tech_ai_server.jpg')" }}
      />

      {/* 2. Light Mode Cinematic Vignette */}
      <div className="fixed inset-0 bg-gradient-to-b from-white/70 via-white/40 to-white/80 dark:hidden" />
      <div 
        className="fixed inset-0 pointer-events-none dark:hidden"
        style={{
          background: "radial-gradient(ellipse at center, rgba(255,255,255,0.2) 0%, rgba(250,247,248,0.7) 75%, rgba(250,247,248,0.95) 100%)"
        }}
      />

      {/* 2. Dark Mode Cyber Vignette (Preserves brilliant luminous center) */}
      <div className="fixed inset-0 bg-gradient-to-b from-black/55 via-black/25 to-black/80 hidden dark:block" />
      <div 
        className="fixed inset-0 pointer-events-none hidden dark:block"
        style={{
          background: "radial-gradient(ellipse at center, rgba(0,0,0,0.1) 0%, rgba(9,9,11,0.6) 75%, rgba(9,9,11,0.9) 100%)"
        }}
      />

      {/* 3. Ambient Glowing Red Lights */}
      <div className="fixed top-1/4 left-1/4 w-96 h-96 bg-red-500/15 dark:bg-red-600/25 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="fixed bottom-1/4 right-1/4 w-96 h-96 bg-rose-500/15 dark:bg-rose-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Hero Section */}
      <div className="relative z-10 max-w-3xl mx-auto space-y-7 animate-fade-in-up">
        
        {/* Soft, Professional Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
          <span className="w-2 h-2 rounded-full bg-primary" />
          <BrainCircuit size={15} />
          <span>Plateforme d'Apprentissage & Intelligence Artificielle</span>
        </div>
        
        {/* Main Title - Crystal Clear Contrast in Both Modes */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-tight text-text-primary">
          Propulsez Vos Compétences avec <br className="hidden sm:block" />
          <span className="text-brand-gradient">
            E-Schola Pro
          </span>
        </h1>
        
        {/* Subtitle - Smooth, Highly Legible */}
        <p className="text-base sm:text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
          L'écosystème numérique d'excellence pour l'apprentissage académique et professionnel. Profitez de classes virtuelles HD, d'une messagerie intégrée et de parcours sur-mesure.
        </p>
        
        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
          <Link 
            href="/login" 
            className="btn-primary gap-2 w-full sm:w-auto text-sm px-8"
          >
            <span>Se Connecter</span>
            <ArrowRight size={17} />
          </Link>

          <Link 
            href="/register" 
            className="w-full sm:w-auto px-6 py-3 rounded-xl font-semibold text-sm bg-surface/80 backdrop-blur-md border border-border text-text-primary hover:bg-surface-hover transition-colors shadow-sm"
          >
            Créer un Compte
          </Link>
        </div>

        {/* Clean Metrics Strip */}
        <div className="pt-8 max-w-2xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-white/80 dark:bg-black/60 backdrop-blur-xl border border-red-500/15 dark:border-red-500/30 text-center shadow-lg shadow-black/5 dark:shadow-red-950/20">
            <span className="text-xl font-bold text-text-primary block font-mono">15 000+</span>
            <span className="text-xs text-text-secondary mt-0.5 block">Apprenants</span>
          </div>
          <div className="p-4 rounded-2xl bg-white/80 dark:bg-black/60 backdrop-blur-xl border border-red-500/15 dark:border-red-500/30 text-center shadow-lg shadow-black/5 dark:shadow-red-950/20">
            <span className="text-xl font-bold text-primary block font-mono">99.4%</span>
            <span className="text-xs text-text-secondary mt-0.5 block">Satisfaction</span>
          </div>
          <div className="p-4 rounded-2xl bg-white/80 dark:bg-black/60 backdrop-blur-xl border border-red-500/15 dark:border-red-500/30 text-center shadow-lg shadow-black/5 dark:shadow-red-950/20">
            <span className="text-xl font-bold text-text-primary block font-mono">24h / 7j</span>
            <span className="text-xs text-text-secondary mt-0.5 block">Disponibilité</span>
          </div>
          <div className="p-4 rounded-2xl bg-white/80 dark:bg-black/60 backdrop-blur-xl border border-red-500/15 dark:border-red-500/30 text-center shadow-lg shadow-black/5 dark:shadow-red-950/20">
            <span className="text-xl font-bold text-secondary block font-mono">HD Meet</span>
            <span className="text-xs text-text-secondary mt-0.5 block">Classes Directes</span>
          </div>
        </div>

      </div>

      {/* Feature Cards Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mt-20 w-full relative z-10">
        
        {/* Card 1 */}
        <div className="p-6 rounded-3xl flex flex-col items-start text-left space-y-3 bg-white/80 dark:bg-black/60 backdrop-blur-xl border border-red-500/15 dark:border-red-500/30 shadow-xl shadow-black/5 dark:shadow-red-950/20 hover:border-red-500/40 transition-all">
          <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <BookOpen size={22} />
          </div>
          <h3 className="text-base font-bold text-text-primary">Catalogue de Cours Complet</h3>
          <p className="text-text-secondary text-xs leading-relaxed">
            Accédez à des cours structurés avec leçons multimédias, devoirs interactifs et suivi de progression précis.
          </p>
        </div>
        
        {/* Card 2 */}
        <div className="p-6 rounded-3xl flex flex-col items-start text-left space-y-3 bg-white/80 dark:bg-black/60 backdrop-blur-xl border border-red-500/15 dark:border-red-500/30 shadow-xl shadow-black/5 dark:shadow-red-950/20 hover:border-red-500/40 transition-all">
          <div className="w-11 h-11 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center">
            <Video size={22} />
          </div>
          <h3 className="text-base font-bold text-text-primary">Classe Virtuelle en Direct</h3>
          <p className="text-text-secondary text-xs leading-relaxed">
            Participez aux cours en visio avec micro, caméra, partage d'écran fluide et tableau interactif.
          </p>
        </div>
        
        {/* Card 3 */}
        <div className="p-6 rounded-3xl flex flex-col items-start text-left space-y-3 bg-white/80 dark:bg-black/60 backdrop-blur-xl border border-red-500/15 dark:border-red-500/30 shadow-xl shadow-black/5 dark:shadow-red-950/20 hover:border-red-500/40 transition-all">
          <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Users size={22} />
          </div>
          <h3 className="text-base font-bold text-text-primary">Messagerie & Signalement</h3>
          <p className="text-text-secondary text-xs leading-relaxed">
            Échangez des documents, organisez des rendez-vous et bénéficiez d'une communication fluide et sécurisée.
          </p>
        </div>

      </div>

    </div>
  );
}
