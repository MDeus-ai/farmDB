import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { isTauriEnvironment } from './imageStorage';

export interface DesktopUpdateCheckResult {
  status: 'up_to_date' | 'installed' | 'unsupported';
  version?: string;
  message: string;
}

/**
 * Checks GitHub Releases via `@tauri-apps/plugin-updater`, downloads & installs
 * any signed release newer than the running binary, and relaunches cleanly.
 */
export async function checkAndInstallDesktopUpdate(
  onProgress?: (label: string) => void
): Promise<DesktopUpdateCheckResult> {
  if (!isTauriEnvironment()) {
    return {
      status: 'unsupported',
      message:
        'Automatic app updates run inside the installed farmDB Desktop software.',
    };
  }

  onProgress?.('Checking GitHub Releases for a newer version...');
  const update = await check();
  if (!update) {
    return {
      status: 'up_to_date',
      message: 'You are already running the latest version of farmDB.',
    };
  }

  onProgress?.(`Downloading farmDB v${update.version}...`);
  let totalBytes = 0;
  let downloadedBytes = 0;
  await update.downloadAndInstall((event) => {
    if (event.event === 'Started') {
      totalBytes = event.data.contentLength ?? 0;
    } else if (event.event === 'Progress') {
      downloadedBytes += event.data.chunkLength;
      if (totalBytes > 0) {
        const pct = Math.min(100, Math.round((downloadedBytes / totalBytes) * 100));
        onProgress?.(`Downloading farmDB v${update.version} (${pct}%)...`);
      }
    } else if (event.event === 'Finished') {
      onProgress?.(`Installing farmDB v${update.version} and restarting...`);
    }
  });

  await relaunch();
  return {
    status: 'installed',
    version: update.version,
    message: `Updated to farmDB v${update.version}.`,
  };
}
