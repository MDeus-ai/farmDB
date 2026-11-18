# farmDB (v1.5.0)

Offline-first farm livestock, genetics, milk production, veterinary, HR, ownership custody, financial ledger, and analytics suite for **Desktop (React + Vite + Tauri v2)** and **Mobile (React Native + Expo SDK 58)** — backed locally by **SQLite + Drizzle ORM**, with optional **Supabase** cloud synchronization, image replication, and role-based multi-user Farm Networks.

---

## Key Capabilities

### Herd & Genetics
- **Herd Registry (`livestock`)**: Register cows, bulls, goats, sheep, ducks, and other species with normalized unique ear tags, explicit **Sex (`female` / `male`)** tracking, dedicated **Cow vs. Bull** labels and custom icons (`cow.png` / `bull.png` + `female.png` / `gender.png`), automatic age calculation, and strict input validation.
- **Optimized Photos & Lightbox Viewer**: Uploaded animal images are resized and compressed client-side into lightweight WebP/JPEG data URLs (`~480px`, `~15–35 KB`) so photos persist offline in SQLite and sync cleanly across Supabase Cloud DB and devices. Clicking any photo opens an enlarged lightbox viewer.
- **Family Tree & Bloodline Lineage**:
  - Dual ancestor views: rich **Pedigree Tree** cards and compact **Simplified Graph** mode.
  - **Left-click & drag** canvas panning on Desktop (plus smooth drag/scroll on Mobile), alongside **Progeny & Siblings** and **Bloodline Map** views.
  - Upward/downward 3+ generation tracking, inbreeding overlap warnings, inline quick-preview **Eye** pop-ups, and strict `family_tree` permission enforcement at both UI and database repository levels.
- **Animal Ownerships & Custody (`animal_ownerships`)**: Track farm-owned, co-owned, external boarded, sold awaiting pickup, and breeding-loan animals with share percentages, dates, boarding fees, grouped Owners Directory, and Farm Network partner links.

### Daily Farm Operations & Analytics
- **Milk Production (`product_records`)**: `Animal*` selector filters strictly to **active female milk-producing animals** (males and inactive livestock excluded by both UI and repository validation), automatic **Liters <-> US Gallons** conversion, daily trend charts, top producer rankings, and optional automated **Milk Sale** income posting.
- **Medical History (`medical_records`)**: Track conditions, vaccines, treatments, veterinarians, and costs with optional automated **Medical** ledger expense posting and preventive-care analytics.
- **Financial Ledger (`financial_logs`)**: Income/expense accounting in configurable currencies (`USD $`, `UGX`, `GBP £`, or custom currency), P&L KPIs, net profit margin %, monthly bar charts, and per-animal / per-species profitability attribution.
- **Alerts & Farm Notes (`alerts`)**: Scheduled due-date alerts with configurable background polling and native Desktop (`@tauri-apps/plugin-notification`) + Mobile (`expo-notifications`) alerts alongside non-urgent pinned Farm Notes.
- **Human Resources (`workers`, `worker_payments`, `worker_tasks`)**: Staff directory, weekly/monthly pay cycles, configurable early almost-due payroll warnings, overdue tracking, optional auto-posted **Payroll** expenses, and priority task assignment.
- **Farm Statistics & Livestock Charts**: Interactive KPIs and charts including **Sex (`Female` / `Male`)** and **Cow vs. Bull** filters and cohort ratios, Milk Yield Velocity, Herd Status by Species, Top Producers, Age Demographics Donut, Health Conditions, Breed Distribution, and Species Performance Matrix.

### Accounts, RBAC Privileges & Cloud Sync
- **Account Separation & Auth Flow**:
  - Supports **Farm Owner Admin** accounts and standard **User** accounts with PIN/password verification.
  - Enforces a clean **Sign Out** session boundary before signing into or creating another account; standalone Sign Up creates local accounts while **Join Network** lives inside the Farm Network screen.
  - Strict credential isolation: Administrators manage permissions and can approve, suspend, or remove accounts, but cannot log into connected users' accounts without their credentials.
  - **Change Password / PIN** inside Farm Network for signed-in users.
- **Farm Network & Repository RBAC (`packages/db/src/rbac.ts`)**:
  - **Invite to Network**: Generate shareable short codes (`FARM-XXXX`) or full cloud Invite Keys (`FDB1:...`), with one-click **Rotate Key**.
  - **Join Network**: Connect existing accounts via Join Key with pending approval review.
  - Granular per-module access levels (**Hidden**, **View Only**, **View & Edit**, **Full Access**) enforced at the repository layer (`wrapSessionWithRbac`) across all modules including `family_tree` lineage fields.
- **Settings, Advanced Settings & Sync Logs (`Settings` | `Advanced Settings` | `Sync Logs`)**:
  - **Settings**: Font scaling (`Small` -> `Extra Large`), UI density (`Compact` / `Comfortable` / `Spacious`), Mobile Icon Mode, currency & unit preferences, auto-accounting toggles, alert cadence, and delete confirmations.
  - **Advanced Settings**:
    - **Native SQLite Database Storage & Read-Only Protection**: Inspect active `farmdb.db` location/size, relocate the SQLite storage folder on Desktop, toggle OS read-only lock / SQLite `PRAGMA query_only`, and maintain a verified shadow database copy (`farmdb.verified.db`).
    - **Cloud Sync & Supabase Database (Admin Only)**: Configure Supabase Project URL, Anon/Publishable Key, and Workspace ID, copy the one-time SQL Setup Script, test connectivity with inline near-card feedback, copy full **Admin Cloud Keys (`FDB1:...`)** for cross-device sign-in & recovery, select conflict resolution (`Last Write Wins`, `Local Priority`, `Cloud Priority`), and toggle auto-sync.
    - Admin Supabase credentials persist inside the Admin account and synced snapshots so logging into or recovering an Admin account on another device restores data, settings, and optimized animal photos automatically.
  - **Sync Logs (Admin Only)**: Full audit log of connection tests, pushes, pulls, and bidirectional sync outcomes.
- **Export, Backup & Restore**: Portable RFC-4180 CSV spreadsheet bundles, full JSON snapshots (with optimized images, HR, ownerships, accounts, and settings), and raw single-file `farmdb.db` backup/restore with SQLite header validation and automatic re-migration.
- **In-App Guide & Hover Hints**: Synchronized 14-chapter walkthrough (`packages/core/src/tutorial.ts`) tailored to Admin vs. User accounts, custom Desktop frameless titlebar, and themed green **Farm Hover Hints** (`FarmHoverHintOverlay`).

---

## Monorepo Architecture

```text
farmDB/
├── assets/icons/                 # Central 59-icon PNG library (field.png software icon + UI/species/sex icons)
├── scripts/
│   └── sync-app-icons.ps1        # Generates Tauri (.ico/.icns/Store PNGs) & Expo adaptive icons + mirrors to Mobile
├── packages/
│   ├── core/                     # @farmdb/core: domain types, validation, lineage, analytics, RBAC helpers, export, tutorial
│   │   ├── src/
│   │   └── tests/                # Vitest unit tests (10 files)
│   └── db/                       # @farmdb/db: Drizzle ORM schema, SQLite migrations, repositories, RBAC wrapper, React hooks
│       ├── src/
│       └── tests/                # Vitest + node:sqlite integration tests
└── apps/
    ├── desktop/                  # @farmdb/desktop: React + Vite + Tauri v2 app (Rust SQLite storage protection + native dialogs)
    │   ├── src/
    │   └── src-tauri/
    └── mobile/                   # @farmdb/mobile: React Native + Expo SDK 58 + expo-sqlite + Reanimated/Chart Kit
        └── src/
```

---

## Local & Cloud Storage Architecture

### Local SQLite Database (12 Tables)
Every module stores relational data in `farmdb.db` via Drizzle ORM (`packages/db/src/schema.ts`):
- `livestock` (`id`, `species`, `sex`, `tag_number` UNIQUE, `name`, `breed`, `dob`, `image_uri`, `sire_id`, `dam_id`, `status`, timestamps)
- `product_records` (`livestock_id` FK -> `livestock.id`, `date`, `yield_amount`, `quality_notes`)
- `medical_records` (`livestock_id` FK, `date`, `condition`, `treatment`, `cost`, `veterinarian`)
- `financial_logs` (`livestock_id` nullable FK, `product_record_id` nullable FK, `transaction_type`, `amount`, `date`, `category`, `notes`)
- `alerts` (`livestock_id` nullable FK, `entry_kind`, `title`, `description`, `trigger_date`, `is_resolved`, `notified_at`)
- `workers`, `worker_payments` (`worker_id` FK), `worker_tasks` (`worker_id` FK, `livestock_id` nullable FK)
- `animal_ownerships` (`livestock_id` FK, `owner_account_id`, `owner_name`, `ownership_category`, `share_percentage`, `boarding_fee`, `status`)
- `farm_accounts` (`id`, `display_name`, `email`, `phone`, `role`, `access_code`, `supabase_url`, `supabase_anon_key`, `cloud_workspace_id`, `permissions_json`, `status`, `last_synced_at`)
- `farm_settings` (`key`, `value`, `updated_at`)
- `cloud_sync_logs` (`id`, `direction`, `status`, `records_pushed`, `records_pulled`, `summary`, `created_at`)

On **Windows Desktop (Tauri)**, `farmdb.db` defaults to `%APPDATA%\com.farmdb.desktop\farmdb.db` (or a custom directory saved in `sqlite-storage-config.json`), with a verified shadow copy at `%LOCALAPPDATA%\com.farmdb.desktop\protected\farmdb.verified.db`.

### Supabase Cloud Snapshot Table
Supabase Cloud Sync uses `public.farmdb_cloud_snapshots` (`workspace_id`, `farm_name`, `updated_by_account_id`, `snapshot jsonb`, `updated_at`), storing the full workspace state including settings, accounts, relationships, and compressed animal image data URLs for cross-device sync and Admin cloud recovery. Generate the setup SQL directly inside **Settings -> Advanced Settings -> Cloud Sync & Supabase Database**.

---

## Development & Verification Commands

Run all commands from the monorepo root (`d:\PROJECTS (ROOT)\PROJECTS\SOFTWARE\farmDB`):

```bash
# 1. Install workspace dependencies
npm install

# 2. Run all unit & SQLite integration tests (@farmdb/core + @farmdb/db)
npm test

# 3. Typecheck all 4 workspaces
npm run typecheck

# 4. Run Vite web preview (localStorage fallback at http://localhost:1420)
npm run dev:desktop

# 5. Run Desktop Tauri v2 app with native SQLite + Rust backend
npm run dev:tauri

# 6. Build Desktop frontend production bundle (tsc && vite build)
npm run build:desktop

# 7. Verify Rust Tauri crate compilation
cargo check --manifest-path "apps/desktop/src-tauri/Cargo.toml"

# 8. Start Expo Metro server for Mobile development
npm run dev:mobile

# 9. Sync native icons from central assets/icons/field.png
powershell -ExecutionPolicy Bypass -File scripts/sync-app-icons.ps1 -SourceIcon "assets/icons/field.png"
```

---

## Production Deployment

### 1. Supabase Cloud Setup (Multi-Device Sync)
1. Create a production Supabase project at [supabase.com](https://supabase.com).
2. Open **Supabase SQL Editor** and execute the SQL script shown inside **farmDB -> Settings -> Advanced Settings -> Cloud Sync & Supabase Database** (creates `public.farmdb_cloud_snapshots`, grants `anon`/`authenticated` permissions, enables RLS policy `farmdb_workspace_sync`, and reloads PostgREST schema cache).
3. In farmDB Desktop or Mobile, sign in as Admin, open **Settings -> Advanced Settings**, paste your **Supabase Project URL** and **Anon / Publishable Key**, set your **Cloud Workspace ID**, click **Test Connection**, enable **Cloud Sync**, and run **Two-Way Sync Now**.
4. Copy and safely store your **Full Admin Cloud Key (`FDB1:...`)** for logging into or recovering the workspace on new devices.

### 2. Windows Desktop Installer (`.msi` & `.exe` via Tauri v2)
Prerequisites: Node.js 22+, Rust toolchain (`rustup` / `cargo`), and Visual Studio C++ Build Tools + WebView2 Runtime on Windows.
```bash
npm run test
npm run typecheck
npm run build:tauri
```
Built Windows installers are output under `apps/desktop/src-tauri/target/release/bundle/`:
- NSIS setup executable: `apps/desktop/src-tauri/target/release/bundle/nsis/farmDB_1.5.0_x64-setup.exe`
- MSI installer: `apps/desktop/src-tauri/target/release/bundle/msi/farmDB_1.5.0_x64_en-US.msi`

### 3. Mobile Production Build (Android `.apk` / `.aab` & iOS via Expo EAS)
Prerequisites: Expo account (`npm install -g eas-cli` and `eas login`), and an Android bundle/package ID (`android.package` / `ios.bundleIdentifier`) added to `apps/mobile/app.json` before Play Store / App Store submission.
```bash
# Verify Android JS/Hermes bundle locally
cd apps/mobile
npx expo export --platform android --output-dir .expo-check

# Configure EAS build profiles (creates apps/mobile/eas.json if not present)
eas build:configure

# Build installable Android APK (internal testing) or AAB (Google Play Store)
eas build --platform android --profile preview
eas build --platform android --profile production

# Build iOS IPA (requires Apple Developer account)
eas build --platform ios --profile production
```
