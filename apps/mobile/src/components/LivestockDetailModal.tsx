import React, { useEffect, useMemo, useState } from 'react';
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
  LIVESTOCK_STATUSES,
  describeModuleAccessLevel,
  type Livestock,
  type LivestockStatus,
} from '@farmdb/core';
import {
  useAlertList,
  useDeleteLivestock,
  useLivestockDetail,
  useLivestockList,
  useMedicalRecordList,
  useModulePermissions,
  useProductRecordList,
  useUpdateLivestock,
} from '@farmdb/db';
import { deleteManagedLivestockPhoto } from '../services/imageStorage';
import { FARMDB_COLORS, FARMDB_FONTS, useUiScale } from '../theme/uiScale';
import { AppIcon, SexIcon, SpeciesIcon, StatusIcon } from './FarmIcons';
import { FarmScrollView } from './FarmScrollView';
import { ImageLightboxOverlay } from './ImageLightboxModal';

interface LivestockDetailModalProps {
  livestockId: string | null;
  onClose: () => void;
  onEdit: (animal: Livestock) => void;
  onSelectAnimal?: (id: string) => void;
  onOpenFamilyTree?: (id: string) => void;
}

export function LivestockDetailModal({
  livestockId,
  onClose,
  onEdit,
  onSelectAnimal,
  onOpenFamilyTree,
}: LivestockDetailModalProps) {
  const ui = useUiScale();
  const { canEdit, canDelete, accessLevel } = useModulePermissions('livestock');
  const iconMode = ui.settings.mobileIconMode;
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
  const updateMutation = useUpdateLivestock();
  const deleteMutation = useDeleteLivestock();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);

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

  useEffect(() => {
    setConfirmDelete(false);
    setImageViewerOpen(false);
  }, [livestockId]);

  const animal = detailQuery.data;

  async function handleStatusUpdate(nextStatus: LivestockStatus) {
    if (!animal || animal.status === nextStatus) return;
    await updateMutation.mutateAsync({
      id: animal.id,
      input: { status: nextStatus },
    });
  }

  async function handleDeleteConfirmed() {
    if (!animal || !canDelete) return;
    const oldUri = animal.imageUri;
    const removed = await deleteMutation.mutateAsync(animal.id);
    if (removed) {
      deleteManagedLivestockPhoto(oldUri);
      onClose();
    }
  }

  return (
    <Modal
      visible={Boolean(livestockId)}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (imageViewerOpen) {
          setImageViewerOpen(false);
          return;
        }
        onClose();
      }}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <View
          style={[
            styles.header,
            { paddingHorizontal: ui.contentPadding, paddingVertical: ui.space(13), gap: 10 },
          ]}
        >
          <Text
            style={[styles.headerTitle, { fontSize: ui.font(18), flex: 1, minWidth: 0 }]}
            numberOfLines={2}
          >
            {animal ? `${animal.name ?? animal.tagNumber}` : 'Animal Profile'}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityLabel="Close profile"
          >
            <AppIcon name="close" size={ui.font(22)} color={FARMDB_COLORS.text} />
          </Pressable>
        </View>

        <FarmScrollView
          contentContainerStyle={[
            styles.content,
            { padding: ui.contentPadding, paddingBottom: ui.space(32) },
          ]}
        >
          {detailQuery.isLoading || !animal ? (
            <Text style={styles.loadingText}>
              {detailQuery.isLoading
                ? 'Loading SQLite record...'
                : 'Animal record not found.'}
            </Text>
          ) : (
            <>
              {animal.imageUri ? (
                <Pressable
                  style={styles.heroImageWrap}
                  onPress={() => setImageViewerOpen(true)}
                  accessibilityLabel="View full animal image"
                >
                  <Image source={{ uri: animal.imageUri }} style={styles.heroImage} />
                </Pressable>
              ) : (
                <View style={styles.heroPlaceholder}>
                  <SpeciesIcon
                    species={animal.species}
                    sex={animal.sex}
                    size={ui.font(44)}
                    color={FARMDB_COLORS.accent}
                  />
                </View>
              )}

              <View style={[styles.badgeRow, { flexWrap: 'wrap', gap: 8 }]}>
                <View style={styles.tagPill}>
                  <Text style={[styles.tagText, { fontSize: ui.font(12) }]}>
                    {animal.tagNumber}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, flexWrap: 'wrap' }}>
                  <SpeciesIcon
                    species={animal.species}
                    sex={animal.sex}
                    size={ui.font(17)}
                    color={FARMDB_COLORS.textMuted}
                  />
                  <SexIcon sex={animal.sex} size={ui.font(14)} />
                  <StatusIcon status={animal.status} size={ui.font(15)} />
                  <Text style={[styles.statusMeta, { fontSize: ui.font(13), flexShrink: 1 }]}>
                    {formatSpeciesLabel(animal.species, animal.sex)} · {formatSexLabel(animal.sex)} · {formatStatusLabel(animal.status)}
                  </Text>
                </View>
              </View>

              <View style={[styles.nameActionRow, { flexWrap: 'wrap' }]}>
                <Text
                  style={[
                    styles.animalName,
                    {
                      marginTop: 0,
                      marginBottom: 0,
                      flex: 1,
                      minWidth: 140,
                      fontSize: ui.font(21),
                    },
                  ]}
                  numberOfLines={2}
                >
                  {animal.name ?? 'Unnamed Animal'}
                </Text>
                {animal.imageUri ? (
                  <Pressable
                    style={[styles.nameViewImageBtn, { minHeight: Math.max(32, ui.chipHeight - 4) }]}
                    onPress={() => setImageViewerOpen(true)}
                    accessibilityLabel="View full image"
                  >
                    <AppIcon name="expand" size={ui.font(13)} color={FARMDB_COLORS.accent} />
                    <Text style={[styles.nameViewImageText, { fontSize: ui.font(12) }]}>
                      View Image
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              <View style={[styles.factsGrid, { gap: ui.space(8) }]}>
                <View
                  style={[
                    styles.factCard,
                    {
                      padding: ui.space(10),
                      borderRadius: Math.max(8, ui.radius - 3),
                      flexBasis: ui.isCompactPhone && (ui.isLargeText || ui.isLargeDensity) ? '100%' : '45%',
                    },
                  ]}
                >
                  <Text style={[styles.factLabel, { fontSize: ui.font(11) }]}>Breed</Text>
                  <Text style={[styles.factValue, { fontSize: ui.font(14) }]}>
                    {animal.breed ?? '—'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.factCard,
                    {
                      padding: ui.space(10),
                      borderRadius: Math.max(8, ui.radius - 3),
                      flexBasis: ui.isCompactPhone && (ui.isLargeText || ui.isLargeDensity) ? '100%' : '45%',
                    },
                  ]}
                >
                  <Text style={[styles.factLabel, { fontSize: ui.font(11) }]}>Age</Text>
                  <Text style={[styles.factValue, { fontSize: ui.font(14) }]}>
                    {formatAnimalAge(animal.dob)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.factCard,
                    {
                      padding: ui.space(10),
                      borderRadius: Math.max(8, ui.radius - 3),
                      flexBasis: ui.isCompactPhone && (ui.isLargeText || ui.isLargeDensity) ? '100%' : '45%',
                    },
                  ]}
                >
                  <Text style={[styles.factLabel, { fontSize: ui.font(11) }]}>
                    Date of Birth
                  </Text>
                  <Text style={[styles.factValue, { fontSize: ui.font(14) }]}>
                    {formatDisplayDate(animal.dob, ui.settings.dateFormat)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.factCard,
                    {
                      padding: ui.space(10),
                      borderRadius: Math.max(8, ui.radius - 3),
                      flexBasis: ui.isCompactPhone && (ui.isLargeText || ui.isLargeDensity) ? '100%' : '45%',
                    },
                  ]}
                >
                  <Text style={[styles.factLabel, { fontSize: ui.font(11) }]}>
                    Species & Sex
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                    <SexIcon sex={animal.sex} size={ui.font(14)} />
                    <Text style={[styles.factValue, { fontSize: ui.font(14) }]}>
                      {formatSpeciesLabel(animal.species, animal.sex)} · {formatSexLabel(animal.sex)}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                <Text style={[styles.sectionLabel, { fontSize: ui.font(12) }]}>
                  Quick Status Update
                </Text>
                {!canEdit || !canDelete ? (
                  <Text
                    style={{
                      fontFamily: FARMDB_FONTS.bold,
                      fontSize: ui.font(11),
                      color: FARMDB_COLORS.textMuted,
                    }}
                  >
                    {describeModuleAccessLevel(accessLevel)}
                  </Text>
                ) : null}
              </View>
              <View style={[styles.statusRow, { flexWrap: 'wrap' }]}>
                {LIVESTOCK_STATUSES.map((st) => {
                  const active = animal.status === st;
                  return (
                    <Pressable
                      key={st}
                      style={[
                        styles.statusChip,
                        active && styles.statusChipActive,
                        !canEdit && { opacity: 0.6 },
                        {
                          minHeight: ui.chipHeight,
                          minWidth: 96,
                          paddingHorizontal: ui.space(10),
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 5,
                        },
                      ]}
                      onPress={() => {
                        if (canEdit) {
                          void handleStatusUpdate(st);
                        }
                      }}
                      disabled={!canEdit || updateMutation.isPending}
                    >
                      <StatusIcon
                        status={st}
                        size={ui.font(14)}
                        color={active ? FARMDB_COLORS.accentHover : undefined}
                      />
                      <Text
                        style={[
                          styles.statusChipText,
                          active && styles.statusChipTextActive,
                          { fontSize: ui.font(13) },
                        ]}
                      >
                        {formatStatusLabel(st)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={[styles.roadmapCard, { padding: ui.space(12), borderRadius: Math.max(8, ui.radius - 3) }]}>
                <Text
                  style={[
                    styles.roadmapText,
                    { fontSize: ui.font(13), lineHeight: ui.lineHeight(13, 1.42) },
                  ]}
                >
                  Milk:{' '}
                  {isFemaleMilkProducingAnimal(animal)
                    ? `${formatVolume(totalYield, ui.settings.volumeUnit)} (${records.length} logs)`
                    : animal.sex === 'male'
                      ? 'N/A (Male)'
                      : 'N/A (Non-dairy)'}{' '}
                  · Medical: {medicalRecords.length} record(s) · Open
                  alerts: {openAlerts.length}
                </Text>
                {medicalRecords[0] ? (
                  <Text
                    style={[
                      styles.roadmapTextBold,
                      {
                        marginTop: 6,
                        fontSize: ui.font(13),
                        lineHeight: ui.lineHeight(13, 1.42),
                      },
                    ]}
                  >
                    Latest care ({formatDisplayDate(medicalRecords[0].date, ui.settings.dateFormat)}):{' '}
                    {medicalRecords[0].condition} — {medicalRecords[0].treatment}
                  </Text>
                ) : null}
              </View>

              {pedigree ? (
                <View
                  style={[
                    styles.lineageBox,
                    { padding: ui.space(12), borderRadius: Math.max(10, ui.radius - 2) },
                  ]}
                >
                  <View style={[styles.lineageHeaderRow, { flexWrap: 'wrap' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
                      <AppIcon name="tree" size={ui.font(16)} />
                      <Text style={[styles.sectionLabel, { fontSize: ui.font(13), marginBottom: 0 }]}>
                        Family &amp; Lineage
                      </Text>
                    </View>
                    {onOpenFamilyTree ? (
                      <Pressable
                        style={styles.treeJumpBtn}
                        onPress={() => {
                          onOpenFamilyTree(animal.id);
                          onClose();
                        }}
                      >
                        <AppIcon name="tree" size={ui.font(13)} />
                        <Text style={[styles.treeJumpBtnText, { fontSize: ui.font(11) }]}>
                          Open Tree
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>

                  <View style={styles.lineagePillWrap}>
                    {pedigree.sire ? (
                      <Pressable
                        style={[styles.lineagePill, { flexWrap: 'wrap' }]}
                        onPress={() => onSelectAnimal?.(pedigree.sire!.animal.id)}
                      >
                        <Text style={[styles.lineagePillRole, { fontSize: ui.font(10) }]}>
                          SIRE
                        </Text>
                        <Text style={[styles.lineagePillText, { fontSize: ui.font(12) }]} numberOfLines={2}>
                          {pedigree.sire.animal.name ?? pedigree.sire.animal.tagNumber} ({pedigree.sire.animal.tagNumber})
                        </Text>
                      </Pressable>
                    ) : (
                      <Text style={[styles.lineageMutedText, { fontSize: ui.font(12) }]}>
                        Sire: Unknown founder
                      </Text>
                    )}

                    {pedigree.dam ? (
                      <Pressable
                        style={[styles.lineagePill, { flexWrap: 'wrap' }]}
                        onPress={() => onSelectAnimal?.(pedigree.dam!.animal.id)}
                      >
                        <Text style={[styles.lineagePillRole, { fontSize: ui.font(10) }]}>
                          DAM
                        </Text>
                        <Text style={[styles.lineagePillText, { fontSize: ui.font(12) }]} numberOfLines={2}>
                          {pedigree.dam.animal.name ?? pedigree.dam.animal.tagNumber} ({pedigree.dam.animal.tagNumber})
                        </Text>
                      </Pressable>
                    ) : (
                      <Text style={[styles.lineageMutedText, { fontSize: ui.font(12) }]}>
                        Dam: Unknown founder
                      </Text>
                    )}

                    {pedigree.directOffspring.map((child) => (
                      <Pressable
                        key={child.animal.id}
                        style={[styles.lineagePill, styles.lineageOffspringPill, { flexWrap: 'wrap' }]}
                        onPress={() => onSelectAnimal?.(child.animal.id)}
                      >
                        <Text style={[styles.lineagePillRole, { fontSize: ui.font(10) }]}>
                          OFFSPRING
                        </Text>
                        <Text style={[styles.lineagePillText, { fontSize: ui.font(12) }]} numberOfLines={2}>
                          {child.animal.name ?? child.animal.tagNumber} ({child.animal.tagNumber})
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={styles.actionsRow}>
                {canEdit ? (
                  <Pressable
                    style={[
                      styles.editBtn,
                      {
                        minHeight: ui.controlHeight,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 7,
                      },
                    ]}
                    onPress={() => onEdit(animal)}
                  >
                    <AppIcon
                      name="edit"
                      size={ui.font(16)}
                      color={FARMDB_COLORS.accent}
                    />
                    <Text style={[styles.editBtnText, { fontSize: ui.font(14) }]}>
                      {iconMode ? 'Edit' : 'Edit Details / Photo'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              {canDelete ? (
                confirmDelete ? (
                <View style={[styles.confirmRow, { flexWrap: 'wrap' }]}>
                  <Pressable
                    style={[
                      styles.confirmDeleteBtn,
                      {
                        minHeight: ui.controlHeight,
                        minWidth: 112,
                        paddingHorizontal: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      },
                    ]}
                    onPress={() => void handleDeleteConfirmed()}
                    disabled={deleteMutation.isPending}
                  >
                    <AppIcon name="check" size={ui.font(16)} color={FARMDB_COLORS.danger} />
                    <Text style={[styles.confirmDeleteText, { fontSize: ui.font(14) }]}>
                      {deleteMutation.isPending ? 'Deleting...' : 'Confirm'}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.keepBtn,
                      {
                        minHeight: ui.controlHeight,
                        minWidth: 112,
                        paddingHorizontal: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      },
                    ]}
                    onPress={() => setConfirmDelete(false)}
                  >
                    <AppIcon name="close" size={ui.font(16)} color={FARMDB_COLORS.text} />
                    <Text style={[styles.keepBtnText, { fontSize: ui.font(14) }]}>
                      Keep
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  style={[
                    styles.deleteBtn,
                    {
                      minHeight: ui.controlHeight,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    },
                  ]}
                  disabled={deleteMutation.isPending}
                  onPress={() => {
                    if (ui.settings.confirmBeforeDelete) {
                      setConfirmDelete(true);
                    } else {
                      void handleDeleteConfirmed();
                    }
                  }}
                >
                  <AppIcon
                    name="trash"
                    size={ui.font(16)}
                    color={FARMDB_COLORS.danger}
                  />
                  <Text style={[styles.deleteBtnText, { fontSize: ui.font(14) }]}>
                    Delete Animal
                  </Text>
                </Pressable>
              )
              ) : null}
            </>
          )}
        </FarmScrollView>

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
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f3ee',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd6c8',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: FARMDB_FONTS.bold,
    color: '#1c241e',
  },
  closeText: {
    fontSize: 15,
    fontFamily: FARMDB_FONTS.semibold,
    color: '#2d6a4f',
  },
  content: {
    padding: 18,
    paddingBottom: 36,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: FARMDB_FONTS.regular,
    color: '#5d675f',
  },
  heroImageWrap: {
    position: 'relative',
    marginBottom: 14,
    borderRadius: 14,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: 220,
    borderRadius: 14,
    backgroundColor: '#f0ece3',
  },
  heroViewImagePill: {
    display: 'none',
  },
  heroViewImageText: {
    color: '#ffffff',
    fontFamily: FARMDB_FONTS.semibold,
  },
  nameActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 8,
    marginBottom: 14,
  },
  nameViewImageBtn: {
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
  nameViewImageText: {
    color: FARMDB_COLORS.accent,
    fontFamily: FARMDB_FONTS.bold,
  },
  heroPlaceholder: {
    width: '100%',
    height: 150,
    borderRadius: 14,
    backgroundColor: '#eae4d7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heroPlaceholderText: {
    color: '#5d675f',
    fontFamily: FARMDB_FONTS.semibold,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tagPill: {
    backgroundColor: '#eae4d7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 7,
  },
  tagText: {
    fontFamily: FARMDB_FONTS.monoBold,
    fontSize: 13,
    color: '#1c241e',
  },
  statusMeta: {
    fontSize: 13,
    fontFamily: FARMDB_FONTS.semibold,
    color: '#2d6a4f',
  },
  animalName: {
    fontSize: 22,
    fontFamily: FARMDB_FONTS.extrabold,
    color: '#1c241e',
    marginTop: 8,
    marginBottom: 14,
  },
  factsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  factCard: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ddd6c8',
    borderRadius: 10,
    padding: 10,
  },
  factLabel: {
    fontSize: 11,
    fontFamily: FARMDB_FONTS.medium,
    color: '#5d675f',
  },
  factValue: {
    fontSize: 14,
    fontFamily: FARMDB_FONTS.bold,
    color: '#1c241e',
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: FARMDB_FONTS.bold,
    color: '#1c241e',
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statusChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#ddd6c8',
    backgroundColor: '#ffffff',
  },
  statusChipActive: {
    backgroundColor: FARMDB_COLORS.accentSoft,
    borderWidth: 1.5,
    borderColor: FARMDB_COLORS.accent,
  },
  statusChipText: {
    fontSize: 12,
    fontFamily: FARMDB_FONTS.semibold,
    color: '#1c241e',
  },
  statusChipTextActive: {
    color: FARMDB_COLORS.accentHover,
    fontFamily: FARMDB_FONTS.bold,
  },
  roadmapCard: {
    backgroundColor: '#e6f2ec',
    borderRadius: 10,
    padding: 12,
    marginBottom: 18,
  },
  roadmapText: {
    fontSize: 13,
    fontFamily: FARMDB_FONTS.regular,
    color: '#1d4935',
    lineHeight: 18,
  },
  roadmapTextBold: {
    fontSize: 13,
    fontFamily: FARMDB_FONTS.bold,
    color: '#1d4935',
    lineHeight: 18,
  },
  actionsRow: {
    marginBottom: 10,
  },
  editBtn: {
    backgroundColor: '#2d6a4f',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  editBtnText: {
    color: '#ffffff',
    fontFamily: FARMDB_FONTS.bold,
    fontSize: 15,
  },
  deleteBtn: {
    backgroundColor: '#fdeceb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteBtnText: {
    color: '#b42318',
    fontFamily: FARMDB_FONTS.bold,
    fontSize: 14,
  },
  confirmRow: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmDeleteBtn: {
    flex: 1,
    backgroundColor: FARMDB_COLORS.dangerSoft,
    borderWidth: 1.5,
    borderColor: FARMDB_COLORS.danger,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmDeleteText: {
    color: FARMDB_COLORS.danger,
    fontFamily: FARMDB_FONTS.bold,
    fontSize: 14,
  },
  keepBtn: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ddd6c8',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  keepBtnText: {
    color: '#1c241e',
    fontFamily: FARMDB_FONTS.bold,
    fontSize: 14,
  },
  lineageBox: {
    backgroundColor: '#faf8f4',
    borderWidth: 1,
    borderColor: '#ddd6c8',
    marginBottom: 16,
    gap: 10,
  },
  lineageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  treeJumpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#e6f2ec',
    borderWidth: 1,
    borderColor: '#b7dfc6',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  treeJumpBtnText: {
    color: '#214e3a',
    fontFamily: FARMDB_FONTS.bold,
  },
  lineagePillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  lineagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ddd6c8',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  lineageOffspringPill: {
    borderColor: '#b7dfc6',
    backgroundColor: '#f4faf6',
  },
  lineagePillRole: {
    fontFamily: FARMDB_FONTS.extrabold,
    color: '#2d6a4f',
  },
  lineagePillText: {
    fontFamily: FARMDB_FONTS.semibold,
    color: '#1c241e',
    flexShrink: 1,
  },
  lineageMutedText: {
    fontFamily: FARMDB_FONTS.regular,
    color: '#5d675f',
    paddingVertical: 4,
  },
});
