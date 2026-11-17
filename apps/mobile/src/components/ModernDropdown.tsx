import React, { useMemo, useState } from 'react';
import {
  Image,
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
import type { LivestockStatus, Species } from '@farmdb/core';
import type { MobilePngIconSource } from '../assets/icons';
import { FARMDB_COLORS, FARMDB_FONTS, useUiScale } from '../theme/uiScale';
import { AppIcon, StatusIcon } from './FarmIcons';
import { FarmFlatList } from './FarmScrollView';
import { ImageLightboxOverlay } from './ImageLightboxModal';

export interface DropdownOptionPreview {
  title: string;
  tagNumber?: string;
  subtitle?: string;
  species?: Species;
  status?: LivestockStatus;
  statusLabel?: string;
  ageText?: string;
  dobText?: string;
  imageUri?: string | null;
  fallbackIconSource?: MobilePngIconSource | null;
}

export interface ModernDropdownOption<T extends string = string> {
  value: T;
  label: string;
  iconSource?: MobilePngIconSource | null;
  customIcon?: React.ReactNode;
  hint?: string;
  preview?: DropdownOptionPreview;
}

interface ModernDropdownProps<T extends string = string> {
  value: T;
  options: readonly ModernDropdownOption<T>[];
  onChange: (nextValue: T) => void;
  title?: string;
  placeholder?: string;
  searchable?: boolean;
  compact?: boolean;
  accessibilityLabel?: string;
}

function QuickPreviewBanner<T extends string>({
  option,
  selectedValue,
  onSelect,
  onOpenImage,
  onDismiss,
}: {
  option: ModernDropdownOption<T>;
  selectedValue: T;
  onSelect: (nextValue: T) => void;
  onOpenImage: (preview: DropdownOptionPreview) => void;
  onDismiss: () => void;
}) {
  const ui = useUiScale();
  const preview = option.preview;
  if (!preview) return null;

  const isAlreadySelected = option.value === selectedValue;

  return (
    <View
      style={[
        styles.previewCard,
        {
          marginHorizontal: ui.space(12),
          marginTop: ui.space(10),
          padding: ui.space(10),
          borderRadius: Math.max(10, ui.radius - 2),
        },
      ]}
    >
      {preview.imageUri ? (
        <Pressable
          style={styles.previewThumbBtn}
          onPress={() => onOpenImage(preview)}
          accessibilityLabel={`View full photo of ${preview.title}`}
        >
          <Image source={{ uri: preview.imageUri }} style={styles.previewThumbImg} />
        </Pressable>
      ) : (
        <View style={styles.previewThumbFallback}>
          {preview.fallbackIconSource !== undefined &&
          preview.fallbackIconSource !== null ? (
            <Image
              source={preview.fallbackIconSource}
              style={{ width: 28, height: 28 }}
              resizeMode="contain"
            />
          ) : null}
        </View>
      )}

      <View style={styles.previewBody}>
        <View style={styles.previewTopRow}>
          {preview.tagNumber ? (
            <View style={styles.previewTagChip}>
              <Text style={[styles.previewTagText, { fontSize: ui.font(10) }]}>
                {preview.tagNumber}
              </Text>
            </View>
          ) : null}
          {preview.status && preview.statusLabel ? (
            <View style={styles.previewStatusPill}>
              <StatusIcon status={preview.status} size={ui.font(11)} />
              <Text style={[styles.previewStatusText, { fontSize: ui.font(10) }]}>
                {preview.statusLabel}
              </Text>
            </View>
          ) : null}
          <Pressable
            onPress={onDismiss}
            hitSlop={8}
            accessibilityLabel="Dismiss preview"
            style={{ marginLeft: 'auto' }}
          >
            <AppIcon name="close" size={ui.font(14)} color={FARMDB_COLORS.textMuted} />
          </Pressable>
        </View>

        <View style={styles.previewNameRow}>
          <Text
            style={[styles.previewTitle, { fontSize: ui.font(14), flexGrow: 1, flexShrink: 1, minWidth: 100 }]}
            numberOfLines={2}
          >
            {preview.title}
          </Text>
          {preview.imageUri ? (
            <Pressable
              style={styles.previewViewImgBtn}
              onPress={() => onOpenImage(preview)}
              hitSlop={6}
            >
              <AppIcon name="expand" size={ui.font(11)} color={FARMDB_COLORS.accent} />
              <Text style={[styles.previewViewImgText, { fontSize: ui.font(10) }]}>
                View Image
              </Text>
            </Pressable>
          ) : null}
          {!isAlreadySelected ? (
            <Pressable
              style={styles.previewSelectBtn}
              onPress={() => onSelect(option.value)}
            >
              <Text style={[styles.previewSelectBtnText, { fontSize: ui.font(11) }]}>
                Select
              </Text>
            </Pressable>
          ) : null}
        </View>

        <Text
          style={[styles.previewMeta, { fontSize: ui.font(11) }]}
          numberOfLines={3}
        >
          {[
            preview.subtitle,
            preview.ageText ? `Age: ${preview.ageText}` : null,
            preview.dobText && preview.dobText !== 'Unknown DOB'
              ? `DOB: ${preview.dobText}`
              : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>
    </View>
  );
}

export function ModernDropdown<T extends string = string>({
  value,
  options,
  onChange,
  title = 'Select Option',
  placeholder = 'Select...',
  searchable = false,
  compact = false,
  accessibilityLabel,
}: ModernDropdownProps<T>) {
  const ui = useUiScale();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [previewValue, setPreviewValue] = useState<T | null>(null);
  const [lightboxPreview, setLightboxPreview] =
    useState<DropdownOptionPreview | null>(null);

  const selected = useMemo(
    () => options.find((opt) => opt.value === value) ?? null,
    [options, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.hint && opt.hint.toLowerCase().includes(q)) ||
        (opt.preview?.subtitle &&
          opt.preview.subtitle.toLowerCase().includes(q))
    );
  }, [options, query]);

  const activePreviewOption = useMemo(() => {
    if (previewValue === null) return null;
    const explicit = options.find((o) => o.value === previewValue);
    return explicit?.preview ? explicit : null;
  }, [previewValue, options]);

  const showSearch = searchable || options.length > 6;

  return (
    <>
      <Pressable
        accessibilityLabel={accessibilityLabel ?? title}
        style={[
          styles.trigger,
          compact && styles.triggerCompact,
          {
            minHeight: compact ? ui.chipHeight : ui.controlHeight,
            borderRadius: compact ? 18 : Math.max(10, ui.radius - 2),
            paddingHorizontal: ui.space(compact ? 11 : 12),
            paddingVertical: ui.space(6),
          },
        ]}
        onPress={() => {
          setQuery('');
          setPreviewValue(null);
          setOpen(true);
        }}
      >
        <View style={styles.triggerLeft}>
          {selected?.preview?.imageUri ? (
            <Image
              source={{ uri: selected.preview.imageUri }}
              style={{
                width: ui.font(compact ? 18 : 22),
                height: ui.font(compact ? 18 : 22),
                borderRadius: 6,
              }}
            />
          ) : selected?.customIcon ? (
            selected.customIcon
          ) : selected?.iconSource !== undefined &&
            selected.iconSource !== null ? (
            <Image
              source={selected.iconSource}
              style={{
                width: ui.font(compact ? 15 : 18),
                height: ui.font(compact ? 15 : 18),
              }}
              resizeMode="contain"
            />
          ) : null}
          <Text
            style={[
              styles.triggerLabel,
              {
                fontSize: ui.font(compact ? 12 : 14),
                fontFamily: compact
                  ? FARMDB_FONTS.semibold
                  : FARMDB_FONTS.medium,
              },
            ]}
            numberOfLines={2}
          >
            {selected ? selected.label : placeholder}
          </Text>
        </View>
        <AppIcon
          name="chevronDown"
          size={ui.font(compact ? 14 : 16)}
          color={FARMDB_COLORS.textMuted}
        />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (lightboxPreview) {
            setLightboxPreview(null);
            return;
          }
          setOpen(false);
        }}
      >
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setOpen(false)}
          />
          <SafeAreaView style={styles.sheetSafeWrap} edges={['bottom', 'left', 'right']}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.sheetKeyboard}
            >
              <View
                style={[
                  styles.sheetCard,
                  {
                    borderRadius: Math.max(16, ui.radius + 2),
                    maxHeight: Math.min(ui.height * 0.78, 560),
                  },
                ]}
              >
                <View
                  style={[
                    styles.sheetHeader,
                    {
                      paddingHorizontal: ui.space(16),
                      paddingVertical: ui.space(13),
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.sheetTitle,
                      { fontSize: ui.font(16), fontFamily: FARMDB_FONTS.bold },
                    ]}
                  >
                    {title}
                  </Text>
                  <Pressable
                    onPress={() => setOpen(false)}
                    hitSlop={10}
                    accessibilityLabel="Close menu"
                    style={styles.sheetCloseBtn}
                  >
                    <AppIcon name="close" size={ui.font(17)} />
                  </Pressable>
                </View>

                {showSearch ? (
                  <View
                    style={[
                      styles.searchBarWrap,
                      {
                        marginHorizontal: ui.space(14),
                        marginTop: ui.space(10),
                        minHeight: ui.controlHeight,
                        paddingHorizontal: ui.space(10),
                      },
                    ]}
                  >
                    <AppIcon
                      name="search"
                      size={ui.font(15)}
                      color={FARMDB_COLORS.textMuted}
                    />
                    <TextInput
                      style={[
                        styles.searchInput,
                        {
                          fontSize: ui.font(14),
                          fontFamily: FARMDB_FONTS.regular,
                        },
                      ]}
                      placeholder="Filter options..."
                      placeholderTextColor={FARMDB_COLORS.textMuted}
                      value={query}
                      onChangeText={setQuery}
                    />
                    {query.length > 0 ? (
                      <Pressable onPress={() => setQuery('')} hitSlop={8}>
                        <AppIcon name="close" size={ui.font(14)} />
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}

                {activePreviewOption ? (
                  <QuickPreviewBanner
                    option={activePreviewOption}
                    selectedValue={value}
                    onSelect={(nextVal) => {
                      onChange(nextVal);
                      setOpen(false);
                    }}
                    onOpenImage={(preview) => setLightboxPreview(preview)}
                    onDismiss={() => setPreviewValue(null)}
                  />
                ) : null}

                <FarmFlatList
                  fillParent={false}
                  surfaceTone="card"
                  data={filtered}
                  keyExtractor={(item) => item.value}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{
                    padding: ui.space(10),
                    gap: ui.space(4),
                  }}
                  ListEmptyComponent={
                    <Text
                      style={[
                        styles.emptyText,
                        {
                          fontSize: ui.font(13),
                          fontFamily: FARMDB_FONTS.regular,
                        },
                      ]}
                    >
                      No matching options
                    </Text>
                  }
                  renderItem={({ item }) => {
                    const active = item.value === value;
                    const previewing = activePreviewOption?.value === item.value;
                    return (
                      <View
                        style={[
                          styles.optionRowWrap,
                          active && styles.optionRowActive,
                          previewing && !active && styles.optionRowPreviewing,
                          {
                            minHeight: ui.controlHeight,
                            borderRadius: Math.max(10, ui.radius - 2),
                          },
                        ]}
                      >
                        <Pressable
                          style={[
                            styles.optionSelectArea,
                            {
                              paddingHorizontal: ui.space(12),
                              paddingVertical: ui.space(8),
                            },
                          ]}
                          onPress={() => {
                            onChange(item.value);
                            setOpen(false);
                          }}
                        >
                          <View style={styles.optionLeft}>
                            {item.preview?.imageUri ? (
                              <Image
                                source={{ uri: item.preview.imageUri }}
                                style={styles.optionThumb}
                              />
                            ) : item.customIcon ? (
                              item.customIcon
                            ) : item.iconSource !== undefined &&
                              item.iconSource !== null ? (
                              <Image
                                source={item.iconSource}
                                style={{
                                  width: ui.font(20),
                                  height: ui.font(20),
                                }}
                                resizeMode="contain"
                              />
                            ) : null}
                            <View style={{ flex: 1 }}>
                              <Text
                                style={[
                                  styles.optionLabel,
                                  active && styles.optionLabelActive,
                                  {
                                    fontSize: ui.font(14),
                                    fontFamily: active
                                      ? FARMDB_FONTS.bold
                                      : FARMDB_FONTS.medium,
                                  },
                                ]}
                              >
                                {item.label}
                              </Text>
                              {item.hint ? (
                                <Text
                                  style={[
                                    styles.optionHint,
                                    {
                                      fontSize: ui.font(11),
                                      fontFamily: FARMDB_FONTS.regular,
                                    },
                                  ]}
                                >
                                  {item.hint}
                                </Text>
                              ) : null}
                            </View>
                          </View>
                          {active ? (
                            <AppIcon name="check" size={ui.font(16)} />
                          ) : null}
                        </Pressable>

                        {item.preview ? (
                          <Pressable
                            style={styles.optionEyeBtn}
                            hitSlop={6}
                            accessibilityLabel={`Preview ${item.preview.title}`}
                            onPress={() =>
                              setPreviewValue((prev) =>
                                prev === item.value ? null : item.value
                              )
                            }
                          >
                            <AppIcon
                              name="eye"
                              size={ui.font(15)}
                              color={
                                previewing
                                  ? FARMDB_COLORS.accent
                                  : FARMDB_COLORS.textMuted
                              }
                            />
                          </Pressable>
                        ) : null}
                      </View>
                    );
                  }}
                />
              </View>
            </KeyboardAvoidingView>
          </SafeAreaView>

          <ImageLightboxOverlay
            visible={Boolean(lightboxPreview?.imageUri) && open}
            uri={lightboxPreview?.imageUri}
            title={lightboxPreview?.title}
            subtitle={lightboxPreview?.tagNumber}
            onClose={() => setLightboxPreview(null)}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: FARMDB_COLORS.cardAlt,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
  },
  triggerCompact: {
    backgroundColor: FARMDB_COLORS.surface,
  },
  triggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  triggerLabel: {
    color: FARMDB_COLORS.text,
    flexShrink: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(23, 39, 29, 0.48)',
    justifyContent: 'center',
    padding: 16,
  },
  sheetSafeWrap: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
  },
  sheetKeyboard: {
    width: '100%',
  },
  sheetCard: {
    backgroundColor: FARMDB_COLORS.surface,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    overflow: 'hidden',
    shadowColor: FARMDB_COLORS.darkHeader,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: FARMDB_COLORS.surfaceMuted,
    backgroundColor: FARMDB_COLORS.cardAlt,
  },
  sheetTitle: {
    color: FARMDB_COLORS.darkHeader,
    flex: 1,
    minWidth: 0,
  },
  sheetCloseBtn: {
    padding: 4,
    borderRadius: 999,
    flexShrink: 0,
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: FARMDB_COLORS.cardAlt,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    borderRadius: 10,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: FARMDB_COLORS.text,
    paddingVertical: 6,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#f5f2ea',
    borderWidth: 1,
    borderColor: '#ded7c8',
  },
  previewThumbBtn: {
    width: 52,
    height: 52,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    backgroundColor: FARMDB_COLORS.surface,
  },
  previewThumbImg: {
    width: '100%',
    height: '100%',
  },
  previewThumbFallback: {
    width: 52,
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
    backgroundColor: FARMDB_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBody: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  previewTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  previewTagChip: {
    backgroundColor: '#eae4d7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  previewTagText: {
    fontFamily: FARMDB_FONTS.monoBold,
    fontSize: 10,
    color: FARMDB_COLORS.text,
  },
  previewStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: FARMDB_COLORS.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: FARMDB_COLORS.border,
  },
  previewStatusText: {
    fontFamily: FARMDB_FONTS.semibold,
    fontSize: 10,
    color: FARMDB_COLORS.text,
  },
  previewNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  previewViewImgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: FARMDB_COLORS.accentSoft,
    borderWidth: 1,
    borderColor: '#cce3d6',
  },
  previewViewImgText: {
    fontFamily: FARMDB_FONTS.bold,
    fontSize: 10,
    color: FARMDB_COLORS.accent,
  },
  previewTitle: {
    fontFamily: FARMDB_FONTS.bold,
    color: FARMDB_COLORS.text,
  },
  previewMeta: {
    fontFamily: FARMDB_FONTS.regular,
    color: FARMDB_COLORS.textMuted,
  },
  previewSelectBtn: {
    backgroundColor: FARMDB_COLORS.accent,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  previewSelectBtnText: {
    fontFamily: FARMDB_FONTS.bold,
    fontSize: 11,
    color: '#ffffff',
  },
  optionRowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  optionRowActive: {
    backgroundColor: FARMDB_COLORS.accentSoft,
    borderColor: '#cce3d6',
  },
  optionRowPreviewing: {
    backgroundColor: '#f6f3eb',
    borderColor: '#e2dbcd',
  },
  optionSelectArea: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  optionEyeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionThumb: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: FARMDB_COLORS.surfaceMuted,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  optionLabel: {
    color: FARMDB_COLORS.text,
  },
  optionLabelActive: {
    color: FARMDB_COLORS.accentHover,
  },
  optionHint: {
    color: FARMDB_COLORS.textMuted,
    marginTop: 1,
  },
  emptyText: {
    color: FARMDB_COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: 18,
  },
});
