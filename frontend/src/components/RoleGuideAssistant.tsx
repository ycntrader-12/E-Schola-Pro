'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from '@/i18n/routing';
import {
  Sparkles,
  BookOpen,
  Video,
  Award,
  CheckSquare,
  UserCheck,
  Users,
  Calendar,
  Inbox,
  ShieldCheck,
  CheckCircle2,
  Circle,
  ChevronRight,
  ChevronDown,
  Search,
  X,
  ExternalLink,
  HelpCircle,
  Compass,
  FileText,
  AlertCircle,
  GraduationCap,
  Briefcase,
  Layers,
  RotateCcw,
  BadgeHelp
} from 'lucide-react';
import { apiClient } from '@/lib/api';

export type RoleType = 
  | 'etudiant'
  | 'formateur'
  | 'admin'
  | 'admin_manager'
  | 'pedagogique'
  | 'dg_rh'
  | 'stagiaire'
  | 'employer';

interface ChecklistItem {
  id: string;
  title: string;
  desc: string;
  actionHref?: string;
  actionLabel?: string;
}

interface ModuleGuide {
  title: string;
  href: string;
  icon: any;
  badge: string;
  description: string;
  rights: string;
}

interface FaqItem {
  q: string;
  a: string;
}

interface RoleConfig {
  id: RoleType;
  label: string;
  tagline: string;
  badgeColor: string;
  textColor: string;
  borderColor: string;
  summary: string;
  checklist: ChecklistItem[];
  modules: ModuleGuide[];
  tips: string[];
  faqs: FaqItem[];
  permissions: {
    can: string[];
    cannot: string[];
  };
}

const ROLES_DATA: Record<RoleType, RoleConfig> = {
  etudiant: {
    id: 'etudiant',
    label: 'Étudiant',
    tagline: 'Apprentissage, cours interactifs, devoirs & évaluations',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-500',
    summary: 'En tant qu’étudiant, votre espace vous permet de suivre vos cours, participer aux visioconférences en direct, tester vos connaissances par les quiz, déposer vos devoirs et signer votre émargement en ligne.',
    checklist: [
      {
        id: 'etu_profile',
        title: 'Compléter votre profil & photo',
        desc: 'Vérifiez votre nom, département et ajoutez votre avatar pour être reconnu par vos formateurs.',
        actionHref: '/profile',
        actionLabel: 'Accéder à mon profil'
      },
      {
        id: 'etu_courses',
        title: 'Explorer et s’inscrire aux cours',
        desc: 'Consultez la liste des formations disponibles, téléchargez les supports PDF et visionnez les vidéos.',
        actionHref: '/courses',
        actionLabel: 'Découvrir les cours'
      },
      {
        id: 'etu_classroom',
        title: 'Rejoindre une classe virtuelle Jitsi',
        desc: 'Testez votre micro, webcam et vérifiez les créneaux de visioconférence en direct avec votre formateur.',
        actionHref: '/classroom',
        actionLabel: 'Classes virtuelles'
      },
      {
        id: 'etu_quizzes',
        title: 'Passer vos quiz chronométrés',
        desc: 'Entraînez-vous avec les questionnaires à choix multiples et consultez vos scores instantanés.',
        actionHref: '/quizzes',
        actionLabel: 'Voir les quiz'
      },
      {
        id: 'etu_tasks',
        title: 'Rendre vos devoirs à temps',
        desc: 'Déposez vos livrables (fichiers, projets, rapports) avant la date limite fixée par votre enseignant.',
        actionHref: '/assignments',
        actionLabel: 'Mes devoirs'
      },
      {
        id: 'etu_attendance',
        title: 'Signer votre feuille d’émargement',
        desc: 'Validez votre présence lors de chaque cours par clic ou code PIN fourni en direct.',
        actionHref: '/attendance',
        actionLabel: 'Émargement'
      }
    ],
    modules: [
      {
        title: 'Cours & Leçons',
        href: '/courses',
        icon: BookOpen,
        badge: 'Apprentissage',
        description: 'Accès aux syllabus, cours théoriques, vidéos de formation et téléchargement de documents.',
        rights: 'Lecture, visionnage et téléchargement des supports'
      },
      {
        title: 'Classe Virtuelle',
        href: '/classroom',
        icon: Video,
        badge: 'Direct WebRTC',
        description: 'Visioconférences en haute définition avec chat en direct, partage d’écran et levée de main.',
        rights: 'Rejoindre les sessions ouvertes, lever la main, participer au chat'
      },
      {
        title: 'Quiz & Évaluations',
        href: '/quizzes',
        icon: Award,
        badge: 'Contrôle continu',
        description: 'Évaluations interactives minutées avec calcul automatique des points et correction immédiate.',
        rights: 'Passer les tentatives autorisées et consulter son historique de notes'
      },
      {
        title: 'Devoirs & Projets',
        href: '/assignments',
        icon: CheckSquare,
        badge: 'Livrables',
        description: 'Espace de dépôt de devoirs, suivi des statuts de correction et retours personnalisés du formateur.',
        rights: 'Déposer un livrable, modifier sa soumission avant la date d’échéance'
      },
      {
        title: 'Émargement & Présences',
        href: '/attendance',
        icon: UserCheck,
        badge: 'Assiduité',
        description: 'Signature de présence en ligne obligatoire pour chaque séance académique ou de travaux pratiques.',
        rights: 'Signer sa présence en séance ouverte via signature ou code PIN'
      },
      {
        title: 'Messagerie Interne',
        href: '/inbox',
        icon: Inbox,
        badge: 'Communication',
        description: 'Messagerie instantanée pour échanger avec vos formateurs et collègues de promotion.',
        rights: 'Envoyer et recevoir des messages directs ou de groupe'
      },
      {
        title: 'Calendrier & Planning',
        href: '/calendar',
        icon: Calendar,
        badge: 'Organisation',
        description: 'Emploi du temps synchronisé avec les sessions de cours, examens et échéances de devoirs.',
        rights: 'Consulter les cours programmés et dates limites'
      }
    ],
    tips: [
      'Activez vos notifications pour être alerté dès qu’un formateur publie un nouveau devoir ou démarre une classe.',
      'En visioconférence, coupez votre micro quand vous ne prenez pas la parole pour préserver la clarté audio.',
      'Téléchargez les supports de cours PDF à l’avance pour pouvoir réviser même en cas de connexion ralentie.',
      'Vérifiez la date et l’heure de clôture des quiz : le minuteur ne peut pas être suspendu une fois lancé.'
    ],
    faqs: [
      {
        q: 'Comment signer ma présence en ligne ?',
        a: 'Rendez-vous sur la page "Émargement" (/attendance) pendant la session de cours. Si la session est ouverte par votre formateur, cliquez sur "Signer ma présence" ou entrez le code PIN à 4 chiffres qu’il vous a communiqué.'
      },
      {
        q: 'Que faire si ma caméra ou mon micro ne fonctionne pas dans la classe virtuelle ?',
        a: 'Vérifiez les permissions de votre navigateur (icône cadenas à gauche de la barre d’adresse). Assurez-vous d’autoriser la caméra et le microphone pour le domaine E-Schola Pro, puis rechargez la page.'
      },
      {
        q: 'Puis-je modifier un devoir déjà soumis ?',
        a: 'Oui, tant que la date limite fixée par votre enseignant n’est pas dépassée et que le devoir n’est pas encore noté, vous pouvez soumettre une nouvelle version de votre document.'
      }
    ],
    permissions: {
      can: [
        'Consulter l’ensemble des cours et vidéos assignés',
        'Rejoindre les visioconférences en direct',
        'Passer les quiz et consulter ses résultats individuels',
        'Déposer ses devoirs et travaux pratiques',
        'Émarger ses présences en ligne',
        'Échanger via la messagerie instantanée'
      ],
      cannot: [
        'Créer ou modifier des cours et syllabus',
        'Créer ou noter des quiz et devoirs',
        'Modifier les statuts de présence des autres apprenants',
        'Accéder à la console d’administration ou aux paramètres du serveur',
        'Créer ou supprimer des groupes d’utilisateurs'
      ]
    }
  },

  formateur: {
    id: 'formateur',
    label: 'Formateur / Enseignant',
    tagline: 'Création pédagogique, animation live, notation & émargement',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-500',
    summary: 'En tant que formateur, vous disposez des droits complets pour orchestrer l’enseignement : concevoir des cours, animer des classes virtuelles interactives, créer et noter des quiz/devoirs, et valider l’assiduité de vos apprenants.',
    checklist: [
      {
        id: 'fmt_course',
        title: 'Créer votre premier cours & leçons',
        desc: 'Publiez un cours avec description, image de couverture, supports PDF et vidéos associées.',
        actionHref: '/courses',
        actionLabel: 'Gérer mes cours'
      },
      {
        id: 'fmt_classroom',
        title: 'Lancer une salle de classe virtuelle',
        desc: 'Créez une session en direct avec Jitsi Meet, partagez l’écran et invitez vos apprenants.',
        actionHref: '/classroom',
        actionLabel: 'Ouvrir une classe'
      },
      {
        id: 'fmt_quiz',
        title: 'Publier une évaluation ou un quiz',
        desc: 'Définissez le barème, le temps limite et les questions pour mesurer les acquis de la classe.',
        actionHref: '/quizzes',
        actionLabel: 'Créer un quiz'
      },
      {
        id: 'fmt_task',
        title: 'Assigner un devoir avec date limite',
        desc: 'Spécifiez les consignes, les critères d’évaluation et recevez les livrables des étudiants.',
        actionHref: '/assignments',
        actionLabel: 'Assigner un devoir'
      },
      {
        id: 'fmt_attendance',
        title: 'Ouvrir la feuille d’émargement en direct',
        desc: 'Générez le code PIN ou faites signer les apprenants, puis clôturez la séance.',
        actionHref: '/attendance',
        actionLabel: 'Feuille d’émargement'
      },
      {
        id: 'fmt_group',
        title: 'Consulter et animer vos groupes',
        desc: 'Vérifiez la liste des inscrits dans vos promotions et suivez leur progression collective.',
        actionHref: '/group',
        actionLabel: 'Mes groupes'
      }
    ],
    modules: [
      {
        title: 'Gestion des Cours',
        href: '/courses',
        icon: BookOpen,
        badge: 'Création & Contenu',
        description: 'Outil de rédaction des formations, chapitres, upload de vidéos MP4 et de fichiers documentaires.',
        rights: 'Créer, éditer, supprimer et publier ses cours et vidéos'
      },
      {
        title: 'Visioconférence & Classe Live',
        href: '/classroom',
        icon: Video,
        badge: 'Modération Live',
        description: 'Contrôle total de la classe : micro/caméra, enregistrement, coupure des micros apprenants, modération du chat.',
        rights: 'Créer une salle, inviter les promotions, modérer la visioconférence'
      },
      {
        title: 'Création & Correction de Quiz',
        href: '/quizzes',
        icon: Award,
        badge: 'Évaluations',
        description: 'Constructeur de questions (QCM, vrai/faux), barèmes personnalisés et analyse statistique des notes.',
        rights: 'Créer des quiz, définir les cibles de groupes, analyser les tentatives'
      },
      {
        title: 'Gestion & Notation des Devoirs',
        href: '/assignments',
        icon: CheckSquare,
        badge: 'Notation',
        description: 'Téléchargement des livrables étudiants, attribution de notes sur 20 ou 100 et retours pédagogiques.',
        rights: 'Créer des devoirs, corriger les copies et attribuer les notes'
      },
      {
        title: 'Gestion des Présences (Émargement)',
        href: '/attendance',
        icon: UserCheck,
        badge: 'Validation officielle',
        description: 'Ouverture/fermeture de sessions d’émargement, génération de code PIN, pointage manuel ou numérique.',
        rights: 'Gérer les sessions de présence de ses cours et exporter les rapports'
      },
      {
        title: 'Groupes & Promotions',
        href: '/group',
        icon: Users,
        badge: 'Pédagogie de groupe',
        description: 'Supervision des promotions assignées, consultation du trombinoscope et des statistiques de groupe.',
        rights: 'Consulter les membres, ajouter des membres selon les permissions'
      }
    ],
    tips: [
      'Préparez vos supports PDF et vidéos quelques jours avant le direct pour que les étudiants puissent en prendre connaissance.',
      'Générez un code PIN d’émargement affiché pendant 5 minutes au début de la classe virtuelle pour garantir la ponctualité.',
      'Utilisez le système de messagerie interne pour communiquer les dates d’examens ou les modifications de planning.',
      'Dans les quiz, variez les types de questions pour évaluer à la fois les définitions clés et la résolution de cas concrets.'
    ],
    faqs: [
      {
        q: 'Comment générer un code PIN pour l’émargement ?',
        a: 'Sur la page "Émargement", cliquez sur "Nouvelle session", sélectionnez votre cours et activez l’option "Code PIN". Le code s’affichera en grand format à partager avec vos apprenants.'
      },
      {
        q: 'Puis-je restreindre un quiz à un seul groupe d’étudiants ?',
        a: 'Oui. Lors de la création ou modification du quiz, sélectionnez le groupe cible dans le champ "Groupe / Promotion" au lieu de "Tous". Seuls les membres de ce groupe le verront.'
      },
      {
        q: 'Comment attribuer une note et un feedback à un devoir rendu ?',
        a: 'Dans la section "Devoirs" (/assignments), cliquez sur le devoir, puis sur "Voir les soumissions". Vous pouvez télécharger la copie, saisir la note et rédiger un commentaire personnalisé visible par l’étudiant.'
      }
    ],
    permissions: {
      can: [
        'Créer, modifier et supprimer ses propres cours et vidéos',
        'Créer des classes virtuelles et agir en modérateur',
        'Créer et corriger les quiz et devoirs',
        'Valider et modifier les feuilles de présence de ses cours',
        'Consulter les trombinoscopes des groupes d’étudiants',
        'Envoyer des messages à des promotions entières'
      ],
      cannot: [
        'Modifier les rôles ou mots de passe des utilisateurs administratifs',
        'Accéder à la console d’administration système (/admin)',
        'Modifier les paramètres globaux de la plateforme ou les clés API',
        'Supprimer la base de données ou les sauvegardes système'
      ]
    }
  },

  admin: {
    id: 'admin',
    label: 'Super-Administrateur',
    tagline: 'Gouvernance totale, sécurité, base de données & configuration',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-500',
    summary: 'Le Super-Administrateur détient l’autorité absolue sur l’écosystème E-Schola Pro : gestion des utilisateurs et rôles, sécurité, sessions actives, sauvegardes cryptographiques SHA256 et configuration système en direct.',
    checklist: [
      {
        id: 'adm_sec',
        title: 'Vérifier la console d’administration & sessions',
        desc: 'Inspectez les métriques serveur, les utilisateurs en ligne et révoquez les sessions suspectes si besoin.',
        actionHref: '/admin',
        actionLabel: 'Console /admin'
      },
      {
        id: 'adm_users',
        title: 'Superviser les comptes & invitations',
        desc: 'Gérez l’annuaire des formateurs, étudiants, envoyez des invitations par e-mail avec token sécurisé.',
        actionHref: '/admin',
        actionLabel: 'Gestion Utilisateurs'
      },
      {
        id: 'adm_backup',
        title: 'Effectuer un export de sauvegarde de la BDD',
        desc: 'Téléchargez une archive JSON intégrale signée par empreinte cryptographique SHA256.',
        actionHref: '/admin',
        actionLabel: 'Export Sauvegarde'
      },
      {
        id: 'adm_audit',
        title: 'Consulter le journal d’audit des actions',
        desc: 'Traçabilité complète des connexions, changements de rôles et suppressions de données.',
        actionHref: '/admin',
        actionLabel: 'Journal d’Audit'
      },
      {
        id: 'adm_settings',
        title: 'Ajuster les paramètres système à chaud',
        desc: 'Nom de l’établissement, mode maintenance, quotas d’upload et expiration des sessions JWT.',
        actionHref: '/admin',
        actionLabel: 'Paramètres Système'
      }
    ],
    modules: [
      {
        title: 'Console d’Administration Complète',
        href: '/admin',
        icon: ShieldCheck,
        badge: 'Gouvernance Totale',
        description: 'Portail centralisé pour la sécurité, les sessions, les logs d’audit, l’export de base et la gestion des rôles.',
        rights: 'Accès exclusif et complet avec privilèges Root'
      },
      {
        title: 'Annuaire Utilisateurs & Rôles',
        href: '/admin',
        icon: Users,
        badge: 'RBAC',
        description: 'Création, modification, attribution de rôles (formateur, étudiant, etc.) et réinitialisation de mots de passe.',
        rights: 'Tous droits de modification, activation et désactivation'
      },
      {
        title: 'Supervision des Formations & Groupes',
        href: '/courses',
        icon: BookOpen,
        badge: 'Supervision',
        description: 'Droit de regard et d’édition sur l’ensemble des cours créés par tous les formateurs.',
        rights: 'Contrôle global, archivage et modération'
      }
    ],
    tips: [
      'Le compte root "admin_first" est protégé au niveau du code : son rôle et son mot de passe ne peuvent être altérés que par l’administrateur légitime.',
      'Réalisez un export JSON de la base de données de façon régulière (hebdomadaire) avant toute mise à jour majeure.',
      'Activez le mode maintenance dans les paramètres système si vous devez effectuer des opérations de maintenance sur les cours ou la base.'
    ],
    faqs: [
      {
        q: 'Comment exporter une sauvegarde complète de la base de données ?',
        a: 'Rendez-vous dans la console d’administration (/admin), onglet "Sauvegarde BDD", puis cliquez sur "Télécharger l’archive JSON SHA256". Le fichier contient l’ensemble des tables avec horodatage et checksum.'
      },
      {
        q: 'Comment révoquer immédiatement une session utilisateur compromise ?',
        a: 'Dans l’onglet "Sessions Actives" de la console /admin, localisez l’utilisateur par son adresse email ou adresse IP, puis cliquez sur le bouton rouge "Révoquer la session". Le token sera immédiatement invalidé.'
      }
    ],
    permissions: {
      can: [
        'Accès illimité à l’ensemble des modules et API REST',
        'Création, suspension et suppression d’utilisateurs et attribution de rôles',
        'Accès aux journaux d’audit et historique complet des requêtes',
        'Révocation instantanée de sessions actives',
        'Exportation et sauvegarde des données avec signature SHA256',
        'Modification à chaud des paramètres d’infrastructure'
      ],
      cannot: [
        'Aucune restriction technique (pleins pouvoirs système)'
      ]
    }
  },

  admin_manager: {
    id: 'admin_manager',
    label: 'Admin Manager',
    tagline: 'Gestion opérationnelle, promotions, plannings & coordination',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    textColor: 'text-indigo-700',
    borderColor: 'border-indigo-500',
    summary: 'L’Admin Manager pilote le bon fonctionnement opérationnel de l’établissement : coordination des formateurs et des promotions, gestion des inscriptions, plannings d’examens et suivi consolidé des présences.',
    checklist: [
      {
        id: 'am_groups',
        title: 'Organiser les groupes et promotions',
        desc: 'Créez les classes, assignez les étudiants et associez les formateurs référents.',
        actionHref: '/group',
        actionLabel: 'Gérer les groupes'
      },
      {
        id: 'am_users',
        title: 'Inscrire les nouveaux apprenants',
        desc: 'Validez les nouveaux comptes étudiants et stagiaires.',
        actionHref: '/admin',
        actionLabel: 'Gestion Utilisateurs'
      },
      {
        id: 'am_calendar',
        title: 'Planifier les examens et plannings',
        desc: 'Coordonnez les salles virtuelles et les séances clés sur le calendrier partagé.',
        actionHref: '/calendar',
        actionLabel: 'Calendrier'
      },
      {
        id: 'am_attendance',
        title: 'Superviser l’assiduité globale',
        desc: 'Générez les synthèses de présence pour les bilans pédagogiques et de certification.',
        actionHref: '/attendance',
        actionLabel: 'Contrôle des présences'
      }
    ],
    modules: [
      {
        title: 'Gestion des Groupes & Classes',
        href: '/group',
        icon: Users,
        badge: 'Promotions',
        description: 'Création de classes virtuelles, constitution des listes d’apprenants et attribution de tuteurs.',
        rights: 'Créer, éditer, ajouter et retirer des membres de groupes'
      },
      {
        title: 'Planification & Calendrier',
        href: '/calendar',
        icon: Calendar,
        badge: 'Coordination',
        description: 'Synchronisation globale des cours magistraux, travaux pratiques et périodes d’examens.',
        rights: 'Créer des événements globaux et des jalons académiques'
      },
      {
        title: 'Supervision des Présences',
        href: '/attendance',
        icon: UserCheck,
        badge: 'Régularité',
        description: 'Contrôle des feuilles de présence et traitement des justificatifs d’absence.',
        rights: 'Consulter et valider les bilans d’assiduité'
      }
    ],
    tips: [
      'Vérifiez la composition des groupes avant le début du semestre pour que chaque étudiant accède automatiquement à ses cours.',
      'Coordonnez les dates limites de devoirs entre les formateurs pour éviter la surcharge des étudiants sur une même semaine.'
    ],
    faqs: [
      {
        q: 'Puis-je modifier le rôle d’un super-administrateur ?',
        a: 'Non. Le rôle Admin Manager est strictement opérationnel et ne peut pas modifier les privilèges des super-administrateurs racine ni accéder à la base de données brute.'
      }
    ],
    permissions: {
      can: [
        'Gérer les promotions, groupes et affectations d’étudiants',
        'Créer et assigner des formateurs et étudiants',
        'Superviser les plannings et les bilans de présence',
        'Diffuser des annonces officielles par messagerie'
      ],
      cannot: [
        'Modifier ou attribuer des rôles de super-administrateur',
        'Accéder à la console brute SQLAdmin ou aux secrets serveurs',
        'Supprimer les comptes protégés du système'
      ]
    }
  },

  pedagogique: {
    id: 'pedagogique',
    label: 'Responsable Pédagogique',
    tagline: 'Qualité d’enseignement, validation des programmes & suivi des acquis',
    badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
    textColor: 'text-teal-700',
    borderColor: 'border-teal-500',
    summary: 'Le Responsable Pédagogique assure la qualité et la conformité des formations dispensées : validation des programmes de cours, suivi des taux de réussite aux quiz et accompagnement des formateurs.',
    checklist: [
      {
        id: 'ped_courses',
        title: 'Revue des supports & syllabus',
        desc: 'Consultez les cours créés par l’équipe enseignante pour garantir la cohérence des programmes.',
        actionHref: '/courses',
        actionLabel: 'Consulter les cours'
      },
      {
        id: 'ped_quizzes',
        title: 'Analyse des évaluations & résultats',
        desc: 'Mesurez les taux de réussite aux quiz pour identifier d’éventuelles difficultés d’apprentissage.',
        actionHref: '/quizzes',
        actionLabel: 'Résultats des quiz'
      },
      {
        id: 'ped_groups',
        title: 'Suivi de la dynamique de promotion',
        desc: 'Évaluez l’assiduité et la progression globale des groupes d’étudiants.',
        actionHref: '/group',
        actionLabel: 'Groupes d’apprenants'
      }
    ],
    modules: [
      {
        title: 'Audit des Cours',
        href: '/courses',
        icon: BookOpen,
        badge: 'Contenu',
        description: 'Vérification de la clarté pédagogique et de la complétude des ressources.',
        rights: 'Consultation et accompagnement à la création'
      },
      {
        title: 'Suivi des Évaluations',
        href: '/quizzes',
        icon: Award,
        badge: 'Métriques',
        description: 'Statistiques consolidées de performance par matière et par promotion.',
        rights: 'Consultation des statistiques de notation'
      }
    ],
    tips: [
      'Encouragez les formateurs à intégrer des quiz réguliers de 5 questions pour ancrer la mémorisation des cours.',
      'Consultez les feedbacks des étudiants pour adapter le rythme des sessions de visioconférence.'
    ],
    faqs: [
      {
        q: 'Comment repérer les apprenants en décrochage ?',
        a: 'Consultez conjointement la page Émargement (/attendance) pour vérifier l’assiduité et la section Quiz (/quizzes) pour comparer les moyennes.'
      }
    ],
    permissions: {
      can: [
        'Consulter l’ensemble des cours et ressources pédagogiques',
        'Consulter les résultats des évaluations et bilans d’assiduité',
        'Accéder aux trombinoscopes et listes de promotions',
        'Échanger avec les formateurs et les apprenants'
      ],
      cannot: [
        'Modifier les tables de base de données ou sessions système',
        'Supprimer des utilisateurs ou modifier les clés d’API'
      ]
    }
  },

  dg_rh: {
    id: 'dg_rh',
    label: 'Direction & RH',
    tagline: 'Conformité des formations, suivi des stagiaires & bilans OPCO',
    badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
    textColor: 'text-amber-800',
    borderColor: 'border-amber-500',
    summary: 'La Direction & Ressources Humaines supervise la rentabilité, l’assiduité et la conformité administrative des parcours de formation, particulièrement pour les stagiaires et les employés en montée de compétences.',
    checklist: [
      {
        id: 'rh_att',
        title: 'Contrôler les feuilles d’émargement certifiées',
        desc: 'Exportez les relevés d’assiduité conformes pour les audits de formation et les financeurs.',
        actionHref: '/attendance',
        actionLabel: 'Rapports d’émargement'
      },
      {
        id: 'rh_stagiaires',
        title: 'Suivi des stagiaires & employés',
        desc: 'Vérifiez la progression des alternants, stagiaires et salariés en formation continue.',
        actionHref: '/group',
        actionLabel: 'Apprenants professionnels'
      }
    ],
    modules: [
      {
        title: 'Rapports d’Émargement & Assiduité',
        href: '/attendance',
        icon: UserCheck,
        badge: 'Conformité Légale',
        description: 'Tableaux d’assiduité nominatifs indispensables pour la justification des heures de formation.',
        rights: 'Consultation et export des rapports consolidés'
      }
    ],
    tips: [
      'Téléchargez les feuilles de présence à la fin de chaque mois pour anticiper les bilans de fin de formation.',
      'Assurez-vous que les employés ont validé leur quiz de certification avant la remise de l’attestation.'
    ],
    faqs: [
      {
        q: 'Les relevés de présence sont-ils valables pour les audits de certification ?',
        a: 'Oui. Le système enregistre l’adresse IP, l’horodatage précis à la seconde, le mode de validation (signature ou PIN) et le statut de présence certifié.'
      }
    ],
    permissions: {
      can: [
        'Consulter et exporter les données de présence et d’assiduité',
        'Suivre l’avancement des apprenants professionnels',
        'Communiquer avec les formateurs référents'
      ],
      cannot: [
        'Modifier le contenu pédagogique des cours',
        'Accéder à la configuration des serveurs techniques'
      ]
    }
  },

  stagiaire: {
    id: 'stagiaire',
    label: 'Stagiaire',
    tagline: 'Immersion professionnelle, livrables de stage & émargement',
    badgeColor: 'bg-sky-50 text-sky-700 border-sky-200',
    textColor: 'text-sky-700',
    borderColor: 'border-sky-500',
    summary: 'En tant que stagiaire, vous bénéficiez d’un cursus ciblé : accès aux formations pratiques, rendu des rapports de stage, émargement obligatoire et contact direct avec votre maître de stage.',
    checklist: [
      {
        id: 'stg_courses',
        title: 'Consulter les guides pratiques & formations',
        desc: 'Accédez aux modules métiers indispensables pour votre stage.',
        actionHref: '/courses',
        actionLabel: 'Mes modules'
      },
      {
        id: 'stg_task',
        title: 'Déposer vos rapports de stage & livrables',
        desc: 'Transmettez vos comptes-rendus et devoirs hebdomadaires à votre tuteur.',
        actionHref: '/assignments',
        actionLabel: 'Rendre un rapport'
      },
      {
        id: 'stg_attendance',
        title: 'Signer votre présence quotidienne',
        desc: 'Justification officielle obligatoire de vos heures de présence.',
        actionHref: '/attendance',
        actionLabel: 'Émarger maintenant'
      }
    ],
    modules: [
      {
        title: 'Dépôt des Livrables de Stage',
        href: '/assignments',
        icon: CheckSquare,
        badge: 'Rapports',
        description: 'Téléchargement de vos bilans de mission et réception des évaluations de stage.',
        rights: 'Soumission des documents et lecture des appréciations'
      },
      {
        title: 'Feuille d’Émargement',
        href: '/attendance',
        icon: UserCheck,
        badge: 'Présence',
        description: 'Signature numérique de présence par session.',
        rights: 'Signature personnelle lors des sessions actives'
      }
    ],
    tips: [
      'Pensez à émarger dès le début de chaque session pour éviter d’être comptabilisé en retard.',
      'Utilisez la messagerie pour poser vos questions à votre tuteur si une consigne n’est pas claire.'
    ],
    faqs: [
      {
        q: 'Où retrouver l’évaluation de mon rapport de stage ?',
        a: 'Rendez-vous dans "Devoirs" (/assignments) et sélectionnez votre livrable : la note et l’avis détaillé de votre tuteur y seront affichés.'
      }
    ],
    permissions: {
      can: [
        'Suivre les cours et visioconférences attribués',
        'Déposer ses rapports et devoirs de stage',
        'Signer sa présence en ligne',
        'Contacter son encadrant via la messagerie'
      ],
      cannot: [
        'Créer ou modifier les cours de l’établissement',
        'Consulter les informations des autres promotions'
      ]
    }
  },

  employer: {
    id: 'employer',
    label: 'Employé en formation',
    tagline: 'Montée en compétences, e-learning professionnel & certification',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-500',
    summary: 'En tant que salarié en formation continue, vous accédez à des modules flexibles conçus pour s’adapter à vos horaires : vidéos en streaming, documents téléchargeables, quiz de certification et émargement dématérialisé.',
    checklist: [
      {
        id: 'emp_courses',
        title: 'Parcourir vos modules de formation continue',
        desc: 'Suivez vos leçons en rythme asynchrone selon vos disponibilités professionnelles.',
        actionHref: '/courses',
        actionLabel: 'Accéder aux leçons'
      },
      {
        id: 'emp_quiz',
        title: 'Valider les quiz de certification de compétences',
        desc: 'Mesurez l’assimilation des connaissances pour l’obtention de votre attestation.',
        actionHref: '/quizzes',
        actionLabel: 'Passer la certification'
      },
      {
        id: 'emp_att',
        title: 'Signer l’émargement dématérialisé',
        desc: 'Justification des heures de formation continue pour votre entreprise et l’OPCO.',
        actionHref: '/attendance',
        actionLabel: 'Émargement'
      }
    ],
    modules: [
      {
        title: 'Parcours de Formation Continue',
        href: '/courses',
        icon: BookOpen,
        badge: 'E-Learning',
        description: 'Vidéos de haute qualité, fiches pratiques et résumés applicables en entreprise.',
        rights: 'Visionnage et téléchargement des fiches métiers'
      },
      {
        title: 'Tests de Validation & Certification',
        href: '/quizzes',
        icon: Award,
        badge: 'Compétences',
        description: 'Quiz de validation des acquis nécessaires à la délivrance des certifications professionnelles.',
        rights: 'Validation des modules et historique de score'
      }
    ],
    tips: [
      'Téléchargez les supports de cours au format PDF pour les garder à portée de main sur votre poste de travail.',
      'Signez vos feuilles d’émargement pour garantir le financement intégral de votre formation continue.'
    ],
    faqs: [
      {
        q: 'Comment obtenir mon attestation de formation continue ?',
        a: 'Après avoir validé l’ensemble des quiz du parcours et atteint le taux d’émargement requis (minimum 80%), votre attestation de compétences sera émise par l’administration.'
      }
    ],
    permissions: {
      can: [
        'Accéder aux parcours professionnels attribués',
        'Passer les tests de certification',
        'Signer les feuilles d’émargement dématérialisées',
        'Consulter son bilan de compétences'
      ],
      cannot: [
        'Altérer les barèmes de certification',
        'Accéder aux données des autres entreprises'
      ]
    }
  }
};

export default function RoleGuideAssistant() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'checklist' | 'modules' | 'tips' | 'faq' | 'permissions'>('checklist');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<RoleType>('etudiant');
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [currentUserRole, setCurrentUserRole] = useState<RoleType | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // 1. Initialiser le rôle courant depuis le token ou localStorage
  useEffect(() => {
    const detectUserRole = () => {
      try {
        const storedRole = localStorage.getItem('user_role');
        if (storedRole) {
          const clean = storedRole.trim().toLowerCase() as RoleType;
          if (ROLES_DATA[clean]) {
            setCurrentUserRole(clean);
            setSelectedRole(clean);
            return;
          }
        }
        const token = localStorage.getItem('access_token');
        if (token) {
          const parts = token.split('.');
          if (parts.length === 3) {
            const base64Url = parts[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(
              atob(base64)
                .split('')
                .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
            );
            const payload = JSON.parse(jsonPayload);
            if (payload.role) {
              const r = String(payload.role).trim().toLowerCase() as RoleType;
              if (ROLES_DATA[r]) {
                setCurrentUserRole(r);
                setSelectedRole(r);
                localStorage.setItem('user_role', r);
                return;
              }
            }
          }
        }
      } catch {}
      setSelectedRole('etudiant');
    };

    detectUserRole();

    // 2. Écouter les événements d'ouverture externe (Navbar, Sidebar, etc.)
    const handleOpenGuide = (e: any) => {
      if (e?.detail?.role && ROLES_DATA[e.detail.role as RoleType]) {
        setSelectedRole(e.detail.role as RoleType);
      }
      setIsOpen(true);
      setIsMinimized(false);
    };

    window.addEventListener('open_role_guide', handleOpenGuide);
    window.addEventListener('auth_user_updated', detectUserRole);

    return () => {
      window.removeEventListener('open_role_guide', handleOpenGuide);
      window.removeEventListener('auth_user_updated', detectUserRole);
    };
  }, []);

  // 3. Charger les cases cochées de la checklist pour ce rôle depuis le localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`guide_checklist_${selectedRole}`);
      if (stored) {
        setCheckedItems(JSON.parse(stored));
      } else {
        setCheckedItems({});
      }
    } catch {
      setCheckedItems({});
    }
  }, [selectedRole]);

  // 4. Basculer l'état d'un élément de checklist
  const toggleCheckItem = (id: string) => {
    setCheckedItems((prev) => {
      const updated = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(`guide_checklist_${selectedRole}`, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // 5. Réinitialiser la checklist pour ce rôle
  const resetChecklist = () => {
    setCheckedItems({});
    try {
      localStorage.removeItem(`guide_checklist_${selectedRole}`);
    } catch {}
  };

  // Configuration du rôle sélectionné
  const currentConfig = ROLES_DATA[selectedRole] || ROLES_DATA.etudiant;

  // Calcul du progrès dans la checklist
  const totalTasks = currentConfig.checklist.length;
  const completedTasks = currentConfig.checklist.filter((item) => checkedItems[item.id]).length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Filtrage par recherche
  const filteredChecklist = useMemo(() => {
    if (!searchQuery) return currentConfig.checklist;
    const q = searchQuery.toLowerCase();
    return currentConfig.checklist.filter(
      (item) => item.title.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q)
    );
  }, [currentConfig, searchQuery]);

  const filteredModules = useMemo(() => {
    if (!searchQuery) return currentConfig.modules;
    const q = searchQuery.toLowerCase();
    return currentConfig.modules.filter(
      (m) => m.title.toLowerCase().includes(q) || m.description.toLowerCase().includes(q) || m.rights.toLowerCase().includes(q)
    );
  }, [currentConfig, searchQuery]);

  const filteredFaqs = useMemo(() => {
    if (!searchQuery) return currentConfig.faqs;
    const q = searchQuery.toLowerCase();
    return currentConfig.faqs.filter(
      (f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q)
    );
  }, [currentConfig, searchQuery]);

  const filteredTips = useMemo(() => {
    if (!searchQuery) return currentConfig.tips;
    const q = searchQuery.toLowerCase();
    return currentConfig.tips.filter((t) => t.toLowerCase().includes(q));
  }, [currentConfig, searchQuery]);

  // Navigation vers un module
  const handleNavigate = (href: string) => {
    setIsOpen(false);
    router.push(href as any);
  };

  return (
    <>
      {/* ===================================================================== */}
      {/* 1. BOUTON FLOTTANT D'ASSISTANT (Bottom Right Corner)                   */}
      {/* ===================================================================== */}
      <div className="fixed bottom-5 right-5 z-40 print:hidden flex flex-col items-end gap-2">
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className="group flex items-center gap-2.5 px-4 py-3 bg-[#1877f2] hover:bg-[#166fe5] text-white rounded-2xl shadow-lg hover:shadow-xl hover:shadow-blue-500/25 border border-white/20 transition-all duration-200 active:scale-95 cursor-pointer"
            title="Ouvrir le Guide Assistant par Rôle"
            aria-label="Guide Assistant E-Schola"
          >
            <div className="relative flex items-center justify-center w-7 h-7 rounded-xl bg-white/20">
              <Sparkles className="w-4 h-4 text-white animate-pulse" />
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-bold leading-tight flex items-center gap-1.5">
                Guide Assistant
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <div className="text-[10.5px] text-blue-100 font-medium leading-none mt-0.5">
                Aide & Parcours {currentConfig.label}
              </div>
            </div>
          </button>
        )}
      </div>

      {/* ===================================================================== */}
      {/* 2. MODAL DU GUIDE ASSISTANT INTERACTIF                                 */}
      {/* ===================================================================== */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fade-in print:hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div
            ref={modalRef}
            className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-zoom-in"
            role="dialog"
            aria-modal="true"
          >
            {/* Header Pro avec E-Schola Blue Theme */}
            <div className="bg-gradient-to-r from-[#1877f2] to-[#0052cc] px-5 sm:px-7 py-4 text-white flex items-center justify-between shrink-0 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shadow-inner">
                  <Compass className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black tracking-tight text-white">
                      Guide Assistant E-Schola Pro
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-white/20 text-white border border-white/30 uppercase tracking-wider">
                      Interactif
                    </span>
                  </div>
                  <p className="text-xs text-blue-100/90 font-medium">
                    Consultez vos actions clés, tutoriels et astuces adaptés à votre rôle
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-colors"
                  title="Fermer le guide (Échap)"
                  aria-label="Fermer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Barre de sélection de rôle (Pills) & Recherche */}
            <div className="bg-slate-50 border-b border-slate-200 px-5 sm:px-7 py-3 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Sélecteur de rôle */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
                <span className="text-xs font-bold text-slate-600 shrink-0 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-blue-600" /> Rôle :
                </span>
                {(Object.keys(ROLES_DATA) as RoleType[]).map((rKey) => {
                  const r = ROLES_DATA[rKey];
                  const isSelected = selectedRole === rKey;
                  const isUserActualRole = currentUserRole === rKey;

                  return (
                    <button
                      key={rKey}
                      onClick={() => {
                        setSelectedRole(rKey);
                        setSearchQuery('');
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-[#1877f2] text-white shadow-sm shadow-blue-600/30'
                          : 'bg-white text-slate-700 hover:bg-slate-200/80 border border-slate-200'
                      }`}
                    >
                      {r.label}
                      {isUserActualRole && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Votre rôle actuel" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Champ de recherche interne */}
              <div className="relative min-w-[220px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher une action, question..."
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Bannière du rôle sélectionné & Barre de progression Checklist */}
            <div className="px-5 sm:px-7 py-3.5 bg-blue-50/50 border-b border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-extrabold border ${currentConfig.badgeColor}`}>
                  {currentConfig.label.toUpperCase()}
                </span>
                <p className="text-xs text-slate-700 font-medium">
                  {currentConfig.tagline}
                </p>
              </div>

              {/* Jauge de progression de la checklist */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <div className="text-[11px] font-bold text-slate-700">
                    Progression : {completedTasks}/{totalTasks} étapes ({progressPercent}%)
                  </div>
                  <div className="w-32 sm:w-40 h-2 bg-slate-200 rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Onglets de navigation dans le guide */}
            <div className="flex items-center gap-1 px-5 sm:px-7 border-b border-slate-200 bg-white shrink-0 overflow-x-auto scrollbar-none">
              <button
                onClick={() => setActiveTab('checklist')}
                className={`py-3 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 shrink-0 ${
                  activeTab === 'checklist'
                    ? 'border-[#1877f2] text-[#1877f2]'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Parcours & Checklist ({completedTasks}/{totalTasks})
              </button>

              <button
                onClick={() => setActiveTab('modules')}
                className={`py-3 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 shrink-0 ${
                  activeTab === 'modules'
                    ? 'border-[#1877f2] text-[#1877f2]'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                Modules & Raccourcis ({currentConfig.modules.length})
              </button>

              <button
                onClick={() => setActiveTab('tips')}
                className={`py-3 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 shrink-0 ${
                  activeTab === 'tips'
                    ? 'border-[#1877f2] text-[#1877f2]'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Astuces & Bonnes Pratiques
              </button>

              <button
                onClick={() => setActiveTab('faq')}
                className={`py-3 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 shrink-0 ${
                  activeTab === 'faq'
                    ? 'border-[#1877f2] text-[#1877f2]'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <BadgeHelp className="w-3.5 h-3.5" />
                FAQ & Aide ({currentConfig.faqs.length})
              </button>

              <button
                onClick={() => setActiveTab('permissions')}
                className={`py-3 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 shrink-0 ${
                  activeTab === 'permissions'
                    ? 'border-[#1877f2] text-[#1877f2]'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Droits & Permissions
              </button>
            </div>

            {/* Contenu Scrollable */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-4">
              {/* ============================================================= */}
              {/* ONGLET 1 : CHECKLIST & DÉMARRAGE RAPIDE                       */}
              {/* ============================================================= */}
              {activeTab === 'checklist' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Votre feuille de route pour débuter en tant que {currentConfig.label}
                      </h3>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Cochez chaque action au fur et à mesure de votre progression. Votre avancée est sauvegardée automatiquement.
                      </p>
                    </div>

                    {completedTasks > 0 && (
                      <button
                        onClick={resetChecklist}
                        className="text-xs text-slate-600 hover:text-red-600 flex items-center gap-1 font-semibold transition-colors"
                        title="Réinitialiser les étapes"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Réinitialiser
                      </button>
                    )}
                  </div>

                  {filteredChecklist.length === 0 ? (
                    <div className="text-center py-8 text-slate-600 text-xs">
                      Aucune étape ne correspond à votre recherche.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2.5">
                      {filteredChecklist.map((item, index) => {
                        const isDone = !!checkedItems[item.id];
                        return (
                          <div
                            key={item.id}
                            className={`flex items-start justify-between gap-3 p-3.5 rounded-xl border transition-all ${
                              isDone
                                ? 'bg-emerald-50/40 border-emerald-200'
                                : 'bg-white border-slate-200 hover:border-blue-300 shadow-xs'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <button
                                onClick={() => toggleCheckItem(item.id)}
                                className="mt-0.5 text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"
                                aria-label={isDone ? 'Marquer comme non fait' : 'Marquer comme fait'}
                              >
                                {isDone ? (
                                  <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-100" />
                                ) : (
                                  <Circle className="w-5 h-5 text-slate-300 hover:text-slate-500" />
                                )}
                              </button>

                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-bold text-slate-600">
                                    Étape {index + 1}
                                  </span>
                                  <h4
                                    className={`text-xs font-bold ${
                                      isDone ? 'line-through text-slate-600' : 'text-slate-900'
                                    }`}
                                  >
                                    {item.title}
                                  </h4>
                                </div>
                                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                                  {item.desc}
                                </p>
                              </div>
                            </div>

                            {item.actionHref && (
                              <button
                                onClick={() => handleNavigate(item.actionHref!)}
                                className="shrink-0 px-3 py-1.5 bg-[#1877f2] hover:bg-[#166fe5] text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-xs hover:shadow-md cursor-pointer"
                              >
                                {item.actionLabel || 'Ouvrir'}
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {progressPercent === 100 && (
                    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-emerald-800 text-xs font-bold animate-zoom-in">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      Félicitations ! Vous avez complété toutes les étapes recommandées pour le rôle de {currentConfig.label}. Vous maîtrisez désormais les outils essentiels.
                    </div>
                  )}
                </div>
              )}

              {/* ============================================================= */}
              {/* ONGLET 2 : MODULES & RACCOURCIS DIRECTS                       */}
              {/* ============================================================= */}
              {activeTab === 'modules' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Modules essentiels pour le rôle : {currentConfig.label}
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Accédez directement aux sections qui vous sont autorisées et découvrez vos droits sur chacune d’elles.
                    </p>
                  </div>

                  {filteredModules.length === 0 ? (
                    <div className="text-center py-8 text-slate-600 text-xs">
                      Aucun module ne correspond à votre recherche.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {filteredModules.map((mod) => {
                        const Icon = mod.icon;
                        return (
                          <div
                            key={mod.title}
                            className="bg-white border border-slate-200 hover:border-blue-400 rounded-xl p-4 flex flex-col justify-between shadow-xs hover:shadow-md transition-all group"
                          >
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <div className="w-9 h-9 rounded-lg bg-blue-50 text-[#1877f2] flex items-center justify-center group-hover:scale-105 transition-transform">
                                  <Icon className="w-5 h-5" />
                                </div>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                  {mod.badge}
                                </span>
                              </div>

                              <h4 className="text-xs font-bold text-slate-900 mb-1">
                                {mod.title}
                              </h4>
                              <p className="text-xs text-slate-600 mb-2 leading-relaxed">
                                {mod.description}
                              </p>
                              <div className="text-[11px] font-medium text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 mb-3">
                                <strong>Vos droits :</strong> {mod.rights}
                              </div>
                            </div>

                            <button
                              onClick={() => handleNavigate(mod.href)}
                              className="w-full py-2 bg-slate-50 hover:bg-[#1877f2] text-slate-700 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-slate-200 hover:border-blue-600 cursor-pointer"
                            >
                              Accéder au module
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ============================================================= */}
              {/* ONGLET 3 : ASTUCES & BONNES PRATIQUES                         */}
              {/* ============================================================= */}
              {activeTab === 'tips' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Astuces & Recommandations Pro pour {currentConfig.label}
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Conseils pour optimiser votre expérience, fluidifier les visioconférences et sécuriser votre compte.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5">
                    {filteredTips.map((tip, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-100 flex items-start gap-3"
                      >
                        <div className="w-6 h-6 rounded-full bg-[#1877f2] text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                          {idx + 1}
                        </div>
                        <p className="text-xs text-slate-700 font-medium leading-relaxed">
                          {tip}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Encadré d'assistance technique */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3 mt-4">
                    <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        Besoin d’une assistance technique avancée ?
                      </h4>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                        Si vous rencontrez un dysfonctionnement ou un problème de droit d’accès, contactez votre administrateur d’établissement ou utilisez la messagerie interne pour échanger avec le support.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================= */}
              {/* ONGLET 4 : FOIRE AUX QUESTIONS (FAQ)                          */}
              {/* ============================================================= */}
              {activeTab === 'faq' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Questions fréquemment posées ({currentConfig.label})
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Réponses immédiates aux problématiques courantes rencontrées sur la plateforme.
                    </p>
                  </div>

                  {filteredFaqs.length === 0 ? (
                    <div className="text-center py-8 text-slate-600 text-xs">
                      Aucune question ne correspond à votre recherche.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {filteredFaqs.map((faq, idx) => (
                        <div
                          key={idx}
                          className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs"
                        >
                          <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2 mb-1.5">
                            <HelpCircle className="w-4 h-4 text-[#1877f2] shrink-0" />
                            {faq.q}
                          </h4>
                          <p className="text-xs text-slate-600 pl-6 leading-relaxed">
                            {faq.a}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ============================================================= */}
              {/* ONGLET 5 : MATRICE DES DROITS & LIMITES                       */}
              {/* ============================================================= */}
              {activeTab === 'permissions' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Matrice des Droits & Restrictions ({currentConfig.label})
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Résumé clair des actions autorisées et des fonctionnalités restreintes selon les règles de gouvernance RBAC.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Ce que vous pouvez faire */}
                    <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs mb-3">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Actions Autorisées
                      </div>
                      <ul className="space-y-2 text-xs text-slate-700">
                        {currentConfig.permissions.can.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-emerald-500 font-bold">✓</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Ce qui est restreint */}
                    <div className="bg-rose-50/50 border border-rose-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-rose-800 font-bold text-xs mb-3">
                        <AlertCircle className="w-4 h-4 text-rose-600" />
                        Restrictions & Périmètre Interdit
                      </div>
                      <ul className="space-y-2 text-xs text-slate-700">
                        {currentConfig.permissions.cannot.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-rose-500 font-bold">✕</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Modale */}
            <div className="px-5 sm:px-7 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 shrink-0">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#1877f2]" />
                E-Schola Pro v1.2.0 • Assistant Pédagogique Intelligent
              </span>
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-bold transition-colors cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
