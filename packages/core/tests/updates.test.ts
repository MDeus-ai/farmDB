import { describe, expect, it } from 'vitest';
import {
  compareSemver,
  FARMDB_GITHUB_RELEASES_PAGE,
  fetchLatestGithubReleaseInfo,
  formatUpdateNotificationSummary,
  isNewerVersion,
  normalizeVersionTag,
  parseReleaseNotesList,
  type AppUpdateInfo,
} from '../src/index';

describe('@farmdb/core updates helpers', () => {
  it('normalizes version tags and release labels cleanly', () => {
    expect(normalizeVersionTag('farmDB-v1.5')).toBe('1.5.0');
    expect(normalizeVersionTag('farmDB-v1.5.2')).toBe('1.5.2');
    expect(normalizeVersionTag('v2.0.0')).toBe('2.0.0');
    expect(normalizeVersionTag('1.6.1')).toBe('1.6.1');
    expect(normalizeVersionTag('')).toBe('0.0.0');
  });

  it('compares semver strings numerically including multi-digit minor versions', () => {
    expect(compareSemver('1.5.1', '1.5.0')).toBe(1);
    expect(compareSemver('1.10.0', '1.9.9')).toBe(1);
    expect(compareSemver('farmDB-v1.5', '1.5.0')).toBe(0);
    expect(compareSemver('1.4.9', '1.5.0')).toBe(-1);

    expect(isNewerVersion('1.5.1', '1.5.0')).toBe(true);
    expect(isNewerVersion('1.5.0', '1.5.0')).toBe(false);
    expect(isNewerVersion('1.4.8', '1.5.0')).toBe(false);
  });

  it('parses markdown headings, bullet lists, numbered lists, and inline formatting', () => {
    const markdown = `
## [1.5.1] - 2026-11-20
Offline-first improvements and bug fixes across Desktop and Mobile.

### Fixes
- Fixed **App Updates** button padding in Extra-Large mode
* Fixed \`Native SQLite\` header wrapping on small phones
1. Added interactive in-app update notifications
`;
    const parsed = parseReleaseNotesList(markdown);
    expect(parsed.summary).toBe(
      'Offline-first improvements and bug fixes across Desktop and Mobile.'
    );
    expect(parsed.fixes).toEqual([
      'Fixed App Updates button padding in Extra-Large mode',
      'Fixed Native SQLite header wrapping on small phones',
      'Added interactive in-app update notifications',
    ]);

    expect(parseReleaseNotesList(null)).toEqual({ summary: '', fixes: [] });
    expect(parseReleaseNotesList('   ')).toEqual({ summary: '', fixes: [] });
  });

  it('formats concise in-app notification summaries for 0, 1, 2, and 4 fixes', () => {
    const base: AppUpdateInfo = {
      version: '1.5.1',
      tagName: 'farmDB-v1.5.1',
      title: 'farmDB v1.5.1',
      publishedAt: '2026-11-20T09:00:00Z',
      summary: 'Important farmDB update.',
      fixes: [],
      releaseUrl: FARMDB_GITHUB_RELEASES_PAGE,
      source: 'tauri_updater',
      canDirectInstall: true,
    };

    expect(formatUpdateNotificationSummary(base)).toEqual({
      title: 'farmDB v1.5.1 Update Available',
      body: 'Important farmDB update.',
    });

    expect(
      formatUpdateNotificationSummary({
        ...base,
        fixes: ['Fix A'],
      })
    ).toEqual({
      title: 'farmDB v1.5.1 Update Available',
      body: 'Fix A',
    });

    expect(
      formatUpdateNotificationSummary({
        ...base,
        fixes: ['Fix A', 'Fix B'],
      })
    ).toEqual({
      title: 'farmDB v1.5.1 Update Available',
      body: 'Fix A · Fix B',
    });

    expect(
      formatUpdateNotificationSummary({
        ...base,
        fixes: ['Fix A', 'Fix B', 'Fix C', 'Fix D'],
      })
    ).toEqual({
      title: 'farmDB v1.5.1 Update Available',
      body: 'Fix A · Fix B (+2 more)',
    });
  });

  it('fetches GitHub release metadata safely and degrades cleanly on HTTP/network errors', async () => {
    const okInfo = await fetchLatestGithubReleaseInfo({
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            tag_name: 'farmDB-v1.5.2',
            name: 'farmDB (farmDB-v1.5.2)',
            published_at: '2026-11-21T12:00:00Z',
            html_url: 'https://github.com/MDeus-ai/farmDB/releases/tag/farmDB-v1.5.2',
            body: 'Latest stability patch.\n- Improved update banner\n- Faster sync retry',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
    });

    expect(okInfo).toEqual({
      version: '1.5.2',
      tagName: 'farmDB-v1.5.2',
      title: 'farmDB (farmDB-v1.5.2)',
      publishedAt: '2026-11-21T12:00:00Z',
      summary: 'Latest stability patch.',
      fixes: ['Improved update banner', 'Faster sync retry'],
      releaseUrl: 'https://github.com/MDeus-ai/farmDB/releases/tag/farmDB-v1.5.2',
      source: 'github_release',
      canDirectInstall: false,
    });

    const httpErr = await fetchLatestGithubReleaseInfo({
      fetchImpl: async () => new Response('Not Found', { status: 404 }),
    });
    expect(httpErr).toBeNull();

    const networkErr = await fetchLatestGithubReleaseInfo({
      fetchImpl: async () => {
        throw new Error('Offline');
      },
    });
    expect(networkErr).toBeNull();
  });
});
