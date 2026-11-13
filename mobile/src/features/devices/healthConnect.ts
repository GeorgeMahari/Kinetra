/**
 * Health Connect adapter (Android only, development/production builds only).
 *
 * `react-native-health-connect` throws at import time when its native module is missing
 * (Expo Go, web, iOS), so it is required lazily and only after checking the module exists.
 * Everything here is read-only: Kinetra never writes to Health Connect.
 */
import { Platform, TurboModuleRegistry, NativeModules } from 'react-native';

import { toImportItems, windowStart, type HcDailySteps, type HcRestingHr, type HcWeight, type ImportItem } from './mapping';

export type HcAvailability =
  | 'unsupported_platform' // web / iOS
  | 'needs_dev_build' // Android, but running in Expo Go (no native module)
  | 'not_installed' // Health Connect unavailable on this device
  | 'update_required' // provider must be updated from Play Store
  | 'available';

export const READ_PERMISSIONS = [
  { accessType: 'read', recordType: 'RestingHeartRate' },
  { accessType: 'read', recordType: 'Weight' },
  { accessType: 'read', recordType: 'Steps' },
] as const;

type HcModule = typeof import('react-native-health-connect');

function load(): HcModule | null {
  if (Platform.OS !== 'android') return null;
  const native = TurboModuleRegistry.get('HealthConnect') ?? NativeModules.HealthConnect;
  if (!native) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('react-native-health-connect') as HcModule;
}

export async function getAvailability(): Promise<HcAvailability> {
  if (Platform.OS !== 'android') return 'unsupported_platform';
  const hc = load();
  if (!hc) return 'needs_dev_build';
  const status = await hc.getSdkStatus();
  if (status === hc.SdkAvailabilityStatus.SDK_AVAILABLE) return 'available';
  if (status === hc.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'update_required';
  return 'not_installed';
}

function required(): HcModule {
  const hc = load();
  if (!hc) throw new Error('Health Connect is not available in this build');
  return hc;
}

/** Returns how many of the three read permissions are granted. */
export async function grantedCount(): Promise<number> {
  const hc = required();
  await hc.initialize();
  const granted = await hc.getGrantedPermissions();
  return READ_PERMISSIONS.filter((p) =>
    granted.some((g) => 'recordType' in g && g.recordType === p.recordType && g.accessType === 'read'),
  ).length;
}

export async function requestAccess(): Promise<number> {
  const hc = required();
  await hc.initialize();
  await hc.requestPermission([...READ_PERMISSIONS]);
  return grantedCount();
}

export async function revokeAccess(): Promise<void> {
  const hc = required();
  await hc.initialize();
  await hc.revokeAllPermissions();
}

export function openSettings(): void {
  required().openHealthConnectSettings();
}

/** Reads the last `days` days. Record types without permission are skipped, not fatal. */
export async function readRecent(days = 30, now = new Date()): Promise<ImportItem[]> {
  const hc = required();
  await hc.initialize();
  const start = windowStart(now, days);
  const timeRangeFilter = { operator: 'between' as const, startTime: start.toISOString(), endTime: now.toISOString() };

  const safe = async <T>(fn: () => Promise<T[]>): Promise<T[]> => {
    try {
      return await fn();
    } catch {
      return []; // most often: that permission was not granted
    }
  };

  const [restingHr, weights, dailySteps] = await Promise.all([
    safe(async () => (await hc.readRecords('RestingHeartRate', { timeRangeFilter })).records as HcRestingHr[]),
    safe(async () => (await hc.readRecords('Weight', { timeRangeFilter })).records as HcWeight[]),
    // Aggregation de-duplicates steps written by several apps (phone + watch); raw records would double count.
    safe(async () =>
      (await hc.aggregateGroupByDuration({
        recordType: 'Steps',
        timeRangeFilter,
        timeRangeSlicer: { duration: 'DAYS', length: 1 },
      })) as HcDailySteps[],
    ),
  ]);
  return toImportItems({ restingHr, weights, dailySteps });
}
