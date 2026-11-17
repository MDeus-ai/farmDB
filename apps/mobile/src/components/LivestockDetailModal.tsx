import React, { useEffect, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  formatAnimalAge,
  formatIsoDate,
  formatSpeciesLabel,
  formatStatusLabel,
  LIVESTOCK_STATUSES,
  roundAmount,
  type Livestock,
  type LivestockStatus,
} from '@farmdb/core';
import {
  useAlertList,
  useDeleteLivestock,
  useLivestockDetail,
  useMedicalRecordList,
  useProductRecordList,
  useUpdateLivestock,
} from '@farmdb/db';
import { deleteManagedLivestockPhoto } from '../services/imageStorage';

interface LivestockDetailModalProps {
  livestockId: string | null;
  onClose: () => void;
  onEdit: (animal: Livestock) => void;
}

export function LivestockDetailModal({
  livestockId,
  onClose,
  onEdit,
}: LivestockDetailModalProps) {
  const detailQuery = useLivestockDetail(livestockId);
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

  const records = livestockId ? (productionQuery.data ?? []) : [];
  const medicalRecords = livestockId ? (medicalQuery.data ?? []) : [];
  const openAlerts = livestockId ? (alertsQuery.data ?? []) : [];
  const totalYield = records.reduce((sum, r) => sum + r.yieldAmount, 0);

  useEffect(() => {
    setConfirmDelete(false);
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
    if (!animal) return;
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
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {animal ? `${animal.name ?? animal.tagNumber}` : 'Animal Profile'}
          </Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.closeText}>Done</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {detailQuery.isLoading || !animal ? (
            <Text style={styles.loadingText}>
              {detailQuery.isLoading
                ? 'Loading SQLite record...'
                : 'Animal record not found.'}
            </Text>
          ) : (
            <>
              {animal.imageUri ? (
                <Image source={{ uri: animal.imageUri }} style={styles.heroImage} />
              ) : (
                <View style={styles.heroPlaceholder}>
                  <Text style={styles.heroPlaceholderText}>No Photo Stored</Text>
                </View>
              )}

              <View style={styles.badgeRow}>
                <View style={styles.tagPill}>
                  <Text style={styles.tagText}>{animal.tagNumber}</Text>
                </View>
                <Text style={styles.statusMeta}>
                  {formatSpeciesLabel(animal.species)} · {formatStatusLabel(animal.status)}
                </Text>
              </View>

              <Text style={styles.animalName}>
                {animal.name ?? 'Unnamed Animal'}
              </Text>

              <View style={styles.factsGrid}>
                <View style={styles.factCard}>
                  <Text style={styles.factLabel}>Breed</Text>
                  <Text style={styles.factValue}>{animal.breed ?? '—'}</Text>
                </View>
                <View style={styles.factCard}>
                  <Text style={styles.factLabel}>Age</Text>
                  <Text style={styles.factValue}>
                    {formatAnimalAge(animal.dob)}
                  </Text>
                </View>
                <View style={styles.factCard}>
                  <Text style={styles.factLabel}>Date of Birth</Text>
                  <Text style={styles.factValue}>
                    {formatIsoDate(animal.dob)}
                  </Text>
                </View>
                <View style={styles.factCard}>
                  <Text style={styles.factLabel}>Species</Text>
                  <Text style={styles.factValue}>
                    {formatSpeciesLabel(animal.species)}
                  </Text>
                </View>
              </View>

              <Text style={styles.sectionLabel}>Quick Status Update</Text>
              <View style={styles.statusRow}>
                {LIVESTOCK_STATUSES.map((st) => (
                  <Pressable
                    key={st}
                    style={[
                      styles.statusChip,
                      animal.status === st && styles.statusChipActive,
                    ]}
                    onPress={() => void handleStatusUpdate(st)}
                    disabled={updateMutation.isPending}
                  >
                    <Text
                      style={[
                        styles.statusChipText,
                        animal.status === st && styles.statusChipTextActive,
                      ]}
                    >
                      {formatStatusLabel(st)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.roadmapCard}>
                <Text style={styles.roadmapText}>
                  Milk: {roundAmount(totalYield).toFixed(1)} L ({records.length}{' '}
                  logs) · Medical: {medicalRecords.length} record(s) · Open
                  alerts: {openAlerts.length}
                </Text>
                {medicalRecords[0] ? (
                  <Text style={[styles.roadmapText, { marginTop: 6, fontWeight: '700' }]}>
                    Latest care ({medicalRecords[0].date}):{' '}
                    {medicalRecords[0].condition} — {medicalRecords[0].treatment}
                  </Text>
                ) : null}
              </View>

              <View style={styles.actionsRow}>
                <Pressable
                  style={styles.editBtn}
                  onPress={() => onEdit(animal)}
                >
                  <Text style={styles.editBtnText}>Edit Details / Photo</Text>
                </Pressable>
              </View>

              {confirmDelete ? (
                <View style={styles.confirmRow}>
                  <Pressable
                    style={styles.confirmDeleteBtn}
                    onPress={() => void handleDeleteConfirmed()}
                    disabled={deleteMutation.isPending}
                  >
                    <Text style={styles.confirmDeleteText}>
                      {deleteMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.keepBtn}
                    onPress={() => setConfirmDelete(false)}
                  >
                    <Text style={styles.keepBtnText}>Keep Record</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  style={styles.deleteBtn}
                  onPress={() => setConfirmDelete(true)}
                >
                  <Text style={styles.deleteBtnText}>Delete Animal</Text>
                </Pressable>
              )}
            </>
          )}
        </ScrollView>
      </View>
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
    fontWeight: '700',
    color: '#1c241e',
  },
  closeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2d6a4f',
  },
  content: {
    padding: 18,
    paddingBottom: 36,
  },
  loadingText: {
    fontSize: 14,
    color: '#5d675f',
  },
  heroImage: {
    width: '100%',
    height: 220,
    borderRadius: 14,
    backgroundColor: '#f0ece3',
    marginBottom: 14,
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
    fontWeight: '600',
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
    fontWeight: '700',
    fontSize: 13,
    color: '#1c241e',
  },
  statusMeta: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2d6a4f',
  },
  animalName: {
    fontSize: 22,
    fontWeight: '800',
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
    width: '48%',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ddd6c8',
    borderRadius: 10,
    padding: 10,
  },
  factLabel: {
    fontSize: 11,
    color: '#5d675f',
  },
  factValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1c241e',
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
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
    backgroundColor: '#2d6a4f',
    borderColor: '#2d6a4f',
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1c241e',
  },
  statusChipTextActive: {
    color: '#ffffff',
  },
  roadmapCard: {
    backgroundColor: '#e6f2ec',
    borderRadius: 10,
    padding: 12,
    marginBottom: 18,
  },
  roadmapText: {
    fontSize: 13,
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
    fontWeight: '700',
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
    fontWeight: '700',
    fontSize: 14,
  },
  confirmRow: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmDeleteBtn: {
    flex: 1,
    backgroundColor: '#b42318',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmDeleteText: {
    color: '#ffffff',
    fontWeight: '700',
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
    fontWeight: '700',
    fontSize: 14,
  },
});
