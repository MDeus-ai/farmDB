import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ADMIN_ACCOUNT,
  FARMDB_TUTORIAL_STEPS,
  getTutorialStepsForAccount,
  type FarmAccount,
} from '../src/index';

describe('@farmdb/core tutorial steps', () => {
  it('provides non-empty simple explanations for all major farm modules', () => {
    expect(FARMDB_TUTORIAL_STEPS.length).toBeGreaterThanOrEqual(12);
    for (const step of FARMDB_TUTORIAL_STEPS) {
      expect(step.title.trim().length).toBeGreaterThan(3);
      expect(step.summary.trim().length).toBeGreaterThan(15);
      expect(step.cardsAndFeatures.length).toBeGreaterThan(0);
      expect(step.howToSteps.length).toBeGreaterThan(0);
    }
  });

  it('filters admin-only tutorial chapters for standard user accounts', () => {
    const adminSteps = getTutorialStepsForAccount(DEFAULT_ADMIN_ACCOUNT);
    expect(adminSteps.some((s) => s.id === 'network')).toBe(true);

    const standardUser: FarmAccount = {
      ...DEFAULT_ADMIN_ACCOUNT,
      id: 'user-1',
      displayName: 'Standard User',
      role: 'staff_viewer',
      isPrimaryAdmin: false,
      canManageNetwork: false,
      canSyncCloud: false,
    };

    const userSteps = getTutorialStepsForAccount(standardUser);
    expect(userSteps.some((s) => s.id === 'network')).toBe(false);
    expect(userSteps.some((s) => s.id === 'backup')).toBe(true);
    expect(userSteps.some((s) => s.id === 'statistics')).toBe(true);
  });
});
