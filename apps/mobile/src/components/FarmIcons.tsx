import React from 'react';
import { Image } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import type {
  FarmAccountAvatar,
  LivestockSex,
  LivestockStatus,
  Species,
} from '@farmdb/core';
import {
  getSexPngSource,
  getSpeciesPngSource,
  getStatusPngSource,
  MOBILE_APP_ICONS,
} from '../assets/icons';
import { FARMDB_COLORS } from '../theme/uiScale';

export type AppIconName =
  | 'appLogo'
  | 'field'
  | 'barn'
  | 'barnAlt'
  | 'cow'
  | 'bull'
  | 'female'
  | 'male'
  | 'settings'
  | 'backup'
  | 'livestock'
  | 'familyTree'
  | 'tree'
  | 'production'
  | 'medical'
  | 'financial'
  | 'alerts'
  | 'hr'
  | 'staff'
  | 'ownerships'
  | 'peasant'
  | 'network'
  | 'farmerFemale'
  | 'livestockGroup'
  | 'cloudHosting'
  | 'cloudOffline'
  | 'dataSync'
  | 'web'
  | 'note'
  | 'pin'
  | 'calendar'
  | 'plus'
  | 'edit'
  | 'trash'
  | 'check'
  | 'checkCircle'
  | 'close'
  | 'search'
  | 'camera'
  | 'library'
  | 'refresh'
  | 'income'
  | 'expense'
  | 'all'
  | 'save'
  | 'liter'
  | 'gallon'
  | 'farmer'
  | 'hourglass'
  | 'database'
  | 'databaseLeaf'
  | 'databaseCheck'
  | 'cloud'
  | 'download'
  | 'upload'
  | 'chevronDown'
  | 'chevronUp'
  | 'chevronLeft'
  | 'chevronRight'
  | 'menu'
  | 'eye'
  | 'expand';

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

const PNG_ICON_MAP: Partial<Record<AppIconName, number>> = {
  appLogo: MOBILE_APP_ICONS.field,
  field: MOBILE_APP_ICONS.field,
  barn: MOBILE_APP_ICONS.barn,
  barnAlt: MOBILE_APP_ICONS.barnAlt,
  cow: MOBILE_APP_ICONS.cow,
  bull: MOBILE_APP_ICONS.bull,
  female: MOBILE_APP_ICONS.female,
  male: MOBILE_APP_ICONS.male,
  settings: MOBILE_APP_ICONS.settings,
  backup: MOBILE_APP_ICONS.databaseCloud,
  livestock: MOBILE_APP_ICONS.group,
  familyTree: MOBILE_APP_ICONS.tree,
  tree: MOBILE_APP_ICONS.tree,
  production: MOBILE_APP_ICONS.milkBottle,
  medical: MOBILE_APP_ICONS.syringe,
  financial: MOBILE_APP_ICONS.budget,
  alerts: MOBILE_APP_ICONS.notification,
  hr: MOBILE_APP_ICONS.hr,
  staff: MOBILE_APP_ICONS.staff,
  ownerships: MOBILE_APP_ICONS.ownership,
  peasant: MOBILE_APP_ICONS.peasant,
  network: MOBILE_APP_ICONS.networking,
  farmerFemale: MOBILE_APP_ICONS.farmerFemale,
  livestockGroup: MOBILE_APP_ICONS.livestockGroup,
  cloudHosting: MOBILE_APP_ICONS.cloudHosting,
  cloudOffline: MOBILE_APP_ICONS.cloudOffline,
  dataSync: MOBILE_APP_ICONS.dataSync,
  web: MOBILE_APP_ICONS.web,
  note: MOBILE_APP_ICONS.stickyNote,
  pin: MOBILE_APP_ICONS.pin,
  calendar: MOBILE_APP_ICONS.calendar,
  plus: MOBILE_APP_ICONS.plus,
  edit: MOBILE_APP_ICONS.pencil,
  trash: MOBILE_APP_ICONS.delete,
  check: MOBILE_APP_ICONS.checkmark,
  checkCircle: MOBILE_APP_ICONS.checkmark,
  close: MOBILE_APP_ICONS.letterX,
  camera: MOBILE_APP_ICONS.image,
  library: MOBILE_APP_ICONS.image,
  refresh: MOBILE_APP_ICONS.sync,
  income: MOBILE_APP_ICONS.money,
  expense: MOBILE_APP_ICONS.budget,
  save: MOBILE_APP_ICONS.checkmark,
  liter: MOBILE_APP_ICONS.liter,
  gallon: MOBILE_APP_ICONS.gallon,
  farmer: MOBILE_APP_ICONS.farmer,
  hourglass: MOBILE_APP_ICONS.hourglass,
  database: MOBILE_APP_ICONS.database,
  databaseLeaf: MOBILE_APP_ICONS.databaseLeaf,
  databaseCheck: MOBILE_APP_ICONS.databaseCheck,
  cloud: MOBILE_APP_ICONS.cloud,
  download: MOBILE_APP_ICONS.downloadDrive,
  upload: MOBILE_APP_ICONS.uploadArrow,
};

export function AppIcon({
  name,
  size = 18,
  color = FARMDB_COLORS.text,
  strokeWidth = 2,
}: IconProps & { name: AppIconName }) {
  const pngSource = PNG_ICON_MAP[name];
  if (pngSource !== undefined) {
    return (
      <Image
        source={pngSource}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    );
  }

  switch (name) {
    case 'search':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle
            cx="11"
            cy="11"
            r="7"
            stroke={color}
            strokeWidth={strokeWidth}
          />
          <Line
            x1="16.5"
            y1="16.5"
            x2="20.5"
            y2="20.5"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'chevronDown':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M6 9l6 6 6-6"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'chevronUp':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M6 15l6-6 6 6"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'chevronLeft':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M15 18l-6-6 6-6"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'chevronRight':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M9 6l6 6-6 6"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'menu':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 6h16M4 12h16M4 18h16"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        </Svg>
      );

    case 'eye':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle
            cx="12"
            cy="12"
            r="2.8"
            stroke={color}
            strokeWidth={strokeWidth}
          />
        </Svg>
      );

    case 'expand':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'all':
    default:
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect
            x="4"
            y="4"
            width="6.5"
            height="6.5"
            rx="1.5"
            stroke={color}
            strokeWidth={strokeWidth}
          />
          <Rect
            x="13.5"
            y="4"
            width="6.5"
            height="6.5"
            rx="1.5"
            stroke={color}
            strokeWidth={strokeWidth}
          />
          <Rect
            x="4"
            y="13.5"
            width="6.5"
            height="6.5"
            rx="1.5"
            stroke={color}
            strokeWidth={strokeWidth}
          />
          <Rect
            x="13.5"
            y="13.5"
            width="6.5"
            height="6.5"
            rx="1.5"
            stroke={color}
            strokeWidth={strokeWidth}
          />
        </Svg>
      );
  }
}

export function SpeciesIcon({
  species,
  sex,
  size = 18,
}: IconProps & { species: Species; sex?: LivestockSex | null }) {
  return (
    <Image
      source={getSpeciesPngSource(species, sex)}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}

export function SexIcon({
  sex,
  size = 16,
}: IconProps & { sex?: LivestockSex | null }) {
  return (
    <Image
      source={getSexPngSource(sex)}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}

export function StatusIcon({
  status,
  size = 14,
}: {
  status: LivestockStatus;
  size?: number;
  color?: string;
}) {
  return (
    <Image
      source={getStatusPngSource(status)}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}

/** Maps a persisted FarmAccount avatar key to a bundled mobile AppIconName. */
export function getAvatarIconName(av?: FarmAccountAvatar | null): AppIconName {
  switch (av) {
    case 'farmerFemale':
      return 'farmerFemale';
    case 'peasant':
      return 'peasant';
    case 'staff':
      return 'staff';
    case 'farmer':
    default:
      return 'farmer';
  }
}
