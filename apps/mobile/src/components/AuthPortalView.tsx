import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  buildStandardUserPermissions,
  DEFAULT_FARM_SETTINGS,
  FARM_ACCOUNT_ROLES,
  formatAccountRoleLabel,
  formatAccountStatusLabel,
  formatAccountTierLabel,
  getDefaultPermissionsForRole,
  isAdminAccount,
  type FarmAccount,
  type FarmAccountAvatar,
  type FarmAccountRole,
} from '@farmdb/core';
import {
  useActiveFarmAccount,
  useDeleteFarmAccountWithCredentials,
  useFarmAccountList,
  useFarmSettings,
  useRecoverAdminFromCloud,
  useSignUpFarmAccount,
  useSwitchFarmAccount,
  useTriggerCloudSync,
  useUpdateFarmSettings,
} from '@farmdb/db';
import { MOBILE_APP_ICONS } from '../assets/icons';
import { FARMDB_COLORS, FARMDB_FONTS, useUiScale } from '../theme/uiScale';
import { AppIcon, getAvatarIconName } from './FarmIcons';
import { FarmScrollView } from './FarmScrollView';
import { MobileFileTabs } from './MobileFileTabs';
import { ModernDropdown } from './ModernDropdown';

type MobilePortalTab = 'signin' | 'signup';
type MobileSignupMode = 'user_account' | 'admin_account';

interface AuthPortalViewProps {
  onSuccessEnterApp?: () => void;
  onCancelToApp?: () => void;
  canCancel?: boolean;
}

export function AuthPortalView({
  onSuccessEnterApp,
  onCancelToApp,
  canCancel = true,
}: AuthPortalViewProps) {
  const ui = useUiScale();
  const settingsQuery = useFarmSettings();
  const settings = settingsQuery.data ?? DEFAULT_FARM_SETTINGS;
  const activeAccountQuery = useActiveFarmAccount();
  const activeAccount = activeAccountQuery.data;
  const accountsQuery = useFarmAccountList({});
  const accounts = accountsQuery.data ?? [];

  const switchMut = useSwitchFarmAccount();
  const signUpAccountMut = useSignUpFarmAccount();
  const deleteWithCredsMut = useDeleteFarmAccountWithCredentials();
  const recoverAdminMut = useRecoverAdminFromCloud();
  const syncMut = useTriggerCloudSync();
  const updateSettingsMut = useUpdateFarmSettings();

  const isPendingGate = activeAccount?.status === 'pending';

  const [tab, setTab] = useState<MobilePortalTab>('signin');
  const didInitTabRef = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDeleteAccountId, setConfirmDeleteAccountId] = useState<string | null>(null);

  // Sign-In state
  const [selectedLoginId, setSelectedLoginId] = useState<string>(
    () => accounts[0]?.id ?? ''
  );

  useEffect(() => {
    if (!accountsQuery.isLoading && !didInitTabRef.current) {
      didInitTabRef.current = true;
      if (accounts.length === 0) {
        setTab('signup');
      }
    }
  }, [accountsQuery.isLoading, accounts.length]);
  const [loginPin, setLoginPin] = useState('');
  const [showCloudRecovery, setShowCloudRecovery] = useState(false);
  const [recoverCloudKey, setRecoverCloudKey] = useState('');
  const [recoverUrl, setRecoverUrl] = useState(settings.supabaseUrl);
  const [recoverAnonKey, setRecoverAnonKey] = useState(settings.supabaseAnonKey);
  const [recoverWorkspace, setRecoverWorkspace] = useState(
    settings.cloudWorkspaceId || 'farmdb-homestead-main'
  );
  const [recoverEmail, setRecoverEmail] = useState('');
  const [recoverPin, setRecoverPin] = useState('');

  // Sign-Up state
  const [signupMode, setSignupMode] = useState<MobileSignupMode>('user_account');
  const [sName, setSName] = useState('');
  const [sEmail, setSEmail] = useState('');
  const [sPhone, setSPhone] = useState('');
  const [sPin, setSPin] = useState('');
  const [sRole, setSRole] = useState<FarmAccountRole>('family_member');
  const [sFarmName, setSFarmName] = useState(settings.farmName);
  const [showAdminCloudSetup, setShowAdminCloudSetup] = useState(false);
  const [sSupabaseUrl, setSSupabaseUrl] = useState(settings.supabaseUrl);
  const [sSupabaseAnonKey, setSSupabaseAnonKey] = useState(settings.supabaseAnonKey);
  const [sCloudWorkspace, setSCloudWorkspace] = useState(
    settings.cloudWorkspaceId || 'farmdb-homestead-main'
  );

  const selectedLoginAccount = useMemo(
    () =>
      accounts.find((a) => a.id === selectedLoginId) ??
      accounts[0] ??
      null,
    [accounts, selectedLoginId]
  );

  async function handleSignInSubmit() {
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
          `Signed in as ${switched.displayName}. Your request is waiting for Admin approval.`
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

  async function handleDeletePortalAccount() {
    if (!selectedLoginAccount) return;
    setErrorMsg(null);
    setNotice(null);
    try {
      const deletedName = selectedLoginAccount.displayName;
      await deleteWithCredsMut.mutateAsync({
        accountId: selectedLoginAccount.id,
        accessCode: loginPin,
      });
      setLoginPin('');
      setConfirmDeleteAccountId(null);
      setSelectedLoginId('');
      setNotice(`Deleted account ${deletedName}.`);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to delete account.'
      );
    }
  }

  async function handleSignUpSubmit() {
    setErrorMsg(null);
    setNotice(null);
    try {
      if (signupMode === 'user_account') {
        if (!sName.trim()) {
          setErrorMsg('Please enter your full name.');
          return;
        }
        if (sPin.trim().length < 4) {
          setErrorMsg(
            'Please set a Login PIN / passcode (at least 4 characters) for this user account.'
          );
          return;
        }
        const avatarKey: FarmAccountAvatar =
          sRole === 'external_owner'
            ? 'peasant'
            : sRole === 'family_member'
              ? 'farmerFemale'
              : 'farmer';

        const created = await signUpAccountMut.mutateAsync({
          displayName: sName.trim(),
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
      } else {
        const resolvedFarmName = sFarmName.trim() || sName.trim();
        if (!resolvedFarmName) {
          setErrorMsg('Please enter a Farm / Homestead name for this Admin account.');
          return;
        }
        const hasPrimaryAdmin = accounts.some((a) => a.isPrimaryAdmin);
        if (hasPrimaryAdmin && sPin.trim().length < 4) {
          setErrorMsg(
            'Please set a Login PIN / passcode (at least 4 characters) for additional Admin accounts.'
          );
          return;
        }
        const hasCloudSetup =
          sSupabaseUrl.trim().length > 0 && sSupabaseAnonKey.trim().length > 0;
        const cleanWorkspace =
          sCloudWorkspace.trim() || 'farmdb-homestead-main';
        const createdAdmin = await signUpAccountMut.mutateAsync({
          displayName: sName.trim() || resolvedFarmName,
          email: sEmail || null,
          phone: sPhone || null,
          role: 'admin',
          relationship: 'Admin',
          avatarKey: 'farmer',
          accessCode: sPin || null,
          supabaseUrl: hasCloudSetup ? sSupabaseUrl.trim() : null,
          supabaseAnonKey: hasCloudSetup ? sSupabaseAnonKey.trim() : null,
          cloudWorkspaceId: hasCloudSetup ? cleanWorkspace : null,
          isPrimaryAdmin: !hasPrimaryAdmin,
          canManageNetwork: true,
          canSyncCloud: true,
          status: 'active',
          permissions: getDefaultPermissionsForRole('admin'),
        });
        await switchMut.mutateAsync({
          accountId: createdAdmin.id,
          accessCode: sPin || undefined,
        });
        await updateSettingsMut.mutateAsync({
          farmName: resolvedFarmName,
          activeAccountId: createdAdmin.id,
          ...(hasCloudSetup
            ? {
                cloudSyncEnabled: true,
                supabaseUrl: sSupabaseUrl.trim(),
                supabaseAnonKey: sSupabaseAnonKey.trim(),
                cloudWorkspaceId: cleanWorkspace,
              }
            : {}),
        });
        onSuccessEnterApp?.();
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Sign up failed.');
    }
  }

  async function handleCloudAdminRecover() {
    setErrorMsg(null);
    setNotice(null);
    try {
      const res = await recoverAdminMut.mutateAsync({
        cloudKey: recoverCloudKey.trim() || undefined,
        supabaseUrl: recoverUrl.trim() || undefined,
        supabaseAnonKey: recoverAnonKey.trim() || undefined,
        cloudWorkspaceId: recoverWorkspace.trim() || undefined,
        email: recoverEmail.trim() || undefined,
        accessCode: recoverPin,
      });
      setRecoverPin('');
      setNotice(
        `Signed in as ${res.account.displayName} (${res.farmName}) and downloaded ${res.recordsPulled} records.`
      );
      onSuccessEnterApp?.();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Could not download Admin account from cloud.'
      );
    }
  }

  const pendingPollBusyRef = useRef(false);
  const syncPullRef = useRef(syncMut.mutateAsync);
  syncPullRef.current = syncMut.mutateAsync;
  const activeAccRefetchRef = useRef(activeAccountQuery.refetch);
  activeAccRefetchRef.current = activeAccountQuery.refetch;
  const onEnterAppRef = useRef(onSuccessEnterApp);
  onEnterAppRef.current = onSuccessEnterApp;

  useEffect(() => {
    if (
      !isPendingGate ||
      !settings.supabaseUrl.trim() ||
      !settings.supabaseAnonKey.trim()
    ) {
      return;
    }

    const pollApproval = async () => {
      if (pendingPollBusyRef.current) return;
      if (
        typeof navigator !== 'undefined' &&
        (navigator as unknown as { onLine?: boolean }).onLine === false
      ) {
        return;
      }
      pendingPollBusyRef.current = true;
      try {
        await syncPullRef.current('pull');
        const refreshed = await activeAccRefetchRef.current();
        if (refreshed.data?.status === 'active') {
          setNotice('Approved! Entering farm workspace...');
          onEnterAppRef.current?.();
        }
      } catch {
        // Ignore transient offline errors during background approval polling.
      } finally {
        pendingPollBusyRef.current = false;
      }
    };

    const timer = setInterval(() => {
      void pollApproval();
    }, 20000);

    return () => clearInterval(timer);
  }, [isPendingGate, settings.supabaseUrl, settings.supabaseAnonKey]);

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
    <SafeAreaView
      style={styles.safeArea}
      edges={['top', 'left', 'right', 'bottom']}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FarmScrollView
          contentContainerStyle={{
            padding: ui.contentPadding,
            gap: ui.space(12),
            paddingBottom: ui.space(28),
          }}
        >
          {/* Hero Banner */}
          <View
            style={[
              styles.heroCard,
              {
                padding: ui.space(16),
                borderRadius: ui.radius + 4,
                gap: ui.space(12),
              },
            ]}
          >
            <View style={styles.brandRow}>
              <View style={styles.brandIconWrap}>
                <AppIcon name="field" size={ui.font(26)} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.heroKicker}>
                  <Text style={[styles.heroKickerText, { fontSize: ui.font(10) }]}>
                    FARMDB HOMESTEAD PORTAL
                  </Text>
                </View>
                <Text style={[styles.heroTitle, { fontSize: ui.font(19) }]}>
                  {settings.farmName}
                </Text>
              </View>
            </View>

            <View style={[styles.rowWrap, { gap: ui.space(8), justifyContent: 'space-between' }]}>
              <View style={[styles.heroChip]}>
                <AppIcon name="databaseLeaf" size={ui.font(13)} />
                <Text style={[styles.heroChipText, { fontSize: ui.font(11) }]}>
                  {accounts.length === 0
                    ? 'No Accounts Yet'
                    : `${accounts.length} ${accounts.length === 1 ? 'Account' : 'Accounts'} Ready`}
                </Text>
              </View>

              {canCancel && !isPendingGate && onCancelToApp ? (
                <Pressable
                  style={[
                    styles.heroBackBtn,
                    {
                      minHeight: ui.chipHeight,
                      paddingHorizontal: ui.space(12),
                      paddingVertical: ui.space(6),
                    },
                  ]}
                  onPress={onCancelToApp}
                >
                  <AppIcon name="close" size={ui.font(13)} color="#e6f2ec" />
                  <Text
                    style={[styles.heroBackBtnText, { fontSize: ui.font(12), flexShrink: 1 }]}
                  >
                    Back to Dashboard
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* Pending Gate Banner */}
          {isPendingGate && activeAccount ? (
            <View
              style={[
                styles.pendingBanner,
                {
                  padding: ui.space(14),
                  borderRadius: ui.radius,
                  gap: ui.space(8),
                },
              ]}
            >
              <View style={styles.rowStart}>
                <AppIcon name="hourglass" size={ui.font(22)} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={[styles.pendingTitle, { fontSize: ui.font(15) }]}
                  >
                    Pending Administrator Approval ({activeAccount.displayName})
                  </Text>
                  <Text
                    style={[styles.pendingText, { fontSize: ui.font(12) }]}
                  >
                    Your account joined {settings.farmName} with the Network Join Key and is waiting in Pending state. Once the Farm Admin assigns privileges and accepts your request, you will enter the shared database.
                  </Text>
                </View>
              </View>

              <View style={[styles.rowWrap, { gap: ui.space(8) }]}>
                <Pressable
                  style={[
                    styles.primaryBtn,
                    {
                      minHeight: ui.chipHeight,
                      paddingHorizontal: ui.space(12),
                      paddingVertical: ui.space(6),
                    },
                  ]}
                  disabled={syncMut.isPending}
                  onPress={() => void handleCheckApprovalStatus()}
                >
                  <AppIcon name="dataSync" size={ui.font(14)} />
                  <Text
                    style={[styles.primaryBtnText, { fontSize: ui.font(12), flexShrink: 1 }]}
                  >
                    {syncMut.isPending ? 'Checking...' : 'Check Approval'}
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.secondaryBtn,
                    {
                      minHeight: ui.chipHeight,
                      paddingHorizontal: ui.space(12),
                      paddingVertical: ui.space(6),
                    },
                  ]}
                  onPress={() => {
                    const adminAcc = accounts.find((a) => a.isPrimaryAdmin);
                    if (adminAcc) setSelectedLoginId(adminAcc.id);
                    setTab('signin');
                  }}
                >
                  <Text
                    style={[
                      styles.secondaryBtnText,
                      { fontSize: ui.font(12), flexShrink: 1 },
                    ]}
                  >
                    Switch Account
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {errorMsg ? (
            <View
              style={[
                styles.errorBanner,
                { padding: ui.space(10), borderRadius: ui.radius },
              ]}
            >
              <Text style={[styles.errorText, { fontSize: ui.font(12) }]}>
                {errorMsg}
              </Text>
            </View>
          ) : null}

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
            </View>
          ) : null}

          {/* Portal Tab Bar */}
          <MobileFileTabs
            surfaceTone="surface"
            activeId={tab}
            onChange={(nextTab) => {
              setErrorMsg(null);
              setConfirmDeleteAccountId(null);
              setTab(nextTab);
            }}
            tabs={[
              { id: 'signin', label: 'Sign In' },
              { id: 'signup', label: 'Sign Up' },
            ]}
          />

          {tab === 'signin' ? (
            <View
              style={[
                styles.card,
                {
                  padding: ui.space(14),
                  borderRadius: ui.radius,
                  gap: ui.space(12),
                },
              ]}
            >
              <Text style={[styles.sectionTitle, { fontSize: ui.font(15) }]}>
                Choose Farm Account
              </Text>
              {accounts.length === 0 ? (
                <View
                  style={{
                    gap: ui.space(8),
                    padding: ui.space(12),
                    borderRadius: ui.radius,
                    backgroundColor: FARMDB_COLORS.surfaceMuted,
                    borderWidth: 1,
                    borderColor: FARMDB_COLORS.border,
                  }}
                >
                  <Text style={[styles.subText, { fontSize: ui.font(12) }]}>
                    No farm accounts exist on this device yet. Create a User
                    Account or Admin Account to start, or restore an Admin
                    workspace from Supabase cloud below.
                  </Text>
                  <Pressable
                    style={[
                      styles.submitBtn,
                      {
                        minHeight: ui.controlHeight,
                        paddingHorizontal: ui.space(14),
                        paddingVertical: ui.space(8),
                      },
                    ]}
                    onPress={() => {
                      setErrorMsg(null);
                      setTab('signup');
                    }}
                  >
                    <Text
                      style={[
                        styles.submitBtnText,
                        { fontSize: ui.font(14), textAlign: 'center' },
                      ]}
                    >
                      Create an Account
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <View style={{ gap: ui.space(8) }}>
                    {accounts.map((acc: FarmAccount) => {
                      const isSelected = selectedLoginAccount?.id === acc.id;
                      return (
                        <Pressable
                          key={acc.id}
                          style={[
                            styles.accountTile,
                            isSelected && styles.accountTileSelected,
                          ]}
                          onPress={() => {
                            setSelectedLoginId(acc.id);
                            setLoginPin('');
                            setConfirmDeleteAccountId(null);
                            setErrorMsg(null);
                          }}
                        >
                          <AppIcon
                            name={getAvatarIconName(acc.avatarKey)}
                            size={ui.font(24)}
                          />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text
                              style={[
                                styles.accountName,
                                { fontSize: ui.font(14) },
                              ]}
                            >
                              {acc.displayName}
                            </Text>
                            <Text
                              style={[styles.subText, { fontSize: ui.font(11) }]}
                            >
                              {formatAccountTierLabel(acc)} ·{' '}
                              {formatAccountRoleLabel(acc.role)} ·{' '}
                              {formatAccountStatusLabel(acc.status)}
                              {!isAdminAccount(acc)
                                ? acc.canSyncCloud
                                  ? ' · Network DB'
                                  : ' · Local DB'
                                : ''}
                            </Text>
                          </View>
                          {isSelected ? (
                            <AppIcon name="checkCircle" size={ui.font(18)} />
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>

                  {selectedLoginAccount &&
                  (!selectedLoginAccount.isPrimaryAdmin ||
                    Boolean(selectedLoginAccount.accessCode)) ? (
                    <View style={styles.fieldGroup}>
                      <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                        Access PIN for {selectedLoginAccount.displayName}
                      </Text>
                      <TextInput
                        style={[styles.input, { fontSize: ui.font(14) }]}
                        secureTextEntry
                        value={loginPin}
                        onChangeText={setLoginPin}
                        placeholder="Enter access PIN..."
                      />
                    </View>
                  ) : null}

                  <Pressable
                    style={[styles.submitBtn, { minHeight: ui.controlHeight, paddingHorizontal: ui.space(14), paddingVertical: ui.space(8) }]}
                    disabled={!selectedLoginAccount || switchMut.isPending}
                    onPress={() => void handleSignInSubmit()}
                  >
                    <Text style={[styles.submitBtnText, { fontSize: ui.font(14), textAlign: 'center' }]}>
                      {selectedLoginAccount?.status === 'pending'
                        ? 'View Pending Status'
                        : `Sign In as ${selectedLoginAccount?.displayName ?? 'Selected'}`}
                    </Text>
                  </Pressable>

                  {selectedLoginAccount ? (
                    confirmDeleteAccountId === selectedLoginAccount.id ? (
                      <View
                        style={[
                          styles.deleteConfirmBox,
                          {
                            padding: ui.space(12),
                            borderRadius: ui.radius,
                            gap: ui.space(8),
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.dangerBtnText,
                            { fontSize: ui.font(13) },
                          ]}
                        >
                          Delete {selectedLoginAccount.displayName} (
                          {formatAccountTierLabel(selectedLoginAccount)})?
                        </Text>
                        <Text
                          style={[
                            styles.subText,
                            { fontSize: ui.font(11.5), color: '#7a271a' },
                          ]}
                        >
                          Local farm records stay safe in SQLite.
                          {selectedLoginAccount.accessCode?.trim() && !loginPin.trim()
                            ? ' Enter this account\u2019s access PIN above to confirm deletion.'
                            : ''}
                        </Text>
                        <View style={[styles.rowWrap, { gap: ui.space(8) }]}>
                          <Pressable
                            style={[
                              styles.secondaryBtn,
                              {
                                flexGrow: 1,
                                minHeight: ui.chipHeight,
                                paddingHorizontal: ui.space(12),
                                paddingVertical: ui.space(6),
                              },
                            ]}
                            disabled={deleteWithCredsMut.isPending}
                            onPress={() => setConfirmDeleteAccountId(null)}
                          >
                            <Text style={[styles.secondaryBtnText, { fontSize: ui.font(12) }]}>
                              Cancel
                            </Text>
                          </Pressable>
                          <Pressable
                            style={[
                              styles.dangerBtn,
                              {
                                flexGrow: 1,
                                minHeight: ui.chipHeight,
                                paddingHorizontal: ui.space(12),
                                paddingVertical: ui.space(6),
                              },
                            ]}
                            disabled={deleteWithCredsMut.isPending}
                            onPress={() => void handleDeletePortalAccount()}
                          >
                            <AppIcon name="trash" size={ui.font(14)} />
                            <Text style={[styles.dangerBtnText, { fontSize: ui.font(12) }]}>
                              {deleteWithCredsMut.isPending ? 'Deleting...' : 'Confirm Delete'}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <Pressable
                        style={[
                          styles.dangerBtn,
                          {
                            alignSelf: 'flex-start',
                            minHeight: ui.chipHeight,
                            paddingHorizontal: ui.space(14),
                            paddingVertical: ui.space(6),
                          },
                        ]}
                        onPress={() => {
                          setErrorMsg(null);
                          setConfirmDeleteAccountId(selectedLoginAccount.id);
                        }}
                      >
                        <AppIcon name="trash" size={ui.font(14)} />
                        <Text style={[styles.dangerBtnText, { fontSize: ui.font(12) }]}>
                          Delete Account
                        </Text>
                      </Pressable>
                    )
                  ) : null}
                </>
              )}

              <View style={{ borderTopWidth: 1, borderTopColor: FARMDB_COLORS.border, paddingTop: ui.space(10), gap: ui.space(8) }}>
                <Pressable
                  style={[styles.secondaryBtn, { minHeight: ui.chipHeight, paddingHorizontal: ui.space(12), paddingVertical: ui.space(6) }]}
                  onPress={() => setShowCloudRecovery((prev) => !prev)}
                >
                  <AppIcon name="cloud" size={ui.font(14)} />
                  <Text style={[styles.secondaryBtnText, { fontSize: ui.font(12), textAlign: 'center', flexShrink: 1 }]}>
                    {showCloudRecovery
                      ? 'Hide Cross-Device Cloud Sign-In'
                      : 'New Device? Sign In from Cloud DB'}
                  </Text>
                </Pressable>

                {showCloudRecovery ? (
                  <View style={{ gap: ui.space(8), padding: ui.space(10), borderRadius: ui.radius, backgroundColor: FARMDB_COLORS.surfaceMuted, borderWidth: 1, borderColor: FARMDB_COLORS.border }}>
                    <Text style={[styles.subText, { fontSize: ui.font(11) }]}>
                      Paste your Full Cloud Key (FDB1:...) or enter your Supabase details once to download your Admin account and farm database.
                    </Text>
                    <View style={styles.fieldGroup}>
                      <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                        Full Cloud Key (FDB1:...) — Shortcut
                      </Text>
                      <TextInput
                        style={[styles.input, { fontSize: ui.font(13) }]}
                        value={recoverCloudKey}
                        onChangeText={setRecoverCloudKey}
                        placeholder="Paste FDB1:... key (or enter URL & Key below)"
                        autoCapitalize="none"
                      />
                    </View>
                    {!recoverCloudKey.trim() ? (
                      <>
                        <View style={styles.fieldGroup}>
                          <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                            Supabase Project URL *
                          </Text>
                          <TextInput
                            style={[styles.input, { fontSize: ui.font(13) }]}
                            value={recoverUrl}
                            onChangeText={setRecoverUrl}
                            placeholder="https://your-project.supabase.co"
                            autoCapitalize="none"
                          />
                        </View>
                        <View style={styles.fieldGroup}>
                          <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                            Supabase Anon Key *
                          </Text>
                          <TextInput
                            style={[styles.input, { fontSize: ui.font(13) }]}
                            secureTextEntry
                            value={recoverAnonKey}
                            onChangeText={setRecoverAnonKey}
                            placeholder="sb_publishable_... or eyJ..."
                            autoCapitalize="none"
                          />
                        </View>
                        <View style={styles.fieldGroup}>
                          <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                            Cloud Workspace ID
                          </Text>
                          <TextInput
                            style={[styles.input, { fontSize: ui.font(13) }]}
                            value={recoverWorkspace}
                            onChangeText={setRecoverWorkspace}
                            placeholder="farmdb-homestead-main"
                            autoCapitalize="none"
                          />
                        </View>
                      </>
                    ) : null}
                    <View style={styles.fieldGroup}>
                      <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                        Admin Email (Optional)
                      </Text>
                      <TextInput
                        style={[styles.input, { fontSize: ui.font(13) }]}
                        value={recoverEmail}
                        onChangeText={setRecoverEmail}
                        placeholder="Matches specific Admin email"
                        autoCapitalize="none"
                      />
                    </View>
                    <View style={styles.fieldGroup}>
                      <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                        Admin PIN / Password
                      </Text>
                      <TextInput
                        style={[styles.input, { fontSize: ui.font(13) }]}
                        secureTextEntry
                        value={recoverPin}
                        onChangeText={setRecoverPin}
                        placeholder="Enter PIN if set on Admin"
                      />
                    </View>
                    <Pressable
                      style={[styles.primaryBtn, { minHeight: ui.controlHeight, paddingVertical: ui.space(8) }]}
                      disabled={recoverAdminMut.isPending}
                      onPress={() => void handleCloudAdminRecover()}
                    >
                      <AppIcon name="download" size={ui.font(15)} />
                      <Text style={[styles.primaryBtnText, { fontSize: ui.font(13), textAlign: 'center' }]}>
                        {recoverAdminMut.isPending
                          ? 'Downloading Cloud DB...'
                          : 'Download Cloud DB & Sign In'}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </View>
          ) : (
            <View
              style={[
                styles.card,
                {
                  padding: ui.space(14),
                  borderRadius: ui.radius,
                  gap: ui.space(12),
                },
              ]}
            >
              <View style={[styles.segmentedBar, { flexWrap: 'wrap' }]}>
                <Pressable
                  style={[
                    styles.segmentedItem,
                    { minWidth: 118, paddingHorizontal: ui.space(8) },
                    signupMode === 'user_account' && styles.segmentedItemActive,
                  ]}
                  onPress={() => setSignupMode('user_account')}
                >
                  <Text
                    style={[
                      styles.segmentedText,
                      signupMode === 'user_account' &&
                        styles.segmentedTextActive,
                      { fontSize: ui.font(11), textAlign: 'center' },
                    ]}
                  >
                    User Account
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.segmentedItem,
                    { minWidth: 118, paddingHorizontal: ui.space(8) },
                    signupMode === 'admin_account' && styles.segmentedItemActive,
                  ]}
                  onPress={() => setSignupMode('admin_account')}
                >
                  <Text
                    style={[
                      styles.segmentedText,
                      signupMode === 'admin_account' &&
                        styles.segmentedTextActive,
                      { fontSize: ui.font(11), textAlign: 'center' },
                    ]}
                  >
                    Admin Account
                  </Text>
                </Pressable>
              </View>

              {signupMode === 'admin_account' ? (
                <>
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                      Farm / Homestead Name *
                    </Text>
                    <TextInput
                      style={[styles.input, { fontSize: ui.font(14) }]}
                      value={sFarmName}
                      onChangeText={setSFarmName}
                      placeholder="farmDB Homestead"
                    />
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                      Admin Display Name (Optional)
                    </Text>
                    <TextInput
                      style={[styles.input, { fontSize: ui.font(14) }]}
                      value={sName}
                      onChangeText={setSName}
                      placeholder="Leave blank to use Farm Name"
                    />
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                      Full Name *
                    </Text>
                    <TextInput
                      style={[styles.input, { fontSize: ui.font(14) }]}
                      value={sName}
                      onChangeText={setSName}
                      placeholder="e.g. Sarah Namono"
                    />
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                      Account Role
                    </Text>
                    <ModernDropdown
                      value={sRole}
                      options={FARM_ACCOUNT_ROLES.filter((r) => r !== 'admin').map(
                        (r) => ({
                          value: r,
                          label: formatAccountRoleLabel(r),
                          iconSource: MOBILE_APP_ICONS.networking,
                        })
                      )}
                      title="Account Role"
                      onChange={setSRole}
                    />
                  </View>
                </>
              )}

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                  Email (Optional)
                </Text>
                <TextInput
                  style={[styles.input, { fontSize: ui.font(14) }]}
                  value={sEmail}
                  onChangeText={setSEmail}
                  placeholder="Optional email address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                  Phone (Optional)
                </Text>
                <TextInput
                  style={[styles.input, { fontSize: ui.font(14) }]}
                  value={sPhone}
                  onChangeText={setSPhone}
                  placeholder="Optional phone number"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                  {signupMode === 'user_account'
                    ? 'Login PIN / Passcode *'
                    : 'Switch PIN (Optional)'}
                </Text>
                <TextInput
                  style={[styles.input, { fontSize: ui.font(14) }]}
                  secureTextEntry
                  value={sPin}
                  onChangeText={setSPin}
                  placeholder={
                    signupMode === 'user_account'
                      ? 'Required 4+ character PIN'
                      : 'Optional access PIN'
                  }
                />
              </View>

              {signupMode === 'admin_account' ? (
                <View style={{ gap: ui.space(8) }}>
                  <Pressable
                    style={[styles.secondaryBtn, { minHeight: ui.chipHeight, paddingHorizontal: ui.space(12) }]}
                    onPress={() => setShowAdminCloudSetup((prev) => !prev)}
                  >
                    <AppIcon name="cloud" size={ui.font(14)} />
                    <Text style={[styles.secondaryBtnText, { fontSize: ui.font(12), flexShrink: 1 }]}>
                      {showAdminCloudSetup
                        ? 'Hide Supabase Credentials'
                        : 'Store Supabase Credentials (Optional)'}
                    </Text>
                  </Pressable>
                  {showAdminCloudSetup ? (
                    <View style={{ gap: ui.space(8), padding: ui.space(10), borderRadius: ui.radius, backgroundColor: FARMDB_COLORS.surfaceMuted, borderWidth: 1, borderColor: FARMDB_COLORS.border }}>
                      <View style={styles.fieldGroup}>
                        <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                          Supabase Project URL
                        </Text>
                        <TextInput
                          style={[styles.input, { fontSize: ui.font(13) }]}
                          value={sSupabaseUrl}
                          onChangeText={setSSupabaseUrl}
                          placeholder="https://your-project.supabase.co"
                          autoCapitalize="none"
                        />
                      </View>
                      <View style={styles.fieldGroup}>
                        <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                          Supabase Anon Key
                        </Text>
                        <TextInput
                          style={[styles.input, { fontSize: ui.font(13) }]}
                          secureTextEntry
                          value={sSupabaseAnonKey}
                          onChangeText={setSSupabaseAnonKey}
                          placeholder="sb_publishable_... or eyJ..."
                          autoCapitalize="none"
                        />
                      </View>
                      <View style={styles.fieldGroup}>
                        <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                          Cloud Workspace ID
                        </Text>
                        <TextInput
                          style={[styles.input, { fontSize: ui.font(13) }]}
                          value={sCloudWorkspace}
                          onChangeText={setSCloudWorkspace}
                          placeholder="farmdb-homestead-main"
                          autoCapitalize="none"
                        />
                      </View>
                    </View>
                  ) : null}
                </View>
              ) : null}

              <Pressable
                style={[styles.submitBtn, { minHeight: ui.controlHeight, paddingHorizontal: ui.space(14), paddingVertical: ui.space(8) }]}
                disabled={
                  signUpAccountMut.isPending ||
                  switchMut.isPending ||
                  updateSettingsMut.isPending
                }
                onPress={() => void handleSignUpSubmit()}
              >
                <Text style={[styles.submitBtnText, { fontSize: ui.font(14), textAlign: 'center' }]}>
                  {signupMode === 'user_account'
                    ? 'Create User Account & Enter'
                    : 'Create Admin Account & Enter'}
                </Text>
              </Pressable>
            </View>
          )}
        </FarmScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: FARMDB_COLORS.bg },
  card: {
    backgroundColor: FARMDB_COLORS.surface,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
  },
  heroCard: {
    backgroundColor: FARMDB_COLORS.darkHeader,
    borderWidth: 1,
    borderColor: '#244734',
  },
  heroKicker: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(64, 145, 108, 0.28)',
    borderWidth: 1,
    borderColor: 'rgba(183, 228, 199, 0.28)',
    marginBottom: 4,
  },
  heroKickerText: {
    fontFamily: FARMDB_FONTS.bold,
    color: '#b7e4c7',
    letterSpacing: 0.4,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: FARMDB_COLORS.brandMark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontFamily: FARMDB_FONTS.extrabold, color: '#ffffff' },
  heroSubText: { fontFamily: FARMDB_FONTS.regular, color: '#c5d9cd', marginTop: 2 },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  heroChipText: { fontFamily: FARMDB_FONTS.semibold, color: '#e6f2ec' },
  heroBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  heroBackBtnText: { fontFamily: FARMDB_FONTS.semibold, color: '#f4f7f5' },
  sectionTitle: { fontFamily: FARMDB_FONTS.bold, color: FARMDB_COLORS.text },
  subText: { fontFamily: FARMDB_FONTS.regular, color: FARMDB_COLORS.textMuted },
  rowStart: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  rowWrap: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  pendingBanner: {
    backgroundColor: FARMDB_COLORS.warnBg,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.warnBorder,
  },
  pendingTitle: { fontFamily: FARMDB_FONTS.bold, color: FARMDB_COLORS.warnText },
  pendingText: { fontFamily: FARMDB_FONTS.regular, color: FARMDB_COLORS.warnText, marginTop: 2 },
  errorBanner: {
    backgroundColor: FARMDB_COLORS.dangerSoft,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.danger,
  },
  errorText: { fontFamily: FARMDB_FONTS.semibold, color: FARMDB_COLORS.danger },
  noticeBanner: {
    backgroundColor: FARMDB_COLORS.accentSoft,
    borderWidth: 1,
    borderColor: 'rgba(45, 106, 79, 0.25)',
  },
  noticeText: { fontFamily: FARMDB_FONTS.medium, color: '#173e2b' },
  segmentedBar: {
    flexDirection: 'row',
    backgroundColor: '#e4ede7',
    borderWidth: 1,
    borderColor: '#cfe0d5',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segmentedItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 9,
  },
  segmentedItemActive: { backgroundColor: FARMDB_COLORS.accent },
  segmentedText: {
    fontFamily: FARMDB_FONTS.semibold,
    color: FARMDB_COLORS.textMuted,
  },
  segmentedTextActive: {
    fontFamily: FARMDB_FONTS.bold,
    color: '#ffffff',
  },
  accountTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    backgroundColor: '#faf8f4',
  },
  accountTileSelected: {
    borderColor: FARMDB_COLORS.accent,
    borderWidth: 2.25,
    backgroundColor: FARMDB_COLORS.accentSoft,
  },
  accountName: { fontFamily: FARMDB_FONTS.bold, color: FARMDB_COLORS.text },
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
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
  },
  secondaryBtnText: {
    fontFamily: FARMDB_FONTS.semibold,
    color: FARMDB_COLORS.text,
  },
  submitBtn: {
    backgroundColor: FARMDB_COLORS.accent,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitBtnText: { fontFamily: FARMDB_FONTS.bold, color: '#ffffff' },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: FARMDB_COLORS.dangerSoft,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#f4c7c3',
  },
  dangerBtnText: {
    fontFamily: FARMDB_FONTS.bold,
    color: FARMDB_COLORS.danger,
  },
  deleteConfirmBox: {
    backgroundColor: FARMDB_COLORS.dangerSoft,
    borderWidth: 1,
    borderColor: '#f4c7c3',
  },
});
