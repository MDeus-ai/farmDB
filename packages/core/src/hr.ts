import { addDaysIso, formatCurrency, getTodayIsoDate, roundAmount } from './analytics';
import type {
  FarmWorker,
  WorkerPayFrequency,
  WorkerPayment,
  WorkerPaymentStatus,
  WorkerStatus,
  WorkerTask,
  WorkerTaskPriority,
  WorkerTaskStatus,
} from './types';

export type PaymentDueUrgency =
  | 'paid'
  | 'overdue'
  | 'due_today'
  | 'almost_due'
  | 'upcoming';

export interface HrDuePaymentAlertItem {
  kind: 'scheduled_salary' | 'pending_payment';
  key: string;
  worker: FarmWorker;
  payment: WorkerPayment | null;
  amount: number;
  dueDate: string;
  daysUntilDue: number;
  urgency: Exclude<PaymentDueUrgency, 'paid'>;
}

export interface HrSummary {
  totalWorkers: number;
  activeWorkers: number;
  onLeaveWorkers: number;
  estimatedMonthlyPayroll: number;
  pendingPaymentsCount: number;
  pendingPaymentsAmount: number;
  dueSoonOrOverdueCount: number;
  dueSoonOrOverdueAmount: number;
  paidThisMonthAmount: number;
  totalPaidAmount: number;
  openTasksCount: number;
  highPriorityTasksCount: number;
  completedTasksCount: number;
  duePaymentAlerts: HrDuePaymentAlertItem[];
}

export function daysUntilDate(
  targetIso: string,
  todayIso: string = getTodayIsoDate()
): number {
  const [ty, tm, td] = targetIso.split('-').map(Number);
  const [cy, cm, cd] = todayIso.split('-').map(Number);
  const targetMs = Date.UTC(ty!, tm! - 1, td!);
  const todayMs = Date.UTC(cy!, cm! - 1, cd!);
  return Math.round((targetMs - todayMs) / (24 * 60 * 60 * 1000));
}

export function getPaymentDueUrgency(
  dueDateIso: string,
  todayIso: string = getTodayIsoDate(),
  leadDays = 3
): Exclude<PaymentDueUrgency, 'paid'> {
  const safeLead = Math.max(0, Math.min(30, Math.floor(leadDays)));
  if (dueDateIso < todayIso) {
    return 'overdue';
  }
  if (dueDateIso === todayIso) {
    return 'due_today';
  }
  const threshold = addDaysIso(todayIso, safeLead);
  if (dueDateIso <= threshold) {
    return 'almost_due';
  }
  return 'upcoming';
}

export function advancePayDueDate(
  currentDueDateIso: string,
  frequency: WorkerPayFrequency
): string {
  switch (frequency) {
    case 'daily':
      return addDaysIso(currentDueDateIso, 1);
    case 'weekly':
      return addDaysIso(currentDueDateIso, 7);
    case 'biweekly':
      return addDaysIso(currentDueDateIso, 14);
    case 'monthly': {
      const [yStr, mStr, dStr] = currentDueDateIso.split('-');
      const year = Number(yStr);
      const monthIndex = Number(mStr) - 1;
      const day = Number(dStr);
      const targetMonthDate = new Date(Date.UTC(year, monthIndex + 1, 1));
      const daysInTargetMonth = new Date(
        Date.UTC(
          targetMonthDate.getUTCFullYear(),
          targetMonthDate.getUTCMonth() + 1,
          0
        )
      ).getUTCDate();
      const clampedDay = Math.min(day, daysInTargetMonth);
      return new Date(
        Date.UTC(
          targetMonthDate.getUTCFullYear(),
          targetMonthDate.getUTCMonth(),
          clampedDay
        )
      )
        .toISOString()
        .slice(0, 10);
    }
  }
}

export function estimateMonthlySalary(
  salaryAmount: number,
  frequency: WorkerPayFrequency
): number {
  switch (frequency) {
    case 'monthly':
      return roundAmount(salaryAmount);
    case 'biweekly':
      return roundAmount((salaryAmount * 26) / 12);
    case 'weekly':
      return roundAmount((salaryAmount * 52) / 12);
    case 'daily':
      return roundAmount(salaryAmount * 30);
  }
}

export function computeHrSummary(
  workers: readonly FarmWorker[],
  payments: readonly WorkerPayment[],
  tasks: readonly WorkerTask[],
  todayIso: string = getTodayIsoDate(),
  leadDays = 3
): HrSummary {
  const workersById = new Map(workers.map((w) => [w.id, w]));

  let activeWorkers = 0;
  let onLeaveWorkers = 0;
  let estimatedMonthlyPayroll = 0;

  for (const w of workers) {
    if (w.status === 'active') {
      activeWorkers += 1;
      estimatedMonthlyPayroll += estimateMonthlySalary(w.salaryAmount, w.payFrequency);
    } else if (w.status === 'on_leave') {
      onLeaveWorkers += 1;
    }
  }

  let pendingPaymentsCount = 0;
  let pendingPaymentsAmount = 0;
  let paidThisMonthAmount = 0;
  let totalPaidAmount = 0;
  const currentMonthPrefix = todayIso.slice(0, 7);

  const duePaymentAlerts: HrDuePaymentAlertItem[] = [];
  const workersCoveredByPendingPayment = new Set<string>();

  for (const payment of payments) {
    if (payment.status === 'paid') {
      totalPaidAmount += payment.amount;
      const effectiveDate = payment.paidDate ?? payment.dueDate;
      if (effectiveDate.startsWith(currentMonthPrefix)) {
        paidThisMonthAmount += payment.amount;
      }
      continue;
    }

    pendingPaymentsCount += 1;
    pendingPaymentsAmount += payment.amount;

    const worker = workersById.get(payment.workerId);
    if (!worker) continue;

    const urgency = getPaymentDueUrgency(payment.dueDate, todayIso, leadDays);
    if (urgency !== 'upcoming') {
      workersCoveredByPendingPayment.add(`${worker.id}::${payment.dueDate}`);
      duePaymentAlerts.push({
        kind: 'pending_payment',
        key: `payment:${payment.id}`,
        worker,
        payment,
        amount: payment.amount,
        dueDate: payment.dueDate,
        daysUntilDue: daysUntilDate(payment.dueDate, todayIso),
        urgency,
      });
    }
  }

  for (const worker of workers) {
    if (worker.status !== 'active' || worker.salaryAmount <= 0) {
      continue;
    }
    const dedupKey = `${worker.id}::${worker.nextPaymentDueDate}`;
    if (workersCoveredByPendingPayment.has(dedupKey)) {
      continue;
    }
    const urgency = getPaymentDueUrgency(
      worker.nextPaymentDueDate,
      todayIso,
      leadDays
    );
    if (urgency !== 'upcoming') {
      duePaymentAlerts.push({
        kind: 'scheduled_salary',
        key: `worker:${worker.id}:${worker.nextPaymentDueDate}`,
        worker,
        payment: null,
        amount: worker.salaryAmount,
        dueDate: worker.nextPaymentDueDate,
        daysUntilDue: daysUntilDate(worker.nextPaymentDueDate, todayIso),
        urgency,
      });
    }
  }

  duePaymentAlerts.sort(
    (a, b) =>
      a.dueDate.localeCompare(b.dueDate) ||
      a.worker.name.localeCompare(b.worker.name)
  );

  let dueSoonOrOverdueAmount = 0;
  for (const item of duePaymentAlerts) {
    dueSoonOrOverdueAmount += item.amount;
  }

  let openTasksCount = 0;
  let highPriorityTasksCount = 0;
  let completedTasksCount = 0;
  for (const task of tasks) {
    if (task.status === 'completed') {
      completedTasksCount += 1;
    } else {
      openTasksCount += 1;
      if (task.priority === 'high') {
        highPriorityTasksCount += 1;
      }
    }
  }

  return {
    totalWorkers: workers.length,
    activeWorkers,
    onLeaveWorkers,
    estimatedMonthlyPayroll: roundAmount(estimatedMonthlyPayroll),
    pendingPaymentsCount,
    pendingPaymentsAmount: roundAmount(pendingPaymentsAmount),
    dueSoonOrOverdueCount: duePaymentAlerts.length,
    dueSoonOrOverdueAmount: roundAmount(dueSoonOrOverdueAmount),
    paidThisMonthAmount: roundAmount(paidThisMonthAmount),
    totalPaidAmount: roundAmount(totalPaidAmount),
    openTasksCount,
    highPriorityTasksCount,
    completedTasksCount,
    duePaymentAlerts,
  };
}

export function formatPaymentAlertNotification(
  item: HrDuePaymentAlertItem,
  currencySymbol = '$'
): { title: string; body: string } {
  const formattedAmt = formatCurrency(item.amount, currencySymbol);
  const whenText =
    item.daysUntilDue < 0
      ? `overdue by ${Math.abs(item.daysUntilDue)}d`
      : item.daysUntilDue === 0
        ? 'due today'
        : `due in ${item.daysUntilDue}d (${item.dueDate})`;

  return {
    title: `farmDB Payroll · ${item.worker.name}`,
    body: `${formattedAmt} (${item.worker.role}) is ${whenText}.`,
  };
}

export function formatPayFrequencyLabel(freq: WorkerPayFrequency): string {
  switch (freq) {
    case 'monthly':
      return 'Monthly';
    case 'biweekly':
      return 'Biweekly';
    case 'weekly':
      return 'Weekly';
    case 'daily':
      return 'Daily';
  }
}

export function formatWorkerStatusLabel(status: WorkerStatus): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'on_leave':
      return 'On Leave';
    case 'inactive':
      return 'Inactive';
  }
}

export function formatPaymentStatusLabel(status: WorkerPaymentStatus): string {
  return status === 'paid' ? 'Paid' : 'Pending';
}

export function formatTaskPriorityLabel(priority: WorkerTaskPriority): string {
  switch (priority) {
    case 'low':
      return 'Low';
    case 'medium':
      return 'Medium';
    case 'high':
      return 'High';
  }
}

export function formatTaskStatusLabel(status: WorkerTaskStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'in_progress':
      return 'In Progress';
    case 'completed':
      return 'Completed';
  }
}
