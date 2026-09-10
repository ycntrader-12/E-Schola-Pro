'use client';

import * as React from 'react';
import NotificationManager from '@/components/NotificationManager';

export default function Providers({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    // Ensure 'dark' class is completely removed from html/body
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('dark');
      localStorage.removeItem('theme');
    }
  }, []);

  return (
    <>
      <NotificationManager />
      {children}
    </>
  );
}
