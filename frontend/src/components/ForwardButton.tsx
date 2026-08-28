'use client';

import { ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ForwardButtonProps {
  label?: string;
  className?: string;
}

export default function ForwardButton({ label = "", className = "" }: ForwardButtonProps) {
  const router = useRouter();

  const handleForward = () => {
    router.forward();
  };

  return (
    <button 
      onClick={handleForward} 
      className={`flex items-center justify-center gap-2 text-text-secondary hover:text-primary transition-colors font-medium w-fit ${className}`}
      title="Suivant"
    >
      <ArrowRight size={20} />
      {label && <span>{label}</span>}
    </button>
  );
}
