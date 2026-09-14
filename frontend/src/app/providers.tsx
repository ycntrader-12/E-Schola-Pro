'use client';

import * as React from 'react';
import NotificationManager from '@/components/NotificationManager';
import RoleGuideAssistant from '@/components/RoleGuideAssistant';
import GlobalAiAssistant from '@/components/GlobalAiAssistant';
import { ConfirmModalProvider } from '@/context/ConfirmModalContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    // Ensure 'dark' class is completely removed from html/body
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('dark');
      localStorage.removeItem('theme');
    }
  }, []);

  return (
    <ConfirmModalProvider>
      <NotificationManager />
      <RoleGuideAssistant />
      <GlobalAiAssistant />
      {children}
    </ConfirmModalProvider>
  );
}
