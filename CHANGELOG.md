<!--
  Keep release headings in `## [X.Y.Z] - YYYY-MM-DD` format (e.g. `## [1.5.1] - 2026-11-25`).
  `.github/workflows/release.yml` automatically extracts the matching section from this file
  into GitHub Releases, Desktop `latest.json` updater notes, and Mobile Update Available modals.
-->

# farmDB Changelog

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
