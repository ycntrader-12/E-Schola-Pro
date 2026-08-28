'use client';

import { useEffect, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { apiClient } from '@/lib/api';

interface Props {
  documentUrl: string;
}

export default function DownloadCourseButton({ documentUrl }: Props) {
  const [canDownload, setCanDownload] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    setIsMounted(true);
    const checkRole = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          const res = await apiClient.get('/users/me');
          if (res.status === 200) {
            // Allowed roles to download
            if (['étudiant', 'stagiaire', 'employer', 'admin', 'formateur', 'pedagogique'].includes(res.data.role)) {
              setCanDownload(true);
            }
          }
        } catch (e) {
          console.error('Failed to fetch user', e);
        }
      }
    };
    checkRole();
  }, []);

  if (!isMounted || !canDownload || !documentUrl) return null;

  return (
    <div className="mt-6 border-t border-white/10 pt-6">
      <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
        <FileText size={16} className="text-primary" />
        Course Material
      </h3>
      <a 
        href={documentUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full py-3 px-4 bg-surface hover:bg-surface-hover text-white font-semibold rounded-lg border border-border transition-colors flex items-center justify-center gap-2 group"
      >
        <Download size={18} className="group-hover:text-primary transition-colors" />
        Download Document
      </a>
    </div>
  );
}
