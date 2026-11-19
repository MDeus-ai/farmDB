import React from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type AppUpdateInfo } from '@farmdb/core';
import { FARMDB_COLORS, FARMDB_FONTS, useUiScale } from '../theme/uiScale';
import { AppIcon } from './FarmIcons';

interface UpdateAvailableModalProps {
  visible: boolean;
  currentVersion: string;
  update: AppUpdateInfo | null;
  otaChannel: string | null;
  installing: boolean;
  progressLabel: string | null;
  errorText: string | null;
  onInstall: () => void;
  onClose: () => void;
}

function formatPublishedDate(raw: string | null): string | null {
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function UpdateAvailableModal({
  visible,
  currentVersion,
  update,
  otaChannel,
  installing,
  progressLabel,
  errorText,
  onInstall,
  onClose,
}: UpdateAvailableModalProps) {
  const ui = useUiScale();

  if (!visible || !update) {
    return null;
  }

  const fixes =
    update.fixes.length > 0
      ? update.fixes
      : ['General stability, UI polish, and offline reliability improvements.'];
  const dateLabel = formatPublishedDate(update.publishedAt);
  const versionTransition =
    update.version !== currentVersion
      ? `v${currentVersion} → v${update.version}`
      : `v${update.version} · OTA Patch`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!installing) {
          onClose();
        }
      }}
    >
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.safeWrap} edges={['top', 'bottom']}>
          <View
            style={[
              styles.card,
              {
                borderRadius: Math.max(16, ui.radius + 2),
                padding: ui.space(16),
                gap: ui.space(12),
              },
            ]}
          >
            <View style={styles.headerRow}>
              <View style={[styles.headerMain, { gap: ui.space(10) }]}>
                <View style={styles.iconBadge}>
                  <AppIcon name="download" size={ui.font(20)} />
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <Text style={[styles.title, { fontSize: ui.font(18) }]}>
                    Update Available
                  </Text>
                  <View style={styles.metaPills}>
                    <View style={styles.versionPill}>
                      <Text style={[styles.versionPillText, { fontSize: ui.font(11) }]}>
                        {versionTransition}
                      </Text>
                    </View>
                    {dateLabel ? (
                      <View style={styles.datePill}>
                        <Text style={[styles.datePillText, { fontSize: ui.font(11) }]}>
                          {dateLabel}
                        </Text>
                      </View>
                    ) : otaChannel ? (
                      <View style={styles.datePill}>
                        <Text style={[styles.datePillText, { fontSize: ui.font(11) }]}>
                          {otaChannel} channel
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>

              <Pressable
                disabled={installing}
                onPress={onClose}
                style={[styles.closeBtn, installing && { opacity: 0.5 }]}
                accessibilityLabel="Close update details"
                hitSlop={8}
              >
                <AppIcon name="close" size={ui.font(15)} color={FARMDB_COLORS.text} />
              </Pressable>
            </View>

            <ScrollView
              style={{ maxHeight: Math.round(ui.height * 0.48) }}
              contentContainerStyle={{ gap: ui.space(10) }}
              showsVerticalScrollIndicator={false}
            >
              {update.summary ? (
                <Text style={[styles.summaryText, { fontSize: ui.font(13) }]}>
                  {update.summary}
                </Text>
              ) : null}

              <View
                style={[
                  styles.fixesBox,
                  { padding: ui.space(12), borderRadius: ui.radius, gap: ui.space(8) },
                ]}
              >
                <Text style={[styles.fixesHeading, { fontSize: ui.font(13) }]}>
                  Fixes &amp; Improvements in v{update.version}
                </Text>
                {fixes.map((fix, idx) => (
                  <View key={`${idx}-${fix.slice(0, 20)}`} style={styles.fixRow}>
                    <View style={{ marginTop: 2 }}>
                      <AppIcon name="check" size={ui.font(14)} color={FARMDB_COLORS.accent} />
                    </View>
                    <Text style={[styles.fixText, { fontSize: ui.font(12.5) }]}>
                      {fix}
                    </Text>
                  </View>
                ))}
              </View>

              <View
                style={[
                  styles.safetyNote,
                  { padding: ui.space(10), borderRadius: Math.max(10, ui.radius - 2) },
                ]}
              >
                <AppIcon name="databaseCheck" size={ui.font(16)} />
                <Text style={[styles.safetyText, { fontSize: ui.font(12) }]}>
                  Your local SQLite database, livestock photos, and farm settings stay completely safe.
                </Text>
              </View>

              {installing ? (
                <View style={[styles.progressBox, { padding: ui.space(10) }]}>
                  <ActivityIndicator size="small" color={FARMDB_COLORS.accent} />
                  <Text style={[styles.progressText, { fontSize: ui.font(12) }]}>
                    {progressLabel || 'Downloading and applying update...'}
                  </Text>
                </View>
              ) : null}

              {errorText ? (
                <View style={[styles.errorBox, { padding: ui.space(10) }]}>
                  <Text style={[styles.errorText, { fontSize: ui.font(12) }]}>
                    {errorText}
                  </Text>
                </View>
              ) : null}
            </ScrollView>

            <View style={[styles.footerActions, { gap: ui.space(8) }]}>
              <Pressable
                disabled={installing}
                style={[
                  styles.secondaryBtn,
                  installing && { opacity: 0.6 },
                  {
                    minHeight: ui.controlHeight,
                    paddingHorizontal: ui.space(14),
                    paddingVertical: ui.space(9),
                    borderRadius: Math.max(10, ui.radius - 2),
                  },
                ]}
                onPress={onClose}
              >
                <Text style={[styles.secondaryBtnText, { fontSize: ui.font(13) }]}>
                  Remind Me Later
                </Text>
              </Pressable>

              {update.canDirectInstall ? (
                <Pressable
                  disabled={installing}
                  style={[
                    styles.primaryBtn,
                    installing && { opacity: 0.7 },
                    {
                      minHeight: ui.controlHeight,
                      paddingHorizontal: ui.space(16),
                      paddingVertical: ui.space(9),
                      borderRadius: Math.max(10, ui.radius - 2),
                    },
                  ]}
                  onPress={onInstall}
                >
                  <AppIcon name="download" size={ui.font(15)} />
                  <Text style={[styles.primaryBtnText, { fontSize: ui.font(13) }]}>
                    {installing ? 'Applying...' : 'Download & Restart'}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  style={[
                    styles.primaryBtn,
                    {
                      minHeight: ui.controlHeight,
                      paddingHorizontal: ui.space(16),
                      paddingVertical: ui.space(9),
                      borderRadius: Math.max(10, ui.radius - 2),
                    },
                  ]}
                  onPress={() => {
                    void Linking.openURL(update.releaseUrl);
                  }}
                >
                  <AppIcon name="web" size={ui.font(15)} />
                  <Text style={[styles.primaryBtnText, { fontSize: ui.font(13) }]}>
                    View on GitHub
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(14, 25, 18, 0.56)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  safeWrap: {
    width: '100%',
    maxWidth: 480,
  },
  card: {
    width: '100%',
    backgroundColor: FARMDB_COLORS.surface,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: FARMDB_COLORS.accentSoft,
    borderWidth: 1,
    borderColor: '#9fd0b6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: FARMDB_FONTS.extrabold,
    color: FARMDB_COLORS.text,
  },
  metaPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  versionPill: {
    backgroundColor: FARMDB_COLORS.accentSoft,
    borderWidth: 1,
    borderColor: '#9fd0b6',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  versionPillText: {
    fontFamily: FARMDB_FONTS.monoBold,
    color: FARMDB_COLORS.accentHover,
  },
  datePill: {
    backgroundColor: FARMDB_COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  datePillText: {
    fontFamily: FARMDB_FONTS.semibold,
    color: FARMDB_COLORS.textMuted,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: FARMDB_COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryText: {
    fontFamily: FARMDB_FONTS.regular,
    color: FARMDB_COLORS.text,
  },
  fixesBox: {
    backgroundColor: FARMDB_COLORS.cardAlt,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
  },
  fixesHeading: {
    fontFamily: FARMDB_FONTS.bold,
    color: FARMDB_COLORS.text,
  },
  fixRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  fixText: {
    flex: 1,
    fontFamily: FARMDB_FONTS.regular,
    color: FARMDB_COLORS.text,
  },
  safetyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: FARMDB_COLORS.accentSoft,
  },
  safetyText: {
    flex: 1,
    fontFamily: FARMDB_FONTS.semibold,
    color: '#173e2b',
  },
  progressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: FARMDB_COLORS.cardAlt,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    borderRadius: 10,
  },
  progressText: {
    flex: 1,
    fontFamily: FARMDB_FONTS.semibold,
    color: FARMDB_COLORS.text,
  },
  errorBox: {
    backgroundColor: FARMDB_COLORS.warnBg,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.warnBorder,
    borderRadius: 10,
  },
  errorText: {
    fontFamily: FARMDB_FONTS.semibold,
    color: FARMDB_COLORS.warnText,
  },
  footerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  secondaryBtn: {
    flexGrow: 1,
    minWidth: 124,
    backgroundColor: FARMDB_COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontFamily: FARMDB_FONTS.bold,
    color: FARMDB_COLORS.text,
    textAlign: 'center',
  },
  primaryBtn: {
    flexGrow: 1,
    minWidth: 144,
    flexDirection: 'row',
    gap: 7,
    backgroundColor: FARMDB_COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontFamily: FARMDB_FONTS.bold,
    color: '#ffffff',
    textAlign: 'center',
  },
});
