import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
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
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {editing ? 'Edit Transaction' : 'Add Transaction'}
          </Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>Type</Text>
          <View style={styles.chipRow}>
            {TRANSACTION_TYPES.map((t) => (
              <Pressable
                key={t}
                style={[styles.chip, transactionType === t && styles.chipActive]}
                onPress={() => handleTypeSelect(t)}
              >
                <Text
                  style={[
                    styles.chipText,
                    transactionType === t && styles.chipTextActive,
                  ]}
                >
                  {t === 'income' ? 'Income' : 'Expense'}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Category</Text>
          <View style={styles.chipRow}>
            {availableCategories.map((cat) => (
              <Pressable
                key={cat}
                style={[styles.chip, category === cat && styles.chipActive]}
                onPress={() => setCategory(cat)}
              >
                <Text
                  style={[
                    styles.chipText,
                    category === cat && styles.chipTextActive,
                  ]}
                >
                  {formatCategoryLabel(cat)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Amount ({currencySymbol}) *</Text>
          <TextInput
            style={styles.input}
            value={amountText}
            onChangeText={setAmountText}
            placeholder="0.00"
            keyboardType="decimal-pad"
          />
          {errors.amount ? (
            <Text style={styles.errorText}>{errors.amount}</Text>
          ) : null}

          <Text style={styles.label}>Date (YYYY-MM-DD) *</Text>
          <TextInput
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
          />
          {errors.date ? (
            <Text style={styles.errorText}>{errors.date}</Text>
          ) : null}

          <Text style={styles.label}>Linked Animal (Optional)</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            <Pressable
              style={[styles.chip, livestockId === '' && styles.chipActive]}
              onPress={() => setLivestockId('')}
            >
              <Text
                style={[
                  styles.chipText,
                  livestockId === '' && styles.chipTextActive,
                ]}
              >
                General Farm
              </Text>
            </Pressable>
            {animals.map((a) => (
              <Pressable
                key={a.id}
                style={[styles.chip, livestockId === a.id && styles.chipActive]}
                onPress={() => setLivestockId(a.id)}
              >
                <Text
                  style={[
                    styles.chipText,
                    livestockId === a.id && styles.chipTextActive,
                  ]}
                >
                  {a.tagNumber}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={styles.input}
            value={notes}
            onChangeText={setNotes}
            placeholder="Feed, vet visit, milk sale..."
          />

          {submitError ? (
            <Text style={[styles.errorText, { marginTop: 10 }]}>
              {submitError}
            </Text>
          ) : null}

          <Pressable
            style={[styles.saveBtn, isSubmitting && styles.disabledBtn]}
            onPress={() => void handleSubmit()}
            disabled={isSubmitting}
          >
            <Text style={styles.saveBtnText}>
              {isSubmitting ? 'Saving...' : 'Save Transaction'}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
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
    fontWeight: '700',
    color: '#1c241e',
  },
  closeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2d6a4f',
  },
  content: {
    padding: 18,
    paddingBottom: 40,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
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
    color: '#1c241e',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ddd6c8',
    backgroundColor: '#ffffff',
  },
  chipActive: {
    backgroundColor: '#2d6a4f',
    borderColor: '#2d6a4f',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1c241e',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  errorText: {
    color: '#b42318',
    fontSize: 12,
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
    fontWeight: '700',
    fontSize: 15,
  },
});
