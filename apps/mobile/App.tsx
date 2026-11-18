import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import {
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import {
  APP_SECTIONS,
  canAccountViewModule,
  isAdminAccount,
  type AppSectionId,
} from '@farmdb/core';
import {
  FarmDbProvider,
  runMigrations,
  useActiveFarmAccount,
  useAlertBackgroundWorker,
  useCloudAutoSyncWorker,
  useFarmSummary,
  type AlertNotificationPayload,
} from '@farmdb/db';
import {
  createExpoSqliteController,
  type ExpoSqlController,
} from './src/db/mobileDriver';
import {
  dispatchMobileNotification,
  ensureMobileNotificationHandler,
} from './src/services/notifications';
import { AlertsView } from './src/components/AlertsView';
import { BackupView } from './src/components/BackupView';
import { AnimalQuickPreviewProvider } from './src/components/AnimalQuickPreviewModal';
import { FamilyTreeView } from './src/components/FamilyTreeView';
import { AppIcon, getAvatarIconName, type AppIconName } from './src/components/FarmIcons';
import { AuthPortalView } from './src/components/AuthPortalView';
import { FarmNetworkView } from './src/components/FarmNetworkView';
import { FarmStatisticsView } from './src/components/FarmStatisticsView';
import { FinancialView } from './src/components/FinancialView';
import { FirstTimeSetupView } from './src/components/FirstTimeSetupView';
import { installWebScrollbarStyles } from './src/components/FarmScrollView';
import { HumanResourcesView } from './src/components/HumanResourcesView';
import { LivestockListView } from './src/components/LivestockListView';
import { MedicalView } from './src/components/MedicalView';
import { OwnershipsView } from './src/components/OwnershipsView';
import { ProductionView } from './src/components/ProductionView';
import { SettingsView } from './src/components/SettingsView';
import { TutorialModal } from './src/components/TutorialModal';
import {
  FARMDB_COLORS,
  FARMDB_FONTS,
  UiScaleProvider,
  useUiScale,
} from './src/theme/uiScale';

ensureMobileNotificationHandler();

const PRIMARY_MOBILE_TABS: readonly AppSectionId[] = [
  'livestock',
  'production',
  'medical',
  'financial',
  'alerts',
];

function getTabIconName(id: AppSectionId): AppIconName {
  switch (id) {
    case 'livestock':
      return 'livestock';
    case 'ownerships':
      return 'ownerships';
    case 'family_tree':
      return 'tree';
    case 'production':
      return 'production';
    case 'medical':
      return 'medical';
    case 'financial':
      return 'financial';
    case 'alerts':
      return 'alerts';
    case 'hr':
      return 'staff';
    case 'statistics':
      return 'livestockGroup';
    case 'network':
      return 'network';
    case 'backup':
      return 'backup';
    case 'settings':
      return 'settings';
  }
}

function MobileShell({ sqlController }: { sqlController: ExpoSqlController }) {
  const [activeSection, setActiveSection] = useState<AppSectionId>('livestock');
  const [authPortalOpen, setAuthPortalOpen] = useState(true);
  const [isSignedOut, setIsSignedOut] = useState(true);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  const handleSignOut = useCallback(() => {
    setIsSignedOut(true);
    setAuthPortalOpen(true);
  }, []);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerProgress = useRef(new Animated.Value(0)).current;
  const [familyFocusAnimalId, setFamilyFocusAnimalId] = useState<string | null>(null);
  const [dueBanners, setDueBanners] = useState<AlertNotificationPayload[]>([]);
  const summaryQuery = useFarmSummary();
  const activeAccountQuery = useActiveFarmAccount();
  const summary = summaryQuery.data;
  const activeAccount = activeAccountQuery.data;
  const ui = useUiScale();
  const iconMode = ui.settings.mobileIconMode;

  const openDrawer = useCallback(() => {
    setDrawerOpen(true);
    drawerProgress.setValue(0);
    Animated.timing(drawerProgress, {
      toValue: 1,
      duration: 210,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [drawerProgress]);

  const closeDrawer = useCallback(
    (onClosed?: () => void) => {
      Animated.timing(drawerProgress, {
        toValue: 0,
        duration: 170,
        useNativeDriver: Platform.OS !== 'web',
      }).start(() => {
        setDrawerOpen(false);
        onClosed?.();
      });
    },
    [drawerProgress]
  );

  const navigateToSection = useCallback(
    (sectionId: AppSectionId) => {
      if (sectionId !== 'family_tree') {
        setFamilyFocusAnimalId(null);
      }
      setActiveSection(sectionId);
      closeDrawer();
    },
    [closeDrawer]
  );

  const dispatcher = useMemo(
    () => ({
      deliver: dispatchMobileNotification,
    }),
    []
  );

  const isPendingGate = activeAccount?.status === 'pending';
  const showAuthPortal = authPortalOpen || isSignedOut || isPendingGate;
  const showOnboarding =
    !showAuthPortal &&
    !isSignedOut &&
    !isPendingGate &&
    activeAccount?.onboardingCompleted === false;

  const { checkNow } = useAlertBackgroundWorker(dispatcher, {
    enabled:
      !isSignedOut &&
      !showAuthPortal &&
      !showOnboarding &&
      ui.settings.enableNotifications,
    intervalMs: ui.settings.alertCheckIntervalSeconds * 1000,
    onDelivered: (items) => {
      setDueBanners((prev) => [...items, ...prev].slice(0, 3));
    },
  });

  useCloudAutoSyncWorker(ui.settings, {
    canSyncAccount:
      !isSignedOut &&
      !showAuthPortal &&
      !showOnboarding &&
      (isAdminAccount(activeAccount) || Boolean(activeAccount?.canSyncCloud)),
  });

  const visibleSections = useMemo(
    () =>
      APP_SECTIONS.filter((sec) => canAccountViewModule(activeAccount, sec.id)),
    [activeAccount]
  );

  const drawerNavSections = useMemo(
    () => visibleSections.filter((sec) => sec.id !== 'settings'),
    [visibleSections]
  );

  const primarySections = useMemo(
    () =>
      APP_SECTIONS.filter(
        (s) =>
          PRIMARY_MOBILE_TABS.includes(s.id) &&
          canAccountViewModule(activeAccount, s.id)
      ),
    [activeAccount]
  );

  useEffect(() => {
    if (
      activeAccount &&
      !canAccountViewModule(activeAccount, activeSection)
    ) {
      setActiveSection(primarySections[0]?.id ?? visibleSections[0]?.id ?? 'livestock');
    }
  }, [activeAccount, activeSection, primarySections, visibleSections]);

  function getCountForSection(id: AppSectionId): number | null {
    if (!summary) {
      return null;
    }
    switch (id) {
      case 'livestock':
        return summary.activeLivestock;
      case 'production':
        return summary.productRecordCount;
      case 'medical':
        return summary.medicalRecordCount;
      case 'financial':
        return summary.financialLogCount;
      case 'alerts':
        return summary.openAlertCount;
      default:
        return null;
    }
  }

  const openAlerts = summary?.openAlertCount ?? 0;
  const sysBtnSize = Math.max(36, ui.chipHeight);
  const drawerWidth = Math.min(Math.round(ui.width * 0.86), 340);
  const drawerTranslateX = drawerProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-drawerWidth, 0],
  });
  const activeSectionMeta = useMemo(
    () => APP_SECTIONS.find((s) => s.id === activeSection),
    [activeSection]
  );

  if (showAuthPortal) {
    return (
      <>
        <StatusBar style="dark" />
        <AuthPortalView
          canCancel={!isSignedOut && !isPendingGate}
          onCancelToApp={() => setAuthPortalOpen(false)}
          onSuccessEnterApp={() => {
            setIsSignedOut(false);
            setAuthPortalOpen(false);
          }}
        />
      </>
    );
  }

  if (showOnboarding && activeAccount) {
    return (
      <>
        <StatusBar style="dark" />
        <FirstTimeSetupView
          activeAccount={activeAccount}
          sqlController={sqlController}
          onComplete={() => {
            setActiveSection('livestock');
          }}
        />
      </>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="dark" />
      <View
        style={[
          styles.header,
          {
            paddingHorizontal: ui.contentPadding,
            paddingVertical: ui.space(9),
            gap: ui.space(8),
          },
        ]}
      >
        <View style={styles.brandLeft}>
          <Pressable
            onPress={openDrawer}
            style={[
              styles.hamburgerBtn,
              {
                width: sysBtnSize,
                height: sysBtnSize,
                borderRadius: 11,
              },
            ]}
            accessibilityLabel="Open navigation menu"
            hitSlop={6}
          >
            <AppIcon
              name="menu"
              size={Math.max(20, ui.font(20))}
              color={FARMDB_COLORS.darkHeader}
            />
          </Pressable>

          <Pressable
            onPress={() => setActiveSection('network')}
            style={styles.headerAccountTrigger}
            accessibilityLabel="Open Farm Network and Account"
            hitSlop={4}
          >
            <View
              style={[
                styles.brandMark,
                {
                  width: ui.isCompactPhone ? 32 : 36,
                  height: ui.isCompactPhone ? 32 : 36,
                  borderRadius: 10,
                },
              ]}
            >
              <AppIcon
                name={getAvatarIconName(activeAccount?.avatarKey)}
                size={ui.isCompactPhone ? 20 : 24}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.brand, { fontSize: ui.font(15) }]} numberOfLines={1}>
                {activeAccount?.displayName ?? 'Farm Owner (Admin)'}
              </Text>
              <Text
                style={[styles.subBrand, { fontSize: ui.font(11) }]}
                numberOfLines={1}
              >
                {activeSectionMeta?.label ?? 'farmDB'}
              </Text>
            </View>
          </Pressable>
        </View>
      </View>

      {dueBanners.length > 0 ? (
        <View
          style={[
            styles.alertBanner,
            {
              paddingHorizontal: ui.contentPadding,
              paddingVertical: ui.space(8),
              flexWrap: 'wrap',
            },
          ]}
        >
          <AppIcon name="alerts" size={ui.font(16)} color="#173e2b" />
          <View style={{ flex: 1, minWidth: 160 }}>
            <Text style={[styles.alertBannerTitle, { fontSize: ui.font(12) }]}>
              {dueBanners[0]!.title}
            </Text>
            <Text style={[styles.alertBannerBody, { fontSize: ui.font(11) }]}>
              {dueBanners[0]!.body}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Pressable
              onPress={() =>
                setActiveSection(dueBanners[0]?.kind === 'hr_payment' ? 'hr' : 'alerts')
              }
              style={styles.alertBannerBtn}
              accessibilityLabel="View due alerts"
            >
              <AppIcon name="check" size={ui.font(14)} color={FARMDB_COLORS.accent} />
            </Pressable>
            <Pressable
              onPress={() => setDueBanners([])}
              style={styles.alertBannerDismiss}
              hitSlop={8}
              accessibilityLabel="Dismiss banner"
            >
              <AppIcon name="close" size={ui.font(14)} color="#173e2b" />
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.body}>
        {visibleSections.length === 0 ? (
          <View
            style={{
              margin: ui.contentPadding,
              padding: ui.space(20),
              borderRadius: ui.radius,
              backgroundColor: FARMDB_COLORS.surface,
              borderWidth: 1,
              borderColor: FARMDB_COLORS.border,
              gap: ui.space(10),
            }}
          >
            <Text
              style={{
                fontFamily: FARMDB_FONTS.bold,
                fontSize: ui.font(17),
                color: FARMDB_COLORS.text,
              }}
            >
              No Modules Assigned
            </Text>
            <Text
              style={{
                fontFamily: FARMDB_FONTS.regular,
                fontSize: ui.font(13),
                color: FARMDB_COLORS.textMuted,
              }}
            >
              This account currently has all modules set to Hidden. Ask your Farm Admin to grant module access or switch accounts.
            </Text>
            <Pressable
              style={{
                backgroundColor: FARMDB_COLORS.accent,
                borderRadius: 10,
                paddingHorizontal: ui.space(14),
                paddingVertical: ui.space(10),
                alignSelf: 'flex-start',
              }}
              onPress={handleSignOut}
            >
              <Text
                style={{
                  fontFamily: FARMDB_FONTS.bold,
                  fontSize: ui.font(13),
                  color: '#ffffff',
                }}
              >
                Sign Out
              </Text>
            </Pressable>
          </View>
        ) : activeSection === 'livestock' ? (
          <LivestockListView
            onOpenFamilyTree={(animalId) => {
              setFamilyFocusAnimalId(animalId);
              setActiveSection('family_tree');
            }}
          />
        ) : activeSection === 'ownerships' ? (
          <OwnershipsView onOpenNetwork={() => setActiveSection('network')} />
        ) : activeSection === 'family_tree' ? (
          <FamilyTreeView initialAnimalId={familyFocusAnimalId} />
        ) : activeSection === 'production' ? (
          <ProductionView />
        ) : activeSection === 'medical' ? (
          <MedicalView />
        ) : activeSection === 'financial' ? (
          <FinancialView />
        ) : activeSection === 'alerts' ? (
          <AlertsView onCheckDueNow={async () => (await checkNow()).length} />
        ) : activeSection === 'hr' ? (
          <HumanResourcesView onOpenSettings={() => setActiveSection('settings')} />
        ) : activeSection === 'statistics' ? (
          <FarmStatisticsView />
        ) : activeSection === 'network' ? (
          <FarmNetworkView onSignOut={handleSignOut} />
        ) : activeSection === 'backup' ? (
          <BackupView sqlController={sqlController} />
        ) : (
          <SettingsView
            sqlController={sqlController}
            onOpenBackup={() => setActiveSection('backup')}
            onSignOut={handleSignOut}
            onOpenTutorial={() => setTutorialOpen(true)}
          />
        )}

        <View pointerEvents="box-none" style={styles.capsuleDockWrap}>
          <View
            pointerEvents="box-none"
            style={[
              styles.capsuleBackdrop,
              Platform.OS === 'web'
                ? ({ backdropFilter: 'blur(14px)' } as Record<string, unknown>)
                : null,
              {
                paddingHorizontal: ui.contentPadding,
                paddingTop: ui.space(12),
                paddingBottom: ui.space(10),
              },
            ]}
          >
            <Svg
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
              preserveAspectRatio="none"
              viewBox="0 0 100 100"
            >
              <Defs>
                <LinearGradient id="dockBackdropFade" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#f5f3ee" stopOpacity="0" />
                  <Stop offset="0.4" stopColor="#f5f3ee" stopOpacity="0.6" />
                  <Stop offset="1" stopColor="#f5f3ee" stopOpacity="0.9" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100" height="100" fill="url(#dockBackdropFade)" />
            </Svg>

            <View
              style={[
                styles.capsuleNav,
                Platform.OS === 'web'
                  ? ({ backdropFilter: 'blur(20px) saturate(160%)' } as Record<string, unknown>)
                  : null,
                {
                  maxWidth: ui.isTablet ? 580 : 480,
                  padding: ui.space(5),
                  gap: ui.isCompactPhone ? 2 : 4,
                },
              ]}
            >
              {primarySections.map((section) => {
                const isActive = activeSection === section.id;
                const showBadge = section.id === 'alerts' && openAlerts > 0;
                return (
                  <Pressable
                    key={section.id}
                    accessibilityLabel={section.label}
                    style={[
                      styles.capsuleTabItem,
                      isActive &&
                      (iconMode
                        ? styles.capsuleTabItemActiveIcon
                        : styles.capsuleTabItemActive),
                      {
                        minHeight: Math.max(42, ui.chipHeight + 6),
                        paddingVertical: ui.space(5),
                        paddingHorizontal: ui.isCompactPhone ? 4 : 6,
                      },
                    ]}
                    onPress={() => {
                      if (section.id !== 'family_tree') {
                        setFamilyFocusAnimalId(null);
                      }
                      setActiveSection(section.id);
                    }}
                  >
                    {iconMode ? (
                      <View style={styles.capsuleIconWrap}>
                        <AppIcon
                          name={getTabIconName(section.id)}
                          size={ui.font(20)}
                          color={
                            isActive ? '#ffffff' : FARMDB_COLORS.textMuted
                          }
                        />
                        {showBadge ? (
                          <View
                            style={[
                              styles.iconTabBadge,
                              isActive && styles.tabBadgeActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.tabBadgeText,
                                isActive && styles.tabBadgeTextActive,
                              ]}
                            >
                              {openAlerts > 99 ? '99+' : openAlerts}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    ) : (
                      <View style={styles.tabInnerStack}>
                        <View style={styles.capsuleIconWrap}>
                          <AppIcon
                            name={getTabIconName(section.id)}
                            size={ui.font(17)}
                            color={
                              isActive ? '#ffffff' : FARMDB_COLORS.textMuted
                            }
                          />
                          {showBadge ? (
                            <View
                              style={[
                                styles.iconTabBadge,
                                isActive && styles.tabBadgeActive,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.tabBadgeText,
                                  isActive && styles.tabBadgeTextActive,
                                ]}
                              >
                                {openAlerts > 99 ? '99+' : openAlerts}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <Text
                          style={[
                            styles.tabText,
                            isActive && styles.tabTextActive,
                            {
                              fontSize: Math.min(ui.font(10), ui.isCompactPhone ? 10.5 : 11.5),
                              textAlign: 'center',
                            },
                          ]}
                          numberOfLines={2}
                          maxFontSizeMultiplier={1.15}
                        >
                          {section.shortLabel}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </View>

      {/* Offcanvas Hamburger Drawer (mirrors Desktop Sidebar) */}
      <Modal
        visible={drawerOpen}
        transparent
        animationType="none"
        onRequestClose={() => closeDrawer()}
      >
        <View style={styles.drawerRoot}>
          <Animated.View
            style={[
              styles.drawerOverlay,
              {
                opacity: drawerProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.48],
                }),
              },
            ]}
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              accessibilityLabel="Close menu"
              onPress={() => closeDrawer()}
            />
          </Animated.View>

          <Animated.View
            style={[
              styles.drawerPanel,
              {
                width: drawerWidth,
                transform: [{ translateX: drawerTranslateX }],
              },
            ]}
          >
            <SafeAreaView style={styles.drawerSafe} edges={['top', 'left', 'bottom']}>
              <View style={styles.drawerBrand}>
                <View style={styles.drawerBrandMark}>
                  <AppIcon name="field" size={24} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.drawerBrandTitle, { fontSize: ui.font(17) }]}>
                    farmDB
                  </Text>
                  <Text
                    style={[styles.drawerBrandSub, { fontSize: ui.font(12) }]}
                    numberOfLines={1}
                  >
                    {ui.settings.farmName}
                  </Text>
                </View>
                <Pressable
                  onPress={() => closeDrawer()}
                  style={styles.drawerCloseBtn}
                  accessibilityLabel="Close menu"
                  hitSlop={8}
                >
                  <AppIcon name="close" size={16} color="#d7e3db" />
                </Pressable>
              </View>

              <ScrollView
                style={styles.drawerScroll}
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                overScrollMode="never"
                contentContainerStyle={{
                  paddingVertical: ui.space(10),
                  gap: ui.space(4),
                }}
              >
                {drawerNavSections.map((section) => {
                  const isActive = activeSection === section.id;
                  const badgeCount = getCountForSection(section.id);
                  const isInBottomBar = PRIMARY_MOBILE_TABS.includes(section.id);
                  return (
                    <Pressable
                      key={section.id}
                      style={[
                        styles.drawerNavItem,
                        isActive && styles.drawerNavItemActive,
                        { minHeight: Math.max(42, ui.chipHeight + 4) },
                      ]}
                      onPress={() => navigateToSection(section.id)}
                    >
                      <View style={styles.drawerNavLeft}>
                        <AppIcon
                          name={getTabIconName(section.id)}
                          size={ui.font(18)}
                          color={isActive ? '#ffffff' : '#d7e3db'}
                        />
                        <Text
                          style={[
                            styles.drawerNavText,
                            isActive && styles.drawerNavTextActive,
                            { fontSize: ui.font(14) },
                          ]}
                          numberOfLines={2}
                        >
                          {section.label}
                        </Text>
                      </View>
                      <View style={styles.drawerNavRight}>
                        {!isInBottomBar && !isActive ? (
                          <View style={styles.drawerSecondaryDot} />
                        ) : null}
                        {badgeCount !== null ? (
                          <View style={styles.drawerBadge}>
                            <Text style={[styles.drawerBadgeText, { fontSize: ui.font(11) }]}>
                              {badgeCount}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={styles.drawerFooter}>
                <Pressable
                  style={[
                    styles.drawerNavItem,
                    { minHeight: Math.max(40, ui.chipHeight + 2), paddingVertical: ui.space(8) },
                  ]}
                  onPress={() => closeDrawer(() => setTutorialOpen(true))}
                >
                  <View style={styles.drawerNavLeft}>
                    <AppIcon name="note" size={ui.font(18)} color="#b7e4c7" />
                    <Text
                      style={[
                        styles.drawerNavText,
                        { fontSize: ui.font(14), color: '#e6f2ec' },
                      ]}
                      numberOfLines={2}
                    >
                      App Guide
                    </Text>
                  </View>
                </Pressable>

                {canAccountViewModule(activeAccount, 'settings') ? (
                  <Pressable
                    style={[
                      styles.drawerNavItem,
                      activeSection === 'settings' && styles.drawerNavItemActive,
                      { minHeight: Math.max(40, ui.chipHeight + 2), paddingVertical: ui.space(8) },
                    ]}
                    onPress={() => navigateToSection('settings')}
                  >
                    <View style={styles.drawerNavLeft}>
                      <AppIcon
                        name="settings"
                        size={ui.font(18)}
                        color={activeSection === 'settings' ? '#ffffff' : '#d7e3db'}
                      />
                      <Text
                        style={[
                          styles.drawerNavText,
                          activeSection === 'settings' && styles.drawerNavTextActive,
                          { fontSize: ui.font(14) },
                        ]}
                        numberOfLines={2}
                      >
                        Settings
                      </Text>
                    </View>
                  </Pressable>
                ) : null}

                <Pressable
                  style={[
                    styles.drawerNavItem,
                    { minHeight: Math.max(40, ui.chipHeight + 2), paddingVertical: ui.space(8) },
                  ]}
                  onPress={() => closeDrawer(() => handleSignOut())}
                >
                  <View style={styles.drawerNavLeft}>
                    <AppIcon name="farmer" size={ui.font(18)} color="#b7e4c7" />
                    <Text
                      style={[
                        styles.drawerNavText,
                        { fontSize: ui.font(14), color: '#e6f2ec' },
                      ]}
                      numberOfLines={2}
                    >
                      Sign Out
                    </Text>
                  </View>
                </Pressable>
              </View>
            </SafeAreaView>
          </Animated.View>
        </View>
      </Modal>

      <TutorialModal
        visible={tutorialOpen}
        activeAccount={activeAccount}
        activeSection={activeSection}
        onClose={() => setTutorialOpen(false)}
      />
    </SafeAreaView>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    JetBrainsMono_600SemiBold,
    JetBrainsMono_700Bold,
  });
  const [sqlController, setSqlController] = useState<ExpoSqlController | null>(
    null
  );
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    installWebScrollbarStyles();
    let cancelled = false;

    async function bootstrap() {
      try {
        const controller = await createExpoSqliteController('farmdb.db');
        await runMigrations(controller.driver);
        if (!cancelled) {
          setSqlController(controller);
        }
      } catch (err) {
        if (!cancelled) {
          setInitError(
            err instanceof Error ? err.message : 'Failed to initialize SQLite.'
          );
        }
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  if (initError) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.center}>
          <Text style={styles.errorTitle}>SQLite Initialization Error</Text>
          <Text style={styles.errorMsg}>{initError}</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (!sqlController || (!fontsLoaded && !fontError)) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.center}>
          <AppIcon name="barn" size={52} />
          <ActivityIndicator
            size="large"
            color={FARMDB_COLORS.accent}
            style={{ marginTop: 14 }}
          />
          <Text
            style={[
              styles.loadingText,
              fontsLoaded ? { fontFamily: FARMDB_FONTS.medium } : null,
            ]}
          >
            Opening local farmDB database...
          </Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <FarmDbProvider driver={sqlController.driver}>
        <UiScaleProvider>
          <AnimalQuickPreviewProvider>
            <MobileShell sqlController={sqlController} />
          </AnimalQuickPreviewProvider>
        </UiScaleProvider>
      </FarmDbProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: FARMDB_COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: FARMDB_COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: FARMDB_COLORS.border,
  },
  brandLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  headerAccountTrigger: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  brandMark: {
    backgroundColor: FARMDB_COLORS.accentSoft,
    borderWidth: 1,
    borderColor: '#cce3d6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    fontFamily: FARMDB_FONTS.extrabold,
    color: FARMDB_COLORS.darkHeader,
    letterSpacing: -0.3,
  },
  subBrand: {
    fontFamily: FARMDB_FONTS.medium,
    color: FARMDB_COLORS.textMuted,
    marginTop: 1,
  },
  hamburgerBtn: {
    backgroundColor: FARMDB_COLORS.cardAlt,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: FARMDB_COLORS.accentSoft,
    borderBottomWidth: 1,
    borderBottomColor: '#a8d5be',
  },
  alertBannerTitle: {
    fontFamily: FARMDB_FONTS.bold,
    color: '#173e2b',
  },
  alertBannerBody: {
    fontFamily: FARMDB_FONTS.regular,
    color: FARMDB_COLORS.accent,
  },
  alertBannerBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: FARMDB_COLORS.accent,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertBannerDismiss: {
    padding: 4,
  },
  body: {
    flex: 1,
    position: 'relative',
  },
  capsuleDockWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  capsuleBackdrop: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  capsuleNav: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        backgroundColor: 'rgba(255, 255, 255, 0.68)',
        borderColor: 'rgba(255, 255, 255, 0.85)',
        boxShadow: '0 8px 24px rgba(19, 34, 25, 0.14)',
      },
      ios: {
        backgroundColor: 'rgba(255, 255, 255, 0.76)',
        borderColor: 'rgba(255, 255, 255, 0.86)',
        shadowColor: '#132219',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      default: {
        backgroundColor: 'rgba(255, 255, 255, 0.82)',
        borderColor: 'rgba(29, 58, 41, 0.14)',
      },
    }),
  },
  capsuleTabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  capsuleTabItemActive: {
    backgroundColor: 'rgba(45, 106, 79, 0.9)',
  },
  capsuleTabItemActiveIcon: {
    backgroundColor: 'rgba(45, 106, 79, 0.16)',
    borderWidth: 1.5,
    borderColor: FARMDB_COLORS.accent,
  },
  tabInnerStack: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  capsuleIconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  iconTabBadge: {
    position: 'absolute',
    top: -6,
    right: -10,
    backgroundColor: FARMDB_COLORS.warnBg,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.warnBorder,
    borderRadius: 999,
    paddingHorizontal: 4,
    minWidth: 16,
    alignItems: 'center',
  },
  tabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabText: {
    fontFamily: FARMDB_FONTS.semibold,
    color: FARMDB_COLORS.textMuted,
  },
  tabTextActive: {
    color: '#ffffff',
    fontFamily: FARMDB_FONTS.bold,
  },
  tabBadge: {
    backgroundColor: FARMDB_COLORS.warnBg,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.warnBorder,
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  tabBadgeActive: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  tabBadgeText: {
    fontSize: 9,
    fontFamily: FARMDB_FONTS.monoBold,
    color: FARMDB_COLORS.warnText,
  },
  tabBadgeTextActive: {
    color: FARMDB_COLORS.accent,
  },
  drawerRoot: {
    flex: 1,
    flexDirection: 'row',
  },
  drawerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0e1912',
  },
  drawerPanel: {
    height: '100%',
    backgroundColor: '#17271d',
    borderRightWidth: 1,
    borderRightColor: '#24382c',
  },
  drawerSafe: {
    flex: 1,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  drawerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  drawerBrandMark: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#e6f2ec',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerBrandTitle: {
    fontFamily: FARMDB_FONTS.bold,
    color: '#f4f7f4',
  },
  drawerBrandSub: {
    fontFamily: FARMDB_FONTS.regular,
    color: '#a8bdb0',
    marginTop: 1,
  },
  drawerCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerScroll: {
    flex: 1,
  },
  drawerNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  drawerNavItemActive: {
    backgroundColor: '#2d6a4f',
  },
  drawerNavLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  drawerNavText: {
    fontFamily: FARMDB_FONTS.medium,
    color: '#d7e3db',
    flexShrink: 1,
  },
  drawerNavTextActive: {
    fontFamily: FARMDB_FONTS.semibold,
    color: '#ffffff',
  },
  drawerNavRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  drawerSecondaryDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(183, 228, 199, 0.45)',
  },
  drawerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  drawerBadgeText: {
    fontSize: 11,
    fontFamily: FARMDB_FONTS.semibold,
    color: '#eef5f0',
  },
  drawerFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 10,
    gap: 4,
  },
  center: {
    flex: 1,
    backgroundColor: FARMDB_COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: FARMDB_COLORS.textMuted,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: FARMDB_COLORS.danger,
  },
  errorMsg: {
    fontSize: 14,
    color: FARMDB_COLORS.text,
    marginTop: 8,
    textAlign: 'center',
  },
});
