'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/routing';
import { ChangeEvent } from 'react';

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const onChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const nextLocale = e.target.value;
    router.replace(pathname, { locale: nextLocale });
  };

  return (
    <select
      value={locale}
      onChange={onChange}
      className="bg-surface border border-border rounded-md px-2 py-1 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
    >
      <option value="en">🇺🇸 EN</option>
      <option value="fr">🇫🇷 FR</option>
      <option value="es">🇪🇸 ES</option>
      <option value="de">🇩🇪 DE</option>
      <option value="ar">🇸🇦 AR</option>
    </select>
  );
}
