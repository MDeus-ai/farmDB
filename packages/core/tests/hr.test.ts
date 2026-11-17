import { describe, expect, it } from 'vitest';
import {
  advancePayDueDate,
  buildAllCsvExports,
  computeHrSummary,
  DEFAULT_FARM_SETTINGS,
  estimateMonthlySalary,
  formatPaymentAlertNotification,
  getPaymentDueUrgency,
  parseFarmSnapshotJson,
  serializeFarmSnapshotJson,
  validateFarmSettings,
  validateNewFarmWorker,
  validateNewWorkerPayment,
  validateNewWorkerTask,
  type FarmDbSnapshot,
  type FarmWorker,
  type WorkerPayment,
  type WorkerTask,
} from '../src/index';

describe('@farmdb/core Human Resources', () => {
  it('validates workers, payments, tasks, and paymentAlertLeadDays settings', () => {
    const workerRes = validateNewFarmWorker(
      {
        name: '  Samuel Kiptoo ',
        role: '  Lead Herdsman ',
        phone: ' +256 700 112233 ',
        responsibilities: 'Morning milking, paddock rotation, calf feeding',
        salaryAmount: 350,
        payFrequency: 'monthly',
        nextPaymentDueDate: '2026-11-20',
      },
      { todayIso: '2026-11-17' }
    );
    expect(workerRes.ok).toBe(true);
    expect(workerRes.data?.name).toBe('Samuel Kiptoo');
    expect(workerRes.data?.role).toBe('Lead Herdsman');

    const badPay = validateNewWorkerPayment({
      workerId: '',
      amount: 0,
      dueDate: '2026-13-01',
    });
    expect(badPay.ok).toBe(false);
    expect(badPay.errors.workerId).toBeDefined();
    expect(badPay.errors.amount).toBeDefined();
    expect(badPay.errors.dueDate).toBeDefined();

    const taskRes = validateNewWorkerTask({
      workerId: 'w1',
      title: 'Check parlor pulsators',
      priority: 'high',
      dueDate: '2026-11-18',
    });
    expect(taskRes.ok).toBe(true);
    expect(taskRes.data?.status).toBe('pending');

    const badSetting = validateFarmSettings({ paymentAlertLeadDays: 45 });
    expect(badSetting.ok).toBe(false);
    expect(badSetting.errors.paymentAlertLeadDays).toBeDefined();

    const okSetting = validateFarmSettings({
      paymentAlertLeadDays: 5,
      autoRecordPayrollExpenseByDefault: false,
    });
    expect(okSetting.ok).toBe(true);
    expect(okSetting.data?.paymentAlertLeadDays).toBe(5);
    expect(okSetting.data?.autoRecordPayrollExpenseByDefault).toBe(false);
  });

  it('computes payment urgency, due-date advancement, and HR summary alerts', () => {
    expect(getPaymentDueUrgency('2026-11-15', '2026-11-17', 3)).toBe('overdue');
    expect(getPaymentDueUrgency('2026-11-17', '2026-11-17', 3)).toBe('due_today');
    expect(getPaymentDueUrgency('2026-11-20', '2026-11-17', 3)).toBe('almost_due');
    expect(getPaymentDueUrgency('2026-11-22', '2026-11-17', 3)).toBe('upcoming');
    expect(getPaymentDueUrgency('2026-11-22', '2026-11-17', 7)).toBe('almost_due');

    expect(advancePayDueDate('2026-01-31', 'monthly')).toBe('2026-02-28');
    expect(advancePayDueDate('2026-11-17', 'weekly')).toBe('2026-11-24');
    expect(advancePayDueDate('2026-11-17', 'biweekly')).toBe('2026-12-01');
    expect(advancePayDueDate('2026-11-17', 'daily')).toBe('2026-11-18');
    expect(estimateMonthlySalary(100, 'weekly')).toBe(433.33);

    const workers: FarmWorker[] = [
      {
        id: 'w1',
        name: 'Samuel',
        role: 'Herdsman',
        phone: null,
        responsibilities: 'Milking',
        salaryAmount: 400,
        payFrequency: 'monthly',
        nextPaymentDueDate: '2026-11-19',
        status: 'active',
        hireDate: '2026-01-01',
        paymentNotifiedForDueDate: null,
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'w2',
        name: 'Grace',
        role: 'Dairy Assistant',
        phone: null,
        responsibilities: 'Calf care',
        salaryAmount: 250,
        payFrequency: 'monthly',
        nextPaymentDueDate: '2026-11-28',
        status: 'active',
        hireDate: '2026-02-01',
        paymentNotifiedForDueDate: null,
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    const payments: WorkerPayment[] = [
      {
        id: 'pay1',
        workerId: 'w2',
        financialLogId: null,
        amount: 250,
        dueDate: '2026-11-16',
        paidDate: null,
        status: 'pending',
        periodLabel: 'Nov Advance',
        notes: null,
        notifiedAt: null,
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'pay2',
        workerId: 'w1',
        financialLogId: 'f1',
        amount: 400,
        dueDate: '2026-11-01',
        paidDate: '2026-11-01',
        status: 'paid',
        periodLabel: 'Oct Salary',
        notes: null,
        notifiedAt: null,
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    const tasks: WorkerTask[] = [
      {
        id: 't1',
        workerId: 'w1',
        livestockId: null,
        title: 'Clean cooling tank',
        description: null,
        priority: 'high',
        status: 'in_progress',
        dueDate: '2026-11-18',
        completedAt: null,
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 't2',
        workerId: 'w2',
        livestockId: null,
        title: 'Tag calves',
        description: null,
        priority: 'low',
        status: 'completed',
        dueDate: '2026-11-15',
        completedAt: 10,
        createdAt: 1,
        updatedAt: 10,
      },
    ];

    const summary = computeHrSummary(workers, payments, tasks, '2026-11-17', 3);
    expect(summary.activeWorkers).toBe(2);
    expect(summary.estimatedMonthlyPayroll).toBe(650);
    expect(summary.pendingPaymentsCount).toBe(1);
    expect(summary.pendingPaymentsAmount).toBe(250);
    expect(summary.dueSoonOrOverdueCount).toBe(2);
    expect(summary.dueSoonOrOverdueAmount).toBe(650);
    expect(summary.paidThisMonthAmount).toBe(400);
    expect(summary.openTasksCount).toBe(1);
    expect(summary.highPriorityTasksCount).toBe(1);

    const notif = formatPaymentAlertNotification(summary.duePaymentAlerts[0]!, 'UGX');
    expect(notif.title).toContain('Grace');
    expect(notif.body).toContain('UGX 250');

    const snapshot: FarmDbSnapshot = {
      version: 1,
      app: 'farmDB',
      exportedAt: '2026-11-17T12:00:00.000Z',
      settings: { ...DEFAULT_FARM_SETTINGS },
      livestock: [],
      productRecords: [],
      medicalRecords: [],
      financialLogs: [],
      alerts: [],
      workers,
      workerPayments: payments,
      workerTasks: tasks,
    };
    const parsed = parseFarmSnapshotJson(serializeFarmSnapshotJson(snapshot));
    expect(parsed.workers).toHaveLength(2);
    expect(parsed.workerPayments).toHaveLength(2);
    expect(parsed.workerTasks).toHaveLength(2);

    const csvs = buildAllCsvExports(snapshot);
    expect(csvs['workers.csv']).toContain('Samuel');
    expect(csvs['worker_payments.csv']).toContain('Nov Advance');
    expect(csvs['worker_tasks.csv']).toContain('Clean cooling tank');
  });
});
