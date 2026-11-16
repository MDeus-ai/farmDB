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
  formatSpeciesLabel,
  formatStatusLabel,
  LIVESTOCK_STATUSES,
  SPECIES_LIST,
  validateNewLivestock,
  validateUpdateLivestock,
  type Livestock,
  type LivestockStatus,
  type NewLivestockInput,
  type Species,
  type ValidationErrors,
} from '@farmdb/core';
import {
  LivestockValidationError,
  useCreateLivestock,
  useUpdateLivestock,
} from '@farmdb/db';

interface LivestockFormModalProps {
  visible: boolean;
  editing: Livestock | null;
  existingTags: string[];
  onClose: () => void;
}

export function LivestockFormModal({
  visible,
  editing,
  existingTags,
  onClose,
}: LivestockFormModalProps) {
  const createMutation = useCreateLivestock();
  const updateMutation = useUpdateLivestock();

  const [tagNumber, setTagNumber] = useState('');
  const [species, setSpecies] = useState<Species>('cow');
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [dob, setDob] = useState('');
  const [status, setStatus] = useState<LivestockStatus>('active');
  const [errors, setErrors] = useState<ValidationErrors<NewLivestockInput>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    if (editing) {
      setTagNumber(editing.tagNumber);
      setSpecies(editing.species);
      setName(editing.name ?? '');
      setBreed(editing.breed ?? '');
      setDob(editing.dob ?? '');
      setStatus(editing.status);
    } else {
      setTagNumber('');
      setSpecies('cow');
      setName('');
      setBreed('');
      setDob('');
      setStatus('active');
    }
    setErrors({});
    setSubmitError(null);
  }, [visible, editing]);

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit() {
    setSubmitError(null);

    if (editing) {
      const check = validateUpdateLivestock(
        { tagNumber, species, name, breed, dob, status },
        { existingTags, currentTag: editing.tagNumber }
      );
      if (!check.ok || !check.data) {
        setErrors(check.errors);
        return;
      }
      setErrors({});
      try {
        await updateMutation.mutateAsync({ id: editing.id, input: check.data });
        onClose();
      } catch (err) {
        if (err instanceof LivestockValidationError) {
          setErrors(err.errors);
        } else {
          setSubmitError(err instanceof Error ? err.message : 'Failed to update record.');
        }
      }
      return;
    }

    const check = validateNewLivestock(
      { tagNumber, species, name, breed, dob, status },
      { existingTags }
    );
    if (!check.ok || !check.data) {
      setErrors(check.errors);
      return;
    }
    setErrors({});
    try {
      await createMutation.mutateAsync(check.data);
      onClose();
    } catch (err) {
      if (err instanceof LivestockValidationError) {
        setErrors(err.errors);
      } else {
        setSubmitError(err instanceof Error ? err.message : 'Failed to save animal.');
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
            {editing ? `Edit ${editing.tagNumber}` : 'Add Livestock'}
          </Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.cancelText}>Close</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>Tag Number *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. COW-402"
            value={tagNumber}
            onChangeText={setTagNumber}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          {errors.tagNumber ? (
            <Text style={styles.errorText}>{errors.tagNumber}</Text>
          ) : null}

          <Text style={styles.label}>Species</Text>
          <View style={styles.chipRow}>
            {SPECIES_LIST.map((sp) => (
              <Pressable
                key={sp}
                style={[styles.chip, species === sp && styles.chipActive]}
                onPress={() => setSpecies(sp)}
              >
                <Text
                  style={[
                    styles.chipText,
                    species === sp && styles.chipTextActive,
                  ]}
                >
                  {formatSpeciesLabel(sp)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Bessie"
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>Breed</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Holstein"
            value={breed}
            onChangeText={setBreed}
          />

          <Text style={styles.label}>Date of Birth (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            placeholder="2023-04-15"
            value={dob}
            onChangeText={setDob}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {errors.dob ? <Text style={styles.errorText}>{errors.dob}</Text> : null}

          <Text style={styles.label}>Status</Text>
          <View style={styles.chipRow}>
            {LIVESTOCK_STATUSES.map((st) => (
              <Pressable
                key={st}
                style={[styles.chip, status === st && styles.chipActive]}
                onPress={() => setStatus(st)}
              >
                <Text
                  style={[
                    styles.chipText,
                    status === st && styles.chipTextActive,
                  ]}
                >
                  {formatStatusLabel(st)}
                </Text>
              </Pressable>
            ))}
          </View>

          {submitError ? (
            <Text style={[styles.errorText, { marginTop: 12 }]}>{submitError}</Text>
          ) : null}

          <Pressable
            style={[styles.saveButton, isSubmitting && styles.saveButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <Text style={styles.saveButtonText}>
              {isSubmitting
                ? 'Saving...'
                : editing
                  ? 'Save Changes'
                  : 'Save to SQLite'}
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
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2d6a4f',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
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
    paddingHorizontal: 12,
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
    fontSize: 13,
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
  saveButton: {
    marginTop: 22,
    backgroundColor: '#2d6a4f',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
