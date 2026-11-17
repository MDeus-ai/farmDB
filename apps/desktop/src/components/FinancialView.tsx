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
import { Pencil, Plus, Search, Settings, Trash2 } from 'lucide-react';
import {
  buildMonthlyProfitLossSeries,
  computeFinancialSummary,
  FINANCIAL_CATEGORIES,
  formatCategoryLabel,
  formatCurrency,
  type FinancialCategory,
  type FinancialLog,
  type TransactionType,
} from '@farmdb/core';
import {
  useDeleteFinancialLog,
  useFarmSettings,
  useFinancialLogList,
  useLivestockList,
  useUpdateFarmSettings,
} from '@farmdb/db';
import { FinancialFormModal } from './FinancialFormModal';

export function FinancialView() {
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<
    FinancialCategory | 'all'
  >('all');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialLog | null>(null);

  const livestockQuery = useLivestockList({});
  const settingsQuery = useFarmSettings();
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
  const visibleLogs = filteredLogsQuery.data ?? [];
  const currency = settingsQuery.data?.currencySymbol ?? '$';

  const summary = useMemo(() => computeFinancialSummary(allLogs), [allLogs]);
  const monthlySeries = useMemo(
    () => buildMonthlyProfitLossSeries(allLogs, 6),
    [allLogs]
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
          <p className="page-subtitle">
            Track milk sale income, feed and medical expenses, and farm profit/loss margins.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <Plus size={17} />
          Add Transaction
        </button>
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
        <div className="card">
          <div className="chart-header">
            <div>
              <h2 className="card-section-title" style={{ marginBottom: 2 }}>
                Monthly Income vs. Expenses
              </h2>
              <p className="page-subtitle" style={{ fontSize: '0.82rem' }}>
                Trailing 6 active months
              </p>
            </div>
          </div>

          {monthlySeries.length === 0 ? (
            <div className="empty-state" style={{ padding: '48px 12px' }}>
              Log income or expense transactions to visualize profit & loss margins.
            </div>
          ) : (
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monthlySeries}
                  margin={{ top: 10, right: 12, left: -4, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#ebe6dc" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#5d675f' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#5d675f' }} />
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
          )}
        </div>

        <div className="card">
          <div className="chart-header">
            <div>
              <h2 className="card-section-title" style={{ marginBottom: 2 }}>
                Standard Milk Rate & Breakdown
              </h2>
              <p className="page-subtitle" style={{ fontSize: '0.82rem' }}>
                Used when auto-recording sales from daily milk yields
              </p>
            </div>
            <Settings size={17} color="#5d675f" />
          </div>

          <form onSubmit={handleSaveSettings} className="settings-form">
            <div className="form-grid">
              <div className="form-field">
                <label className="form-label" htmlFor="setting-rate">
                  Rate per Liter
                </label>
                <input
                  id="setting-rate"
                  type="number"
                  step="0.01"
                  min="0"
                  className="input"
                  value={rateInput}
                  onChange={(e) => setRateInput(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="setting-currency">
                  Currency Symbol
                </label>
                <input
                  id="setting-currency"
                  className="input"
                  maxLength={6}
                  value={currencyInput}
                  onChange={(e) => setCurrencyInput(e.target.value)}
                />
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

          <select
            className="select"
            aria-label="Filter by transaction type"
            value={typeFilter}
            onChange={(e) =>
              setTypeFilter(e.target.value as TransactionType | 'all')
            }
          >
            <option value="all">All Types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>

          <select
            className="select"
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(e) =>
              setCategoryFilter(e.target.value as FinancialCategory | 'all')
            }
          >
            <option value="all">All Categories</option>
            {FINANCIAL_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {formatCategoryLabel(cat)}
              </option>
            ))}
          </select>
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
                      <td>{log.date}</td>
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
                          <span className="tag-chip">{animal.tagNumber}</span>
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
                        <div className="row-actions">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setEditing(log);
                              setModalOpen(true);
                            }}
                            aria-label="Edit financial entry"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => void deleteMutation.mutateAsync(log.id)}
                            disabled={deleteMutation.isPending}
                            aria-label="Delete financial entry"
                          >
                            <Trash2 size={14} />
                          </button>
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
