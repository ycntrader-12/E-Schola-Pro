'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BookOpen, LogOut, User } from 'lucide-react';
import { apiClient } from '@/lib/api';
import ThemeToggle from './ThemeToggle';
import LanguageSwitcher from './LanguageSwitcher';
import BackButton from './BackButton';
import ForwardButton from './ForwardButton';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
    const checkAuth = async () => {
      const token = localStorage.getItem('access_token');
      setIsAuthenticated(!!token);
      if (token) {
        try {
          const res = await apiClient.get('/users/me');
          setUserRole(res.data.role);
        } catch {
          // Token is invalid or API unreachable — clear stale auth state silently
          setIsAuthenticated(false);
          setUserRole(null);
        }
      } else {
        setUserRole(null);
      }
    };
    checkAuth();
    
    window.addEventListener('storage', checkAuth);
    return () => window.removeEventListener('storage', checkAuth);
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    setIsAuthenticated(false);
    setUserRole(null);
    window.dispatchEvent(new Event('storage'));
    router.push('/login');
  };

  // Hide navbar on dashboard (with or without locale prefix)
  const normalizedPath = pathname.replace(/^\/[a-z]{2}(\/|$)/, '/');
  if (normalizedPath === '/dashboard' || normalizedPath.startsWith('/dashboard/')) return null;

  // Helper to check active path (locale-aware)
  const isActive = (path: string) => normalizedPath === path || normalizedPath.startsWith(path + '/');

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border h-16">
      <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
        
        {/* Left Section */}
        <div className="flex items-center gap-4">
          {normalizedPath !== '/' && normalizedPath !== '' && (
            <div className="hidden sm:flex items-center gap-2">
              <BackButton label="" className="p-2 bg-surface/50 border border-border rounded-full hover:bg-surface" />
              <ForwardButton label="" className="p-2 bg-surface/50 border border-border rounded-full hover:bg-surface" />
            </div>
          )}
          
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <BookOpen className="text-primary" size={24} />
            <span className="text-xl font-bold tracking-tight">
              E-Schola <span className="text-primary">Pro</span>
            </span>
          </Link>
        </div>



        {/* Right Section : Theme Toggle, Language Switcher & Auth */}
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <LanguageSwitcher />

          {!isMounted ? (
            <div className="w-20 h-8 bg-surface/50 animate-pulse rounded-full" />
          ) : isAuthenticated ? (
            <div className="flex items-center gap-4">
              <Link 
                href="/dashboard"
                className="text-xs font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-wider"
              >
                Dashboard
              </Link>
              <Link 
                href="/profile"
                className="flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-white transition-colors"
              >
                <User size={18} />
              </Link>
              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-red-400 transition-colors"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          ) : (
            <>
              <Link 
                href="/login"
                className="hidden sm:block text-sm font-medium text-text-secondary hover:text-white transition-colors"
              >
                Sign In
              </Link>
              <Link 
                href="/register"
                className="px-4 py-2 bg-primary/20 text-primary border border-primary/50 rounded-full text-sm font-medium hover:bg-primary hover:text-white transition-colors"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

