'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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
            if (['formateur', 'admin', 'pedagogique'].includes(res.data.role)) {
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
    <Link href="/courses/new" className="btn-primary flex items-center gap-2">
      <Plus size={18} /> Create Course
    </Link>
  );
}
