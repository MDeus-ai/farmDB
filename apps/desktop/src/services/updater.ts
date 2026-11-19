import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import {
  FARMDB_APP_VERSION,
  FARMDB_GITHUB_RELEASES_PAGE,
  fetchLatestGithubReleaseInfo,
  isNewerVersion,
  normalizeVersionTag,
  parseReleaseNotesList,
  type AppUpdateInfo,
} from '@farmdb/core';
import { isTauriEnvironment } from './imageStorage';

export interface DesktopUpdateProgress {
  percent: number | null;
  label: string;
}

export interface DesktopUpdateFeedback {
  kind: 'ok' | 'err';
  text: string;
}

export interface DesktopUpdateController {
  currentVersion: string;
  checking: boolean;
  installing: boolean;
  progressPercent: number | null;
  progressLabel: string | null;
  lastCheckedAt: string | null;
  feedback: DesktopUpdateFeedback | null;
  availableUpdate: AppUpdateInfo | null;
  onCheckForUpdates: () => Promise<void>;
  onOpenModal: () => void;
  onInstallUpdate: () => Promise<void>;
}

export interface DesktopUpdateCheckOutcome {
  status: 'available' | 'up_to_date';
  currentVersion: string;
  availableUpdate: AppUpdateInfo | null;
  checkedAt: string;
  message: string;
  install?: (onProgress?: (progress: DesktopUpdateProgress) => void) => Promise<void>;
}

/**
 * Checks `@tauri-apps/plugin-updater` inside Tauri (with GitHub Release notes enrichment)
 * or falls back cleanly to GitHub Releases metadata when running outside Tauri.
 */
export async function checkDesktopUpdate(): Promise<DesktopUpdateCheckOutcome> {
  const currentVersion = FARMDB_APP_VERSION;
  const checkedAt = new Date().toISOString();

  if (isTauriEnvironment()) {
    const update = await check();
    if (update) {
      const version = normalizeVersionTag(update.version);
      const parsed = parseReleaseNotesList(update.body);
      const gh = parsed.fixes.length === 0 ? await fetchLatestGithubReleaseInfo() : null;
      const ghMatches = gh && gh.version === version ? gh : null;

      const availableUpdate: AppUpdateInfo = {
        version,
        tagName: ghMatches?.tagName ?? `farmDB-v${version}`,
        title: ghMatches?.title ?? `farmDB v${version}`,
        publishedAt: update.date ?? ghMatches?.publishedAt ?? null,
        summary: parsed.summary || ghMatches?.summary || 'A signed farmDB Desktop update is ready to install.',
        fixes: parsed.fixes.length > 0 ? parsed.fixes : (ghMatches?.fixes ?? gh?.fixes ?? []),
        releaseUrl: ghMatches?.releaseUrl ?? FARMDB_GITHUB_RELEASES_PAGE,
        source: 'tauri_updater',
        canDirectInstall: true,
      };

      const install = async (
        onProgress?: (progress: DesktopUpdateProgress) => void
      ): Promise<void> => {
        onProgress?.({ percent: 0, label: `Downloading farmDB v${version}...` });
        let totalBytes = 0;
        let downloadedBytes = 0;
        await update.downloadAndInstall((event) => {
          if (event.event === 'Started') {
            totalBytes = event.data.contentLength ?? 0;
            onProgress?.({
              percent: totalBytes > 0 ? 0 : null,
              label: `Downloading farmDB v${version}...`,
            });
          } else if (event.event === 'Progress') {
            downloadedBytes += event.data.chunkLength;
            if (totalBytes > 0) {
              const pct = Math.min(
                100,
                Math.round((downloadedBytes / totalBytes) * 100)
              );
              onProgress?.({
                percent: pct,
                label: `Downloading farmDB v${version} (${pct}%)...`,
              });
            }
          } else if (event.event === 'Finished') {
            onProgress?.({
              percent: 100,
              label: `Installing farmDB v${version} and restarting...`,
            });
          }
        });
        await relaunch();
      };

      return {
        status: 'available',
        currentVersion,
        availableUpdate,
        checkedAt,
        message: `farmDB v${version} is ready to install.`,
        install,
      };
    }

    const gh = await fetchLatestGithubReleaseInfo();
    if (gh && isNewerVersion(gh.version, currentVersion)) {
      return {
        status: 'available',
        currentVersion,
        availableUpdate: { ...gh, canDirectInstall: false },
        checkedAt,
        message: `farmDB v${gh.version} is available on GitHub Releases.`,
      };
    }

    return {
      status: 'up_to_date',
      currentVersion,
      availableUpdate: null,
      checkedAt,
      message: `You are already running the latest version (farmDB v${currentVersion}).`,
    };
  }

  const gh = await fetchLatestGithubReleaseInfo();
  if (gh && isNewerVersion(gh.version, currentVersion)) {
    return {
      status: 'available',
      currentVersion,
      availableUpdate: { ...gh, canDirectInstall: false },
      checkedAt,
      message: `farmDB v${gh.version} is available on GitHub Releases.`,
    };
  }

  return {
    status: 'up_to_date',
    currentVersion,
    availableUpdate: null,
    checkedAt,
    message: `Running farmDB v${currentVersion} — you are up to date.`,
  };
}
