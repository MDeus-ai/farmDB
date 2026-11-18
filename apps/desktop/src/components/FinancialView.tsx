import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Search } from 'lucide-react';
import {
  buildPeriodProfitLossSeries,
  computeFinancialSummary,
  CURRENCY_OPTIONS,
  DEFAULT_FARM_SETTINGS,
  describeModuleAccessLevel,
  filterAndSortRecordsByDate,
  FINANCIAL_CATEGORIES,
  FINANCIAL_PERIOD_BUCKETS,
  formatCategoryLabel,
  formatCompactAxisNumber,
  formatCurrency,
  formatDisplayDate,
  RECORD_DATE_FILTER_OPTIONS,
  type DateSortDirection,
  type FinancialCategory,
  type FinancialLog,
  type RecordDateFilter,
  type TransactionType,
} from '@farmdb/core';
import {
  useDeleteFinancialLog,
  useFarmSettings,
  useFinancialLogList,
  useLivestockList,
  useModulePermissions,
  useUpdateFarmSettings,
} from '@farmdb/db';
import { APP_ICONS, getCurrencyFlagIcon } from '../assets/icons';
import { computeDesktopNumericYAxisWidth } from '../utils/chartAxis';
import { AnimalEyeButton } from './AnimalQuickPreviewModal';
import { FinancialFormModal } from './FinancialFormModal';
import { ModernSelect, type ModernSelectOption } from './ModernSelect';
import { NumberStepper } from './NumberStepper';

export function FinancialView() {
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<
    FinancialCategory | 'all'
  >('all');
  const [search, setSearch] = useState('');
  const [periodBucket, setPeriodBucket] = useState<'week' | 'month' | 'year'>('month');
  const [dateFilter, setDateFilter] = useState<RecordDateFilter>('all');
  const [dateSort, setDateSort] = useState<DateSortDirection>('desc');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialLog | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const livestockQuery = useLivestockList({});
  const settingsQuery = useFarmSettings();
  const settings = settingsQuery.data ?? DEFAULT_FARM_SETTINGS;
  const { canEdit, canDelete, accessLevel } = useModulePermissions('financial');
  const updateSettingsMutation = useUpdateFarmSettings();
  const allLogsQuery = useFinancialLogList({});
  const filteredLogsQuery = useFinancialLogList({
    transactionType: typeFilter,
    category: categoryFilter,
    search: search || undefined,
  });
  const deleteMutation = useDeleteFinancialLog();

  const [rateInput, setRateInput] = useState('');
  const [currencyInput, setCurrencyInput] = useState('$');
  const [settingsSavedMsg, setSettingsSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (settingsQuery.data) {
      setRateInput(settingsQuery.data.defaultMilkRatePerLiter.toFixed(2));
      setCurrencyInput(settingsQuery.data.currencySymbol);
    }
  }, [settingsQuery.data]);

  const animals = livestockQuery.data ?? [];
  const animalsById = useMemo(
    () => new Map(animals.map((a) => [a.id, a])),
    [animals]
  );

  const allLogs = allLogsQuery.data ?? [];
  const visibleLogs = useMemo(
    () =>
      filterAndSortRecordsByDate(filteredLogsQuery.data ?? [], {
        filter: dateFilter,
        sort: dateSort,
      }),
    [filteredLogsQuery.data, dateFilter, dateSort]
  );
  const currency = settingsQuery.data?.currencySymbol ?? '$';

  const summary = useMemo(() => computeFinancialSummary(allLogs), [allLogs]);
  const monthlySeries = useMemo(
    () =>
      buildPeriodProfitLossSeries(
        allLogs,
        periodBucket,
        periodBucket === 'year' ? 20 : 12
      ),
    [allLogs, periodBucket]
  );

  const dateFilterOptions = useMemo<ModernSelectOption<RecordDateFilter>[]>(
    () =>
      RECORD_DATE_FILTER_OPTIONS.map((opt) => ({
        value: opt.value,
        label: opt.label,
        iconSrc: APP_ICONS.calendar,
      })),
    []
  );

  const dateSortOptions = useMemo<ModernSelectOption<DateSortDirection>[]>(
    () => [
      { value: 'desc', label: 'Newest First', iconSrc: APP_ICONS.hourglass },
      { value: 'asc', label: 'Oldest First', iconSrc: APP_ICONS.hourglass },
    ],
    []
  );

  const financeYAxisWidth = useMemo(
    () =>
      computeDesktopNumericYAxisWidth(
        monthlySeries.flatMap((m) => [m.income, m.expense]),
        (v) => formatCompactAxisNumber(v, 0),
        { minWidth: 44, maxWidth: 88 }
      ),
    [monthlySeries]
  );

  const currencyPresetOptions = useMemo<ModernSelectOption<string>[]>(
    () => [
      ...CURRENCY_OPTIONS.map((opt) => ({
        value: opt.symbol,
        label: opt.label,
        iconSrc: getCurrencyFlagIcon(opt.flagKey),
      })),
      {
        value: '__custom__',
        label: 'Custom...',
        iconSrc: APP_ICONS.dollarSymbol,
      },
    ],
    []
  );

  const typeFilterOptions = useMemo<ModernSelectOption<TransactionType | 'all'>[]>(
    () => [
      { value: 'all', label: 'All Types', iconSrc: APP_ICONS.budget },
      { value: 'income', label: 'Income', iconSrc: APP_ICONS.money },
      { value: 'expense', label: 'Expense', iconSrc: APP_ICONS.copyWriting },
    ],
    []
  );

  const categoryFilterOptions = useMemo<
    ModernSelectOption<FinancialCategory | 'all'>[]
  >(
    () => [
      { value: 'all', label: 'All Categories', iconSrc: APP_ICONS.budget },
      ...FINANCIAL_CATEGORIES.map((cat) => ({
        value: cat,
        label: formatCategoryLabel(cat),
        iconSrc:
          cat === 'milk_sale'
            ? APP_ICONS.milkBottle
            : cat === 'meds' || cat === 'veterinary'
              ? APP_ICONS.syringe
              : cat === 'livestock_sale'
                ? APP_ICONS.cow
                : APP_ICONS.budget,
      })),
    ],
    []
  );

  const isPresetCurrency = CURRENCY_OPTIONS.some(
    (opt) => opt.symbol === currencyInput
  );

  async function handleSaveSettings(event: React.FormEvent) {
    event.preventDefault();
    setSettingsSavedMsg(null);
    const parsedRate = Number(rateInput);
    try {
      await updateSettingsMutation.mutateAsync({
        defaultMilkRatePerLiter: parsedRate,
        currencySymbol: currencyInput,
      });
      setSettingsSavedMsg('Standard milk rate updated.');
    } catch (err) {
      setSettingsSavedMsg(
        err instanceof Error ? err.message : 'Invalid settings.'
      );
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Financial Ledger</h1>
        </div>

        <div className="row-actions">
          {(!canEdit || !canDelete) && (
            <span className="status-pill status-sold">
              {describeModuleAccessLevel(accessLevel)}
            </span>
          )}
          {canEdit && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              <img src={APP_ICONS.plus} alt="" className="app-icon-sm" />
              Add Transaction
            </button>
          )}
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <p className="stat-label">Total Income</p>
          <p className="stat-value" style={{ color: 'var(--success)' }}>
            {formatCurrency(summary.totalIncome, currency)}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Total Expenses</p>
          <p className="stat-value" style={{ color: 'var(--danger)' }}>
            {formatCurrency(summary.totalExpense, currency)}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Net Profit / Loss</p>
          <p
            className="stat-value"
            style={{
              color:
                summary.netProfit >= 0 ? 'var(--success)' : 'var(--danger)',
            }}
          >
            {formatCurrency(summary.netProfit, currency)}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Profit Margin</p>
          <p className="stat-value">{summary.profitMarginPercent.toFixed(1)}%</p>
        </div>
      </div>

      <div className="split-grid">
        <div className="card chart-card">
          <div className="chart-header">
            <div>
              <h2 className="card-section-title" style={{ marginBottom: 0 }}>
                {periodBucket === 'week'
                  ? 'Weekly'
                  : periodBucket === 'year'
                    ? 'Yearly'
                    : 'Monthly'}{' '}
                Income vs. Expenses
              </h2>
            </div>
            <div className="segmented-group" role="group" aria-label="Financial chart period">
              {FINANCIAL_PERIOD_BUCKETS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`segmented-btn ${periodBucket === opt.value ? 'active' : ''}`}
                  onClick={() => setPeriodBucket(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {monthlySeries.length === 0 ? (
            <div className="empty-state" style={{ padding: '48px 12px', flex: 1, display: 'grid', placeItems: 'center' }}>
              No financial data yet.
            </div>
          ) : (
            <div className="chart-fill-wrap">
              <div className="chart-fill-inner">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={monthlySeries}
                    margin={{ top: 6, right: 12, left: 4, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#ebe6dc" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#5d675f' }} />
                    <YAxis
                      width={financeYAxisWidth}
                      tick={{ fontSize: 11, fill: '#5d675f' }}
                      tickFormatter={(v) => formatCompactAxisNumber(v, 0)}
                    />
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value), currency)}
                    />
                    <Legend />
                    <Bar
                      dataKey="income"
                      name="Income"
                      fill="#2d6a4f"
                      radius={[5, 5, 0, 0]}
                    />
                    <Bar
                      dataKey="expense"
                      name="Expense"
                      fill="#c44536"
                      radius={[5, 5, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="chart-header">
            <div>
              <h2 className="card-section-title" style={{ marginBottom: 0 }}>
                Standard Milk Rate &amp; Currency
              </h2>
            </div>
            <img src={APP_ICONS.settings} alt="" className="app-icon-md" />
          </div>

          {!canEdit ? (
            <p style={{ color: 'var(--text-muted)', margin: '0 0 14px', fontSize: '0.88rem' }}>
              View-Only Access: Milk price ({formatCurrency(settings.defaultMilkRatePerLiter, currency)}/L) and currency changes are disabled for your account.
            </p>
          ) : (
          <form onSubmit={handleSaveSettings} className="settings-form">
            <div className="form-grid">
              <div className="form-field">
                <label className="form-label" htmlFor="setting-rate">
                  Rate per Liter
                </label>
                <NumberStepper
                  id="setting-rate"
                  ariaLabel="Rate per Liter"
                  min={0}
                  step={currencyInput === 'UGX' ? 100 : 0.05}
                  decimals={currencyInput === 'UGX' ? 0 : 2}
                  value={rateInput}
                  onChange={setRateInput}
                />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="setting-currency">
                  Currency
                </label>
                <ModernSelect
                  id="setting-currency"
                  fullWidth
                  ariaLabel="Select currency"
                  value={isPresetCurrency ? currencyInput : '__custom__'}
                  options={currencyPresetOptions}
                  onChange={(next) => {
                    if (next === '__custom__') {
                      setCurrencyInput((prev) =>
                        CURRENCY_OPTIONS.some((o) => o.symbol === prev)
                          ? ''
                          : prev
                      );
                    } else {
                      setCurrencyInput(next);
                    }
                  }}
                />
                {!isPresetCurrency && (
                  <input
                    className="input"
                    style={{ marginTop: 6 }}
                    maxLength={6}
                    value={currencyInput}
                    onChange={(e) => setCurrencyInput(e.target.value)}
                    placeholder="Symbol (e.g. KES)"
                  />
                )}
              </div>
            </div>

            <div className="settings-actions">
              <button
                type="submit"
                className="btn btn-secondary btn-sm"
                disabled={updateSettingsMutation.isPending}
              >
                Save Rate
              </button>
              {settingsSavedMsg && (
                <span className="success-hint">{settingsSavedMsg}</span>
              )}
            </div>
          </form>
          )}

          <div className="detail-facts" style={{ marginTop: 16, marginBottom: 0 }}>
            <div className="detail-fact">
              <p className="detail-fact-label">Milk Sale Income</p>
              <p className="detail-fact-value">
                {formatCurrency(summary.milkSaleIncome, currency)}
              </p>
            </div>
            <div className="detail-fact">
              <p className="detail-fact-label">Feed Costs</p>
              <p className="detail-fact-value">
                {formatCurrency(summary.feedExpense, currency)}
              </p>
            </div>
            <div className="detail-fact">
              <p className="detail-fact-label">Medical / Vet Costs</p>
              <p className="detail-fact-value">
                {formatCurrency(summary.medicalExpense, currency)}
              </p>
            </div>
            <div className="detail-fact">
              <p className="detail-fact-label">Ledger Entries</p>
              <p className="detail-fact-value">{allLogs.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="search-wrap">
            <Search size={16} className="search-icon" />
            <input
              className="input"
              placeholder="Search notes or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <ModernSelect
            ariaLabel="Filter by transaction type"
            value={typeFilter}
            options={typeFilterOptions}
            onChange={setTypeFilter}
          />

          <ModernSelect
            ariaLabel="Filter by category"
            value={categoryFilter}
            options={categoryFilterOptions}
            onChange={setCategoryFilter}
          />

          <ModernSelect
            ariaLabel="Filter by date timeframe"
            value={dateFilter}
            options={dateFilterOptions}
            onChange={setDateFilter}
          />

          <ModernSelect
            ariaLabel="Sort financial logs by date"
            value={dateSort}
            options={dateSortOptions}
            onChange={setDateSort}
          />
        </div>

        {visibleLogs.length === 0 ? (
          <div className="empty-state">No financial entries recorded yet.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Animal</th>
                  <th>Amount</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleLogs.map((log) => {
                  const animal = log.livestockId
                    ? animalsById.get(log.livestockId)
                    : null;
                  return (
                    <tr key={log.id}>
                      <td>{formatDisplayDate(log.date, settings.dateFormat)}</td>
                      <td>
                        <span
                          className={`status-pill ${
                            log.transactionType === 'income'
                              ? 'status-active'
                              : 'status-deceased'
                          }`}
                        >
                          {log.transactionType === 'income'
                            ? 'Income'
                            : 'Expense'}
                        </span>
                      </td>
                      <td>
                        {formatCategoryLabel(log.category)}
                        {log.productRecordId && (
                          <span className="auto-tag">Auto</span>
                        )}
                      </td>
                      <td>
                        {animal ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <span className="tag-chip">{animal.tagNumber}</span>
                            <AnimalEyeButton livestockId={animal.id} />
                          </span>
                        ) : (
                          'General Farm'
                        )}
                      </td>
                      <td>
                        <strong
                          style={{
                            color:
                              log.transactionType === 'income'
                                ? 'var(--success)'
                                : 'var(--danger)',
                          }}
                        >
                          {log.transactionType === 'income' ? '+' : '-'}
                          {formatCurrency(log.amount, currency)}
                        </strong>
                      </td>
                      <td>{log.notes ?? '—'}</td>
                      <td>
                        {(canEdit || canDelete) ? (
                          <div className="row-actions">
                            {canEdit && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                  setEditing(log);
                                  setModalOpen(true);
                                }}
                                aria-label="Edit financial entry"
                              >
                                <img src={APP_ICONS.pencil} alt="" className="app-icon-sm" />
                              </button>
                            )}
                            {canDelete &&
                              (confirmDeleteId === log.id ? (
                                <>
                                  <button
                                    type="button"
                                    className="btn btn-danger btn-sm"
                                    onClick={() => {
                                      setConfirmDeleteId(null);
                                      void deleteMutation.mutateAsync(log.id);
                                    }}
                                    disabled={deleteMutation.isPending}
                                  >
                                    <img src={APP_ICONS.checkmark} alt="" className="app-icon-sm" />
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setConfirmDeleteId(null)}
                                  >
                                    <img src={APP_ICONS.letterX} alt="" className="app-icon-sm" />
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  onClick={() => {
                                    if (settings.confirmBeforeDelete) {
                                      setConfirmDeleteId(log.id);
                                    } else {
                                      void deleteMutation.mutateAsync(log.id);
                                    }
                                  }}
                                  disabled={deleteMutation.isPending}
                                  aria-label="Delete financial entry"
                                >
                                  <img src={APP_ICONS.delete} alt="" className="app-icon-sm" />
                                </button>
                              ))}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            View only
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <FinancialFormModal
        open={modalOpen}
        editing={editing}
        animals={animals}
        currencySymbol={currency}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
