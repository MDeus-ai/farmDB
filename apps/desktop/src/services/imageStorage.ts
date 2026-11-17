import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { buildLivestockImageStem, generateId } from '@farmdb/core';

export function isTauriEnvironment(): boolean {
  return (
    typeof window !== 'undefined' &&
    '__TAURI_INTERNALS__' in (window as unknown as Record<string, unknown>)
  );
}

/**
 * Opens the native OS file picker in Tauri and copies the selected image into
 * `$APPLOCALDATA/images/` via the Rust backend, returning the local file path.
 */
export async function pickAndSaveDesktopImage(
  tagHint: string
): Promise<string | null> {
  if (!isTauriEnvironment()) {
    return null;
  }

  const selected = await open({
    title: 'Select Livestock Photo',
    multiple: false,
    filters: [
      {
        name: 'Images',
        extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'],
      },
    ],
  });

  if (!selected || typeof selected !== 'string') {
    return null;
  }

  const fileStem = buildLivestockImageStem(tagHint, generateId());
  return invoke<string>('import_livestock_image', {
    sourcePath: selected,
    fileStem,
  });
}

/**
 * Reads a browser File input into a Data URL for non-Tauri preview mode only.
 */
export function readBrowserPreviewImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read selected image file.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read selected image file.'));
    reader.readAsDataURL(file);
  });
}

export function resolveDesktopImageSrc(imageUri?: string | null): string | null {
  if (!imageUri) {
    return null;
  }
  if (
    imageUri.startsWith('data:') ||
    imageUri.startsWith('blob:') ||
    imageUri.startsWith('http://') ||
    imageUri.startsWith('https://')
  ) {
    return imageUri;
  }
  if (isTauriEnvironment()) {
    return convertFileSrc(imageUri);
  }
  return imageUri;
}

export async function deleteManagedDesktopImage(
  imageUri?: string | null
): Promise<void> {
  if (!imageUri || !isTauriEnvironment()) {
    return;
  }
  if (
    imageUri.startsWith('data:') ||
    imageUri.startsWith('blob:') ||
    imageUri.startsWith('http://') ||
    imageUri.startsWith('https://')
  ) {
    return;
  }

  try {
    await invoke('delete_livestock_image', { imagePath: imageUri });
  } catch {
    // Ignore cleanup errors if the file is outside managed storage or already gone.
  }
}
