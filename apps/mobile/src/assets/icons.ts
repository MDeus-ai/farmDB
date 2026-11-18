import type {
  CurrencyOption,
  LivestockSex,
  LivestockStatus,
  Species,
} from '@farmdb/core';

import barn from '../../assets/icons/barn.png';
import barnAlt from '../../assets/icons/barn-2.png';
import budget from '../../assets/icons/budget.png';
import bull from '../../assets/icons/bull.png';
import calendar from '../../assets/icons/calendar.png';
import checkmark from '../../assets/icons/checkmark.png';
import chicken from '../../assets/icons/chicken.png';
import cloud from '../../assets/icons/cloud-computing.png';
import cloudHosting from '../../assets/icons/cloud-hosting.png';
import cloudOffline from '../../assets/icons/cloud-offline.png';
import copyWriting from '../../assets/icons/copy-writing.png';
import cow from '../../assets/icons/cow.png';
import dataSync from '../../assets/icons/data-synchronization.png';
import database from '../../assets/icons/database.png';
import databaseCheck from '../../assets/icons/database_and_checkmark.png';
import databaseCloud from '../../assets/icons/database_and_cloud.png';
import databaseLeaf from '../../assets/icons/database_and_leaf.png';
import deleteIcon from '../../assets/icons/delete.png';
import dollarSymbol from '../../assets/icons/dollar-symbol.png';
import downloadDrive from '../../assets/icons/download-to-storage-drive.png';
import downloads from '../../assets/icons/downloads.png';
import duck from '../../assets/icons/duck.png';
import farmer from '../../assets/icons/farmer.png';
import farmerAlt from '../../assets/icons/farmer-2.png';
import farmerFemale from '../../assets/icons/farmer-female.png';
import female from '../../assets/icons/female.png';
import field from '../../assets/icons/field.png';
import gallon from '../../assets/icons/gallon.png';
import gear from '../../assets/icons/gear.png';
import male from '../../assets/icons/gender.png';
import goat from '../../assets/icons/goat.png';
import groupIcon from '../../assets/icons/group.png';
import herd from '../../assets/icons/herd.png';
import hourglass from '../../assets/icons/hourglass.png';
import image from '../../assets/icons/image.png';
import letterX from '../../assets/icons/letter-x.png';
import liter from '../../assets/icons/liter.png';
import livestockGroup from '../../assets/icons/livestock.png';
import milkBottle from '../../assets/icons/milk-bottle.png';
import money from '../../assets/icons/money.png';
import networking from '../../assets/icons/networking.png';
import notification from '../../assets/icons/notification.png';
import peasant from '../../assets/icons/peasant.png';
import pencil from '../../assets/icons/pencil.png';
import pin from '../../assets/icons/pin.png';
import plus from '../../assets/icons/plus.png';
import sheep from '../../assets/icons/sheep.png';
import skull from '../../assets/icons/skull.png';
import sprout from '../../assets/icons/sprout.png';
import stickyNote from '../../assets/icons/sticky-note.png';
import sync from '../../assets/icons/sync.png';
import syringe from '../../assets/icons/syringe.png';
import tree from '../../assets/icons/tree.png';
import ugandaFlag from '../../assets/icons/uganda-flag.png';
import ukFlag from '../../assets/icons/united-kingdom-flag.png';
import upload from '../../assets/icons/up-loading.png';
import uploadArrow from '../../assets/icons/upload-big-arrow.png';
import usaFlag from '../../assets/icons/usa-flag.png';
import web from '../../assets/icons/web.png';

export const MOBILE_APP_ICONS = {
  appLogo: field,
  barn,
  barnAlt,
  budget,
  bull,
  calendar,
  checkmark,
  chicken,
  cloud,
  cloudHosting,
  cloudOffline,
  copyWriting,
  cow,
  dataSync,
  database,
  databaseCheck,
  databaseCloud,
  databaseLeaf,
  delete: deleteIcon,
  dollarSymbol,
  downloadDrive,
  downloads,
  duck,
  farmer,
  farmerAlt,
  farmerFemale,
  female,
  field,
  gallon,
  gear,
  goat,
  group: herd,
  herd,
  hr: farmerAlt,
  staff: groupIcon,
  hourglass,
  image,
  letterX,
  liter,
  livestockGroup,
  male,
  milkBottle,
  money,
  network: networking,
  networking,
  notification,
  ownership: peasant,
  peasant,
  pencil,
  pin,
  plus,
  settings: gear,
  sheep,
  skull,
  sprout,
  stickyNote,
  sync,
  syringe,
  tree,
  familyTree: tree,
  ugandaFlag,
  ukFlag,
  upload,
  uploadArrow,
  usaFlag,
  web,
} as const;

export type MobilePngIconSource = number;

export function getCurrencyFlagSource(symbolOrKey?: string): MobilePngIconSource {
  if (symbolOrKey === 'uganda' || symbolOrKey?.trim().toUpperCase() === 'UGX') {
    return MOBILE_APP_ICONS.ugandaFlag;
  }
  if (
    symbolOrKey === 'uk' ||
    symbolOrKey?.trim() === '£' ||
    symbolOrKey?.trim().toUpperCase() === 'GBP'
  ) {
    return MOBILE_APP_ICONS.ukFlag;
  }
  if (
    symbolOrKey === 'usa' ||
    symbolOrKey?.trim() === '$' ||
    symbolOrKey?.trim().toUpperCase() === 'USD'
  ) {
    return MOBILE_APP_ICONS.usaFlag;
  }
  return MOBILE_APP_ICONS.dollarSymbol;
}

export function getCurrencyOptionFlagSource(
  option: CurrencyOption
): MobilePngIconSource {
  return getCurrencyFlagSource(option.flagKey);
}

export function getSpeciesPngSource(
  species: Species,
  sex?: LivestockSex | null
): MobilePngIconSource {
  switch (species) {
    case 'cow':
      return sex === 'male' ? MOBILE_APP_ICONS.bull : MOBILE_APP_ICONS.cow;
    case 'goat':
      return MOBILE_APP_ICONS.goat;
    case 'sheep':
      return MOBILE_APP_ICONS.sheep;
    case 'duck':
      return MOBILE_APP_ICONS.duck;
    case 'other':
      return MOBILE_APP_ICONS.chicken;
  }
}

export function getSexPngSource(
  sex?: LivestockSex | null
): MobilePngIconSource {
  return sex === 'male' ? MOBILE_APP_ICONS.male : MOBILE_APP_ICONS.female;
}

export function getStatusPngSource(
  status: LivestockStatus
): MobilePngIconSource {
  switch (status) {
    case 'active':
      return MOBILE_APP_ICONS.sprout;
    case 'sold':
      return MOBILE_APP_ICONS.money;
    case 'deceased':
      return MOBILE_APP_ICONS.skull;
  }
}
