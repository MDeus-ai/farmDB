import React, { useEffect, useMemo, useState } from 'react';
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
import { APP_ICONS } from '../assets/icons';
import { buildAnimalSelectOption } from '../utils/animalOptions';
import { ModernDatePicker } from './ModernDatePicker';
import { ModernSelect, type ModernSelectOption } from './ModernSelect';
import { NumberStepper } from './NumberStepper';

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

  const typeOptions = useMemo<ModernSelectOption<TransactionType>[]>(
    () =>
      TRANSACTION_TYPES.map((t) => ({
        value: t,
        label: t === 'income' ? 'Income' : 'Expense',
        iconSrc: t === 'income' ? APP_ICONS.money : APP_ICONS.budget,
      })),
    []
  );

  const categoryOptions = useMemo<ModernSelectOption<FinancialCategory>[]>(
    () =>
      availableCategories.map((cat) => ({
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
    [availableCategories]
  );

  const animalOptions = useMemo<ModernSelectOption<string>[]>(
    () => [
      { value: '', label: 'General Farm Transaction', iconSrc: APP_ICONS.barnAlt },
      ...animals.map((a) =>
        buildAnimalSelectOption(a, {
          label: `${a.tagNumber}${a.name ? ` — ${a.name}` : ''}`,
        })
      ),
    ],
    [animals]
  );

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
            <img src={APP_ICONS.letterX} alt="" className="app-icon-sm" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-field">
              <label className="form-label" htmlFor="fin-type">
                Type
              </label>
              <ModernSelect
                id="fin-type"
                fullWidth
                ariaLabel="Transaction type"
                value={transactionType}
                options={typeOptions}
                onChange={handleTypeChange}
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="fin-category">
                Category
              </label>
              <ModernSelect
                id="fin-category"
                fullWidth
                ariaLabel="Category"
                value={category}
                options={categoryOptions}
                onChange={setCategory}
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="fin-amount">
                Amount ({currencySymbol}) *
              </label>
              <NumberStepper
                id="fin-amount"
                ariaLabel="Amount"
                min={0.01}
                step={currencySymbol === 'UGX' ? 500 : 1}
                decimals={currencySymbol === 'UGX' ? 0 : 2}
                placeholder="0.00"
                value={amountText}
                onChange={setAmountText}
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
              <ModernDatePicker
                id="fin-date"
                ariaLabel="Transaction date"
                value={date}
                onChange={setDate}
              />
              {errors.date && (
                <span className="field-error">{errors.date}</span>
              )}
            </div>

            <div className="form-field full">
              <label className="form-label" htmlFor="fin-animal">
                Linked Animal (Optional)
              </label>
              <ModernSelect
                id="fin-animal"
                fullWidth
                searchable
                ariaLabel="Linked animal"
                value={livestockId}
                options={animalOptions}
                onChange={setLivestockId}
              />
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
