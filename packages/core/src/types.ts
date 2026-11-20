export const SPECIES_LIST = ['cow', 'goat', 'sheep', 'duck', 'other'] as const;
export type Species = (typeof SPECIES_LIST)[number];

export const MILK_PRODUCING_SPECIES = ['cow', 'goat', 'sheep'] as const;
export type MilkProducingSpecies = (typeof MILK_PRODUCING_SPECIES)[number];

export function isMilkProducingSpecies(species: Species): boolean {
  return (MILK_PRODUCING_SPECIES as readonly string[]).includes(species);
}

export const LIVESTOCK_SEXES = ['female', 'male'] as const;
export type LivestockSex = (typeof LIVESTOCK_SEXES)[number];

export function inferDefaultLivestockSex(
  tagNumber?: string | null,
  roleHint?: 'sire' | 'dam'
): LivestockSex {
  if (roleHint === 'sire') return 'male';
  if (roleHint === 'dam') return 'female';
  if (
    tagNumber &&
    /\b(BULL|RAM|BUCK|DRAKE|ROOSTER|SIRE|MALE|BOAR|STALLION)\b/i.test(tagNumber)
  ) {
    return 'male';
  }
  return 'female';
}

export function formatSexLabel(sex?: LivestockSex | null): string {
  return sex === 'male' ? 'Male' : 'Female';
}

export function isFemaleMilkProducingAnimal(
  animal: Pick<Livestock, 'species'> & { sex?: LivestockSex | null }
): boolean {
  return (
    isMilkProducingSpecies(animal.species) &&
    (animal.sex ?? 'female') === 'female'
  );
}

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
  'payroll',
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
  'payroll',
  'equipment',
  'other',
];

export interface Livestock {
  id: string;
  species: Species;
  sex: LivestockSex;
  tagNumber: string;
  name: string | null;
  breed: string | null;
  dob: string | null;
  imageUri: string | null;
  sireId: string | null;
  damId: string | null;
  status: LivestockStatus;
  createdAt: number;
  updatedAt: number;
}

export interface NewLivestockInput {
  species?: Species;
  sex?: LivestockSex;
  tagNumber: string;
  name?: string | null;
  breed?: string | null;
  dob?: string | null;
  imageUri?: string | null;
  sireId?: string | null;
  damId?: string | null;
  status?: LivestockStatus;
}

export interface UpdateLivestockInput {
  species?: Species;
  sex?: LivestockSex;
  tagNumber?: string;
  name?: string | null;
  breed?: string | null;
  dob?: string | null;
  imageUri?: string | null;
  sireId?: string | null;
  damId?: string | null;
  status?: LivestockStatus;
}

export interface LivestockFilter {
  search?: string;
  species?: Species | 'all';
  sex?: LivestockSex | 'all';
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

export const FONT_SCALES = ['small', 'medium', 'large', 'xlarge'] as const;
export type FontScale = (typeof FONT_SCALES)[number];

export const UI_DENSITIES = ['compact', 'comfortable', 'spacious'] as const;
export type UiDensity = (typeof UI_DENSITIES)[number];

export const DATE_FORMATS = ['iso', 'mdy', 'dmy'] as const;
export type DateFormatPreference = (typeof DATE_FORMATS)[number];

export const VOLUME_UNITS = ['liters', 'gallons'] as const;
export type VolumeUnit = (typeof VOLUME_UNITS)[number];

export interface CurrencyOption {
  code: string;
  symbol: string;
  label: string;
  flagKey: 'usa' | 'uganda' | 'uk';
}

export const CURRENCY_OPTIONS: readonly CurrencyOption[] = [
  { code: 'USD', symbol: '$', label: 'US Dollar ($)', flagKey: 'usa' },
  { code: 'UGX', symbol: 'UGX', label: 'Uganda Shilling (UGX)', flagKey: 'uganda' },
  { code: 'GBP', symbol: '£', label: 'British Pound (£)', flagKey: 'uk' },
] as const;

export const SYNC_CONFLICT_STRATEGIES = [
  'last_write_wins',
  'local_priority',
  'cloud_priority',
] as const;
export type SyncConflictStrategy = (typeof SYNC_CONFLICT_STRATEGIES)[number];

export type CloudSyncDirection = 'push' | 'pull' | 'bidirectional' | 'test';
export type CloudSyncStatus = 'success' | 'error' | 'offline';

export interface FarmSettings {
  farmName: string;
  defaultMilkRatePerLiter: number;
  currencySymbol: string;
  fontScale: FontScale;
  uiDensity: UiDensity;
  dateFormat: DateFormatPreference;
  volumeUnit: VolumeUnit;
  defaultSpecies: Species;
  autoRecordMilkSaleByDefault: boolean;
  autoRecordMedicalExpenseByDefault: boolean;
  autoRecordPayrollExpenseByDefault: boolean;
  paymentAlertLeadDays: number;
  alertCheckIntervalSeconds: number;
  enableNotifications: boolean;
  confirmBeforeDelete: boolean;
  mobileIconMode: boolean;
  activeAccountId: string;
  cloudSyncEnabled: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  cloudWorkspaceId: string;
  autoSyncOnInternet: boolean;
  cloudSyncIntervalSeconds: number;
  syncConflictStrategy: SyncConflictStrategy;
  syncIncludeFinancials: boolean;
  syncIncludeHr: boolean;
  networkJoinKey: string;
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

export const WORKER_STATUSES = ['active', 'on_leave', 'inactive'] as const;
export type WorkerStatus = (typeof WORKER_STATUSES)[number];

export const WORKER_PAY_FREQUENCIES = [
  'monthly',
  'biweekly',
  'weekly',
  'daily',
] as const;
export type WorkerPayFrequency = (typeof WORKER_PAY_FREQUENCIES)[number];

export const WORKER_PAYMENT_STATUSES = ['pending', 'paid'] as const;
export type WorkerPaymentStatus = (typeof WORKER_PAYMENT_STATUSES)[number];

export const WORKER_TASK_PRIORITIES = ['low', 'medium', 'high'] as const;
export type WorkerTaskPriority = (typeof WORKER_TASK_PRIORITIES)[number];

export const WORKER_TASK_STATUSES = [
  'pending',
  'in_progress',
  'completed',
] as const;
export type WorkerTaskStatus = (typeof WORKER_TASK_STATUSES)[number];

export interface FarmWorker {
  id: string;
  name: string;
  role: string;
  phone: string | null;
  responsibilities: string | null;
  salaryAmount: number;
  payFrequency: WorkerPayFrequency;
  nextPaymentDueDate: string;
  status: WorkerStatus;
  hireDate: string | null;
  paymentNotifiedForDueDate: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface NewFarmWorkerInput {
  name: string;
  role: string;
  phone?: string | null;
  responsibilities?: string | null;
  salaryAmount: number;
  payFrequency?: WorkerPayFrequency;
  nextPaymentDueDate?: string;
  status?: WorkerStatus;
  hireDate?: string | null;
}

export interface UpdateFarmWorkerInput {
  name?: string;
  role?: string;
  phone?: string | null;
  responsibilities?: string | null;
  salaryAmount?: number;
  payFrequency?: WorkerPayFrequency;
  nextPaymentDueDate?: string;
  status?: WorkerStatus;
  hireDate?: string | null;
}

export interface FarmWorkerFilter {
  status?: WorkerStatus | 'all';
  search?: string;
}

export interface WorkerPayment {
  id: string;
  workerId: string;
  financialLogId: string | null;
  amount: number;
  dueDate: string;
  paidDate: string | null;
  status: WorkerPaymentStatus;
  periodLabel: string | null;
  notes: string | null;
  notifiedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface NewWorkerPaymentInput {
  workerId: string;
  amount: number;
  dueDate: string;
  paidDate?: string | null;
  status?: WorkerPaymentStatus;
  periodLabel?: string | null;
  notes?: string | null;
}

export interface UpdateWorkerPaymentInput {
  workerId?: string;
  amount?: number;
  dueDate?: string;
  paidDate?: string | null;
  status?: WorkerPaymentStatus;
  periodLabel?: string | null;
  notes?: string | null;
}

export interface WorkerPaymentFilter {
  workerId?: string;
  status?: WorkerPaymentStatus | 'all';
  search?: string;
}

export interface WorkerTask {
  id: string;
  workerId: string;
  livestockId: string | null;
  title: string;
  description: string | null;
  priority: WorkerTaskPriority;
  status: WorkerTaskStatus;
  dueDate: string | null;
  completedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface NewWorkerTaskInput {
  workerId: string;
  livestockId?: string | null;
  title: string;
  description?: string | null;
  priority?: WorkerTaskPriority;
  status?: WorkerTaskStatus;
  dueDate?: string | null;
}

export interface UpdateWorkerTaskInput {
  workerId?: string;
  livestockId?: string | null;
  title?: string;
  description?: string | null;
  priority?: WorkerTaskPriority;
  status?: WorkerTaskStatus;
  dueDate?: string | null;
}

export interface WorkerTaskFilter {
  workerId?: string;
  status?: WorkerTaskStatus | 'all';
  priority?: WorkerTaskPriority | 'all';
  search?: string;
}

export const OWNERSHIP_CATEGORIES = [
  'farm_owned',
  'external_boarded',
  'sold_retained',
  'breeding_loan_in',
  'care_quarantine',
  'co_owned',
] as const;
export type OwnershipCategory = (typeof OWNERSHIP_CATEGORIES)[number];

export const OWNERSHIP_STATUSES = [
  'active',
  'returned',
  'picked_up',
  'transferred',
] as const;
export type OwnershipStatus = (typeof OWNERSHIP_STATUSES)[number];

export interface AnimalOwnership {
  id: string;
  livestockId: string;
  ownerName: string;
  ownerContact: string | null;
  accountId: string | null;
  ownershipCategory: OwnershipCategory;
  sharePercentage: number;
  purpose: string | null;
  startDate: string;
  expectedEndDate: string | null;
  boardingFee: number;
  status: OwnershipStatus;
  notes: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface NewAnimalOwnershipInput {
  livestockId: string;
  ownerName: string;
  ownerContact?: string | null;
  accountId?: string | null;
  ownershipCategory?: OwnershipCategory;
  sharePercentage?: number;
  purpose?: string | null;
  startDate?: string;
  expectedEndDate?: string | null;
  boardingFee?: number;
  status?: OwnershipStatus;
  notes?: string | null;
}

export interface UpdateAnimalOwnershipInput {
  livestockId?: string;
  ownerName?: string;
  ownerContact?: string | null;
  accountId?: string | null;
  ownershipCategory?: OwnershipCategory;
  sharePercentage?: number;
  purpose?: string | null;
  startDate?: string;
  expectedEndDate?: string | null;
  boardingFee?: number;
  status?: OwnershipStatus;
  notes?: string | null;
}

export interface AnimalOwnershipFilter {
  livestockId?: string;
  accountId?: string;
  category?: OwnershipCategory | 'all';
  status?: OwnershipStatus | 'all';
  search?: string;
}

export const FARM_ACCOUNT_ROLES = [
  'admin',
  'manager',
  'family_member',
  'external_owner',
  'veterinarian',
  'staff_viewer',
] as const;
export type FarmAccountRole = (typeof FARM_ACCOUNT_ROLES)[number];

export const FARM_ACCOUNT_STATUSES = [
  'active',
  'pending',
  'invited',
  'suspended',
] as const;
export type FarmAccountStatus = (typeof FARM_ACCOUNT_STATUSES)[number];

export const BUILTIN_FARM_ACCOUNT_AVATARS = [
  'farmer',
  'farmerFemale',
  'peasant',
  'staff',
] as const;

export const FARM_ACCOUNT_AVATARS = [...BUILTIN_FARM_ACCOUNT_AVATARS] as const;
export type BuiltinFarmAccountAvatar = (typeof BUILTIN_FARM_ACCOUNT_AVATARS)[number];
export type FarmAccountAvatar = string;

const CUSTOM_AVATAR_SLUG_RE = /^avator_[a-z0-9_]{1,56}$/;

export function formatAvatarSlugFromFilename(filename: string): string {
  const stem = filename.replace(/\.[^.]+$/, '');
  const normalized = stem
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `avator_${normalized || 'custom'}`;
}

export function formatAvatarLabel(avatarKey: string): string {
  switch (avatarKey) {
    case 'farmer':
      return 'Farmer Classic';
    case 'farmerFemale':
      return 'Farmer Female';
    case 'peasant':
      return 'Partner / Owner';
    case 'staff':
      return 'Team Icon';
    default: {
      const cleaned = avatarKey.replace(/^avator_/, '');
      return cleaned
        .split('_')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
    }
  }
}

export function isValidFarmAccountAvatar(value: string): boolean {
  return (
    (BUILTIN_FARM_ACCOUNT_AVATARS as readonly string[]).includes(value) ||
    CUSTOM_AVATAR_SLUG_RE.test(value)
  );
}

export const FARM_MODULE_ACCESS_LEVELS = [
  'none',
  'view',
  'edit',
  'full',
] as const;
export type FarmModuleAccessLevel = (typeof FARM_MODULE_ACCESS_LEVELS)[number];

export const FARM_PERMISSION_MODULES = [
  'livestock',
  'ownerships',
  'family_tree',
  'production',
  'medical',
  'financial',
  'alerts',
  'hr',
  'statistics',
  'backup',
  'settings',
] as const;
export type FarmPermissionModule = (typeof FARM_PERMISSION_MODULES)[number];

export type FarmAccountPermissions = Record<
  FarmPermissionModule,
  FarmModuleAccessLevel
>;

export interface FarmAccount {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  role: FarmAccountRole;
  relationship: string | null;
  avatarKey: FarmAccountAvatar;
  accessCode: string | null;
  supabaseUrl?: string | null;
  supabaseAnonKey?: string | null;
  cloudWorkspaceId?: string | null;
  isPrimaryAdmin: boolean;
  canManageNetwork: boolean;
  canSyncCloud: boolean;
  permissions: FarmAccountPermissions;
  status: FarmAccountStatus;
  onboardingCompleted?: boolean;
  lastSyncedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface NewFarmAccountInput {
  id?: string;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  role?: FarmAccountRole;
  relationship?: string | null;
  avatarKey?: FarmAccountAvatar;
  accessCode?: string | null;
  supabaseUrl?: string | null;
  supabaseAnonKey?: string | null;
  cloudWorkspaceId?: string | null;
  isPrimaryAdmin?: boolean;
  canManageNetwork?: boolean;
  canSyncCloud?: boolean;
  permissions?: Partial<FarmAccountPermissions>;
  status?: FarmAccountStatus;
  onboardingCompleted?: boolean;
}

export interface UpdateFarmAccountInput {
  displayName?: string;
  email?: string | null;
  phone?: string | null;
  role?: FarmAccountRole;
  relationship?: string | null;
  avatarKey?: FarmAccountAvatar;
  accessCode?: string | null;
  supabaseUrl?: string | null;
  supabaseAnonKey?: string | null;
  cloudWorkspaceId?: string | null;
  canManageNetwork?: boolean;
  canSyncCloud?: boolean;
  permissions?: Partial<FarmAccountPermissions>;
  status?: FarmAccountStatus;
  onboardingCompleted?: boolean;
  lastSyncedAt?: number | null;
}

export interface FarmAccountFilter {
  role?: FarmAccountRole | 'all';
  status?: FarmAccountStatus | 'all';
  search?: string;
}

export interface CloudSyncLog {
  id: string;
  direction: CloudSyncDirection;
  status: CloudSyncStatus;
  recordsPushed: number;
  recordsPulled: number;
  summary: string;
  createdAt: number;
}
