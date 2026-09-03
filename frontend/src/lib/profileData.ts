export interface CountryCitiesMap {
  [country: string]: string[];
}

export const COUNTRIES_AND_CITIES: CountryCitiesMap = {
  Maroc: [
    'Casablanca',
    'Rabat',
    'Marrakech',
    'Tanger',
    'Fès',
    'Agadir',
    'Meknès',
    'Oujda',
    'Kénitra',
    'Tétouan',
    'Safi',
    'Mohammédia',
    'El Jadida',
    'Nador',
    'Béni Mellal',
    'Autre ville (Maroc)',
  ],
  France: [
    'Paris',
    'Lyon',
    'Marseille',
    'Toulouse',
    'Nice',
    'Nantes',
    'Strasbourg',
    'Montpellier',
    'Bordeaux',
    'Lille',
    'Rennes',
    'Grenoble',
    'Autre ville (France)',
  ],
  Belgique: [
    'Bruxelles',
    'Anvers',
    'Gand',
    'Liège',
    'Charleroi',
    'Namur',
    'Mons',
    'Bruges',
    'Autre ville (Belgique)',
  ],
  Canada: [
    'Montréal',
    'Québec',
    'Toronto',
    'Ottawa',
    'Vancouver',
    'Calgary',
    'Edmonton',
    'Autre ville (Canada)',
  ],
  Suisse: [
    'Genève',
    'Zurich',
    'Lausanne',
    'Bâle',
    'Berne',
    'Fribourg',
    'Autre ville (Suisse)',
  ],
  Sénégal: [
    'Dakar',
    'Thiès',
    'Saint-Louis',
    'Touba',
    'Ziguinchor',
    'Autre ville (Sénégal)',
  ],
  'Côte d\'Ivoire': [
    'Abidjan',
    'Bouaké',
    'Yamoussoukro',
    'San-Pédro',
    'Korhogo',
    'Autre ville (Côte d\'Ivoire)',
  ],
  Tunisie: [
    'Tunis',
    'Sfax',
    'Sousse',
    'Bizerte',
    'Ariana',
    'Autre ville (Tunisie)',
  ],
  Algérie: [
    'Alger',
    'Oran',
    'Constantine',
    'Annaba',
    'Blida',
    'Autre ville (Algérie)',
  ],
  'Autre pays': [
    'Autre métropole internationale',
  ],
};

export const SPECIALIZATIONS: string[] = [
  'Génie Logiciel & Systèmes d\'Information',
  'Intelligence Artificielle & Data Science',
  'Cybersécurité & Réseaux Avancés',
  'Cloud Computing & DevOps',
  'Ingénierie Web & Mobile Fullstack',
  'Systèmes Embarqués & IoT',
  'Management des Systèmes Numériques & Agile',
  'Design UX/UI & Ergonomie Digitale',
];

export const DEPARTMENTS: string[] = [
  'Direction des Systèmes d\'Information (DSI)',
  'Pôle Ingénierie Logicielle & R&D',
  'Pôle Infrastructure, Réseaux & Sécurité',
  'Département Pédagogique & Formation Continue',
  'Département Ressources Humaines & Talents',
  'Direction Administrative & Financière',
  'Département Marketing Digital & Communication',
  'Direction Générale & Stratégie',
];

/**
 * Calcul dynamique et précis de l'âge selon la date de naissance (format YYYY-MM-DD)
 */
export function calculateAge(birthDateStr: string): number | null {
  if (!birthDateStr) return null;
  const birth = new Date(birthDateStr);
  if (isNaN(birth.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 && age <= 120 ? age : null;
}

/**
 * Normalise nom et prénom pour générer un pseudonyme type prenom.nom sans accents
 */
export function generateUsername(nom: string, prenom: string): string {
  const clean = (str: string) =>
    str
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '');

  const p = clean(prenom);
  const n = clean(nom);

  if (p && n) return `${p}.${n}`;
  if (p) return p;
  if (n) return n;
  return '';
}
