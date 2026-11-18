import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import {
  buildLivestockImageStem,
  extractSafeImageExtension,
  generateId,
} from '@farmdb/core';

const IMAGES_DIR_NAME = 'farmdb-images';

function persistPickedUri(sourceUri: string, tagHint: string): Promise<string> {
  if (Platform.OS === 'web') {
    return Promise.resolve(sourceUri);
  }

  return (async () => {
    const imagesDir = new Directory(Paths.document, IMAGES_DIR_NAME);
    imagesDir.create({ intermediates: true, idempotent: true });

    const stem = buildLivestockImageStem(tagHint, generateId());
    const ext = extractSafeImageExtension(sourceUri, 'jpg');
    const sourceFile = new File(sourceUri);
    const destinationFile = new File(imagesDir, `${stem}.${ext}`);

    await sourceFile.copy(destinationFile, { overwrite: true });
    return destinationFile.uri;
  })();
}

function resolveOptimizedAssetUri(
  asset: ImagePicker.ImagePickerAsset,
  tagHint: string
): Promise<string> {
  if (asset.base64 && asset.base64.trim().length > 0) {
    const mime =
      asset.mimeType && asset.mimeType.startsWith('image/')
        ? asset.mimeType
        : 'image/jpeg';
    return Promise.resolve(`data:${mime};base64,${asset.base64}`);
  }
  return persistPickedUri(asset.uri, tagHint);
}

export async function captureLivestockPhoto(
  tagHint: string
): Promise<string | null> {
  if (Platform.OS !== 'web') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      throw new Error(
        'Camera permission is required to capture livestock photos.'
      );
    }
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.55,
    base64: true,
  });

  const asset = result.assets?.[0];
  if (result.canceled || !asset?.uri) {
    return null;
  }

  return resolveOptimizedAssetUri(asset, tagHint);
}

export async function pickLivestockPhotoFromLibrary(
  tagHint: string
): Promise<string | null> {
  if (Platform.OS !== 'web') {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      throw new Error(
        'Photo library permission is required to choose livestock photos.'
      );
    }
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.55,
    base64: true,
  });

  const asset = result.assets?.[0];
  if (result.canceled || !asset?.uri) {
    return null;
  }

  return resolveOptimizedAssetUri(asset, tagHint);
}

export function deleteManagedLivestockPhoto(uri?: string | null): void {
  if (!uri || Platform.OS === 'web' || uri.startsWith('data:')) {
    return;
  }
  if (!uri.includes(`/${IMAGES_DIR_NAME}/`)) {
    return;
  }

  try {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // Ignore cleanup errors when a file has already been removed.
  }
}
