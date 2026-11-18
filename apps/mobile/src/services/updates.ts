import * as Updates from 'expo-updates';
import { Platform } from 'react-native';

export interface MobileOtaCheckResult {
  status: 'up_to_date' | 'reloading' | 'unavailable';
  message: string;
}

/**
 * Checks Expo EAS Updates over the air when running in a compiled EAS APK/AAB/IPA build.
 * Safely reports unavailable in Expo Go or local web development mode.
 */
export async function checkAndApplyMobileOtaUpdate(): Promise<MobileOtaCheckResult> {
  if (Platform.OS === 'web' || !Updates.isEnabled) {
    return {
      status: 'unavailable',
      message:
        'Over-the-air updates activate automatically inside installed EAS production/preview mobile builds.',
    };
  }

  const checkResult = await Updates.checkForUpdateAsync();
  if (!checkResult.isAvailable) {
    return {
      status: 'up_to_date',
      message: 'This app is already up to date with the latest over-the-air bundle.',
    };
  }

  const fetched = await Updates.fetchUpdateAsync();
  if (fetched.isNew) {
    await Updates.reloadAsync();
    return {
      status: 'reloading',
      message: 'Downloaded new farmDB update and reloading app...',
    };
  }

  return {
    status: 'up_to_date',
    message: 'Latest over-the-air update is already active.',
  };
}
