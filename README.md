# farmDB (v1.5.7)

Offline-first farm livestock, genetics, milk production, veterinary, HR, ownership custody, financial ledger, and analytics suite for **Desktop (React + Vite + Tauri v2)** and **Mobile (React Native + Expo SDK 58)** — backed locally by **SQLite + Drizzle ORM**, with optional **Supabase** cloud synchronization, image replication, and role-based multi-user Farm Networks.

---

## Downloads

### Windows Desktop (GitHub Releases)
Signed Windows installers and auto-updater packages are built and published on every `farmDB-v*` release tag:
- **Latest Release Page:** https://github.com/MDeus-ai/farmDB/releases/latest
- **All Releases:** https://github.com/MDeus-ai/farmDB/releases
- **NSIS Setup Installer (`.exe`):** `https://github.com/MDeus-ai/farmDB/releases/latest/download/farmDB_1.5.7_x64-setup.exe`
- **MSI Installer (`.msi`):** `https://github.com/MDeus-ai/farmDB/releases/latest/download/farmDB_1.5.7_x64_en-US.msi`
- **Auto-Updater Manifest (`latest.json`):** https://github.com/MDeus-ai/farmDB/releases/latest/download/latest.json

### Android APK & Over-the-Air (OTA) Updates (Expo EAS)
- **Android APK Builds (Expo EAS Dashboard, Project `a580457d-475d-463e-b3fb-7faaf8b8964b`):** https://expo.dev/projects/farmdb-monorepo/builds  
  *(Open the latest Android `production` or `preview` build on EAS to download the `.apk` or scan its QR install link.)*
- **Automatic OTA Updates (`production` branch):** Once the base `1.5.0` Android APK is installed, new JS/UI releases roll out automatically via Expo Updates (`https://u.expo.dev/a580457d-475d-463e-b3fb-7faaf8b8964b`) or **Settings -> Advanced Settings -> Software Updates**.

---

## Key Capabilities

### Herd & Genetics
- **Herd Registry (`livestock`)**: Register cows, bulls, goats, sheep, ducks, and other species with normalized unique ear tags, explicit **Sex (`female` / `male`)** tracking, dedicated **Cow vs. Bull** labels and head-portrait species icons (`cow.png`, `bull.png`, `goat.png`, `sheep.png`, `duck.png`, `chicken.png`), automatic age calculation, and a clean registry layout without redundant summary stat clutter.
- **Validated Breed Dictionary (`packages/core/src/breeds.ts`)**: Comprehensive, species-specific breed validation covering African breeds (`Ankole-Watusi (Ankole Longhorn)`, `Boran`, `Small East African Zebu`, `Mubende`, `Boer`, `Small East African Goat`, `Dorper`, `Red Maasai`, `Muscovy`, `African Indigenous / Local Duck`, `Kuroiler`, `Kienyeji (Indigenous Village Chicken)`, etc.) alongside international breeds, alias canonicalization, searchable Desktop/Mobile pickers, and legacy update tolerance (`currentBreed`).
- **Duplicate Entry Detection & Prevention**: Automatic repository-level duplicate blocking across Livestock (matching species, sex, name & date of birth), Milk Production, Medical History, Financial Ledger, Alerts & Farm Notes, HR Workers / Payments / Tasks, Animal Ownerships, and Farm Accounts.
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
- **Account Separation & Device-Local Sign-In Isolation**:
  - Zero auto-created default Admin profile: users explicitly create an **Admin Account** (labeled with their customizable **Admin Display Name** + `Admin` badge) or a standard **User Account** with PIN/password verification.
  - Enforces device-local Sign-In isolation (`__local_device_account_ids`): joining a Farm Network never exposes or signs into remote Admin accounts from another device.
  - Self-service **Leave Network** for joined or pending members cleanly reverts a device back to standalone offline mode.
  - **Delete Account** for both Admin and User profiles (inside Farm Network or directly from the Sign-In Portal with confirmation, PIN protection, and automatic Primary Admin promotion), plus **Change Password / PIN**.
- **Dynamic Profile Avatars (`assets/avators/` & `scripts/sync-avators.mjs`)**: Every icon image placed in `assets/avators/` is synced into Mobile assets and dynamically exposed in both Desktop and Mobile profile avatar pickers.
- **Farm Network & Repository RBAC (`packages/db/src/rbac.ts`)**:
  - **Admin Network Join Key**: Copy and share Short Codes (`FARM-XXXX` same device) or Full Cloud Keys (`FDB1:...` across devices), or click **Generate New Key** to revoke old codes with remote pre-validation.
  - **Join Network & Real-Time Approval Flow**: Any signed-in account joins via Key inside Farm Network, automatically notifying Admins (OS toast, top amber **Pending Network Join Request** banner, and live Farm Network count badge) while the requester's Pending Approval view polls every 20 seconds for approval.
  - Granular per-module access levels (**Hidden**, **View Only**, **View & Edit**, **Full Access**) assigned via **Assign Privileges & Accept** and enforced at the repository layer (`wrapSessionWithRbac`) across all modules including `family_tree` lineage fields.
- **Write-Triggered & Close-Flush Cloud Sync**:
  - Local database edits trigger a `2.5s` debounced Supabase sync automatically (tracking mid-sync writes via `writeVersionRef` so queued changes aren't dropped).
  - Desktop flushes pending sync on window close (`onCloseRequested` backed by `core:window:allow-destroy`) and pulls on window focus/visibility; Mobile flushes when backgrounded (`AppState`) and pulls on resume.
  - Top-bar **Refresh** button reloads settings, themes, accounts, cloud data, and records immediately across both apps.
- **Settings, Advanced Settings & Sync Logs (`Settings` | `Advanced Settings` | `Sync Logs`)**:
  - **Settings**: Font scaling (`Small` -> `Extra Large`), UI element size / spacing density (tuned for Mobile Large & Extra-Large readability), **Compact Icon UI** mode, currency & unit preferences, auto-accounting toggles, alert cadence, delete confirmations, plus Android keyboard-aware form scrolling and tappable phone/email links across HR, Ownerships, and Farm Network.
  - **Advanced Settings**:
    - **Native SQLite Database Storage & Read-Only Protection**: Inspect active `farmdb.db` location/size, relocate the SQLite storage folder on Desktop, toggle OS read-only lock / SQLite `PRAGMA query_only`, and maintain a verified shadow database copy (`farmdb.verified.db`).
    - **Cloud Sync & Supabase Database (Admin Only)**: Configure Supabase Project URL, Anon/Publishable Key, and Workspace ID, toggle the collapsible **Show Script / Hide Script** SQL Setup Script, test connectivity with inline near-card feedback, copy full **Admin Cloud Keys (`FDB1:...`)** for cross-device sign-in & recovery, select conflict resolution (`Last Write Wins`, `Local Priority`, `Cloud Priority`), and toggle auto-sync.
    - **Software Updates / App Updates**: Automatic update checks with in-app **Update Available** banners, OS notifications, interactive release-notes modals listing version number and fixes, signed Desktop installs, and Mobile Expo EAS OTA updates.
    - Admin Supabase credentials persist inside the Admin account and synced snapshots so logging into or recovering an Admin account on another device restores data, settings, and optimized animal photos automatically.
  - **Sync Logs (Admin Only)**: Full audit log of connection tests, pushes, pulls, and bidirectional sync outcomes.
- **Desktop & Mobile UI Refinements**:
  - Synchronized 14-chapter in-app App Guide (`packages/core/src/tutorial.ts`).
  - Enlarged Desktop **Add Livestock** modal (`livestock-form-modal`) for Large/Extra-Large text scaling.
  - Desktop **ModernSelect** and **ModernDatePicker** portal directly to `document.body` so menus always open downward without modal clipping, calendars match the trigger width, Desktop dropdowns use crisp **Farm Hover Hints** (`FarmHoverHintOverlay` + `data-farm-hint`) + quick-preview eyes instead of sub-label text clutter, and Mobile dropdowns keep compact inline option captions.
  - Aligned rounded-square tabular-monospace navigation count badges (`JetBrains Mono`, `tabular-nums`, distinct zero/active states) across Desktop sidebar and Mobile drawer.

---

## Monorepo Architecture

```text
farmDB/
├── assets/
│   ├── icons/                    # Shared UI/species PNG icons (unused icons pruned; non-UI open-box.png preserved)
│   └── avators/                  # Drop-in user profile avatar PNG library synced dynamically to Desktop & Mobile
├── scripts/
│   ├── sync-avators.mjs          # Syncs assets/avators -> apps/mobile/assets/avators + avators.generated.ts
│   ├── release-bump.mjs          # Automated version bumper & one-command release helper (version:bump / release:ship)
│   └── sync-app-icons.ps1        # Generates Tauri (.ico/.icns/Store PNGs) & Expo adaptive icons + mirrors to Mobile
├── packages/
│   ├── core/                     # @farmdb/core: domain types, breeds, optionHints, validation, lineage, analytics, RBAC, export, tutorial
│   │   ├── src/
│   │   └── tests/                # Vitest unit tests (12 files, 46 tests)
│   └── db/                       # @farmdb/db: Drizzle ORM schema, SQLite migrations, duplicate-guarded repositories, RBAC, sync worker hooks
│       ├── src/
│       └── tests/                # Vitest + node:sqlite integration tests (14 tests)
└── apps/
    ├── desktop/                  # @farmdb/desktop: React + Vite + Tauri v2 app (Rust SQLite storage protection + custom titlebar + native dialogs)
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

# 2. Sync assets/avators icons into Mobile bundle metadata
npm run sync:avators

# 3. Run all unit & SQLite integration tests (@farmdb/core + @farmdb/db)
npm test

# 4. Typecheck all 4 workspaces
npm run typecheck

# 5. Run Vite web preview (localStorage fallback at http://localhost:1420)
npm run dev:desktop

# 6. Run Desktop Tauri v2 app with native SQLite + Rust backend
npm run dev:tauri

# 7. Build Desktop frontend production bundle (tsc && vite build)
npm run build:desktop

# 8. Verify Rust Tauri crate compilation
cargo check --manifest-path "apps/desktop/src-tauri/Cargo.toml"

# 9. Start Expo Metro server for Mobile development
npm run dev:mobile

# 10. Sync native app icons from central assets/icons/field.png
powershell -ExecutionPolicy Bypass -File scripts/sync-app-icons.ps1 -SourceIcon "assets/icons/field.png"

# 11. Bump app version across all release manifests before committing (or --ship to auto-verify, tag & push)
npm run version:bump -- --notes "Summary of changes"
npm run release:ship -- --message "short summary" --notes "Summary of changes"
```

---

## Production Deployment

### 1. First Launch, Login-First Security & One-Time Setup Wizard
Both Desktop and Mobile strictly launch on the **Sign In / Sign Up** portal before exposing any farm modules or background sync workers. On a new account's first sign-in (`onboardingCompleted === false`), a one-time **First-Time Setup Wizard** opens automatically with plain-English explanations for:
- **Database Storage Location & Read-Only Protection** (Desktop custom SQLite folder relocation / Mobile sandbox path)
- **Font Size**, **UI Element Size (Spacing Density)** & **Compact Icon UI** (with real-time preview on Mobile)
- **Volume Units** (`Liters` / `US Gallons`) & **Currency** (`$`, `UGX`, `£`, or custom)
- **Optional Admin Cloud Setup**: Guided step-by-step Supabase setup (`supabase.com` -> copy/run SQL -> paste Project URL & Anon Key -> inline **Test Connection** -> enable Auto-Sync & copy Admin Cloud Key `FDB1:...`)

### 2. Supabase Cloud Setup (Multi-Device Sync)
1. Create a production Supabase project at [supabase.com](https://supabase.com).
2. Open **Supabase SQL Editor** and execute the SQL script shown inside the First-Time Setup Wizard or **farmDB -> Settings -> Advanced Settings -> Cloud Sync & Supabase Database** (creates `public.farmdb_cloud_snapshots`, grants `anon`/`authenticated` permissions, enables RLS policy `farmdb_workspace_sync`, and reloads PostgREST schema cache).
3. In farmDB Desktop or Mobile, sign in as Admin, open **Settings -> Advanced Settings**, paste your **Supabase Project URL** and **Anon / Publishable Key**, set your **Cloud Workspace ID**, click **Test Connection**, enable **Cloud Sync**, and run **Two-Way Sync Now**.
4. Copy and safely store your **Full Admin Cloud Key (`FDB1:...`)** for logging into or recovering the workspace on new devices.

### 3. Windows Desktop Installer & Auto-Updates (`.msi`, `.exe`, `tauri-plugin-updater`)
Prerequisites: Node.js 22+, Rust toolchain (`rustup` / `cargo`), and Visual Studio C++ Build Tools + WebView2 Runtime on Windows.
```bash
npm run test
npm run typecheck
npm run build:tauri
```
Built Windows installers and signed updater artifacts are output under `apps/desktop/src-tauri/target/release/bundle/`:
- NSIS setup executable: `apps/desktop/src-tauri/target/release/bundle/nsis/farmDB_1.5.7_x64-setup.exe`
- MSI installer: `apps/desktop/src-tauri/target/release/bundle/msi/farmDB_1.5.7_x64_en-US.msi`

Desktop auto-updates are configured via `tauri-plugin-updater` (`apps/desktop/src-tauri/tauri.conf.json`) checking `https://github.com/MDeus-ai/farmDB/releases/latest/download/latest.json`, and can also be triggered manually from **Settings -> Advanced Settings -> Software Updates**.

### 4. Mobile Production Build & OTA Updates (Android `.apk`/`.aab`, iOS & `expo-updates`)
`apps/mobile/app.json` and `apps/mobile/eas.json` are pre-configured for EAS project `a580457d-475d-463e-b3fb-7faaf8b8964b` (`com.zeus_doreens.farmdb` on Android, `com.zeusdoreens.farmdb` on iOS) with `expo-updates` runtime versioning (`appVersion`, keeping `apps/mobile/app.json` `"version": "1.5.0"` for binary compatibility) and channels (`development`, `preview`, `production`).
```bash
# Verify Android JS/Hermes bundle locally
cd apps/mobile
npx expo export --platform android --output-dir .expo-check

# Build installable Android APK (internal testing) or AAB (Google Play Store)
eas build --platform android --profile preview
eas build --platform android --profile production

# Build iOS IPA (requires Apple Developer account)
eas build --platform ios --profile production

# Push an over-the-air (OTA) JS/asset update to family devices without rebuilding the APK/IPA
eas update --branch production --message "Release update"
```

### 5. Automated Version Bump & CI/CD Release Pipeline (`scripts/release-bump.mjs` + `.github/workflows/release.yml`)
Use `npm run version:bump` before committing manually (updates root/workspace package manifests, `Cargo.toml`/`Cargo.lock`, `tauri.conf.json`, `updates.ts`, `README.md`, and `CHANGELOG.md` while keeping `apps/mobile/app.json` at `1.5.0`), or run `npm run release:ship -- --message "<summary>" --notes "<bullet>"` to bump, verify, commit, tag `farmDB-vX.Y.Z`, and push automatically.

Pushing a tag such as `farmDB-v1.5.7` (or `v*`) or triggering `workflow_dispatch` runs unit tests and typechecks, builds & signs Windows Desktop installers (`tauri-apps/tauri-action@v0`) with `latest.json` uploaded to the GitHub Release, and publishes an Expo OTA update (`eas-cli update --branch production`) when secrets are configured:
- **`TAURI_SIGNING_PRIVATE_KEY`** (GitHub Repository Secret — required for signed Desktop updater releases)
- **`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`** (optional — only needed if your signing key uses a passphrase)
- **`EXPO_TOKEN`** (optional GitHub Repository Secret — enables automatic `eas update` OTA pushes from GitHub Actions)
