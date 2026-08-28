'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-10 h-10 rounded-xl bg-surface/50 border border-border animate-pulse" />;
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="relative p-2.5 rounded-xl bg-surface hover:bg-surface-hover border border-border transition-all duration-300 group flex items-center justify-center hover:border-primary/50 hover:shadow-[0_0_15px_rgba(99,102,241,0.25)]"
      title={isDark ? "Passer en mode Clair (AI Tech Clean)" : "Passer en mode Sombre (AI Tech Cyber)"}
      aria-label="Changer le thème"
    >
      {isDark ? (
        <Sun size={18} className="text-yellow-400 group-hover:rotate-90 transition-transform duration-500" />
      ) : (
        <Moon size={18} className="text-primary group-hover:-rotate-12 transition-transform duration-500" />
      )}
    </button>
  );
}
