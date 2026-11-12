import { Platform, Share } from 'react-native';

/**
 * Hands the user their data export.
 * Web: downloads a .json file. iOS/Android: opens the system share sheet with the JSON,
 * so it can be saved to Files, mailed to oneself, etc. No extra native modules needed.
 */
export async function deliverExport(data: unknown, filename = 'kinetra-export.json'): Promise<void> {
  const json = JSON.stringify(data, null, 2);
  if (Platform.OS === 'web') {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  await Share.share({ title: filename, message: json });
}
