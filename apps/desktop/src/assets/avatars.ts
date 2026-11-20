import {
  BUILTIN_FARM_ACCOUNT_AVATARS,
  formatAvatarLabel,
  formatAvatarSlugFromFilename,
  type FarmAccountAvatar,
} from '@farmdb/core';
import { APP_ICONS } from './icons';

export interface DesktopAvatarOption {
  readonly value: FarmAccountAvatar;
  readonly label: string;
  readonly iconSrc: string;
  readonly isFolderAvator: boolean;
}

const BUILTIN_AVATAR_SOURCES: Record<
  (typeof BUILTIN_FARM_ACCOUNT_AVATARS)[number],
  string
> = {
  farmer: APP_ICONS.farmer,
  farmerFemale: APP_ICONS.farmerFemale,
  peasant: APP_ICONS.peasant,
  staff: APP_ICONS.staff,
};

const folderModules = import.meta.glob<string>(
  '../../../../assets/avators/*.{png,jpg,jpeg,webp,svg}',
  { eager: true, import: 'default' }
);

const folderAvatars: DesktopAvatarOption[] = (() => {
  const usedSlugs = new Set<string>();
  return Object.entries(folderModules)
    .sort(([aPath], [bPath]) => aPath.localeCompare(bPath, 'en'))
    .map(([fullPath, src], idx) => {
      const filename = fullPath.split(/[\\/]/).pop() ?? `custom_${idx}.png`;
      let slug = formatAvatarSlugFromFilename(filename);
      if (usedSlugs.has(slug)) {
        slug = `${slug}_${idx + 1}`;
      }
      usedSlugs.add(slug);
      return {
        value: slug,
        label: formatAvatarLabel(slug),
        iconSrc: src,
        isFolderAvator: true,
      };
    });
})();

const builtinAvatars: DesktopAvatarOption[] = BUILTIN_FARM_ACCOUNT_AVATARS.map(
  (key) => ({
    value: key,
    label: formatAvatarLabel(key),
    iconSrc: BUILTIN_AVATAR_SOURCES[key],
    isFolderAvator: false,
  })
);

export const DESKTOP_AVATAR_OPTIONS: readonly DesktopAvatarOption[] = [
  ...builtinAvatars,
  ...folderAvatars,
];

const AVATAR_SOURCE_MAP = new Map<string, string>(
  DESKTOP_AVATAR_OPTIONS.map((opt) => [opt.value, opt.iconSrc])
);

export function resolveDesktopAvatarSrc(avatarKey?: string | null): string {
  if (avatarKey && AVATAR_SOURCE_MAP.has(avatarKey)) {
    return AVATAR_SOURCE_MAP.get(avatarKey)!;
  }
  return APP_ICONS.farmer;
}
