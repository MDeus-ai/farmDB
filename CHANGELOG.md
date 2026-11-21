<!--
  Keep release headings in `## [X.Y.Z] - YYYY-MM-DD` format (e.g. `## [1.5.1] - 2026-11-25`).
  `.github/workflows/release.yml` automatically extracts the matching section from this file
  into GitHub Releases, Desktop `latest.json` updater notes, and Mobile Update Available modals.
-->

# farmDB Changelog

## [1.5.8] - 2026-11-21

attach Android APK to GitHub Releases

### Fixes & Improvements
- Automatically attach farmDB-android.apk to GitHub Releases from Expo EAS

## [1.5.7] - 2026-11-21

Fixed Desktop window close button by granting core:window:allow-destroy and streamlining onCloseRequested sync flush.

### Fixes & Improvements
- Fixed Desktop window close button by granting core:window:allow-destroy and streamlining onCloseRequested sync flush.
- Added automated scripts/release-bump.mjs (npm run version:bump and npm run release:ship) to bump versions and trigger CI releases.

## [1.5.6] - 2026-11-20

Redesigned sidebar and drawer navigation count badges with aligned tabular monospace chips alongside the Desktop dropdown/calendar polish.

### Fixes & Improvements
- **Aligned Sidebar & Drawer Count Badges**: Replaced variable-width pill counters with uniform rounded-square tabular-monospace chips (`JetBrains Mono`, fixed minimum width, dedicated zero/active states) so Desktop sidebar and Mobile drawer numbers align cleanly down the right column.
- **Desktop Dropdown, Calendar & Modal Polish**: Expanded the Desktop **Add Livestock** window, removed visible sub-text below Desktop dropdowns in favor of hover summaries, portaled `ModernSelect` downward without clipping, and widened `ModernDatePicker` to match its trigger width.

## [1.5.5] - 2026-11-20

Added species-validated livestock breeds (including African breeds), duplicate-entry detection across all farm modules, dynamic `assets/avators` loading, head-portrait species icons, hover/mobile option explanations, larger Desktop Add Livestock modal sizing, Herd Registry cleanup, and exit/write-triggered cloud sync flushing so PC edits reach Mobile even if closed quickly.

### Fixes & Improvements
- **Real-Time & Close-Flush Cloud Sync**: Added 2.5s write-debounced Supabase sync plus graceful Desktop window-close flush (`onCloseRequested`), window focus/visibility pulls, and Mobile `AppState` background flush & active resume pulls so closing PC immediately after adding records pushes data reliably.
- **Validated Breed Dictionary & African Breeds**: Added a curated, species-specific breed dictionary covering African and international `cow`, `goat`, `sheep`, `duck`, and `other` poultry/farm breeds with alias canonicalization and searchable Desktop/Mobile dropdowns.
- **Duplicate Entry Prevention**: Added duplicate guards across Livestock (species, sex, name & DOB), Milk Production, Medical History, Financial Ledger, Alerts & Notes, HR Workers/Payments/Tasks, Animal Ownerships, and Farm Accounts.
- **Dynamic Avatars, Head Icons & Unused Asset Cleanup**: Added `scripts/sync-avators.mjs` to load every file in `assets/avators/` into Desktop & Mobile avatar pickers, replaced goat/sheep/duck/chicken icons with head portraits, and removed unused icon files.
- **UI Polish, Option Explanations & Herd Registry Cleanup**: Widened Desktop Add Livestock modal for Large/X-Large font sizes, removed summary stats cards/bar from Herd Registry, and added hover hints (Desktop) and compact option explanations (Mobile) across Settings and core forms.

## [1.5.4] - 2026-11-19

Fixed Desktop SQLite read-only write errors, enforced strict device-local account isolation on Farm Network join, added member Leave Network, added a full-app Refresh button, and allowed custom Admin Display Name renaming with an `Admin` badge.

### Fixes & Improvements
- Fixed Desktop SQLite read-only errors (`SQLITE_READONLY`) when adding or editing livestock by keeping live database handles writable while the app is open, refreshing the verified shadow copy in the background, locking on close/exit, and extracting friendly SQLite error messages.
- Enforced strict device-local Sign-In isolation (`__local_device_account_ids`) so joining a Farm Network via Join Key never exposes remote Admin accounts or signs into them from a member's phone or PC.
- Added self-service **Leave Network** in Farm Network and on the Pending Approval screen so connected or waiting users can disconnect cleanly back to standalone offline mode.
- Added a full-app **Refresh** button in the Desktop titlebar and Mobile top bar / drawer that re-syncs cloud data (when configured) and refreshes all settings, themes, accounts, and farm records immediately.
- Added **Admin Display Name** customization paired with an `Admin` tag across Settings, Farm Network Profile Edit, Sign-In tiles, Titlebar, and Mobile headers.

## [1.5.3] - 2026-11-19

Fixed Join Key Farm Network onboarding for non-admin users, added real-time Admin join notifications and automatic approval polling, removed unused invite flows, and updated the in-app Guide.

### Fixes & Improvements
- Fixed RBAC `this`-binding and repository pre-validation so signed-in non-admin users can join an Admin's Farm Network via Full Cloud Key (`FDB1:...`) or Short Code (`FARM-XXXX`) while revoked keys fail before pulling data.
- Added instant Admin notifications (OS notification, top amber **Pending Network Join Request** banner, and live sidebar/drawer count badge) whenever a member submits a Join Key request.
- Added automatic 20-second background approval polling on the **Pending Administrator Approval** portal alongside the manual **Check Approval** button, and pushed declined pending requests back to Supabase.
- Removed the unused **Invite to Network** flow from Desktop and Mobile Farm Network views so onboarding consistently uses Join Keys.
- Updated the in-app App Guide (`packages/core/src/tutorial.ts`, Desktop `TutorialOverlay`, and Mobile `TutorialModal`) and `README.md` across Getting Started, Ownerships, HR, Accounts & Join Flow, Farm Network, and Settings / Updates.

## [1.5.2] - 2026-11-19

Added full Admin and User account deletion, accurate installed version reporting, and polished Mobile Large/Extra-Large layouts.

### Fixes & Improvements
- Added full account deletion support for both Admin and User accounts (with confirmation prompts, automatic remaining-admin promotion, and PIN-verified portal deletion).
- Desktop update checks now read the compiled runtime binary version and Mobile OTA checks verify bundle freshness so update banners clear right after updating.
- Automated tag-to-version syncing in GitHub Actions so tagged Desktop and OTA builds always carry the matching release version number.
- Fixed Mobile Large and Extra-Large UI button padding, Native SQLite header wrapping, and 5-preset payment alert chip spacing.

## [1.5.0] - 2026-11-19

Offline-first desktop and mobile release with strict multi-user setup, mobile readability fixes, and in-app update notifications.

### Fixes & Improvements
- Removed automatic Admin account seeding so users explicitly choose and create their preferred accounts on Desktop and Mobile.
- Admin accounts now display the chosen Farm Name alongside a clean `Admin` tag instead of forcing a generic label.
- Added Android keyboard resize and auto-scroll handling so lower form inputs remain visible above the on-screen keyboard.
- Turned phone numbers and email addresses across Human Resources, Ownerships, and Farm Network into tappable call and email links.
- Enabled real-time Font Size, UI Element Size, and Compact Icon UI previews inside Mobile First-Time Setup.
- Fixed Mobile Large and Extra-Large UI button padding, Native SQLite header wrapping, and payment alert preset chip spacing.
- Added in-app and OS update notifications displaying update version numbers, lists of fixes, and one-click installs.
