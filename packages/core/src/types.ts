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

export const INCOME_CATEGORIES: readonly FinancialCategory[] = [
  'milk_sale',
  'livestock_sale',
  'other',
];

export const EXPENSE_CATEGORIES: readonly FinancialCategory[] = [
  'feed',
  'meds',
  'veterinary',
  'equipment',
  'other',
];

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

export interface NewProductRecordInput {
  livestockId: string;
  date: string;
  yieldAmount: number;
  qualityNotes?: string | null;
}

export interface UpdateProductRecordInput {
  livestockId?: string;
  date?: string;
  yieldAmount?: number;
  qualityNotes?: string | null;
}

export interface ProductRecordFilter {
  livestockId?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
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

export interface NewMedicalRecordInput {
  livestockId: string;
  date: string;
  condition: string;
  treatment: string;
  cost?: number;
  veterinarian?: string | null;
}

export interface UpdateMedicalRecordInput {
  livestockId?: string;
  date?: string;
  condition?: string;
  treatment?: string;
  cost?: number;
  veterinarian?: string | null;
}

export interface MedicalRecordFilter {
  livestockId?: string;
  search?: string;
}

export const ALERT_ENTRY_KINDS = ['alert', 'note'] as const;
export type AlertEntryKind = (typeof ALERT_ENTRY_KINDS)[number];

export interface FinancialLog {
  id: string;
  livestockId: string | null;
  productRecordId: string | null;
  transactionType: TransactionType;
  amount: number;
  date: string;
  category: FinancialCategory;
  notes: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface NewFinancialLogInput {
  livestockId?: string | null;
  productRecordId?: string | null;
  transactionType: TransactionType;
  amount: number;
  date: string;
  category: FinancialCategory;
  notes?: string | null;
}

export interface UpdateFinancialLogInput {
  livestockId?: string | null;
  transactionType?: TransactionType;
  amount?: number;
  date?: string;
  category?: FinancialCategory;
  notes?: string | null;
}

export interface FinancialLogFilter {
  transactionType?: TransactionType | 'all';
  category?: FinancialCategory | 'all';
  livestockId?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
}

export interface FarmSettings {
  defaultMilkRatePerLiter: number;
  currencySymbol: string;
}

export interface AlertItem {
  id: string;
  livestockId: string | null;
  entryKind: AlertEntryKind;
  title: string;
  description: string | null;
  triggerDate: string;
  isResolved: boolean;
  notifiedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface NewAlertInput {
  livestockId?: string | null;
  entryKind?: AlertEntryKind;
  title: string;
  description?: string | null;
  triggerDate?: string;
  isResolved?: boolean;
}

export interface UpdateAlertInput {
  livestockId?: string | null;
  entryKind?: AlertEntryKind;
  title?: string;
  description?: string | null;
  triggerDate?: string;
  isResolved?: boolean;
}

export interface AlertFilter {
  entryKind?: AlertEntryKind | 'all';
  status?: 'open' | 'resolved' | 'all';
  livestockId?: string;
  search?: string;
}
