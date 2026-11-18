import React, { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  formatAnimalAge,
  formatDisplayDate,
  formatOwnershipCategoryLabel,
  formatSexLabel,
  formatSpeciesLabel,
  formatStatusLabel,
  getPrimaryOwnershipByLivestockMap,
  LIVESTOCK_STATUSES,
  sortLivestockItems,
  SPECIES_LIST,
  type Livestock,
  type LivestockFilter,
  type LivestockSex,
  type LivestockSortOption,
  describeModuleAccessLevel,
  type LivestockStatus,
  type Species,
} from '@farmdb/core';
import {
  useDeleteLivestock,
  useFarmSummary,
  useLivestockList,
  useModulePermissions,
  useOwnershipList,
} from '@farmdb/db';
import {
  getSpeciesPngSource,
  getStatusPngSource,
  MOBILE_APP_ICONS,
} from '../assets/icons';
import { deleteManagedLivestockPhoto } from '../services/imageStorage';
import {
  FARMDB_COLORS,
  FARMDB_FONTS,
  useUiScale,
} from '../theme/uiScale';
import { AppIcon, SexIcon, SpeciesIcon, StatusIcon } from './FarmIcons';
import { FarmFlatList } from './FarmScrollView';
import { LivestockDetailModal } from './LivestockDetailModal';
import { LivestockFormModal } from './LivestockFormModal';
import {
  ModernDropdown,
  type ModernDropdownOption,
} from './ModernDropdown';

interface LivestockListViewProps {
  onOpenFamilyTree?: (animalId: string) => void;
}

export function LivestockListView({ onOpenFamilyTree }: LivestockListViewProps) {
  const ui = useUiScale();
  const { canEdit, canDelete, accessLevel } = useModulePermissions('livestock');
  const iconMode = ui.settings.mobileIconMode;
  type MobileSpeciesFilter = 'all' | 'cow' | 'bull' | 'cattle' | 'goat' | 'sheep' | 'duck' | 'other';
  const [search, setSearch] = useState('');
  const [speciesChoice, setSpeciesChoice] = useState<MobileSpeciesFilter>('all');
  const [status, setStatus] = useState<LivestockStatus | 'all'>('active');
  const [sortBy, setSortBy] = useState<LivestockSortOption>('updated');
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Livestock | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filter: LivestockFilter = useMemo(
    () => ({
      search,
      species:
        speciesChoice === 'cow' ||
        speciesChoice === 'bull' ||
        speciesChoice === 'cattle'
          ? 'cow'
          : speciesChoice,
      sex:
        speciesChoice === 'cow'
          ? 'female'
          : speciesChoice === 'bull'
            ? 'male'
            : 'all',
      status,
    }),
    [search, speciesChoice, status]
  );

  const listQuery = useLivestockList(filter);
  const allForTagsQuery = useLivestockList({});
  const ownershipsQuery = useOwnershipList({ status: 'active' });
  const summaryQuery = useFarmSummary();
  const deleteMutation = useDeleteLivestock();

  const ownershipByAnimal = useMemo(
    () => getPrimaryOwnershipByLivestockMap(ownershipsQuery.data ?? []),
    [ownershipsQuery.data]
  );

  const existingTags = useMemo(
    () => (allForTagsQuery.data ?? []).map((item) => item.tagNumber),
    [allForTagsQuery.data]
  );

  const items = useMemo(
    () => sortLivestockItems(listQuery.data ?? [], sortBy),
    [listQuery.data, sortBy]
  );
  const summary = summaryQuery.data;

  const sortOptions = useMemo<ModernDropdownOption<LivestockSortOption>[]>(
    () => [
      { value: 'updated', label: 'Updated', iconSource: MOBILE_APP_ICONS.sync },
      { value: 'created_desc', label: 'Added: Newest', iconSource: MOBILE_APP_ICONS.calendar },
      { value: 'created_asc', label: 'Added: Oldest', iconSource: MOBILE_APP_ICONS.hourglass },
      { value: 'dob_desc', label: 'DOB: Youngest', iconSource: MOBILE_APP_ICONS.sprout },
      { value: 'dob_asc', label: 'DOB: Oldest', iconSource: MOBILE_APP_ICONS.calendar },
      { value: 'tag', label: 'Tag (A–Z)', iconSource: MOBILE_APP_ICONS.pin },
      { value: 'name', label: 'Name (A–Z)', iconSource: MOBILE_APP_ICONS.copyWriting },
    ],
    []
  );

  const statusFilterOptions = useMemo<
    ModernDropdownOption<LivestockStatus | 'all'>[]
  >(
    () => [
      {
        value: 'all',
        label: 'All Statuses',
        customIcon: (
          <AppIcon name="all" size={16} color={FARMDB_COLORS.accent} />
        ),
      },
      ...LIVESTOCK_STATUSES.map((st) => ({
        value: st,
        label: formatStatusLabel(st),
        iconSource: getStatusPngSource(st),
      })),
    ],
    []
  );

  const speciesFilterOptions = useMemo<ModernDropdownOption<MobileSpeciesFilter>[]>(
    () => [
      {
        value: 'all',
        label: 'All Species',
        iconSource: MOBILE_APP_ICONS.group,
      },
      {
        value: 'cow',
        label: 'Cow',
        iconSource: getSpeciesPngSource('cow', 'female'),
      },
      {
        value: 'bull',
        label: 'Bull',
        iconSource: getSpeciesPngSource('cow', 'male'),
      },
      {
        value: 'cattle',
        label: 'Cattle (All)',
        iconSource: MOBILE_APP_ICONS.herd,
      },
      ...SPECIES_LIST.filter((sp) => sp !== 'cow').map((sp) => ({
        value: sp as MobileSpeciesFilter,
        label: formatSpeciesLabel(sp),
        iconSource: getSpeciesPngSource(sp),
      })),
    ],
    []
  );

  async function handleDelete(item: Livestock) {
    if (!canDelete) return;
    if (ui.settings.confirmBeforeDelete && confirmDeleteId !== item.id) {
      setConfirmDeleteId(item.id);
      return;
    }
    setConfirmDeleteId(null);
    const removed = await deleteMutation.mutateAsync(item.id);
    if (removed) {
      deleteManagedLivestockPhoto(item.imageUri);
      if (selectedId === item.id) {
        setSelectedId(null);
      }
    }
  }

  return (
    <View
      style={[
        styles.container,
        { paddingHorizontal: ui.contentPadding, paddingTop: ui.space(8) },
      ]}
    >
      {/* Search + Add Action Row */}
      <View style={[styles.searchActionRow, { gap: ui.space(8), marginBottom: ui.space(6) }]}>
        <View
          style={[
            styles.searchWrap,
            {
              flex: 1,
              minHeight: ui.controlHeight,
              paddingHorizontal: ui.space(12),
              borderRadius: Math.max(10, ui.radius - 2),
            },
          ]}
        >
          <AppIcon
            name="search"
            size={ui.font(16)}
            color={FARMDB_COLORS.textMuted}
          />
          <TextInput
            style={[
              styles.searchInputInner,
              { fontSize: ui.font(14) },
            ]}
            placeholder="Search tag, name, or breed..."
            placeholderTextColor={FARMDB_COLORS.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 ? (
            <Pressable
              onPress={() => setSearch('')}
              hitSlop={8}
              accessibilityLabel="Clear search"
            >
              <AppIcon
                name="close"
                size={ui.font(15)}
                color={FARMDB_COLORS.textMuted}
              />
            </Pressable>
          ) : null}
        </View>

        {canEdit ? (
          <Pressable
            accessibilityLabel="Add Livestock"
            style={[
              styles.addBtn,
              {
                minHeight: ui.controlHeight,
                paddingHorizontal: ui.space(iconMode ? 14 : 16),
                borderRadius: Math.max(10, ui.radius - 2),
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              },
            ]}
            onPress={() => {
              setEditing(null);
              setModalVisible(true);
            }}
          >
            <AppIcon name="plus" size={ui.font(18)} color="#ffffff" />
            {!iconMode ? (
              <Text style={[styles.addBtnText, { fontSize: ui.font(13) }]}>
                Add
              </Text>
            ) : null}
          </Pressable>
        ) : (
          <View
            style={{
              paddingHorizontal: ui.space(10),
              paddingVertical: ui.space(6),
              borderRadius: 999,
              backgroundColor: '#f3efe4',
              borderWidth: 1,
              borderColor: FARMDB_COLORS.border,
            }}
          >
            <Text
              style={{
                fontFamily: FARMDB_FONTS.bold,
                fontSize: ui.font(11),
                color: FARMDB_COLORS.textMuted,
              }}
            >
              {describeModuleAccessLevel(accessLevel)}
            </Text>
          </View>
        )}
      </View>

      {/* Filters & Date Sort */}
      <View style={[styles.filterDropdownRow, { gap: ui.space(6), marginBottom: ui.space(8) }]}>
        <View style={{ flex: 1, minWidth: ui.isCramped ? 128 : 96 }}>
          <ModernDropdown
            compact
            value={status}
            options={statusFilterOptions}
            title="Status"
            accessibilityLabel="Filter by Status"
            onChange={setStatus}
          />
        </View>
        <View style={{ flex: 1, minWidth: ui.isCramped ? 128 : 96 }}>
          <ModernDropdown
            compact
            value={speciesChoice}
            options={speciesFilterOptions}
            title="Species"
            accessibilityLabel="Filter by Species"
            onChange={setSpeciesChoice}
          />
        </View>
        <View style={{ flex: 1, minWidth: ui.isCramped ? 140 : 96 }}>
          <ModernDropdown
            compact
            value={sortBy}
            options={sortOptions}
            title="Sort By"
            accessibilityLabel="Sort livestock"
            onChange={setSortBy}
          />
        </View>
      </View>

      <FarmFlatList
        dockAware
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          { gap: ui.space(10), paddingBottom: ui.bottomDockReserve },
        ]}
        ListHeaderComponent={
          <View
            style={[
              styles.statsBar,
              {
                paddingVertical: ui.space(6),
                paddingHorizontal: ui.space(6),
                borderRadius: Math.max(9, ui.radius - 3),
                flexWrap: 'wrap',
                gap: ui.space(4),
              },
            ]}
          >
            {[
              { label: 'Active', value: summary?.activeLivestock ?? 0 },
              { label: 'Cows', value: summary?.cowCount ?? 0 },
              { label: 'Total', value: summary?.totalLivestock ?? 0 },
            ].map((stat, idx) => (
              <React.Fragment key={stat.label}>
                {idx > 0 && !ui.isCramped ? <View style={styles.statDivider} /> : null}
                <View
                  style={[
                    styles.statInlineItem,
                    {
                      flexWrap: 'wrap',
                      minWidth: ui.isCramped ? 84 : 70,
                      paddingVertical: 2,
                    },
                  ]}
                >
                  <Text style={[styles.statLabel, { fontSize: ui.font(11) }]}>
                    {stat.label}
                  </Text>
                  <Text style={[styles.statValue, { fontSize: ui.font(13) }]}>
                    {stat.value}
                  </Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        }
        ListEmptyComponent={
          <View
            style={[
              styles.emptyCard,
              { padding: ui.space(22), borderRadius: ui.radius, gap: ui.space(10) },
            ]}
          >
            <AppIcon name="barnAlt" size={ui.font(34)} />
            <Text style={[styles.emptyTitle, { fontSize: ui.font(16) }]}>
              {listQuery.isLoading ? 'Loading...' : 'No livestock found'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const own = ownershipByAnimal.get(item.id);
          const showOwnership = own && own.ownershipCategory !== 'farm_owned';
          return (
            <Pressable
              style={[
                styles.card,
                { padding: ui.space(14), borderRadius: ui.radius, gap: ui.space(10) },
              ]}
              onPress={() => setSelectedId(item.id)}
            >
              <View style={[styles.cardTopRow, { gap: ui.space(12) }]}>
                {item.imageUri ? (
                  <Image
                    source={{ uri: item.imageUri }}
                    style={[
                      styles.thumb,
                      {
                        width: ui.thumbSize,
                        height: ui.thumbSize,
                        borderRadius: Math.max(10, ui.radius - 3),
                      },
                    ]}
                  />
                ) : (
                  <View
                    style={[
                      styles.thumbPlaceholder,
                      {
                        width: ui.thumbSize,
                        height: ui.thumbSize,
                        borderRadius: Math.max(10, ui.radius - 3),
                      },
                    ]}
                  >
                    <SpeciesIcon
                      species={item.species}
                      sex={item.sex}
                      size={ui.font(24)}
                      color={FARMDB_COLORS.accent}
                    />
                  </View>
                )}

                <View style={styles.cardMain}>
                  <View style={[styles.cardTitleBar, { flexWrap: 'wrap' }]}>
                    <Text
                      style={[styles.animalName, { fontSize: ui.font(16), flexShrink: 1 }]}
                      numberOfLines={2}
                    >
                      {item.name ?? 'Unnamed'}
                    </Text>
                    <View style={styles.tagPill}>
                      <Text style={[styles.tagText, { fontSize: ui.font(11) }]}>
                        {item.tagNumber}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                    <SexIcon sex={item.sex} size={ui.font(12)} />
                    <Text style={[styles.animalMeta, { fontSize: ui.font(13), flexShrink: 1 }]}>
                      {formatSpeciesLabel(item.species, item.sex)} · {formatSexLabel(item.sex)}
                      {item.breed ? ` · ${item.breed}` : ''}
                      {item.dob ? ` · ${formatAnimalAge(item.dob)}` : ''}
                    </Text>
                  </View>

                  {showOwnership ? (
                    <View style={styles.ownershipChip}>
                      <Text style={[styles.ownershipChipText, { fontSize: ui.font(10) }]}>
                        {formatOwnershipCategoryLabel(own.ownershipCategory)} · {own.ownerName}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              <View style={[styles.cardFooterBar, { flexWrap: 'wrap' }]}>
                <View style={[styles.statusPillWrap, { minWidth: 110 }]}>
                  <StatusIcon status={item.status} size={ui.font(13)} />
                  <Text style={[styles.speciesMeta, { fontSize: ui.font(11), flexShrink: 1 }]}>
                    {formatStatusLabel(item.status)}
                    {item.dob ? ` · ${formatDisplayDate(item.dob, ui.settings.dateFormat)}` : ''}
                  </Text>
                </View>

                {canEdit || canDelete ? (
                  <View style={[styles.cardActions, { gap: ui.space(6), flexWrap: 'wrap' }]}>
                    {canEdit ? (
                      <Pressable
                        accessibilityLabel={`Edit ${item.tagNumber}`}
                        style={[
                          styles.secondaryAction,
                          {
                            minHeight: Math.max(30, ui.chipHeight - 4),
                            paddingHorizontal: ui.space(10),
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4,
                          },
                        ]}
                        onPress={() => {
                          setEditing(item);
                          setModalVisible(true);
                        }}
                      >
                        <AppIcon
                          name="edit"
                          size={ui.font(13)}
                          color={FARMDB_COLORS.text}
                        />
                        {!iconMode ? (
                          <Text style={[styles.secondaryActionText, { fontSize: ui.font(11) }]}>
                            Edit
                          </Text>
                        ) : null}
                      </Pressable>
                    ) : null}

                    {canDelete ? (
                      confirmDeleteId === item.id ? (
                        <>
                          <Pressable
                            accessibilityLabel="Confirm delete"
                            style={[
                              styles.dangerAction,
                              {
                                minHeight: Math.max(30, ui.chipHeight - 4),
                                paddingHorizontal: ui.space(10),
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 4,
                              },
                            ]}
                            onPress={() => void handleDelete(item)}
                          >
                            <AppIcon
                              name="check"
                              size={ui.font(13)}
                              color={FARMDB_COLORS.danger}
                            />
                            {!iconMode ? (
                              <Text style={[styles.dangerActionText, { fontSize: ui.font(11) }]}>
                                Confirm
                              </Text>
                            ) : null}
                          </Pressable>
                          <Pressable
                            accessibilityLabel="Keep record"
                            style={[
                              styles.secondaryAction,
                              {
                                minHeight: Math.max(30, ui.chipHeight - 4),
                                paddingHorizontal: ui.space(10),
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 4,
                              },
                            ]}
                            onPress={() => setConfirmDeleteId(null)}
                          >
                            <AppIcon
                              name="close"
                              size={ui.font(13)}
                              color={FARMDB_COLORS.text}
                            />
                            {!iconMode ? (
                              <Text style={[styles.secondaryActionText, { fontSize: ui.font(11) }]}>
                                Keep
                              </Text>
                            ) : null}
                          </Pressable>
                        </>
                      ) : (
                        <Pressable
                          accessibilityLabel={`Delete ${item.tagNumber}`}
                          style={[
                            styles.dangerAction,
                            {
                              minHeight: Math.max(30, ui.chipHeight - 4),
                              paddingHorizontal: ui.space(10),
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 4,
                            },
                          ]}
                          onPress={() => void handleDelete(item)}
                        >
                          <AppIcon
                            name="trash"
                            size={ui.font(13)}
                            color={FARMDB_COLORS.danger}
                          />
                          {!iconMode ? (
                            <Text style={[styles.dangerActionText, { fontSize: ui.font(11) }]}>
                              Delete
                            </Text>
                          ) : null}
                        </Pressable>
                      )
                    ) : null}
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />

      <LivestockDetailModal
        livestockId={selectedId}
        onClose={() => setSelectedId(null)}
        onSelectAnimal={(id) => setSelectedId(id)}
        onOpenFamilyTree={onOpenFamilyTree}
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
    paddingTop: 8,
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ddd6c8',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  statInlineItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 4,
  },
  statDivider: {
    width: 1,
    height: 14,
    backgroundColor: '#e7e1d4',
  },
  searchActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardFooterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: '#f1ede4',
  },
  statusPillWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: FARMDB_FONTS.medium,
    color: '#5d675f',
  },
  statValue: {
    fontSize: 13,
    fontFamily: FARMDB_FONTS.bold,
    color: '#2d6a4f',
  },
  addBtn: {
    backgroundColor: '#2d6a4f',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  addBtnText: {
    color: '#ffffff',
    fontFamily: FARMDB_FONTS.bold,
    fontSize: 13,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ddd6c8',
  },
  searchInputInner: {
    flex: 1,
    fontFamily: FARMDB_FONTS.regular,
    color: '#1c241e',
    paddingVertical: 8,
  },
  filterDropdownRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  metaBadgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  cardMain: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  ownershipChip: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#e6f2ec',
  },
  ownershipChipText: {
    fontFamily: FARMDB_FONTS.bold,
    color: '#2d6a4f',
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
    fontFamily: FARMDB_FONTS.monoBold,
    fontSize: 12,
    color: '#1c241e',
  },
  speciesMeta: {
    fontSize: 12,
    color: '#5d675f',
    fontFamily: FARMDB_FONTS.semibold,
  },
  animalName: {
    fontSize: 16,
    fontFamily: FARMDB_FONTS.bold,
    color: '#1c241e',
  },
  animalMeta: {
    fontSize: 12,
    fontFamily: FARMDB_FONTS.regular,
    color: '#5d675f',
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
    fontFamily: FARMDB_FONTS.semibold,
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
    fontFamily: FARMDB_FONTS.semibold,
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
    fontFamily: FARMDB_FONTS.bold,
    color: '#1c241e',
  },
  emptySub: {
    fontSize: 13,
    fontFamily: FARMDB_FONTS.regular,
    color: '#5d675f',
    textAlign: 'center',
    marginTop: 6,
  },
});
