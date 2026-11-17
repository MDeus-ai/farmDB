import React, { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getTutorialStepsForAccount,
  type AppSectionId,
  type FarmAccount,
} from '@farmdb/core';
import { FARMDB_COLORS, FARMDB_FONTS, useUiScale } from '../theme/uiScale';
import { AppIcon } from './FarmIcons';

interface TutorialModalProps {
  visible: boolean;
  activeAccount: FarmAccount | null | undefined;
  activeSection: AppSectionId;
  onClose: () => void;
}

export function TutorialModal({
  visible,
  activeAccount,
  activeSection,
  onClose,
}: TutorialModalProps) {
  const ui = useUiScale();
  const steps = useMemo(
    () => getTutorialStepsForAccount(activeAccount),
    [activeAccount]
  );

  const [stepIndex, setStepIndex] = useState(0);
  const bodyScrollRef = useRef<ComponentRef<typeof ScrollView> | null>(null);

  useEffect(() => {
    if (!visible) return;
    const matchIdx = steps.findIndex((s) => s.targetSection === activeSection);
    setStepIndex(matchIdx >= 0 ? matchIdx : 0);
  }, [visible, activeSection, steps]);

  useEffect(() => {
    if (!visible) return;
    bodyScrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [visible, stepIndex]);

  const currentStep = steps[stepIndex] ?? steps[0];

  if (!currentStep) {
    return null;
  }

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;
  const progressPercent = Math.round(((stepIndex + 1) / steps.length) * 100);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.safeWrap} edges={['top', 'bottom']}>
          <View style={styles.sheet}>
            {/* Forest-Green Header */}
            <View style={styles.header}>
              <View style={styles.headerTopRow}>
                <View style={styles.kickerPill}>
                  <Text style={[styles.kickerText, { fontSize: ui.font(10) }]}>
                    GUIDE {stepIndex + 1} OF {steps.length} · {currentStep.category.toUpperCase()}
                  </Text>
                </View>

                <Pressable
                  onPress={onClose}
                  style={styles.closeBtn}
                  accessibilityLabel="Exit guide"
                  hitSlop={8}
                >
                  <AppIcon name="close" size={16} color="#e6f2ec" />
                </Pressable>
              </View>

              <Text style={[styles.title, { fontSize: ui.font(18) }]}>
                {currentStep.title}
              </Text>

              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${progressPercent}%` },
                  ]}
                />
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
                overScrollMode="never"
                contentContainerStyle={{ gap: 6, paddingTop: 4 }}
              >
                {steps.map((step, idx) => {
                  const active = idx === stepIndex;
                  return (
                    <Pressable
                      key={step.id}
                      style={[styles.chapterChip, active && styles.chapterChipActive]}
                      onPress={() => setStepIndex(idx)}
                    >
                      <Text
                        style={[
                          styles.chapterChipText,
                          active && styles.chapterChipTextActive,
                          { fontSize: ui.font(11) },
                        ]}
                      >
                        {idx + 1}. {step.title.split(' (')[0]!.split(' & ')[0]}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Body */}
            <ScrollView
              ref={bodyScrollRef}
              style={styles.bodyScroll}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              overScrollMode="never"
              contentContainerStyle={{
                padding: ui.space(16),
                gap: ui.space(14),
              }}
            >
              <View style={styles.summaryBox}>
                <Text style={[styles.sectionHeading, { fontSize: ui.font(11) }]}>
                  IN SIMPLE WORDS
                </Text>
                <Text
                  style={[
                    styles.summaryText,
                    { fontSize: ui.font(14), lineHeight: ui.lineHeight(14, 1.45) },
                  ]}
                >
                  {currentStep.summary}
                </Text>
              </View>

              <View style={{ gap: ui.space(8) }}>
                <Text style={[styles.sectionHeading, { fontSize: ui.font(11) }]}>
                  CARDS, BUTTONS &amp; FIELDS EXPLAINED
                </Text>
                {currentStep.cardsAndFeatures.map((feat) => (
                  <View key={feat.name} style={styles.featureCard}>
                    <Text style={[styles.featureTitle, { fontSize: ui.font(14) }]}>
                      {feat.name}
                    </Text>
                    <Text
                      style={[
                        styles.featureDesc,
                        { fontSize: ui.font(13), lineHeight: ui.lineHeight(13, 1.45) },
                      ]}
                    >
                      {feat.explanation}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={{ gap: ui.space(8) }}>
                <Text style={[styles.sectionHeading, { fontSize: ui.font(11) }]}>
                  HOW TO USE IT STEP-BY-STEP
                </Text>
                {currentStep.howToSteps.map((stepLine, i) => (
                  <View key={stepLine} style={styles.howToRow}>
                    <View
                      style={[
                        styles.howToNum,
                        {
                          minWidth: ui.font(24),
                          minHeight: ui.font(24),
                          borderRadius: 999,
                          paddingHorizontal: 5,
                        },
                      ]}
                    >
                      <Text style={[styles.howToNumText, { fontSize: ui.font(12) }]}>
                        {i + 1}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.howToText,
                        { fontSize: ui.font(13), lineHeight: ui.lineHeight(13, 1.45) },
                      ]}
                    >
                      {stepLine}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.tipCard}>
                <Text style={[styles.tipLabel, { fontSize: ui.font(12) }]}>
                  Helpful Tip
                </Text>
                <Text
                  style={[
                    styles.tipText,
                    { fontSize: ui.font(13), lineHeight: ui.lineHeight(13, 1.45) },
                  ]}
                >
                  {currentStep.proTip}
                </Text>
              </View>
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              <Pressable
                style={[
                  styles.prevBtn,
                  isFirst && styles.disabledBtn,
                  { minHeight: ui.controlHeight },
                ]}
                disabled={isFirst}
                onPress={() => setStepIndex((prev) => Math.max(0, prev - 1))}
              >
                <AppIcon
                  name="chevronLeft"
                  size={ui.font(16)}
                  color={FARMDB_COLORS.text}
                />
                <Text style={[styles.prevBtnText, { fontSize: ui.font(13) }]}>
                  Prev
                </Text>
              </Pressable>

              <Text style={[styles.progressLabel, { fontSize: ui.font(12) }]}>
                {progressPercent}%
              </Text>

              {isLast ? (
                <Pressable
                  style={[styles.nextBtn, { minHeight: ui.controlHeight }]}
                  onPress={onClose}
                >
                  <Text style={[styles.nextBtnText, { fontSize: ui.font(13) }]}>
                    Finish
                  </Text>
                  <AppIcon name="check" size={ui.font(15)} color="#ffffff" />
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.nextBtn, { minHeight: ui.controlHeight }]}
                  onPress={() =>
                    setStepIndex((prev) => Math.min(steps.length - 1, prev + 1))
                  }
                >
                  <Text style={[styles.nextBtnText, { fontSize: ui.font(13) }]}>
                    Next
                  </Text>
                  <AppIcon name="chevronRight" size={ui.font(16)} color="#ffffff" />
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
    backgroundColor: 'rgba(14, 25, 18, 0.64)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  safeWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  sheet: {
    flex: 1,
    maxHeight: '94%',
    backgroundColor: FARMDB_COLORS.bg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#244734',
    overflow: 'hidden',
  },
  header: {
    backgroundColor: FARMDB_COLORS.darkHeader,
    padding: 16,
    gap: 10,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  kickerPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(64, 145, 108, 0.28)',
    borderWidth: 1,
    borderColor: 'rgba(183, 228, 199, 0.28)',
  },
  kickerText: {
    fontFamily: FARMDB_FONTS.bold,
    color: '#b7e4c7',
    letterSpacing: 0.4,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: FARMDB_FONTS.extrabold,
    color: '#ffffff',
  },
  progressTrack: {
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#74c69d',
  },
  chapterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  chapterChipActive: {
    backgroundColor: FARMDB_COLORS.accent,
    borderColor: '#74c69d',
  },
  chapterChipText: {
    fontFamily: FARMDB_FONTS.semibold,
    color: '#d7e3db',
  },
  chapterChipTextActive: {
    color: '#ffffff',
    fontFamily: FARMDB_FONTS.bold,
  },
  bodyScroll: {
    flex: 1,
  },
  summaryBox: {
    backgroundColor: FARMDB_COLORS.surface,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    borderRadius: 14,
    padding: 14,
    gap: 5,
  },
  sectionHeading: {
    fontFamily: FARMDB_FONTS.bold,
    color: FARMDB_COLORS.accent,
    letterSpacing: 0.5,
  },
  summaryText: {
    fontFamily: FARMDB_FONTS.medium,
    color: FARMDB_COLORS.text,
  },
  featureCard: {
    backgroundColor: FARMDB_COLORS.surface,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  featureTitle: {
    fontFamily: FARMDB_FONTS.bold,
    color: FARMDB_COLORS.darkHeader,
  },
  featureDesc: {
    fontFamily: FARMDB_FONTS.regular,
    color: FARMDB_COLORS.textMuted,
  },
  howToRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: FARMDB_COLORS.surface,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    borderRadius: 12,
    padding: 11,
  },
  howToNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: FARMDB_COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  howToNumText: {
    fontFamily: FARMDB_FONTS.bold,
    fontSize: 12,
    color: FARMDB_COLORS.accent,
  },
  howToText: {
    flex: 1,
    minWidth: 0,
    fontFamily: FARMDB_FONTS.regular,
    color: FARMDB_COLORS.text,
  },
  tipCard: {
    backgroundColor: FARMDB_COLORS.accentSoft,
    borderWidth: 1,
    borderColor: '#a8d5be',
    borderRadius: 12,
    padding: 12,
    gap: 3,
  },
  tipLabel: {
    fontFamily: FARMDB_FONTS.bold,
    color: '#173e2b',
  },
  tipText: {
    fontFamily: FARMDB_FONTS.regular,
    color: '#173e2b',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    padding: 12,
    backgroundColor: FARMDB_COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: FARMDB_COLORS.border,
  },
  prevBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    backgroundColor: FARMDB_COLORS.cardAlt,
  },
  prevBtnText: {
    fontFamily: FARMDB_FONTS.semibold,
    color: FARMDB_COLORS.text,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: FARMDB_COLORS.accent,
  },
  nextBtnText: {
    fontFamily: FARMDB_FONTS.bold,
    color: '#ffffff',
  },
  progressLabel: {
    fontFamily: FARMDB_FONTS.bold,
    color: FARMDB_COLORS.textMuted,
  },
  disabledBtn: {
    opacity: 0.45,
  },
});
