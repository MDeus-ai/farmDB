import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  formatAnimalAge,
  formatIsoDate,
  formatSpeciesLabel,
  formatStatusLabel,
  LIVESTOCK_STATUSES,
  SPECIES_LIST,
  type Livestock,
  type LivestockFilter,
  type LivestockStatus,
  type Species,
} from '@farmdb/core';
import {
  useCreateLivestock,
  useDeleteLivestock,
  useFarmSummary,
  useLivestockList,
} from '@farmdb/db';
import { deleteManagedLivestockPhoto } from '../services/imageStorage';
import { LivestockDetailModal } from './LivestockDetailModal';
import { LivestockFormModal } from './LivestockFormModal';

const SAMPLE_HERD = [
  {
    species: 'cow' as const,
    tagNumber: 'COW-402',
    name: 'Bessie',
    breed: 'Holstein',
    dob: '2022-03-14',
    status: 'active' as const,
  },
  {
    species: 'cow' as const,
    tagNumber: 'COW-409',
    name: 'Daisy',
    breed: 'Jersey',
    dob: '2023-07-02',
    status: 'active' as const,
  },
  {
    species: 'cow' as const,
    tagNumber: 'COW-318',
    name: 'Willow',
    breed: 'Ayrshire',
    dob: '2021-11-20',
    status: 'active' as const,
  },
];

export function LivestockListView() {
  const [search, setSearch] = useState('');
  const [species, setSpecies] = useState<Species | 'all'>('all');
  const [status, setStatus] = useState<LivestockStatus | 'all'>('active');
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Livestock | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filter: LivestockFilter = useMemo(
    () => ({ search, species, status }),
    [search, species, status]
  );

  const listQuery = useLivestockList(filter);
  const allForTagsQuery = useLivestockList({});
  const summaryQuery = useFarmSummary();
  const createMutation = useCreateLivestock();
  const deleteMutation = useDeleteLivestock();

  const existingTags = useMemo(
    () => (allForTagsQuery.data ?? []).map((item) => item.tagNumber),
    [allForTagsQuery.data]
  );

  const items = listQuery.data ?? [];
  const summary = summaryQuery.data;

  async function handleLoadSample() {
    const existing = new Set(existingTags);
    for (const animal of SAMPLE_HERD) {
      if (!existing.has(animal.tagNumber)) {
        await createMutation.mutateAsync(animal);
      }
    }
  }

  async function handleDelete(item: Livestock) {
    const removed = await deleteMutation.mutateAsync(item.id);
    if (removed) {
      deleteManagedLivestockPhoto(item.imageUri);
      if (selectedId === item.id) {
        setSelectedId(null);
      }
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Active Herd</Text>
          <Text style={styles.statValue}>{summary?.activeLivestock ?? 0}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Cows</Text>
          <Text style={styles.statValue}>{summary?.cowCount ?? 0}</Text>
        </View>
        <Pressable
          style={styles.addBtn}
          onPress={() => {
            setEditing(null);
            setModalVisible(true);
          }}
        >
          <Text style={styles.addBtnText}>+ Add Animal</Text>
        </Pressable>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Search by tag, name, or breed..."
        value={search}
        onChangeText={setSearch}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.filterRow}
      >
        {(['all', ...LIVESTOCK_STATUSES] as const).map((st) => (
          <Pressable
            key={`st-${st}`}
            style={[styles.filterChip, status === st && styles.filterChipActive]}
            onPress={() => setStatus(st)}
          >
            <Text
              style={[
                styles.filterChipText,
                status === st && styles.filterChipTextActive,
              ]}
            >
              {st === 'all' ? 'All Status' : formatStatusLabel(st)}
            </Text>
          </Pressable>
        ))}

        {(['all', ...SPECIES_LIST] as const).map((sp) => (
          <Pressable
            key={`sp-${sp}`}
            style={[
              styles.filterChip,
              species === sp && styles.filterChipSpeciesActive,
            ]}
            onPress={() => setSpecies(sp)}
          >
            <Text
              style={[
                styles.filterChipText,
                species === sp && styles.filterChipTextActive,
              ]}
            >
              {sp === 'all' ? 'All Species' : formatSpeciesLabel(sp)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No livestock found</Text>
            <Text style={styles.emptySub}>
              {listQuery.isLoading
                ? 'Reading local SQLite database...'
                : 'Add an animal with camera photo or load sample cows into local SQLite.'}
            </Text>
            {!listQuery.isLoading && (summary?.totalLivestock ?? 0) === 0 ? (
              <Pressable
                style={styles.sampleBtn}
                onPress={() => void handleLoadSample()}
                disabled={createMutation.isPending}
              >
                <Text style={styles.sampleBtnText}>Load Sample Herd (3 Cows)</Text>
              </Pressable>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => setSelectedId(item.id)}
          >
            <View style={styles.cardRow}>
              {item.imageUri ? (
                <Image source={{ uri: item.imageUri }} style={styles.thumb} />
              ) : (
                <View style={styles.thumbPlaceholder}>
                  <Text style={styles.thumbPlaceholderText}>
                    {item.tagNumber.slice(0, 3)}
                  </Text>
                </View>
              )}

              <View style={styles.cardMain}>
                <View style={styles.cardHeader}>
                  <View style={styles.tagPill}>
                    <Text style={styles.tagText}>{item.tagNumber}</Text>
                  </View>
                  <Text style={styles.speciesMeta}>
                    {formatSpeciesLabel(item.species)} · {formatStatusLabel(item.status)}
                  </Text>
                </View>

                <Text style={styles.animalName}>
                  {item.name ?? 'Unnamed Animal'}
                </Text>
                <Text style={styles.animalMeta}>
                  {item.breed ?? '—'} · {formatIsoDate(item.dob)}
                  {item.dob ? ` (${formatAnimalAge(item.dob)})` : ''}
                </Text>

                <View style={styles.cardActions}>
                  <Pressable
                    style={styles.secondaryAction}
                    onPress={() => {
                      setEditing(item);
                      setModalVisible(true);
                    }}
                  >
                    <Text style={styles.secondaryActionText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    style={styles.dangerAction}
                    onPress={() => void handleDelete(item)}
                  >
                    <Text style={styles.dangerActionText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Pressable>
        )}
      />

      <LivestockDetailModal
        livestockId={selectedId}
        onClose={() => setSelectedId(null)}
        onEdit={(animal) => {
          setSelectedId(null);
          setEditing(animal);
          setModalVisible(true);
        }}
      />

      <LivestockFormModal
        visible={modalVisible}
        editing={editing}
        existingTags={existingTags}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ddd6c8',
    borderRadius: 10,
    padding: 10,
  },
  statLabel: {
    fontSize: 11,
    color: '#5d675f',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1c241e',
    marginTop: 2,
  },
  addBtn: {
    backgroundColor: '#2d6a4f',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  addBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  searchInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ddd6c8',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 10,
    color: '#1c241e',
  },
  chipScroll: {
    flexGrow: 0,
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 8,
  },
  filterChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ddd6c8',
    backgroundColor: '#ffffff',
  },
  filterChipActive: {
    backgroundColor: '#17271d',
    borderColor: '#17271d',
  },
  filterChipSpeciesActive: {
    backgroundColor: '#2d6a4f',
    borderColor: '#2d6a4f',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1c241e',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  listContent: {
    paddingBottom: 24,
    gap: 10,
  },
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ddd6c8',
    borderRadius: 12,
    padding: 12,
  },
  cardRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: '#f0ece3',
  },
  thumbPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: '#e6f2ec',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbPlaceholderText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2d6a4f',
  },
  cardMain: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  tagPill: {
    backgroundColor: '#f0ece3',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: {
    fontWeight: '700',
    fontSize: 12,
    color: '#1c241e',
  },
  speciesMeta: {
    fontSize: 12,
    color: '#5d675f',
    fontWeight: '600',
  },
  animalName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1c241e',
  },
  animalMeta: {
    fontSize: 12,
    color: '#5d675f',
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 9,
  },
  secondaryAction: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd6c8',
    backgroundColor: '#ffffff',
  },
  secondaryActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1c241e',
  },
  dangerAction: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#fdeceb',
  },
  dangerActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#b42318',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ddd6c8',
    borderRadius: 12,
    padding: 22,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1c241e',
  },
  emptySub: {
    fontSize: 13,
    color: '#5d675f',
    textAlign: 'center',
    marginTop: 6,
  },
  sampleBtn: {
    marginTop: 14,
    backgroundColor: '#e6f2ec',
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  sampleBtnText: {
    color: '#2d6a4f',
    fontWeight: '700',
    fontSize: 13,
  },
});
