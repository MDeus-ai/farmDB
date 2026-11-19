import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  buildAllModulePermissions,
  encodeFarmNetworkJoinKey,
  FARM_ACCOUNT_AVATARS,
  FARM_ACCOUNT_ROLES,
  FARM_ACCOUNT_STATUSES,
  FARM_MODULE_ACCESS_LEVELS,
  FARM_PERMISSION_MODULES,
  formatAccountRoleLabel,
  formatAccountStatusLabel,
  formatPermissionModuleLabel,
  getDefaultPermissionsForRole,
  type FarmAccount,
  type FarmAccountAvatar,
  type FarmAccountPermissions,
  type FarmAccountRole,
  type FarmAccountStatus,
} from '@farmdb/core';
import {
  useAcceptPendingAccount,
  useActiveFarmAccount,
  useDeleteFarmAccount,
  useFarmAccountList,
  useJoinFarmNetwork,
  useLeaveFarmNetwork,
  useRotateNetworkJoinKey,
  useUpdateFarmAccount,
} from '@farmdb/db';
import { MOBILE_APP_ICONS } from '../assets/icons';
import { FARMDB_COLORS, FARMDB_FONTS, useUiScale } from '../theme/uiScale';
import { EmailLink, PhoneLink } from './ContactLink';
import { AppIcon, getAvatarIconName } from './FarmIcons';
import { FarmScrollView } from './FarmScrollView';
import { ModernDropdown } from './ModernDropdown';

interface FarmNetworkViewProps {
  onSignOut?: () => void;
}

export function FarmNetworkView({ onSignOut }: FarmNetworkViewProps) {
  const ui = useUiScale();
  const { settings } = ui;

  const accountsQuery = useFarmAccountList({});
  const activeAccountQuery = useActiveFarmAccount();

  const updateMut = useUpdateFarmAccount();
  const deleteMut = useDeleteFarmAccount();
  const rotateKeyMut = useRotateNetworkJoinKey();
  const acceptPendingMut = useAcceptPendingAccount();
  const joinNetworkMut = useJoinFarmNetwork();
  const leaveNetworkMut = useLeaveFarmNetwork();

  const accounts = accountsQuery.data ?? [];
  const activeAccount = activeAccountQuery.data;
  const isAdminOrManager = Boolean(
    activeAccount?.isPrimaryAdmin || activeAccount?.role === 'admin'
  );

  const pendingAccounts = useMemo(
    () => accounts.filter((a) => a.status === 'pending'),
    [accounts]
  );
  const memberAccounts = useMemo(
    () => accounts.filter((a) => a.status !== 'pending'),
    [accounts]
  );

  const hasCloudKey =
    settings.supabaseUrl.trim().length > 0 &&
    settings.supabaseAnonKey.trim().length > 0;

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

  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmLeaveNetwork, setConfirmLeaveNetwork] = useState(false);

  // Join Network modal
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinKeyInput, setJoinKeyInput] = useState('');
  const [joinErr, setJoinErr] = useState<string | null>(null);

  // Change Password / PIN modal
  const [pwdOpen, setPwdOpen] = useState(false);
  const [curPin, setCurPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pwdErr, setPwdErr] = useState<string | null>(null);

  // Account / Privilege / Approval modal
  const [accModalOpen, setAccModalOpen] = useState(false);
  const [editingAcc, setEditingAcc] = useState<FarmAccount | null>(null);
  const [approvingMode, setApprovingMode] = useState(false);
  const [aName, setAName] = useState('');
  const [aRole, setARole] = useState<FarmAccountRole>('family_member');
  const [aRel, setARel] = useState('');
  const [aEmail, setAEmail] = useState('');
  const [aPhone, setAPhone] = useState('');
  const [aAvatar, setAAvatar] = useState<FarmAccountAvatar>('farmerFemale');
  const [aPin, setAPin] = useState('');
  const [aStatus, setAStatus] = useState<FarmAccountStatus>('active');
  const [aCanSync, setACanSync] = useState(true);
  const [aPerms, setAPerms] = useState<FarmAccountPermissions>(() =>
    getDefaultPermissionsForRole('family_member')
  );
  const [aError, setAError] = useState<string | null>(null);

  function openEditAccount(acc: FarmAccount, approvePending = false) {
    setEditingAcc(acc);
    setApprovingMode(approvePending);
    setAName(acc.displayName);
    setARole(acc.role);
    setARel(acc.relationship ?? '');
    setAEmail(acc.email ?? '');
    setAPhone(acc.phone ?? '');
    setAAvatar(acc.avatarKey);
    setAPin(acc.id === activeAccount?.id ? (acc.accessCode ?? '') : '');
    setAStatus(approvePending ? 'active' : acc.status);
    setACanSync(acc.canSyncCloud);
    setAPerms({ ...acc.permissions });
    setAError(null);
    setAccModalOpen(true);
  }

  async function handleSaveAccount() {
    if (!editingAcc) return;
    setAError(null);
    const enforcedPerms: FarmAccountPermissions = aPerms;
    const isAdminEditingOtherExistingWithPin = Boolean(
      editingAcc.id !== activeAccount?.id &&
        editingAcc.accessCode &&
        editingAcc.accessCode.trim().length > 0
    );
    try {
      if (approvingMode) {
        await acceptPendingMut.mutateAsync({
          accountId: editingAcc.id,
          options: {
            role: aRole,
            permissions: enforcedPerms,
            canManageNetwork: false,
            canSyncCloud: aCanSync,
          },
        });
        setNotice(
          `Assigned privileges and accepted ${editingAcc.displayName} into ${settings.farmName}.`
        );
      } else {
        const payload = {
          displayName: aName,
          role: aRole,
          relationship: aRel || null,
          email: aEmail || null,
          phone: aPhone || null,
          avatarKey: aAvatar,
          ...(isAdminEditingOtherExistingWithPin
            ? {}
            : { accessCode: aPin || null }),
          status: aStatus,
          canManageNetwork: Boolean(editingAcc.isPrimaryAdmin),
          canSyncCloud: aCanSync,
          permissions: enforcedPerms,
        };
        await updateMut.mutateAsync({ id: editingAcc.id, input: payload });
        setNotice(`Updated account & privileges for ${aName}.`);
      }
      setAccModalOpen(false);
    } catch (err) {
      setAError(err instanceof Error ? err.message : 'Invalid account input.');
    }
  }

  async function handleDeclinePending(acc: FarmAccount) {
    try {
      await deleteMut.mutateAsync(acc.id);
      setNotice(`Declined join request from ${acc.displayName}.`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Unable to decline join request.');
    }
  }

  async function handleQuickAcceptPending(acc: FarmAccount) {
    try {
      await acceptPendingMut.mutateAsync({
        accountId: acc.id,
        options: {
          role: acc.role,
          permissions: acc.permissions,
        },
      });
      setNotice(
        `Accepted ${acc.displayName} into Farm Network with ${formatAccountRoleLabel(acc.role)} privileges.`
      );
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Unable to accept account.');
    }
  }

  async function handleJoinNetworkSubmit() {
    if (!activeAccount) return;
    setJoinErr(null);
    const trimmed = joinKeyInput.trim();
    if (!trimmed) {
      setJoinErr('Enter a Farm Network Join Key (FARM-XXXX or FDB1:...).');
      return;
    }
    try {
      const res = await joinNetworkMut.mutateAsync({
        joinKey: trimmed,
        accountId: activeAccount.id,
      });
      setJoinKeyInput('');
      setJoinOpen(false);
      setNotice(
        isAdminOrManager
          ? `Connected ${activeAccount.displayName} to Farm Network "${res.farmName}"${res.syncedWithCloud ? ' (cloud sync linked)' : ''}.`
          : `Joined Farm Network "${res.farmName}"${res.syncedWithCloud ? ' and synced with cloud' : ''}. Your membership request is now awaiting Admin approval.`
      );
    } catch (err) {
      setJoinErr(err instanceof Error ? err.message : 'Unable to join network.');
    }
  }

  async function handleChangePasswordSubmit() {
    if (!activeAccount) return;
    setPwdErr(null);
    const hasPin = Boolean(
      activeAccount.accessCode && activeAccount.accessCode.trim().length > 0
    );
    if (hasPin && curPin !== activeAccount.accessCode) {
      setPwdErr('Current password / PIN does not match.');
      return;
    }
    const nextPin = newPin.trim();
    if (nextPin.length < 4 || nextPin.length > 32) {
      setPwdErr('New password / PIN must be 4 to 32 characters.');
      return;
    }
    if (nextPin !== confirmPin.trim()) {
      setPwdErr('New password / PIN and confirmation do not match.');
      return;
    }
    try {
      await updateMut.mutateAsync({
        id: activeAccount.id,
        input: { accessCode: nextPin },
      });
      setCurPin('');
      setNewPin('');
      setConfirmPin('');
      setPwdOpen(false);
      setNotice(`Updated login password / PIN for ${activeAccount.displayName}.`);
    } catch (err) {
      setPwdErr(err instanceof Error ? err.message : 'Unable to update password.');
    }
  }

  async function handleDelete(acc: FarmAccount) {
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
    const deletingSelf = activeAccount?.id === acc.id;
    try {
      await deleteMut.mutateAsync(acc.id);
      if (deletingSelf) {
        onSignOut?.();
      } else {
        setNotice(`Deleted account ${acc.displayName}.`);
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Cannot delete account.');
    }
  }

  async function handleRotateJoinKey() {
    try {
      const next = await rotateKeyMut.mutateAsync();
      setNotice(`Generated new Admin Join Key: ${next}`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Unable to rotate key.');
    }
  }

  async function handleLeaveNetwork() {
    if (!activeAccount) return;
    try {
      const res = await leaveNetworkMut.mutateAsync(activeAccount.id);
      setConfirmLeaveNetwork(false);
      if (res.mode === 'removed_from_shared_device') {
        onSignOut?.();
      } else {
        setNotice(
          `Left ${res.leftFarmName}. Your account is now back in standalone local mode.`
        );
      }
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : 'Unable to leave Farm Network.'
      );
    }
  }

  async function copyKeyIfPossible(text: string, label: string) {
    try {
      const nav = (globalThis as { navigator?: { clipboard?: { writeText?: (v: string) => Promise<void> } } }).navigator;
      if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(text);
        setNotice(`Copied ${label} to clipboard.`);
        return;
      }
      setNotice(`Long-press and select the ${label} box to copy.`);
    } catch {
      setNotice(`Long-press the ${label} box to select & copy.`);
    }
  }

  return (
    <FarmScrollView
      dockAware
      style={styles.container}
      contentContainerStyle={{
        padding: ui.contentPadding,
        paddingBottom: ui.bottomDockReserve,
        gap: ui.space(12),
      }}
    >
      {/* Hero Card */}
      <View
        style={[
          styles.card,
          { padding: ui.space(12), borderRadius: ui.radius, gap: ui.space(10) },
        ]}
      >
        <View style={styles.heroRow}>
          <View style={styles.heroIconWrap}>
            <AppIcon name="network" size={ui.font(24)} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.heroTitle, { fontSize: ui.font(17) }]}>
              Farm Network &amp; Privileges
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <Text
                style={[styles.heroSub, { fontSize: ui.font(12), flexShrink: 1 }]}
                numberOfLines={2}
              >
                Active: {activeAccount?.displayName ?? settings.farmName}
              </Text>
              {isAdminOrManager ? (
                <View style={styles.adminPill}>
                  <Text style={[styles.adminPillText, { fontSize: ui.font(10) }]}>
                    Admin
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={[styles.actionRow, { gap: ui.space(8) }]}>
          {activeAccount && isAdminOrManager ? (
            <Pressable
              style={[styles.secondaryBtn, { minHeight: ui.chipHeight, paddingVertical: ui.space(6) }]}
              onPress={() => openEditAccount(activeAccount, false)}
            >
              <AppIcon name="edit" size={ui.font(14)} />
              <Text style={[styles.secondaryBtnText, { fontSize: ui.font(12) }]}>
                Rename / Profile
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            style={[styles.secondaryBtn, { minHeight: ui.chipHeight, paddingVertical: ui.space(6) }]}
            onPress={() => {
              setJoinKeyInput('');
              setJoinErr(null);
              setJoinOpen(true);
            }}
          >
            <AppIcon name="network" size={ui.font(14)} />
            <Text style={[styles.secondaryBtnText, { fontSize: ui.font(12) }]}>
              Join Network
            </Text>
          </Pressable>
          {activeAccount && !isAdminOrManager && Boolean(activeAccount.canSyncCloud) ? (
            confirmLeaveNetwork ? (
              <>
                <Pressable
                  style={[styles.smallDeleteBtn, { minHeight: ui.chipHeight, paddingHorizontal: ui.space(12), paddingVertical: ui.space(6) }]}
                  disabled={leaveNetworkMut.isPending}
                  onPress={() => void handleLeaveNetwork()}
                >
                  <Text style={[styles.smallDeleteText, { fontSize: ui.font(12) }]}>
                    {leaveNetworkMut.isPending ? 'Leaving...' : 'Confirm Leave'}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.secondaryBtn, { minHeight: ui.chipHeight, paddingVertical: ui.space(6) }]}
                  disabled={leaveNetworkMut.isPending}
                  onPress={() => setConfirmLeaveNetwork(false)}
                >
                  <Text style={[styles.secondaryBtnText, { fontSize: ui.font(12) }]}>
                    Cancel
                  </Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                style={[styles.smallDeleteBtn, { minHeight: ui.chipHeight, paddingHorizontal: ui.space(12), paddingVertical: ui.space(6) }]}
                onPress={() => setConfirmLeaveNetwork(true)}
              >
                <Text style={[styles.smallDeleteText, { fontSize: ui.font(12) }]}>
                  Leave Network
                </Text>
              </Pressable>
            )
          ) : null}
          <Pressable
            style={[styles.secondaryBtn, { minHeight: ui.chipHeight, paddingVertical: ui.space(6) }]}
            onPress={() => {
              setCurPin('');
              setNewPin('');
              setConfirmPin('');
              setPwdErr(null);
              setPwdOpen(true);
            }}
          >
            <AppIcon name="settings" size={ui.font(14)} />
            <Text style={[styles.secondaryBtnText, { fontSize: ui.font(12) }]}>
              Password
            </Text>
          </Pressable>
          {onSignOut ? (
            <Pressable
              style={[styles.secondaryBtn, { minHeight: ui.chipHeight, paddingVertical: ui.space(6) }]}
              onPress={onSignOut}
            >
              <AppIcon name="farmer" size={ui.font(14)} />
              <Text style={[styles.secondaryBtnText, { fontSize: ui.font(12) }]}>
                Sign Out
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {notice ? (
        <View
          style={[
            styles.noticeBanner,
            { padding: ui.space(10), borderRadius: ui.radius },
          ]}
        >
          <Text style={[styles.noticeText, { fontSize: ui.font(12) }]}>
            {notice}
          </Text>
          <Pressable onPress={() => setNotice(null)} hitSlop={8}>
            <AppIcon name="close" size={ui.font(14)} />
          </Pressable>
        </View>
      ) : null}

      {/* Admin Network Join Key Card */}
      {isAdminOrManager ? (
      <View
        style={[
          styles.card,
          { padding: ui.space(12), borderRadius: ui.radius, gap: ui.space(10) },
        ]}
      >
        <View style={[styles.rowBetween, { flexWrap: 'wrap' }]}>
          <View style={{ flex: 1, minWidth: 140 }}>
            <Text style={[styles.cardTitle, { fontSize: ui.font(14) }]}>
              Admin Network Join Key
            </Text>
          </View>
          <Pressable
            style={[styles.secondaryBtn, { minHeight: Math.max(34, ui.chipHeight - 2), paddingVertical: ui.space(4) }]}
            disabled={rotateKeyMut.isPending}
            onPress={() => void handleRotateJoinKey()}
          >
            <AppIcon name="refresh" size={ui.font(13)} />
            <Text style={[styles.secondaryBtnText, { fontSize: ui.font(11) }]}>
              New Key
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.subText, { fontSize: ui.font(11.5) }]}>
          Share your Full Cloud Key (FDB1:...) for another phone or PC, or Short Code (FARM-XXXX) on this device. You will be notified to assign privileges when someone joins.
        </Text>
        {!activeAccount?.accessCode?.trim() ? (
          <Text style={[styles.subText, { fontSize: ui.font(11), color: '#8a5300', fontFamily: FARMDB_FONTS.semibold }]}>
            Security tip: Tap Password above to set an Admin PIN so Cloud Admin Recovery stays protected.
          </Text>
        ) : null}

        <View style={styles.joinCodeBox}>
          <View style={[styles.rowBetween, { flexWrap: 'wrap' }]}>
            <Text style={[styles.label, { fontSize: ui.font(11) }]}>
              Local Join Code
            </Text>
            <Pressable
              onPress={() =>
                void copyKeyIfPossible(settings.networkJoinKey, 'Join Code')
              }
            >
              <Text style={[styles.copyLinkText, { fontSize: ui.font(11) }]}>
                Copy
              </Text>
            </Pressable>
          </View>
          <Text style={[styles.joinCodeValue, { fontSize: ui.font(16) }]} selectable>
            {settings.networkJoinKey}
          </Text>
        </View>

        {hasCloudKey ? (
          <View style={styles.joinCodeBox}>
            <View style={[styles.rowBetween, { flexWrap: 'wrap' }]}>
              <Text style={[styles.label, { fontSize: ui.font(11) }]}>
                Full Cloud Key (Member Join Key &amp; Admin Cross-Device Login)
              </Text>
              <Pressable
                onPress={() =>
                  void copyKeyIfPossible(fullJoinKey, 'Full Cloud Key')
                }
              >
                <Text style={[styles.copyLinkText, { fontSize: ui.font(11) }]}>
                  Copy
                </Text>
              </Pressable>
            </View>
            <Text
              style={[styles.cloudKeyValue, { fontSize: ui.font(10) }]}
              selectable
            >
              {fullJoinKey}
            </Text>
          </View>
        ) : null}
      </View>
      ) : null}

      {/* Pending Join Requests Card */}
      {pendingAccounts.length > 0 ? (
        <View
          style={[
            styles.pendingCard,
            { padding: ui.space(12), borderRadius: ui.radius, gap: ui.space(10) },
          ]}
        >
          <View style={[styles.rowBetween, { flexWrap: 'wrap' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <AppIcon name="hourglass" size={ui.font(18)} />
              <Text style={[styles.pendingHeading, { fontSize: ui.font(14), flexShrink: 1 }]}>
                Pending Join Requests ({pendingAccounts.length})
              </Text>
            </View>
          </View>

          {pendingAccounts.map((acc) => (
            <View key={acc.id} style={styles.pendingRowCard}>
              <View style={[styles.rowBetween, { flexWrap: 'wrap' }]}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    flex: 1,
                    minWidth: 160,
                  }}
                >
                  <AppIcon
                    name={getAvatarIconName(acc.avatarKey)}
                    size={ui.font(22)}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.cardTitle, { fontSize: ui.font(13) }]}>
                      {acc.displayName}
                    </Text>
                    <Text style={[styles.subText, { fontSize: ui.font(11) }]}>
                      Requested: {formatAccountRoleLabel(acc.role)}
                      {acc.relationship ? ` · ${acc.relationship}` : ''}
                    </Text>
                    {acc.phone || acc.email ? (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        {acc.phone ? (
                          <PhoneLink phone={acc.phone} fontSize={ui.font(11)} />
                        ) : null}
                        {acc.phone && acc.email ? (
                          <Text style={[styles.subText, { fontSize: ui.font(11) }]}>·</Text>
                        ) : null}
                        {acc.email ? (
                          <EmailLink email={acc.email} fontSize={ui.font(11)} />
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                </View>
                <Text style={[styles.pendingBadge, { fontSize: ui.font(10) }]}>
                  Pending
                </Text>
              </View>

              {isAdminOrManager ? (
                <View style={[styles.cardFooterBtns, { gap: ui.space(6), marginTop: 6 }]}>
                  <Pressable
                    style={styles.switchBtn}
                    onPress={() => openEditAccount(acc, true)}
                  >
                    <Text style={[styles.switchBtnText, { fontSize: ui.font(11) }]}>
                      Assign &amp; Accept
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.smallEditBtn}
                    disabled={acceptPendingMut.isPending}
                    onPress={() => void handleQuickAcceptPending(acc)}
                  >
                    <AppIcon name="check" size={ui.font(12)} />
                    <Text style={[styles.smallEditBtnText, { fontSize: ui.font(11) }]}>
                      Quick Accept
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.smallDeleteBtn}
                    disabled={deleteMut.isPending}
                    onPress={() => void handleDeclinePending(acc)}
                  >
                    <AppIcon name="trash" size={ui.font(12)} />
                    <Text style={[styles.smallDeleteText, { fontSize: ui.font(11) }]}>
                      Decline
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {/* Active & Connected Accounts List */}
      <View style={{ gap: ui.space(10) }}>
        {memberAccounts.map((acc) => {
          const isCurrent = activeAccount?.id === acc.id;
          return (
            <View
              key={acc.id}
              style={[
                styles.card,
                isCurrent && styles.activeAccCard,
                { padding: ui.space(12), borderRadius: ui.radius, gap: 6 },
              ]}
            >
              <View style={[styles.rowBetween, { flexWrap: 'wrap' }]}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    flex: 1,
                    minWidth: 160,
                  }}
                >
                  <AppIcon
                    name={getAvatarIconName(acc.avatarKey)}
                    size={ui.font(24)}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                      <Text style={[styles.cardTitle, { fontSize: ui.font(14) }]}>
                        {acc.displayName}
                      </Text>
                      {acc.isPrimaryAdmin || acc.role === 'admin' ? (
                        <View style={styles.adminPill}>
                          <Text style={[styles.adminPillText, { fontSize: ui.font(10) }]}>
                            Admin
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={[styles.subText, { fontSize: ui.font(11) }]}>
                      {formatAccountRoleLabel(acc.role)}
                      {acc.relationship ? ` · ${acc.relationship}` : ''}
                    </Text>
                    {acc.phone || acc.email ? (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        {acc.phone ? (
                          <PhoneLink phone={acc.phone} fontSize={ui.font(11)} />
                        ) : null}
                        {acc.phone && acc.email ? (
                          <Text style={[styles.subText, { fontSize: ui.font(11) }]}>·</Text>
                        ) : null}
                        {acc.email ? (
                          <EmailLink email={acc.email} fontSize={ui.font(11)} />
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                </View>
                <Text style={[styles.statusBadge, { fontSize: ui.font(10) }]}>
                  {isCurrent ? 'Signed In' : formatAccountStatusLabel(acc.status)}
                </Text>
              </View>

              <Text style={[styles.subText, { fontSize: ui.font(11) }]}>
                {acc.isPrimaryAdmin
                  ? 'Full Admin Privileges across all modules'
                  : `View/Edit: ${FARM_PERMISSION_MODULES.filter((m) => acc.permissions[m] !== 'none').length}/${FARM_PERMISSION_MODULES.length} modules${acc.accessCode ? ' · PIN protected' : ''}`}
              </Text>

              <View style={[styles.cardFooterBtns, { gap: ui.space(8), marginTop: 4 }]}>
                {isCurrent ? (
                  <Pressable
                    style={styles.smallEditBtn}
                    onPress={() => {
                      setCurPin('');
                      setNewPin('');
                      setConfirmPin('');
                      setPwdErr(null);
                      setPwdOpen(true);
                    }}
                  >
                    <AppIcon name="settings" size={ui.font(13)} />
                    <Text style={[styles.smallEditBtnText, { fontSize: ui.font(11) }]}>
                      Change Password
                    </Text>
                  </Pressable>
                ) : null}
                {isAdminOrManager ? (
                  <Pressable
                    style={styles.smallEditBtn}
                    onPress={() => openEditAccount(acc, false)}
                  >
                    <AppIcon name="edit" size={ui.font(13)} />
                    <Text
                      style={[styles.smallEditBtnText, { fontSize: ui.font(11) }]}
                    >
                      {acc.isPrimaryAdmin || acc.role === 'admin'
                        ? 'Edit Profile'
                        : 'Privileges'}
                    </Text>
                  </Pressable>
                ) : null}
                {isCurrent && !isAdminOrManager && Boolean(acc.canSyncCloud) ? (
                  confirmLeaveNetwork ? (
                    <>
                      <Pressable
                        style={[styles.smallDeleteBtn, { paddingHorizontal: ui.space(12) }]}
                        disabled={leaveNetworkMut.isPending}
                        onPress={() => void handleLeaveNetwork()}
                      >
                        <Text
                          style={[styles.smallDeleteText, { fontSize: ui.font(11) }]}
                        >
                          Confirm Leave
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[styles.smallEditBtn, { paddingHorizontal: ui.space(12) }]}
                        disabled={leaveNetworkMut.isPending}
                        onPress={() => setConfirmLeaveNetwork(false)}
                      >
                        <Text
                          style={[styles.smallEditBtnText, { fontSize: ui.font(11) }]}
                        >
                          Cancel
                        </Text>
                      </Pressable>
                    </>
                  ) : (
                    <Pressable
                      style={[styles.smallDeleteBtn, { paddingHorizontal: ui.space(12) }]}
                      onPress={() => setConfirmLeaveNetwork(true)}
                    >
                      <Text
                        style={[styles.smallDeleteText, { fontSize: ui.font(11) }]}
                      >
                        Leave Network
                      </Text>
                    </Pressable>
                  )
                ) : null}
                {isAdminOrManager || isCurrent ? (
                  confirmDeleteId === acc.id ? (
                    <>
                      <Pressable
                        style={[styles.smallDeleteBtn, { paddingHorizontal: ui.space(12) }]}
                        disabled={deleteMut.isPending}
                        onPress={() => void handleDelete(acc)}
                      >
                        <AppIcon name="trash" size={ui.font(13)} />
                        <Text
                          style={[styles.smallDeleteText, { fontSize: ui.font(11) }]}
                        >
                          Confirm Delete
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[styles.smallEditBtn, { paddingHorizontal: ui.space(12) }]}
                        onPress={() => setConfirmDeleteId(null)}
                      >
                        <Text
                          style={[styles.smallEditBtnText, { fontSize: ui.font(11) }]}
                        >
                          Cancel
                        </Text>
                      </Pressable>
                    </>
                  ) : (
                    <Pressable
                      style={[styles.smallDeleteBtn, { paddingHorizontal: ui.space(12) }]}
                      onPress={() => void handleDelete(acc)}
                    >
                      <AppIcon name="trash" size={ui.font(13)} />
                      <Text
                        style={[styles.smallDeleteText, { fontSize: ui.font(11) }]}
                      >
                        {!isAdminOrManager && isCurrent ? 'Delete My Account' : 'Delete'}
                      </Text>
                    </Pressable>
                  )
                ) : null}
              </View>
            </View>
          );
        })}
      </View>

      {/* Account, Privilege & Approval Modal */}
      <Modal
        visible={accModalOpen}
        animationType="slide"
        onRequestClose={() => setAccModalOpen(false)}
      >
        <SafeAreaView
          style={styles.modalSafe}
          edges={['top', 'left', 'right', 'bottom']}
        >
          <View style={[styles.modalHeader, { gap: 10 }]}>
            <Text
              style={[styles.modalTitle, { fontSize: ui.font(17), flex: 1, minWidth: 0 }]}
              numberOfLines={2}
            >
              {approvingMode
                ? 'Assign Privileges & Accept Request'
                : editingAcc &&
                    (editingAcc.isPrimaryAdmin || editingAcc.role === 'admin')
                  ? 'Edit Admin Profile'
                  : editingAcc
                    ? 'Edit Account & Privileges'
                    : 'Manage Account'}
            </Text>
            <Pressable onPress={() => setAccModalOpen(false)} hitSlop={8} style={{ flexShrink: 0 }}>
              <AppIcon name="close" size={ui.font(20)} />
            </Pressable>
          </View>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <FarmScrollView
              contentContainerStyle={{
                padding: ui.contentPadding,
                gap: ui.space(12),
              }}
            >
              <View style={styles.fieldGroup}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                    {editingAcc &&
                    (editingAcc.isPrimaryAdmin || editingAcc.role === 'admin')
                      ? 'Admin Display Name *'
                      : 'Display Name *'}
                  </Text>
                  {editingAcc &&
                  (editingAcc.isPrimaryAdmin || editingAcc.role === 'admin') ? (
                    <View style={styles.adminPill}>
                      <Text style={[styles.adminPillText, { fontSize: ui.font(10) }]}>
                        Admin
                      </Text>
                    </View>
                  ) : null}
                </View>
                <TextInput
                  style={[styles.input, { fontSize: ui.font(14) }]}
                  value={aName}
                  onChangeText={setAName}
                  editable={!approvingMode}
                  placeholder={
                    editingAcc &&
                    (editingAcc.isPrimaryAdmin || editingAcc.role === 'admin')
                      ? 'e.g. Greenfields Owner'
                      : 'e.g. Martha Mukasa'
                  }
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                  Relationship
                </Text>
                <TextInput
                  style={[styles.input, { fontSize: ui.font(14) }]}
                  value={aRel}
                  onChangeText={setARel}
                  editable={!approvingMode}
                  placeholder="e.g. Family / External Owner"
                />
              </View>

              {!editingAcc?.isPrimaryAdmin ? (
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                    Role
                  </Text>
                  <ModernDropdown
                    value={aRole}
                    options={FARM_ACCOUNT_ROLES.map((r) => ({
                      value: r,
                      label: formatAccountRoleLabel(r),
                      iconSource: MOBILE_APP_ICONS.networking,
                    }))}
                    title="Select Role"
                    onChange={(r) => {
                      setARole(r);
                      setAPerms(getDefaultPermissionsForRole(r));
                    }}
                  />
                </View>
              ) : null}

              {!approvingMode ? (
                <>
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                      Avatar
                    </Text>
                    <ModernDropdown
                      value={aAvatar}
                      options={FARM_ACCOUNT_AVATARS.map((av) => ({
                        value: av,
                        label:
                          av === 'farmerFemale'
                            ? 'Farmer Female'
                            : av === 'peasant'
                              ? 'Partner / Owner'
                              : av === 'staff'
                                ? 'Team'
                                : 'Farmer Classic',
                        iconSource:
                          av === 'farmerFemale'
                            ? MOBILE_APP_ICONS.farmerFemale
                            : av === 'peasant'
                              ? MOBILE_APP_ICONS.peasant
                              : av === 'staff'
                                ? MOBILE_APP_ICONS.staff
                                : MOBILE_APP_ICONS.farmer,
                      }))}
                      title="Avatar Icon"
                      onChange={setAAvatar}
                    />
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                      Phone
                    </Text>
                    <TextInput
                      style={[styles.input, { fontSize: ui.font(14) }]}
                      value={aPhone}
                      onChangeText={setAPhone}
                      placeholder="Optional phone"
                    />
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                      Email
                    </Text>
                    <TextInput
                      style={[styles.input, { fontSize: ui.font(14) }]}
                      value={aEmail}
                      onChangeText={setAEmail}
                      placeholder="Optional email"
                      autoCapitalize="none"
                    />
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                      {!editingAcc && aRole !== 'admin'
                        ? 'Login PIN / Passcode *'
                        : 'Login PIN / Passcode'}
                    </Text>
                    {editingAcc &&
                    editingAcc.id !== activeAccount?.id &&
                    editingAcc.accessCode ? (
                      <Text style={[styles.subText, { fontSize: ui.font(12) }]}>
                        Login credentials are private to this user. Admin can edit privileges or delete the account.
                      </Text>
                    ) : (
                      <TextInput
                        style={[styles.input, { fontSize: ui.font(14) }]}
                        secureTextEntry
                        value={aPin}
                        onChangeText={setAPin}
                        placeholder={
                          !editingAcc && aRole !== 'admin'
                            ? 'Required 4+ character PIN'
                            : 'Optional 4+ character PIN'
                        }
                      />
                    )}
                  </View>
                </>
              ) : null}

              {!editingAcc?.isPrimaryAdmin ? (
                <>
                  {!approvingMode ? (
                    <View style={styles.fieldGroup}>
                      <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                        Status
                      </Text>
                      <ModernDropdown
                        value={aStatus}
                        options={FARM_ACCOUNT_STATUSES.map((s) => ({
                          value: s,
                          label: formatAccountStatusLabel(s),
                          iconSource: MOBILE_APP_ICONS.checkmark,
                        }))}
                        title="Account Status"
                        onChange={setAStatus}
                      />
                    </View>
                  ) : null}

                  <View style={styles.switchRow}>
                    <Text style={[styles.switchLabel, { fontSize: ui.font(13) }]}>
                      Allow syncing Admin cloud database (Network DB)
                    </Text>
                    <Switch value={aCanSync} onValueChange={setACanSync} />
                  </View>

                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 6,
                      marginTop: 4,
                    }}
                  >
                    <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                      Module Privileges
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {(
                        [
                          { label: 'Role Defaults', apply: () => setAPerms(getDefaultPermissionsForRole(aRole)) },
                          { label: 'All Full', apply: () => setAPerms(buildAllModulePermissions('full')) },
                          { label: 'All Edit', apply: () => setAPerms(buildAllModulePermissions('edit')) },
                          { label: 'All View', apply: () => setAPerms(buildAllModulePermissions('view')) },
                          { label: 'All Hidden', apply: () => setAPerms(buildAllModulePermissions('none')) },
                        ] as const
                      ).map((preset) => (
                        <Pressable
                          key={preset.label}
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 999,
                            backgroundColor: FARMDB_COLORS.surfaceMuted,
                            borderWidth: 1,
                            borderColor: FARMDB_COLORS.border,
                          }}
                          onPress={preset.apply}
                        >
                          <Text
                            style={{
                              fontSize: ui.font(10.5),
                              fontFamily: FARMDB_FONTS.semibold,
                              color: FARMDB_COLORS.text,
                            }}
                          >
                            {preset.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                  <View style={{ gap: 8 }}>
                    {FARM_PERMISSION_MODULES.map((mod) => {
                      const level = aPerms[mod];
                      return (
                        <View
                          key={mod}
                          style={[styles.rbacMobRow, { flexDirection: 'column', alignItems: 'stretch', gap: 8 }]}
                        >
                          <Text
                            style={[styles.switchLabel, { fontSize: ui.font(13) }]}
                          >
                            {formatPermissionModuleLabel(mod)}
                          </Text>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {FARM_MODULE_ACCESS_LEVELS.map((lvl) => {
                              const active = level === lvl;
                              const labelText =
                                lvl === 'none'
                                  ? 'Hidden'
                                  : lvl === 'view'
                                    ? 'View'
                                    : lvl === 'edit'
                                      ? 'Edit'
                                      : 'Full';
                              return (
                                <Pressable
                                  key={lvl}
                                  style={{
                                    flexGrow: 1,
                                    minWidth: 62,
                                    minHeight: Math.max(30, ui.chipHeight - 4),
                                    paddingHorizontal: 8,
                                    paddingVertical: 5,
                                    borderRadius: 8,
                                    borderWidth: 1,
                                    borderColor: active
                                      ? FARMDB_COLORS.accent
                                      : FARMDB_COLORS.border,
                                    backgroundColor: active
                                      ? FARMDB_COLORS.accent
                                      : FARMDB_COLORS.surface,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                  onPress={() =>
                                    setAPerms((prev) => ({
                                      ...prev,
                                      [mod]: lvl,
                                    }))
                                  }
                                >
                                  <Text
                                    style={{
                                      fontSize: ui.font(11),
                                      fontFamily: active
                                        ? FARMDB_FONTS.bold
                                        : FARMDB_FONTS.semibold,
                                      color: active ? '#ffffff' : FARMDB_COLORS.text,
                                    }}
                                  >
                                    {labelText}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </>
              ) : null}

              {aError ? <Text style={styles.errorText}>{aError}</Text> : null}

              <Pressable
                style={[styles.submitBtn, { minHeight: ui.controlHeight, paddingHorizontal: ui.space(14), paddingVertical: ui.space(8) }]}
                onPress={() => void handleSaveAccount()}
                disabled={
                  updateMut.isPending ||
                  acceptPendingMut.isPending
                }
              >
                <Text style={[styles.submitBtnText, { fontSize: ui.font(14), textAlign: 'center' }]}>
                  {approvingMode
                    ? 'Accept User & Grant Privileges'
                    : 'Save Account'}
                </Text>
              </Pressable>
            </FarmScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Join Network via Key Modal */}
      <Modal
        visible={joinOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setJoinOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.pinOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.pinDialog}>
            <Text style={[styles.cardTitle, { fontSize: ui.font(16) }]}>
              Join Farm Network with Key
            </Text>
            <Text style={[styles.subText, { fontSize: ui.font(12) }]}>
              Paste a FARM-XXXX or FDB1:... Join Key to connect{' '}
              {activeAccount?.displayName ?? 'your account'}.
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  minHeight: Math.max(ui.controlHeight * 1.8, 72),
                  fontSize: ui.font(13),
                  textAlignVertical: 'top',
                },
              ]}
              multiline
              numberOfLines={3}
              value={joinKeyInput}
              onChangeText={setJoinKeyInput}
              placeholder="Paste FARM-XXXX or FDB1:..."
              autoCapitalize="none"
            />
            {joinErr ? <Text style={[styles.errorText, { fontSize: ui.font(12) }]}>{joinErr}</Text> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <Pressable
                style={[styles.secondaryBtn, { flex: 1, minWidth: 104, minHeight: ui.controlHeight, paddingHorizontal: ui.space(12), paddingVertical: ui.space(6) }]}
                onPress={() => setJoinOpen(false)}
              >
                <Text style={[styles.secondaryBtnText, { fontSize: ui.font(13) }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryBtn, { flex: 1, minWidth: 104, minHeight: ui.controlHeight, paddingHorizontal: ui.space(12), paddingVertical: ui.space(6) }]}
                disabled={joinNetworkMut.isPending}
                onPress={() => void handleJoinNetworkSubmit()}
              >
                <Text style={[styles.primaryBtnText, { fontSize: ui.font(13) }]}>
                  {joinNetworkMut.isPending ? 'Joining...' : 'Join'}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Change Password / PIN Modal */}
      <Modal
        visible={pwdOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPwdOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.pinOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.pinDialog}>
            <Text style={[styles.cardTitle, { fontSize: ui.font(16) }]}>
              Change Password / PIN
            </Text>
            <Text style={[styles.subText, { fontSize: ui.font(12) }]}>
              Updating credentials for {activeAccount?.displayName ?? 'Account'}
            </Text>
            {Boolean(activeAccount?.accessCode && activeAccount.accessCode.trim()) ? (
              <TextInput
                style={[styles.input, { minHeight: ui.controlHeight, fontSize: ui.font(14) }]}
                secureTextEntry
                value={curPin}
                onChangeText={setCurPin}
                placeholder="Current Password / PIN"
              />
            ) : null}
            <TextInput
              style={[styles.input, { minHeight: ui.controlHeight, fontSize: ui.font(14) }]}
              secureTextEntry
              value={newPin}
              onChangeText={setNewPin}
              placeholder="New Password / PIN (4+ chars)"
            />
            <TextInput
              style={[styles.input, { minHeight: ui.controlHeight, fontSize: ui.font(14) }]}
              secureTextEntry
              value={confirmPin}
              onChangeText={setConfirmPin}
              placeholder="Confirm New Password / PIN"
            />
            {pwdErr ? <Text style={[styles.errorText, { fontSize: ui.font(12) }]}>{pwdErr}</Text> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <Pressable
                style={[styles.secondaryBtn, { flex: 1, minWidth: 104, minHeight: ui.controlHeight }]}
                onPress={() => setPwdOpen(false)}
              >
                <Text style={[styles.secondaryBtnText, { fontSize: ui.font(13) }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryBtn, { flex: 1, minWidth: 104, minHeight: ui.controlHeight }]}
                disabled={updateMut.isPending}
                onPress={() => void handleChangePasswordSubmit()}
              >
                <Text style={[styles.primaryBtnText, { fontSize: ui.font(13) }]}>
                  {updateMut.isPending ? 'Saving...' : 'Save'}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </FarmScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: FARMDB_COLORS.bg },
  card: {
    backgroundColor: FARMDB_COLORS.surface,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
  },
  activeAccCard: {
    borderColor: FARMDB_COLORS.accent,
    borderWidth: 2.25,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: FARMDB_COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontFamily: FARMDB_FONTS.bold, color: FARMDB_COLORS.text },
  heroSub: { fontFamily: FARMDB_FONTS.regular, color: FARMDB_COLORS.textMuted },
  actionRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: FARMDB_COLORS.accent,
    borderRadius: 999,
    paddingHorizontal: 14,
  },
  primaryBtnText: { fontFamily: FARMDB_FONTS.semibold, color: '#ffffff' },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: FARMDB_COLORS.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
  },
  secondaryBtnText: {
    fontFamily: FARMDB_FONTS.semibold,
    color: FARMDB_COLORS.text,
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: FARMDB_COLORS.accentSoft,
    borderWidth: 1,
    borderColor: 'rgba(45, 106, 79, 0.25)',
  },
  noticeText: { flex: 1, fontFamily: FARMDB_FONTS.medium, color: '#173e2b' },
  joinCodeBox: {
    backgroundColor: '#faf8f4',
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  joinCodeValue: {
    fontFamily: FARMDB_FONTS.monoBold,
    color: FARMDB_COLORS.accent,
    letterSpacing: 1,
  },
  cloudKeyValue: {
    fontFamily: FARMDB_FONTS.mono,
    color: FARMDB_COLORS.text,
  },
  copyLinkText: {
    fontFamily: FARMDB_FONTS.bold,
    color: FARMDB_COLORS.accent,
  },
  pendingCard: {
    backgroundColor: FARMDB_COLORS.warnBg,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.warnBorder,
  },
  pendingHeading: {
    fontFamily: FARMDB_FONTS.bold,
    color: FARMDB_COLORS.warnText,
  },
  pendingRowCard: {
    backgroundColor: FARMDB_COLORS.surface,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.warnBorder,
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  pendingBadge: {
    fontFamily: FARMDB_FONTS.bold,
    backgroundColor: FARMDB_COLORS.warnBg,
    color: FARMDB_COLORS.warnText,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: { fontFamily: FARMDB_FONTS.bold, color: FARMDB_COLORS.text },
  adminPill: {
    backgroundColor: FARMDB_COLORS.accentSoft,
    borderWidth: 1,
    borderColor: '#a8d5be',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  adminPillText: {
    fontFamily: FARMDB_FONTS.bold,
    color: FARMDB_COLORS.accent,
  },
  subText: { fontFamily: FARMDB_FONTS.regular, color: FARMDB_COLORS.textMuted },
  statusBadge: {
    fontFamily: FARMDB_FONTS.bold,
    backgroundColor: FARMDB_COLORS.accentSoft,
    color: FARMDB_COLORS.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  cardFooterBtns: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  switchBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: FARMDB_COLORS.accent,
  },
  switchBtnText: { fontFamily: FARMDB_FONTS.bold, color: '#ffffff' },
  smallEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: FARMDB_COLORS.surfaceMuted,
  },
  smallEditBtnText: { fontFamily: FARMDB_FONTS.semibold, color: FARMDB_COLORS.text },
  smallDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: FARMDB_COLORS.dangerSoft,
  },
  smallDeleteText: { fontFamily: FARMDB_FONTS.bold, color: FARMDB_COLORS.danger },
  modalSafe: { flex: 1, backgroundColor: FARMDB_COLORS.bg },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: FARMDB_COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: FARMDB_COLORS.border,
  },
  modalTitle: { fontFamily: FARMDB_FONTS.bold, color: FARMDB_COLORS.text },
  fieldGroup: { gap: 5 },
  label: { fontFamily: FARMDB_FONTS.semibold, color: FARMDB_COLORS.textMuted },
  input: {
    backgroundColor: FARMDB_COLORS.surface,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: FARMDB_FONTS.regular,
    color: FARMDB_COLORS.text,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 4,
  },
  switchLabel: {
    flex: 1,
    fontFamily: FARMDB_FONTS.semibold,
    color: FARMDB_COLORS.text,
  },
  rbacMobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#faf8f4',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
  },
  permMobBadge: {
    fontFamily: FARMDB_FONTS.bold,
    color: FARMDB_COLORS.accent,
  },
  errorText: { fontFamily: FARMDB_FONTS.semibold, color: FARMDB_COLORS.danger },
  submitBtn: {
    backgroundColor: FARMDB_COLORS.accent,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  submitBtnText: { fontFamily: FARMDB_FONTS.bold, color: '#ffffff' },
  pinOverlay: {
    flex: 1,
    backgroundColor: 'rgba(23, 39, 29, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pinDialog: {
    backgroundColor: FARMDB_COLORS.surface,
    width: '100%',
    maxWidth: 360,
    padding: 18,
    borderRadius: 16,
    gap: 12,
  },
});
