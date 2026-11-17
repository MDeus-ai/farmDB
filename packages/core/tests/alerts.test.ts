import { describe, expect, it } from 'vitest';
import {
  formatAlertNotificationContent,
  getAlertUrgency,
  isAlertDueForNotification,
  validateNewAlert,
  validateNewMedicalRecord,
  type AlertItem,
  type Livestock,
} from '../src/index';

describe('@farmdb/core phase 4 medical & alerts', () => {
  it('validates medical records and alert/note inputs', () => {
    const validMed = validateNewMedicalRecord(
      {
        livestockId: 'c1',
        date: '2026-11-16',
        condition: ' Mastitis ',
        treatment: ' Intramammary antibiotic ',
        cost: 42.555,
        veterinarian: ' Dr. Kim ',
      },
      { todayIso: '2026-11-17' }
    );
    expect(validMed.ok).toBe(true);
    expect(validMed.data).toEqual({
      livestockId: 'c1',
      date: '2026-11-16',
      condition: 'Mastitis',
      treatment: 'Intramammary antibiotic',
      cost: 42.56,
      veterinarian: 'Dr. Kim',
    });

    const badMed = validateNewMedicalRecord(
      {
        livestockId: '',
        date: '2026-11-20',
        condition: '',
        treatment: '',
        cost: -5,
      },
      { todayIso: '2026-11-17' }
    );
    expect(badMed.ok).toBe(false);
    expect(badMed.errors.livestockId).toBeDefined();
    expect(badMed.errors.date).toContain('future');
    expect(badMed.errors.condition).toBeDefined();
    expect(badMed.errors.treatment).toBeDefined();
    expect(badMed.errors.cost).toBeDefined();

    const validNote = validateNewAlert(
      {
        entryKind: 'note',
        title: 'Switch pasture paddock B',
        description: 'Move milking cows tomorrow morning',
      },
      { todayIso: '2026-11-17' }
    );
    expect(validNote.ok).toBe(true);
    expect(validNote.data?.triggerDate).toBe('2026-11-17');
    expect(validNote.data?.entryKind).toBe('note');
  });

  it('determines alert urgency, notification eligibility, and formatted notification text', () => {
    const dueAlert: AlertItem = {
      id: 'a1',
      livestockId: 'c1',
      entryKind: 'alert',
      title: 'Due for vaccination',
      description: 'Annual FMD booster',
      triggerDate: '2026-11-17',
      isResolved: false,
      notifiedAt: null,
      createdAt: 1,
      updatedAt: 1,
    };

    const cow: Livestock = {
      id: 'c1',
      species: 'cow',
      tagNumber: 'COW-402',
      name: 'Bessie',
      breed: 'Holstein',
      dob: '2022-05-10',
      imageUri: null,
      sireId: null,
      damId: null,
      status: 'active',
      createdAt: 1,
      updatedAt: 1,
    };

    expect(getAlertUrgency(dueAlert, '2026-11-17')).toBe('due_today');
    expect(getAlertUrgency(dueAlert, '2026-11-18')).toBe('overdue');
    expect(isAlertDueForNotification(dueAlert, '2026-11-17')).toBe(true);
    expect(
      isAlertDueForNotification({ ...dueAlert, notifiedAt: 12345 }, '2026-11-17')
    ).toBe(false);
    expect(
      isAlertDueForNotification({ ...dueAlert, entryKind: 'note' }, '2026-11-17')
    ).toBe(false);
    expect(
      isAlertDueForNotification(
        { ...dueAlert, triggerDate: '2026-11-20' },
        '2026-11-17'
      )
    ).toBe(false);

    const formatted = formatAlertNotificationContent(dueAlert, cow);
    expect(formatted.title).toBe('farmDB Alert · Cow #COW-402 (Bessie)');
    expect(formatted.body).toBe('Due for vaccination — Annual FMD booster');
  });
});
