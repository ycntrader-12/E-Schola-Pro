import Link from "next/link";
import { ArrowRight, BrainCircuit } from "lucide-react";

export default function Home() {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-28 pb-20 text-center overflow-hidden select-none">
      
      {/* Ambient Glowing Lights (Mint Green & Purple) */}
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

      </div>

    </div>
  );
}
