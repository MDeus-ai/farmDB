export const SPECIES_LIST = ['cow', 'goat', 'sheep', 'other'] as const;
export type Species = (typeof SPECIES_LIST)[number];

export const LIVESTOCK_STATUSES = ['active', 'sold', 'deceased'] as const;
export type LivestockStatus = (typeof LIVESTOCK_STATUSES)[number];

export const TRANSACTION_TYPES = ['income', 'expense'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const FINANCIAL_CATEGORIES = [
  'milk_sale',
  'livestock_sale',
  'feed',
  'meds',
  'veterinary',
  'equipment',
  'other',
] as const;
export type FinancialCategory = (typeof FINANCIAL_CATEGORIES)[number];

export interface Livestock {
  id: string;
  species: Species;
  tagNumber: string;
  name: string | null;
  breed: string | null;
  dob: string | null;
  imageUri: string | null;
  status: LivestockStatus;
  createdAt: number;
  updatedAt: number;
}

export interface NewLivestockInput {
  species?: Species;
  tagNumber: string;
  name?: string | null;
  breed?: string | null;
  dob?: string | null;
  imageUri?: string | null;
  status?: LivestockStatus;
}

export interface UpdateLivestockInput {
  species?: Species;
  tagNumber?: string;
  name?: string | null;
  breed?: string | null;
  dob?: string | null;
  imageUri?: string | null;
  status?: LivestockStatus;
}

export interface LivestockFilter {
  search?: string;
  species?: Species | 'all';
  status?: LivestockStatus | 'all';
}

export interface ProductRecord {
  id: string;
  livestockId: string;
  date: string;
  yieldAmount: number;
  qualityNotes: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface MedicalRecord {
  id: string;
  livestockId: string;
  date: string;
  condition: string;
  treatment: string;
  cost: number;
  veterinarian: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface FinancialLog {
  id: string;
  livestockId: string | null;
  transactionType: TransactionType;
  amount: number;
  date: string;
  category: FinancialCategory;
  notes: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface AlertItem {
  id: string;
  livestockId: string | null;
  title: string;
  description: string | null;
  triggerDate: string;
  isResolved: boolean;
  createdAt: number;
  updatedAt: number;
}
