import React, { useEffect, useState } from 'react';
import {
  Image,
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
import {
  captureLivestockPhoto,
  deleteManagedLivestockPhoto,
  pickLivestockPhotoFromLibrary,
} from '../services/imageStorage';

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
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [sessionImportedUris, setSessionImportedUris] = useState<string[]>([]);
  const [pickingImage, setPickingImage] = useState(false);
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
      setImageUri(editing.imageUri);
    } else {
      setTagNumber('');
      setSpecies('cow');
      setName('');
      setBreed('');
      setDob('');
      setStatus('active');
      setImageUri(null);
    }
    setSessionImportedUris([]);
    setErrors({});
    setSubmitError(null);
  }, [visible, editing]);

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  async function handleAcquirePhoto(source: 'camera' | 'library') {
    setSubmitError(null);
    setPickingImage(true);
    try {
      const savedUri =
        source === 'camera'
          ? await captureLivestockPhoto(tagNumber || 'animal')
          : await pickLivestockPhotoFromLibrary(tagNumber || 'animal');

      if (savedUri) {
        setSessionImportedUris((prev) => [...prev, savedUri]);
        setImageUri(savedUri);
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Unable to capture or select photo.'
      );
    } finally {
      setPickingImage(false);
    }
  }

  function handleCancel() {
    for (const uri of sessionImportedUris) {
      deleteManagedLivestockPhoto(uri);
    }
    onClose();
  }

  function cleanupAfterSave(finalUri: string | null | undefined) {
    const originalUri = editing?.imageUri ?? null;
    if (originalUri && originalUri !== finalUri) {
      deleteManagedLivestockPhoto(originalUri);
    }
    for (const uri of sessionImportedUris) {
      if (uri !== finalUri) {
        deleteManagedLivestockPhoto(uri);
      }
    }
  }

  async function handleSubmit() {
    setSubmitError(null);

    if (editing) {
      const check = validateUpdateLivestock(
        { tagNumber, species, name, breed, dob, status, imageUri },
        { existingTags, currentTag: editing.tagNumber }
      );
      if (!check.ok || !check.data) {
        setErrors(check.errors);
        return;
      }
      setErrors({});
      try {
        await updateMutation.mutateAsync({ id: editing.id, input: check.data });
        cleanupAfterSave(check.data.imageUri);
        onClose();
      } catch (err) {
        if (err instanceof LivestockValidationError) {
          setErrors(err.errors);
        } else {
          setSubmitError(
            err instanceof Error ? err.message : 'Failed to update record.'
          );
        }
      }
      return;
    }

    const check = validateNewLivestock(
      { tagNumber, species, name, breed, dob, status, imageUri },
      { existingTags }
    );
    if (!check.ok || !check.data) {
      setErrors(check.errors);
      return;
    }
    setErrors({});
    try {
      await createMutation.mutateAsync(check.data);
      cleanupAfterSave(check.data.imageUri);
      onClose();
    } catch (err) {
      if (err instanceof LivestockValidationError) {
        setErrors(err.errors);
      } else {
        setSubmitError(
          err instanceof Error ? err.message : 'Failed to save animal.'
        );
      }
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCancel}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {editing ? `Edit ${editing.tagNumber}` : 'Add Livestock'}
          </Text>
          <Pressable onPress={handleCancel} hitSlop={10}>
            <Text style={styles.cancelText}>Close</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.photoBox}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.photoPreview} />
            ) : (
              <View style={styles.photoEmpty}>
                <Text style={styles.photoEmptyText}>No Photo</Text>
              </View>
            )}

            <View style={styles.photoActions}>
              <View style={styles.photoButtonRow}>
                <Pressable
                  style={styles.photoBtn}
                  onPress={() => void handleAcquirePhoto('camera')}
                  disabled={pickingImage || isSubmitting}
                >
                  <Text style={styles.photoBtnText}>
                    {pickingImage ? 'Working...' : 'Take Photo'}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.photoBtn}
                  onPress={() => void handleAcquirePhoto('library')}
                  disabled={pickingImage || isSubmitting}
                >
                  <Text style={styles.photoBtnText}>Library</Text>
                </Pressable>
                {imageUri ? (
                  <Pressable
                    style={styles.photoRemoveBtn}
                    onPress={() => setImageUri(null)}
                    disabled={isSubmitting}
                  >
                    <Text style={styles.photoRemoveText}>Remove</Text>
                  </Pressable>
                ) : null}
              </View>
              <Text style={styles.photoHint} numberOfLines={1}>
                {imageUri
                  ? 'Saved locally on device'
                  : 'Stored in app documents (URI saved in SQLite)'}
              </Text>
            </View>
          </View>

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
            style={[
              styles.saveButton,
              (isSubmitting || pickingImage) && styles.saveButtonDisabled,
            ]}
            onPress={() => void handleSubmit()}
            disabled={isSubmitting || pickingImage}
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
  photoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ddd6c8',
    marginBottom: 8,
  },
  photoPreview: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: '#f0ece3',
  },
  photoEmpty: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: '#f0ece3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoEmptyText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5d675f',
  },
  photoActions: {
    flex: 1,
    gap: 6,
  },
  photoButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  photoBtn: {
    backgroundColor: '#e6f2ec',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  photoBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2d6a4f',
  },
  photoRemoveBtn: {
    backgroundColor: '#fdeceb',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  photoRemoveText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b42318',
  },
  photoHint: {
    fontSize: 11,
    color: '#5d675f',
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
