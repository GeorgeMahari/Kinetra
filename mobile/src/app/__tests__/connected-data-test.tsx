/** Connected data screen: device states, permission flow, sync and removal of imported data. */
import '@/i18n';

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { AuthContextValue } from '@/auth/AuthProvider';
import * as hc from '@/features/devices/healthConnect';
import i18n from '@/i18n';
import { providers } from '@/test-utils/fakeBackend';

import ConnectedData from '../(app)/connected-data';

// The native module is replaced in tests only; the app itself never simulates Health Connect.
jest.mock('@/features/devices/healthConnect', () => ({
  getAvailability: jest.fn(),
  grantedCount: jest.fn(),
  requestAccess: jest.fn(),
  readRecent: jest.fn(),
  openSettings: jest.fn(),
}));
const mocked = jest.mocked(hc);

function fakeServer() {
  let rows: { kind: string; value: number; measured_at: string; source: string }[] = [];
  let importedAt: string | null = null;
  const calls: { method: string; path: string; body?: unknown }[] = [];
  const request = jest.fn(async (path: string, options: { method?: string; body?: unknown } = {}) => {
    const method = options.method ?? 'GET';
    calls.push({ method, path, body: options.body });
    const hcRows = () => rows.filter((r) => r.source === 'health_connect');
    switch (`${method} ${path}`) {
      case 'GET /measurements/sources/health_connect':
        return {
          source: 'health_connect',
          connected: hcRows().length > 0,
          count: hcRows().length,
          last_measured_at: null,
          last_imported_at: importedAt,
        };
      case 'GET /measurements?days=30':
        return rows;
      case 'POST /measurements/import': {
        const items = (options.body as { items: { kind: string; value: number; measured_at: string }[] }).items;
        rows = [...rows, ...items.map((i) => ({ ...i, source: 'health_connect' }))];
        importedAt = '2026-11-13T09:00:00Z';
        return { source: 'health_connect', received: items.length, inserted: items.length, updated: 0, skipped_future: 0 };
      }
      case 'DELETE /measurements/sources/health_connect':
        rows = rows.filter((r) => r.source !== 'health_connect');
        return null;
      default:
        throw new Error(`fake server: unexpected ${method} ${path}`);
    }
  });
  return { calls, request: request as unknown as AuthContextValue['request'] };
}

beforeEach(() => {
  jest.clearAllMocks();
  void i18n.changeLanguage('en');
});

it('explains why it cannot connect in Expo Go, and touches nothing on the device', async () => {
  mocked.getAvailability.mockResolvedValue('needs_dev_build');
  const server = fakeServer();
  await render(<ConnectedData />, { wrapper: providers(server.request) });
  expect(await screen.findByTestId('hc-status')).toHaveTextContent(/development build/);
  expect(await screen.findByTestId('imported-none')).toBeTruthy();
  expect(screen.queryByTestId('hc-sync')).toBeNull();
  expect(mocked.grantedCount).not.toHaveBeenCalled();
});

it('asks for access, then syncs and shows the imported values with their source', async () => {
  mocked.getAvailability.mockResolvedValue('available');
  mocked.grantedCount.mockResolvedValueOnce(0).mockResolvedValue(3);
  mocked.requestAccess.mockResolvedValue(3);
  mocked.readRecent.mockResolvedValue([
    { kind: 'resting_hr_bpm', value: 58, measured_at: '2026-11-12T07:00:00Z', external_id: 'hr-1' },
    { kind: 'steps_daily', value: 8123, measured_at: '2026-11-12T00:00:00Z', external_id: 'steps:2026-11-12' },
  ]);
  const server = fakeServer();
  await render(<ConnectedData />, { wrapper: providers(server.request) });

  expect(await screen.findByTestId('hc-permissions')).toHaveTextContent('0 of 3 data types allowed');
  expect(screen.queryByTestId('hc-sync')).toBeNull(); // nothing to read without permission
  await fireEvent.press(screen.getByTestId('hc-allow'));
  await waitFor(() => expect(screen.getByTestId('hc-permissions')).toHaveTextContent(/3 of 3/));

  await fireEvent.press(screen.getByTestId('hc-sync'));
  expect(await screen.findByTestId('hc-message')).toHaveTextContent('Synced: 2 new, 0 updated.');
  expect(mocked.readRecent).toHaveBeenCalledWith(30);
  const post = server.calls.find((c) => c.method === 'POST');
  expect(post?.body).toMatchObject({ source: 'health_connect', items: expect.any(Array) });

  expect(await screen.findByTestId('latest-resting_hr_bpm')).toHaveTextContent(/58 bpm/);
  expect(screen.getByTestId('latest-steps_daily')).toHaveTextContent(/8,123 steps/);
  expect(screen.getAllByText('Source: Health Connect')).toHaveLength(2);
  expect(screen.queryByTestId('latest-weight_kg')).toBeNull(); // not imported, not shown
});

it('removes imported data only after confirmation', async () => {
  mocked.getAvailability.mockResolvedValue('available');
  mocked.grantedCount.mockResolvedValue(3);
  mocked.readRecent.mockResolvedValue([
    { kind: 'weight_kg', value: 70.5, measured_at: '2026-11-12T07:00:00Z', external_id: 'w-1' },
  ]);
  const server = fakeServer();
  await render(<ConnectedData />, { wrapper: providers(server.request) });
  await fireEvent.press(await screen.findByTestId('hc-sync'));
  await screen.findByTestId('latest-weight_kg');

  await fireEvent.press(screen.getByTestId('hc-remove'));
  expect(server.calls.some((c) => c.method === 'DELETE')).toBe(false);
  await fireEvent.press(screen.getByTestId('hc-remove-confirm'));
  expect(await screen.findByTestId('imported-message')).toHaveTextContent('Imported data removed.');
  expect(await screen.findByTestId('imported-none')).toBeTruthy();
});
