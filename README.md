# farmDB

Offline-first livestock, milk production, medical, and financial management application for **Desktop (React + Tauri v2)** and **Mobile (React Native + Expo SDK 58)** backed by local **SQLite** and **Drizzle ORM**.

## Monorepo Layout

- `assets/icons`: Central library of all 46 custom UI PNG icons shared across Desktop and Mobile, with `barn.png` configured as the primary software/app icon (swap any PNG here and re-run `scripts/sync-app-icons.ps1` to regenerate native Tauri & Expo app icons).
- `packages/core` (`@farmdb/core`): Shared domain types, currency presets (`USD`, `UGX`, `GBP` + custom symbol formatting), tag normalization, input validation (`validateNewLivestock`, `validateUpdateLivestock`), UUID generation, and navigation metadata (`APP_SECTIONS`).
- `packages/db` (`@farmdb/db`): Drizzle ORM SQLite schema (`livestock`, `product_records`, `medical_records`, `financial_logs`, `alerts`), deterministic SQL migrations, cross-platform `SqlDriver` + `sqlite-proxy` adapter, `DatabaseEventBus` + TanStack Query reactive hooks (`FarmDbProvider`, `useLivestockList`, `useFarmSummary`, `useCreateLivestock`, `useUpdateLivestock`, `useDeleteLivestock`), and Node `node:sqlite` integration tests.
- `apps/desktop` (`@farmdb/desktop`): React + Vite + Tauri v2 desktop application using `@tauri-apps/plugin-sql` (`sqlite:farmdb.db`), offline `Plus Jakarta Sans` + `JetBrains Mono` typography, custom accessible `ModernSelect` dropdowns, and a `localStorage` preview fallback when opened directly in a browser outside Tauri.
- `apps/mobile` (`@farmdb/mobile`): Expo SDK 58 React Native application using `expo-sqlite` (`farmdb.db`), offline bundled `Plus Jakarta Sans` + `JetBrains Mono` fonts, custom bottom-sheet `ModernDropdown` pickers, and sharing `@farmdb/core` and `@farmdb/db`.

## Core Database Schema

The primary registry uses a generalized `livestock` table (`species` defaults to `'cow'`, with `tag_number` normalized and constrained `UNIQUE`) so goats, sheep, and other species work without schema rewrites:

- `livestock`: `id`, `species`, `tag_number` (unique), `name`, `breed`, `dob`, `image_uri`, `status` (`active` / `sold` / `deceased`), `created_at`, `updated_at`
- `product_records`: `id`, `livestock_id`, `date`, `yield_amount`, `quality_notes`, timestamps
- `medical_records`: `id`, `livestock_id`, `date`, `condition`, `treatment`, `cost`, `veterinarian`, timestamps
- `farm_settings`: `key`, `value`, `updated_at` (stores configurable `farmName`, UI scaling/density `fontScale` / `uiDensity`, `dateFormat`, `volumeUnit`, `defaultSpecies`, `defaultMilkRatePerLiter`, `currencySymbol`, automation flags, notification controls, and `confirmBeforeDelete`)
- `financial_logs`: `id`, `livestock_id` (nullable), `product_record_id` (nullable link for auto-generated milk sales), `transaction_type`, `amount`, `date`, `category`, `notes`, timestamps
- `alerts`: `id`, `livestock_id` (nullable), `entry_kind` (`alert` / `note`), `title`, `description`, `trigger_date`, `is_resolved`, `notified_at`, timestamps

## Commands

```bash
# Install dependencies (from monorepo root)
npm install

# Run unit and SQLite integration tests
npm test

# Typecheck all workspaces
npm run typecheck

# Run React + Vite frontend preview (browser preview mode)
npm run dev:desktop

# Run full Tauri v2 desktop app (native SQLite)
npm run dev:tauri

# Build desktop frontend bundle
npm run build:desktop

# Start Expo dev server for mobile
npm run dev:mobile
```

## Implementation Phases

- **Phase 1 (Complete)**: Monorepo setup, Expo SDK 58 mobile app, React + Tauri v2 desktop app, SQLite schema + migrations + Drizzle reactive query layer, navigation, livestock list/search/filter, and add/edit livestock forms.
- **Phase 2 (Complete)**: Local animal image capture (`expo-image-picker` + `expo-file-system`) and desktop file import (`tauri-plugin-dialog` + Tauri asset protocol into `$APPLOCALDATA/images`), animal profile detail modals with age calculation and quick status actions, table/grid views, and safe local photo cleanup.
- **Phase 3 (Complete)**: Daily milk yield logging per animal (`product_records`), automated `milk_sale` income creation at configurable standard rate (`farm_settings`), manual income/expense ledger (`financial_logs`), and Recharts / React Native Chart Kit analytics dashboards.
- **Phase 4 (Complete)**: Per-animal and herd medical history timeline (`medical_records` with optional auto-expense logging), farm & animal notes (`alerts` with `entry_kind`), background 60s due-alert checker with deduplication (`notified_at`), and native desktop (`@tauri-apps/plugin-notification`) + mobile (`expo-notifications`) alerts.
- **Phase 5 (Complete)**: Portable RFC-4180 CSV & full JSON snapshot export/restore across Desktop and Mobile, plus single-file `farmdb.db` SQLite backup & restore with header validation and automatic re-migration.
- **Settings & Responsive UI Polish (Complete)**: Unified local **Settings** view on Desktop and Mobile with live `fontScale` and `uiDensity` sizing controls, offline `Plus Jakarta Sans` + `JetBrains Mono` font pairing, `USD ($)` / `UGX` / `GBP (£)` (plus custom currency) selectors with country flag icons, `dateFormat`, `volumeUnit` (`L` / `gal`), `defaultSpecies`, auto-ledger defaults, alert check cadence/mute controls, delete confirmation protection, custom modern dropdowns (`ModernSelect` on Desktop, `ModernDropdown` on Mobile), centralized `assets/icons/` PNG icon pack (`barn.png` software icon), adaptive mobile layouts using `react-native-safe-area-context`, plus Mobile-first `mobileIconMode` default (with toggle back to word labels) and a floating frosted capsule bottom navbar.
