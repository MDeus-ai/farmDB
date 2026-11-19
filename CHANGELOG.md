<!--
  Keep release headings in `## [X.Y.Z] - YYYY-MM-DD` format (e.g. `## [1.5.1] - 2026-11-25`).
  `.github/workflows/release.yml` automatically extracts the matching section from this file
  into GitHub Releases, Desktop `latest.json` updater notes, and Mobile Update Available modals.
-->

# farmDB Changelog

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
