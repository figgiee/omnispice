import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @hono/clerk-auth before importing the app
vi.mock('@hono/clerk-auth', () => ({
  clerkMiddleware: () => async (c: unknown, next: () => Promise<void>) => { await next(); },
  getAuth: vi.fn(),
}));

import { getAuth } from '@hono/clerk-auth';
import app from '../index';

// Mock D1 and R2 bindings
const createMockD1 = () => ({
  prepare: vi.fn().mockReturnValue({
    bind: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({ success: true }),
    first: vi.fn().mockResolvedValue(null),
    all: vi.fn().mockResolvedValue({ results: [] }),
  }),
});

const mockR2 = {
  put: vi.fn().mockResolvedValue(undefined),
  get: vi.fn().mockResolvedValue(null),
  delete: vi.fn().mockResolvedValue(undefined),
};

const makeEnv = () => ({
  DB: createMockD1(),
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

describe('Submissions router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test 1: GET /api/submissions/:id returns submission metadata
  it('GET /api/submissions/:id returns submission metadata (owner or instructor)', async () => {
    const submissionId = 'sub_1';
    const studentId = 'student_1';

    vi.mocked(getAuth).mockReturnValue({ userId: studentId } as ReturnType<typeof getAuth>);

    const mockDB = createMockD1();
    const env = makeEnv();
    env.DB = mockDB;

    mockDB.prepare.mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({
        id: submissionId,
        assignment_id: 'assign_1',
        student_id: studentId,
        r2_key: 'submissions/sub_1.json',
        submitted_at: 1000,
        grade: 85,
        feedback: 'Good work',
        graded_at: 2000,
        graded_by: 'instructor_1',
        course_id: 'course_1',
        instructor_id: 'instructor_1',
      }),
      run: vi.fn().mockResolvedValue({ success: true }),
      all: vi.fn().mockResolvedValue({ results: [] }),
    });

    const res = await app.fetch(
      makeRequest('GET', `/api/submissions/${submissionId}`),
      env
    );

    expect(res.status).toBe(200);
    const resBody = await res.json() as { grade: number };
    expect(resBody.grade).toBe(85);
  });

  // Test 2: GET /api/submissions/:id/circuit streams R2 blob
  it('GET /api/submissions/:id/circuit streams R2 blob (auth-checked)', async () => {
    const submissionId = 'sub_1';
    const studentId = 'student_1';

    vi.mocked(getAuth).mockReturnValue({ userId: studentId } as ReturnType<typeof getAuth>);

    const mockDB = createMockD1();
    const env = makeEnv();
    env.DB = mockDB;

    const circuitData = JSON.stringify({ components: [] });
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(circuitData);
        controller.close();
      },
    });

    mockDB.prepare.mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({
        id: submissionId,
        assignment_id: 'assign_1',
        student_id: studentId,
        r2_key: 'submissions/sub_1.json',
        submitted_at: 1000,
        grade: null,
        feedback: null,
        graded_at: null,
        graded_by: null,
        course_id: 'course_1',
        instructor_id: 'instructor_1',
      }),
      run: vi.fn().mockResolvedValue({ success: true }),
      all: vi.fn().mockResolvedValue({ results: [] }),
    });

    mockR2.get.mockResolvedValue({
      body: mockStream,
    });

    const res = await app.fetch(
      makeRequest('GET', `/api/submissions/${submissionId}/circuit`),
      env
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('private');
    expect(res.headers.get('Cache-Control')).toContain('max-age=0');
  });

  // Test 3: PATCH /api/submissions/:id/grade sets grade/feedback/graded_at/graded_by
  it('PATCH /api/submissions/:id/grade sets grade and metadata', async () => {
    const submissionId = 'sub_1';
    const instructorId = 'instructor_1';

    vi.mocked(getAuth).mockReturnValue({
      userId: instructorId,
      sessionClaims: { role: 'instructor' },
    } as ReturnType<typeof getAuth>);

    const mockDB = createMockD1();
    const env = makeEnv();
    env.DB = mockDB;

    mockDB.prepare.mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({
        id: submissionId,
        instructor_id: instructorId,
      }),
      run: vi.fn().mockResolvedValue({ success: true }),
      all: vi.fn().mockResolvedValue({ results: [] }),
    });

    const res = await app.fetch(
      makeRequest('PATCH', `/api/submissions/${submissionId}/grade`, {
        grade: 92,
        feedback: 'Excellent work!',
      }),
      env
    );

    expect(res.status).toBe(200);
    const resBody = await res.json() as { grade: number; feedback: string; graded_at: number };
    expect(resBody.grade).toBe(92);
    expect(resBody.feedback).toBe('Excellent work!');
    expect(resBody.graded_at).toBeDefined();

    // Verify UPDATE was called with all fields
    expect(mockDB.prepare).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE submissions SET')
    );
  });

  // Test 4: PATCH /api/submissions/:id/grade with invalid grade returns 400
  it('PATCH /api/submissions/:id/grade with grade outside 0-100 returns 400', async () => {
    const submissionId = 'sub_1';
    const instructorId = 'instructor_1';

    vi.mocked(getAuth).mockReturnValue({
      userId: instructorId,
      sessionClaims: { role: 'instructor' },
    } as ReturnType<typeof getAuth>);

    const res = await app.fetch(
      makeRequest('PATCH', `/api/submissions/${submissionId}/grade`, {
        grade: 150, // out of range
        feedback: 'Test',
      }),
      makeEnv()
    );

    expect(res.status).toBe(400);
    const resBody = await res.json() as { error: string };
    expect(resBody.error).toContain('0-100');
  });

  // Test 5: PATCH /api/submissions/:id/grade as non-owning instructor returns 403
  it('PATCH /api/submissions/:id/grade as non-owning instructor returns 403', async () => {
    const submissionId = 'sub_1';
    const instructorId = 'instructor_1';

    vi.mocked(getAuth).mockReturnValue({
      userId: instructorId,
      sessionClaims: { role: 'instructor' },
    } as ReturnType<typeof getAuth>);

    const mockDB = createMockD1();
    const env = makeEnv();
    env.DB = mockDB;

    mockDB.prepare.mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({
        id: submissionId,
        instructor_id: 'different_instructor', // different instructor
      }),
      run: vi.fn().mockResolvedValue({ success: true }),
      all: vi.fn().mockResolvedValue({ results: [] }),
    });

    const res = await app.fetch(
      makeRequest('PATCH', `/api/submissions/${submissionId}/grade`, {
        grade: 85,
        feedback: 'Test',
      }),
      env
    );

    expect(res.status).toBe(403);
  });

  // Test 6: PATCH /api/submissions/:id/grade with negative grade returns 400
  it('PATCH /api/submissions/:id/grade with negative grade returns 400', async () => {
    const submissionId = 'sub_1';
    const instructorId = 'instructor_1';

    vi.mocked(getAuth).mockReturnValue({
      userId: instructorId,
      sessionClaims: { role: 'instructor' },
    } as ReturnType<typeof getAuth>);

    const res = await app.fetch(
      makeRequest('PATCH', `/api/submissions/${submissionId}/grade`, {
        grade: -10,
        feedback: 'Test',
      }),
      makeEnv()
    );

    expect(res.status).toBe(400);
  });

  // Test 7: Feedback exceeding 2000 chars returns 400
  it('PATCH /api/submissions/:id/grade with feedback > 2000 chars returns 400', async () => {
    const submissionId = 'sub_1';
    const instructorId = 'instructor_1';

    vi.mocked(getAuth).mockReturnValue({
      userId: instructorId,
      sessionClaims: { role: 'instructor' },
    } as ReturnType<typeof getAuth>);

    const longFeedback = 'x'.repeat(2001);

    const res = await app.fetch(
      makeRequest('PATCH', `/api/submissions/${submissionId}/grade`, {
        grade: 85,
        feedback: longFeedback,
      }),
      makeEnv()
    );

    expect(res.status).toBe(400);
  });
});
