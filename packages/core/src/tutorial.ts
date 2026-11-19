import type { AppSectionId } from './navigation';
import { isAdminAccount } from './network';
import type { FarmAccount } from './types';

export interface TutorialFeatureExplanation {
  name: string;
  explanation: string;
}

export interface TutorialStep {
  id: string;
  stepNumber: number;
  title: string;
  category:
    | 'Getting Started'
    | 'Herd & Genetics'
    | 'Daily Records'
    | 'Analytics & Team'
    | 'Accounts & System';
  targetSection: AppSectionId | null;
  adminOnly?: boolean;
  summary: string;
  cardsAndFeatures: readonly TutorialFeatureExplanation[];
  howToSteps: readonly string[];
  proTip: string;
}

export const FARMDB_TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    id: 'welcome',
    stepNumber: 1,
    title: 'Welcome to farmDB & App Layout',
    category: 'Getting Started',
    targetSection: 'livestock',
    summary:
      'farmDB keeps your entire livestock operation organized in one offline-first SQLite database on Desktop and Mobile, with optional Admin-controlled Supabase cloud synchronization and automatic update alerts.',
    cardsAndFeatures: [
      {
        name: 'Navigation Menu, Custom Desktop Titlebar & Compact Icon UI',
        explanation:
          'On Desktop, use the dark-green sidebar to switch modules and the top titlebar for quick Cloud Sync status, Alert shortcuts, Settings, Account, and custom window controls. On Mobile, toggle Compact Icon UI in Setup or Settings to switch between the floating bottom icon dock or labeled menu via the top-left ☰ drawer, with Android keyboard-aware scrolling keeping lower form fields visible above the keyboard.',
      },
      {
        name: 'Live Record Counters, Pending Join Banner & Update Alerts',
        explanation:
          'Badges beside menu items show current counts for active animals, milk entries, medical records, finances, staff, open alerts, and Admin pending Farm Network join requests. When a team member requests access or a new farmDB release is ready, clear amber Pending Network Join Request or Update Available banners appear at the top.',
      },
      {
        name: 'Farm Hover Hints (Desktop)',
        explanation:
          'Hover over toolbar icons, tree controls, preview buttons, or actions to see a themed farmDB hint pop-up explaining what that control does.',
      },
      {
        name: 'Account Card & Sign Out',
        explanation:
          'Displays the currently signed-in Admin or User profile at the bottom of the menu (with your Farm Name and Admin tag for Administrators). Click Sign Out whenever you need to exit your active session before signing into, registering, or deleting another account.',
      },
    ],
    howToSteps: [
      'Pick any module from the left sidebar (Desktop) or bottom bar / ☰ drawer (Mobile).',
      'Start in Herd Registry to register your livestock, then track Family Tree lineage, female Milk Production, Medical treatments, Ownerships, HR, and Financial Ledger.',
      'Re-open this walkthrough anytime from the App Guide button in the menu or inside Settings.',
    ],
    proTip:
      'While signed in, you must click Sign Out before logging into another account — keeping every person’s workspace session isolated just like standard desktop and mobile software.',
  },
  {
    id: 'livestock',
    stepNumber: 2,
    title: 'Herd Registry (Your Livestock List)',
    category: 'Herd & Genetics',
    targetSection: 'livestock',
    summary:
      'Your digital herd register for cows, bulls, goats, sheep, ducks, and other livestock — tracking Sex, Cow vs. Bull labels, validated ear tags, birth dates, lineage links, and cloud-ready optimized photos.',
    cardsAndFeatures: [
      {
        name: 'Summary Cards (Active Herd, Cows/Bulls, Total, Sold / Deceased)',
        explanation:
          'Displays live counts across active animals, cattle breakdown, total registered head, and sold or deceased stock.',
      },
      {
        name: 'Sex (Female / Male) & Cow vs. Bull Icons',
        explanation:
          'Every animal records Sex explicitly with dedicated gender icons and automatic Cow vs. Bull distinction and icons across filters, cards, tables, and charts.',
      },
      {
        name: 'Add / Edit Livestock Form & Validation',
        explanation:
          'Validates unique normalized Tag Numbers, realistic non-future birth dates, species, sex, breed, status, and optional Sire/Dam (when your account has Family Tree edit permissions).',
      },
      {
        name: 'Optimized Animal Photos & Enlarged Lightbox Viewer',
        explanation:
          'Uploaded livestock photos are automatically compressed into lightweight ~480px WebP/JPEG images (~15-35 KB) so they store offline AND sync across Supabase Cloud DB. Click any photo to open it in the enlarged Image Viewer window.',
      },
    ],
    howToSteps: [
      'Click + Add Livestock (or + Add) and select Species, Sex (Female or Male), unique Tag Number (such as COW-402 or BULL-101), Name, Breed, and Date of Birth.',
      'Attach a photo if desired — farmDB optimizes it automatically for fast offline viewing and cloud sync.',
      'Click any animal row/card (or the Eye quick-preview icon) to inspect details, enlarge its photo, change status, or jump directly to its Family Tree.',
    ],
    proTip:
      'Always set accurate Sex and Date of Birth when registering livestock — only female animals appear in Milk Production dropdowns, and Farm Statistics uses birth dates and sex to build cohort analytics.',
  },
  {
    id: 'ownerships',
    stepNumber: 3,
    title: 'Animal Ownerships & Custody',
    category: 'Herd & Genetics',
    targetSection: 'ownerships',
    summary:
      'Track custody whenever an animal on the farm is shared, boarded, on temporary breeding loan, or already sold and awaiting buyer pickup.',
    cardsAndFeatures: [
      {
        name: 'Custody Summary Cards',
        explanation:
          'Summarizes active external/shared animals, sold livestock awaiting buyer pickup, breeding/quarantine guests, and total care or boarding fees.',
      },
      {
        name: 'Custody Records vs. Owners Directory Tabs',
        explanation:
          'Switch between individual custody agreements and a grouped directory organized by each external owner or partner. Saved phone numbers and email addresses work as clickable contact links on Mobile to dial or email owners directly.',
      },
      {
        name: 'Ownership Form & Date Validation',
        explanation:
          'Choose the animal, enter Owner Name & Contact, pick Category (Farm Owned, Co-Owned, Boarded / External, Sold Awaiting Pickup, Breeding Loan), Share %, valid Start/Expected End Dates, and optional Boarding Fee.',
      },
      {
        name: 'Linked Farm Network Account',
        explanation:
          'Optional field allowing Admins to link a custody record directly to a partner’s Farm Network account.',
      },
    ],
    howToSteps: [
      'Click Record Ownership (or Add Ownership Record) and select the animal staying on your farm.',
      'Enter the external owner details, custody category, share percentage, dates, and optional boarding fee, then save.',
      'Update status to Returned or Picked Up once the animal leaves your custody.',
    ],
    proTip:
      'Animals with active non-farm custody display an owner badge directly inside Herd Registry, and on Mobile you can tap any owner phone number or email link right from Ownerships to call or email the buyer or partner.',
  },
  {
    id: 'family_tree',
    stepNumber: 4,
    title: 'Family Tree & Lineage',
    category: 'Herd & Genetics',
    targetSection: 'family_tree',
    summary:
      'Trace up to three+ generations of ancestors, siblings, and calves in both Pedigree Tree and Simplified Graph views with inbreeding checks and role-based edit protection.',
    cardsAndFeatures: [
      {
        name: 'Pedigree Tree & Simplified Graph Views',
        explanation:
          'Toggle cleanly inside Pedigree Tree between rich Pedigree cards and the compact Simplified Graph bloodline diagram, plus Progeny & Siblings and Bloodline Map sub-tabs.',
      },
      {
        name: 'Click-and-Drag Tree Panning',
        explanation:
          'On Desktop, left-click and move the mouse directly on the Pedigree Tree or Simplified Graph canvas to pan/scroll across ancestors cleanly (or swipe/drag on Mobile).',
      },
      {
        name: 'Sex & Cow/Bull Distinction + Quick Eye Preview',
        explanation:
          'Every node shows clear Cow/Bull/species and sex indicators, plus a quick-view Eye button to inspect full animal metrics without losing your place in the tree.',
      },
      {
        name: 'Strict Privilege Enforcement (family_tree RBAC)',
        explanation:
          'Only accounts granted View & Edit or Full Access to Family Tree can link/unlink a Sire (bull/father), Dam (cow/mother), or newborn calves — blocked cleanly at both the UI and database repository layers for read-only accounts.',
      },
    ],
    howToSteps: [
      'Filter by Species (or Cow / Bull) and select a Focal Animal from the dropdown.',
      'Switch between Pedigree Tree and Simplified Graph to inspect parents and grandparents; left-click and drag to pan comfortably.',
      'If your account has Family Tree edit privileges, open Link Parents & Calves to connect a valid Sire and Dam and check genetic overlap before breeding.',
    ],
    proTip:
      'Read-only family members or staff can still browse every ancestor and open the Eye quick preview card safely without any risk of altering breeding lines.',
  },
  {
    id: 'production',
    stepNumber: 5,
    title: 'Milk Production',
    category: 'Daily Records',
    targetSection: 'production',
    summary:
      'Log daily milk yields for active female milk-producing animals and automatically post matching milk sale revenue into Financial Ledger.',
    cardsAndFeatures: [
      {
        name: 'Milk-Producing Female Animal Filter',
        explanation:
          'The Animal* selector automatically filters to active female milk-producing animals only — bulls, other males, and sold/deceased animals are excluded from milking entry selection and validated at save time.',
      },
      {
        name: 'Yield Summary Cards (Today, Recent Total, Average, Top Producer)',
        explanation:
          'Tracks daily farm output, multi-day total, average per milking entry, and top-producing animal tag.',
      },
      {
        name: 'Auto-Record Milk Sale Toggle & Standard Rate',
        explanation:
          'When enabled, farmDB multiplies saved yield by your configured price per liter/gallon and posts a linked Milk Sale income record automatically.',
      },
      {
        name: 'Production Trend Chart & Top Producers',
        explanation:
          'Visualizes daily herd output in Liters or US Gallons and ranks your highest-producing females so unexpected drops stand out right away.',
      },
    ],
    howToSteps: [
      'Choose a female milking animal under Animal*, confirm the date, and enter a positive yield volume.',
      'Leave Auto-Record Milk Sale enabled for sold milk, or switch it off for household or calf-fed milk.',
      'Save — yield totals, charts, and linked financial income (if enabled) update immediately.',
    ],
    proTip:
      'If an animal does not appear in the Animal* dropdown under Milk Production, check Herd Registry to verify its Sex is set to Female and its Status is Active.',
  },
  {
    id: 'medical',
    stepNumber: 6,
    title: 'Medical History',
    category: 'Daily Records',
    targetSection: 'medical',
    summary:
      'Maintain a complete veterinary record for every animal — vaccinations, diagnoses, medications, vet visits, and optional automated expense posting.',
    cardsAndFeatures: [
      {
        name: 'Health KPIs (Entries, Total Spend, Treated Animals, Latest Checkup)',
        explanation:
          'Shows cumulative treatment count, veterinary spend, number of treated animals, and latest visit date.',
      },
      {
        name: 'Log Medical Record Form & Validation',
        explanation:
          'Select the animal, valid treatment date, non-negative cost, diagnosis/condition, medication/treatment given, and optional veterinarian name.',
      },
      {
        name: 'Auto-Record Cost Toggle',
        explanation:
          'Automatically posts treatment costs above 0 as a Medical expense in Financial Ledger so accounting stays accurate without double entry.',
      },
      {
        name: 'Searchable Medical Timeline',
        explanation:
          'Review chronological care logs filtered by animal, condition, medication, or veterinarian.',
      },
    ],
    howToSteps: [
      'Select an animal, enter the treatment date, Condition, and Treatment details.',
      'Enter the treatment cost (or 0 for routine checks) and leave Auto-Record Cost active to log the ledger expense.',
      'Use timeline filters anytime to check vaccine history before breeding, buying, or selling.',
    ],
    proTip:
      'Include keywords like "Vaccine", "Booster", or "Deworming" in Condition or Treatment so Farm Statistics computes Preventive Care Coverage % accurately.',
  },
  {
    id: 'financial',
    stepNumber: 7,
    title: 'Financial Ledger',
    category: 'Daily Records',
    targetSection: 'financial',
    summary:
      'Track all farm income and expenses in your local currency — combining manual entries with automated milk sales and medical/payroll costs.',
    cardsAndFeatures: [
      {
        name: 'Profit Summary Cards (Income, Expenses, Net Profit, Margin %)',
        explanation:
          'Compares total farm revenue against spending to display real net profit and percentage margin.',
      },
      {
        name: 'Monthly Income vs. Expenses Chart',
        explanation:
          'Side-by-side monthly bar comparison showing revenue versus operating expenses.',
      },
      {
        name: 'Standard Milk Rate & Currency Card',
        explanation:
          'Shortcut to view/adjust your active milk pricing and currency symbol ($, UGX, £, or custom currency).',
      },
      {
        name: 'Add Transaction Form & Filtered Ledger',
        explanation:
          'Log feed, equipment, livestock sales, or custom entries with date/amount validation and optional animal attribution.',
      },
    ],
    howToSteps: [
      'Click Add Transaction (or Record Income / Expense) to log farm purchases or sales.',
      'Pick Income or Expense, choose a Category, enter a positive Amount and Date, and optionally tag an animal.',
      'Use filters to audit specific categories or inspect per-animal/per-species profitability.',
    ],
    proTip:
      'Linking livestock sales, feed costs, or vet bills to specific animals feeds directly into the Species Performance Matrix in Farm Statistics.',
  },
  {
    id: 'alerts',
    stepNumber: 8,
    title: 'Alerts & Farm Notes',
    category: 'Daily Records',
    targetSection: 'alerts',
    summary:
      'Track scheduled due-date reminders for vaccinations, checkups, and buyer pickups alongside pinned non-urgent farm notes.',
    cardsAndFeatures: [
      {
        name: 'Alert Counters (Due/Overdue, Open Alerts, Active Notes, Resolved)',
        explanation:
          'Highlights overdue or due-today tasks versus routine checklist notes.',
      },
      {
        name: 'Scheduled Alert vs. Farm Note Toggle',
        explanation:
          'Scheduled Alerts carry a Trigger Date and fire native Desktop/Mobile notifications when due; Notes stay neatly listed without firing urgent badges.',
      },
      {
        name: 'Check Due Alerts Button & Background Worker',
        explanation:
          'Scans open alerts immediately on click or automatically in the background at your configured Settings interval.',
      },
      {
        name: 'Animal Link & One-Click Resolve',
        explanation:
          'Attach an alert to a specific animal or keep it farm-wide, and resolve completed items cleanly.',
      },
    ],
    howToSteps: [
      'Choose Scheduled Alert or Farm Note, enter a title, optional description, and Trigger Date (for alerts).',
      'Optionally attach an animal so the reminder links back to that tag.',
      'Click Resolve / Mark Done once completed to clear the active alert count.',
    ],
    proTip:
      'Keep general barn checklists as Farm Notes so your notification badge highlights only date-critical tasks.',
  },
  {
    id: 'hr',
    stepNumber: 9,
    title: 'Human Resources (Staff, Payroll & Tasks)',
    category: 'Analytics & Team',
    targetSection: 'hr',
    summary:
      'Organize farm workers, recurring weekly/monthly pay schedules, early almost-due payroll alerts, and animal/farm task assignments.',
    cardsAndFeatures: [
      {
        name: 'HR Summary Cards & Payroll Due Banners',
        explanation:
          'Shows active workers, estimated monthly payroll commitment, upcoming/overdue salary alerts, and open task count.',
      },
      {
        name: 'Three Tabs: Staff Directory, Salary Ledger, Allocated Tasks',
        explanation:
          'Manage worker profiles and pay frequencies, track pending vs. paid wage disbursements, and assign prioritized daily chores. On Mobile, worker phone numbers and email links open your dialer or email app directly, and Android forms automatically scroll lower fields above the on-screen keyboard.',
      },
      {
        name: 'Record Payment & Mark Paid',
        explanation:
          'Create scheduled wage payments or mark wages Paid — automatically optionally logging a matching Payroll expense in Financial Ledger.',
      },
      {
        name: 'Task Priority & Animal Links',
        explanation:
          'Assign High, Medium, or Low priority tasks to staff and optionally link them to a specific animal.',
      },
    ],
    howToSteps: [
      'Add workers with Role, Phone, Email, Salary Amount, Pay Frequency (monthly/weekly/etc.), and next due date.',
      'Use Salary Ledger to generate or confirm wage payments and mark them Paid.',
      'Create tasks under Allocated Tasks and update progress from Pending to Completed.',
    ],
    proTip:
      'Set "Payment Alert Lead Days" in Settings to be notified ahead of upcoming paydays before wages become overdue, and tap any worker phone or email link on Mobile to contact staff in one tap.',
  },
  {
    id: 'statistics',
    stepNumber: 10,
    title: 'Farm Statistics & Livestock Charts',
    category: 'Analytics & Team',
    targetSection: 'statistics',
    summary:
      'Transforms live Herd, Sex, Milk, Medical, Financial, and Ownership records into interactive charts, cohort ratios, and species performance tables.',
    cardsAndFeatures: [
      {
        name: 'Species & Sex Filters (Cow / Bull / Female / Male) + 7D / 14D / 30D Window',
        explanation:
          'Inspect analytics across the full farm, filter specifically to Cow or Bull or Female/Male cohorts, and zoom charts across 7, 14, or 30 days.',
      },
      {
        name: 'Herd KPIs with Female/Male & Cow/Bull Breakdown',
        explanation:
          'Summarizes Active Herd %, Cumulative Milk & average per active milking female, Preventive Care Coverage %, Medical Spend, Average Herd Age, Net Profit, plus exact Female/Male and Cow/Bull badges.',
      },
      {
        name: 'Interactive Analytics Charts',
        explanation:
          'Displays Milk Yield Velocity, Herd Status by Species, Top Producers (with Cow/Bull and Sex icons), Age Demographics Donut, Health Conditions, Breed Distribution, and Sex Cohort Breakdown.',
      },
      {
        name: 'Species Performance Matrix',
        explanation:
          'Compares every species side by side by headcount, active share, cumulative milk output, vet spend, and animal-linked revenue vs. expenses.',
      },
    ],
    howToSteps: [
      'Pick a Species/Sex filter at the top (such as All Species, Cow, Bull, or Goat) and choose 7D, 14D, or 30D.',
      'Inspect the Top KPIs and Sex Breakdown cards to monitor female milking productivity versus male herd ratios.',
      'Scroll through charts (swipe horizontally on Mobile charts when dense) and review Species Performance Matrix.',
    ],
    proTip:
      'Every chart updates live from your SQLite database — filtering to "Cow" shows female dairy cattle metrics while "Bull" isolates breeding bulls.',
  },
  {
    id: 'accounts_auth',
    stepNumber: 11,
    title: 'Accounts, Sign-Up, Join Flow & Deletion',
    category: 'Accounts & System',
    targetSection: null,
    summary:
      'farmDB never auto-creates a hidden Administrator account — you choose whether to register an Admin Account (labeled with your chosen Farm Name + Admin tag) or a User Account, delete accounts anytime with PIN safety, and keep sessions strictly isolated.',
    cardsAndFeatures: [
      {
        name: 'User-Chosen Sign Up (No Auto-Seeded Admin Account)',
        explanation:
          'Both Desktop and Mobile open cleanly with zero default Admin profile created behind your back. During Sign Up, explicitly choose whether to create an Admin Account (displayed as your chosen Farm Name with an Admin badge) or a standalone User Account. Connecting a User account to an Admin’s farm happens inside Farm Network via Join Network.',
      },
      {
        name: 'Strict Login-First Launch & Live First-Time Setup Wizard',
        explanation:
          'farmDB strictly launches on the Sign In / Sign Up portal so no farm records appear before authentication. On a new account’s first sign-in, First-Time Setup walks through SQLite protection, Volume Units, Currency, and real-time Font Size, UI Element Size, and Mobile Compact Icon UI previews before opening your dashboard.',
      },
      {
        name: 'Joining via Key & Automatic Approval Check (Every 20 Seconds)',
        explanation:
          'Sign into your created User or Admin account, open Farm Network -> Join Network, and paste an Admin’s Short Code (FARM-XXXX) or Full Cloud Key (FDB1:...). Your device verifies the key first, notifies the Admin, and automatically polls for approval every 20 seconds on the Pending Administrator Approval screen (or anytime via Check Approval).',
      },
      {
        name: 'Delete Account & Strict Sign Out Flow',
        explanation:
          'Click Sign Out before switching accounts on a shared device. You can safely use Delete Account for either an Admin or User account right inside Farm Network or directly from the Sign-In Portal (with confirmation and PIN verification for protected accounts) without erasing farm records — if other Admins exist, Primary Admin promotes automatically.',
      },
      {
        name: 'Admin Cloud Recovery & Credential Isolation',
        explanation:
          'Admin accounts store their linked Supabase URL, Anon/Publishable Key, and Workspace ID so Cloud Recovery on another laptop or phone restores records, settings, and optimized animal photos automatically. Admins manage permissions without seeing or entering another member’s Password / PIN.',
      },
    ],
    howToSteps: [
      'Use Sign Up to create only the Admin (custom Farm Name + Admin tag) or User accounts you want on this device.',
      'To join an Admin’s farm as a User, create/sign into your User account, open Farm Network -> Join Network, paste the FARM-XXXX or FDB1:... key, and wait cleanly while farmDB checks every 20 seconds for Admin approval.',
      'Use Sign Out when switching users, Delete Account (in Farm Network or on the Sign-In Portal) to remove unwanted Admin or User profiles, and Change Password / PIN inside Farm Network anytime.',
    ],
    proTip:
      'Save your Admin Full Cloud Key (FDB1:...) from Advanced Settings -> Cloud Sync in a password manager so restoring onto a new laptop or phone takes one paste.',
  },
  {
    id: 'network',
    stepNumber: 12,
    title: 'Farm Network & Privileges (Admin Only)',
    category: 'Accounts & System',
    targetSection: 'network',
    adminOnly: true,
    summary:
      'Admins control shared farm collaboration from Farm Network — sharing Join Keys (FARM-XXXX or FDB1:...), receiving live notifications when someone requests to join, assigning per-module RBAC privileges, and removing inactive accounts.',
    cardsAndFeatures: [
      {
        name: 'Admin Network Join Key (Short FARM-XXXX Code & Full FDB1:... Cloud Key)',
        explanation:
          'Copy and share your Short Code (FARM-XXXX on the same device) or Full Cloud Key (FDB1:... across devices via Supabase Cloud DB) directly from Farm Network. Click Generate New Key anytime to revoke old codes immediately — farmDB validates keys against the Admin’s live cloud state before letting a new device sync.',
      },
      {
        name: 'Join Notifications, Pending Network Join Request Banner & RBAC',
        explanation:
          'When a user pastes your key inside Join Network, Admins receive an instant OS notification, a top amber Pending Network Join Request banner, and a live count badge on Farm Network. Click Assign Privileges & Accept to choose module-by-module access (Hidden, View Only, View & Edit, or Full Access), use Quick Accept, or Decline to clear the request locally and in Supabase.',
      },
      {
        name: 'Join Network (In-Account Connection)',
        explanation:
          'Any signed-in User or Admin account connects to a shared network exclusively via Farm Network -> Join Network (with automatic 20-second pending approval polling once submitted).',
      },
      {
        name: 'Member Contact Links, Change Password / PIN & Delete Account',
        explanation:
          'Tap member phone numbers or emails on Mobile to call or email teammates directly, let each user change their own Password / PIN, and use Delete Account cleanly on any Admin or User profile without affecting farm livestock or ledger records.',
      },
    ],
    howToSteps: [
      'Configure Cloud Sync & Supabase Database under Settings -> Advanced Settings if sharing across separate phones or PCs.',
      'Copy your Short Code (FARM-XXXX) or Full Cloud Key (FDB1:...) from Farm Network and share it with your family member, vet, or manager.',
      'Have them sign into their farmDB account, open Farm Network -> Join Network, and paste the key; click Assign Privileges & Accept from your notification or Pending Network Join Request banner when their request arrives.',
    ],
    proTip:
      'External animal owners or vets can be restricted to View Only or Hidden on Financial Ledger and HR while keeping Medical or Ownerships editable as needed.',
  },
  {
    id: 'backup',
    stepNumber: 13,
    title: 'Export, Backup & Restore',
    category: 'Accounts & System',
    targetSection: 'backup',
    summary:
      'Protect your production farm ledger with offline spreadsheet exports, portable full JSON snapshots (including optimized livestock images), and physical SQLite .db backups.',
    cardsAndFeatures: [
      {
        name: 'Full JSON Snapshot Export & Restore',
        explanation:
          'Packages all animals, optimized photos, lineage, milk logs, medical history, financial ledger, alerts, HR payroll/tasks, ownerships, accounts, and settings into one portable JSON file.',
      },
      {
        name: 'CSV Spreadsheet Bundles',
        explanation:
          'Exports clean RFC-4180 CSV spreadsheets (livestock, production, medical, financial, alerts, HR, ownerships) ready for Excel or accounting audits.',
      },
      {
        name: 'Native SQLite Database (.db) Backup & Restore',
        explanation:
          'Exports a verified copy of your physical farmdb.db file or restores a validated SQLite .db backup safely (running pending schema migrations automatically).',
      },
    ],
    howToSteps: [
      'Click Export Full JSON periodically and keep a backup copy on an external drive or safe cloud folder.',
      'Use Export CSVs anytime you want spreadsheet analysis or printable accounting reports.',
      'To migrate offline between devices, transfer your JSON snapshot or .db file and import it from Export & Backup.',
    ],
    proTip:
      'Full JSON snapshots work seamlessly between Windows Desktop and Android/iOS Mobile, carrying optimized animal photos across offline.',
  },
  {
    id: 'settings',
    stepNumber: 14,
    title: 'Settings, Advanced Settings & Sync Logs',
    category: 'Accounts & System',
    targetSection: 'settings',
    summary:
      'Organized into three clean tabs — Settings (Display, Compact Icon UI, Units, Defaults), Advanced Settings (Native SQLite Storage & Read-Only Protection, Cloud Sync & Supabase, and Software/App Updates), and Sync Logs.',
    cardsAndFeatures: [
      {
        name: 'Settings Tab (Display, Compact Icon UI, Units & Automation)',
        explanation:
          'Configure Font Size (Small to Extra Large), UI Element Size / Spacing Density (tuned cleanly on Mobile even in Large & Extra-Large modes), Compact Icon UI, Liters vs. US Gallons, Date Format, Currency ($ / UGX / £ / custom), Milk Rate, Auto-Ledger flags, and Confirm Before Delete.',
      },
      {
        name: 'Advanced Settings: Native SQLite Database Storage & Read-Only Protection',
        explanation:
          'Inspect the active farmdb.db path and file size, move native SQLite storage to a custom folder (Desktop), and enforce Read-Only File Protection (OS read-only lock + PRAGMA query_only + verified shadow backup) to block external tampering.',
      },
      {
        name: 'Advanced Settings: Cloud Sync & Supabase Database (Admin Only)',
        explanation:
          'Enter your Supabase Project URL, Anon/Publishable Key, and Workspace ID; expand or collapse the one-time SQL Setup Script with Show Script / Hide Script; test connection with instant inline feedback beside the card; pick conflict strategy (Last Write Wins / Local Priority / Cloud Priority); and toggle auto-sync.',
      },
      {
        name: 'Advanced Settings: Software Updates, App Updates & What\'s New Alerts',
        explanation:
          'Automatically checks for new releases after sign-in and surfaces in-app Update Available banners and OS toast notifications showing the version number and full list of fixes inside an interactive Update Available / What\'s New modal. Install signed Desktop updates (GitHub Releases) or Mobile Expo EAS OTA updates without reinstalling an APK — banners clear automatically as soon as the latest version is active.',
      },
      {
        name: 'Sync Logs Tab (Admin Only)',
        explanation:
          'Audit every Push, Pull, Two-Way Sync, and Connection Test timestamp, transferred record count, and status message cleanly.',
      },
    ],
    howToSteps: [
      'Adjust Font Size, UI Element Size, Compact Icon UI, Currency, and Liters vs. Gallons in the Settings tab (or preview them live in First-Time Setup on Mobile).',
      'Open Advanced Settings to verify Native SQLite Read-Only Protection is enabled and, for Admins, configure Supabase URL + Key and toggle Show Script to copy/run the SQL Setup Script in Supabase.',
      'Click Check for Updates or What\'s New in Software Updates / App Updates anytime, and review Cloud Sync -> Sync Logs after Two-Way Sync.',
    ],
    proTip:
      'Test Connection feedback appears directly inside the Cloud Sync & Supabase Database card, and clicking any Update Available banner opens the exact version number and list of fixes before you install.',
  },
] as const;

export function getTutorialStepsForAccount(
  account: FarmAccount | null | undefined
): TutorialStep[] {
  const isAdmin = isAdminAccount(account);
  return FARMDB_TUTORIAL_STEPS.filter((step) => !step.adminOnly || isAdmin);
}
