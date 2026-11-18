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

  it('documents current v1.5 workflows in the in-app guide', () => {
    const stepById = new Map(FARMDB_TUTORIAL_STEPS.map((s) => [s.id, s]));
    const welcomeText = JSON.stringify(stepById.get('welcome'));
    const livestockText = JSON.stringify(stepById.get('livestock'));
    const treeText = JSON.stringify(stepById.get('family_tree'));
    const milkText = JSON.stringify(stepById.get('production'));
    const authText = JSON.stringify(stepById.get('accounts_auth'));
    const settingsText = JSON.stringify(stepById.get('settings'));

    expect(welcomeText).toContain('Sign Out');
    expect(livestockText).toContain('Sex');
    expect(livestockText).toContain('Bull');
    expect(treeText).toContain('Simplified Graph');
    expect(treeText).toContain('family_tree');
    expect(milkText).toContain('female');
    expect(authText).not.toContain('Enter Join Key');
    expect(settingsText).toContain('Advanced Settings');
    expect(settingsText).toContain('Native SQLite Database Storage & Read-Only Protection');
    expect(settingsText).toContain('Cloud Sync & Supabase Database');
  });
});
