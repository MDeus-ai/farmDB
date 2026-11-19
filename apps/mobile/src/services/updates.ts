import * as Updates from 'expo-updates';
import { Platform } from 'react-native';
import {
  FARMDB_APP_VERSION,
  FARMDB_GITHUB_RELEASES_PAGE,
  fetchLatestGithubReleaseInfo,
  isNewerVersion,
  type AppUpdateInfo,
} from '@farmdb/core';

export interface MobileUpdateFeedback {
  kind: 'ok' | 'err';
  text: string;
}

export interface MobileUpdateCheckOutcome {
  status: 'available' | 'up_to_date' | 'unavailable';
  currentVersion: string;
  availableUpdate: AppUpdateInfo | null;
  checkedAt: string;
  message: string;
  otaEnabled: boolean;
  otaChannel: string | null;
  updateId: string | null;
}

export interface MobileUpdateController {
  currentVersion: string;
  otaEnabled: boolean;
  otaChannel: string | null;
  checking: boolean;
  installing: boolean;
  progressLabel: string | null;
  lastCheckedAt: string | null;
  feedback: MobileUpdateFeedback | null;
  availableUpdate: AppUpdateInfo | null;
  onCheckForUpdates: () => Promise<void>;
  onOpenModal: () => void;
  onInstallUpdate: () => Promise<void>;
}

function extractManifestMessage(manifest: unknown): string | null {
  if (!manifest || typeof manifest !== 'object') {
    return null;
  }
  const rec = manifest as Record<string, unknown>;
  const metadata = rec.metadata;
  if (metadata && typeof metadata === 'object') {
    const msg = (metadata as Record<string, unknown>).message;
    if (typeof msg === 'string' && msg.trim()) {
      return msg.trim();
    }
  }
  const extra = rec.extra;
  if (extra && typeof extra === 'object') {
    const expoClient = (extra as Record<string, unknown>).expoClient;
    if (expoClient && typeof expoClient === 'object') {
      const updatesObj = (expoClient as Record<string, unknown>).updates;
      if (updatesObj && typeof updatesObj === 'object') {
        const msg = (updatesObj as Record<string, unknown>).message;
        if (typeof msg === 'string' && msg.trim()) {
          return msg.trim();
        }
      }
    }
  }
  return null;
}

/**
 * Checks Expo EAS Updates over the air (in compiled APK/IPA builds) alongside
 * public GitHub Release notes so available fixes and version numbers are visible.
 */
export async function checkMobileUpdate(): Promise<MobileUpdateCheckOutcome> {
  const currentVersion = FARMDB_APP_VERSION;
  const checkedAt = new Date().toISOString();
  const otaEnabled = Platform.OS !== 'web' && Boolean(Updates.isEnabled);
  const otaChannel = typeof Updates.channel === 'string' && Updates.channel ? Updates.channel : null;
  const updateId = typeof Updates.updateId === 'string' && Updates.updateId ? Updates.updateId : null;

  if (otaEnabled) {
    const [otaResult, gh] = await Promise.all([
      Updates.checkForUpdateAsync(),
      fetchLatestGithubReleaseInfo(),
    ]);

    if (otaResult.isAvailable) {
      const manifestMsg = extractManifestMessage(otaResult.manifest);
      const version = gh?.version ?? currentVersion;
      const isHigherTag = gh ? isNewerVersion(gh.version, currentVersion) : false;
      const availableUpdate: AppUpdateInfo = {
        version,
        tagName: gh?.tagName ?? `ota-${version}`,
        title: isHigherTag && gh ? gh.title : `farmDB v${version} (OTA Update)`,
        publishedAt: gh?.publishedAt ?? null,
        summary:
          gh?.summary ||
          manifestMsg ||
          'An over-the-air update is ready to download without reinstalling your APK.',
        fixes:
          gh && gh.fixes.length > 0
            ? gh.fixes
            : manifestMsg
              ? [manifestMsg]
              : ['Includes the latest mobile bug fixes and UI improvements delivered over the air.'],
        releaseUrl: gh?.releaseUrl ?? FARMDB_GITHUB_RELEASES_PAGE,
        source: 'expo_ota',
        canDirectInstall: true,
      };

      return {
        status: 'available',
        currentVersion,
        availableUpdate,
        checkedAt,
        message: `farmDB v${availableUpdate.version} over-the-air update is ready to install.`,
        otaEnabled,
        otaChannel,
        updateId,
      };
    }

    const bundleCreatedMs =
      Updates.createdAt instanceof Date ? Updates.createdAt.getTime() : null;
    const ghPublishedMs = gh?.publishedAt ? Date.parse(gh.publishedAt) : Number.NaN;
    const otaCoversLatestRelease = Boolean(
      bundleCreatedMs &&
        Number.isFinite(ghPublishedMs) &&
        bundleCreatedMs >= ghPublishedMs - 15 * 60 * 1000
    );

    if (gh && isNewerVersion(gh.version, currentVersion) && !otaCoversLatestRelease) {
      return {
        status: 'available',
        currentVersion,
        availableUpdate: { ...gh, source: 'github_release', canDirectInstall: false },
        checkedAt,
        message: `farmDB v${gh.version} is available on GitHub Releases.`,
        otaEnabled,
        otaChannel,
        updateId,
      };
    }

    const effectiveVersion =
      otaCoversLatestRelease && gh && isNewerVersion(gh.version, currentVersion)
        ? gh.version
        : currentVersion;

    return {
      status: 'up_to_date',
      currentVersion: effectiveVersion,
      availableUpdate: null,
      checkedAt,
      message: `You are up to date on farmDB v${effectiveVersion}.`,
      otaEnabled,
      otaChannel,
      updateId,
    };
  }

  const gh = await fetchLatestGithubReleaseInfo();
  if (gh && isNewerVersion(gh.version, currentVersion)) {
    return {
      status: 'available',
      currentVersion,
      availableUpdate: { ...gh, source: 'github_release', canDirectInstall: false },
      checkedAt,
      message: `farmDB v${gh.version} is available on GitHub Releases.`,
      otaEnabled,
      otaChannel,
      updateId,
    };
  }

  return {
    status: 'unavailable',
    currentVersion,
    availableUpdate: null,
    checkedAt,
    message: `Running farmDB v${currentVersion}. Over-the-air updates activate automatically inside installed EAS APK builds.`,
    otaEnabled,
    otaChannel,
    updateId,
  };
}

/**
 * Fetches and applies a pending Expo EAS OTA update bundle and reloads the app.
 */
export async function installMobileOtaUpdate(
  onProgress?: (label: string) => void
): Promise<{ reloaded: boolean; message: string }> {
  if (Platform.OS === 'web' || !Updates.isEnabled) {
    return {
      reloaded: false,
      message: 'Over-the-air install is available inside installed Android/iOS APK builds.',
    };
  }

  onProgress?.('Downloading over-the-air farmDB update...');
  const fetched = await Updates.fetchUpdateAsync();
  if (fetched.isNew) {
    onProgress?.('Applying update and restarting farmDB...');
    await Updates.reloadAsync();
    return {
      reloaded: true,
      message: 'Downloaded new farmDB update and reloading app...',
    };
  }

  return {
    reloaded: false,
    message: 'Latest over-the-air bundle is already active.',
  };
}
