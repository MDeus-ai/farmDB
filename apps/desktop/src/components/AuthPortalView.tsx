import { useMemo, useState } from 'react';
import {
  buildStandardUserPermissions,
  DEFAULT_FARM_SETTINGS,
  FARM_ACCOUNT_ROLES,
  formatAccountRoleLabel,
  formatAccountStatusLabel,
  formatAccountTierLabel,
  isAdminAccount,
  type FarmAccount,
  type FarmAccountAvatar,
  type FarmAccountRole,
} from '@farmdb/core';
import {
  useActiveFarmAccount,
  useCreateFarmAccount,
  useFarmAccountList,
  useFarmSettings,
  useJoinFarmNetwork,
  useSwitchFarmAccount,
  useTriggerCloudSync,
  useUpdateFarmAccount,
  useUpdateFarmSettings,
} from '@farmdb/db';
import { APP_ICONS } from '../assets/icons';
import { FileTabs } from './FileTabs';
import { ModernSelect } from './ModernSelect';

type PortalTab = 'signin' | 'signup' | 'connect_key';
type SignupMode = 'user_account' | 'admin_account';

interface AuthPortalViewProps {
  onSuccessEnterApp?: () => void;
  onCancelToApp?: () => void;
  canCancel?: boolean;
}

function getAvatarIcon(avatar: FarmAccountAvatar): string {
  switch (avatar) {
    case 'farmerFemale':
      return APP_ICONS.farmerFemale;
    case 'peasant':
      return APP_ICONS.peasant;
    case 'staff':
      return APP_ICONS.staff;
    case 'farmer':
    default:
      return APP_ICONS.farmer;
  }
}

export function AuthPortalView({
  onSuccessEnterApp,
  onCancelToApp,
  canCancel = true,
}: AuthPortalViewProps) {
  const settingsQuery = useFarmSettings();
  const settings = settingsQuery.data ?? DEFAULT_FARM_SETTINGS;
  const activeAccountQuery = useActiveFarmAccount();
  const activeAccount = activeAccountQuery.data;
  const accountsQuery = useFarmAccountList({});
  const accounts = accountsQuery.data ?? [];

  const switchMut = useSwitchFarmAccount();
  const createAccountMut = useCreateFarmAccount();
  const joinMut = useJoinFarmNetwork();
  const syncMut = useTriggerCloudSync();
  const updateSettingsMut = useUpdateFarmSettings();
  const updateAccountMut = useUpdateFarmAccount();

  const isPendingGate = activeAccount?.status === 'pending';

  const [tab, setTab] = useState<PortalTab>(
    isPendingGate ? 'signin' : 'signin'
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sign-In state
  const [selectedLoginId, setSelectedLoginId] = useState<string>(
    accounts[0]?.id ?? 'owner-admin'
  );
  const [loginPin, setLoginPin] = useState('');

  // Sign-Up state
  const [signupMode, setSignupMode] = useState<SignupMode>('user_account');
  const [sName, setSName] = useState('');
  const [sEmail, setSEmail] = useState('');
  const [sPhone, setSPhone] = useState('');
  const [sPin, setSPin] = useState('');
  const [sRole, setSRole] = useState<FarmAccountRole>('family_member');
  const [sJoinKey, setSJoinKey] = useState('');
  const [sFarmName, setSFarmName] = useState(settings.farmName);

  // Connect existing user with Key state
  const [connectAccountId, setConnectAccountId] = useState<string>(
    () => accounts.find((a) => !a.isPrimaryAdmin)?.id ?? ''
  );
  const [connectKeyInput, setConnectKeyInput] = useState('');

  const selectableNonAdminAccounts = useMemo(
    () => accounts.filter((a) => !a.isPrimaryAdmin),
    [accounts]
  );

  const selectedLoginAccount = useMemo(
    () =>
      accounts.find((a) => a.id === selectedLoginId) ??
      accounts[0] ??
      null,
    [accounts, selectedLoginId]
  );

  async function handleSignInSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLoginAccount) return;
    setErrorMsg(null);
    setNotice(null);
    try {
      const switched = await switchMut.mutateAsync({
        accountId: selectedLoginAccount.id,
        accessCode: loginPin,
      });
      setLoginPin('');
      if (switched.status === 'pending') {
        setNotice(
          `Signed in as ${switched.displayName}. Your membership is still waiting for Admin approval.`
        );
      } else {
        onSuccessEnterApp?.();
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Could not sign into account.'
      );
    }
  }

  async function handleSignUpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setNotice(null);
    try {
      if (signupMode === 'user_account') {
        const trimmedKey = sJoinKey.trim();
        const avatarKey: FarmAccountAvatar =
          sRole === 'external_owner'
            ? 'peasant'
            : sRole === 'family_member'
              ? 'farmerFemale'
              : 'farmer';

        if (trimmedKey) {
          const res = await joinMut.mutateAsync({
            joinKey: trimmedKey,
            newAccount: {
              displayName: sName,
              email: sEmail || null,
              phone: sPhone || null,
              role: sRole,
              accessCode: sPin || null,
              avatarKey,
            },
          });
          setNotice(
            `Account "${res.account.displayName}" submitted in Pending Approval state for ${res.farmName}${
              res.syncedWithCloud ? ' and synced to cloud' : ''
            }. An administrator will assign privileges and accept your request.`
          );
        } else {
          const created = await createAccountMut.mutateAsync({
            displayName: sName,
            email: sEmail || null,
            phone: sPhone || null,
            role: sRole,
            accessCode: sPin || null,
            avatarKey,
            isPrimaryAdmin: false,
            canManageNetwork: false,
            canSyncCloud: false,
            status: 'active',
            permissions: buildStandardUserPermissions(),
          });
          await switchMut.mutateAsync({
            accountId: created.id,
            accessCode: sPin || undefined,
          });
          onSuccessEnterApp?.();
        }
      } else {
        const adminAccount =
          accounts.find((a) => a.isPrimaryAdmin) ?? accounts[0];
        if (sFarmName.trim()) {
          await updateSettingsMut.mutateAsync({
            farmName: sFarmName.trim(),
            activeAccountId: adminAccount?.id ?? 'owner-admin',
          });
        }
        if (adminAccount) {
          await updateAccountMut.mutateAsync({
            id: adminAccount.id,
            input: {
              displayName: sName.trim() || adminAccount.displayName,
              email: sEmail || null,
              phone: sPhone || null,
              accessCode: sPin || null,
            },
          });
        }
        onSuccessEnterApp?.();
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Sign up failed.');
    }
  }

  async function handleConnectExistingWithKey(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setNotice(null);
    try {
      if (!connectAccountId) {
        setErrorMsg('Select a non-admin account to connect, or use the Sign Up tab.');
        return;
      }
      const res = await joinMut.mutateAsync({
        joinKey: connectKeyInput,
        accountId: connectAccountId,
      });
      setNotice(
        `${res.account.displayName} is now Pending Approval in ${res.farmName}.`
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to connect using key.'
      );
    }
  }

  async function handleCheckApprovalStatus() {
    setErrorMsg(null);
    setNotice(null);
    try {
      if (settings.supabaseUrl && settings.supabaseAnonKey) {
        const res = await syncMut.mutateAsync('pull');
        if (!res.ok) {
          setErrorMsg(res.message);
          return;
        }
      }
      const refreshed = await activeAccountQuery.refetch();
      if (refreshed.data?.status === 'active') {
        setNotice('Approved! Entering farm workspace...');
        onSuccessEnterApp?.();
      } else {
        setNotice(
          'Still waiting for the Farm Administrator to assign privileges and accept your request.'
        );
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to check approval status.'
      );
    }
  }

  return (
    <div className="auth-portal-backdrop">
      <div className="auth-portal-shell">
        <aside className="auth-portal-hero">
          <img src={APP_ICONS.livestockGroup} alt="" className="auth-hero-watermark" aria-hidden="true" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, position: 'relative' }}>
            <div className="auth-hero-brand">
              <div className="brand-mark">
                <img src={APP_ICONS.barn} alt="farmDB barn logo" />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.08rem', color: '#ffffff' }}>
                  farmDB
                </div>
                <div style={{ fontSize: '0.78rem', color: '#b7e4c7' }}>
                  {settings.farmName}
                </div>
              </div>
            </div>

            <span className="auth-hero-kicker">
              <img src={APP_ICONS.databaseLeaf} alt="" className="app-icon-sm" />
              Herd &amp; Homestead Identity
            </span>

            <div>
              <h1 className="auth-hero-title">
                {settings.farmName}
              </h1>
            </div>
          </div>

          <div className="auth-hero-features">
            <div className="auth-hero-feature">
              <img src={APP_ICONS.database} alt="" className="app-icon-md" />
              <div>
                <strong>Local SQLite Storage</strong>
              </div>
            </div>
            <div className="auth-hero-feature">
              <img src={APP_ICONS.networking} alt="" className="app-icon-md" />
              <div>
                <strong>Admin Join Keys</strong>
              </div>
            </div>
            <div className="auth-hero-feature">
              <img src={APP_ICONS.dataSync} alt="" className="app-icon-md" />
              <div>
                <strong>Supabase Cloud Sync</strong>
              </div>
            </div>
          </div>

          <div className="auth-hero-footer">
            <div className="auth-hero-stat">
              <strong>{accounts.length}</strong>
              <span>{accounts.length === 1 ? 'Account' : 'Accounts'} on device</span>
            </div>
            <div className="auth-hero-stat">
              <strong>
                {accounts.filter((a) => a.status === 'active').length}
              </strong>
              <span>Active members</span>
            </div>
            <div className="auth-hero-stat">
              <strong>
                {accounts.filter((a) => a.status === 'pending').length}
              </strong>
              <span>Pending approval</span>
            </div>
          </div>
        </aside>

        <section className="auth-portal-main">
          <div className="auth-portal-main-inner">
          <div className="auth-portal-brand-row">
            <div>
              <h2 style={{ margin: 0, fontSize: '1.26rem', fontWeight: 800, color: 'var(--text)' }}>
                {tab === 'signin'
                  ? 'Sign In'
                  : tab === 'signup'
                    ? 'Create Account'
                    : 'Enter Join Key'}
              </h2>
            </div>

            {canCancel && !isPendingGate && onCancelToApp && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onCancelToApp}
              >
                <img src={APP_ICONS.letterX} alt="" className="app-icon-sm" />
                Back to Dashboard
              </button>
            )}
          </div>

        {isPendingGate && activeAccount && (
          <div className="auth-pending-banner">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <img src={APP_ICONS.hourglass} alt="" className="app-icon-lg" />
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: '1.02rem' }}>
                  Pending Administrator Approval ({activeAccount.displayName})
                </strong>
                <p style={{ margin: '4px 0 0', fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                  Pending Administrator approval.
                </p>
                <div className="row-actions" style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={syncMut.isPending}
                    onClick={() => void handleCheckApprovalStatus()}
                  >
                    <img src={APP_ICONS.dataSync} alt="" className="app-icon-sm" />
                    {syncMut.isPending ? 'Checking...' : 'Check Approval Status'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      const adminAcc = accounts.find((a) => a.isPrimaryAdmin);
                      if (adminAcc) {
                        setSelectedLoginId(adminAcc.id);
                      }
                      setTab('signin');
                    }}
                  >
                    Switch to Admin / Another Account
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="notice-banner" role="alert">
            <span>{errorMsg}</span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setErrorMsg(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        {notice && (
          <div className="alert-toast-banner" role="status">
            <span>{notice}</span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setNotice(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        <FileTabs
          ariaLabel="Authentication tabs"
          surface="card"
          activeId={tab}
          onChange={(nextTab) => {
            setErrorMsg(null);
            setTab(nextTab);
          }}
          tabs={[
            {
              id: 'signin',
              label: `Sign In (${accounts.length})`,
              iconSrc: APP_ICONS.farmer,
            },
            {
              id: 'signup',
              label: 'Sign Up',
              iconSrc: APP_ICONS.plus,
            },
            {
              id: 'connect_key',
              label: 'Enter Join Key',
              iconSrc: APP_ICONS.networking,
            },
          ]}
        />

        {tab === 'signin' ? (
          <form onSubmit={handleSignInSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="auth-accounts-grid">
              {accounts.map((acc: FarmAccount) => {
                const isSelected = selectedLoginAccount?.id === acc.id;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    className={`auth-account-tile ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => {
                      setSelectedLoginId(acc.id);
                      setLoginPin('');
                      setErrorMsg(null);
                    }}
                  >
                    <img
                      src={getAvatarIcon(acc.avatarKey)}
                      alt=""
                      className="app-icon-md"
                    />
                    <div style={{ textAlign: 'left', minWidth: 0, flex: 1 }}>
                      <strong style={{ display: 'block', fontSize: '0.92rem' }}>
                        {acc.displayName}
                      </strong>
                      <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                        {formatAccountTierLabel(acc)} · {formatAccountRoleLabel(acc.role)} · {formatAccountStatusLabel(acc.status)}
                        {!isAdminAccount(acc)
                          ? acc.canSyncCloud
                            ? ' · Network DB'
                            : ' · Local DB'
                          : ''}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedLoginAccount?.accessCode && (
              <div className="form-field">
                <label className="form-label">
                  Passcode / PIN for {selectedLoginAccount.displayName}
                </label>
                <input
                  className="input"
                  type="password"
                  value={loginPin}
                  onChange={(e) => setLoginPin(e.target.value)}
                  placeholder="Enter assigned access PIN..."
                  autoFocus
                />
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={!selectedLoginAccount || switchMut.isPending}
            >
              <img src={APP_ICONS.checkmark} alt="" className="app-icon-sm" />
              {selectedLoginAccount?.status === 'pending'
                ? 'View Pending Status'
                : `Sign In as ${selectedLoginAccount?.displayName ?? 'Selected Account'}`}
            </button>
          </form>
        ) : tab === 'signup' ? (
          <form onSubmit={handleSignUpSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="segmented-group" role="group" aria-label="Account type">
              <button
                type="button"
                className={`segmented-btn ${signupMode === 'user_account' ? 'active' : ''}`}
                onClick={() => setSignupMode('user_account')}
              >
                User Account
              </button>
              <button
                type="button"
                className={`segmented-btn ${signupMode === 'admin_account' ? 'active' : ''}`}
                onClick={() => setSignupMode('admin_account')}
              >
                Admin Account
              </button>
            </div>

            <div className="form-grid">
              <div className="form-field">
                <label className="form-label">Full Name *</label>
                <input
                  className="input"
                  value={sName}
                  onChange={(e) => setSName(e.target.value)}
                  placeholder="e.g. Sarah Namono"
                  required
                />
              </div>
              {signupMode === 'user_account' ? (
                <div className="form-field">
                  <label className="form-label">Account Role</label>
                  <ModernSelect
                    fullWidth
                    value={sRole}
                    options={FARM_ACCOUNT_ROLES.filter((r) => r !== 'admin').map(
                      (r) => ({
                        value: r,
                        label: formatAccountRoleLabel(r),
                        iconSrc: APP_ICONS.networking,
                      })
                    )}
                    onChange={setSRole}
                  />
                </div>
              ) : (
                <div className="form-field">
                  <label className="form-label">Farm / Homestead Name *</label>
                  <input
                    className="input"
                    value={sFarmName}
                    onChange={(e) => setSFarmName(e.target.value)}
                    placeholder="farmDB Homestead"
                  />
                </div>
              )}
              <div className="form-field">
                <label className="form-label">Email</label>
                <input
                  className="input"
                  value={sEmail}
                  onChange={(e) => setSEmail(e.target.value)}
                  placeholder="Optional email address"
                />
              </div>
              <div className="form-field">
                <label className="form-label">Phone</label>
                <input
                  className="input"
                  value={sPhone}
                  onChange={(e) => setSPhone(e.target.value)}
                  placeholder="Optional contact number"
                />
              </div>
              <div className="form-field">
                <label className="form-label">Password / Switch PIN</label>
                <input
                  className="input"
                  type="password"
                  value={sPin}
                  onChange={(e) => setSPin(e.target.value)}
                  placeholder="Optional 4+ digit PIN"
                />
              </div>
              {signupMode === 'user_account' && (
                <div className="form-field full">
                  <label className="form-label">
                    Admin&apos;s Network Join Key (Optional — leave blank to use Local DB only)
                  </label>
                  <input
                    className="input"
                    value={sJoinKey}
                    onChange={(e) => setSJoinKey(e.target.value)}
                    placeholder="Leave blank for standalone local User Account, or paste FARM-XXXX / FDB1:..."
                  />
                </div>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={
                joinMut.isPending ||
                createAccountMut.isPending ||
                updateSettingsMut.isPending
              }
            >
              <img src={APP_ICONS.plus} alt="" className="app-icon-sm" />
              {signupMode === 'user_account'
                ? sJoinKey.trim()
                  ? 'Sign Up & Request Admin Network Approval'
                  : 'Create Local User Account & Enter'
                : 'Save Admin Account & Enter Farm'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleConnectExistingWithKey} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-field">
              <label className="form-label">Existing Non-Admin Account</label>
              <ModernSelect
                fullWidth
                value={connectAccountId}
                options={
                  selectableNonAdminAccounts.length > 0
                    ? selectableNonAdminAccounts.map((acc) => ({
                        value: acc.id,
                        label: acc.displayName,
                        hint: formatAccountRoleLabel(acc.role),
                        iconSrc: getAvatarIcon(acc.avatarKey),
                      }))
                    : [
                        {
                          value: '',
                          label: 'No secondary account yet — use Sign Up tab',
                          iconSrc: APP_ICONS.farmer,
                        },
                      ]
                }
                onChange={setConnectAccountId}
              />
            </div>
            <div className="form-field">
              <label className="form-label">Admin&apos;s Network Join Key *</label>
              <input
                className="input"
                value={connectKeyInput}
                onChange={(e) => setConnectKeyInput(e.target.value)}
                placeholder="Paste FARM-XXXX or FDB1:... Join Key"
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!connectAccountId || joinMut.isPending}
            >
              <img src={APP_ICONS.networking} alt="" className="app-icon-sm" />
              Connect to Admin&apos;s Database (Pending Review)
            </button>
          </form>
        )}
          </div>
        </section>
      </div>
    </div>
  );
}
