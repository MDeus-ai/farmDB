import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  canAccountDeleteInModule,
  canAccountEditModule,
  computeOwnershipSummary,
  formatCurrency,
  formatDisplayDate,
  formatOwnershipCategoryLabel,
  formatOwnershipStatusLabel,
  getTodayIsoDate,
  OWNERSHIP_CATEGORIES,
  OWNERSHIP_CATEGORY_HINTS,
  OWNERSHIP_STATUS_HINTS,
  OWNERSHIP_STATUSES,
  type AnimalOwnership,
  type FarmAccount,
  type Livestock,
  type OwnershipCategory,
  type OwnershipStatus,
} from '@farmdb/core';
import {
  useActiveFarmAccount,
  useCreateOwnership,
  useDeleteOwnership,
  useFarmAccountList,
  useLivestockList,
  useOwnershipList,
  useUpdateOwnership,
} from '@farmdb/db';
import { MOBILE_APP_ICONS } from '../assets/icons';
import { FARMDB_COLORS, FARMDB_FONTS, useUiScale } from '../theme/uiScale';
import { buildAnimalDropdownOption } from '../utils/animalOptions';
import { AnimalEyeButton } from './AnimalQuickPreviewModal';
import { SmartContactLink } from './ContactLink';
import { AppIcon, SpeciesIcon } from './FarmIcons';
import { FarmScrollView } from './FarmScrollView';
import { MobileFileTabs } from './MobileFileTabs';
import { MobileNumberStepper } from './MobileNumberStepper';
import { ModernDatePicker } from './ModernDatePicker';
import {
  ModernDropdown,
  type ModernDropdownOption,
} from './ModernDropdown';

type MobileOwnershipTab = 'records' | 'owners';

interface OwnershipsViewProps {
  onOpenNetwork?: () => void;
}

export function OwnershipsView({ onOpenNetwork }: OwnershipsViewProps) {
  const ui = useUiScale();
  const { settings } = ui;
  const currency = settings.currencySymbol;
  const todayIso = getTodayIsoDate();

  const activeAccountQuery = useActiveFarmAccount();
  const activeAccount = activeAccountQuery.data;
  const canEdit = canAccountEditModule(activeAccount, 'ownerships');
  const canDelete = canAccountDeleteInModule(activeAccount, 'ownerships');

  const ownershipsQuery = useOwnershipList({});
  const livestockQuery = useLivestockList({});
  const accountsQuery = useFarmAccountList({});

  const createMut = useCreateOwnership();
  const updateMut = useUpdateOwnership();
  const deleteMut = useDeleteOwnership();

  const allOwnerships = ownershipsQuery.data ?? [];
  const allLivestock = livestockQuery.data ?? [];
  const allAccounts = accountsQuery.data ?? [];

  const [tab, setTab] = useState<MobileOwnershipTab>('records');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<OwnershipCategory | 'all'>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AnimalOwnership | null>(null);
  const [fLivestockId, setFLivestockId] = useState('');
  const [fOwnerName, setFOwnerName] = useState('');
  const [fOwnerContact, setFOwnerContact] = useState('');
  const [fAccountId, setFAccountId] = useState('');
  const [fCategory, setFCategory] = useState<OwnershipCategory>('external_boarded');
  const [fSharePct, setFSharePct] = useState('100');
  const [fPurpose, setFPurpose] = useState('');
  const [fStartDate, setFStartDate] = useState(todayIso);
  const [fExpectedEndDate, setFExpectedEndDate] = useState('');
  const [fBoardingFee, setFBoardingFee] = useState('0');
  const [fStatus, setFStatus] = useState<OwnershipStatus>('active');
  const [fNotes, setFNotes] = useState('');
  const [fError, setFError] = useState<string | null>(null);

  const livestockById = useMemo(
    () => new Map(allLivestock.map((a) => [a.id, a])),
    [allLivestock]
  );
  const accountsById = useMemo(
    () => new Map(allAccounts.map((acc) => [acc.id, acc])),
    [allAccounts]
  );

  const summary = useMemo(
    () => computeOwnershipSummary(allOwnerships),
    [allOwnerships]
  );

  const filteredOwnerships = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allOwnerships.filter((row) => {
      if (categoryFilter !== 'all' && row.ownershipCategory !== categoryFilter) {
        return false;
      }
      if (q) {
        const animal = livestockById.get(row.livestockId);
        const hay = `${row.ownerName} ${row.purpose ?? ''} ${animal?.tagNumber ?? ''} ${animal?.name ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allOwnerships, categoryFilter, search, livestockById]);

  const ownerGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        ownerName: string;
        ownerContact: string | null;
        linkedAccount: FarmAccount | null;
        records: AnimalOwnership[];
        activeCount: number;
      }
    >();
    for (const row of allOwnerships) {
      const key = row.ownerName.trim().toLowerCase();
      const entry = map.get(key) ?? {
        key,
        ownerName: row.ownerName,
        ownerContact: row.ownerContact,
        linkedAccount: row.accountId ? accountsById.get(row.accountId) ?? null : null,
        records: [],
        activeCount: 0,
      };
      entry.records.push(row);
      if (row.status === 'active') entry.activeCount += 1;
      map.set(key, entry);
    }
    return Array.from(map.values());
  }, [allOwnerships, accountsById]);

  const livestockOptions = useMemo<ModernDropdownOption<string>[]>(
    () =>
      allLivestock.map((a: Livestock) =>
        buildAnimalDropdownOption(a, {
          label: `${a.tagNumber}${a.name ? ` · ${a.name}` : ''}`,
          hint: `${a.breed ?? a.species} (${a.status})`,
        })
      ),
    [allLivestock]
  );

  const accountOptions = useMemo<ModernDropdownOption<string>[]>(
    () => [
      { value: '', label: 'Not Linked to Account', iconSource: MOBILE_APP_ICONS.peasant },
      ...allAccounts.map((acc) => ({
        value: acc.id,
        label: acc.displayName,
        hint: acc.relationship ?? acc.role,
        iconSource: MOBILE_APP_ICONS.networking,
      })),
    ],
    [allAccounts]
  );

  function openAddModal() {
    setEditing(null);
    setFLivestockId(allLivestock[0]?.id ?? '');
    setFOwnerName('');
    setFOwnerContact('');
    setFAccountId('');
    setFCategory('external_boarded');
    setFSharePct('100');
    setFPurpose('');
    setFStartDate(todayIso);
    setFExpectedEndDate('');
    setFBoardingFee('0');
    setFStatus('active');
    setFNotes('');
    setFError(null);
    setModalOpen(true);
  }

  function openEditModal(row: AnimalOwnership) {
    setEditing(row);
    setFLivestockId(row.livestockId);
    setFOwnerName(row.ownerName);
    setFOwnerContact(row.ownerContact ?? '');
    setFAccountId(row.accountId ?? '');
    setFCategory(row.ownershipCategory);
    setFSharePct(String(row.sharePercentage));
    setFPurpose(row.purpose ?? '');
    setFStartDate(row.startDate);
    setFExpectedEndDate(row.expectedEndDate ?? '');
    setFBoardingFee(String(row.boardingFee));
    setFStatus(row.status);
    setFNotes(row.notes ?? '');
    setFError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    setFError(null);
    try {
      const payload = {
        livestockId: fLivestockId,
        ownerName: fOwnerName,
        ownerContact: fOwnerContact || null,
        accountId: fAccountId || null,
        ownershipCategory: fCategory,
        sharePercentage: Number(fSharePct),
        purpose: fPurpose || null,
        startDate: fStartDate,
        expectedEndDate: fExpectedEndDate || null,
        boardingFee: Number(fBoardingFee),
        status: fStatus,
        notes: fNotes || null,
      };
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, input: payload });
        setNotice(`Updated ownership for ${fOwnerName}.`);
      } else {
        await createMut.mutateAsync(payload);
        setNotice(`Recorded ownership for ${fOwnerName}.`);
      }
      setModalOpen(false);
    } catch (err) {
      setFError(
        err instanceof Error ? err.message : 'Unable to save ownership record.'
      );
    }
  }

  async function handleDelete(row: AnimalOwnership) {
    if (settings.confirmBeforeDelete && confirmDeleteId !== row.id) {
      setConfirmDeleteId(row.id);
      return;
    }
    setConfirmDeleteId(null);
    await deleteMut.mutateAsync(row.id);
    setNotice(`Removed ownership record for ${row.ownerName}.`);
  }

  return (
    <FarmScrollView
      dockAware
      style={styles.container}
      contentContainerStyle={{
        padding: ui.contentPadding,
        paddingBottom: ui.bottomDockReserve,
        gap: ui.space(12),
      }}
    >
      <View
        style={[
          styles.card,
          { padding: ui.space(12), borderRadius: ui.radius, gap: ui.space(10) },
        ]}
      >
        <View style={[styles.heroRow, { flexWrap: 'wrap' }]}>
          <View style={styles.heroIconWrap}>
            <AppIcon name="ownerships" size={ui.font(24)} />
          </View>
          <View style={{ flex: 1, minWidth: 140 }}>
            <Text style={[styles.heroTitle, { fontSize: ui.font(17) }]}>
              Animal Ownerships
            </Text>
          </View>
          {onOpenNetwork ? (
            <Pressable
              style={[
                styles.networkLinkBtn,
                { minHeight: Math.max(32, ui.chipHeight - 2), paddingVertical: ui.space(4) },
              ]}
              onPress={onOpenNetwork}
            >
              <AppIcon name="network" size={ui.font(14)} />
              <Text style={[styles.networkLinkText, { fontSize: ui.font(11) }]}>
                Network
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={[styles.kpiGrid, { gap: ui.space(8) }]}>
          <View
            style={[
              styles.kpiBox,
              {
                flexBasis: ui.isCompactPhone && (ui.isLargeText || ui.isLargeDensity) ? '100%' : '45%',
                flexGrow: 1,
                minWidth: 130,
              },
            ]}
          >
            <Text style={[styles.kpiLabel, { fontSize: ui.font(10) }]}>
              Non-Farm Active
            </Text>
            <Text style={[styles.kpiValue, { fontSize: ui.font(15) }]}>
              {summary.activeNonFarmOwnedCount}
            </Text>
          </View>
          <View
            style={[
              styles.kpiBox,
              {
                flexBasis: ui.isCompactPhone && (ui.isLargeText || ui.isLargeDensity) ? '100%' : '45%',
                flexGrow: 1,
                minWidth: 130,
              },
            ]}
          >
            <Text style={[styles.kpiLabel, { fontSize: ui.font(10) }]}>
              Sold on Farm
            </Text>
            <Text style={[styles.kpiValue, { fontSize: ui.font(15) }]}>
              {summary.soldRetainedCount}
            </Text>
          </View>
          <View
            style={[
              styles.kpiBox,
              {
                flexBasis: ui.isCompactPhone && (ui.isLargeText || ui.isLargeDensity) ? '100%' : '45%',
                flexGrow: 1,
                minWidth: 130,
              },
            ]}
          >
            <Text style={[styles.kpiLabel, { fontSize: ui.font(10) }]}>
              Breeding / Loans
            </Text>
            <Text style={[styles.kpiValue, { fontSize: ui.font(15) }]}>
              {summary.breedingLoanCount + summary.careQuarantineCount}
            </Text>
          </View>
          <View
            style={[
              styles.kpiBox,
              {
                flexBasis: ui.isCompactPhone && (ui.isLargeText || ui.isLargeDensity) ? '100%' : '45%',
                flexGrow: 1,
                minWidth: 130,
              },
            ]}
          >
            <Text style={[styles.kpiLabel, { fontSize: ui.font(10) }]}>
              Care Fees
            </Text>
            <Text style={[styles.kpiValue, { fontSize: ui.font(14) }]}>
              {formatCurrency(summary.activeBoardingFeeTotal, currency)}
            </Text>
          </View>
        </View>

        {canEdit ? (
          <View style={[styles.actionRow, { gap: ui.space(8) }]}>
            <Pressable
              style={[
                styles.primaryBtn,
                allLivestock.length === 0 && styles.disabledBtn,
                { minHeight: ui.chipHeight, minWidth: 150, paddingVertical: ui.space(6) },
              ]}
              disabled={allLivestock.length === 0}
              onPress={openAddModal}
            >
              <AppIcon name="plus" size={ui.font(14)} />
              <Text style={[styles.primaryBtnText, { fontSize: ui.font(12) }]}>
                Record Ownership
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {notice ? (
        <View style={[styles.noticeBanner, { padding: ui.space(10), borderRadius: ui.radius }]}>
          <Text style={[styles.noticeText, { fontSize: ui.font(12) }]}>{notice}</Text>
          <Pressable onPress={() => setNotice(null)} hitSlop={8}>
            <AppIcon name="close" size={ui.font(14)} />
          </Pressable>
        </View>
      ) : null}

      <MobileFileTabs
        surfaceTone="page"
        activeId={tab}
        onChange={setTab}
        tabs={[
          { id: 'records', label: `Custody (${allOwnerships.length})` },
          { id: 'owners', label: `Owners (${ownerGroups.length})` },
        ]}
      />

      {allOwnerships.length === 0 ? (
        <View style={[styles.emptyCard, { padding: ui.space(20), borderRadius: ui.radius }]}>
          <AppIcon name="peasant" size={ui.font(40)} />
          <Text style={[styles.emptyTitle, { fontSize: ui.font(16) }]}>
            No animal ownerships yet
          </Text>
        </View>
      ) : tab === 'records' ? (
        <View style={{ gap: ui.space(10) }}>
          <View style={[styles.searchRow, { minHeight: ui.controlHeight }]}>
            <AppIcon name="search" size={ui.font(15)} color={FARMDB_COLORS.textMuted} />
            <TextInput
              style={[styles.searchInput, { fontSize: ui.font(14) }]}
              placeholder="Search owner, tag # or purpose..."
              placeholderTextColor={FARMDB_COLORS.textMuted}
              value={search}
              onChangeText={setSearch}
            />
          </View>

          <ModernDropdown
            compact
            value={categoryFilter}
            title="Filter Category"
            accessibilityLabel="Filter by ownership category"
            options={[
              {
                value: 'all',
                label: 'All Ownership Types',
                iconSource: MOBILE_APP_ICONS.peasant,
              },
              ...OWNERSHIP_CATEGORIES.map((c) => ({
                value: c,
                label: formatOwnershipCategoryLabel(c),
                iconSource: MOBILE_APP_ICONS.livestockGroup,
              })),
            ]}
            onChange={setCategoryFilter}
          />

          {filteredOwnerships.map((row) => {
            const animal = livestockById.get(row.livestockId);
            const linkedAcc = row.accountId ? accountsById.get(row.accountId) : null;
            return (
              <View
                key={row.id}
                style={[styles.card, { padding: ui.space(12), borderRadius: ui.radius, gap: 6 }]}
              >
                <View style={[styles.rowBetween, { flexWrap: 'wrap' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 150, flexWrap: 'wrap' }}>
                    {animal ? (
                      <SpeciesIcon
                        species={animal.species}
                        sex={animal.sex}
                        size={ui.font(16)}
                      />
                    ) : (
                      <AppIcon name="livestockGroup" size={ui.font(16)} />
                    )}
                    <Text style={[styles.tagPill, { fontSize: ui.font(11) }]}>
                      {animal?.tagNumber ?? 'Animal'}
                    </Text>
                    <Text style={[styles.cardTitle, { fontSize: ui.font(14), flexShrink: 1 }]} numberOfLines={2}>
                      {animal?.name ?? 'Unnamed'}
                    </Text>
                    <AnimalEyeButton livestockId={row.livestockId} />
                  </View>
                  <Text style={[styles.catBadge, { fontSize: ui.font(10) }]}>
                    {row.sharePercentage}% · {formatOwnershipStatusLabel(row.status)}
                  </Text>
                </View>

                <Text style={[styles.ownerTitle, { fontSize: ui.font(14) }]}>
                  {row.ownerName}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
                  <Text style={[styles.subText, { fontSize: ui.font(12) }]}>
                    {formatOwnershipCategoryLabel(row.ownershipCategory)}
                    {row.ownerContact ? ' · ' : ''}
                  </Text>
                  {row.ownerContact ? (
                    <SmartContactLink value={row.ownerContact} fontSize={ui.font(12)} />
                  ) : null}
                </View>
                {linkedAcc ? (
                  <Text style={[styles.accLink, { fontSize: ui.font(11) }]}>
                    Network Account: {linkedAcc.displayName}
                  </Text>
                ) : null}
                {row.purpose ? (
                  <Text style={[styles.purposeText, { fontSize: ui.font(12) }]}>
                    {row.purpose}
                  </Text>
                ) : null}
                <Text style={[styles.subText, { fontSize: ui.font(11) }]}>
                  Start: {formatDisplayDate(row.startDate, settings.dateFormat)}
                  {row.expectedEndDate
                    ? ` · Pickup: ${formatDisplayDate(row.expectedEndDate, settings.dateFormat)}`
                    : ''}
                  {row.boardingFee > 0
                    ? ` · Fee: ${formatCurrency(row.boardingFee, currency)}`
                    : ''}
                </Text>

                {canEdit || canDelete ? (
                  <View style={[styles.cardFooterBtns, { gap: ui.space(8), marginTop: 4, flexWrap: 'wrap' }]}>
                    {canEdit ? (
                      <Pressable
                        style={styles.smallEditBtn}
                        onPress={() => openEditModal(row)}
                      >
                        <AppIcon name="edit" size={ui.font(13)} />
                        <Text style={[styles.smallEditBtnText, { fontSize: ui.font(12) }]}>
                          Edit
                        </Text>
                      </Pressable>
                    ) : null}
                    {canDelete ? (
                      <Pressable
                        style={styles.smallDeleteBtn}
                        onPress={() => void handleDelete(row)}
                      >
                        <AppIcon name="trash" size={ui.font(13)} />
                        {confirmDeleteId === row.id ? (
                          <Text style={[styles.smallDeleteText, { fontSize: ui.font(11) }]}>
                            Confirm
                          </Text>
                        ) : null}
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : (
        <View style={{ gap: ui.space(10) }}>
          {ownerGroups.map((grp) => (
            <View
              key={grp.key}
              style={[styles.card, { padding: ui.space(12), borderRadius: ui.radius, gap: 6 }]}
            >
              <View style={[styles.rowBetween, { flexWrap: 'wrap' }]}>
                <Text style={[styles.ownerTitle, { fontSize: ui.font(15), flex: 1, minWidth: 140 }]}>
                  {grp.ownerName}
                </Text>
                <Text style={[styles.catBadge, { fontSize: ui.font(11) }]}>
                  {grp.activeCount} active
                </Text>
              </View>
              {grp.ownerContact ? (
                <SmartContactLink value={grp.ownerContact} fontSize={ui.font(12)} />
              ) : null}
              {grp.linkedAccount ? (
                <Text style={[styles.accLink, { fontSize: ui.font(11) }]}>
                  Connected Account: {grp.linkedAccount.displayName}
                </Text>
              ) : null}
              {grp.records.map((rec) => {
                const animal = livestockById.get(rec.livestockId);
                return (
                  <View
                    key={rec.id}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}
                  >
                    <Text style={[styles.subText, { fontSize: ui.font(12), flexShrink: 1 }]}>
                      • {animal?.tagNumber ?? 'Animal'} —{' '}
                      {formatOwnershipCategoryLabel(rec.ownershipCategory)} ({rec.sharePercentage}%)
                    </Text>
                    <AnimalEyeButton livestockId={rec.livestockId} size={ui.font(13)} />
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      )}

      {/* Modal */}
      <Modal
        visible={modalOpen}
        animationType="slide"
        onRequestClose={() => setModalOpen(false)}
      >
        <SafeAreaView style={styles.modalSafe} edges={['top', 'left', 'right', 'bottom']}>
          <View style={[styles.modalHeader, { gap: 10 }]}>
            <Text
              style={[styles.modalTitle, { fontSize: ui.font(17), flex: 1, minWidth: 0 }]}
              numberOfLines={2}
            >
              {editing ? 'Edit Ownership' : 'Add Animal Ownership'}
            </Text>
            <Pressable onPress={() => setModalOpen(false)} hitSlop={8} style={{ flexShrink: 0 }}>
              <AppIcon name="close" size={ui.font(20)} />
            </Pressable>
          </View>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <FarmScrollView
              contentContainerStyle={{ padding: ui.contentPadding, gap: ui.space(12) }}
            >
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { fontSize: ui.font(12) }]}>Animal *</Text>
                <ModernDropdown
                  searchable
                  value={fLivestockId}
                  options={livestockOptions}
                  title="Select Animal"
                  onChange={setFLivestockId}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                  Owner / Buyer / Partner Name *
                </Text>
                <TextInput
                  style={[styles.input, { fontSize: ui.font(14) }]}
                  value={fOwnerName}
                  onChangeText={setFOwnerName}
                  placeholder="e.g. Mr. Kato / Sarah Namono"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { fontSize: ui.font(12) }]}>Contact Phone</Text>
                <TextInput
                  style={[styles.input, { fontSize: ui.font(14) }]}
                  value={fOwnerContact}
                  onChangeText={setFOwnerContact}
                  placeholder="Optional phone or email"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                  Link Farm Network Account
                </Text>
                <ModernDropdown
                  searchable
                  value={fAccountId}
                  options={accountOptions}
                  title="Linked Network Account"
                  onChange={setFAccountId}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                  Ownership Category *
                </Text>
                <ModernDropdown
                  showSelectedHint
                  value={fCategory}
                  options={OWNERSHIP_CATEGORIES.map((c) => ({
                    value: c,
                    label: formatOwnershipCategoryLabel(c),
                    iconSource: MOBILE_APP_ICONS.peasant,
                    hint: OWNERSHIP_CATEGORY_HINTS[c],
                  }))}
                  title="Ownership Type"
                  onChange={setFCategory}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                  Custody Status
                </Text>
                <ModernDropdown
                  showSelectedHint
                  value={fStatus}
                  options={OWNERSHIP_STATUSES.map((s) => ({
                    value: s,
                    label: formatOwnershipStatusLabel(s),
                    iconSource: MOBILE_APP_ICONS.checkmark,
                    hint: OWNERSHIP_STATUS_HINTS[s],
                  }))}
                  title="Status"
                  onChange={setFStatus}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                  Owner Share (%)
                </Text>
                <MobileNumberStepper
                  min={1}
                  max={100}
                  step={5}
                  decimals={0}
                  value={fSharePct}
                  onChangeText={setFSharePct}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                  Boarding / Care Fee ({currency})
                </Text>
                <MobileNumberStepper
                  min={0}
                  step={currency === 'UGX' ? 5000 : 10}
                  decimals={currency === 'UGX' ? 0 : 2}
                  value={fBoardingFee}
                  onChangeText={setFBoardingFee}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { fontSize: ui.font(12) }]}>Start Date *</Text>
                <ModernDatePicker
                  title="Start Date"
                  value={fStartDate}
                  onChange={setFStartDate}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { fontSize: ui.font(12) }]}>
                  Expected Return / Pickup Date
                </Text>
                <ModernDatePicker
                  title="Expected Pickup Date"
                  allowClear
                  value={fExpectedEndDate}
                  onChange={setFExpectedEndDate}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { fontSize: ui.font(12) }]}>Purpose</Text>
                <TextInput
                  style={[styles.input, { fontSize: ui.font(14) }]}
                  value={fPurpose}
                  onChangeText={setFPurpose}
                  placeholder="e.g. Bull for breeding or sold awaiting pickup"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { fontSize: ui.font(12) }]}>Notes</Text>
                <TextInput
                  style={[styles.input, { fontSize: ui.font(14), minHeight: 68 }]}
                  multiline
                  value={fNotes}
                  onChangeText={setFNotes}
                  placeholder="Agreement details..."
                />
              </View>

              {fError ? <Text style={styles.errorText}>{fError}</Text> : null}

              <Pressable
                style={[styles.submitBtn, { minHeight: ui.controlHeight }]}
                onPress={() => void handleSave()}
                disabled={createMut.isPending || updateMut.isPending}
              >
                <Text style={[styles.submitBtnText, { fontSize: ui.font(14) }]}>
                  Save Ownership Record
                </Text>
              </Pressable>
            </FarmScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </FarmScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: FARMDB_COLORS.bg },
  card: {
    backgroundColor: FARMDB_COLORS.surface,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: FARMDB_COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontFamily: FARMDB_FONTS.bold, color: FARMDB_COLORS.text },
  heroSub: { fontFamily: FARMDB_FONTS.regular, color: FARMDB_COLORS.textMuted },
  networkLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    backgroundColor: '#faf8f4',
  },
  networkLinkText: { fontFamily: FARMDB_FONTS.semibold, color: FARMDB_COLORS.text },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  kpiBox: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: '#faf8f4',
    borderWidth: 1,
    borderColor: FARMDB_COLORS.surfaceMuted,
    borderRadius: 10,
    padding: 9,
  },
  kpiLabel: {
    fontFamily: FARMDB_FONTS.medium,
    color: FARMDB_COLORS.textMuted,
    textTransform: 'uppercase',
  },
  kpiValue: { fontFamily: FARMDB_FONTS.bold, color: FARMDB_COLORS.text, marginTop: 2 },
  actionRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: FARMDB_COLORS.accent,
    borderRadius: 999,
    paddingHorizontal: 12,
  },
  primaryBtnText: { fontFamily: FARMDB_FONTS.semibold, color: '#ffffff' },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: FARMDB_COLORS.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
  },
  secondaryBtnText: { fontFamily: FARMDB_FONTS.semibold, color: FARMDB_COLORS.text },
  disabledBtn: { opacity: 0.45 },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: FARMDB_COLORS.accentSoft,
    borderWidth: 1,
    borderColor: 'rgba(45, 106, 79, 0.25)',
  },
  noticeText: { flex: 1, fontFamily: FARMDB_FONTS.medium, color: '#173e2b' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: FARMDB_COLORS.surface,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, fontFamily: FARMDB_FONTS.regular, color: FARMDB_COLORS.text },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  tagPill: {
    fontFamily: FARMDB_FONTS.monoBold,
    backgroundColor: FARMDB_COLORS.accentSoft,
    color: FARMDB_COLORS.accent,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  cardTitle: { fontFamily: FARMDB_FONTS.bold, color: FARMDB_COLORS.text },
  catBadge: {
    fontFamily: FARMDB_FONTS.semibold,
    backgroundColor: FARMDB_COLORS.warnBg,
    color: FARMDB_COLORS.warnText,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  ownerTitle: { fontFamily: FARMDB_FONTS.bold, color: FARMDB_COLORS.text },
  subText: { fontFamily: FARMDB_FONTS.regular, color: FARMDB_COLORS.textMuted },
  accLink: { fontFamily: FARMDB_FONTS.semibold, color: FARMDB_COLORS.accent },
  purposeText: { fontFamily: FARMDB_FONTS.medium, color: FARMDB_COLORS.text },
  cardFooterBtns: { flexDirection: 'row', alignItems: 'center' },
  smallEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: FARMDB_COLORS.surfaceMuted,
  },
  smallEditBtnText: { fontFamily: FARMDB_FONTS.semibold, color: FARMDB_COLORS.text },
  smallDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: FARMDB_COLORS.dangerSoft,
  },
  smallDeleteText: { fontFamily: FARMDB_FONTS.bold, color: FARMDB_COLORS.danger },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: FARMDB_COLORS.surface,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    gap: 8,
  },
  emptyTitle: { fontFamily: FARMDB_FONTS.bold, color: FARMDB_COLORS.text },
  emptySub: {
    fontFamily: FARMDB_FONTS.regular,
    color: FARMDB_COLORS.textMuted,
    textAlign: 'center',
  },
  modalSafe: { flex: 1, backgroundColor: FARMDB_COLORS.bg },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: FARMDB_COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: FARMDB_COLORS.border,
  },
  modalTitle: { fontFamily: FARMDB_FONTS.bold, color: FARMDB_COLORS.text },
  fieldGroup: { gap: 5 },
  label: { fontFamily: FARMDB_FONTS.semibold, color: FARMDB_COLORS.textMuted },
  input: {
    backgroundColor: FARMDB_COLORS.surface,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: FARMDB_FONTS.regular,
    color: FARMDB_COLORS.text,
  },
  errorText: { fontFamily: FARMDB_FONTS.semibold, color: FARMDB_COLORS.danger },
  submitBtn: {
    backgroundColor: FARMDB_COLORS.accent,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  submitBtnText: { fontFamily: FARMDB_FONTS.bold, color: '#ffffff' },
});
