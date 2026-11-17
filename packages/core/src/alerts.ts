import { getTodayIsoDate } from './analytics';
import type { AlertItem, Livestock } from './types';
import { formatSpeciesLabel } from './utils';

export type AlertUrgency =
  | 'resolved'
  | 'note'
  | 'overdue'
  | 'due_today'
  | 'upcoming';

export function getAlertUrgency(
  alert: Pick<AlertItem, 'entryKind' | 'isResolved' | 'triggerDate'>,
  todayIso: string = getTodayIsoDate()
): AlertUrgency {
  if (alert.isResolved) {
    return 'resolved';
  }
  if (alert.entryKind === 'note') {
    return 'note';
  }
  if (alert.triggerDate < todayIso) {
    return 'overdue';
  }
  if (alert.triggerDate === todayIso) {
    return 'due_today';
  }
  return 'upcoming';
}

export function isAlertDueForNotification(
  alert: Pick<AlertItem, 'entryKind' | 'isResolved' | 'notifiedAt' | 'triggerDate'>,
  todayIso: string = getTodayIsoDate()
): boolean {
  if (alert.entryKind !== 'alert' || alert.isResolved) {
    return false;
  }
  if (alert.notifiedAt !== null) {
    return false;
  }
  return alert.triggerDate <= todayIso;
}

export function formatAlertNotificationContent(
  alert: AlertItem,
  animal?: Livestock | null
): { title: string; body: string } {
  const subject = animal
    ? `${formatSpeciesLabel(animal.species)} #${animal.tagNumber}${animal.name ? ` (${animal.name})` : ''}`
    : 'Farm Alert';

  const title = animal ? `farmDB Alert · ${subject}` : `farmDB · ${alert.title}`;
  const body = animal
    ? `${alert.title}${alert.description ? ` — ${alert.description}` : ''}`
    : alert.description || `Scheduled for ${alert.triggerDate}`;

  return { title, body };
}
