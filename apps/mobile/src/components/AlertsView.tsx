import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  formatDisplayDate,
  getAlertUrgency,
  getTodayIsoDate,
  validateNewAlert,
  type AlertEntryKind,
  type NewAlertInput,
  type ValidationErrors,
} from '@farmdb/core';
import {
  AlertValidationError,
  useAlertList,
  useCreateAlert,
  useDeleteAlert,
  useLivestockList,
  useToggleAlertResolved,
} from '@farmdb/db';
import { MOBILE_APP_ICONS } from '../assets/icons';
import {
  FARMDB_COLORS,
  FARMDB_FONTS,
  useUiScale,
} from '../theme/uiScale';
import { buildAnimalDropdownOption } from '../utils/animalOptions';
import { AnimalEyeButton } from './AnimalQuickPreviewModal';
import { AppIcon, SpeciesIcon } from './FarmIcons';
import { FarmScrollView } from './FarmScrollView';
import { ModernDatePicker } from './ModernDatePicker';
import {
  ModernDropdown,
  type ModernDropdownOption,
} from './ModernDropdown';

interface AlertsViewProps {
  onCheckDueNow: () => Promise<number>;
}

export function AlertsView({ onCheckDueNow }: AlertsViewProps) {
  const ui = useUiScale();
  const { settings } = ui;
  const iconMode = settings.mobileIconMode;
  const livestockQuery = useLivestockList({});
  const allAlertsQuery = useAlertList({});

  const [kindFilter, setKindFilter] = useState<AlertEntryKind | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'open' | 'resolved' | 'all'>(
    'open'
  );
  const [search, setSearch] = useState('');

  const filteredAlertsQuery = useAlertList({
    entryKind: kindFilter,
    status: statusFilter,
    search: search || undefined,
  });

  const createMutation = useCreateAlert();
  const toggleMutation = useToggleAlertResolved();
  const deleteMutation = useDeleteAlert();

  const animals = livestockQuery.data ?? [];
  const animalsById = useMemo(
    () => new Map(animals.map((a) => [a.id, a])),
    [animals]
  );

  const animalOptions = useMemo<ModernDropdownOption<string>[]>(
    () => [
      {
        value: '',
        label: 'General Farm',
        iconSource: MOBILE_APP_ICONS.barnAlt,
        hint: 'Not linked to one animal',
      },
      ...animals.map((a) =>
        buildAnimalDropdownOption(a, { dateFormat: ui.settings.dateFormat })
      ),
    ],
    [animals, ui.settings.dateFormat]
  );

  const kindFilterOptions = useMemo<
    ModernDropdownOption<AlertEntryKind | 'all'>[]
  >(
    () => [
      {
        value: 'all',
        label: 'All Types',
        customIcon: (
          <AppIcon name="all" size={16} color={FARMDB_COLORS.accent} />
        ),
      },
      {
        value: 'alert',
        label: 'Alerts Only',
        iconSource: MOBILE_APP_ICONS.notification,
      },
      {
        value: 'note',
        label: 'Notes Only',
        iconSource: MOBILE_APP_ICONS.stickyNote,
      },
    ],
    []
  );

  const statusFilterOptions = useMemo<
    ModernDropdownOption<'open' | 'resolved' | 'all'>[]
  >(
    () => [
      {
        value: 'open',
        label: 'Open / Active',
        iconSource: MOBILE_APP_ICONS.hourglass,
      },
      {
        value: 'resolved',
        label: 'Resolved',
        iconSource: MOBILE_APP_ICONS.checkmark,
      },
      {
        value: 'all',
        label: 'All Statuses',
        customIcon: (
          <AppIcon name="all" size={16} color={FARMDB_COLORS.accent} />
        ),
      },
    ],
    []
  );

  const [entryKind, setEntryKind] = useState<AlertEntryKind>('alert');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [livestockId, setLivestockId] = useState('');
  const [triggerDate, setTriggerDate] = useState(() => getTodayIsoDate());
  const [errors, setErrors] = useState<ValidationErrors<NewAlertInput>>({});
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function handleDeleteAlert(id: string) {
    if (settings.confirmBeforeDelete && confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setConfirmDeleteId(null);
    await deleteMutation.mutateAsync(id);
  }

  const todayIso = getTodayIsoDate();
  const allItems = allAlertsQuery.data ?? [];
  const visibleItems = filteredAlertsQuery.data ?? [];

  const dueCount = useMemo(
    () =>
      allItems.filter(
        (a) => a.entryKind === 'alert' && !a.isResolved && a.triggerDate <= todayIso
      ).length,
    [allItems, todayIso]
  );
  const openCount = useMemo(
    () => allItems.filter((a) => !a.isResolved).length,
    [allItems]
  );

  async function handleSubmit() {
    setStatusMsg(null);
    const check = validateNewAlert({
      entryKind,
      title,
      description,
      livestockId: livestockId || null,
      triggerDate: entryKind === 'note' ? getTodayIsoDate() : triggerDate,
    });

    if (!check.ok || !check.data) {
      setErrors(check.errors);
      return;
    }

    setErrors({});
    try {
      const created = await createMutation.mutateAsync(check.data);
      setTitle('');
      setDescription('');
      setShowForm(false);
      setStatusMsg(
        created.entryKind === 'alert'
          ? `Alert scheduled for ${created.triggerDate}.`
          : 'Note saved.'
      );
      if (created.entryKind === 'alert' && created.triggerDate <= todayIso) {
        await onCheckDueNow();
      }
    } catch (err) {
      if (err instanceof AlertValidationError) {
        setErrors(err.errors);
      } else {
        setStatusMsg(
          err instanceof Error ? err.message : 'Failed to save entry.'
        );
      }
    }
  }

  async function handleCheckNow() {
    setChecking(true);
    setStatusMsg(null);
    try {
      const count = await onCheckDueNow();
      setStatusMsg(
        count > 0
          ? `Triggered ${count} due alert notification(s).`
          : 'No unnotified due alerts.'
      );
    } finally {
      setChecking(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FarmScrollView
        dockAware
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            padding: ui.contentPadding,
            gap: ui.space(12),
            paddingBottom: ui.bottomDockReserve,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.topRow, { gap: ui.space(8), flexWrap: 'wrap' }]}>
          <View style={[styles.statBox, { padding: ui.space(10), borderRadius: Math.max(10, ui.radius - 2), minWidth: 132 }]}>
            <Text style={[styles.statLabel, { fontSize: ui.font(11) }]}>
              Due / Overdue
            </Text>
            <Text
              style={[
                styles.statValue,
                {
                  color: dueCount > 0 ? FARMDB_COLORS.danger : FARMDB_COLORS.text,
                  fontSize: ui.font(18),
                },
              ]}
            >
              {dueCount}
            </Text>
          </View>
          <View style={[styles.statBox, { padding: ui.space(10), borderRadius: Math.max(10, ui.radius - 2), minWidth: 132 }]}>
            <Text style={[styles.statLabel, { fontSize: ui.font(11) }]}>
              Open Alerts &amp; Notes
            </Text>
            <Text style={[styles.statValue, { fontSize: ui.font(18) }]}>
              {openCount}
            </Text>
          </View>
        </View>

        <View style={[styles.topRow, { gap: ui.space(8), flexWrap: 'wrap' }]}>
          <Pressable
            style={[
              showForm ? styles.toggleCloseBtn : styles.toggleAddBtn,
              { flex: 1.4, minWidth: 150, minHeight: ui.controlHeight },
            ]}
            onPress={() => setShowForm((prev) => !prev)}
          >
            <AppIcon
              name={showForm ? 'close' : 'plus'}
              size={ui.font(16)}
              color={showForm ? FARMDB_COLORS.text : '#ffffff'}
            />
            <Text
              style={[
                showForm ? styles.toggleCloseBtnText : styles.toggleAddBtnText,
                { fontSize: ui.font(13) },
              ]}
            >
              {showForm ? 'Close Form' : 'New Alert / Note'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Check due alerts"
            style={[
              styles.checkBtn,
              {
                flex: 1,
                minWidth: 112,
                minHeight: ui.controlHeight,
                paddingHorizontal: ui.space(12),
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              },
            ]}
            onPress={() => void handleCheckNow()}
            disabled={checking}
          >
            <AppIcon name="refresh" size={ui.font(15)} color="#ffffff" />
            {!iconMode ? (
              <Text style={[styles.checkBtnText, { fontSize: ui.font(13) }]}>
                {checking ? 'Checking...' : 'Check Due'}
              </Text>
            ) : null}
          </Pressable>
        </View>

        {statusMsg && !showForm ? (
          <View style={[styles.feedbackBanner, { padding: ui.space(10), borderRadius: ui.radius }]}>
            <Text style={[styles.feedbackText, { marginTop: 0, fontSize: ui.font(13) }]}>
              {statusMsg}
            </Text>
          </View>
        ) : null}

        {showForm ? (
          <View style={[styles.card, { padding: ui.space(14), borderRadius: ui.radius }]}>
            <Text style={[styles.cardTitle, { fontSize: ui.font(16) }]}>
              New Alert or Note
            </Text>

            <View style={[styles.chipRow, { gap: ui.space(8) }]}>
              {(['alert', 'note'] as const).map((kind) => {
                const active = entryKind === kind;
                return (
                  <Pressable
                    key={kind}
                    style={[
                      styles.chip,
                      styles.chipToggle,
                      active && styles.chipActive,
                      {
                        minHeight: ui.chipHeight,
                        minWidth: 132,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 5,
                      },
                    ]}
                    onPress={() => setEntryKind(kind)}
                  >
                    <AppIcon
                      name={kind === 'alert' ? 'alerts' : 'note'}
                      size={ui.font(14)}
                      color={active ? FARMDB_COLORS.accentHover : FARMDB_COLORS.textMuted}
                    />
                    <Text
                      style={[
                        styles.chipText,
                        active && styles.chipTextActive,
                        { fontSize: ui.font(12) },
                      ]}
                    >
                      {kind === 'alert' ? 'Scheduled Alert' : 'Farm / Animal Note'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.label, { fontSize: ui.font(12) }]}>Title *</Text>
            <TextInput
              style={[styles.input, { minHeight: ui.controlHeight, fontSize: ui.font(14) }]}
              value={title}
              onChangeText={setTitle}
              placeholder={
                entryKind === 'alert'
                  ? 'e.g. Cow #402 is due for vaccination'
                  : 'e.g. Check water trough valve'
              }
            />
            {errors.title ? (
              <Text style={[styles.errorText, { fontSize: ui.font(12) }]}>
                {errors.title}
              </Text>
            ) : null}

            {entryKind === 'alert' ? (
              <>
                <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                  Trigger Date *
                </Text>
                <ModernDatePicker
                  title="Alert Trigger Date"
                  accessibilityLabel="Alert Trigger Date"
                  value={triggerDate}
                  onChange={setTriggerDate}
                />
                {errors.triggerDate ? (
                  <Text style={[styles.errorText, { fontSize: ui.font(12) }]}>
                    {errors.triggerDate}
                  </Text>
                ) : null}
              </>
            ) : null}

            <Text style={[styles.label, { fontSize: ui.font(12) }]}>
              Linked Animal (Optional)
            </Text>
            <ModernDropdown
              value={livestockId}
              options={animalOptions}
              title="Linked Animal"
              searchable={animals.length > 5}
              accessibilityLabel="Linked Animal"
              onChange={setLivestockId}
            />

            <Text style={[styles.label, { fontSize: ui.font(12) }]}>Details</Text>
            <TextInput
              style={[styles.input, { minHeight: ui.controlHeight, fontSize: ui.font(14) }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Optional details..."
            />

            {statusMsg ? (
              <Text style={[styles.feedbackText, { fontSize: ui.font(13) }]}>
                {statusMsg}
              </Text>
            ) : null}

            <Pressable
              style={[
                styles.primaryBtn,
                createMutation.isPending && styles.disabledBtn,
                { minHeight: ui.controlHeight, justifyContent: 'center' },
              ]}
              onPress={() => void handleSubmit()}
              disabled={createMutation.isPending}
            >
              <Text style={[styles.primaryBtnText, { fontSize: ui.font(14) }]}>
                {createMutation.isPending
                  ? 'Saving...'
                  : entryKind === 'alert'
                    ? 'Schedule Alert'
                    : 'Save Note'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={[styles.card, { padding: ui.space(14), borderRadius: ui.radius }]}>
          <Text style={[styles.cardTitle, { fontSize: ui.font(16) }]}>
            Alerts &amp; Notes ({visibleItems.length})
          </Text>
          <View
            style={[
              styles.searchWrap,
              {
                marginBottom: 10,
                minHeight: ui.controlHeight,
                paddingHorizontal: ui.space(11),
              },
            ]}
          >
            <AppIcon
              name="search"
              size={ui.font(15)}
              color={FARMDB_COLORS.textMuted}
            />
            <TextInput
              style={[styles.searchInputInner, { fontSize: ui.font(14) }]}
              value={search}
              onChangeText={setSearch}
              placeholder="Search titles or details..."
              placeholderTextColor={FARMDB_COLORS.textMuted}
            />
            {search.length > 0 ? (
              <Pressable onPress={() => setSearch('')} hitSlop={8}>
                <AppIcon
                  name="close"
                  size={ui.font(15)}
                  color={FARMDB_COLORS.textMuted}
                />
              </Pressable>
            ) : null}
          </View>

          <View style={[styles.filterDropdownRow, { marginBottom: ui.space(10), gap: ui.space(8), flexWrap: 'wrap' }]}>
            <View style={{ flex: 1, minWidth: 126 }}>
              <ModernDropdown
                compact
                value={kindFilter}
                options={kindFilterOptions}
                title="Entry Type"
                accessibilityLabel="Filter by entry type"
                onChange={setKindFilter}
              />
            </View>
            <View style={{ flex: 1, minWidth: 126 }}>
              <ModernDropdown
                compact
                value={statusFilter}
                options={statusFilterOptions}
                title="Alert Status"
                accessibilityLabel="Filter by status"
                onChange={setStatusFilter}
              />
            </View>
          </View>

          {visibleItems.length === 0 ? (
            <Text style={[styles.mutedText, { fontSize: ui.font(13) }]}>
              No matching alerts or notes.
            </Text>
          ) : (
            visibleItems.map((item) => {
              const animal = item.livestockId
                ? animalsById.get(item.livestockId)
                : null;
              const urgency = getAlertUrgency(item, todayIso);
              return (
                <View key={item.id} style={[styles.itemRow, { paddingVertical: ui.space(10), flexWrap: 'wrap' }]}>
                  <View style={{ paddingTop: 2 }}>
                    {animal ? (
                      <SpeciesIcon
                        species={animal.species}
                        size={ui.font(16)}
                        color={FARMDB_COLORS.accent}
                      />
                    ) : (
                      <AppIcon
                        name={item.entryKind === 'alert' ? 'alerts' : 'note'}
                        size={ui.font(16)}
                        color={
                          item.isResolved
                            ? FARMDB_COLORS.textMuted
                            : FARMDB_COLORS.accent
                        }
                      />
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 168 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={[styles.itemTitle, { fontSize: ui.font(14), flexShrink: 1 }]}>
                        [{urgency.replace('_', ' ').toUpperCase()}]{' '}
                        {animal ? `${animal.tagNumber} · ` : ''}
                        {item.title}
                      </Text>
                      {animal ? <AnimalEyeButton livestockId={animal.id} /> : null}
                    </View>
                    {item.description ? (
                      <Text style={[styles.itemDesc, { fontSize: ui.font(13) }]}>
                        {item.description}
                      </Text>
                    ) : null}
                    <Text style={[styles.itemMeta, { fontSize: ui.font(11) }]}>
                      {item.entryKind === 'alert'
                        ? `Trigger: ${formatDisplayDate(item.triggerDate, settings.dateFormat)}${item.notifiedAt ? ' · Notified' : ''}`
                        : `Logged: ${formatDisplayDate(item.triggerDate, settings.dateFormat)}`}
                    </Text>
                  </View>

                  <View style={[styles.itemBtns, { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }]}>
                    <Pressable
                      accessibilityLabel={item.isResolved ? 'Reopen' : 'Mark done'}
                      style={[
                        styles.resolveBtn,
                        {
                          minHeight: ui.chipHeight - 2,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                        },
                      ]}
                      onPress={() =>
                        void toggleMutation.mutateAsync({
                          id: item.id,
                          isResolved: !item.isResolved,
                        })
                      }
                    >
                      <AppIcon
                        name={item.isResolved ? 'refresh' : 'checkCircle'}
                        size={ui.font(14)}
                        color={FARMDB_COLORS.accent}
                      />
                      {!iconMode ? (
                        <Text style={[styles.resolveBtnText, { fontSize: ui.font(12) }]}>
                          {item.isResolved ? 'Reopen' : 'Done'}
                        </Text>
                      ) : null}
                    </Pressable>
                    {confirmDeleteId === item.id ? (
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        <Pressable
                          accessibilityLabel="Confirm delete"
                          style={[
                            styles.deleteBtn,
                            {
                              minHeight: ui.chipHeight - 2,
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 4,
                            },
                          ]}
                          onPress={() => void handleDeleteAlert(item.id)}
                        >
                          <AppIcon
                            name="check"
                            size={ui.font(14)}
                            color={FARMDB_COLORS.danger}
                          />
                          {!iconMode ? (
                            <Text style={[styles.deleteBtnText, { fontSize: ui.font(11) }]}>
                              Confirm
                            </Text>
                          ) : null}
                        </Pressable>
                        <Pressable
                          accessibilityLabel="Keep item"
                          style={[
                            styles.keepBtn,
                            {
                              minHeight: ui.chipHeight - 2,
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
                            size={ui.font(14)}
                            color={FARMDB_COLORS.text}
                          />
                          {!iconMode ? (
                            <Text style={[styles.keepBtnText, { fontSize: ui.font(11) }]}>
                              Keep
                            </Text>
                          ) : null}
                        </Pressable>
                      </View>
                    ) : (
                      <Pressable
                        accessibilityLabel="Delete item"
                        style={[
                          styles.deleteBtn,
                          {
                            minHeight: ui.chipHeight - 2,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4,
                          },
                        ]}
                        onPress={() => void handleDeleteAlert(item.id)}
                      >
                        <AppIcon
                          name="trash"
                          size={ui.font(14)}
                          color={FARMDB_COLORS.danger}
                        />
                        {!iconMode ? (
                          <Text style={[styles.deleteBtnText, { fontSize: ui.font(12) }]}>
                            Delete
                          </Text>
                        ) : null}
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </FarmScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 28 },
  topRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  statBox: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ddd6c8',
    borderRadius: 10,
    padding: 10,
  },
  statLabel: { fontSize: 11, fontFamily: FARMDB_FONTS.medium, color: '#5d675f' },
  statValue: { fontSize: 17, fontFamily: FARMDB_FONTS.bold, marginTop: 2 },
  checkBtn: {
    backgroundColor: '#17271d',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  checkBtnText: { color: '#ffffff', fontFamily: FARMDB_FONTS.bold, fontSize: 13 },
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ddd6c8',
    borderRadius: 12,
    padding: 14,
  },
  cardTitle: { fontSize: 16, fontFamily: FARMDB_FONTS.bold, color: '#1c241e', marginBottom: 10 },
  label: { fontSize: 12, fontFamily: FARMDB_FONTS.semibold, color: '#1c241e', marginTop: 10, marginBottom: 5 },
  input: {
    backgroundColor: '#faf8f4',
    borderWidth: 1,
    borderColor: '#ddd6c8',
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 9,
    fontSize: 14,
    fontFamily: FARMDB_FONTS.regular,
    color: '#1c241e',
  },
  filterDropdownRow: { flexDirection: 'row', alignItems: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ddd6c8',
    backgroundColor: '#ffffff',
  },
  chipToggle: {
    flex: 1,
  },
  chipActive: {
    backgroundColor: FARMDB_COLORS.accentSoft,
    borderWidth: 1.5,
    borderColor: FARMDB_COLORS.accent,
  },
  chipText: { fontSize: 12, fontFamily: FARMDB_FONTS.semibold, color: '#1c241e' },
  chipTextActive: { color: FARMDB_COLORS.accentHover, fontFamily: FARMDB_FONTS.bold },
  errorText: { fontSize: 12, fontFamily: FARMDB_FONTS.medium, color: '#b42318', marginTop: 4 },
  feedbackText: { fontSize: 13, color: '#1b6b3a', fontFamily: FARMDB_FONTS.semibold, marginTop: 10 },
  primaryBtn: {
    marginTop: 14,
    backgroundColor: '#2d6a4f',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  disabledBtn: { opacity: 0.6 },
  primaryBtnText: { color: '#ffffff', fontFamily: FARMDB_FONTS.bold, fontSize: 14 },
  toggleAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: FARMDB_COLORS.accent,
    borderRadius: 11,
    paddingHorizontal: 14,
  },
  toggleAddBtnText: { color: '#ffffff', fontFamily: FARMDB_FONTS.bold },
  toggleCloseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: FARMDB_COLORS.surface,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    borderRadius: 11,
    paddingHorizontal: 14,
  },
  toggleCloseBtnText: { color: FARMDB_COLORS.text, fontFamily: FARMDB_FONTS.bold },
  feedbackBanner: {
    backgroundColor: FARMDB_COLORS.accentSoft,
    borderWidth: 1,
    borderColor: '#cce3d6',
  },
  mutedText: { fontSize: 13, fontFamily: FARMDB_FONTS.regular, color: '#5d675f' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0ece3',
  },
  itemTitle: { fontSize: 14, fontFamily: FARMDB_FONTS.bold, color: '#1c241e' },
  itemDesc: { fontSize: 13, fontFamily: FARMDB_FONTS.regular, color: '#5d675f', marginTop: 2 },
  itemMeta: { fontSize: 11, fontFamily: FARMDB_FONTS.regular, color: '#5d675f', marginTop: 3 },
  itemBtns: { gap: 6 },
  resolveBtn: {
    backgroundColor: '#e6f2ec',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  resolveBtnText: { fontSize: 12, fontFamily: FARMDB_FONTS.bold, color: '#2d6a4f' },
  deleteBtn: {
    backgroundColor: '#fdeceb',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteBtnText: { fontSize: 12, fontFamily: FARMDB_FONTS.semibold, color: '#b42318' },
  keepBtn: {
    backgroundColor: '#f0ece3',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  keepBtnText: { fontSize: 12, fontFamily: FARMDB_FONTS.semibold, color: '#1c241e' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#faf8f4',
    borderWidth: 1,
    borderColor: '#ddd6c8',
    borderRadius: 10,
  },
  searchInputInner: {
    flex: 1,
    fontFamily: FARMDB_FONTS.regular,
    color: '#1c241e',
    paddingVertical: 8,
  },
});
