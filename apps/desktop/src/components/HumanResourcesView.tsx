import { useMemo, useState } from 'react';
import {
  advancePayDueDate,
  computeHrSummary,
  daysUntilDate,
  DEFAULT_FARM_SETTINGS,
  describeModuleAccessLevel,
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
  WORKER_PAY_FREQUENCY_HINTS,
  WORKER_PAYMENT_STATUSES,
  WORKER_STATUS_HINTS,
  WORKER_STATUSES,
  WORKER_TASK_PRIORITIES,
  WORKER_TASK_PRIORITY_HINTS,
  WORKER_TASK_STATUS_HINTS,
  WORKER_TASK_STATUSES,
  type FarmWorker,
  type Livestock,
  type WorkerPayFrequency,
  type WorkerPayment,
  type WorkerPaymentStatus,
  type WorkerStatus,
  type WorkerTask,
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
  useFarmSettings,
  useLivestockList,
  useMarkWorkerPaymentPaid,
  useModulePermissions,
  useUpdateWorker,
  useUpdateWorkerPayment,
  useUpdateWorkerTask,
  useWorkerList,
  useWorkerPaymentList,
  useWorkerTaskList,
} from '@farmdb/db';
import { APP_ICONS } from '../assets/icons';
import { buildAnimalSelectOption } from '../utils/animalOptions';
import { AnimalEyeButton } from './AnimalQuickPreviewModal';
import { FileTabs } from './FileTabs';
import { ModernDatePicker } from './ModernDatePicker';
import { ModernSelect, type ModernSelectOption } from './ModernSelect';
import { NumberStepper } from './NumberStepper';

type HrTab = 'staff' | 'payments' | 'tasks';

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
  if (daysUntil < 0) return `Overdue by ${Math.abs(daysUntil)}d`;
  if (daysUntil === 0) return 'Due Today';
  if (daysUntil === 1) return 'Due Tomorrow';
  return `In ${daysUntil} days`;
}

export function HumanResourcesView({ onOpenSettings }: HumanResourcesViewProps) {
  const settingsQuery = useFarmSettings();
  const settings = settingsQuery.data ?? DEFAULT_FARM_SETTINGS;
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

  const [tab, setTab] = useState<HrTab>('staff');
  const [staffSearch, setStaffSearch] = useState('');
  const [staffStatusFilter, setStaffStatusFilter] = useState<WorkerStatus | 'all'>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<WorkerPaymentStatus | 'all'>('all');
  const [paymentWorkerFilter, setPaymentWorkerFilter] = useState<string>('all');
  const [taskWorkerFilter, setTaskWorkerFilter] = useState<string>('all');
  const [taskStatusFilter, setTaskStatusFilter] = useState<WorkerTaskStatus | 'all'>('all');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<WorkerTaskPriority | 'all'>('all');

  const [confirmDeleteWorkerId, setConfirmDeleteWorkerId] = useState<string | null>(null);
  const [confirmDeletePaymentId, setConfirmDeletePaymentId] = useState<string | null>(null);
  const [confirmDeleteTaskId, setConfirmDeleteTaskId] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Worker Modal State
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

  // Payment Modal State
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

  // Task Modal State
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

  const filteredWorkers = useMemo(() => {
    const q = staffSearch.trim().toLowerCase();
    return allWorkers.filter((w) => {
      if (staffStatusFilter !== 'all' && w.status !== staffStatusFilter) {
        return false;
      }
      if (q) {
        const hay = `${w.name} ${w.role} ${w.responsibilities ?? ''} ${w.phone ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allWorkers, staffSearch, staffStatusFilter]);

  const filteredPayments = useMemo(() => {
    return allPayments.filter((p) => {
      if (paymentStatusFilter !== 'all' && p.status !== paymentStatusFilter) {
        return false;
      }
      if (paymentWorkerFilter !== 'all' && p.workerId !== paymentWorkerFilter) {
        return false;
      }
      return true;
    });
  }, [allPayments, paymentStatusFilter, paymentWorkerFilter]);

  const filteredTasks = useMemo(() => {
    return allTasks.filter((t) => {
      if (taskWorkerFilter !== 'all' && t.workerId !== taskWorkerFilter) {
        return false;
      }
      if (taskStatusFilter !== 'all' && t.status !== taskStatusFilter) {
        return false;
      }
      if (taskPriorityFilter !== 'all' && t.priority !== taskPriorityFilter) {
        return false;
      }
      return true;
    });
  }, [allTasks, taskWorkerFilter, taskStatusFilter, taskPriorityFilter]);

  const openTasksByWorkerId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of allTasks) {
      if (task.status !== 'completed') {
        counts.set(task.workerId, (counts.get(task.workerId) ?? 0) + 1);
      }
    }
    return counts;
  }, [allTasks]);

  const workerSelectOptions = useMemo<ModernSelectOption<string>[]>(
    () =>
      allWorkers.map((w) => ({
        value: w.id,
        label: w.name,
        hint: `${w.role} · ${formatCurrency(w.salaryAmount, currency)}/${formatPayFrequencyLabel(w.payFrequency)}`,
        iconSrc: APP_ICONS.farmer,
      })),
    [allWorkers, currency]
  );

  const workerFilterOptions = useMemo<ModernSelectOption<string>[]>(
    () => [
      { value: 'all', label: 'All Workers', iconSrc: APP_ICONS.staff },
      ...workerSelectOptions,
    ],
    [workerSelectOptions]
  );

  const livestockSelectOptions = useMemo<ModernSelectOption<string>[]>(
    () => [
      { value: '', label: 'General Farm / No Specific Animal', iconSrc: APP_ICONS.barn },
      ...activeLivestock.map((animal: Livestock) =>
        buildAnimalSelectOption(animal, {
          label: `${animal.tagNumber}${animal.name ? ` · ${animal.name}` : ''}`,
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

  function openPayModal(worker?: FarmWorker, existingPayment?: WorkerPayment) {
    setEditingPayment(existingPayment ?? null);
    if (existingPayment) {
      const w = workersById.get(existingPayment.workerId);
      setPWorkerId(existingPayment.workerId);
      setPAmount(String(existingPayment.amount));
      setPDueDate(existingPayment.dueDate);
      setPStatus(existingPayment.status);
      setPPaidDate(existingPayment.paidDate ?? todayIso);
      setPPeriodLabel(existingPayment.periodLabel ?? '');
      setPNotes(existingPayment.notes ?? '');
      setPAdvanceSchedule(Boolean(w && existingPayment.dueDate >= w.nextPaymentDueDate));
    } else {
      const targetWorker = worker ?? allWorkers[0];
      setPWorkerId(targetWorker?.id ?? '');
      setPAmount(targetWorker ? String(targetWorker.salaryAmount) : '0');
      setPDueDate(targetWorker?.nextPaymentDueDate ?? todayIso);
      setPStatus('paid');
      setPPaidDate(todayIso);
      setPPeriodLabel(
        targetWorker
          ? `${formatPayFrequencyLabel(targetWorker.payFrequency)} Payroll (${todayIso.slice(0, 7)})`
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

  async function handleSaveWorker(e: React.FormEvent) {
    e.preventDefault();
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
        setStatusNotice(`Updated worker profile for ${wName}.`);
      } else {
        await createWorkerMut.mutateAsync(payload);
        setStatusNotice(`Added ${wName} to Human Resources.`);
      }
      setWorkerModalOpen(false);
    } catch (err) {
      setWError(err instanceof Error ? err.message : 'Unable to save worker.');
    }
  }

  async function handleSavePayment(e: React.FormEvent) {
    e.preventDefault();
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
        setStatusNotice('Updated worker payment record.');
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
        setStatusNotice(
          res.generatedExpenseLog
            ? 'Salary payment recorded and added as a Payroll Expense in Financial Ledger.'
            : 'Worker payment recorded in SQLite.'
        );
      }
      setPayModalOpen(false);
    } catch (err) {
      setPError(err instanceof Error ? err.message : 'Unable to save payment.');
    }
  }

  async function handleMarkPaidQuick(
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
    setStatusNotice(
      res.generatedExpenseLog
        ? `Marked ${worker?.name ?? 'worker'} payment paid and logged Payroll Expense.`
        : `Marked payment paid.`
    );
  }

  async function handleSaveTask(e: React.FormEvent) {
    e.preventDefault();
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
        setStatusNotice(`Updated task "${tTitle}".`);
      } else {
        await createTaskMut.mutateAsync(payload);
        setStatusNotice(`Assigned task "${tTitle}".`);
      }
      setTaskModalOpen(false);
    } catch (err) {
      setTError(err instanceof Error ? err.message : 'Unable to save task.');
    }
  }

  async function handleDeleteWorker(w: FarmWorker) {
    if (!canDelete) return;
    if (settings.confirmBeforeDelete && confirmDeleteWorkerId !== w.id) {
      setConfirmDeleteWorkerId(w.id);
      return;
    }
    setConfirmDeleteWorkerId(null);
    await deleteWorkerMut.mutateAsync(w.id);
    setStatusNotice(`Removed worker ${w.name}.`);
  }

  async function handleDeletePayment(p: WorkerPayment) {
    if (!canDelete) return;
    if (settings.confirmBeforeDelete && confirmDeletePaymentId !== p.id) {
      setConfirmDeletePaymentId(p.id);
      return;
    }
    setConfirmDeletePaymentId(null);
    await deletePaymentMut.mutateAsync(p.id);
  }

  async function handleDeleteTask(t: WorkerTask) {
    if (!canDelete) return;
    if (settings.confirmBeforeDelete && confirmDeleteTaskId !== t.id) {
      setConfirmDeleteTaskId(t.id);
      return;
    }
    setConfirmDeleteTaskId(null);
    await deleteTaskMut.mutateAsync(t.id);
  }

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="family-hero-icon">
            <img src={APP_ICONS.staff} alt="" className="app-icon-lg" />
          </div>
          <div>
            <h1 className="page-title">Human Resources</h1>
          </div>
        </div>

        <div className="row-actions">
          {(!canEdit || !canDelete) && (
            <span className="status-pill status-sold">
              {describeModuleAccessLevel(accessLevel)}
            </span>
          )}
          {canEdit && (
            <>
              <button
                type="button"
                className="btn btn-primary"
                onClick={openAddWorker}
              >
                <img src={APP_ICONS.plus} alt="" className="app-icon-sm" />
                Add Worker
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={allWorkers.length === 0}
                onClick={() => openPayModal()}
              >
                <img src={APP_ICONS.money} alt="" className="app-icon-sm" />
                Pay / Log Salary
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={allWorkers.length === 0}
                onClick={() => openTaskModal()}
              >
                <img src={APP_ICONS.copyWriting} alt="" className="app-icon-sm" />
                Assign Task
              </button>
            </>
          )}
        </div>
      </div>

      {statusNotice && (
        <div className="alert-toast-banner" role="status">
          <span>{statusNotice}</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setStatusNotice(null)}
          >
            <img src={APP_ICONS.letterX} alt="" className="app-icon-sm" />
            Dismiss
          </button>
        </div>
      )}

      {/* Payment Due & Almost-Due Notification Panel */}
      {summary.duePaymentAlerts.length > 0 && (
        <div className="hr-alert-panel" role="region" aria-label="Payment due alerts">
          <div className="hr-alert-panel-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <img src={APP_ICONS.notification} alt="" className="app-icon-md" />
              <div>
                <strong>
                  {summary.dueSoonOrOverdueCount} Worker Payment Alert
                  {summary.dueSoonOrOverdueCount === 1 ? '' : 's'} (
                  {formatCurrency(summary.dueSoonOrOverdueAmount, currency)})
                </strong>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Alerting on payments due or within{' '}
                  <strong>{leadDays} {leadDays === 1 ? 'day' : 'days'}</strong> of due date
                </div>
              </div>
            </div>
            {onOpenSettings && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onOpenSettings}
              >
                <img src={APP_ICONS.settings} alt="" className="app-icon-sm" />
                Lead Alert: {leadDays}d
              </button>
            )}
          </div>

          <div className="hr-alert-items">
            {summary.duePaymentAlerts.map((item) => (
              <div key={item.key} className={`hr-alert-row urgency-${item.urgency}`}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong>{item.worker.name}</strong>
                    <span className="tag-chip">{item.worker.role}</span>
                    <span className={`hr-urgency-pill urgency-${item.urgency}`}>
                      {getUrgencyLabel(item.daysUntilDue)}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 3 }}>
                    {formatCurrency(item.amount, currency)} · Due{' '}
                    {formatDisplayDate(item.dueDate, settings.dateFormat)}
                    {item.payment?.periodLabel ? ` · ${item.payment.periodLabel}` : ''}
                  </div>
                </div>

                {canEdit && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      if (item.payment) {
                        void handleMarkPaidQuick(item.payment, item.worker);
                      } else {
                        openPayModal(item.worker);
                      }
                    }}
                  >
                    <img src={APP_ICONS.money} alt="" className="app-icon-sm" />
                    {item.payment ? 'Mark Paid' : 'Pay Now'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Metrics */}
      <div className="stats-grid">
        <div className="stat-card">
          <p className="stat-label">Active Staff / Monthly Est.</p>
          <p className="stat-value">
            {summary.activeWorkers} / {formatCurrency(summary.estimatedMonthlyPayroll, currency)}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Due / Almost-Due Payroll</p>
          <p className="stat-value" style={{ color: summary.dueSoonOrOverdueCount > 0 ? 'var(--danger)' : undefined }}>
            {summary.dueSoonOrOverdueCount} ({formatCurrency(summary.dueSoonOrOverdueAmount, currency)})
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Pending Payments ({summary.pendingPaymentsCount})</p>
          <p className="stat-value">
            {formatCurrency(summary.pendingPaymentsAmount, currency)}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Paid This Month / Open Tasks</p>
          <p className="stat-value">
            {formatCurrency(summary.paidThisMonthAmount, currency)} · {summary.openTasksCount} tasks
          </p>
        </div>
      </div>

      <div className="card">
        <FileTabs
          ariaLabel="HR section tabs"
          surface="card"
          activeId={tab}
          onChange={setTab}
          tabs={[
            {
              id: 'staff',
              label: `Staff & Responsibilities (${allWorkers.length})`,
              iconSrc: APP_ICONS.staff,
            },
            {
              id: 'payments',
              label: `Salaries & Payments (${allPayments.length})`,
              iconSrc: APP_ICONS.money,
            },
            {
              id: 'tasks',
              label: `Allocated Tasks (${summary.openTasksCount} open)`,
              iconSrc: APP_ICONS.copyWriting,
            },
          ]}
          trailing={
            onOpenSettings ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onOpenSettings}
              >
                <img src={APP_ICONS.notification} alt="" className="app-icon-sm" />
                Payment Alert: {leadDays}d early
              </button>
            ) : undefined
          }
        />

        {allWorkers.length === 0 ? (
          <div className="empty-state">
            <img src={APP_ICONS.farmer} alt="" style={{ width: 50, height: 50, marginBottom: 8 }} />
            <p style={{ margin: 0, fontWeight: 700, fontSize: '1.04rem' }}>
              No farm workers added yet
            </p>
            {canEdit && (
              <div className="empty-actions">
                <button type="button" className="btn btn-primary" onClick={openAddWorker}>
                  <img src={APP_ICONS.plus} alt="" className="app-icon-sm" />
                  Add First Worker
                </button>
              </div>
            )}
          </div>
        ) : tab === 'staff' ? (
          <>
            <div className="toolbar">
              <div className="search-wrap">
                <input
                  className="input"
                  style={{ paddingLeft: 12 }}
                  placeholder="Search worker name, role, or responsibilities..."
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                />
              </div>
              <ModernSelect
                ariaLabel="Filter workers by status"
                value={staffStatusFilter}
                options={[
                  { value: 'all', label: 'All Statuses', iconSrc: APP_ICONS.staff },
                  ...WORKER_STATUSES.map((st) => ({
                    value: st,
                    label: formatWorkerStatusLabel(st),
                    iconSrc: APP_ICONS.farmer,
                  })),
                ]}
                onChange={setStaffStatusFilter}
              />
            </div>

            {filteredWorkers.length === 0 ? (
              <div className="empty-state">No workers match this filter.</div>
            ) : (
              <div className="hr-worker-grid">
                {filteredWorkers.map((worker) => {
                  const urgency = getPaymentDueUrgency(
                    worker.nextPaymentDueDate,
                    todayIso,
                    leadDays
                  );
                  const daysLeft = daysUntilDate(worker.nextPaymentDueDate, todayIso);
                  const openTaskCount = openTasksByWorkerId.get(worker.id) ?? 0;

                  return (
                    <div key={worker.id} className="hr-worker-card">
                      <div className="hr-worker-head">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <div className="hr-avatar">
                            <img src={APP_ICONS.farmer} alt="" className="app-icon-md" />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <strong style={{ display: 'block', fontSize: '1.02rem' }}>
                              {worker.name}
                            </strong>
                            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                              {worker.role}
                              {worker.phone ? ` · ${worker.phone}` : ''}
                            </span>
                          </div>
                        </div>

                        <span className={`status-pill status-${worker.status === 'active' ? 'active' : worker.status === 'on_leave' ? 'sold' : 'deceased'}`}>
                          {formatWorkerStatusLabel(worker.status)}
                        </span>
                      </div>

                      {worker.responsibilities && (
                        <div className="hr-resp-box">
                          <span className="hr-sub-label">Responsibilities</span>
                          <p style={{ margin: '3px 0 0', fontSize: '0.84rem' }}>
                            {worker.responsibilities}
                          </p>
                        </div>
                      )}

                      <div className="hr-worker-metrics">
                        <div>
                          <span className="hr-sub-label">Salary Rate</span>
                          <strong>
                            {formatCurrency(worker.salaryAmount, currency)} /{' '}
                            {formatPayFrequencyLabel(worker.payFrequency)}
                          </strong>
                        </div>
                        <div>
                          <span className="hr-sub-label">Next Payday</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <strong>
                              {formatDisplayDate(worker.nextPaymentDueDate, settings.dateFormat)}
                            </strong>
                            {worker.status === 'active' && (
                              <span className={`hr-urgency-pill urgency-${urgency}`}>
                                {getUrgencyLabel(daysLeft)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          <span className="hr-sub-label">Allocated Tasks</span>
                          <strong>{openTaskCount} open</strong>
                        </div>
                      </div>

                      {(canEdit || canDelete) && (
                        <div className="hr-worker-actions">
                          {canEdit && (
                            <>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => openPayModal(worker)}
                              >
                                <img src={APP_ICONS.money} alt="" className="app-icon-sm" />
                                Pay Salary
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => openTaskModal(worker)}
                              >
                                <img src={APP_ICONS.plus} alt="" className="app-icon-sm" />
                                Task
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => openEditWorker(worker)}
                              >
                                <img src={APP_ICONS.pencil} alt="" className="app-icon-sm" />
                              </button>
                            </>
                          )}
                          {canDelete &&
                            (confirmDeleteWorkerId === worker.id ? (
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => void handleDeleteWorker(worker)}
                              >
                                Confirm
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => void handleDeleteWorker(worker)}
                              >
                                <img src={APP_ICONS.delete} alt="" className="app-icon-sm" />
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : tab === 'payments' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Upcoming Scheduled Paydays Strip */}
            <div>
              <h3 className="card-section-title" style={{ marginBottom: 8 }}>
                Upcoming Worker Paydays
              </h3>
              <div className="hr-schedule-strip">
                {allWorkers
                  .filter((w) => w.status === 'active')
                  .sort((a, b) =>
                    a.nextPaymentDueDate.localeCompare(b.nextPaymentDueDate)
                  )
                  .map((w) => {
                    const urgency = getPaymentDueUrgency(
                      w.nextPaymentDueDate,
                      todayIso,
                      leadDays
                    );
                    const daysLeft = daysUntilDate(w.nextPaymentDueDate, todayIso);
                    return (
                      <div key={w.id} className="hr-schedule-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <strong>{w.name}</strong>
                          <span className={`hr-urgency-pill urgency-${urgency}`}>
                            {getUrgencyLabel(daysLeft)}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {w.role} · Due{' '}
                          {formatDisplayDate(w.nextPaymentDueDate, settings.dateFormat)}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                          <strong>{formatCurrency(w.salaryAmount, currency)}</strong>
                          {canEdit && (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => openPayModal(w)}
                            >
                              Pay Now
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="toolbar" style={{ marginBottom: 0 }}>
              <ModernSelect
                ariaLabel="Filter payments by worker"
                value={paymentWorkerFilter}
                options={workerFilterOptions}
                onChange={setPaymentWorkerFilter}
              />
              <ModernSelect
                ariaLabel="Filter payments by status"
                value={paymentStatusFilter}
                options={[
                  { value: 'all', label: 'All Payment Statuses', iconSrc: APP_ICONS.money },
                  ...WORKER_PAYMENT_STATUSES.map((st) => ({
                    value: st,
                    label: formatPaymentStatusLabel(st),
                    iconSrc: st === 'paid' ? APP_ICONS.checkmark : APP_ICONS.hourglass,
                  })),
                ]}
                onChange={setPaymentStatusFilter}
              />
              {canEdit && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => openPayModal()}
                >
                  <img src={APP_ICONS.plus} alt="" className="app-icon-sm" />
                  Record Payment
                </button>
              )}
            </div>

            {filteredPayments.length === 0 ? (
              <div className="empty-state">No salary or wage payment records found.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Worker</th>
                      <th>Period / Notes</th>
                      <th>Due Date</th>
                      <th>Status</th>
                      <th>Amount</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.map((payment) => {
                      const worker = workersById.get(payment.workerId);
                      const urgency =
                        payment.status === 'paid'
                          ? 'paid'
                          : getPaymentDueUrgency(payment.dueDate, todayIso, leadDays);
                      const daysLeft = daysUntilDate(payment.dueDate, todayIso);

                      return (
                        <tr key={payment.id}>
                          <td>
                            <strong>{worker?.name ?? 'Removed Worker'}</strong>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              {worker?.role ?? '—'}
                            </div>
                          </td>
                          <td>
                            <div>{payment.periodLabel ?? 'Salary / Wage'}</div>
                            {payment.notes && (
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                {payment.notes}
                              </div>
                            )}
                          </td>
                          <td>
                            <div>
                              {formatDisplayDate(payment.dueDate, settings.dateFormat)}
                            </div>
                            {payment.status === 'pending' ? (
                              <span className={`hr-urgency-pill urgency-${urgency}`}>
                                {getUrgencyLabel(daysLeft)}
                              </span>
                            ) : payment.paidDate ? (
                              <div style={{ fontSize: '0.76rem', color: 'var(--success)' }}>
                                Paid {formatDisplayDate(payment.paidDate, settings.dateFormat)}
                              </div>
                            ) : null}
                          </td>
                          <td>
                            <span
                              className={`status-pill ${
                                payment.status === 'paid' ? 'status-active' : 'status-sold'
                              }`}
                            >
                              {formatPaymentStatusLabel(payment.status)}
                            </span>
                            {payment.financialLogId && (
                              <span className="auto-tag">Ledger</span>
                            )}
                          </td>
                          <td>
                            <strong>{formatCurrency(payment.amount, currency)}</strong>
                          </td>
                          <td>
                            <div className="row-actions">
                              {canEdit && (
                                <>
                                  {payment.status === 'pending' && (
                                    <button
                                      type="button"
                                      className="btn btn-primary btn-sm"
                                      onClick={() =>
                                        void handleMarkPaidQuick(payment, worker)
                                      }
                                    >
                                      <img
                                        src={APP_ICONS.checkmark}
                                        alt=""
                                        className="app-icon-sm"
                                      />
                                      Mark Paid
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => openPayModal(worker, payment)}
                                  >
                                    <img src={APP_ICONS.pencil} alt="" className="app-icon-sm" />
                                  </button>
                                </>
                              )}
                              {canDelete &&
                                (confirmDeletePaymentId === payment.id ? (
                                  <button
                                    type="button"
                                    className="btn btn-danger btn-sm"
                                    onClick={() => void handleDeletePayment(payment)}
                                  >
                                    Confirm
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn btn-danger btn-sm"
                                    onClick={() => void handleDeletePayment(payment)}
                                  >
                                    <img src={APP_ICONS.delete} alt="" className="app-icon-sm" />
                                  </button>
                                ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="toolbar" style={{ marginBottom: 0 }}>
              <ModernSelect
                ariaLabel="Filter tasks by worker"
                value={taskWorkerFilter}
                options={workerFilterOptions}
                onChange={setTaskWorkerFilter}
              />
              <ModernSelect
                ariaLabel="Filter tasks by status"
                value={taskStatusFilter}
                options={[
                  { value: 'all', label: 'All Task Statuses', iconSrc: APP_ICONS.copyWriting },
                  ...WORKER_TASK_STATUSES.map((st) => ({
                    value: st,
                    label: formatTaskStatusLabel(st),
                    iconSrc: st === 'completed' ? APP_ICONS.checkmark : APP_ICONS.hourglass,
                  })),
                ]}
                onChange={setTaskStatusFilter}
              />
              <ModernSelect
                ariaLabel="Filter tasks by priority"
                value={taskPriorityFilter}
                options={[
                  { value: 'all', label: 'All Priorities', iconSrc: APP_ICONS.pin },
                  ...WORKER_TASK_PRIORITIES.map((pr) => ({
                    value: pr,
                    label: `${formatTaskPriorityLabel(pr)} Priority`,
                    iconSrc: APP_ICONS.pin,
                  })),
                ]}
                onChange={setTaskPriorityFilter}
              />
            </div>

            {filteredTasks.length === 0 ? (
              <div className="empty-state">No allocated tasks match these filters.</div>
            ) : (
              <div className="hr-task-list">
                {filteredTasks.map((task) => {
                  const worker = workersById.get(task.workerId);
                  const animal = task.livestockId
                    ? animalsById.get(task.livestockId)
                    : null;

                  return (
                    <div
                      key={task.id}
                      className={`hr-task-card ${task.status === 'completed' ? 'is-done' : ''}`}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span className={`hr-priority-pill priority-${task.priority}`}>
                            {formatTaskPriorityLabel(task.priority)}
                          </span>
                          <span
                            className={`status-pill ${
                              task.status === 'completed'
                                ? 'status-active'
                                : task.status === 'in_progress'
                                  ? 'status-sold'
                                  : ''
                            }`}
                          >
                            {formatTaskStatusLabel(task.status)}
                          </span>
                          {animal && (
                            <>
                              <span className="tag-chip">{animal.tagNumber}</span>
                              <AnimalEyeButton livestockId={animal.id} />
                            </>
                          )}
                          <strong>{task.title}</strong>
                        </div>
                        {task.description && (
                          <p style={{ margin: '5px 0 0', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                            {task.description}
                          </p>
                        )}
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 6 }}>
                          Assigned to <strong>{worker?.name ?? 'Unknown'}</strong>
                          {task.dueDate
                            ? ` · Due ${formatDisplayDate(task.dueDate, settings.dateFormat)}`
                            : ''}
                        </div>
                      </div>

                      {(canEdit || canDelete) && (
                        <div className="row-actions">
                          {canEdit && (
                            <>
                              {task.status === 'pending' && (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() =>
                                    void updateTaskMut.mutateAsync({
                                      id: task.id,
                                      input: { status: 'in_progress' },
                                    })
                                  }
                                >
                                  Start
                                </button>
                              )}
                              {task.status !== 'completed' ? (
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  onClick={() =>
                                    void updateTaskMut.mutateAsync({
                                      id: task.id,
                                      input: { status: 'completed' },
                                    })
                                  }
                                >
                                  <img src={APP_ICONS.checkmark} alt="" className="app-icon-sm" />
                                  Done
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() =>
                                    void updateTaskMut.mutateAsync({
                                      id: task.id,
                                      input: { status: 'pending' },
                                    })
                                  }
                                >
                                  Reopen
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => openTaskModal(worker, task)}
                              >
                                <img src={APP_ICONS.pencil} alt="" className="app-icon-sm" />
                              </button>
                            </>
                          )}
                          {canDelete &&
                            (confirmDeleteTaskId === task.id ? (
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => void handleDeleteTask(task)}
                              >
                                Confirm
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => void handleDeleteTask(task)}
                              >
                                <img src={APP_ICONS.delete} alt="" className="app-icon-sm" />
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add / Edit Worker Modal */}
      {workerModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <div className="modal-header">
              <h2 className="modal-title">
                {editingWorker ? `Edit ${editingWorker.name}` : 'Add Farm Worker'}
              </h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setWorkerModalOpen(false)}
              >
                <img src={APP_ICONS.letterX} alt="" className="app-icon-sm" />
              </button>
            </div>

            <form onSubmit={handleSaveWorker}>
              <div className="form-grid">
                <div className="form-field">
                  <label className="form-label">Full Name *</label>
                  <input
                    className="input"
                    value={wName}
                    onChange={(e) => setWName(e.target.value)}
                    placeholder="e.g. Samuel Kiptoo"
                    autoFocus
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Role / Title *</label>
                  <input
                    className="input"
                    value={wRole}
                    onChange={(e) => setWRole(e.target.value)}
                    placeholder="e.g. Lead Herdsman"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Phone</label>
                  <input
                    className="input"
                    value={wPhone}
                    onChange={(e) => setWPhone(e.target.value)}
                    placeholder="Optional contact number"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Status</label>
                  <ModernSelect
                    fullWidth
                    showSelectedHint
                    value={wStatus}
                    options={WORKER_STATUSES.map((st) => ({
                      value: st,
                      label: formatWorkerStatusLabel(st),
                      iconSrc: APP_ICONS.farmer,
                      hint: WORKER_STATUS_HINTS[st],
                    }))}
                    onChange={setWStatus}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">
                    Salary Amount ({currency}) *
                  </label>
                  <NumberStepper
                    min={0}
                    step={currency === 'UGX' ? 5000 : 10}
                    decimals={currency === 'UGX' ? 0 : 2}
                    value={wSalary}
                    onChange={setWSalary}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Pay Frequency</label>
                  <ModernSelect
                    fullWidth
                    showSelectedHint
                    value={wFrequency}
                    options={WORKER_PAY_FREQUENCIES.map((freq) => ({
                      value: freq,
                      label: formatPayFrequencyLabel(freq),
                      iconSrc: APP_ICONS.calendar,
                      hint: WORKER_PAY_FREQUENCY_HINTS[freq],
                    }))}
                    onChange={setWFrequency}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Next Payment Due Date *</label>
                  <ModernDatePicker
                    value={wNextDue}
                    onChange={setWNextDue}
                    placeholder="Select payday"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Hire Date</label>
                  <ModernDatePicker
                    allowClear
                    value={wHireDate}
                    onChange={setWHireDate}
                    placeholder="Optional start date"
                  />
                </div>
                <div className="form-field full">
                  <label className="form-label">Responsibilities</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={wResponsibilities}
                    onChange={(e) => setWResponsibilities(e.target.value)}
                    placeholder="e.g. Morning milking, calf feeding, pasture rotation..."
                  />
                </div>
              </div>

              {wError && <p className="field-error" style={{ marginTop: 10 }}>{wError}</p>}

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setWorkerModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createWorkerMut.isPending || updateWorkerMut.isPending}
                >
                  Save Worker
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay / Schedule Payment Modal */}
      {payModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <div className="modal-header">
              <h2 className="modal-title">
                {editingPayment ? 'Edit Worker Payment' : 'Record / Pay Salary'}
              </h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setPayModalOpen(false)}
              >
                <img src={APP_ICONS.letterX} alt="" className="app-icon-sm" />
              </button>
            </div>

            <form onSubmit={handleSavePayment}>
              <div className="form-grid">
                <div className="form-field full">
                  <label className="form-label">Worker *</label>
                  <ModernSelect
                    searchable
                    fullWidth
                    value={pWorkerId}
                    options={workerSelectOptions}
                    onChange={(nextId) => {
                      setPWorkerId(nextId);
                      if (!editingPayment) {
                        const w = workersById.get(nextId);
                        if (w) {
                          setPAmount(String(w.salaryAmount));
                          setPDueDate(w.nextPaymentDueDate);
                          setPPeriodLabel(
                            `${formatPayFrequencyLabel(w.payFrequency)} Payroll (${todayIso.slice(0, 7)})`
                          );
                        }
                      }
                    }}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Amount ({currency}) *</label>
                  <NumberStepper
                    min={0.01}
                    step={currency === 'UGX' ? 5000 : 10}
                    decimals={currency === 'UGX' ? 0 : 2}
                    value={pAmount}
                    onChange={setPAmount}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Status</label>
                  <ModernSelect
                    fullWidth
                    showSelectedHint
                    value={pStatus}
                    options={WORKER_PAYMENT_STATUSES.map((st) => ({
                      value: st,
                      label: formatPaymentStatusLabel(st),
                      iconSrc: st === 'paid' ? APP_ICONS.checkmark : APP_ICONS.hourglass,
                      hint:
                        st === 'paid'
                          ? 'Marked settled and completed'
                          : 'Scheduled or awaiting salary payout',
                    }))}
                    onChange={setPStatus}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Due Date *</label>
                  <ModernDatePicker value={pDueDate} onChange={setPDueDate} />
                </div>
                {pStatus === 'paid' && (
                  <div className="form-field">
                    <label className="form-label">Paid Date</label>
                    <ModernDatePicker value={pPaidDate} onChange={setPPaidDate} />
                  </div>
                )}
                <div className="form-field full">
                  <label className="form-label">Period / Label</label>
                  <input
                    className="input"
                    value={pPeriodLabel}
                    onChange={(e) => setPPeriodLabel(e.target.value)}
                    placeholder="e.g. November 2026 Salary"
                  />
                </div>
                <div className="form-field full">
                  <label className="form-label">Notes</label>
                  <input
                    className="input"
                    value={pNotes}
                    onChange={(e) => setPNotes(e.target.value)}
                    placeholder="Payment method, bonus, or deductions..."
                  />
                </div>
              </div>

              {!editingPayment && pStatus === 'paid' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={pAutoExpense}
                      onChange={(e) => setPAutoExpense(e.target.checked)}
                    />
                    Auto-record as Payroll Expense in Financial Ledger
                  </label>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={pAdvanceSchedule}
                      onChange={(e) => setPAdvanceSchedule(e.target.checked)}
                    />
                    Advance worker&apos;s next scheduled payday ({(() => {
                      const w = workersById.get(pWorkerId);
                      return w ? advancePayDueDate(w.nextPaymentDueDate, w.payFrequency) : 'Next cycle';
                    })()})
                  </label>
                </div>
              )}

              {pError && <p className="field-error" style={{ marginTop: 10 }}>{pError}</p>}

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setPayModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createPaymentMut.isPending || updatePaymentMut.isPending}
                >
                  {pStatus === 'paid' ? 'Save Paid Salary' : 'Schedule Pending Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign / Edit Task Modal */}
      {taskModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <div className="modal-header">
              <h2 className="modal-title">
                {editingTask ? 'Edit Allocated Task' : 'Assign Farm Task'}
              </h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setTaskModalOpen(false)}
              >
                <img src={APP_ICONS.letterX} alt="" className="app-icon-sm" />
              </button>
            </div>

            <form onSubmit={handleSaveTask}>
              <div className="form-grid">
                <div className="form-field full">
                  <label className="form-label">Assign To Worker *</label>
                  <ModernSelect
                    searchable
                    fullWidth
                    value={tWorkerId}
                    options={workerSelectOptions}
                    onChange={setTWorkerId}
                  />
                </div>
                <div className="form-field full">
                  <label className="form-label">Task Title *</label>
                  <input
                    className="input"
                    value={tTitle}
                    onChange={(e) => setTTitle(e.target.value)}
                    placeholder="e.g. Sanitize milking parlor and log afternoon yields"
                    autoFocus
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Priority</label>
                  <ModernSelect
                    fullWidth
                    showSelectedHint
                    value={tPriority}
                    options={WORKER_TASK_PRIORITIES.map((pr) => ({
                      value: pr,
                      label: formatTaskPriorityLabel(pr),
                      iconSrc: APP_ICONS.pin,
                      hint: WORKER_TASK_PRIORITY_HINTS[pr],
                    }))}
                    onChange={setTPriority}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Status</label>
                  <ModernSelect
                    fullWidth
                    showSelectedHint
                    value={tStatus}
                    options={WORKER_TASK_STATUSES.map((st) => ({
                      value: st,
                      label: formatTaskStatusLabel(st),
                      iconSrc: APP_ICONS.checkmark,
                      hint: WORKER_TASK_STATUS_HINTS[st],
                    }))}
                    onChange={setTStatus}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Due Date</label>
                  <ModernDatePicker allowClear value={tDueDate} onChange={setTDueDate} />
                </div>
                <div className="form-field">
                  <label className="form-label">Related Animal (Optional)</label>
                  <ModernSelect
                    searchable
                    fullWidth
                    value={tLivestockId}
                    options={livestockSelectOptions}
                    onChange={setTLivestockId}
                  />
                </div>
                <div className="form-field full">
                  <label className="form-label">Instructions / Notes</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={tDescription}
                    onChange={(e) => setTDescription(e.target.value)}
                    placeholder="Specific instructions or equipment details..."
                  />
                </div>
              </div>

              {tError && <p className="field-error" style={{ marginTop: 10 }}>{tError}</p>}

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setTaskModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createTaskMut.isPending || updateTaskMut.isPending}
                >
                  Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
