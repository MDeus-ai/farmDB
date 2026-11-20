import type {
  AlertEntryKind,
  DateFormatPreference,
  FarmAccountRole,
  FarmAccountStatus,
  FinancialCategory,
  FontScale,
  LivestockStatus,
  OwnershipCategory,
  OwnershipStatus,
  Species,
  SyncConflictStrategy,
  TransactionType,
  UiDensity,
  VolumeUnit,
  WorkerPayFrequency,
  WorkerStatus,
  WorkerTaskPriority,
  WorkerTaskStatus,
} from './types';

export const FONT_SCALE_HINTS: Record<FontScale, string> = {
  small: 'Compact 14px text so more table rows and fields fit on screen.',
  medium: 'Balanced 16px default readability for everyday farm logging.',
  large: 'Bigger 18px labels and values for quick outdoor scanning.',
  xlarge: 'Maximum 20px high-contrast text for effortless legibility.',
};

export const UI_DENSITY_HINTS: Record<UiDensity, string> = {
  compact: 'Tighter spacing and slimmer buttons to fit more cards per view.',
  comfortable: 'Standard padding and touch targets balanced for daily use.',
  spacious: 'Larger buttons and extra breathing room for easier tapping.',
};

export const MOBILE_ICON_MODE_HINT =
  'Replaces button text words with clean icons across headers and bars so screens stay uncluttered.';

export const DATE_FORMAT_HINTS: Record<DateFormatPreference, string> = {
  iso: 'ISO year-first format (e.g. 2026-11-20) — sorts chronologically everywhere.',
  mdy: 'US month-first format (e.g. 11/20/2026) across tables and charts.',
  dmy: 'Day-first format (e.g. 20/11/2026) widely used in East Africa & the UK.',
};

export const VOLUME_UNIT_HINTS: Record<VolumeUnit, string> = {
  liters: 'Records and displays milk yields in metric Liters (L) with per-liter pricing.',
  gallons: 'Converts milk yields into US Gallons (gal ≈ 3.785 L) while keeping SQLite exact.',
};

export const SPECIES_HINTS: Record<Species, string> = {
  cow: 'Pre-selects Cattle (Cow / Bull) with dairy & beef breeds in Add Livestock.',
  goat: 'Pre-selects Goats (Boer, Mubende, Galla, Saanen, etc.) in Add Livestock.',
  sheep: 'Pre-selects Sheep (Dorper, Red Maasai, Fat-Tailed, etc.) in Add Livestock.',
  duck: 'Pre-selects Ducks (Muscovy, Pekin, Khaki Campbell, etc.) in Add Livestock.',
  other: 'Pre-selects Poultry, Pigs, Rabbits & other homestead animals in Add Livestock.',
};

export const SYNC_CONFLICT_HINTS: Record<SyncConflictStrategy, string> = {
  last_write_wins: 'Recommended: Keeps whichever device saved the newest change timestamp.',
  local_priority: 'Prefers edits stored in this device SQLite database when records conflict.',
  cloud_priority: 'Prefers Supabase cloud snapshot values when two devices edited offline.',
};

export const LIVESTOCK_STATUS_HINTS: Record<LivestockStatus, string> = {
  active: 'Currently on farm and counted in active herd KPIs and milk logging.',
  sold: 'Transferred or sold off farm; hidden from active milk selection.',
  deceased: 'Historical mortality record kept for lineage and analytics accuracy.',
};

export const ACCOUNT_ROLE_HINTS: Record<FarmAccountRole, string> = {
  admin: 'Primary administrator with full database, account approval, and cloud sync control.',
  manager: 'Day-to-day farm manager with full record access and supervised financial/HR edits.',
  family_member: 'Trusted homestead member with herd/milk edit rights and read access elsewhere.',
  external_owner: 'Partner, co-owner, or agister restricted to view-only custody visibility.',
  veterinarian: 'Animal health specialist with full medical entry rights and herd view access.',
  staff_viewer: 'Farm hand who can log milk yields and read herd/task schedules safely.',
};

export const ACCOUNT_STATUS_HINTS: Record<FarmAccountStatus, string> = {
  active: 'Signed-in access granted according to assigned module privileges.',
  pending: 'Waiting on Farm Admin approval and privilege assignment before sign-in.',
  invited: 'Pre-created profile awaiting first sign-in or device connection.',
  suspended: 'Temporarily blocked from signing into this farm account.',
};

export const OWNERSHIP_CATEGORY_HINTS: Record<OwnershipCategory, string> = {
  farm_owned: '100% owned directly by this farm operation.',
  external_boarded: 'Owned by another person/farm and kept here for care or grazing.',
  sold_retained: 'Sold to a buyer who has not yet picked up the animal.',
  breeding_loan_in: 'Temporarily hosted sire/dam brought onto the farm for breeding.',
  care_quarantine: 'Held temporarily for veterinary isolation or recovery.',
  co_owned: 'Shared ownership split by percentage between partners.',
};

export const OWNERSHIP_STATUS_HINTS: Record<OwnershipStatus, string> = {
  active: 'Custody arrangement is currently in force on the farm.',
  returned: 'Animal has returned to its external owner.',
  picked_up: 'Sold or boarded animal has been collected by the owner/buyer.',
  transferred: 'Ownership title has officially moved to a new owner.',
};

export const TRANSACTION_TYPE_HINTS: Record<TransactionType, string> = {
  income: 'Money earned by the farm (milk sales, livestock sales, or other revenue).',
  expense: 'Money spent by the farm (feed, veterinary bills, payroll, or equipment).',
};

export const FINANCIAL_CATEGORY_HINTS: Record<FinancialCategory, string> = {
  milk_sale: 'Revenue from raw or processed milk sales.',
  livestock_sale: 'Proceeds from selling animals or breeding stock.',
  feed: 'Fodder, silage, hay, concentrates, minerals, or water costs.',
  meds: 'Medicines, dewormers, acaricides, vaccines, and treatment supplies.',
  veterinary: 'Vet consultation visits, surgery, or lab diagnosis fees.',
  payroll: 'Worker salaries, casual labor wages, and staff allowances.',
  equipment: 'Milking gear, fencing, housing repairs, tools, and machinery.',
  other: 'Miscellaneous farm revenue or operating costs.',
};

export const WORKER_PAY_FREQUENCY_HINTS: Record<WorkerPayFrequency, string> = {
  monthly: 'Next salary due date advances by 1 calendar month after each payout.',
  biweekly: 'Next salary due date advances by 14 days (every two weeks).',
  weekly: 'Next salary due date advances by 7 days each week.',
  daily: 'Next wage due date advances day-by-day for casual workers.',
};

export const WORKER_STATUS_HINTS: Record<WorkerStatus, string> = {
  active: 'Currently working on farm; receives payroll reminders and task assignments.',
  on_leave: 'Temporarily away on leave; retained in staff directory.',
  inactive: 'No longer working on farm; kept for historical payroll records.',
};

export const WORKER_TASK_PRIORITY_HINTS: Record<WorkerTaskPriority, string> = {
  low: 'Routine chore that can wait behind urgent livestock work.',
  medium: 'Standard daily or scheduled farm task.',
  high: 'Urgent health, calving, feeding, or security task.',
};

export const WORKER_TASK_STATUS_HINTS: Record<WorkerTaskStatus, string> = {
  pending: 'Assigned and waiting to be started.',
  in_progress: 'Actively being carried out by the assigned worker.',
  completed: 'Finished and recorded with a completion timestamp.',
};

export const ALERT_KIND_HINTS: Record<AlertEntryKind, string> = {
  alert: 'Scheduled due-date reminder that sends desktop/phone notifications when due.',
  note: 'Pinned non-urgent homestead observation stored without due notifications.',
};
