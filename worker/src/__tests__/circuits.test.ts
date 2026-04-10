import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @hono/clerk-auth before importing the app
vi.mock('@hono/clerk-auth', () => ({
  clerkMiddleware: () => async (c: unknown, next: () => Promise<void>) => { await next(); },
  getAuth: vi.fn(),
}));

import { getAuth } from '@hono/clerk-auth';
import app from '../index';

// Mock D1 and R2 bindings
const mockD1 = {
  prepare: vi.fn().mockReturnValue({
    bind: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({ success: true }),
    first: vi.fn().mockResolvedValue(null),
    all: vi.fn().mockResolvedValue({ results: [] }),
  }),
};

const mockR2 = {
  put: vi.fn().mockResolvedValue(undefined),
  get: vi.fn().mockResolvedValue(null),
};

const makeEnv = () => ({
  DB: mockD1,
  CIRCUIT_BUCKET: mockR2,
  CLERK_PUBLISHABLE_KEY: 'pk_test',
  CLERK_SECRET_KEY: 'sk_test',
});

function makeRequest(method: string, path: string, body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('Worker routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock chain so each test gets fresh mock instances
    mockD1.prepare.mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true }),
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn().mockResolvedValue({ results: [] }),
    });
  });

  it('GET /api/circuits returns 401 when not authenticated', async () => {
    vi.mocked(getAuth).mockReturnValue(null as unknown as ReturnType<typeof getAuth>);
    const res = await app.fetch(makeRequest('GET', '/api/circuits'), makeEnv());
    expect(res.status).toBe(401);
  });

  it('GET /api/circuits returns 200 with array when authenticated', async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: 'user_123' } as ReturnType<typeof getAuth>);
    const res = await app.fetch(makeRequest('GET', '/api/circuits'), makeEnv());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it('POST /api/circuits returns 200 with id when authenticated', async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: 'user_123' } as ReturnType<typeof getAuth>);
    const res = await app.fetch(
      makeRequest('POST', '/api/circuits', { name: 'Test', circuit: '{}' }),
      makeEnv()
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { id: string };
    expect(typeof body.id).toBe('string');
  });

  it('POST /api/circuits/:id/share returns shareUrl', async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: 'user_123' } as ReturnType<typeof getAuth>);
    // Mock that the circuit exists and is owned by user_123
    mockD1.prepare.mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true }),
      first: vi.fn().mockResolvedValue({ id: 'test-id' }),
      all: vi.fn().mockResolvedValue({ results: [] }),
    });
    const res = await app.fetch(
      makeRequest('POST', '/api/circuits/test-id/share'),
      makeEnv()
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { shareUrl: string };
    expect(body.shareUrl).toContain('/share/');
  });

  it('GET /api/share/:token returns 404 for unknown token', async () => {
    const res = await app.fetch(
      makeRequest('GET', '/api/share/unknowntoken'),
      makeEnv()
    );
    expect(res.status).toBe(404);
  });
});
