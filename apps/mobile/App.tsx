import React, { useEffect, useState } from 'react';
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
  useFarmSummary,
  type SqlDriver,
} from '@farmdb/db';
import { createExpoSqliteDriver } from './src/db/mobileDriver';
import { LivestockListView } from './src/components/LivestockListView';
import { SectionPlaceholder } from './src/components/SectionPlaceholder';

function MobileShell() {
  const [activeSection, setActiveSection] = useState<AppSectionId>('livestock');
  const summaryQuery = useFarmSummary();
  const summary = summaryQuery.data;

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
          <Text style={styles.dbBadgeText}>SQLite Offline</Text>
        </View>
      </View>

      <View style={styles.body}>
        {activeSection === 'livestock' ? (
          <LivestockListView />
        ) : activeSection === 'production' ? (
          <SectionPlaceholder
            section={currentSection}
            tableName="product_records"
            recordCount={summary?.productRecordCount ?? 0}
          />
        ) : activeSection === 'medical' ? (
          <SectionPlaceholder
            section={currentSection}
            tableName="medical_records"
            recordCount={summary?.medicalRecordCount ?? 0}
          />
        ) : activeSection === 'financial' ? (
          <SectionPlaceholder
            section={currentSection}
            tableName="financial_logs"
            recordCount={summary?.financialLogCount ?? 0}
          />
        ) : (
          <SectionPlaceholder
            section={currentSection}
            tableName="alerts"
            recordCount={summary?.openAlertCount ?? 0}
          />
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
  const [driver, setDriver] = useState<SqlDriver | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const sqliteDriver = await createExpoSqliteDriver('farmdb.db');
        await runMigrations(sqliteDriver);
        if (!cancelled) {
          setDriver(sqliteDriver);
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

  if (!driver) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#2d6a4f" />
        <Text style={styles.loadingText}>Opening local farmDB database...</Text>
      </SafeAreaView>
    );
  }

  return (
    <FarmDbProvider driver={driver}>
      <MobileShell />
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
  body: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#ddd6c8',
    paddingVertical: 6,
    paddingHorizontal: 6,
    gap: 4,
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
    fontSize: 12,
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
