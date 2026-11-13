import '@/i18n';

import { act, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import i18n from '@/i18n';

import { AuthProvider, useAuth, type AuthContextValue } from '../AuthProvider';
import type { TokenStorage } from '../tokenStorage';

const ME = {
  id: 'u1',
  email: 'ana@example.com',
  preferred_locale: 'ro',
  created_at: '2026-11-12T10:00:00Z',
  profile: { display_name: 'Ana', date_of_birth: '1995-06-15', age: 31, sex_for_norms: 'not_specified', height_cm: null },
};

function json(status: number, body: unknown) {
  return Promise.resolve({ ok: status < 300, status, json: () => Promise.resolve(body) } as Response);
}

function memoryStorage(initial: string | null = null): TokenStorage & { value: string | null } {
  return {
    value: initial,
    async get() {
      return this.value;
    },
    async set(v) {
      this.value = v;
    },
    async clear() {
      this.value = null;
    },
  };
}

let ctx: AuthContextValue;
function Probe() {
  // Test-only probe: exposes the latest context value to the test body.
  // eslint-disable-next-line react-hooks/globals
  ctx = useAuth();
  return <Text testID="status">{ctx.status}</Text>;
}

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return i18n.changeLanguage('en');
});

function route(handlers: Record<string, () => Promise<Response>>) {
  fetchMock.mockImplementation((url: string, init: RequestInit) => {
    const key = `${init.method} ${url.replace(/^.*\/api\/v1/, '')}`;
    const h = handlers[key];
    if (!h) throw new Error(`unexpected request ${key}`);
    return h();
  });
}

describe('AuthProvider', () => {
  it('starts signed out when no session is stored', async () => {
    await render(
      <AuthProvider storage={memoryStorage()}>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status').props.children).toBe('signedOut'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('restores a stored session, rotates the refresh token and applies the account language', async () => {
    const storage = memoryStorage('old-refresh');
    route({
      'POST /auth/refresh': () => json(200, { access_token: 'a1', refresh_token: 'new-refresh', expires_in: 900 }),
      'GET /me': () => json(200, ME),
    });
    await render(
      <AuthProvider storage={storage}>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status').props.children).toBe('signedIn'));
    expect(storage.value).toBe('new-refresh');
    expect(ctx.user?.email).toBe('ana@example.com');
    expect(i18n.resolvedLanguage).toBe('ro');
  });

  it('renews an expired access token once and retries the request', async () => {
    const storage = memoryStorage('r0');
    let meCalls = 0;
    let refreshCalls = 0;
    route({
      'POST /auth/refresh': () => {
        refreshCalls += 1;
        return json(200, { access_token: `a${refreshCalls}`, refresh_token: `r${refreshCalls}`, expires_in: 900 });
      },
      'GET /me': () => {
        meCalls += 1;
        // Second call simulates an access token that expired while the app was open.
        return meCalls === 2 ? json(401, { error: { code: 'unauthorized' } }) : json(200, ME);
      },
    });
    await render(
      <AuthProvider storage={storage}>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status').props.children).toBe('signedIn'));

    await act(async () => {
      await ctx.request('/me');
    });
    expect(refreshCalls).toBe(2);
    expect(meCalls).toBe(3);
    expect(storage.value).toBe('r2');
    expect(screen.getByTestId('status').props.children).toBe('signedIn');
  });

  it('signs out and flags the expiry when the session cannot be renewed', async () => {
    const storage = memoryStorage('r0');
    let refreshCalls = 0;
    route({
      'POST /auth/refresh': () => {
        refreshCalls += 1;
        return refreshCalls === 1
          ? json(200, { access_token: 'a1', refresh_token: 'r1', expires_in: 900 })
          : json(401, { error: { code: 'invalid_refresh_token' } });
      },
      'GET /me': () => (refreshCalls === 1 ? json(200, ME) : json(401, { error: { code: 'unauthorized' } })),
    });
    await render(
      <AuthProvider storage={storage}>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status').props.children).toBe('signedIn'));

    // Simulate the access token expiring.
    fetchMock.mockClear();
    route({
      'POST /auth/refresh': () => json(401, { error: { code: 'invalid_refresh_token' } }),
      'GET /me': () => json(401, { error: { code: 'unauthorized' } }),
    });
    await act(async () => {
      await ctx.request('/me').catch(() => undefined);
    });
    expect(screen.getByTestId('status').props.children).toBe('signedOut');
    expect(ctx.sessionExpired).toBe(true);
    expect(storage.value).toBeNull();
  });

  it('keeps the stored session when the server is unreachable at launch', async () => {
    const storage = memoryStorage('r0');
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    await render(
      <AuthProvider storage={storage}>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status').props.children).toBe('signedOut'));
    expect(storage.value).toBe('r0');
  });

  it('sign-out revokes the session on the server and forgets it locally', async () => {
    const storage = memoryStorage('r0');
    const calls: string[] = [];
    route({
      'POST /auth/refresh': () => json(200, { access_token: 'a1', refresh_token: 'r1', expires_in: 900 }),
      'GET /me': () => json(200, ME),
      'POST /auth/logout': () => {
        calls.push('logout');
        return Promise.resolve({ ok: true, status: 204, json: () => Promise.resolve(null) } as Response);
      },
    });
    await render(
      <AuthProvider storage={storage}>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status').props.children).toBe('signedIn'));
    await act(async () => {
      await ctx.signOut();
    });
    expect(calls).toEqual(['logout']);
    expect(storage.value).toBeNull();
    expect(screen.getByTestId('status').props.children).toBe('signedOut');
    expect(ctx.sessionExpired).toBe(false);
  });
});
