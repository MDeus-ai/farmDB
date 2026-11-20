import React, { useEffect, useMemo, useState } from 'react';
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
  EXPENSE_CATEGORIES,
  FINANCIAL_CATEGORY_HINTS,
  formatCategoryLabel,
  getTodayIsoDate,
  INCOME_CATEGORIES,
  TRANSACTION_TYPE_HINTS,
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
import { MOBILE_APP_ICONS } from '../assets/icons';
import {
  FARMDB_COLORS,
  FARMDB_FONTS,
  useUiScale,
} from '../theme/uiScale';
import { buildAnimalDropdownOption } from '../utils/animalOptions';
import { AppIcon } from './FarmIcons';
import { FarmScrollView } from './FarmScrollView';
import { MobileNumberStepper } from './MobileNumberStepper';
import { ModernDatePicker } from './ModernDatePicker';
import {
  ModernDropdown,
  type ModernDropdownOption,
} from './ModernDropdown';

interface FinancialFormModalProps {
  visible: boolean;
  editing: FinancialLog | null;
  animals: Livestock[];
  currencySymbol: string;
  onClose: () => void;
}

export function FinancialFormModal({
  visible,
  editing,
  animals,
  currencySymbol,
  onClose,
}: FinancialFormModalProps) {
  const ui = useUiScale();
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
    if (!visible) return;
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
  }, [visible, editing]);

  const availableCategories =
    transactionType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const categoryOptions = useMemo<ModernDropdownOption<FinancialCategory>[]>(
    () =>
      availableCategories.map((cat) => ({
        value: cat,
        label: formatCategoryLabel(cat),
        iconSource:
          transactionType === 'income'
            ? MOBILE_APP_ICONS.money
            : MOBILE_APP_ICONS.budget,
        hint: FINANCIAL_CATEGORY_HINTS[cat],
      })),
    [availableCategories, transactionType]
  );

  const animalOptions = useMemo<ModernDropdownOption<string>[]>(
    () => [
      {
        value: '',
        label: 'General Farm',
        iconSource: MOBILE_APP_ICONS.barnAlt,
        hint: 'Not linked to one animal',
      },
      ...animals.map((a) => buildAnimalDropdownOption(a)),
    ],
    [animals]
  );

  function handleTypeSelect(nextType: TransactionType) {
    setTransactionType(nextType);
    const list =
      nextType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    if (!list.includes(category)) {
      setCategory(list[0]!);
    }
  }

  async function handleSubmit() {
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
            err instanceof Error ? err.message : 'Failed to update entry.'
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
          err instanceof Error ? err.message : 'Failed to save transaction.'
        );
      }
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View
            style={[
              styles.header,
              { paddingHorizontal: ui.contentPadding, paddingVertical: ui.space(13), gap: 10 },
            ]}
          >
            <Text style={[styles.title, { fontSize: ui.font(18), flex: 1, minWidth: 0 }]} numberOfLines={2}>
              {editing ? 'Edit Transaction' : 'Add Transaction'}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityLabel="Close transaction form"
            >
              <AppIcon name="close" size={ui.font(22)} color={FARMDB_COLORS.text} />
            </Pressable>
          </View>

          <FarmScrollView
            contentContainerStyle={[
              styles.content,
              { padding: ui.contentPadding, paddingBottom: ui.space(40) },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[styles.label, { fontSize: ui.font(13) }]}>Type</Text>
            <View style={styles.chipRow}>
              {TRANSACTION_TYPES.map((t) => {
                const active = transactionType === t;
                return (
                  <Pressable
                    key={t}
                    style={[
                      styles.chip,
                      active && styles.chipActive,
                      {
                        minHeight: ui.chipHeight,
                        minWidth: 112,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      },
                    ]}
                    onPress={() => handleTypeSelect(t)}
                  >
                    <AppIcon
                      name={t === 'income' ? 'income' : 'expense'}
                      size={ui.font(15)}
                      color={active ? FARMDB_COLORS.accentHover : FARMDB_COLORS.textMuted}
                    />
                    <Text
                      style={[
                        styles.chipText,
                        active && styles.chipTextActive,
                        { fontSize: ui.font(13) },
                      ]}
                    >
                      {t === 'income' ? 'Income' : 'Expense'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={{ fontSize: ui.font(10.5), color: FARMDB_COLORS.textMuted, marginTop: 2, marginBottom: 4 }}>
              {TRANSACTION_TYPE_HINTS[transactionType]}
            </Text>

            <Text style={[styles.label, { fontSize: ui.font(13) }]}>
              Category
            </Text>
            <ModernDropdown
              showSelectedHint
              value={category}
              options={categoryOptions}
              title="Select Category"
              accessibilityLabel="Category"
              onChange={setCategory}
            />

            <Text style={[styles.label, { fontSize: ui.font(13) }]}>
              Amount ({currencySymbol}) *
            </Text>
            <MobileNumberStepper
              accessibilityLabel="Transaction Amount"
              min={0.01}
              step={currencySymbol === 'UGX' ? 500 : 1}
              decimals={currencySymbol === 'UGX' ? 0 : 2}
              value={amountText}
              onChangeText={setAmountText}
              placeholder="0.00"
            />
            {errors.amount ? (
              <Text style={[styles.errorText, { fontSize: ui.font(12) }]}>
                {errors.amount}
              </Text>
            ) : null}

            <Text style={[styles.label, { fontSize: ui.font(13) }]}>
              Date *
            </Text>
            <ModernDatePicker
              title="Transaction Date"
              accessibilityLabel="Transaction Date"
              value={date}
              onChange={setDate}
            />
            {errors.date ? (
              <Text style={[styles.errorText, { fontSize: ui.font(12) }]}>
                {errors.date}
              </Text>
            ) : null}

            <Text style={[styles.label, { fontSize: ui.font(13) }]}>
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

            <Text style={[styles.label, { fontSize: ui.font(13) }]}>Notes</Text>
            <TextInput
              style={[styles.input, { minHeight: ui.controlHeight, fontSize: ui.font(15) }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Feed, vet visit, milk sale..."
            />

            {submitError ? (
              <Text style={[styles.errorText, { marginTop: 10, fontSize: ui.font(12) }]}>
                {submitError}
              </Text>
            ) : null}

            <Pressable
              style={[
                styles.saveBtn,
                isSubmitting && styles.disabledBtn,
                { minHeight: ui.controlHeight + 4, justifyContent: 'center' },
              ]}
              onPress={() => void handleSubmit()}
              disabled={isSubmitting}
            >
              <Text style={[styles.saveBtnText, { fontSize: ui.font(15) }]}>
                {isSubmitting ? 'Saving...' : 'Save Transaction'}
              </Text>
            </Pressable>
          </FarmScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f3ee',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd6c8',
  },
  title: {
    fontSize: 18,
    fontFamily: FARMDB_FONTS.bold,
    color: '#1c241e',
  },
  closeText: {
    fontSize: 15,
    fontFamily: FARMDB_FONTS.semibold,
    color: '#2d6a4f',
  },
  content: {
    padding: 18,
    paddingBottom: 40,
  },
  label: {
    fontSize: 13,
    fontFamily: FARMDB_FONTS.semibold,
    color: '#1c241e',
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ddd6c8',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: FARMDB_FONTS.regular,
    color: '#1c241e',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flex: 1,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ddd6c8',
    backgroundColor: '#ffffff',
  },
  chipActive: {
    backgroundColor: FARMDB_COLORS.accentSoft,
    borderWidth: 1.5,
    borderColor: FARMDB_COLORS.accent,
  },
  chipText: {
    fontSize: 12,
    fontFamily: FARMDB_FONTS.semibold,
    color: '#1c241e',
  },
  chipTextActive: {
    color: FARMDB_COLORS.accentHover,
    fontFamily: FARMDB_FONTS.bold,
  },
  errorText: {
    color: '#b42318',
    fontSize: 12,
    fontFamily: FARMDB_FONTS.medium,
    marginTop: 4,
  },
  saveBtn: {
    marginTop: 22,
    backgroundColor: '#2d6a4f',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  disabledBtn: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#ffffff',
    fontFamily: FARMDB_FONTS.bold,
    fontSize: 15,
  },
});
