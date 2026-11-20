import {
  BUILTIN_FARM_ACCOUNT_AVATARS,
  formatAvatarLabel,
  type FarmAccountAvatar,
} from '@farmdb/core';
import { MOBILE_FOLDER_AVATARS } from './avators.generated';
import { MOBILE_APP_ICONS, type MobilePngIconSource } from './icons';

export interface MobileAvatarOption {
  readonly value: FarmAccountAvatar;
  readonly label: string;
  readonly source: MobilePngIconSource;
  readonly isFolderAvator: boolean;
}

const BUILTIN_SOURCES: Record<
  (typeof BUILTIN_FARM_ACCOUNT_AVATARS)[number],
  MobilePngIconSource
> = {
  farmer: MOBILE_APP_ICONS.farmer,
  farmerFemale: MOBILE_APP_ICONS.farmerFemale,
  peasant: MOBILE_APP_ICONS.peasant,
  staff: MOBILE_APP_ICONS.staff,
};

const builtinOptions: MobileAvatarOption[] = BUILTIN_FARM_ACCOUNT_AVATARS.map(
  (key) => ({
    value: key,
    label: formatAvatarLabel(key),
    source: BUILTIN_SOURCES[key],
    isFolderAvator: false,
  })
);

const folderOptions: MobileAvatarOption[] = MOBILE_FOLDER_AVATARS.map((item) => ({
  value: item.key,
  label: item.label,
  source: item.source,
  isFolderAvator: true,
}));

export const MOBILE_AVATAR_OPTIONS: readonly MobileAvatarOption[] = [
  ...builtinOptions,
  ...folderOptions,
];

const AVATAR_MAP = new Map<string, MobilePngIconSource>(
  MOBILE_AVATAR_OPTIONS.map((item) => [item.value, item.source])
);

export function resolveMobileAvatarSource(
  avatarKey?: string | null
): MobilePngIconSource {
  if (avatarKey && AVATAR_MAP.has(avatarKey)) {
    return AVATAR_MAP.get(avatarKey)!;
  }
  return MOBILE_APP_ICONS.farmer;
}
