'use client';

import { useEffect, useState } from 'react';
import { Link } from '@/i18n/routing';
import { Plus } from 'lucide-react';
import { apiClient } from '@/lib/api';

export default function CreateCourseButton() {
  const [canCreate, setCanCreate] = useState(false);

  useEffect(() => {
    const checkRole = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          const res = await apiClient.get('/users/me');
          if (res.status === 200) {
            if (['formateur', 'admin', 'admin_manager', 'pedagogique', 'dg_rh', 'dg/rh'].includes(res.data.role)) {
              setCanCreate(true);
            }
          }
        } catch (e) {
          console.error('Failed to fetch user', e);
        }
      }
    };
    checkRole();
  }, []);

  if (!canCreate) return null;

  return (
    <Link 
      href="/courses/new" 
      className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer shrink-0"
    >
      <Plus size={17} />
      <span>Créer un cours</span>
    </Link>
  );
}
