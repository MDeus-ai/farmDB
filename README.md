# farmDB

Offline-first livestock, milk production, medical, and financial management application for **Desktop (React + Tauri v2)** and **Mobile (React Native + Expo SDK 58)** backed by local **SQLite** and **Drizzle ORM**.

## Monorepo Layout

- `packages/core` (`@farmdb/core`): Shared domain types, tag normalization, input validation (`validateNewLivestock`, `validateUpdateLivestock`), UUID generation, and navigation metadata (`APP_SECTIONS`).
- `packages/db` (`@farmdb/db`): Drizzle ORM SQLite schema (`livestock`, `product_records`, `medical_records`, `financial_logs`, `alerts`), deterministic SQL migrations, cross-platform `SqlDriver` + `sqlite-proxy` adapter, `DatabaseEventBus` + TanStack Query reactive hooks (`FarmDbProvider`, `useLivestockList`, `useFarmSummary`, `useCreateLivestock`, `useUpdateLivestock`, `useDeleteLivestock`), and Node `node:sqlite` integration tests.
- `apps/desktop` (`@farmdb/desktop`): React + Vite + Tauri v2 desktop application using `@tauri-apps/plugin-sql` (`sqlite:farmdb.db`), with a `localStorage` preview fallback when opened directly in a browser outside Tauri.
- `apps/mobile` (`@farmdb/mobile`): Expo SDK 58 React Native application using `expo-sqlite` (`farmdb.db`) and sharing `@farmdb/core` and `@farmdb/db`.

## Core Database Schema

The primary registry uses a generalized `livestock` table (`species` defaults to `'cow'`, with `tag_number` normalized and constrained `UNIQUE`) so goats, sheep, and other species work without schema rewrites:

- `livestock`: `id`, `species`, `tag_number` (unique), `name`, `breed`, `dob`, `image_uri`, `status` (`active` / `sold` / `deceased`), `created_at`, `updated_at`
- `product_records`: `id`, `livestock_id`, `date`, `yield_amount`, `quality_notes`, timestamps
- `medical_records`: `id`, `livestock_id`, `date`, `condition`, `treatment`, `cost`, `veterinarian`, timestamps
- `financial_logs`: `id`, `livestock_id` (nullable), `transaction_type`, `amount`, `date`, `category`, `notes`, timestamps
- `alerts`: `id`, `livestock_id` (nullable), `title`, `description`, `trigger_date`, `is_resolved`, timestamps

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
- **Phase 2**: Local animal image capture/upload (`image_uri` on disk) and dedicated herd dashboard polish.
- **Phase 3**: Daily milk yield logging, automated/manual financial ledger, and charts (`recharts` / mobile charts).
- **Phase 4**: Medical history timeline, notes, and local OS/mobile scheduled alert notifications.
- **Phase 5**: CSV/JSON export and full `.db` file backup/restore.
