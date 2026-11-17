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
      'farmDB keeps your whole livestock farm organized in one place. Every record saves directly onto your phone or computer first using SQLite, so it works even with zero internet connection.',
    cardsAndFeatures: [
      {
        name: 'Navigation Menu (Sidebar / Hamburger Drawer)',
        explanation:
          'On Desktop, use the dark-green sidebar on the left to switch pages. On Mobile, use the 5 everyday buttons on the bottom pill or tap the ☰ menu button at the top-left for every page, Settings, and Login.',
      },
      {
        name: 'Live Record Counters',
        explanation:
          'Small numbers beside menu items show how many active animals, milk entries, medical visits, financial logs, or open alerts you currently have.',
      },
      {
        name: 'Account Card & Login / Sign Up',
        explanation:
          'At the bottom of the menu, see who is signed in (Admin Account or User Account), switch accounts, create a new user, or connect to another farm using a Join Key.',
      },
    ],
    howToSteps: [
      'Pick any module from the left sidebar (Desktop) or bottom bar / ☰ drawer (Mobile).',
      'New farms can click "Load Sample" buttons on Livestock, Ownerships, Family Tree, or HR to practice with demo cows and data.',
      'Re-open this walkthrough anytime from the App Guide button in the menu or inside Settings.',
    ],
    proTip:
      'Your screens stay clean and free of clutter — anytime you forget what a card or button does, open App Guide.',
  },
  {
    id: 'livestock',
    stepNumber: 2,
    title: 'Herd Registry (Your Livestock List)',
    category: 'Herd & Genetics',
    targetSection: 'livestock',
    summary:
      'This is your digital farm notebook for every animal on the farm — cows, goats, sheep, ducks, and other livestock.',
    cardsAndFeatures: [
      {
        name: 'Summary Cards (Active Herd, Cows, Total, Sold / Deceased)',
        explanation:
          'Shows live counts of how many animals are currently on the farm versus already sold or deceased.',
      },
      {
        name: 'Search & Filters (Status, Species, Sort)',
        explanation:
          'Quickly find any animal by typing its ear tag, name, or breed, or narrow the list to one species or active-only animals.',
      },
      {
        name: 'Add Livestock Button & Form',
        explanation:
          'Creates a new animal profile with Tag Number (must be unique), Species icon, Name, Breed, Date of Birth (used to compute age automatically), Status, and an optional photo.',
      },
      {
        name: 'Animal Card / Row & Profile Pop-up',
        explanation:
          'Click or tap any animal to open its full Animal Profile — update its status quickly, attach a Sire/Dam, see its milk & medical history, or jump straight to its Family Tree.',
      },
    ],
    howToSteps: [
      'Tap + Add Livestock (or + Add) and enter at least a Species and unique Tag Number (like COW-402).',
      'Optionally add Name, Breed, Date of Birth, and take or pick a photo.',
      'Tap any saved animal later to update its status to Sold or Deceased, or inspect all of its farm records.',
    ],
    proTip:
      'Add accurate Dates of Birth when registering calves so Farm Statistics can automatically group your herd by age.',
  },
  {
    id: 'ownerships',
    stepNumber: 3,
    title: 'Animal Ownerships & Custody',
    category: 'Herd & Genetics',
    targetSection: 'ownerships',
    summary:
      'Use Ownerships whenever an animal physically on your farm belongs completely or partly to someone else — such as boarded cattle, sold cows waiting for pickup, or bulls brought in temporarily for breeding.',
    cardsAndFeatures: [
      {
        name: 'Custody Summary Cards',
        explanation:
          'Shows active non-farm animals, sold animals still awaiting buyer pickup, breeding/quarantine guests, and total care/boarding fees.',
      },
      {
        name: 'All Records vs. Owners Directory Tabs',
        explanation:
          'View individual animal custody agreements or group animals by owner name and contact info.',
      },
      {
        name: 'Ownership Form Fields',
        explanation:
          'Choose the animal, enter Owner Name & Contact, pick Category (Farm Owned, Co-Owned, Boarded / External, Sold Awaiting Pickup, Breeding Loan), Share %, Start/Pickup Dates, and optional Boarding Fee.',
      },
      {
        name: 'Linked Farm Network Account',
        explanation:
          'Optional field letting Admins connect an ownership record directly to a partner’s Farm Network account.',
      },
    ],
    howToSteps: [
      'Click Add Ownership Record and select the animal staying on your farm.',
      'Enter the external owner’s name, choose why the animal is on the farm (e.g. Sold Retained or Breeding Loan), and save.',
      'Change status to Returned or Picked Up once the animal leaves the farm.',
    ],
    proTip:
      'Animals with an active external ownership automatically display a colored owner tag in your Herd Registry list so staff never confuse them with farm-owned stock.',
  },
  {
    id: 'family_tree',
    stepNumber: 4,
    title: 'Family Tree & Lineage',
    category: 'Herd & Genetics',
    targetSection: 'family_tree',
    summary:
      'Trace parents, grandparents, siblings, and calves visually so you know which bull bred which cow and avoid accidental inbreeding.',
    cardsAndFeatures: [
      {
        name: 'Lineage KPIs (In Family Lines, Parent Bonds, Depth, Dynasties)',
        explanation:
          'Measures how many animals have parent records linked, the deepest tracked generation, and distinct family bloodline groups.',
      },
      {
        name: 'Species Filter & Focal Animal Selector',
        explanation:
          'Pick any animal to make it the center of attention; click any parent or calf node on the tree to smoothly refocus around that animal.',
      },
      {
        name: 'Tree Views (Pedigree, Progeny & Siblings, Bloodline Map)',
        explanation:
          'Switch between upward ancestors, downward calves/siblings, or an interactive herd-wide bloodline relationship map.',
      },
      {
        name: 'Link Parents & Calves Editor',
        explanation:
          'Assign or change an animal’s Sire (father) and Dam (mother) at any time — including checking genetic overlap before breeding.',
      },
    ],
    howToSteps: [
      'Pick a Focal Animal from the dropdown at the top.',
      'Click Link Parents & Calves if no Sire or Dam is set yet and choose the parents.',
      'Tap any box on the pedigree chart to follow its ancestors or inspect its offspring.',
    ],
    proTip:
      'When registering a newborn calf, set its Sire and Dam right inside the Add Livestock popup to build your Family Tree automatically.',
  },
  {
    id: 'production',
    stepNumber: 5,
    title: 'Milk Production',
    category: 'Daily Records',
    targetSection: 'production',
    summary:
      'Record daily milk yields per animal and optionally post matching milk sale income straight to your Financial Ledger in one step.',
    cardsAndFeatures: [
      {
        name: 'Yield Summary Cards (Today, 7/14-Day Total, Average, Top Producer)',
        explanation:
          'Tracks how much milk the herd produced today, total recent volume, average per milking entry, and which tag is leading.',
      },
      {
        name: 'Daily Yield Entry Form',
        explanation:
          'Select the milking animal, date, yield volume (in Liters or US Gallons based on Settings), and quality notes. On Mobile, tap "Log Daily Milk Yield" at the top to open this form.',
      },
      {
        name: 'Auto-Record Milk Sale Toggle & Rate',
        explanation:
          'When switched on, farmDB multiplies the yield by your milk price per liter/gallon and automatically creates a Milk Sale income log in Financial Ledger.',
      },
      {
        name: 'Production Trend Chart & Top Producers Card',
        explanation:
          'Visualizes daily herd output over time and ranks your highest-producing animals so you can spot sudden drops early.',
      },
    ],
    howToSteps: [
      'Choose the cow or goat, set the date, and type the yield amount.',
      'Leave Auto-Record Milk Sale enabled if you sell the milk at your standard price, or turn it off for household/calf-fed milk.',
      'Save — both the milk log and chart update right away.',
    ],
    proTip:
      'Changing between Liters and US Gallons in Settings automatically converts every saved milk volume cleanly across charts and totals.',
  },
  {
    id: 'medical',
    stepNumber: 6,
    title: 'Medical History',
    category: 'Daily Records',
    targetSection: 'medical',
    summary:
      'Keep a lifetime health record for every animal — vaccinations, illnesses, deworming, treatments, veterinarian visits, and medical costs.',
    cardsAndFeatures: [
      {
        name: 'Health KPIs (Entries, Total Spend, Treated Animals, Latest Checkup)',
        explanation:
          'Shows how many treatments have been recorded, total money spent on care, and how many animals needed attention.',
      },
      {
        name: 'Log Medical Record Form',
        explanation:
          'Pick the animal, treatment date, cost, condition/diagnosis (e.g. Annual Vaccine or Hoof Trim), medication given, and optional veterinarian name. On Mobile, tap "Log Medical Treatment" to open it.',
      },
      {
        name: 'Auto-Record Cost Toggle',
        explanation:
          'Automatically records treatment costs greater than 0 as a Veterinary/Medical expense in Financial Ledger so books stay accurate without double typing.',
      },
      {
        name: 'Medical Timeline & Filters',
        explanation:
          'Chronological log searchable by animal, condition, medication, or veterinarian.',
      },
    ],
    howToSteps: [
      'Select the animal and date, then fill in Condition and Treatment.',
      'Enter what the treatment cost (or 0 for routine free checks) and leave Auto-Record Cost on to log the expense.',
      'Use Search or the Animal dropdown on the Timeline to review past vaccines before breeding or selling.',
    ],
    proTip:
      'Using clear words like "Vaccine" or "Booster" in Condition or Treatment helps Farm Statistics calculate your Preventive Care Coverage % accurately.',
  },
  {
    id: 'financial',
    stepNumber: 7,
    title: 'Financial Ledger',
    category: 'Daily Records',
    targetSection: 'financial',
    summary:
      'Track every dollar, shilling, or pound coming in and going out of the farm — combining manual expenses with auto-recorded milk sales and medical/payroll costs.',
    cardsAndFeatures: [
      {
        name: 'Profit Summary Cards (Income, Expenses, Net Profit, Margin %)',
        explanation:
          'Compares total farm revenue against expenses to show real net profit and percentage margin.',
      },
      {
        name: 'Monthly Income vs. Expenses / Profit Snapshot Chart',
        explanation:
          'Side-by-side chart comparing monthly revenue and spending (swipe horizontally on Mobile when viewing several months).',
      },
      {
        name: 'Standard Milk Rate & Currency Card',
        explanation:
          'Quick shortcut to set your default milk sale rate per liter and currency symbol ($, UGX, £, or custom currency).',
      },
      {
        name: 'Add Transaction Form & Ledger Table',
        explanation:
          'Record feed, equipment, livestock sales, vet bills, or custom income, filterable by Income vs. Expenses and linked animal.',
      },
    ],
    howToSteps: [
      'Tap Add Transaction (or Record Income / Expense) to log feed, livestock sales, or equipment purchases.',
      'Pick Income or Expense, choose a Category, enter Amount and Date, and optionally link a specific animal.',
      'Check the Profit Margin card and chart anytime to see whether the farm is operating profitably.',
    ],
    proTip:
      'Linking an expense or sale directly to a specific animal lets Farm Statistics calculate profitability per species automatically.',
  },
  {
    id: 'alerts',
    stepNumber: 8,
    title: 'Alerts & Farm Notes',
    category: 'Daily Records',
    targetSection: 'alerts',
    summary:
      'Never miss a vaccination date, buyer pickup, or barn maintenance task — and keep quick everyday notes right next to scheduled reminders.',
    cardsAndFeatures: [
      {
        name: 'Alert Counters (Due/Overdue, Open Alerts, Active Notes, Resolved)',
        explanation:
          'Shows how many scheduled reminders need attention today or are overdue.',
      },
      {
        name: 'Scheduled Alert vs. Farm Note Toggle',
        explanation:
          'Scheduled Alerts have a due Trigger Date and trigger desktop/mobile notification banners; Farm Notes stay pinned as a simple checklist.',
      },
      {
        name: 'Check Due Alerts Button',
        explanation:
          'Manually scans all open alerts immediately (background checks also run automatically on the interval set in Settings).',
      },
      {
        name: 'Alert Cards & Mark Done',
        explanation:
          'Link any alert to an animal (or leave as General Farm), search open items, and tap Resolve/Done once completed.',
      },
    ],
    howToSteps: [
      'Tap New Alert / Note (on Mobile) or use the form on Desktop and pick Scheduled Alert or Note.',
      'Type a clear title, choose the due Trigger Date, optionally pick an animal, and save.',
      'When a reminder banner pops up on the due date, complete the chore and click Resolve.',
    ],
    proTip:
      'Keep important barn reminders under Notes so your Due Alerts badge only lights up for truly time-sensitive tasks.',
  },
  {
    id: 'hr',
    stepNumber: 9,
    title: 'Human Resources (Staff, Payroll & Tasks)',
    category: 'Analytics & Team',
    targetSection: 'hr',
    summary:
      'Manage everyone who works on your farm — track monthly/weekly pay schedules, get early almost-due payday warnings, and assign daily tasks.',
    cardsAndFeatures: [
      {
        name: 'HR Summary Cards & Early Due Banners',
        explanation:
          'Shows active staff count, estimated monthly wage bill, overdue or almost-due salary payments, and open tasks.',
      },
      {
        name: 'Three Tabs: Staff Directory, Salary Ledger, Allocated Tasks',
        explanation:
          'Switch between worker profiles & pay rates, pending/paid salary records, and assigned barn/field chores.',
      },
      {
        name: 'Record Payment & Mark Paid',
        explanation:
          'Schedule upcoming wages or click Mark Paid when you pay a worker — automatically optionally logging Payroll in Financial Ledger.',
      },
      {
        name: 'Task Priority & Status Tracking',
        explanation:
          'Assign High/Medium/Low priority tasks to a worker and optionally attach them to a specific animal.',
      },
    ],
    howToSteps: [
      'Add each farm worker with their Role, Phone, Salary Amount, and Pay Schedule.',
      'Use Record Payment to track upcoming or completed wage payouts.',
      'Open Tasks to assign chores like milking equipment checks or calf feeding and mark them Completed.',
    ],
    proTip:
      'Adjust "Payroll Alert Lead Days" in Settings if you want warnings 5 or 7 days before salaries come due.',
  },
  {
    id: 'statistics',
    stepNumber: 10,
    title: 'Farm Statistics & Livestock Charts',
    category: 'Analytics & Team',
    targetSection: 'statistics',
    summary:
      'Turns all of your saved Herd, Milk, Medical, Ownership, and Financial data into live visual charts and species performance reports.',
    cardsAndFeatures: [
      {
        name: 'Species Filter & 7D / 14D / 30D Toggle',
        explanation:
          'Inspect charts across the entire farm or isolate a single species like Cows or Goats over your chosen timeframe.',
      },
      {
        name: '6 Analytics KPI Cards',
        explanation:
          'Summarizes Active Herd %, Cumulative Milk Output, Preventive Care Coverage %, Medical Spend, Average Herd Age, and Net Profit.',
      },
      {
        name: 'Interactive Charts',
        explanation:
          'Includes Milk Yield Velocity, Herd Status by Species (Active/Sold/Deceased), Top Producers, Age Demographics Donut, Health Conditions, and Breed Distribution.',
      },
      {
        name: 'Species Performance Summary / Matrix',
        explanation:
          'Compares every species side by side by headcount, active share, milk yield, veterinary cost, and linked financial P&L.',
      },
    ],
    howToSteps: [
      'Select "All Species" for a full farm overview or pick one species (like Cow) from the top dropdown.',
      'Toggle 7D, 14D, or 30D to zoom in or out on milk production trends.',
      'On Mobile, swipe left and right across wide line/bar charts to read every date and label comfortably.',
    ],
    proTip:
      'Whenever a chart says "No records yet", log entries in Herd, Production, or Medical — every chart updates automatically in real time.',
  },
  {
    id: 'accounts_auth',
    stepNumber: 11,
    title: 'Accounts, Sign-Up & Join Keys',
    category: 'Accounts & System',
    targetSection: null,
    summary:
      'farmDB supports two clear account types: full Farm Owner Admin Accounts (network & cloud controllers) and simpler User Accounts (local farm tracking or invited network members).',
    cardsAndFeatures: [
      {
        name: 'Admin Account vs. User Account',
        explanation:
          'Admin Accounts unlock Farm Network, Join Key generation, Cloud Sync settings, and full local features. User Accounts work offline on local SQLite with Export & Backup enabled cleanly without network complexity.',
      },
      {
        name: 'Sign In & Account Switcher',
        explanation:
          'Pick any account on this device and enter its passcode PIN (if one was set) to switch profiles.',
      },
      {
        name: 'Sign Up (Local User or Join an Admin)',
        explanation:
          'Leave Join Key blank to create an independent local User Account, OR paste an Admin’s Join Key (FARM-XXXX or FDB1:...) to request shared access to their farm database.',
      },
      {
        name: 'Pending Approval Screen',
        explanation:
          'Accounts that join via key wait safely in Pending state until the Farm Owner Admin reviews their permissions and accepts them.',
      },
    ],
    howToSteps: [
      'Open Login / Sign Up from the bottom of the menu anytime.',
      'To create a standalone farm profile on this device, choose Sign Up -> User Account and leave Join Key empty.',
      'To connect to another farmer’s Admin database, paste their Join Key on Sign Up or Enter Join Key, then tap Check Approval once accepted.',
    ],
    proTip:
      'Set a 4+ digit Switch PIN when creating an Admin account so staff or guests using the same device cannot accidentally change Admin permissions.',
  },
  {
    id: 'network',
    stepNumber: 12,
    title: 'Farm Network & Privileges (Admin Only)',
    category: 'Accounts & System',
    targetSection: 'network',
    adminOnly: true,
    summary:
      'Admins use Farm Network to invite family members, external animal owners, managers, and vets — and decide exactly which modules each person can see or edit.',
    cardsAndFeatures: [
      {
        name: 'Network Join Key Card (Short Key & Invite Key)',
        explanation:
          'Displays your shareable FARM-XXXX code and full cloud invite key; click Rotate Key anytime to invalidate old codes.',
      },
      {
        name: 'Pending Join Requests Panel',
        explanation:
          'Lists people who entered your Join Key and are waiting. Assign their access permissions and click Accept to let them into the farm.',
      },
      {
        name: 'Account Module Permissions',
        explanation:
          'Control every module individually per person: Hidden (no access), View Only, View & Edit, or Full Admin.',
      },
    ],
    howToSteps: [
      'Configure Supabase Cloud Sync in Settings first if connecting multiple devices over the internet.',
      'Share your Network Join Key from Farm Network with a family member or partner.',
      'When they appear in Pending Requests, set their module privileges (for example, Vet = Full Medical, Financial = Hidden) and click Accept.',
    ],
    proTip:
      'External animal owners can be given View Only access to Livestock and Ownerships while keeping Financial Ledger and Human Resources Hidden.',
  },
  {
    id: 'backup',
    stepNumber: 13,
    title: 'Export, Backup & Restore',
    category: 'Accounts & System',
    targetSection: 'backup',
    summary:
      'Protect your farm history forever — both Admin Accounts and User Accounts can export spreadsheets, portable farm snapshots, and raw SQLite database files.',
    cardsAndFeatures: [
      {
        name: 'Export Full JSON & Restore from JSON',
        explanation:
          'Saves every animal, milk record, medical log, finance entry, HR item, ownership, and setting into one portable JSON file you can restore on another PC or phone.',
      },
      {
        name: 'CSV Spreadsheet Downloads',
        explanation:
          'Export individual tables (Livestock, Milk Production, Medical, Financial, Alerts) into Excel-friendly CSV spreadsheets.',
      },
      {
        name: 'SQLite Database File (.db) Backup & Restore',
        explanation:
          'Copies or replaces your exact physical local farmdb.db database file cleanly.',
      },
    ],
    howToSteps: [
      'Click Export Full JSON regularly and save a copy to a USB drive, cloud folder, or share sheet.',
      'On a new computer or phone, open Export & Backup -> Restore from JSON and pick that file to bring all farm records across.',
      'Use CSV buttons anytime you want to open tables in Excel or print reports.',
    ],
    proTip:
      'JSON snapshots work seamlessly between Windows Desktop and Android/iOS Mobile so you can move your farm data between devices offline!',
  },
  {
    id: 'settings',
    stepNumber: 14,
    title: 'Settings, Display & Cloud Sync',
    category: 'Accounts & System',
    targetSection: 'settings',
    summary:
      'Personalize readability, units, currencies, notifications, and (for Admin Accounts) automatic Supabase internet database synchronization.',
    cardsAndFeatures: [
      {
        name: 'Display & Accessibility',
        explanation:
          'Resize all text cleanly (Small to Extra Large), adjust button spacing/density, and toggle compact Mobile Icon Mode.',
      },
      {
        name: 'Units, Currency & Defaults',
        explanation:
          'Pick Liters or US Gallons, choose date display format (ISO / MDY / DMY), pick your currency, and turn auto-accounting defaults on or off.',
      },
      {
        name: 'Cloud Sync & Supabase (Admin Only)',
        explanation:
          'Paste your Supabase Project URL and Anon/Publishable Key, copy the one-time SQL Setup Script, pick conflict rules, and enable automatic background internet sync.',
      },
      {
        name: 'Sync Logs Tab (Admin Only)',
        explanation:
          'Review every push, pull, or connection test timestamp and error message cleanly inside Settings.',
      },
    ],
    howToSteps: [
      'Pick your preferred Font Size, Currency, and Liters vs. Gallons in Settings.',
      'If using cloud sharing as an Admin, run the SQL Setup Script in Supabase, paste URL + Key, click Test Connection, then turn on Auto-Sync.',
      'Check Sync Logs in the top Settings tab anytime to confirm when your last cloud sync completed.',
    ],
    proTip:
      'Settings is the only screen where field hints stay visible permanently — while the rest of the app stays clean and distraction-free.',
  },
] as const;

export function getTutorialStepsForAccount(
  account: FarmAccount | null | undefined
): TutorialStep[] {
  const isAdmin = isAdminAccount(account);
  return FARMDB_TUTORIAL_STEPS.filter((step) => !step.adminOnly || isAdmin);
}
