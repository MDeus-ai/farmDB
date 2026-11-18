import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

export function isTauriEnvironment(): boolean {
  return (
    typeof window !== 'undefined' &&
    '__TAURI_INTERNALS__' in (window as unknown as Record<string, unknown>)
  );
}

/**
 * Downscales an image source into a compact WebP (or JPEG fallback) data URL
 * so livestock photos stay lightweight for both local SQLite and Supabase Cloud DB sync.
 */
export function optimizeImageToDataUrl(
  sourceUrl: string,
  maxDimension = 480,
  quality = 0.74
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined' || typeof Image === 'undefined') {
      resolve(sourceUrl);
      return;
    }

    const img = new Image();
    img.onload = () => {
      try {
        const srcW = img.naturalWidth || img.width;
        const srcH = img.naturalHeight || img.height;
        if (!srcW || !srcH) {
          resolve(sourceUrl);
          return;
        }
        const scale = Math.min(1, maxDimension / Math.max(srcW, srcH));
        const targetW = Math.max(1, Math.round(srcW * scale));
        const targetH = Math.max(1, Math.round(srcH * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(sourceUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, targetW, targetH);

        const webpUrl = canvas.toDataURL('image/webp', quality);
        if (webpUrl.startsWith('data:image/webp')) {
          resolve(webpUrl);
          return;
        }
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Failed to optimize image.'));
      }
    };
    img.onerror = () => {
      if (sourceUrl.startsWith('data:image/')) {
        resolve(sourceUrl);
      } else {
        reject(new Error('Could not decode selected livestock image.'));
      }
    };
    img.src = sourceUrl;
  });
}

/**
 * Reads an existing local image path via Tauri and compresses it into a portable
 * optimized data URL suitable for Cloud DB synchronization.
 */
export async function convertLocalImageUriToOptimizedDataUrl(
  imageUri: string
): Promise<string | null> {
  if (!isTauriEnvironment() || !imageUri || imageUri.startsWith('data:') || imageUri.startsWith('http')) {
    return null;
  }
  try {
    const rawDataUrl = await invoke<string>('read_image_file_as_data_url', {
      filePath: imageUri,
    });
    return await optimizeImageToDataUrl(rawDataUrl, 480, 0.74);
  } catch {
    return null;
  }
}

/**
 * Opens the native OS file picker in Tauri, reads the chosen photo, and optimizes it
 * into a compact WebP/JPEG data URL (~15-35 KB) so it syncs reliably across Cloud DB & devices.
 */
export async function pickAndSaveDesktopImage(
  _tagHint: string
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

  const rawDataUrl = await invoke<string>('read_image_file_as_data_url', {
    filePath: selected,
  });
  return optimizeImageToDataUrl(rawDataUrl, 480, 0.74);
}

/**
 * Reads and optimizes a browser File input into a compact Data URL for preview & cloud sync.
 */
export function readBrowserPreviewImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        void optimizeImageToDataUrl(reader.result, 480, 0.74)
          .then(resolve)
          .catch(() => resolve(reader.result as string));
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
