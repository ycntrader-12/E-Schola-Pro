'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface BackButtonProps {
  label?: string;
  fallbackUrl?: string;
  className?: string;
}

export default function BackButton({ label = "Retour", fallbackUrl = "/", className = "" }: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackUrl);
    }
  };

  return (
    <button 
      onClick={handleBack} 
      className={`flex items-center gap-2 text-text-secondary hover:text-primary transition-colors font-medium w-fit ${className}`}
    >
      <ArrowLeft size={20} />
      {label}
    </button>
  );
}
