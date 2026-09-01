'use client';

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { apiClient } from '@/lib/api';

interface Props {
  documentUrl: string;
}

export default function DownloadCourseButton({ documentUrl }: Props) {
  const [canDownload, setCanDownload] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const checkRole = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          const res = await apiClient.get('/users/me');
          if (res.status === 200) {
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
    <a 
      href={documentUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="px-5 py-2.5 bg-[#1877f2] hover:bg-[#166fe5] text-white font-bold rounded-xl shadow-md shadow-blue-500/25 transition-all flex items-center justify-center gap-2 group cursor-pointer hover:scale-[1.01] active:scale-[0.99] text-xs sm:text-sm shrink-0"
    >
      <Download size={16} className="text-white group-hover:scale-110 transition-transform" />
      <span>Télécharger le Fichier</span>
    </a>
  );
}
