import { useQuery, useQueryClient } from '@tanstack/react-query';

import { devicesApi, type ImportResult } from '@/api/devices';
import { useAuth } from '@/features/auth/AuthProvider';

import * as hc from './healthConnect';
import type { ImportKind } from './mapping';

export interface MeasurementOut {
  kind: string;
  value: number;
  measured_at: string;
  source: string;
}

export type Latest = Partial<Record<ImportKind, MeasurementOut>>;

const KINDS: ImportKind[] = ['resting_hr_bpm', 'weight_kg', 'steps_daily'];

/** The most recent Health Connect value per kind; manual entries are ignored here. */
export function latestFromSource(rows: MeasurementOut[], source = 'health_connect'): Latest {
  const out: Latest = {};
  for (const r of rows) {
    if (r.source !== source || !KINDS.includes(r.kind as ImportKind)) continue;
    const k = r.kind as ImportKind;
    const cur = out[k];
    if (!cur || Date.parse(r.measured_at) > Date.parse(cur.measured_at)) out[k] = r;
  }
  return out;
}

const key = (userId?: string) => ['devices', 'health_connect', userId];

/** Device side: availability and how many read permissions are granted. */
export function useHealthConnectDevice() {
  return useQuery({
    queryKey: ['devices', 'local'],
    queryFn: async () => {
      const availability = await hc.getAvailability();
      const granted = availability === 'available' ? await hc.grantedCount() : 0;
      return { availability, granted };
    },
  });
}

/** Server side: what has been imported for this account. */
export function useImportedData() {
  const { request, user } = useAuth();
  return useQuery({
    queryKey: key(user?.id),
    enabled: !!user?.id,
    queryFn: async () => {
      const [summary, rows] = await Promise.all([
        devicesApi.summary(request),
        request<MeasurementOut[]>('/measurements?days=30'),
      ]);
      return { summary, latest: latestFromSource(rows) };
    },
  });
}

export function useConnectedDataActions() {
  const { request, user } = useAuth();
  const qc = useQueryClient();
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: key(user?.id) }),
      qc.invalidateQueries({ queryKey: ['devices', 'local'] }),
    ]);
  return {
    async allow(): Promise<number> {
      const granted = await hc.requestAccess();
      await refresh();
      return granted;
    },
    async sync(): Promise<ImportResult> {
      const items = await hc.readRecent(30);
      const result = await devicesApi.importItems(request, items);
      await refresh();
      return result;
    },
    async remove(): Promise<void> {
      await devicesApi.removeAll(request);
      await refresh();
    },
    openSettings: hc.openSettings,
  };
}
