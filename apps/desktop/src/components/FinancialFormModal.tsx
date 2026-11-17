import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  EXPENSE_CATEGORIES,
  formatCategoryLabel,
  getTodayIsoDate,
  INCOME_CATEGORIES,
  TRANSACTION_TYPES,
  validateNewFinancialLog,
  validateUpdateFinancialLog,
  type FinancialCategory,
  type FinancialLog,
  type Livestock,
  type NewFinancialLogInput,
  type TransactionType,
  type ValidationErrors,
} from '@farmdb/core';
import {
  FinancialValidationError,
  useCreateFinancialLog,
  useUpdateFinancialLog,
} from '@farmdb/db';

interface FinancialFormModalProps {
  open: boolean;
  editing: FinancialLog | null;
  animals: Livestock[];
  currencySymbol: string;
  onClose: () => void;
}

export function FinancialFormModal({
  open,
  editing,
  animals,
  currencySymbol,
  onClose,
}: FinancialFormModalProps) {
  const createMutation = useCreateFinancialLog();
  const updateMutation = useUpdateFinancialLog();

  const [transactionType, setTransactionType] =
    useState<TransactionType>('expense');
  const [category, setCategory] = useState<FinancialCategory>('feed');
  const [amountText, setAmountText] = useState('');
  const [date, setDate] = useState(() => getTodayIsoDate());
  const [livestockId, setLivestockId] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<ValidationErrors<NewFinancialLogInput>>(
    {}
  );
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTransactionType(editing.transactionType);
      setCategory(editing.category);
      setAmountText(String(editing.amount));
      setDate(editing.date);
      setLivestockId(editing.livestockId ?? '');
      setNotes(editing.notes ?? '');
    } else {
      setTransactionType('expense');
      setCategory('feed');
      setAmountText('');
      setDate(getTodayIsoDate());
      setLivestockId('');
      setNotes('');
    }
    setErrors({});
    setSubmitError(null);
  }, [open, editing]);

  if (!open) {
    return null;
  }

  const availableCategories =
    transactionType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  function handleTypeChange(nextType: TransactionType) {
    setTransactionType(nextType);
    const list =
      nextType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    if (!list.includes(category)) {
      setCategory(list[0]!);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitError(null);

    const parsedAmount = Number(amountText);

    if (editing) {
      const check = validateUpdateFinancialLog({
        transactionType,
        category,
        amount: parsedAmount,
        date,
        livestockId: livestockId || null,
        notes,
      });
      if (!check.ok || !check.data) {
        setErrors(check.errors);
        return;
      }
      setErrors({});
      try {
        await updateMutation.mutateAsync({ id: editing.id, input: check.data });
        onClose();
      } catch (err) {
        if (err instanceof FinancialValidationError) {
          setErrors(err.errors);
        } else {
          setSubmitError(
            err instanceof Error ? err.message : 'Failed to update transaction.'
          );
        }
      }
      return;
    }

    const check = validateNewFinancialLog({
      transactionType,
      category,
      amount: parsedAmount,
      date,
      livestockId: livestockId || null,
      notes,
    });
    if (!check.ok || !check.data) {
      setErrors(check.errors);
      return;
    }
    setErrors({});
    try {
      await createMutation.mutateAsync(check.data);
      onClose();
    } catch (err) {
      if (err instanceof FinancialValidationError) {
        setErrors(err.errors);
      } else {
        setSubmitError(
          err instanceof Error ? err.message : 'Failed to record transaction.'
        );
      }
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-header">
          <h2 className="modal-title">
            {editing ? 'Edit Financial Entry' : 'Record Transaction'}
          </h2>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            aria-label="Close form"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-field">
              <label className="form-label" htmlFor="fin-type">
                Type
              </label>
              <select
                id="fin-type"
                className="select"
                value={transactionType}
                onChange={(e) =>
                  handleTypeChange(e.target.value as TransactionType)
                }
              >
                {TRANSACTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t === 'income' ? 'Income' : 'Expense'}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="fin-category">
                Category
              </label>
              <select
                id="fin-category"
                className="select"
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as FinancialCategory)
                }
              >
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {formatCategoryLabel(cat)}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="fin-amount">
                Amount ({currencySymbol}) *
              </label>
              <input
                id="fin-amount"
                type="number"
                step="0.01"
                min="0.01"
                className="input"
                placeholder="0.00"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                autoFocus
              />
              {errors.amount && (
                <span className="field-error">{errors.amount}</span>
              )}
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="fin-date">
                Date *
              </label>
              <input
                id="fin-date"
                type="date"
                className="input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              {errors.date && (
                <span className="field-error">{errors.date}</span>
              )}
            </div>

            <div className="form-field full">
              <label className="form-label" htmlFor="fin-animal">
                Linked Animal (Optional)
              </label>
              <select
                id="fin-animal"
                className="select"
                value={livestockId}
                onChange={(e) => setLivestockId(e.target.value)}
              >
                <option value="">General Farm Transaction</option>
                {animals.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.tagNumber}
                    {a.name ? ` — ${a.name}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field full">
              <label className="form-label" htmlFor="fin-notes">
                Notes
              </label>
              <input
                id="fin-notes"
                className="input"
                placeholder="e.g. 20 bales alfalfa hay"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {submitError && (
            <p className="field-error" style={{ marginTop: 12 }}>
              {submitError}
            </p>
          )}

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? 'Saving...'
                : editing
                  ? 'Save Changes'
                  : 'Save Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
