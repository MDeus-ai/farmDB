export const FARMDB_APP_VERSION = '1.5.2';
export const FARMDB_GITHUB_REPO = 'MDeus-ai/farmDB';
export const FARMDB_GITHUB_LATEST_RELEASE_API = `https://api.github.com/repos/${FARMDB_GITHUB_REPO}/releases/latest`;
export const FARMDB_GITHUB_RELEASES_PAGE = `https://github.com/${FARMDB_GITHUB_REPO}/releases`;

export const CURRENT_RELEASE_HIGHLIGHTS: readonly string[] = [
  'Delete any Admin or User account cleanly from Farm Network or the Sign-In Portal with confirmation and PIN safety.',
  'Accounts stay strictly user-chosen with zero auto-created default Admin profile, plus custom Farm Name with Admin tag.',
  'Accurate installed version detection clears update banners immediately once updates are installed.',
  'Android keyboards keep lower form fields visible above the keyboard, with tappable phone and email contact links.',
  'Mobile First-Time Setup previews Font Size, UI Element Size, and Compact Icon UI in real time.',
  'Refined Mobile Large & X-Large UI layouts across Settings, Native SQLite Protection header, intervals, and tabs.',
  'Automatic in-app and OS update notifications with version numbers, structured lists of fixes, and one-tap installs.',
];

export type UpdateSource = 'tauri_updater' | 'expo_ota' | 'github_release';

export interface AppUpdateInfo {
  version: string;
  tagName: string;
  title: string;
  publishedAt: string | null;
  summary: string;
  fixes: string[];
  releaseUrl: string;
  source: UpdateSource;
  canDirectInstall: boolean;
}

/**
 * Normalizes a release tag or version string (e.g. `farmDB-v1.5`, `v1.5.2`)
 * into a 3-part numeric semver string (`1.5.0`, `1.5.2`).
 */
export function normalizeVersionTag(raw: string): string {
  const trimmed = raw
    .trim()
    .replace(/^farmdb[-_]?/i, '')
    .replace(/^v/i, '')
    .trim();
  const numericMatch = trimmed.match(/(\d+(?:\.\d+)*)/);
  if (!numericMatch) {
    return '0.0.0';
  }
  const parts = numericMatch[1]!
    .split('.')
    .slice(0, 3)
    .map((segment) => {
      const parsed = Number.parseInt(segment, 10);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    });
  while (parts.length < 3) {
    parts.push(0);
  }
  return parts.join('.');
}

function parseSemverParts(version: string): [number, number, number] {
  const normalized = normalizeVersionTag(version);
  const parts = normalized.split('.').map((n) => Number.parseInt(n, 10) || 0);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

/**
 * Compares two version strings numerically. Returns `1` if `a > b`, `-1` if `a < b`, or `0` if equal.
 */
export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const [aMaj, aMin, aPat] = parseSemverParts(a);
  const [bMaj, bMin, bPat] = parseSemverParts(b);
  if (aMaj !== bMaj) return aMaj > bMaj ? 1 : -1;
  if (aMin !== bMin) return aMin > bMin ? 1 : -1;
  if (aPat !== bPat) return aPat > bPat ? 1 : -1;
  return 0;
}

export function isNewerVersion(candidate: string, current: string): boolean {
  return compareSemver(candidate, current) > 0;
}

function cleanInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses markdown or plain-text release notes into an intro summary and a concise bullet list of fixes.
 */
export function parseReleaseNotesList(
  body: string | null | undefined
): { summary: string; fixes: string[] } {
  if (!body || !body.trim()) {
    return { summary: '', fixes: [] };
  }

  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const fixes: string[] = [];
  const introParagraphs: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^#{1,6}\s+/.test(line) || /^[-*_]{3,}$/.test(line)) {
      continue;
    }
    const bulletMatch = line.match(/^(?:[-*•]|\d+[.)])\s+(.+)$/);
    if (bulletMatch) {
      const cleaned = cleanInlineMarkdown(bulletMatch[1]!);
      if (cleaned && fixes.length < 12) {
        fixes.push(cleaned);
      }
      continue;
    }
    const cleanedLine = cleanInlineMarkdown(line);
    if (cleanedLine) {
      introParagraphs.push(cleanedLine);
    }
  }

  const summary = introParagraphs[0] ?? '';

  if (fixes.length === 0 && introParagraphs.length > 1) {
    for (const extra of introParagraphs.slice(1, 13)) {
      fixes.push(extra);
    }
  }

  return { summary, fixes };
}

export function formatUpdateNotificationSummary(
  info: AppUpdateInfo
): { title: string; body: string } {
  const title = `farmDB v${info.version} Update Available`;
  if (info.fixes.length === 0) {
    return {
      title,
      body: info.summary || 'Tap to view fixes and install the latest update.',
    };
  }
  const preview = info.fixes.slice(0, 2).join(' · ');
  const remaining = info.fixes.length - 2;
  return {
    title,
    body: remaining > 0 ? `${preview} (+${remaining} more)` : preview,
  };
}

interface GithubReleaseApiPayload {
  tag_name?: string;
  name?: string;
  body?: string | null;
  published_at?: string | null;
  html_url?: string;
}

/**
 * Fetches latest published GitHub Release metadata for MDeus-ai/farmDB without throwing offline errors.
 */
export async function fetchLatestGithubReleaseInfo(options?: {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<AppUpdateInfo | null> {
  const fetchFn = options?.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined);
  if (!fetchFn) {
    return null;
  }

  const timeoutMs = options?.timeoutMs ?? 8000;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => {
        controller.abort();
      }, timeoutMs)
    : null;

  try {
    const response = await fetchFn(FARMDB_GITHUB_LATEST_RELEASE_API, {
      headers: {
        Accept: 'application/vnd.github+json',
      },
      signal: controller?.signal,
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as GithubReleaseApiPayload;
    const rawTag = payload.tag_name ?? payload.name ?? '';
    const version = normalizeVersionTag(rawTag);
    if (version === '0.0.0') {
      return null;
    }
    const parsed = parseReleaseNotesList(payload.body);
    return {
      version,
      tagName: rawTag.trim() || `farmDB-v${version}`,
      title: payload.name?.trim() || `farmDB v${version}`,
      publishedAt: payload.published_at ?? null,
      summary: parsed.summary,
      fixes: parsed.fixes,
      releaseUrl: payload.html_url?.trim() || FARMDB_GITHUB_RELEASES_PAGE,
      source: 'github_release',
      canDirectInstall: false,
    };
  } catch {
    return null;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
