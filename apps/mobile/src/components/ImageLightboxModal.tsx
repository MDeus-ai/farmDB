import React from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FARMDB_FONTS, useUiScale } from '../theme/uiScale';
import { AppIcon } from './FarmIcons';

interface ImageLightboxProps {
  visible: boolean;
  uri: string | null | undefined;
  title?: string;
  subtitle?: string;
  onClose: () => void;
}

/**
 * In-tree full-screen image overlay safe to mount inside an existing `<Modal>`
 * across iOS, Android, and Web without nested-Modal stacking issues.
 */
export function ImageLightboxOverlay({
  visible,
  uri,
  title,
  subtitle,
  onClose,
}: ImageLightboxProps) {
  const ui = useUiScale();

  if (!visible || !uri) {
    return null;
  }

  return (
    <View style={styles.overlayRoot}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.header}>
          <View style={{ flex: 1, minWidth: 0 }}>
            {title ? (
              <Text
                style={[styles.title, { fontSize: ui.font(16) }]}
                numberOfLines={1}
              >
                {title}
              </Text>
            ) : null}
            {subtitle ? (
              <Text
                style={[styles.subtitle, { fontSize: ui.font(12) }]}
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
          <Pressable
            style={[styles.closeBtn, { flexShrink: 0 }]}
            onPress={onClose}
            hitSlop={12}
            accessibilityLabel="Close full image"
          >
            <AppIcon name="close" size={ui.font(18)} color="#ffffff" />
          </Pressable>
        </View>

        <View style={styles.stage} pointerEvents="box-none">
          <Image
            source={{ uri }}
            style={styles.fullImage}
            resizeMode="contain"
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

/**
 * Standalone full-screen image viewer modal for non-modal screens.
 */
export function ImageLightboxModal(props: ImageLightboxProps) {
  if (!props.visible || !props.uri) {
    return null;
  }
  return (
    <Modal
      visible={props.visible}
      transparent
      animationType="fade"
      onRequestClose={props.onClose}
    >
      <ImageLightboxOverlay {...props} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 999,
    elevation: 40,
    backgroundColor: 'rgba(12, 20, 15, 0.94)',
  },
  safeArea: {
    flex: 1,
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 6,
    paddingBottom: 10,
  },
  title: {
    color: '#ffffff',
    fontFamily: FARMDB_FONTS.bold,
  },
  subtitle: {
    color: '#c7d4cc',
    fontFamily: FARMDB_FONTS.medium,
    marginTop: 2,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    overflow: 'hidden',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
});
