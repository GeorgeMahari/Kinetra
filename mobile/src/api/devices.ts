import type { ImportItem } from '@/features/devices/mapping';

import type { RequestOptions } from './client';

type Request = <T>(path: string, options?: RequestOptions) => Promise<T>;

export interface ImportResult {
  source: 'health_connect';
  received: number;
  inserted: number;
  updated: number;
  skipped_future: number;
}

export interface SourceSummary {
  source: 'health_connect';
  connected: boolean;
  count: number;
  last_measured_at: string | null;
  last_imported_at: string | null;
}

const BATCH = 1000;

export const devicesApi = {
  summary: (request: Request) => request<SourceSummary>('/measurements/sources/health_connect'),

  /** Sends in server-sized batches; totals are summed. */
  async importItems(request: Request, items: ImportItem[]): Promise<ImportResult> {
    const total: ImportResult = { source: 'health_connect', received: 0, inserted: 0, updated: 0, skipped_future: 0 };
    for (let i = 0; i < items.length; i += BATCH) {
      const r = await request<ImportResult>('/measurements/import', {
        method: 'POST',
        body: { source: 'health_connect', items: items.slice(i, i + BATCH) },
      });
      total.received += r.received;
      total.inserted += r.inserted;
      total.updated += r.updated;
      total.skipped_future += r.skipped_future;
    }
    return total;
  },

  removeAll: (request: Request) => request<null>('/measurements/sources/health_connect', { method: 'DELETE' }),
};
