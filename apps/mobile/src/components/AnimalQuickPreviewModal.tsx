import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  buildAnimalPedigree,
  formatAnimalAge,
  formatDisplayDate,
  formatSexLabel,
  formatSpeciesLabel,
  formatStatusLabel,
  formatVolume,
  isFemaleMilkProducingAnimal,
} from '@farmdb/core';
import {
  useAlertList,
  useLivestockDetail,
  useLivestockList,
  useMedicalRecordList,
  useProductRecordList,
} from '@farmdb/db';
import { FARMDB_COLORS, FARMDB_FONTS, useUiScale } from '../theme/uiScale';
import { AppIcon, SexIcon, SpeciesIcon, StatusIcon } from './FarmIcons';
import { FarmScrollView } from './FarmScrollView';
import { ImageLightboxOverlay } from './ImageLightboxModal';

interface MobilePreviewContextValue {
  openPreview: (livestockId: string) => void;
  closePreview: () => void;
}

const MobilePreviewContext = createContext<MobilePreviewContextValue>({
  openPreview: () => {},
  closePreview: () => {},
});

export function useAnimalQuickPreview() {
  return useContext(MobilePreviewContext);
}

/**
 * Compact touchable eye icon button placed beside livestock references outside Herd Registry
 * to quick-preview full animal details and photo.
 */
export function AnimalEyeButton({
  livestockId,
  size,
  color = FARMDB_COLORS.accent,
}: {
  livestockId: string | null | undefined;
  size?: number;
  color?: string;
}) {
  const ui = useUiScale();
  const { openPreview } = useAnimalQuickPreview();
  if (!livestockId) {
    return null;
  }
  const iconSize = size ?? ui.font(14);
  const pillDim = Math.max(28, iconSize + 14);
  return (
    <Pressable
      hitSlop={8}
      accessibilityLabel="Quick preview livestock"
      style={[
        styles.eyePillBtn,
        { minWidth: pillDim, minHeight: pillDim, paddingHorizontal: 4 },
      ]}
      onPress={() => openPreview(livestockId)}
    >
      <AppIcon name="eye" size={iconSize} color={color} />
    </Pressable>
  );
}

function MobileAnimalQuickPreviewModal({
  livestockId,
  onSelectAnimal,
  onClose,
}: {
  livestockId: string | null;
  onSelectAnimal: (id: string) => void;
  onClose: () => void;
}) {
  const ui = useUiScale();
  const detailQuery = useLivestockDetail(livestockId);
  const allLivestockQuery = useLivestockList({});
  const productionQuery = useProductRecordList(
    livestockId ? { livestockId } : undefined
  );
  const medicalQuery = useMedicalRecordList(
    livestockId ? { livestockId } : undefined
  );
  const alertsQuery = useAlertList(
    livestockId ? { livestockId, status: 'open' } : undefined
  );
  const [imageViewerOpen, setImageViewerOpen] = useState(false);

  useEffect(() => {
    setImageViewerOpen(false);
  }, [livestockId]);

  const records = livestockId ? (productionQuery.data ?? []) : [];
  const medicalRecords = livestockId ? (medicalQuery.data ?? []) : [];
  const openAlerts = livestockId ? (alertsQuery.data ?? []) : [];
  const allLivestock = allLivestockQuery.data ?? [];
  const pedigree = useMemo(
    () =>
      livestockId ? buildAnimalPedigree(livestockId, allLivestock, records) : null,
    [livestockId, allLivestock, records]
  );
  const totalYield = records.reduce((sum, r) => sum + r.yieldAmount, 0);
  const animal = detailQuery.data;

  return (
    <Modal
      visible={Boolean(livestockId)}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (imageViewerOpen) {
          setImageViewerOpen(false);
          return;
        }
        onClose();
      }}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <SafeAreaView style={styles.safeWrap} edges={['top', 'bottom', 'left', 'right']}>
          <View
            style={[
              styles.card,
              { borderRadius: Math.max(16, ui.radius + 2), maxHeight: '88%' },
            ]}
          >
            <View style={styles.header}>
              <Text style={[styles.headerTitle, { fontSize: ui.font(16) }]} numberOfLines={1}>
                {animal ? `${animal.name ?? animal.tagNumber} Preview` : 'Livestock Preview'}
              </Text>
              <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close preview">
                <AppIcon name="close" size={ui.font(18)} color={FARMDB_COLORS.text} />
              </Pressable>
            </View>

            <FarmScrollView
              fillParent={false}
              contentContainerStyle={{ padding: ui.space(14), gap: ui.space(10) }}
            >
              {detailQuery.isLoading || !animal ? (
                <Text style={[styles.muted, { fontSize: ui.font(13) }]}>
                  {detailQuery.isLoading ? 'Loading record...' : 'Record not found.'}
                </Text>
              ) : (
                <>
                  {animal.imageUri ? (
                    <Pressable onPress={() => setImageViewerOpen(true)}>
                      <Image source={{ uri: animal.imageUri }} style={styles.heroImage} />
                    </Pressable>
                  ) : (
                    <View style={styles.heroPlaceholder}>
                      <SpeciesIcon
                        species={animal.species}
                        sex={animal.sex}
                        size={ui.font(38)}
                        color={FARMDB_COLORS.accent}
                      />
                    </View>
                  )}

                  <View style={styles.badgeRow}>
                    <View style={styles.tagChip}>
                      <Text style={[styles.tagText, { fontSize: ui.font(12) }]}>
                        {animal.tagNumber}
                      </Text>
                    </View>
                    <View style={[styles.statusRow, { flexWrap: 'wrap', flexShrink: 1 }]}>
                      <SexIcon sex={animal.sex} size={ui.font(13)} />
                      <StatusIcon status={animal.status} size={ui.font(14)} />
                      <Text style={[styles.statusText, { fontSize: ui.font(12), flexShrink: 1 }]}>
                        {formatSpeciesLabel(animal.species, animal.sex)} · {formatSexLabel(animal.sex)} · {formatStatusLabel(animal.status)}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.nameRow, { flexWrap: 'wrap' }]}>
                    <Text style={[styles.nameTitle, { fontSize: ui.font(19), minWidth: 130 }]} numberOfLines={2}>
                      {animal.name ?? 'Unnamed Animal'}
                    </Text>
                    {animal.imageUri ? (
                      <Pressable
                        style={[styles.viewImageBtn, { minHeight: Math.max(30, ui.chipHeight - 6) }]}
                        onPress={() => setImageViewerOpen(true)}
                      >
                        <AppIcon name="expand" size={ui.font(13)} color={FARMDB_COLORS.accent} />
                        <Text style={[styles.viewImageText, { fontSize: ui.font(12) }]}>
                          View Image
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>

                  <View style={[styles.factsGrid, { gap: ui.space(8) }]}>
                    <View
                      style={[
                        styles.factBox,
                        {
                          flexBasis: ui.isCompactPhone && (ui.isLargeText || ui.isLargeDensity) ? '100%' : '45%',
                          minWidth: 124,
                        },
                      ]}
                    >
                      <Text style={[styles.factLabel, { fontSize: ui.font(11) }]}>Breed</Text>
                      <Text style={[styles.factValue, { fontSize: ui.font(13) }]}>
                        {animal.breed ?? '—'}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.factBox,
                        {
                          flexBasis: ui.isCompactPhone && (ui.isLargeText || ui.isLargeDensity) ? '100%' : '45%',
                          minWidth: 124,
                        },
                      ]}
                    >
                      <Text style={[styles.factLabel, { fontSize: ui.font(11) }]}>Age</Text>
                      <Text style={[styles.factValue, { fontSize: ui.font(13) }]}>
                        {formatAnimalAge(animal.dob)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.factBox,
                        {
                          flexBasis: ui.isCompactPhone && (ui.isLargeText || ui.isLargeDensity) ? '100%' : '45%',
                          minWidth: 124,
                        },
                      ]}
                    >
                      <Text style={[styles.factLabel, { fontSize: ui.font(11) }]}>DOB</Text>
                      <Text style={[styles.factValue, { fontSize: ui.font(13) }]}>
                        {formatDisplayDate(animal.dob, ui.settings.dateFormat)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.factBox,
                        {
                          flexBasis: ui.isCompactPhone && (ui.isLargeText || ui.isLargeDensity) ? '100%' : '45%',
                          minWidth: 124,
                        },
                      ]}
                    >
                      <Text style={[styles.factLabel, { fontSize: ui.font(11) }]}>Milk / Care</Text>
                      <Text style={[styles.factValue, { fontSize: ui.font(13) }]}>
                        {isFemaleMilkProducingAnimal(animal)
                          ? formatVolume(totalYield, ui.settings.volumeUnit)
                          : animal.sex === 'male'
                            ? 'N/A (Male)'
                            : 'N/A'} · {medicalRecords.length}m · {openAlerts.length}a
                      </Text>
                    </View>
                  </View>

                  {pedigree && (pedigree.sire || pedigree.dam) ? (
                    <View style={styles.parentsRow}>
                      {pedigree.sire ? (
                        <Pressable
                          style={[styles.parentChip, { maxWidth: '100%', flexWrap: 'wrap' }]}
                          onPress={() => onSelectAnimal(pedigree.sire!.animal.id)}
                        >
                          <Text style={[styles.parentRole, { fontSize: ui.font(10) }]}>SIRE</Text>
                          <Text style={[styles.parentText, { fontSize: ui.font(12), flexShrink: 1 }]} numberOfLines={2}>
                            {pedigree.sire.animal.name ?? pedigree.sire.animal.tagNumber} ({pedigree.sire.animal.tagNumber})
                          </Text>
                        </Pressable>
                      ) : null}
                      {pedigree.dam ? (
                        <Pressable
                          style={[styles.parentChip, { maxWidth: '100%', flexWrap: 'wrap' }]}
                          onPress={() => onSelectAnimal(pedigree.dam!.animal.id)}
                        >
                          <Text style={[styles.parentRole, { fontSize: ui.font(10) }]}>DAM</Text>
                          <Text style={[styles.parentText, { fontSize: ui.font(12), flexShrink: 1 }]} numberOfLines={2}>
                            {pedigree.dam.animal.name ?? pedigree.dam.animal.tagNumber} ({pedigree.dam.animal.tagNumber})
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                </>
              )}
            </FarmScrollView>
          </View>
        </SafeAreaView>

        <ImageLightboxOverlay
          visible={imageViewerOpen && Boolean(animal?.imageUri)}
          uri={animal?.imageUri}
          title={animal?.name ?? animal?.tagNumber}
          subtitle={
            animal
              ? `${animal.tagNumber} · ${formatSpeciesLabel(animal.species)}`
              : undefined
          }
          onClose={() => setImageViewerOpen(false)}
        />
      </View>
    </Modal>
  );
}

export function AnimalQuickPreviewProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const openPreview = useCallback((id: string) => setPreviewId(id), []);
  const closePreview = useCallback(() => setPreviewId(null), []);
  const value = useMemo(
    () => ({ openPreview, closePreview }),
    [openPreview, closePreview]
  );

  return (
    <MobilePreviewContext.Provider value={value}>
      {children}
      <MobileAnimalQuickPreviewModal
        livestockId={previewId}
        onSelectAnimal={openPreview}
        onClose={closePreview}
      />
    </MobilePreviewContext.Provider>
  );
}

const styles = StyleSheet.create({
  eyePillBtn: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: FARMDB_COLORS.accentSoft,
    borderWidth: 1,
    borderColor: '#cce3d6',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(18, 28, 21, 0.56)',
    justifyContent: 'center',
    padding: 16,
  },
  safeWrap: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  card: {
    backgroundColor: FARMDB_COLORS.surface,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: FARMDB_COLORS.cardAlt,
    borderBottomWidth: 1,
    borderBottomColor: FARMDB_COLORS.border,
  },
  headerTitle: {
    fontFamily: FARMDB_FONTS.bold,
    color: FARMDB_COLORS.text,
    flex: 1,
    minWidth: 0,
  },
  muted: {
    color: FARMDB_COLORS.textMuted,
    fontFamily: FARMDB_FONTS.regular,
  },
  heroImage: {
    width: '100%',
    height: 184,
    borderRadius: 12,
    backgroundColor: '#f0ece3',
  },
  heroPlaceholder: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    backgroundColor: '#eae4d7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  tagChip: {
    backgroundColor: '#eae4d7',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: {
    fontFamily: FARMDB_FONTS.monoBold,
    fontSize: 12,
    color: FARMDB_COLORS.text,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusText: {
    fontFamily: FARMDB_FONTS.semibold,
    fontSize: 12,
    color: FARMDB_COLORS.accent,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  nameTitle: {
    fontFamily: FARMDB_FONTS.extrabold,
    color: FARMDB_COLORS.text,
    flex: 1,
  },
  viewImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: FARMDB_COLORS.accentSoft,
    borderWidth: 1,
    borderColor: '#cce3d6',
  },
  viewImageText: {
    color: FARMDB_COLORS.accent,
    fontFamily: FARMDB_FONTS.bold,
  },
  factsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  factBox: {
    flexBasis: '46%',
    flexGrow: 1,
    backgroundColor: '#faf8f4',
    borderWidth: 1,
    borderColor: FARMDB_COLORS.surfaceMuted,
    borderRadius: 9,
    padding: 9,
    gap: 2,
  },
  factLabel: {
    fontSize: 11,
    color: FARMDB_COLORS.textMuted,
    fontFamily: FARMDB_FONTS.medium,
  },
  factValue: {
    fontSize: 13,
    color: FARMDB_COLORS.text,
    fontFamily: FARMDB_FONTS.bold,
  },
  parentsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  parentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
  },
  parentRole: {
    fontFamily: FARMDB_FONTS.extrabold,
    fontSize: 10,
    color: FARMDB_COLORS.accent,
  },
  parentText: {
    fontFamily: FARMDB_FONTS.semibold,
    fontSize: 12,
    color: FARMDB_COLORS.text,
  },
});
