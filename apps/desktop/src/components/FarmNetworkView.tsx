import { useMemo, useState } from 'react';
import {
  buildAllModulePermissions,
  DEFAULT_FARM_SETTINGS,
  encodeFarmNetworkJoinKey,
  FARM_ACCOUNT_AVATARS,
  FARM_ACCOUNT_ROLES,
  FARM_ACCOUNT_STATUSES,
  FARM_MODULE_ACCESS_LEVELS,
  FARM_PERMISSION_MODULES,
  formatAccessLevelLabel,
  formatAccountRoleLabel,
  formatAccountStatusLabel,
  formatPermissionModuleLabel,
  getDefaultPermissionsForRole,
  type FarmAccount,
  type FarmAccountAvatar,
  type FarmAccountPermissions,
  type FarmAccountRole,
  type FarmAccountStatus,
  type FarmModuleAccessLevel,
  type FarmPermissionModule,
} from '@farmdb/core';
import {
  useAcceptPendingAccount,
  useActiveFarmAccount,
  useDeleteFarmAccount,
  useFarmAccountList,
  useFarmSettings,
  useJoinFarmNetwork,
  useRotateNetworkJoinKey,
  useUpdateFarmAccount,
} from '@farmdb/db';
import { APP_ICONS } from '../assets/icons';
import { ModernSelect } from './ModernSelect';

interface FarmNetworkViewProps {
  onSignOut?: () => void;
}

function getAvatarIconSrc(avatar: FarmAccountAvatar): string {
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

export function FarmNetworkView({ onSignOut }: FarmNetworkViewProps) {
  const settingsQuery = useFarmSettings();
  const settings = settingsQuery.data ?? DEFAULT_FARM_SETTINGS;

  const accountsQuery = useFarmAccountList({});
  const activeAccountQuery = useActiveFarmAccount();

  const updateAccountMut = useUpdateFarmAccount();
  const deleteAccountMut = useDeleteFarmAccount();
  const rotateKeyMut = useRotateNetworkJoinKey();
  const acceptPendingMut = useAcceptPendingAccount();
  const joinNetworkMut = useJoinFarmNetwork();

  const accounts = accountsQuery.data ?? [];
  const activeAccount = activeAccountQuery.data;
  const isAdminOrManager = Boolean(
    activeAccount?.isPrimaryAdmin || activeAccount?.role === 'admin'
  );

  const pendingAccounts = useMemo(
    () => accounts.filter((a) => a.status === 'pending'),
    [accounts]
  );

  const fullJoinKey = useMemo(
    () =>
      encodeFarmNetworkJoinKey({
        joinCode: settings.networkJoinKey,
        workspaceId: settings.cloudWorkspaceId,
        farmName: settings.farmName,
        supabaseUrl: settings.supabaseUrl,
        supabaseAnonKey: settings.supabaseAnonKey,
      }),
    [
      settings.networkJoinKey,
      settings.cloudWorkspaceId,
      settings.farmName,
      settings.supabaseUrl,
      settings.supabaseAnonKey,
    ]
  );

  const hasCloudKey =
    settings.supabaseUrl.trim().length > 0 &&
    settings.supabaseAnonKey.trim().length > 0;

  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Join Network via Key state (user or admin accounts)
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [joinKeyInput, setJoinKeyInput] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  // Change Password / PIN state
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Add/Edit/Approve Account Modal
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FarmAccount | null>(null);
  const [approvingMode, setApprovingMode] = useState(false);
  const [aName, setAName] = useState('');
  const [aRole, setARole] = useState<FarmAccountRole>('family_member');
  const [aRelationship, setARelationship] = useState('');
  const [aEmail, setAEmail] = useState('');
  const [aPhone, setAPhone] = useState('');
  const [aAvatar, setAAvatar] = useState<FarmAccountAvatar>('farmer');
  const [aAccessCode, setAAccessCode] = useState('');
  const [aStatus, setAStatus] = useState<FarmAccountStatus>('active');
  const [aCanSyncCloud, setACanSyncCloud] = useState(true);
  const [aPermissions, setAPermissions] = useState<FarmAccountPermissions>(
    () => getDefaultPermissionsForRole('family_member')
  );
  const [aError, setAError] = useState<string | null>(null);

  function openEditAccountModal(acc: FarmAccount, approvePending = false) {
    setEditingAccount(acc);
    setApprovingMode(approvePending);
    setAName(acc.displayName);
    setARole(acc.role);
    setARelationship(acc.relationship ?? '');
    setAEmail(acc.email ?? '');
    setAPhone(acc.phone ?? '');
    setAAvatar(acc.avatarKey);
    setAAccessCode(
      acc.id === activeAccount?.id ? (acc.accessCode ?? '') : ''
    );
    setAStatus(approvePending ? 'active' : acc.status);
    setACanSyncCloud(acc.canSyncCloud);
    setAPermissions({ ...acc.permissions });
    setAError(null);
    setAccountModalOpen(true);
  }

  async function handleSaveAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!editingAccount) return;
    setAError(null);
    const enforcedPermissions: FarmAccountPermissions = aPermissions;
    const isAdminEditingOtherExistingWithPin = Boolean(
      editingAccount.id !== activeAccount?.id &&
        editingAccount.accessCode &&
        editingAccount.accessCode.trim().length > 0
    );
    try {
      if (approvingMode) {
        await acceptPendingMut.mutateAsync({
          accountId: editingAccount.id,
          options: {
            role: aRole,
            permissions: enforcedPermissions,
            canManageNetwork: false,
            canSyncCloud: aCanSyncCloud,
          },
        });
        setStatusNotice(
          `Assigned privileges and accepted ${editingAccount.displayName} into ${settings.farmName}.`
        );
      } else {
        await updateAccountMut.mutateAsync({
          id: editingAccount.id,
          input: {
            displayName: aName,
            role: aRole,
            relationship: aRelationship || null,
            email: aEmail || null,
            phone: aPhone || null,
            avatarKey: aAvatar,
            ...(isAdminEditingOtherExistingWithPin
              ? {}
              : { accessCode: aAccessCode || null }),
            status: aStatus,
            canManageNetwork: Boolean(editingAccount.isPrimaryAdmin),
            canSyncCloud: aCanSyncCloud,
            permissions: enforcedPermissions,
          },
        });
        setStatusNotice(`Updated privileges and profile for ${aName}.`);
      }
      setAccountModalOpen(false);
    } catch (err) {
      setAError(
        err instanceof Error ? err.message : 'Unable to save farm network account.'
      );
    }
  }

  async function handleDeclinePending(acc: FarmAccount) {
    setErrorNotice(null);
    try {
      await deleteAccountMut.mutateAsync(acc.id);
      setStatusNotice(`Declined join request from ${acc.displayName}.`);
    } catch (err) {
      setErrorNotice(
        err instanceof Error ? err.message : 'Unable to decline join request.'
      );
    }
  }

  async function handleQuickAcceptPending(acc: FarmAccount) {
    setErrorNotice(null);
    try {
      await acceptPendingMut.mutateAsync({
        accountId: acc.id,
        options: {
          role: acc.role,
          permissions: acc.permissions,
        },
      });
      setStatusNotice(
        `Accepted ${acc.displayName} into the Farm Network with ${formatAccountRoleLabel(acc.role)} privileges.`
      );
    } catch (err) {
      setErrorNotice(
        err instanceof Error ? err.message : 'Unable to accept account.'
      );
    }
  }

  async function handleJoinNetworkSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeAccount) return;
    setJoinError(null);
    setErrorNotice(null);
    const trimmed = joinKeyInput.trim();
    if (!trimmed) {
      setJoinError('Enter a Farm Network Join Key (FARM-XXXX or FDB1:...).');
      return;
    }
    try {
      const res = await joinNetworkMut.mutateAsync({
        joinKey: trimmed,
        accountId: activeAccount.id,
      });
      setJoinKeyInput('');
      setJoinModalOpen(false);
      setStatusNotice(
        isAdminOrManager
          ? `Connected ${activeAccount.displayName} to Farm Network "${res.farmName}"${res.syncedWithCloud ? ' (cloud sync linked)' : ''}.`
          : `Joined Farm Network "${res.farmName}"${res.syncedWithCloud ? ' and synced with cloud' : ''}. Your membership request is now waiting for Admin approval.`
      );
    } catch (err) {
      setJoinError(
        err instanceof Error ? err.message : 'Unable to join Farm Network with that key.'
      );
    }
  }

  async function handleChangePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeAccount) return;
    setPasswordError(null);
    setErrorNotice(null);
    const hasExistingPin = Boolean(
      activeAccount.accessCode && activeAccount.accessCode.trim().length > 0
    );
    if (hasExistingPin && currentPinInput !== activeAccount.accessCode) {
      setPasswordError('Current password / PIN does not match your account.');
      return;
    }
    const nextPin = newPinInput.trim();
    if (nextPin.length < 4 || nextPin.length > 32) {
      setPasswordError('New password / PIN must be between 4 and 32 characters.');
      return;
    }
    if (nextPin !== confirmPinInput.trim()) {
      setPasswordError('New password / PIN and confirmation do not match.');
      return;
    }
    try {
      await updateAccountMut.mutateAsync({
        id: activeAccount.id,
        input: { accessCode: nextPin },
      });
      setCurrentPinInput('');
      setNewPinInput('');
      setConfirmPinInput('');
      setPasswordModalOpen(false);
      setStatusNotice(`Updated login password / PIN for ${activeAccount.displayName}.`);
    } catch (err) {
      setPasswordError(
        err instanceof Error ? err.message : 'Unable to update password / PIN.'
      );
    }
  }

  async function handleDeleteAccount(acc: FarmAccount) {
    const mustConfirm =
      settings.confirmBeforeDelete ||
      acc.id === activeAccount?.id ||
      acc.isPrimaryAdmin ||
      acc.role === 'admin';
    if (mustConfirm && confirmDeleteId !== acc.id) {
      setConfirmDeleteId(acc.id);
      return;
    }
    setConfirmDeleteId(null);
    setErrorNotice(null);
    const deletingSelf = activeAccount?.id === acc.id;
    try {
      await deleteAccountMut.mutateAsync(acc.id);
      if (deletingSelf) {
        onSignOut?.();
      } else {
        setStatusNotice(`Deleted account ${acc.displayName}.`);
      }
    } catch (err) {
      setErrorNotice(
        err instanceof Error ? err.message : 'Cannot remove account.'
      );
    }
  }

  async function handleRotateKey() {
    setErrorNotice(null);
    try {
      const next = await rotateKeyMut.mutateAsync();
      setStatusNotice(
        `Generated new Farm Network Join Key (${next}). Previous keys are now revoked.`
      );
    } catch (err) {
      setErrorNotice(
        err instanceof Error ? err.message : 'Unable to generate join key.'
      );
    }
  }

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="family-hero-icon">
            <img src={APP_ICONS.networking} alt="" className="app-icon-lg" />
          </div>
          <div>
            <h1 className="page-title">Farm Network &amp; Access Control</h1>
          </div>
        </div>

        <div className="row-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setJoinKeyInput('');
              setJoinError(null);
              setJoinModalOpen(true);
            }}
          >
            <img src={APP_ICONS.networking} alt="" className="app-icon-sm" />
            Join Network
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setCurrentPinInput('');
              setNewPinInput('');
              setConfirmPinInput('');
              setPasswordError(null);
              setPasswordModalOpen(true);
            }}
          >
            <img src={APP_ICONS.settings} alt="" className="app-icon-sm" />
            Change Password
          </button>
          {onSignOut && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onSignOut}
            >
              <img src={APP_ICONS.farmer} alt="" className="app-icon-sm" />
              Sign Out
            </button>
          )}
        </div>
      </div>

      {/* Active Session Banner */}
      <div className="network-active-strip">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img
            src={
              activeAccount
                ? getAvatarIconSrc(activeAccount.avatarKey)
                : APP_ICONS.farmer
            }
            alt=""
            style={{ width: 40, height: 40, objectFit: 'contain' }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <strong>
                Signed in as {activeAccount?.displayName ?? settings.farmName}
              </strong>
              <span className="status-pill status-active">
                {activeAccount
                  ? formatAccountRoleLabel(activeAccount.role)
                  : 'Admin'}
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {isAdminOrManager
                ? 'Administrator privileges active — generate Join Keys, assign permissions, and approve new users.'
                : 'Connected member session — access reflects the privileges granted by your Farm Administrator.'}
            </div>
          </div>
        </div>
      </div>

      {errorNotice && (
        <div className="notice-banner" role="alert">
          <span>{errorNotice}</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setErrorNotice(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {statusNotice && (
        <div className="alert-toast-banner" role="status">
          <span>{statusNotice}</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setStatusNotice(null)}
          >
            <img src={APP_ICONS.letterX} alt="" className="app-icon-sm" />
            Dismiss
          </button>
        </div>
      )}

      {/* Admin Join Key Card */}
      {isAdminOrManager && (
        <div className="card network-join-key-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h2 className="card-section-title" style={{ marginBottom: 4 }}>
                Admin Network Join Key
              </h2>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Share your Full Cloud Key (FDB1:...) for another phone or PC, or Short Code (FARM-XXXX) on this device. Members who join will appear under Pending Network Requests so you can assign privileges before letting them in.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={rotateKeyMut.isPending}
              onClick={() => void handleRotateKey()}
            >
              <img src={APP_ICONS.sync} alt="" className="app-icon-sm" />
              {rotateKeyMut.isPending ? 'Generating...' : 'Generate New Key'}
            </button>
          </div>

          <div className="join-key-boxes">
            <div className="join-key-box">
              <span className="hr-sub-label">Same-Device / Short Code</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <code className="join-code-display">{settings.networkJoinKey}</code>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    void navigator.clipboard?.writeText(settings.networkJoinKey);
                    setStatusNotice('Copied short Farm Join Code to clipboard.');
                  }}
                >
                  Copy Code
                </button>
              </div>
            </div>

            <div className="join-key-box" style={{ flex: 2 }}>
              <span className="hr-sub-label">
                Full Cloud Key (Member Join Key &amp; Cross-Device Admin Sign-In)
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <input
                  readOnly
                  className="input"
                  value={hasCloudKey ? fullJoinKey : 'Cloud sync not configured'}
                  style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem' }}
                />
                {hasCloudKey && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      void navigator.clipboard?.writeText(fullJoinKey);
                      setStatusNotice(
                        'Copied Full Cloud Key! Share it with a team member to join from Farm Network -> Join Network, or use it to sign into your Admin cloud workspace on another device.'
                      );
                    }}
                  >
                    Copy Cloud Key
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pending Join Requests awaiting Admin privileges & acceptance */}
      {isAdminOrManager && pendingAccounts.length > 0 && (
        <div className="card pending-requests-card" role="region" aria-label="Pending join requests">
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
            <img src={APP_ICONS.hourglass} alt="" className="app-icon-md" />
            <div>
              <h2 className="card-section-title" style={{ margin: 0 }}>
                Pending Network Requests ({pendingAccounts.length})
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pendingAccounts.map((acc) => (
              <div key={acc.id} className="pending-request-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                  <img
                    src={getAvatarIconSrc(acc.avatarKey)}
                    alt=""
                    className="app-icon-md"
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <strong>{acc.displayName}</strong>
                      <span className="status-pill status-sold">
                        Pending Approval
                      </span>
                      <span className="tag-chip">
                        Requested: {formatAccountRoleLabel(acc.role)}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      {acc.email ?? 'No email'} · {acc.phone ?? 'No phone'}
                      {acc.relationship ? ` · ${acc.relationship}` : ''}
                    </div>
                  </div>
                </div>

                <div className="row-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => openEditAccountModal(acc, true)}
                  >
                    Assign Privileges &amp; Accept
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={acceptPendingMut.isPending}
                    onClick={() => void handleQuickAcceptPending(acc)}
                  >
                    Quick Accept
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    disabled={deleteAccountMut.isPending}
                    onClick={() => void handleDeclinePending(acc)}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connected Accounts Directory */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <h2 className="card-section-title" style={{ margin: 0 }}>
            Connected Accounts &amp; Privileges ({accounts.length})
          </h2>
        </div>

        <div className="hr-worker-grid">
          {accounts.map((acc) => {
            const isCurrent = activeAccount?.id === acc.id;
            return (
              <div
                key={acc.id}
                className={`hr-worker-card ${isCurrent ? 'is-active-account' : ''}`}
              >
                <div className="hr-worker-head">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="hr-avatar">
                      <img
                        src={getAvatarIconSrc(acc.avatarKey)}
                        alt=""
                        className="app-icon-md"
                      />
                    </div>
                    <div>
                      <strong style={{ display: 'block', fontSize: '1rem' }}>
                        {acc.displayName}
                      </strong>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {formatAccountRoleLabel(acc.role)}
                        {acc.relationship ? ` · ${acc.relationship}` : ''}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`status-pill ${
                      acc.status === 'active'
                        ? 'status-active'
                        : acc.status === 'pending' || acc.status === 'invited'
                          ? 'status-sold'
                          : 'status-deceased'
                    }`}
                  >
                    {isCurrent && acc.status === 'active'
                      ? 'Signed In'
                      : formatAccountStatusLabel(acc.status)}
                  </span>
                </div>

                <div style={{ fontSize: '0.79rem', color: 'var(--text-muted)' }}>
                  {acc.email ?? 'No email'} · {acc.phone ?? 'No phone'}
                  {acc.accessCode ? ' · PIN protected' : ''}
                </div>

                <div className="perm-pills-wrap">
                  {FARM_PERMISSION_MODULES.map((mod) => {
                    const level = acc.isPrimaryAdmin
                      ? 'full'
                      : acc.permissions[mod];
                    return (
                      <span
                        key={mod}
                        className={`perm-chip perm-${level}`}
                        title={`${formatPermissionModuleLabel(mod)}: ${formatAccessLevelLabel(level)}`}
                      >
                        {mod.replace('_', ' ')}: {level}
                      </span>
                    );
                  })}
                </div>

                <div className="hr-worker-actions">
                  {isCurrent && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setCurrentPinInput('');
                        setNewPinInput('');
                        setConfirmPinInput('');
                        setPasswordError(null);
                        setPasswordModalOpen(true);
                      }}
                    >
                      Change Password
                    </button>
                  )}
                  {isAdminOrManager && acc.status === 'pending' && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => openEditAccountModal(acc, true)}
                    >
                      Approve &amp; Accept
                    </button>
                  )}
                  {isAdminOrManager && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => openEditAccountModal(acc, false)}
                    >
                      <img src={APP_ICONS.pencil} alt="" className="app-icon-sm" />
                      {acc.isPrimaryAdmin ? 'Edit Profile' : 'Edit Privileges'}
                    </button>
                  )}
                  {(isAdminOrManager || isCurrent) &&
                    (confirmDeleteId === acc.id ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          disabled={deleteAccountMut.isPending}
                          onClick={() => void handleDeleteAccount(acc)}
                        >
                          <img src={APP_ICONS.delete} alt="" className="app-icon-sm" />
                          Confirm Delete
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => void handleDeleteAccount(acc)}
                      >
                        <img src={APP_ICONS.delete} alt="" className="app-icon-sm" />
                        {!isAdminOrManager && isCurrent ? 'Delete My Account' : 'Delete'}
                      </button>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add / Edit / Approve Farm Network Account Modal */}
      {accountModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card modal-card-wide">
            <div className="modal-header">
              <h2 className="modal-title">
                {approvingMode && editingAccount
                  ? `Assign Privileges & Accept: ${editingAccount.displayName}`
                  : editingAccount
                    ? `Manage Account: ${editingAccount.displayName}`
                    : 'Manage Account'}
              </h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setAccountModalOpen(false)}
              >
                <img src={APP_ICONS.letterX} alt="" className="app-icon-sm" />
              </button>
            </div>

            <form onSubmit={handleSaveAccount}>
              <div className="form-grid">
                <div className="form-field">
                  <label className="form-label">Display Name *</label>
                  <input
                    className="input"
                    value={aName}
                    onChange={(e) => setAName(e.target.value)}
                    placeholder="e.g. Martha Mukasa"
                    autoFocus
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Relationship / Note</label>
                  <input
                    className="input"
                    value={aRelationship}
                    onChange={(e) => setARelationship(e.target.value)}
                    placeholder="e.g. Sister / Neighbor Bull Owner"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Role</label>
                  <ModernSelect
                    fullWidth
                    disabled={Boolean(editingAccount?.isPrimaryAdmin)}
                    value={aRole}
                    options={FARM_ACCOUNT_ROLES.map((r) => ({
                      value: r,
                      label: formatAccountRoleLabel(r),
                      iconSrc: APP_ICONS.networking,
                    }))}
                    onChange={(nextRole) => {
                      setARole(nextRole);
                      setAPermissions(getDefaultPermissionsForRole(nextRole));
                    }}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Avatar Icon</label>
                  <ModernSelect
                    fullWidth
                    value={aAvatar}
                    options={FARM_ACCOUNT_AVATARS.map((av) => ({
                      value: av,
                      label:
                        av === 'farmerFemale'
                          ? 'Farmer Female'
                          : av === 'peasant'
                            ? 'Partner / Owner'
                            : av === 'staff'
                              ? 'Team Icon'
                              : 'Farmer Classic',
                      iconSrc: getAvatarIconSrc(av),
                    }))}
                    onChange={setAAvatar}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Email</label>
                  <input
                    className="input"
                    value={aEmail}
                    onChange={(e) => setAEmail(e.target.value)}
                    placeholder="Optional email address"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Phone</label>
                  <input
                    className="input"
                    value={aPhone}
                    onChange={(e) => setAPhone(e.target.value)}
                    placeholder="Optional phone"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">
                    {!editingAccount && aRole !== 'admin'
                      ? 'Login PIN / Passcode *'
                      : 'Login PIN / Passcode'}
                  </label>
                  {editingAccount &&
                  editingAccount.id !== activeAccount?.id &&
                  editingAccount.accessCode ? (
                    <div
                      className="rate-preview"
                      style={{
                        padding: '8px 10px',
                        background: '#faf8f4',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      Login credentials are private to this user. Admins can update privileges or delete the account.
                    </div>
                  ) : (
                    <input
                      className="input"
                      type="password"
                      value={aAccessCode}
                      onChange={(e) => setAAccessCode(e.target.value)}
                      placeholder={
                        !editingAccount && aRole !== 'admin'
                          ? 'Required 4+ character passcode'
                          : 'Optional 4+ character passcode'
                      }
                    />
                  )}
                </div>
                <div className="form-field">
                  <label className="form-label">Account Status</label>
                  <ModernSelect
                    fullWidth
                    disabled={Boolean(editingAccount?.isPrimaryAdmin) || approvingMode}
                    value={aStatus}
                    options={FARM_ACCOUNT_STATUSES.map((st) => ({
                      value: st,
                      label: formatAccountStatusLabel(st),
                      iconSrc: APP_ICONS.checkmark,
                    }))}
                    onChange={setAStatus}
                  />
                </div>
              </div>

              {!editingAccount?.isPrimaryAdmin && (
                <>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={aCanSyncCloud}
                        onChange={(e) => setACanSyncCloud(e.target.checked)}
                      />
                      Allow syncing shared Admin cloud database (Network DB)
                    </label>
                  </div>

                  <div style={{ marginTop: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                      <strong style={{ fontSize: '0.92rem' }}>
                        Module Access &amp; Edit Privileges
                      </strong>
                      <div className="row-actions" style={{ flexWrap: 'wrap', gap: 6 }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() =>
                            setAPermissions(getDefaultPermissionsForRole(aRole))
                          }
                        >
                          Role Defaults
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() =>
                            setAPermissions(buildAllModulePermissions('full'))
                          }
                        >
                          All Full
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() =>
                            setAPermissions(buildAllModulePermissions('edit'))
                          }
                        >
                          All Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() =>
                            setAPermissions(buildAllModulePermissions('view'))
                          }
                        >
                          All View
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() =>
                            setAPermissions(buildAllModulePermissions('none'))
                          }
                        >
                          All Hidden
                        </button>
                      </div>
                    </div>

                    <div className="rbac-grid">
                      {FARM_PERMISSION_MODULES.map((mod: FarmPermissionModule) => (
                        <div key={mod} className="rbac-row">
                          <span style={{ fontWeight: 600, fontSize: '0.84rem' }}>
                            {formatPermissionModuleLabel(mod)}
                          </span>
                          <div className="segmented-group" role="group">
                            {FARM_MODULE_ACCESS_LEVELS.map(
                              (level: FarmModuleAccessLevel) => (
                                <button
                                  key={level}
                                  type="button"
                                  className={`segmented-btn ${
                                    aPermissions[mod] === level ? 'active' : ''
                                  }`}
                                  style={{ padding: '4px 9px', fontSize: '0.76rem' }}
                                  onClick={() =>
                                    setAPermissions((prev) => ({
                                      ...prev,
                                      [mod]: level,
                                    }))
                                  }
                                >
                                  {level === 'none'
                                    ? 'Hidden'
                                    : level === 'view'
                                      ? 'View'
                                      : level === 'edit'
                                        ? 'Edit'
                                        : 'Full'}
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {aError && <p className="field-error" style={{ marginTop: 10 }}>{aError}</p>}

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setAccountModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={
                    updateAccountMut.isPending ||
                    acceptPendingMut.isPending
                  }
                >
                  {approvingMode ? 'Accept & Grant Privileges' : 'Save Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Network via Key Modal */}
      {joinModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h2 className="modal-title">Join Farm Network with Key</h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setJoinModalOpen(false)}
              >
                <img src={APP_ICONS.letterX} alt="" className="app-icon-sm" />
              </button>
            </div>
            <form onSubmit={handleJoinNetworkSubmit}>
              <p style={{ margin: '0 0 12px', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                Enter the <strong>FARM-XXXX</strong> short code or full{' '}
                <strong>FDB1:...</strong> Cloud Invitation Key provided by a Farm Administrator to link{' '}
                <strong>{activeAccount?.displayName ?? 'your account'}</strong>.
              </p>
              <div className="form-field">
                <label className="form-label" htmlFor="network-join-key-input">
                  Farm Network Join Key *
                </label>
                <input
                  id="network-join-key-input"
                  className="input"
                  value={joinKeyInput}
                  onChange={(e) => setJoinKeyInput(e.target.value)}
                  placeholder="Paste FARM-XXXX or FDB1:... Join Key"
                  autoFocus
                  required
                />
              </div>
              {joinError && (
                <p className="field-error" style={{ marginTop: 8 }}>
                  {joinError}
                </p>
              )}
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setJoinModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={joinNetworkMut.isPending}
                >
                  {joinNetworkMut.isPending ? 'Connecting...' : 'Join Network'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password / PIN Modal */}
      {passwordModalOpen && activeAccount && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 className="modal-title">Change Password / PIN</h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setPasswordModalOpen(false)}
              >
                <img src={APP_ICONS.letterX} alt="" className="app-icon-sm" />
              </button>
            </div>
            <form onSubmit={handleChangePasswordSubmit}>
              <p style={{ margin: '0 0 12px', fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                Updating sign-in credentials for{' '}
                <strong>{activeAccount.displayName}</strong>.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Boolean(activeAccount.accessCode && activeAccount.accessCode.trim()) && (
                  <div className="form-field">
                    <label className="form-label" htmlFor="current-pin-input">
                      Current Password / PIN *
                    </label>
                    <input
                      id="current-pin-input"
                      className="input"
                      type="password"
                      value={currentPinInput}
                      onChange={(e) => setCurrentPinInput(e.target.value)}
                      placeholder="Enter current password / PIN"
                      autoFocus
                      required
                    />
                  </div>
                )}
                <div className="form-field">
                  <label className="form-label" htmlFor="new-pin-input">
                    New Password / PIN * (4–32 characters)
                  </label>
                  <input
                    id="new-pin-input"
                    className="input"
                    type="password"
                    value={newPinInput}
                    onChange={(e) => setNewPinInput(e.target.value)}
                    placeholder="Enter new password / PIN"
                    autoFocus={!activeAccount.accessCode}
                    required
                  />
                </div>
                <div className="form-field">
                  <label className="form-label" htmlFor="confirm-pin-input">
                    Confirm New Password / PIN *
                  </label>
                  <input
                    id="confirm-pin-input"
                    className="input"
                    type="password"
                    value={confirmPinInput}
                    onChange={(e) => setConfirmPinInput(e.target.value)}
                    placeholder="Re-enter new password / PIN"
                    required
                  />
                </div>
              </div>
              {passwordError && (
                <p className="field-error" style={{ marginTop: 8 }}>
                  {passwordError}
                </p>
              )}
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setPasswordModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={updateAccountMut.isPending}
                >
                  {updateAccountMut.isPending ? 'Saving...' : 'Save Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
