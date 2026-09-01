/**
 * Jours Fériés Officiels au Royaume du Maroc (National & Religieux)
 * Supporte le calcul précis des fêtes nationales fixes et des fêtes religieuses pour 2024-2030.
 */

export interface MoroccanHoliday {
  id: string;
  name: string;
  nameAr: string;
  date: string; // Format YYYY-MM-DD
  type: 'national' | 'religious';
  description: string;
}

// Dates des fêtes religieuses musulmanes au Maroc (calendrier lunaire observé)
const RELIGIOUS_HOLIDAYS_BY_YEAR: { [year: number]: Array<{ name: string; nameAr: string; dates: string[]; desc: string }> } = {
  2024: [
    { name: "Aïd al-Fitr (Fête de la Rupture)", nameAr: "عيد الفطر", dates: ["2024-04-10", "2024-04-11"], desc: "Fin du mois sacré de Ramadan (2 jours fériés)" },
    { name: "Aïd al-Adha (Fête du Sacrifice)", nameAr: "عيد الأضحى", dates: ["2024-06-17", "2024-06-18"], desc: "Grande fête du sacrifice islamique (2 jours fériés)" },
    { name: "1er Moharram (Nouvel An Hégirien 1446)", nameAr: "فاتح محرم", dates: ["2024-07-07"], desc: "Premier jour de l'année hégirienne" },
    { name: "Aïd al-Mawlid Annabawi (Naissance du Prophète)", nameAr: "عيد المولد النبوي", dates: ["2024-09-16", "2024-09-17"], desc: "Commémoration de la naissance du Prophète Mahomet (2 jours fériés)" }
  ],
  2025: [
    { name: "Aïd al-Fitr (Fête de la Rupture)", nameAr: "عيد الفطر", dates: ["2025-03-31", "2025-04-01"], desc: "Fin du mois sacré de Ramadan (2 jours fériés)" },
    { name: "Aïd al-Adha (Fête du Sacrifice)", nameAr: "عيد الأضحى", dates: ["2025-06-06", "2025-06-07"], desc: "Grande fête du sacrifice islamique (2 jours fériés)" },
    { name: "1er Moharram (Nouvel An Hégirien 1447)", nameAr: "فاتح محرم", dates: ["2025-06-26"], desc: "Premier jour de l'année hégirienne" },
    { name: "Aïd al-Mawlid Annabawi (Naissance du Prophète)", nameAr: "عيد المولد النبوي", dates: ["2025-09-05", "2025-09-06"], desc: "Commémoration de la naissance du Prophète Mahomet (2 jours fériés)" }
  ],
  2026: [
    { name: "Aïd al-Fitr (Fête de la Rupture)", nameAr: "عيد الفطر", dates: ["2026-03-20", "2026-03-21"], desc: "Fin du mois sacré de Ramadan (2 jours fériés)" },
    { name: "Aïd al-Adha (Fête du Sacrifice)", nameAr: "عيد الأضحى", dates: ["2026-05-27", "2026-05-28"], desc: "Grande fête du sacrifice islamique (2 jours fériés)" },
    { name: "1er Moharram (Nouvel An Hégirien 1448)", nameAr: "فاتح محرم", dates: ["2026-06-16"], desc: "Premier jour de l'année hégirienne" },
    { name: "Aïd al-Mawlid Annabawi (Naissance du Prophète)", nameAr: "عيد المولد النبوي", dates: ["2026-08-26", "2026-08-27"], desc: "Commémoration de la naissance du Prophète Mahomet (2 jours fériés)" }
  ],
  2027: [
    { name: "Aïd al-Fitr (Fête de la Rupture)", nameAr: "عيد الفطر", dates: ["2027-03-10", "2027-03-11"], desc: "Fin du mois sacré de Ramadan (2 jours fériés)" },
    { name: "Aïd al-Adha (Fête du Sacrifice)", nameAr: "عيد الأضحى", dates: ["2027-05-17", "2027-05-18"], desc: "Grande fête du sacrifice islamique (2 jours fériés)" },
    { name: "1er Moharram (Nouvel An Hégirien 1449)", nameAr: "فاتح محرم", dates: ["2027-06-05"], desc: "Premier jour de l'année hégirienne" },
    { name: "Aïd al-Mawlid Annabawi (Naissance du Prophète)", nameAr: "عيد المولد النبوي", dates: ["2027-08-15", "2027-08-16"], desc: "Commémoration de la naissance du Prophète Mahomet (2 jours fériés)" }
  ]
};

/**
 * Retourne la liste complète des jours fériés officiels au Maroc pour une année donnée
 */
export function getMoroccanHolidays(year: number): MoroccanHoliday[] {
  const holidays: MoroccanHoliday[] = [
    // 1. Fêtes Civiles et Nationales Fixes
    {
      id: `ma-nouvel-an-${year}`,
      name: "Nouvel An Civil",
      nameAr: "رأس السنة الميلادية",
      date: `${year}-01-01`,
      type: "national",
      description: "Premier jour de l'année grégorienne"
    },
    {
      id: `ma-independance-manifeste-${year}`,
      name: "Manifeste de l'Indépendance",
      nameAr: "تقديم وثيقة الاستقلال",
      date: `${year}-01-11`,
      type: "national",
      description: "Commémoration de la présentation du manifeste de l'indépendance en 1944"
    },
    {
      id: `ma-nouvel-an-amazigh-${year}`,
      name: "Nouvel An Amazigh (Yennayer)",
      nameAr: "رأس السنة الأمازيغية",
      date: `${year}-01-14`,
      type: "national",
      description: "Jour férié national officiel commémorant le Nouvel An Amazigh"
    },
    {
      id: `ma-fete-travail-${year}`,
      name: "Fête du Travail",
      nameAr: "عيد الشغل",
      date: `${year}-05-01`,
      type: "national",
      description: "Journée internationale des travailleurs"
    },
    {
      id: `ma-fete-trone-${year}`,
      name: "Fête du Trône",
      nameAr: "عيد العرش",
      date: `${year}-07-30`,
      type: "national",
      description: "Commémoration de l'accession de Sa Majesté le Roi Mohammed VI au trône"
    },
    {
      id: `ma-oued-eddahab-${year}`,
      name: "Récupération d'Oued Ed-Dahab",
      nameAr: "ذكرى استرجاع وادي الذهب",
      date: `${year}-08-14`,
      type: "national",
      description: "Commémoration du retour de la province d'Oued Ed-Dahab à la mère patrie"
    },
    {
      id: `ma-revolution-roi-peuple-${year}`,
      name: "Révolution du Roi et du Peuple",
      nameAr: "ذكرى ثورة الملك والشعب",
      date: `${year}-08-20`,
      type: "national",
      description: "Épopée historique de la lutte nationale pour la liberté et l'indépendance"
    },
    {
      id: `ma-fete-jeunesse-${year}`,
      name: "Fête de la Jeunesse",
      nameAr: "عيد الشباب",
      date: `${year}-08-21`,
      type: "national",
      description: "Célébration de l'anniversaire de Sa Majesté le Roi Mohammed VI"
    },
    {
      id: `ma-marche-verte-${year}`,
      name: "Anniversaire de la Marche Verte",
      nameAr: "ذكرى المسيرة الخضراء",
      date: `${year}-11-06`,
      type: "national",
      description: "Commémoration de la glorieuse Marche Verte pacifique de 1975"
    },
    {
      id: `ma-fete-independance-${year}`,
      name: "Fête de l'Indépendance",
      nameAr: "عيد الاستقلال",
      date: `${year}-11-18`,
      type: "national",
      description: "Célébration de la fin du protectorat et du retour d'exil de feu S.M. Mohammed V"
    }
  ];

  // 2. Fêtes Religieuses Islamiques
  const religious = RELIGIOUS_HOLIDAYS_BY_YEAR[year] || RELIGIOUS_HOLIDAYS_BY_YEAR[2026];
  religious.forEach((rel, rIdx) => {
    rel.dates.forEach((dStr, dIdx) => {
      holidays.push({
        id: `ma-rel-${year}-${rIdx}-${dIdx}`,
        name: rel.dates.length > 1 ? `${rel.name} (Jour ${dIdx + 1})` : rel.name,
        nameAr: rel.nameAr,
        date: dStr,
        type: "religious",
        description: rel.desc
      });
    });
  });

  return holidays.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Vérifie si une date donnée (YYYY-MM-DD ou objet Date) correspond à un jour férié au Maroc
 */
export function getMoroccanHolidayForDate(date: Date | string): MoroccanHoliday | null {
  let dateStr = '';
  if (typeof date === 'string') {
    dateStr = date.split('T')[0];
  } else {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    dateStr = `${yyyy}-${mm}-${dd}`;
  }

  const year = parseInt(dateStr.split('-')[0], 10);
  const holidays = getMoroccanHolidays(year);
  return holidays.find(h => h.date === dateStr) || null;
}
