export type AppSectionId =
  | 'livestock'
  | 'production'
  | 'medical'
  | 'financial'
  | 'alerts';

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
] as const;
