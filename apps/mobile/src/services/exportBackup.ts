import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import {
  exportCsvByTable,
  getTodayIsoDate,
  parseFarmSnapshotJson,
  serializeFarmSnapshotJson,
  type ExportTableKey,
  type FarmDbSnapshot,
} from '@farmdb/core';

const EXPORTS_DIR = 'farmdb-exports';

function triggerWebBlobDownload(
  filename: string,
  data: string | Uint8Array,
  mimeType: string
): void {
  const part: BlobPart =
    typeof data === 'string'
      ? data
      : new Uint8Array(data).buffer;
  const blob = new Blob([part], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

async function writeAndShareFile(
  filename: string,
  content: string | Uint8Array,
  mimeType: string
): Promise<string> {
  if (Platform.OS === 'web') {
    triggerWebBlobDownload(filename, content, mimeType);
    return filename;
  }

  const exportDir = new Directory(Paths.cache, EXPORTS_DIR);
  exportDir.create({ intermediates: true, idempotent: true });

  const file = new File(exportDir, filename);
  file.create({ intermediates: true, overwrite: true });
  await file.write(content);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType,
      dialogTitle: `Share ${filename}`,
    });
  }

  return file.uri;
}

export async function exportJsonMobile(
  snapshot: FarmDbSnapshot
): Promise<string> {
  const filename = `farmdb-export-${getTodayIsoDate()}.json`;
  return writeAndShareFile(
    filename,
    serializeFarmSnapshotJson(snapshot),
    'application/json'
  );
}

export async function exportCsvMobile(
  snapshot: FarmDbSnapshot,
  table: ExportTableKey
): Promise<string> {
  const filename = `farmdb-${table}-${getTodayIsoDate()}.csv`;
  return writeAndShareFile(
    filename,
    exportCsvByTable(snapshot, table),
    'text/csv'
  );
}

export async function exportSqliteBytesMobile(
  bytes: Uint8Array
): Promise<string> {
  const filename = `farmdb-backup-${getTodayIsoDate()}.db`;
  return writeAndShareFile(filename, bytes, 'application/octet-stream');
}

export async function pickJsonSnapshotMobile(): Promise<FarmDbSnapshot | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  const asset = result.assets[0];
  let raw: string;
  if (Platform.OS === 'web' && asset.file) {
    raw = await asset.file.text();
  } else {
    raw = await new File(asset.uri).text();
  }

  return parseFarmSnapshotJson(raw);
}

export async function pickBinaryDbBackupMobile(): Promise<Uint8Array | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  const asset = result.assets[0];
  if (Platform.OS === 'web' && asset.file) {
    return new Uint8Array(await asset.file.arrayBuffer());
  }

  return new File(asset.uri).bytes();
}
