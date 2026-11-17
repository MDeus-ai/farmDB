import React, { useEffect, useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { APP_SECTIONS, type AppSectionId } from '@farmdb/core';
import {
  FarmDbProvider,
  runMigrations,
  useAlertBackgroundWorker,
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
import { FinancialView } from './src/components/FinancialView';
import { LivestockListView } from './src/components/LivestockListView';
import { MedicalView } from './src/components/MedicalView';
import { ProductionView } from './src/components/ProductionView';

ensureMobileNotificationHandler();

function MobileShell({ sqlController }: { sqlController: ExpoSqlController }) {
  const [activeSection, setActiveSection] = useState<AppSectionId>('livestock');
  const [dueBanners, setDueBanners] = useState<AlertNotificationPayload[]>([]);
  const summaryQuery = useFarmSummary();
  const summary = summaryQuery.data;

  const dispatcher = useMemo(
    () => ({
      deliver: dispatchMobileNotification,
    }),
    []
  );

  const { checkNow } = useAlertBackgroundWorker(dispatcher, {
    intervalMs: 60_000,
    onDelivered: (items) => {
      setDueBanners((prev) => [...items, ...prev].slice(0, 3));
    },
  });

  const currentSection =
    APP_SECTIONS.find((s) => s.id === activeSection) ?? APP_SECTIONS[0]!;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>farmDB</Text>
          <Text style={styles.subBrand}>{currentSection.label}</Text>
        </View>
        <View style={styles.dbBadge}>
          <Text style={styles.dbBadgeText}>
            SQLite Offline
            {(summary?.openAlertCount ?? 0) > 0
              ? ` · ${summary?.openAlertCount} Alerts`
              : ''}
          </Text>
        </View>
      </View>

      {dueBanners.length > 0 ? (
        <View style={styles.alertBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.alertBannerTitle}>{dueBanners[0]!.title}</Text>
            <Text style={styles.alertBannerBody}>{dueBanners[0]!.body}</Text>
          </View>
          <Pressable
            onPress={() => setActiveSection('alerts')}
            style={styles.alertBannerBtn}
          >
            <Text style={styles.alertBannerBtnText}>View</Text>
          </Pressable>
          <Pressable
            onPress={() => setDueBanners([])}
            style={styles.alertBannerDismiss}
          >
            <Text style={styles.alertBannerDismissText}>✕</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.body}>
        {activeSection === 'livestock' ? (
          <LivestockListView />
        ) : activeSection === 'production' ? (
          <ProductionView />
        ) : activeSection === 'medical' ? (
          <MedicalView />
        ) : activeSection === 'financial' ? (
          <FinancialView />
        ) : activeSection === 'alerts' ? (
          <AlertsView onCheckDueNow={async () => (await checkNow()).length} />
        ) : (
          <BackupView sqlController={sqlController} />
        )}
      </View>

      <View style={styles.tabBar}>
        {APP_SECTIONS.map((section) => {
          const isActive = activeSection === section.id;
          return (
            <Pressable
              key={section.id}
              style={[styles.tabItem, isActive && styles.tabItemActive]}
              onPress={() => setActiveSection(section.id)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {section.shortLabel}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  const [sqlController, setSqlController] = useState<ExpoSqlController | null>(
    null
  );
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
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
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorTitle}>SQLite Initialization Error</Text>
        <Text style={styles.errorMsg}>{initError}</Text>
      </SafeAreaView>
    );
  }

  if (!sqlController) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#2d6a4f" />
        <Text style={styles.loadingText}>Opening local farmDB database...</Text>
      </SafeAreaView>
    );
  }

  return (
    <FarmDbProvider driver={sqlController.driver}>
      <MobileShell sqlController={sqlController} />
    </FarmDbProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f3ee',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd6c8',
  },
  brand: {
    fontSize: 18,
    fontWeight: '800',
    color: '#17271d',
  },
  subBrand: {
    fontSize: 12,
    color: '#5d675f',
    marginTop: 1,
  },
  dbBadge: {
    backgroundColor: '#e6f2ec',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  dbBadgeText: {
    color: '#2d6a4f',
    fontSize: 11,
    fontWeight: '700',
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#e6f2ec',
    borderBottomWidth: 1,
    borderBottomColor: '#a8d5be',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  alertBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#173e2b',
  },
  alertBannerBody: {
    fontSize: 12,
    color: '#2d6a4f',
  },
  alertBannerBtn: {
    backgroundColor: '#2d6a4f',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
  },
  alertBannerBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  alertBannerDismiss: {
    padding: 4,
  },
  alertBannerDismissText: {
    color: '#173e2b',
    fontWeight: '700',
  },
  body: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#ddd6c8',
    paddingVertical: 6,
    paddingHorizontal: 4,
    gap: 2,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabItemActive: {
    backgroundColor: '#2d6a4f',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5d675f',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  center: {
    flex: 1,
    backgroundColor: '#f5f3ee',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#5d675f',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#b42318',
  },
  errorMsg: {
    fontSize: 14,
    color: '#1c241e',
    marginTop: 8,
    textAlign: 'center',
  },
});
