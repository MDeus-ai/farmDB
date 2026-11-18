import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  advancePayDueDate,
  computeHrSummary,
  daysUntilDate,
  formatCurrency,
  formatDisplayDate,
  formatPayFrequencyLabel,
  formatPaymentStatusLabel,
  formatTaskPriorityLabel,
  formatTaskStatusLabel,
  formatWorkerStatusLabel,
  getPaymentDueUrgency,
  getTodayIsoDate,
  WORKER_PAY_FREQUENCIES,
  WORKER_PAYMENT_STATUSES,
  WORKER_STATUSES,
  WORKER_TASK_PRIORITIES,
  WORKER_TASK_STATUSES,
  type FarmWorker,
  type Livestock,
  type WorkerPayFrequency,
  type WorkerPayment,
  type WorkerPaymentStatus,
  type WorkerStatus,
  type WorkerTask,
  describeModuleAccessLevel,
  type WorkerTaskPriority,
  type WorkerTaskStatus,
} from '@farmdb/core';
import {
  useCreateWorker,
  useCreateWorkerPayment,
  useCreateWorkerTask,
  useDeleteWorker,
  useDeleteWorkerPayment,
  useDeleteWorkerTask,
  useLivestockList,
  useMarkWorkerPaymentPaid,
  useUpdateWorker,
  useUpdateWorkerPayment,
  useUpdateWorkerTask,
  useWorkerList,
  useModulePermissions,
  useWorkerPaymentList,
  useWorkerTaskList,
} from '@farmdb/db';
import { MOBILE_APP_ICONS } from '../assets/icons';
import { FARMDB_COLORS, FARMDB_FONTS, useUiScale } from '../theme/uiScale';
import { buildAnimalDropdownOption } from '../utils/animalOptions';
import { AnimalEyeButton } from './AnimalQuickPreviewModal';
import { AppIcon } from './FarmIcons';
import { FarmScrollView } from './FarmScrollView';
import { MobileFileTabs } from './MobileFileTabs';
import { MobileNumberStepper } from './MobileNumberStepper';
import { ModernDatePicker } from './ModernDatePicker';
import {
  ModernDropdown,
  type ModernDropdownOption,
} from './ModernDropdown';

type MobileHrTab = 'staff' | 'payments' | 'tasks';

interface HumanResourcesViewProps {
  onOpenSettings?: () => void;
}

function addDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

function getUrgencyLabel(daysUntil: number): string {
  if (daysUntil < 0) return `${Math.abs(daysUntil)}d overdue`;
  if (daysUntil === 0) return 'Due today';
  if (daysUntil === 1) return 'Tomorrow';
  return `In ${daysUntil}d`;
}

export function HumanResourcesView({ onOpenSettings }: HumanResourcesViewProps) {
  const ui = useUiScale();
  const { settings } = ui;
  const { canEdit, canDelete, accessLevel } = useModulePermissions('hr');
  const currency = settings.currencySymbol;
  const leadDays = settings.paymentAlertLeadDays;
  const todayIso = getTodayIsoDate();

  const workersQuery = useWorkerList({});
  const paymentsQuery = useWorkerPaymentList({});
  const tasksQuery = useWorkerTaskList({});
  const livestockQuery = useLivestockList({ status: 'active' });

  const createWorkerMut = useCreateWorker();
  const updateWorkerMut = useUpdateWorker();
  const deleteWorkerMut = useDeleteWorker();

  const createPaymentMut = useCreateWorkerPayment();
  const updatePaymentMut = useUpdateWorkerPayment();
  const markPaidMut = useMarkWorkerPaymentPaid();
  const deletePaymentMut = useDeleteWorkerPayment();

  const createTaskMut = useCreateWorkerTask();
  const updateTaskMut = useUpdateWorkerTask();
  const deleteTaskMut = useDeleteWorkerTask();

  const allWorkers = workersQuery.data ?? [];
  const allPayments = paymentsQuery.data ?? [];
  const allTasks = tasksQuery.data ?? [];
  const activeLivestock = livestockQuery.data ?? [];

  const [tab, setTab] = useState<MobileHrTab>('staff');
  const [staffSearch, setStaffSearch] = useState('');
  const [staffStatusFilter, setStaffStatusFilter] = useState<WorkerStatus | 'all'>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<WorkerPaymentStatus | 'all'>('all');
  const [taskStatusFilter, setTaskStatusFilter] = useState<WorkerTaskStatus | 'all'>('all');

  const [confirmDeleteWorkerId, setConfirmDeleteWorkerId] = useState<string | null>(null);
  const [confirmDeletePaymentId, setConfirmDeletePaymentId] = useState<string | null>(null);
  const [confirmDeleteTaskId, setConfirmDeleteTaskId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Worker Modal
  const [workerModalOpen, setWorkerModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<FarmWorker | null>(null);
  const [wName, setWName] = useState('');
  const [wRole, setWRole] = useState('');
  const [wPhone, setWPhone] = useState('');
  const [wResponsibilities, setWResponsibilities] = useState('');
  const [wSalary, setWSalary] = useState('300');
  const [wFrequency, setWFrequency] = useState<WorkerPayFrequency>('monthly');
  const [wNextDue, setWNextDue] = useState(todayIso);
  const [wStatus, setWStatus] = useState<WorkerStatus>('active');
  const [wHireDate, setWHireDate] = useState(todayIso);
  const [wError, setWError] = useState<string | null>(null);

  // Payment Modal
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<WorkerPayment | null>(null);
  const [pWorkerId, setPWorkerId] = useState('');
  const [pAmount, setPAmount] = useState('0');
  const [pDueDate, setPDueDate] = useState(todayIso);
  const [pStatus, setPStatus] = useState<WorkerPaymentStatus>('paid');
  const [pPaidDate, setPPaidDate] = useState(todayIso);
  const [pPeriodLabel, setPPeriodLabel] = useState('');
  const [pNotes, setPNotes] = useState('');
  const [pAutoExpense, setPAutoExpense] = useState(settings.autoRecordPayrollExpenseByDefault);
  const [pAdvanceSchedule, setPAdvanceSchedule] = useState(true);
  const [pError, setPError] = useState<string | null>(null);

  // Task Modal
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<WorkerTask | null>(null);
  const [tWorkerId, setTWorkerId] = useState('');
  const [tLivestockId, setTLivestockId] = useState('');
  const [tTitle, setTTitle] = useState('');
  const [tDescription, setTDescription] = useState('');
  const [tPriority, setTPriority] = useState<WorkerTaskPriority>('medium');
  const [tStatus, setTStatus] = useState<WorkerTaskStatus>('pending');
  const [tDueDate, setTDueDate] = useState(todayIso);
  const [tError, setTError] = useState<string | null>(null);

  const workersById = useMemo(
    () => new Map(allWorkers.map((w) => [w.id, w])),
    [allWorkers]
  );
  const animalsById = useMemo(
    () => new Map(activeLivestock.map((a) => [a.id, a])),
    [activeLivestock]
  );

  const summary = useMemo(
    () => computeHrSummary(allWorkers, allPayments, allTasks, todayIso, leadDays),
    [allWorkers, allPayments, allTasks, todayIso, leadDays]
  );

  const openTasksByWorker = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of allTasks) {
      if (t.status !== 'completed') {
        map.set(t.workerId, (map.get(t.workerId) ?? 0) + 1);
      }
    }
    return map;
  }, [allTasks]);

  const filteredWorkers = useMemo(() => {
    const q = staffSearch.trim().toLowerCase();
    return allWorkers.filter((w) => {
      if (staffStatusFilter !== 'all' && w.status !== staffStatusFilter) {
        return false;
      }
      if (q) {
        const hay = `${w.name} ${w.role} ${w.responsibilities ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allWorkers, staffSearch, staffStatusFilter]);

  const filteredPayments = useMemo(
    () =>
      allPayments.filter(
        (p) => paymentStatusFilter === 'all' || p.status === paymentStatusFilter
      ),
    [allPayments, paymentStatusFilter]
  );

  const filteredTasks = useMemo(
    () =>
      allTasks.filter(
        (t) => taskStatusFilter === 'all' || t.status === taskStatusFilter
      ),
    [allTasks, taskStatusFilter]
  );

  const workerOptions = useMemo<ModernDropdownOption<string>[]>(
    () =>
      allWorkers.map((w) => ({
        value: w.id,
        label: w.name,
        hint: `${w.role} · ${formatCurrency(w.salaryAmount, currency)}`,
        iconSource: MOBILE_APP_ICONS.farmer,
      })),
    [allWorkers, currency]
  );

  const livestockOptions = useMemo<ModernDropdownOption<string>[]>(
    () => [
      { value: '', label: 'General Farm Task', iconSource: MOBILE_APP_ICONS.barn },
      ...activeLivestock.map((a: Livestock) =>
        buildAnimalDropdownOption(a, {
          label: `${a.tagNumber}${a.name ? ` · ${a.name}` : ''}`,
        })
      ),
    ],
    [activeLivestock]
  );

  function openAddWorker() {
    setEditingWorker(null);
    setWName('');
    setWRole('');
    setWPhone('');
    setWResponsibilities('');
    setWSalary(currency === 'UGX' ? '350000' : '300');
    setWFrequency('monthly');
    setWNextDue(addDays(todayIso, 30));
    setWStatus('active');
    setWHireDate(todayIso);
    setWError(null);
    setWorkerModalOpen(true);
  }

  function openEditWorker(w: FarmWorker) {
    setEditingWorker(w);
    setWName(w.name);
    setWRole(w.role);
    setWPhone(w.phone ?? '');
    setWResponsibilities(w.responsibilities ?? '');
    setWSalary(String(w.salaryAmount));
    setWFrequency(w.payFrequency);
    setWNextDue(w.nextPaymentDueDate);
    setWStatus(w.status);
    setWHireDate(w.hireDate ?? '');
    setWError(null);
    setWorkerModalOpen(true);
  }

  function openPayModal(worker?: FarmWorker, existing?: WorkerPayment) {
    setEditingPayment(existing ?? null);
    if (existing) {
      const w = workersById.get(existing.workerId);
      setPWorkerId(existing.workerId);
      setPAmount(String(existing.amount));
      setPDueDate(existing.dueDate);
      setPStatus(existing.status);
      setPPaidDate(existing.paidDate ?? todayIso);
      setPPeriodLabel(existing.periodLabel ?? '');
      setPNotes(existing.notes ?? '');
      setPAdvanceSchedule(Boolean(w && existing.dueDate >= w.nextPaymentDueDate));
    } else {
      const target = worker ?? allWorkers[0];
      setPWorkerId(target?.id ?? '');
      setPAmount(target ? String(target.salaryAmount) : '0');
      setPDueDate(target?.nextPaymentDueDate ?? todayIso);
      setPStatus('paid');
      setPPaidDate(todayIso);
      setPPeriodLabel(
        target
          ? `${formatPayFrequencyLabel(target.payFrequency)} Payroll (${todayIso.slice(0, 7)})`
          : ''
      );
      setPNotes('');
      setPAdvanceSchedule(true);
    }
    setPAutoExpense(settings.autoRecordPayrollExpenseByDefault);
    setPError(null);
    setPayModalOpen(true);
  }

  function openTaskModal(defaultWorker?: FarmWorker, existing?: WorkerTask) {
    setEditingTask(existing ?? null);
    if (existing) {
      setTWorkerId(existing.workerId);
      setTLivestockId(existing.livestockId ?? '');
      setTTitle(existing.title);
      setTDescription(existing.description ?? '');
      setTPriority(existing.priority);
      setTStatus(existing.status);
      setTDueDate(existing.dueDate ?? todayIso);
    } else {
      setTWorkerId(defaultWorker?.id ?? allWorkers[0]?.id ?? '');
      setTLivestockId('');
      setTTitle('');
      setTDescription('');
      setTPriority('medium');
      setTStatus('pending');
      setTDueDate(addDays(todayIso, 1));
    }
    setTError(null);
    setTaskModalOpen(true);
  }

  async function handleSaveWorker() {
    setWError(null);
    try {
      const payload = {
        name: wName,
        role: wRole,
        phone: wPhone || null,
        responsibilities: wResponsibilities || null,
        salaryAmount: Number(wSalary),
        payFrequency: wFrequency,
        nextPaymentDueDate: wNextDue,
        status: wStatus,
        hireDate: wHireDate || null,
      };
      if (editingWorker) {
        await updateWorkerMut.mutateAsync({ id: editingWorker.id, input: payload });
        setNotice(`Updated worker ${wName}.`);
      } else {
        await createWorkerMut.mutateAsync(payload);
        setNotice(`Added worker ${wName}.`);
      }
      setWorkerModalOpen(false);
    } catch (err) {
      setWError(err instanceof Error ? err.message : 'Unable to save worker.');
    }
  }

  async function handleSavePayment() {
    setPError(null);
    try {
      if (editingPayment) {
        await updatePaymentMut.mutateAsync({
          id: editingPayment.id,
          input: {
            workerId: pWorkerId,
            amount: Number(pAmount),
            dueDate: pDueDate,
            status: pStatus,
            paidDate: pStatus === 'paid' ? pPaidDate : null,
            periodLabel: pPeriodLabel || null,
            notes: pNotes || null,
          },
        });
        setNotice('Updated payment record.');
      } else {
        const res = await createPaymentMut.mutateAsync({
          input: {
            workerId: pWorkerId,
            amount: Number(pAmount),
            dueDate: pDueDate,
            status: pStatus,
            paidDate: pStatus === 'paid' ? pPaidDate : null,
            periodLabel: pPeriodLabel || null,
            notes: pNotes || null,
          },
          options: {
            autoRecordExpense: pAutoExpense,
            advanceWorkerDueDate: pAdvanceSchedule,
          },
        });
        setNotice(
          res.generatedExpenseLog
            ? 'Salary paid & logged as Payroll Expense.'
            : 'Worker payment saved.'
        );
      }
      setPayModalOpen(false);
    } catch (err) {
      setPError(err instanceof Error ? err.message : 'Unable to save payment.');
    }
  }

  async function handleQuickMarkPaid(
    payment: WorkerPayment,
    worker?: FarmWorker
  ) {
    const res = await markPaidMut.mutateAsync({
      id: payment.id,
      options: {
        paidDate: todayIso,
        autoRecordExpense: settings.autoRecordPayrollExpenseByDefault,
        advanceWorkerDueDate: Boolean(
          worker && payment.dueDate >= worker.nextPaymentDueDate
        ),
      },
    });
    setNotice(
      res.generatedExpenseLog
        ? `Marked paid & logged Payroll Expense.`
        : 'Marked payment paid.'
    );
  }

  async function handleSaveTask() {
    setTError(null);
    try {
      const payload = {
        workerId: tWorkerId,
        livestockId: tLivestockId || null,
        title: tTitle,
        description: tDescription || null,
        priority: tPriority,
        status: tStatus,
        dueDate: tDueDate || null,
      };
      if (editingTask) {
        await updateTaskMut.mutateAsync({ id: editingTask.id, input: payload });
        setNotice('Task updated.');
      } else {
        await createTaskMut.mutateAsync(payload);
        setNotice('Task assigned.');
      }
      setTaskModalOpen(false);
    } catch (err) {
      setTError(err instanceof Error ? err.message : 'Unable to save task.');
    }
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
      {/* Header / KPI Card */}
      <View style={[styles.card, { padding: ui.space(12), borderRadius: ui.radius, gap: ui.space(10) }]}>
        <View style={[styles.heroRow, { flexWrap: 'wrap' }]}>
          <View style={styles.heroIconWrap}>
            <AppIcon name="staff" size={ui.font(24)} />
          </View>
          <View style={{ flex: 1, minWidth: 140 }}>
            <Text style={[styles.heroTitle, { fontSize: ui.font(17) }]}>
              Human Resources
            </Text>
          </View>
          {onOpenSettings ? (
            <Pressable
              style={[styles.leadPill, { minHeight: Math.max(32, ui.chipHeight - 2), paddingVertical: ui.space(4) }]}
              onPress={onOpenSettings}
            >
              <AppIcon name="alerts" size={ui.font(13)} />
              <Text style={[styles.leadPillText, { fontSize: ui.font(11) }]}>
                {leadDays}d lead
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
                minWidth: 132,
              },
            ]}
          >
            <Text style={[styles.kpiLabel, { fontSize: ui.font(10) }]}>
              Active / Monthly Est.
            </Text>
            <Text style={[styles.kpiValue, { fontSize: ui.font(14) }]}>
              {summary.activeWorkers} · {formatCurrency(summary.estimatedMonthlyPayroll, currency)}
            </Text>
          </View>
          <View
            style={[
              styles.kpiBox,
              {
                flexBasis: ui.isCompactPhone && (ui.isLargeText || ui.isLargeDensity) ? '100%' : '45%',
                minWidth: 132,
              },
            ]}
          >
            <Text style={[styles.kpiLabel, { fontSize: ui.font(10) }]}>
              Due / Almost-Due
            </Text>
            <Text
              style={[
                styles.kpiValue,
                summary.dueSoonOrOverdueCount > 0 && { color: FARMDB_COLORS.danger },
                { fontSize: ui.font(14) },
              ]}
            >
              {summary.dueSoonOrOverdueCount} ({formatCurrency(summary.dueSoonOrOverdueAmount, currency)})
            </Text>
          </View>
          <View
            style={[
              styles.kpiBox,
              {
                flexBasis: ui.isCompactPhone && (ui.isLargeText || ui.isLargeDensity) ? '100%' : '45%',
                minWidth: 132,
              },
            ]}
          >
            <Text style={[styles.kpiLabel, { fontSize: ui.font(10) }]}>
              Pending Payments
            </Text>
            <Text style={[styles.kpiValue, { fontSize: ui.font(14) }]}>
              {formatCurrency(summary.pendingPaymentsAmount, currency)}
            </Text>
          </View>
          <View
            style={[
              styles.kpiBox,
              {
                flexBasis: ui.isCompactPhone && (ui.isLargeText || ui.isLargeDensity) ? '100%' : '45%',
                minWidth: 132,
              },
            ]}
          >
            <Text style={[styles.kpiLabel, { fontSize: ui.font(10) }]}>
              Open Tasks
            </Text>
            <Text style={[styles.kpiValue, { fontSize: ui.font(14) }]}>
              {summary.openTasksCount} ({summary.highPriorityTasksCount} high)
            </Text>
          </View>
        </View>

        {canEdit ? (
          <View style={[styles.actionRow, { gap: ui.space(8) }]}>
            <Pressable
              style={[styles.primaryBtn, { minHeight: ui.chipHeight, minWidth: 92, paddingVertical: ui.space(6) }]}
              onPress={openAddWorker}
            >
              <AppIcon name="plus" size={ui.font(14)} />
              <Text style={[styles.primaryBtnText, { fontSize: ui.font(12) }]}>
                Worker
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.secondaryBtn,
                allWorkers.length === 0 && styles.disabledBtn,
                { minHeight: ui.chipHeight, minWidth: 82, paddingVertical: ui.space(6) },
              ]}
              disabled={allWorkers.length === 0}
              onPress={() => openPayModal()}
            >
              <AppIcon name="income" size={ui.font(14)} />
              <Text style={[styles.secondaryBtnText, { fontSize: ui.font(12) }]}>
                Pay
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.secondaryBtn,
                allWorkers.length === 0 && styles.disabledBtn,
                { minHeight: ui.chipHeight, minWidth: 82, paddingVertical: ui.space(6) },
              ]}
              disabled={allWorkers.length === 0}
              onPress={() => openTaskModal()}
            >
              <AppIcon name="note" size={ui.font(14)} />
              <Text style={[styles.secondaryBtnText, { fontSize: ui.font(12) }]}>
                Task
              </Text>
            </Pressable>
          </View>
        ) : (
          <View
            style={{
              alignSelf: 'flex-start',
              paddingHorizontal: ui.space(10),
              paddingVertical: ui.space(6),
              borderRadius: 999,
              backgroundColor: '#f3efe4',
              borderWidth: 1,
              borderColor: FARMDB_COLORS.border,
            }}
          >
            <Text style={{ fontFamily: FARMDB_FONTS.bold, fontSize: ui.font(11), color: FARMDB_COLORS.textMuted }}>
              {describeModuleAccessLevel(accessLevel)}
            </Text>
          </View>
        )}
      </View>

      {notice ? (
        <View style={[styles.noticeBanner, { padding: ui.space(10), borderRadius: ui.radius }]}>
          <Text style={[styles.noticeText, { fontSize: ui.font(12) }]}>
            {notice}
          </Text>
          <Pressable onPress={() => setNotice(null)} hitSlop={8}>
            <AppIcon name="close" size={ui.font(14)} />
          </Pressable>
        </View>
      ) : null}

      {/* Payment Due / Almost-Due Alerts */}
      {summary.duePaymentAlerts.length > 0 ? (
        <View style={[styles.alertPanel, { padding: ui.space(12), borderRadius: ui.radius, gap: ui.space(8) }]}>
          <View style={styles.alertHeadRow}>
            <AppIcon name="alerts" size={ui.font(17)} />
            <Text style={[styles.alertHeadTitle, { fontSize: ui.font(13), flexShrink: 1 }]}>
              {summary.dueSoonOrOverdueCount} Payment Alert
              {summary.dueSoonOrOverdueCount === 1 ? '' : 's'} (within {leadDays}d)
            </Text>
          </View>
          {summary.duePaymentAlerts.map((item) => (
            <View key={item.key} style={[styles.alertRowCard, { flexWrap: 'wrap' }]}>
              <View style={{ flex: 1, minWidth: 160 }}>
                <Text style={[styles.alertWorkerName, { fontSize: ui.font(13) }]}>
                  {item.worker.name} · {formatCurrency(item.amount, currency)}
                </Text>
                <Text style={[styles.alertMeta, { fontSize: ui.font(11) }]}>
                  {getUrgencyLabel(item.daysUntilDue)} · Due{' '}
                  {formatDisplayDate(item.dueDate, settings.dateFormat)}
                </Text>
              </View>
              {canEdit ? (
                <Pressable
                  style={[styles.payQuickBtn, { minHeight: Math.max(32, ui.chipHeight - 2), paddingVertical: ui.space(5) }]}
                  onPress={() => {
                    if (item.payment) {
                      void handleQuickMarkPaid(item.payment, item.worker);
                    } else {
                      openPayModal(item.worker);
                    }
                  }}
                >
                  <Text style={[styles.payQuickBtnText, { fontSize: ui.font(11) }]}>
                    {item.payment ? 'Mark Paid' : 'Pay Now'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {/* Folder Tabs */}
      <MobileFileTabs
        surfaceTone="page"
        activeId={tab}
        onChange={setTab}
        tabs={[
          { id: 'staff', label: `Staff (${allWorkers.length})` },
          { id: 'payments', label: `Payments (${allPayments.length})` },
          { id: 'tasks', label: `Tasks (${summary.openTasksCount})` },
        ]}
      />

      {allWorkers.length === 0 ? (
        <View style={[styles.emptyCard, { padding: ui.space(22), borderRadius: ui.radius }]}>
          <AppIcon name="farmer" size={ui.font(40)} />
          <Text style={[styles.emptyTitle, { fontSize: ui.font(16) }]}>
            No workers yet
          </Text>
        </View>
      ) : tab === 'staff' ? (
        <View style={{ gap: ui.space(10) }}>
          <View style={[styles.searchRow, { minHeight: ui.controlHeight }]}>
            <AppIcon name="search" size={ui.font(15)} color={FARMDB_COLORS.textMuted} />
            <TextInput
              style={[styles.searchInput, { fontSize: ui.font(14) }]}
              placeholder="Search workers, roles, responsibilities..."
              placeholderTextColor={FARMDB_COLORS.textMuted}
              value={staffSearch}
              onChangeText={setStaffSearch}
            />
          </View>

          <ModernDropdown
            compact
            value={staffStatusFilter}
            options={[
              { value: 'all', label: 'All Worker Statuses', iconSource: MOBILE_APP_ICONS.staff },
              ...WORKER_STATUSES.map((st) => ({
                value: st,
                label: formatWorkerStatusLabel(st),
                iconSource: MOBILE_APP_ICONS.farmer,
              })),
            ]}
            title="Filter by Status"
            onChange={setStaffStatusFilter}
          />

          {filteredWorkers.map((worker) => {
            const urgency = getPaymentDueUrgency(worker.nextPaymentDueDate, todayIso, leadDays);
            const daysLeft = daysUntilDate(worker.nextPaymentDueDate, todayIso);
            const openTasks = openTasksByWorker.get(worker.id) ?? 0;

            return (
              <View
                key={worker.id}
                style={[styles.card, { padding: ui.space(12), borderRadius: ui.radius, gap: ui.space(8) }]}
              >
                <View style={[styles.workerHeadRow, { flexWrap: 'wrap' }]}>
                  <View style={styles.avatarBox}>
                    <AppIcon name="farmer" size={ui.font(22)} />
                  </View>
                  <View style={{ flex: 1, minWidth: 140 }}>
                    <Text style={[styles.workerName, { fontSize: ui.font(15) }]} numberOfLines={2}>
                      {worker.name}
                    </Text>
                    <Text style={[styles.workerRole, { fontSize: ui.font(12) }]} numberOfLines={2}>
                      {worker.role}
                      {worker.phone ? ` · ${worker.phone}` : ''}
                    </Text>
                  </View>
                  <View style={styles.statusPill}>
                    <Text style={[styles.statusPillText, { fontSize: ui.font(10) }]}>
                      {formatWorkerStatusLabel(worker.status)}
                    </Text>
                  </View>
                </View>

                {worker.responsibilities ? (
                  <View style={styles.respBox}>
                    <Text style={[styles.respText, { fontSize: ui.font(12) }]}>
                      {worker.responsibilities}
                    </Text>
                  </View>
                ) : null}

                <View style={[styles.workerMetricsRow, { flexWrap: 'wrap' }]}>
                  <View style={{ flex: 1, minWidth: 132 }}>
                    <Text style={[styles.kpiLabel, { fontSize: ui.font(10) }]}>Salary</Text>
                    <Text style={[styles.metricBold, { fontSize: ui.font(13) }]}>
                      {formatCurrency(worker.salaryAmount, currency)} /{' '}
                      {formatPayFrequencyLabel(worker.payFrequency)}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 132 }}>
                    <Text style={[styles.kpiLabel, { fontSize: ui.font(10) }]}>
                      Next Payday ({getUrgencyLabel(daysLeft)})
                    </Text>
                    <Text
                      style={[
                        styles.metricBold,
                        (urgency === 'overdue' || urgency === 'due_today' || urgency === 'almost_due') && {
                          color: FARMDB_COLORS.warnText,
                        },
                        urgency === 'overdue' && { color: FARMDB_COLORS.danger },
                        { fontSize: ui.font(13) },
                      ]}
                    >
                      {formatDisplayDate(worker.nextPaymentDueDate, settings.dateFormat)}
                    </Text>
                  </View>
                </View>

                {canEdit || canDelete ? (
                  <View style={[styles.cardActionsRow, { gap: ui.space(8) }]}>
                    {canEdit ? (
                      <>
                        <Pressable
                          style={[styles.payQuickBtn, { minHeight: Math.max(32, ui.chipHeight - 2) }]}
                          onPress={() => openPayModal(worker)}
                        >
                          <Text style={[styles.payQuickBtnText, { fontSize: ui.font(11) }]}>
                            Pay Salary
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[styles.chipActionBtn, { minHeight: Math.max(32, ui.chipHeight - 2) }]}
                          onPress={() => openTaskModal(worker)}
                        >
                          <Text style={[styles.chipActionText, { fontSize: ui.font(11) }]}>
                            + Task ({openTasks})
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[styles.chipActionBtn, { minHeight: Math.max(32, ui.chipHeight - 2) }]}
                          onPress={() => openEditWorker(worker)}
                        >
                          <AppIcon name="edit" size={ui.font(13)} />
                        </Pressable>
                      </>
                    ) : null}
                    {canDelete ? (
                      confirmDeleteWorkerId === worker.id ? (
                        <Pressable
                          style={[styles.dangerChipBtn, { minHeight: Math.max(32, ui.chipHeight - 2) }]}
                          onPress={() => {
                            setConfirmDeleteWorkerId(null);
                            void deleteWorkerMut.mutateAsync(worker.id);
                          }}
                        >
                          <Text style={[styles.dangerChipText, { fontSize: ui.font(11) }]}>
                            Confirm
                          </Text>
                        </Pressable>
                      ) : (
                        <Pressable
                          style={[styles.dangerChipBtn, { minHeight: Math.max(32, ui.chipHeight - 2) }]}
                          onPress={() => {
                            if (settings.confirmBeforeDelete) {
                              setConfirmDeleteWorkerId(worker.id);
                            } else {
                              void deleteWorkerMut.mutateAsync(worker.id);
                            }
                          }}
                        >
                          <AppIcon name="trash" size={ui.font(13)} />
                        </Pressable>
                      )
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : tab === 'payments' ? (
        <View style={{ gap: ui.space(10) }}>
          <ModernDropdown
            compact
            value={paymentStatusFilter}
            options={[
              { value: 'all', label: 'All Payments', iconSource: MOBILE_APP_ICONS.money },
              ...WORKER_PAYMENT_STATUSES.map((st) => ({
                value: st,
                label: formatPaymentStatusLabel(st),
                iconSource: st === 'paid' ? MOBILE_APP_ICONS.checkmark : MOBILE_APP_ICONS.hourglass,
              })),
            ]}
            title="Filter Payments"
            onChange={setPaymentStatusFilter}
          />

          {filteredPayments.length === 0 ? (
            <View style={[styles.emptyCard, { padding: ui.space(18), borderRadius: ui.radius }]}>
              <Text style={[styles.emptySub, { fontSize: ui.font(13) }]}>
                No payment entries yet.
              </Text>
            </View>
          ) : (
            filteredPayments.map((payment) => {
              const worker = workersById.get(payment.workerId);
              const daysLeft = daysUntilDate(payment.dueDate, todayIso);
              return (
                <View
                  key={payment.id}
                  style={[styles.card, { padding: ui.space(12), borderRadius: ui.radius, gap: ui.space(6) }]}
                >
                  <View style={styles.workerHeadRow}>
                    <View style={{ flex: 1, minWidth: 140 }}>
                      <Text style={[styles.workerName, { fontSize: ui.font(15) }]}>
                        {worker?.name ?? 'Removed Worker'}
                      </Text>
                      <Text style={[styles.workerRole, { fontSize: ui.font(12) }]}>
                        {payment.periodLabel ?? 'Salary / Wage'}
                      </Text>
                    </View>
                    <Text style={[styles.paymentAmountText, { fontSize: ui.font(15) }]}>
                      {formatCurrency(payment.amount, currency)}
                    </Text>
                  </View>

                  <Text style={[styles.alertMeta, { fontSize: ui.font(11) }]}>
                    {payment.status === 'paid'
                      ? `Paid ${formatDisplayDate(payment.paidDate ?? payment.dueDate, settings.dateFormat)}${payment.financialLogId ? ' · In Financial Ledger' : ''
                      }`
                      : `Pending · Due ${formatDisplayDate(payment.dueDate, settings.dateFormat)} (${getUrgencyLabel(daysLeft)})`}
                  </Text>

                  {canEdit || canDelete ? (
                    <View style={[styles.cardActionsRow, { gap: ui.space(8) }]}>
                      {canEdit ? (
                        <>
                          {payment.status === 'pending' ? (
                            <Pressable
                              style={[styles.payQuickBtn, { minHeight: Math.max(32, ui.chipHeight - 2) }]}
                              onPress={() => void handleQuickMarkPaid(payment, worker)}
                            >
                              <Text style={[styles.payQuickBtnText, { fontSize: ui.font(11) }]}>
                                Mark Paid
                              </Text>
                            </Pressable>
                          ) : null}
                          <Pressable
                            style={[styles.chipActionBtn, { minHeight: Math.max(32, ui.chipHeight - 2) }]}
                            onPress={() => openPayModal(worker, payment)}
                          >
                            <AppIcon name="edit" size={ui.font(13)} />
                          </Pressable>
                        </>
                      ) : null}
                      {canDelete ? (
                        confirmDeletePaymentId === payment.id ? (
                          <Pressable
                            style={[styles.dangerChipBtn, { minHeight: Math.max(32, ui.chipHeight - 2) }]}
                            onPress={() => {
                              setConfirmDeletePaymentId(null);
                              void deletePaymentMut.mutateAsync(payment.id);
                            }}
                          >
                            <Text style={[styles.dangerChipText, { fontSize: ui.font(11) }]}>
                              Confirm
                            </Text>
                          </Pressable>
                        ) : (
                          <Pressable
                            style={[styles.dangerChipBtn, { minHeight: Math.max(32, ui.chipHeight - 2) }]}
                            onPress={() => {
                              if (settings.confirmBeforeDelete) {
                                setConfirmDeletePaymentId(payment.id);
                              } else {
                                void deletePaymentMut.mutateAsync(payment.id);
                              }
                            }}
                          >
                            <AppIcon name="trash" size={ui.font(13)} />
                          </Pressable>
                        )
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
      ) : (
        <View style={{ gap: ui.space(10) }}>
          <ModernDropdown
            compact
            value={taskStatusFilter}
            options={[
              { value: 'all', label: 'All Tasks', iconSource: MOBILE_APP_ICONS.copyWriting },
              ...WORKER_TASK_STATUSES.map((st) => ({
                value: st,
                label: formatTaskStatusLabel(st),
                iconSource: st === 'completed' ? MOBILE_APP_ICONS.checkmark : MOBILE_APP_ICONS.hourglass,
              })),
            ]}
            title="Filter Tasks"
            onChange={setTaskStatusFilter}
          />

          {filteredTasks.length === 0 ? (
            <View style={[styles.emptyCard, { padding: ui.space(18), borderRadius: ui.radius }]}>
              <Text style={[styles.emptySub, { fontSize: ui.font(13) }]}>
                No allocated tasks found.
              </Text>
            </View>
          ) : (
            filteredTasks.map((task) => {
              const worker = workersById.get(task.workerId);
              const animal = task.livestockId
                ? animalsById.get(task.livestockId)
                : null;
              return (
                <View
                  key={task.id}
                  style={[styles.card, { padding: ui.space(12), borderRadius: ui.radius, gap: ui.space(6) }]}
                >
                  <View style={styles.workerHeadRow}>
                    <View style={{ flex: 1, minWidth: 140 }}>
                      <Text style={[styles.workerName, { fontSize: ui.font(14) }]}>
                        {task.title}
                      </Text>
                      <Text style={[styles.workerRole, { fontSize: ui.font(12) }]}>
                        {worker?.name ?? 'Unknown'} · {formatTaskPriorityLabel(task.priority)} ·{' '}
                        {formatTaskStatusLabel(task.status)}
                        {animal ? ` · ${animal.tagNumber}` : ''}
                      </Text>
                    </View>
                    {animal ? <AnimalEyeButton livestockId={animal.id} /> : null}
                  </View>
                  {task.description ? (
                    <Text style={[styles.respText, { fontSize: ui.font(12) }]}>
                      {task.description}
                    </Text>
                  ) : null}
                  {task.dueDate ? (
                    <Text style={[styles.alertMeta, { fontSize: ui.font(11) }]}>
                      Due {formatDisplayDate(task.dueDate, settings.dateFormat)}
                    </Text>
                  ) : null}

                  {canEdit || canDelete ? (
                    <View style={[styles.cardActionsRow, { gap: ui.space(8) }]}>
                      {canEdit ? (
                        <>
                          {task.status === 'pending' ? (
                            <Pressable
                              style={[styles.chipActionBtn, { minHeight: Math.max(32, ui.chipHeight - 2) }]}
                              onPress={() =>
                                void updateTaskMut.mutateAsync({
                                  id: task.id,
                                  input: { status: 'in_progress' },
                                })
                              }
                            >
                              <Text style={[styles.chipActionText, { fontSize: ui.font(11) }]}>
                                Start
                              </Text>
                            </Pressable>
                          ) : null}
                          {task.status !== 'completed' ? (
                            <Pressable
                              style={[styles.payQuickBtn, { minHeight: Math.max(32, ui.chipHeight - 2) }]}
                              onPress={() =>
                                void updateTaskMut.mutateAsync({
                                  id: task.id,
                                  input: { status: 'completed' },
                                })
                              }
                            >
                              <Text style={[styles.payQuickBtnText, { fontSize: ui.font(11) }]}>
                                Complete
                              </Text>
                            </Pressable>
                          ) : (
                            <Pressable
                              style={[styles.chipActionBtn, { minHeight: Math.max(32, ui.chipHeight - 2) }]}
                              onPress={() =>
                                void updateTaskMut.mutateAsync({
                                  id: task.id,
                                  input: { status: 'pending' },
                                })
                              }
                            >
                              <Text style={[styles.chipActionText, { fontSize: ui.font(11) }]}>
                                Reopen
                              </Text>
                            </Pressable>
                          )}
                          <Pressable
                            style={[styles.chipActionBtn, { minHeight: Math.max(32, ui.chipHeight - 2) }]}
                            onPress={() => openTaskModal(worker, task)}
                          >
                            <AppIcon name="edit" size={ui.font(13)} />
                          </Pressable>
                        </>
                      ) : null}
                      {canDelete ? (
                        confirmDeleteTaskId === task.id ? (
                          <Pressable
                            style={[styles.dangerChipBtn, { minHeight: Math.max(32, ui.chipHeight - 2) }]}
                            onPress={() => {
                              setConfirmDeleteTaskId(null);
                              void deleteTaskMut.mutateAsync(task.id);
                            }}
                          >
                            <Text style={[styles.dangerChipText, { fontSize: ui.font(11) }]}>
                              Confirm
                            </Text>
                          </Pressable>
                        ) : (
                          <Pressable
                            style={[styles.dangerChipBtn, { minHeight: Math.max(32, ui.chipHeight - 2) }]}
                            onPress={() => {
                              if (settings.confirmBeforeDelete) {
                                setConfirmDeleteTaskId(task.id);
                              } else {
                                void deleteTaskMut.mutateAsync(task.id);
                              }
                            }}
                          >
                            <AppIcon name="trash" size={ui.font(13)} />
                          </Pressable>
                        )
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
      )}

      {/* Worker Modal */}
      <Modal
        visible={workerModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setWorkerModalOpen(false)}
      >
        <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom', 'left', 'right']}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={[styles.modalHeader, { paddingHorizontal: ui.contentPadding }]}>
              <Text style={[styles.modalTitle, { fontSize: ui.font(17) }]}>
                {editingWorker ? `Edit ${editingWorker.name}` : 'Add Farm Worker'}
              </Text>
              <Pressable onPress={() => setWorkerModalOpen(false)} hitSlop={10}>
                <AppIcon name="close" size={ui.font(20)} />
              </Pressable>
            </View>
            <FarmScrollView
              contentContainerStyle={{ padding: ui.contentPadding, gap: ui.space(8), paddingBottom: 40 }}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={[styles.fieldLabel, { fontSize: ui.font(12) }]}>Full Name *</Text>
              <TextInput
                style={[styles.input, { minHeight: ui.controlHeight, fontSize: ui.font(14) }]}
                value={wName}
                onChangeText={setWName}
                placeholder="e.g. Samuel Kiptoo"
              />
              <Text style={[styles.fieldLabel, { fontSize: ui.font(12) }]}>Role / Title *</Text>
              <TextInput
                style={[styles.input, { minHeight: ui.controlHeight, fontSize: ui.font(14) }]}
                value={wRole}
                onChangeText={setWRole}
                placeholder="e.g. Lead Herdsman"
              />
              <Text style={[styles.fieldLabel, { fontSize: ui.font(12) }]}>Phone</Text>
              <TextInput
                style={[styles.input, { minHeight: ui.controlHeight, fontSize: ui.font(14) }]}
                value={wPhone}
                onChangeText={setWPhone}
                placeholder="Optional contact number"
              />
              <Text style={[styles.fieldLabel, { fontSize: ui.font(12) }]}>
                Salary Amount ({currency}) *
              </Text>
              <MobileNumberStepper
                min={0}
                step={currency === 'UGX' ? 5000 : 10}
                decimals={currency === 'UGX' ? 0 : 2}
                value={wSalary}
                onChangeText={setWSalary}
              />
              <Text style={[styles.fieldLabel, { fontSize: ui.font(12) }]}>Pay Frequency</Text>
              <ModernDropdown
                value={wFrequency}
                options={WORKER_PAY_FREQUENCIES.map((f) => ({
                  value: f,
                  label: formatPayFrequencyLabel(f),
                  iconSource: MOBILE_APP_ICONS.calendar,
                }))}
                title="Pay Frequency"
                onChange={setWFrequency}
              />
              <Text style={[styles.fieldLabel, { fontSize: ui.font(12) }]}>
                Next Payment Due Date *
              </Text>
              <ModernDatePicker value={wNextDue} onChange={setWNextDue} />
              <Text style={[styles.fieldLabel, { fontSize: ui.font(12) }]}>Status</Text>
              <ModernDropdown
                value={wStatus}
                options={WORKER_STATUSES.map((s) => ({
                  value: s,
                  label: formatWorkerStatusLabel(s),
                  iconSource: MOBILE_APP_ICONS.farmer,
                }))}
                title="Worker Status"
                onChange={setWStatus}
              />
              <Text style={[styles.fieldLabel, { fontSize: ui.font(12) }]}>Responsibilities</Text>
              <TextInput
                style={[styles.input, { minHeight: 74, textAlignVertical: 'top', fontSize: ui.font(14) }]}
                multiline
                value={wResponsibilities}
                onChangeText={setWResponsibilities}
                placeholder="Morning milking, calf feeding, paddock rotation..."
              />
              {wError ? <Text style={styles.errorText}>{wError}</Text> : null}
              <Pressable
                style={[styles.submitBtn, { minHeight: ui.controlHeight }]}
                onPress={() => void handleSaveWorker()}
              >
                <Text style={[styles.submitBtnText, { fontSize: ui.font(14) }]}>
                  Save Worker
                </Text>
              </Pressable>
            </FarmScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Payment Modal */}
      <Modal
        visible={payModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPayModalOpen(false)}
      >
        <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom', 'left', 'right']}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={[styles.modalHeader, { paddingHorizontal: ui.contentPadding }]}>
              <Text style={[styles.modalTitle, { fontSize: ui.font(17) }]}>
                {editingPayment ? 'Edit Payment' : 'Pay / Schedule Salary'}
              </Text>
              <Pressable onPress={() => setPayModalOpen(false)} hitSlop={10}>
                <AppIcon name="close" size={ui.font(20)} />
              </Pressable>
            </View>
            <FarmScrollView
              contentContainerStyle={{ padding: ui.contentPadding, gap: ui.space(8), paddingBottom: 40 }}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={[styles.fieldLabel, { fontSize: ui.font(12) }]}>Worker *</Text>
              <ModernDropdown
                searchable
                value={pWorkerId}
                options={workerOptions}
                title="Select Worker"
                onChange={(nextId) => {
                  setPWorkerId(nextId);
                  if (!editingPayment) {
                    const w = workersById.get(nextId);
                    if (w) {
                      setPAmount(String(w.salaryAmount));
                      setPDueDate(w.nextPaymentDueDate);
                    }
                  }
                }}
              />
              <Text style={[styles.fieldLabel, { fontSize: ui.font(12) }]}>
                Amount ({currency}) *
              </Text>
              <MobileNumberStepper
                min={0.01}
                step={currency === 'UGX' ? 5000 : 10}
                decimals={currency === 'UGX' ? 0 : 2}
                value={pAmount}
                onChangeText={setPAmount}
              />
              <Text style={[styles.fieldLabel, { fontSize: ui.font(12) }]}>Status</Text>
              <ModernDropdown
                value={pStatus}
                options={WORKER_PAYMENT_STATUSES.map((s) => ({
                  value: s,
                  label: formatPaymentStatusLabel(s),
                  iconSource: s === 'paid' ? MOBILE_APP_ICONS.checkmark : MOBILE_APP_ICONS.hourglass,
                }))}
                title="Payment Status"
                onChange={setPStatus}
              />
              <Text style={[styles.fieldLabel, { fontSize: ui.font(12) }]}>Due Date *</Text>
              <ModernDatePicker value={pDueDate} onChange={setPDueDate} />
              {pStatus === 'paid' ? (
                <>
                  <Text style={[styles.fieldLabel, { fontSize: ui.font(12) }]}>Paid Date</Text>
                  <ModernDatePicker value={pPaidDate} onChange={setPPaidDate} />
                </>
              ) : null}
              <Text style={[styles.fieldLabel, { fontSize: ui.font(12) }]}>Period Label</Text>
              <TextInput
                style={[styles.input, { minHeight: ui.controlHeight, fontSize: ui.font(14) }]}
                value={pPeriodLabel}
                onChangeText={setPPeriodLabel}
                placeholder="e.g. Nov 2026 Salary"
              />
              {!editingPayment && pStatus === 'paid' ? (
                <>
                  <View style={styles.switchRow}>
                    <Text style={[styles.fieldLabel, { flex: 1, fontSize: ui.font(12) }]}>
                      Auto-record Payroll Expense in Financial Ledger
                    </Text>
                    <Switch value={pAutoExpense} onValueChange={setPAutoExpense} />
                  </View>
                  <View style={styles.switchRow}>
                    <Text style={[styles.fieldLabel, { flex: 1, fontSize: ui.font(12) }]}>
                      Advance worker&apos;s next payday (
                      {(() => {
                        const w = workersById.get(pWorkerId);
                        return w ? advancePayDueDate(w.nextPaymentDueDate, w.payFrequency) : 'Next';
                      })()}
                      )
                    </Text>
                    <Switch value={pAdvanceSchedule} onValueChange={setPAdvanceSchedule} />
                  </View>
                </>
              ) : null}
              {pError ? <Text style={styles.errorText}>{pError}</Text> : null}
              <Pressable
                style={[styles.submitBtn, { minHeight: ui.controlHeight }]}
                onPress={() => void handleSavePayment()}
              >
                <Text style={[styles.submitBtnText, { fontSize: ui.font(14) }]}>
                  {pStatus === 'paid' ? 'Save Paid Salary' : 'Schedule Pending Payment'}
                </Text>
              </Pressable>
            </FarmScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Task Modal */}
      <Modal
        visible={taskModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setTaskModalOpen(false)}
      >
        <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom', 'left', 'right']}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={[styles.modalHeader, { paddingHorizontal: ui.contentPadding }]}>
              <Text style={[styles.modalTitle, { fontSize: ui.font(17) }]}>
                {editingTask ? 'Edit Task' : 'Assign Farm Task'}
              </Text>
              <Pressable onPress={() => setTaskModalOpen(false)} hitSlop={10}>
                <AppIcon name="close" size={ui.font(20)} />
              </Pressable>
            </View>
            <FarmScrollView
              contentContainerStyle={{ padding: ui.contentPadding, gap: ui.space(8), paddingBottom: 40 }}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={[styles.fieldLabel, { fontSize: ui.font(12) }]}>Worker *</Text>
              <ModernDropdown
                searchable
                value={tWorkerId}
                options={workerOptions}
                title="Select Worker"
                onChange={setTWorkerId}
              />
              <Text style={[styles.fieldLabel, { fontSize: ui.font(12) }]}>Task Title *</Text>
              <TextInput
                style={[styles.input, { minHeight: ui.controlHeight, fontSize: ui.font(14) }]}
                value={tTitle}
                onChangeText={setTTitle}
                placeholder="e.g. Clean cooling tank"
              />
              <Text style={[styles.fieldLabel, { fontSize: ui.font(12) }]}>Priority</Text>
              <ModernDropdown
                value={tPriority}
                options={WORKER_TASK_PRIORITIES.map((p) => ({
                  value: p,
                  label: formatTaskPriorityLabel(p),
                  iconSource: MOBILE_APP_ICONS.pin,
                }))}
                title="Task Priority"
                onChange={setTPriority}
              />
              <Text style={[styles.fieldLabel, { fontSize: ui.font(12) }]}>Status</Text>
              <ModernDropdown
                value={tStatus}
                options={WORKER_TASK_STATUSES.map((s) => ({
                  value: s,
                  label: formatTaskStatusLabel(s),
                  iconSource: MOBILE_APP_ICONS.checkmark,
                }))}
                title="Task Status"
                onChange={setTStatus}
              />
              <Text style={[styles.fieldLabel, { fontSize: ui.font(12) }]}>Due Date</Text>
              <ModernDatePicker allowClear value={tDueDate} onChange={setTDueDate} />
              <Text style={[styles.fieldLabel, { fontSize: ui.font(12) }]}>
                Related Animal (Optional)
              </Text>
              <ModernDropdown
                searchable
                value={tLivestockId}
                options={livestockOptions}
                title="Related Animal"
                onChange={setTLivestockId}
              />
              <Text style={[styles.fieldLabel, { fontSize: ui.font(12) }]}>Notes</Text>
              <TextInput
                style={[styles.input, { minHeight: 72, textAlignVertical: 'top', fontSize: ui.font(14) }]}
                multiline
                value={tDescription}
                onChangeText={setTDescription}
                placeholder="Optional instructions..."
              />
              {tError ? <Text style={styles.errorText}>{tError}</Text> : null}
              <Pressable
                style={[styles.submitBtn, { minHeight: ui.controlHeight }]}
                onPress={() => void handleSaveTask()}
              >
                <Text style={[styles.submitBtnText, { fontSize: ui.font(14) }]}>
                  Save Task
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
    width: 42,
    height: 42,
    borderRadius: 11,
    backgroundColor: FARMDB_COLORS.accentSoft,
    borderWidth: 1,
    borderColor: '#cce3d6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontFamily: FARMDB_FONTS.extrabold, color: FARMDB_COLORS.darkHeader },
  heroSub: { fontFamily: FARMDB_FONTS.regular, color: FARMDB_COLORS.textMuted },
  leadPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    borderRadius: 999,
    backgroundColor: FARMDB_COLORS.warnBg,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.warnBorder,
  },
  leadPillText: { fontFamily: FARMDB_FONTS.bold, color: FARMDB_COLORS.warnText },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  kpiBox: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: FARMDB_COLORS.cardAlt,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.surfaceMuted,
    borderRadius: 9,
    padding: 8,
  },
  kpiLabel: { fontFamily: FARMDB_FONTS.medium, color: FARMDB_COLORS.textMuted },
  kpiValue: { fontFamily: FARMDB_FONTS.bold, color: FARMDB_COLORS.darkHeader, marginTop: 2 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap' },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: FARMDB_COLORS.accent,
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  primaryBtnText: { fontFamily: FARMDB_FONTS.bold, color: '#ffffff' },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: FARMDB_COLORS.cardAlt,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  secondaryBtnText: { fontFamily: FARMDB_FONTS.bold, color: FARMDB_COLORS.text },
  disabledBtn: { opacity: 0.5 },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: FARMDB_COLORS.accentSoft,
    borderWidth: 1,
    borderColor: '#b7dfc6',
  },
  noticeText: { flex: 1, fontFamily: FARMDB_FONTS.semibold, color: FARMDB_COLORS.accentHover },
  alertPanel: {
    backgroundColor: FARMDB_COLORS.warnBg,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.warnBorder,
  },
  alertHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  alertHeadTitle: { fontFamily: FARMDB_FONTS.extrabold, color: FARMDB_COLORS.warnText },
  alertRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: FARMDB_COLORS.surface,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    borderRadius: 9,
    padding: 9,
  },
  alertWorkerName: { fontFamily: FARMDB_FONTS.bold, color: FARMDB_COLORS.text },
  alertMeta: { fontFamily: FARMDB_FONTS.regular, color: FARMDB_COLORS.textMuted },
  payQuickBtn: {
    backgroundColor: FARMDB_COLORS.accent,
    borderRadius: 8,
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payQuickBtnText: { fontFamily: FARMDB_FONTS.bold, color: '#ffffff' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: FARMDB_COLORS.surface,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, fontFamily: FARMDB_FONTS.regular, color: FARMDB_COLORS.text },
  workerHeadRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  avatarBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: FARMDB_COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workerName: { fontFamily: FARMDB_FONTS.bold, color: FARMDB_COLORS.darkHeader },
  workerRole: { fontFamily: FARMDB_FONTS.regular, color: FARMDB_COLORS.textMuted },
  statusPill: {
    backgroundColor: FARMDB_COLORS.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusPillText: { fontFamily: FARMDB_FONTS.bold, color: FARMDB_COLORS.accentHover },
  respBox: {
    backgroundColor: FARMDB_COLORS.cardAlt,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.surfaceMuted,
    borderRadius: 8,
    padding: 8,
  },
  respText: { fontFamily: FARMDB_FONTS.regular, color: FARMDB_COLORS.text },
  workerMetricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricBold: { fontFamily: FARMDB_FONTS.bold, color: FARMDB_COLORS.text, marginTop: 1 },
  paymentAmountText: { fontFamily: FARMDB_FONTS.monoBold, color: FARMDB_COLORS.darkHeader },
  cardActionsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 4 },
  chipActionBtn: {
    backgroundColor: FARMDB_COLORS.cardAlt,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActionText: { fontFamily: FARMDB_FONTS.semibold, color: FARMDB_COLORS.text },
  dangerChipBtn: {
    backgroundColor: FARMDB_COLORS.dangerSoft,
    borderRadius: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerChipText: { fontFamily: FARMDB_FONTS.bold, color: FARMDB_COLORS.danger },
  emptyCard: {
    backgroundColor: FARMDB_COLORS.surface,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: { fontFamily: FARMDB_FONTS.bold, color: FARMDB_COLORS.darkHeader },
  emptySub: { fontFamily: FARMDB_FONTS.regular, color: FARMDB_COLORS.textMuted, textAlign: 'center' },
  modalSafe: { flex: 1, backgroundColor: FARMDB_COLORS.bg },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 13,
    backgroundColor: FARMDB_COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: FARMDB_COLORS.border,
  },
  modalTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: FARMDB_FONTS.bold,
    color: FARMDB_COLORS.darkHeader,
  },
  fieldLabel: { fontFamily: FARMDB_FONTS.semibold, color: FARMDB_COLORS.text, marginTop: 4 },
  input: {
    backgroundColor: FARMDB_COLORS.surface,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: FARMDB_FONTS.regular,
    color: FARMDB_COLORS.text,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  errorText: { fontFamily: FARMDB_FONTS.medium, color: FARMDB_COLORS.danger, fontSize: 12 },
  submitBtn: {
    marginTop: 12,
    backgroundColor: FARMDB_COLORS.accent,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: { fontFamily: FARMDB_FONTS.bold, color: '#ffffff' },
});
