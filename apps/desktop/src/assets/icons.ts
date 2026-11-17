import barn from '@farmdb-icons/barn.png';
import barnAlt from '@farmdb-icons/barn-2.png';
import budget from '@farmdb-icons/budget.png';
import calendar from '@farmdb-icons/calendar.png';
import checkmark from '@farmdb-icons/checkmark.png';
import chicken from '@farmdb-icons/chicken.png';
import cloud from '@farmdb-icons/cloud-computing.png';
import cloudHosting from '@farmdb-icons/cloud-hosting.png';
import cloudOffline from '@farmdb-icons/cloud-offline.png';
import copyWriting from '@farmdb-icons/copy-writing.png';
import cow from '@farmdb-icons/cow.png';
import dataSync from '@farmdb-icons/data-synchronization.png';
import database from '@farmdb-icons/database.png';
import databaseCheck from '@farmdb-icons/database_and_checkmark.png';
import databaseCloud from '@farmdb-icons/database_and_cloud.png';
import databaseLeaf from '@farmdb-icons/database_and_leaf.png';
import deleteIcon from '@farmdb-icons/delete.png';
import dollarSymbol from '@farmdb-icons/dollar-symbol.png';
import downloadDrive from '@farmdb-icons/download-to-storage-drive.png';
import downloads from '@farmdb-icons/downloads.png';
import duck from '@farmdb-icons/duck.png';
import farmer from '@farmdb-icons/farmer.png';
import farmerAlt from '@farmdb-icons/farmer-2.png';
import farmerFemale from '@farmdb-icons/farmer-female.png';
import gallon from '@farmdb-icons/gallon.png';
import gear from '@farmdb-icons/gear.png';
import goat from '@farmdb-icons/goat.png';
import groupIcon from '@farmdb-icons/group.png';
import herd from '@farmdb-icons/herd.png';
import hourglass from '@farmdb-icons/hourglass.png';
import image from '@farmdb-icons/image.png';
import letterX from '@farmdb-icons/letter-x.png';
import liter from '@farmdb-icons/liter.png';
import livestockGroup from '@farmdb-icons/livestock.png';
import milkBottle from '@farmdb-icons/milk-bottle.png';
import money from '@farmdb-icons/money.png';
import networking from '@farmdb-icons/networking.png';
import notification from '@farmdb-icons/notification.png';
import peasant from '@farmdb-icons/peasant.png';
import pencil from '@farmdb-icons/pencil.png';
import pin from '@farmdb-icons/pin.png';
import plus from '@farmdb-icons/plus.png';
import sheep from '@farmdb-icons/sheep.png';
import skull from '@farmdb-icons/skull.png';
import sprout from '@farmdb-icons/sprout.png';
import stickyNote from '@farmdb-icons/sticky-note.png';
import sync from '@farmdb-icons/sync.png';
import syringe from '@farmdb-icons/syringe.png';
import tree from '@farmdb-icons/tree.png';
import ugandaFlag from '@farmdb-icons/uganda-flag.png';
import ukFlag from '@farmdb-icons/united-kingdom-flag.png';
import upload from '@farmdb-icons/up-loading.png';
import uploadArrow from '@farmdb-icons/upload-big-arrow.png';
import usaFlag from '@farmdb-icons/usa-flag.png';
import web from '@farmdb-icons/web.png';
import type { CurrencyOption, LivestockStatus, Species } from '@farmdb/core';

export const APP_ICONS = {
  barn,
  barnAlt,
  budget,
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

export type AppPngIconKey = keyof typeof APP_ICONS;

export function getCurrencyFlagIcon(symbolOrKey?: string): string {
  if (symbolOrKey === 'uganda' || symbolOrKey?.trim().toUpperCase() === 'UGX') {
    return APP_ICONS.ugandaFlag;
  }
  if (symbolOrKey === 'uk' || symbolOrKey?.trim() === '£' || symbolOrKey?.trim().toUpperCase() === 'GBP') {
    return APP_ICONS.ukFlag;
  }
  if (symbolOrKey === 'usa' || symbolOrKey?.trim() === '$' || symbolOrKey?.trim().toUpperCase() === 'USD') {
    return APP_ICONS.usaFlag;
  }
  return APP_ICONS.dollarSymbol;
}

export function getCurrencyOptionFlag(option: CurrencyOption): string {
  return getCurrencyFlagIcon(option.flagKey);
}

export function getSpeciesPngIcon(species: Species): string {
  switch (species) {
    case 'cow':
      return APP_ICONS.cow;
    case 'goat':
      return APP_ICONS.goat;
    case 'sheep':
      return APP_ICONS.sheep;
    case 'duck':
      return APP_ICONS.duck;
    case 'other':
      return APP_ICONS.chicken;
  }
}

export function getStatusPngIcon(status: LivestockStatus): string {
  switch (status) {
    case 'active':
      return APP_ICONS.sprout;
    case 'sold':
      return APP_ICONS.money;
    case 'deceased':
      return APP_ICONS.skull;
  }
}
