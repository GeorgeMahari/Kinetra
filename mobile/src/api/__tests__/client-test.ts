import { ApiError, apiRequest, getApiBaseUrl } from '../client';
import { toServerState } from '../health';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

describe('apiRequest', () => {
  it('returns parsed JSON on success and sends auth + language headers', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(200, { hello: 'world' }));
    const data = await apiRequest<{ hello: string }>('/x', { token: 'abc', language: 'ro', fetchImpl });
    expect(data).toEqual({ hello: 'world' });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`${getApiBaseUrl()}/x`);
    expect(init.headers).toMatchObject({ Authorization: 'Bearer abc', 'Accept-Language': 'ro' });
  });

  it('maps the backend error envelope to an ApiError with a stable code', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse(422, {
        error: { code: 'validation_error', message: 'bad', details: [{ field: 'email' }] },
      }),
    );
    await expect(apiRequest('/x', { fetchImpl })).rejects.toMatchObject({
      code: 'validation_error',
      status: 422,
      details: [{ field: 'email' }],
    });
  });

  it('reports network failures as network_error', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    const err = await apiRequest('/x', { fetchImpl }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('network_error');
  });

  it('accepts explicitly allowed non-2xx statuses', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(503, { status: 'degraded' }));
    await expect(apiRequest('/x', { fetchImpl, acceptStatuses: [503] })).resolves.toEqual({
      status: 'degraded',
    });
  });
});

describe('toServerState', () => {
  it('derives a UI state from the readiness probe', () => {
    expect(toServerState(undefined, false, true)).toBe('checking');
    expect(toServerState(undefined, true, false)).toBe('offline');
    expect(toServerState({ status: 'ok', database: 'ok', version: '0' }, false, false)).toBe('online');
    expect(toServerState({ status: 'degraded', database: 'unavailable', version: '0' }, false, false)).toBe(
      'degraded',
    );
  });
});

