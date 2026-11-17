export type AppSectionId =
  | 'livestock'
  | 'ownerships'
  | 'family_tree'
  | 'production'
  | 'medical'
  | 'financial'
  | 'alerts'
  | 'hr'
  | 'statistics'
  | 'network'
  | 'backup'
  | 'settings';

export interface AppSectionMeta {
  id: AppSectionId;
  label: string;
  shortLabel: string;
  phase: number;
  description: string;
}

export const APP_SECTIONS: readonly AppSectionMeta[] = [
  {
    id: 'livestock',
    label: 'Herd Registry',
    shortLabel: 'Herd',
    phase: 1,
    description: 'Manage cows and livestock records stored in local SQLite.',
  },
  {
    id: 'ownerships',
    label: 'Ownerships',
    shortLabel: 'Owners',
    phase: 5,
    description: 'Track external, boarded, co-owned, breeding loan, and sold animals kept on farm.',
  },
  {
    id: 'family_tree',
    label: 'Herd Family Tree',
    shortLabel: 'Lineage',
    phase: 5,
    description: 'Visual pedigree, ancestry, progeny, and family relationships across your herd.',
  },
  {
    id: 'production',
    label: 'Milk Production',
    shortLabel: 'Yields',
    phase: 3,
    description: 'Daily milk yield tracking and quality notes per animal.',
  },
  {
    id: 'medical',
    label: 'Medical History',
    shortLabel: 'Medical',
    phase: 4,
    description: 'Treatments, vaccinations, diagnoses, and veterinary logs.',
  },
  {
    id: 'financial',
    label: 'Financial Ledger',
    shortLabel: 'Finance',
    phase: 3,
    description: 'Milk sales, feed purchases, medical expenses, and margins.',
  },
  {
    id: 'alerts',
    label: 'Alerts & Notes',
    shortLabel: 'Alerts',
    phase: 4,
    description: 'Scheduled reminders, breeding checks, and farm notes.',
  },
  {
    id: 'hr',
    label: 'Human Resources',
    shortLabel: 'Staff',
    phase: 5,
    description: 'Track farm workers, salaries, pending payments, responsibilities, and allocated tasks.',
  },
  {
    id: 'statistics',
    label: 'Farm Statistics',
    shortLabel: 'Stats',
    phase: 5,
    description: 'Explore herd analytics, yield performance, health patterns, and species financial charts.',
  },
  {
    id: 'network',
    label: 'Farm Network',
    shortLabel: 'Network',
    phase: 5,
    description: 'Manage connected accounts, family/owner privileges, and Supabase cloud sync.',
  },
  {
    id: 'backup',
    label: 'Export & Backup',
    shortLabel: 'Backup',
    phase: 5,
    description: 'Download CSV/JSON exports and backup or restore the local SQLite database.',
  },
  {
    id: 'settings',
    label: 'Settings',
    shortLabel: 'Settings',
    phase: 5,
    description: 'Adjust font size, UI density, farm defaults, notifications, and app behavior.',
  },
] as const;
