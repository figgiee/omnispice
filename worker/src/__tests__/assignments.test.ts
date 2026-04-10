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

describe('Assignments router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test 1: POST /api/courses/:id/assignments as owning instructor creates assignment + uploads starter
  it('POST /api/courses/:courseId/assignments creates assignment with starter in R2', async () => {
    const courseId = 'course_123';
    const instructorId = 'instructor_1';

    vi.mocked(getAuth).mockReturnValue({
      userId: instructorId,
      sessionClaims: { role: 'instructor' },
    } as ReturnType<typeof getAuth>);

    const mockDB = createMockD1();
    const env = makeEnv();
    env.DB = mockDB;

    // Mock course ownership check
    mockDB.prepare.mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true }),
      first: vi.fn().mockResolvedValue({ instructor_id: instructorId }),
      all: vi.fn().mockResolvedValue({ results: [] }),
    });

    const body = {
      title: 'Circuit Basics',
      instructions: 'Build a simple circuit',
      starterCircuit: JSON.stringify({ components: [] }),
      due_at: null,
    };

    const res = await app.fetch(
      makeRequest('POST', `/api/courses/${courseId}/assignments`, body),
      env
    );

    expect(res.status).toBe(200);
    const resBody = await res.json() as { id: string; title: string };
    expect(resBody.id).toBeDefined();
    expect(resBody.title).toBe('Circuit Basics');

    // Verify starter was put to R2
    expect(mockR2.put).toHaveBeenCalledWith(
      expect.stringMatching(/^assignments\/.*\/starter\.json$/),
      JSON.stringify({ components: [] }),
      expect.any(Object)
    );
  });

  // Test 2: POST /api/courses/:id/assignments as non-instructor returns 403
  it('POST /api/courses/:courseId/assignments as non-instructor returns 403', async () => {
    vi.mocked(getAuth).mockReturnValue({
      userId: 'student_1',
      sessionClaims: { role: 'student' },
    } as ReturnType<typeof getAuth>);

    const res = await app.fetch(
      makeRequest('POST', '/api/courses/course_123/assignments', { title: 'Test' }),
      makeEnv()
    );

    expect(res.status).toBe(403);
  });

  // Test 3: GET /api/assignments/:id returns assignment metadata
  it('GET /api/assignments/:id returns assignment metadata', async () => {
    const assignmentId = 'assign_1';
    const userId = 'user_1';

    vi.mocked(getAuth).mockReturnValue({ userId } as ReturnType<typeof getAuth>);

    const mockDB = createMockD1();
    const env = makeEnv();
    env.DB = mockDB;

    // Mock assignment + course join
    mockDB.prepare.mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true }),
      first: vi.fn().mockResolvedValue({
        id: assignmentId,
        title: 'Circuit Lab',
        course_id: 'course_1',
        instructor_id: 'instructor_1',
        starter_r2_key: 'assignments/assign_1/starter.json',
        due_at: null,
        created_at: 1000,
        updated_at: 1000,
      }),
      all: vi.fn().mockResolvedValue({ results: [] }),
    });

    const res = await app.fetch(
      makeRequest('GET', `/api/assignments/${assignmentId}`),
      env
    );

    expect(res.status).toBe(200);
    const resBody = await res.json();
    expect(resBody.assignment?.title).toBe('Circuit Lab');
  });

  // Test 4: GET /api/assignments/:id/starter streams R2 blob
  it('GET /api/assignments/:id/starter streams R2 blob', async () => {
    const assignmentId = 'assign_1';
    const userId = 'student_1';

    vi.mocked(getAuth).mockReturnValue({ userId } as ReturnType<typeof getAuth>);

    const mockDB = createMockD1();
    const env = makeEnv();
    env.DB = mockDB;

    const starterCircuit = JSON.stringify({ components: [], wires: [] });
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(starterCircuit);
        controller.close();
      },
    });

    // Mock assignment lookup + enrollment check
    mockDB.prepare.mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true }),
      first: vi.fn()
        .mockResolvedValueOnce({
          starter_r2_key: 'assignments/assign_1/starter.json',
          course_id: 'course_1',
          instructor_id: 'other_instructor',
        })
        .mockResolvedValueOnce({ 1: 1 }), // enrollment check
      all: vi.fn().mockResolvedValue({ results: [] }),
    });

    mockR2.get.mockResolvedValue({
      body: mockStream,
    });

    const res = await app.fetch(
      makeRequest('GET', `/api/assignments/${assignmentId}/starter`),
      env
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('private');
    expect(res.headers.get('Cache-Control')).toContain('max-age=0');
  });

  // Test 5: POST /api/assignments/:id/submit student upsert preserves id
  it('POST /api/assignments/:id/submit upserts submission preserving id', async () => {
    const assignmentId = 'assign_1';
    const studentId = 'student_1';

    vi.mocked(getAuth).mockReturnValue({ userId: studentId } as ReturnType<typeof getAuth>);

    const mockDB = createMockD1();
    const env = makeEnv();
    env.DB = mockDB;

    // Track prepare calls for different queries
    let queryCount = 0;
    mockDB.prepare.mockImplementation(() => {
      queryCount++;
      if (queryCount === 1) {
        // enrollment + assignment check
        return {
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue({
            assignment_id: assignmentId,
            course_id: 'course_1',
            enrolled: 1,
          }),
          run: vi.fn().mockResolvedValue({ success: true }),
          all: vi.fn().mockResolvedValue({ results: [] }),
        };
      } else if (queryCount === 2) {
        // existing submission check
        return {
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue({ id: 'submission_existing' }),
          run: vi.fn().mockResolvedValue({ success: true }),
          all: vi.fn().mockResolvedValue({ results: [] }),
        };
      }
      return {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ success: true }),
        all: vi.fn().mockResolvedValue({ results: [] }),
      };
    });

    const circuitJson = JSON.stringify({ components: [{ id: 'R1' }] });
    const res = await app.fetch(
      makeRequest('POST', `/api/assignments/${assignmentId}/submit`, { circuit: circuitJson }),
      env
    );

    expect(res.status).toBe(200);
    const resBody = await res.json() as { id: string };
    expect(resBody.id).toBe('submission_existing');

    // Verify upsert: should have inserted/updated with ON CONFLICT
    expect(mockDB.prepare).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT(assignment_id, student_id) DO UPDATE')
    );

    // Verify circuit was put to R2
    expect(mockR2.put).toHaveBeenCalledWith(
      expect.stringMatching(/^submissions\/.*\.json$/),
      circuitJson,
      expect.any(Object)
    );
  });

  // Test 6: POST /api/assignments/:id/submit non-enrolled returns 403
  it('POST /api/assignments/:id/submit as non-enrolled returns 403', async () => {
    const assignmentId = 'assign_1';
    const studentId = 'student_1';

    vi.mocked(getAuth).mockReturnValue({ userId: studentId } as ReturnType<typeof getAuth>);

    const mockDB = createMockD1();
    const env = makeEnv();
    env.DB = mockDB;

    mockDB.prepare.mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({
        assignment_id: assignmentId,
        course_id: 'course_1',
        enrolled: null, // not enrolled
      }),
      run: vi.fn().mockResolvedValue({ success: true }),
      all: vi.fn().mockResolvedValue({ results: [] }),
    });

    const res = await app.fetch(
      makeRequest('POST', `/api/assignments/${assignmentId}/submit`, { circuit: '{}' }),
      env
    );

    expect(res.status).toBe(403);
  });

  // Test 7: GET /api/assignments/:id/submissions returns LEFT JOIN with not-submitted
  it('GET /api/assignments/:id/submissions returns LEFT JOIN with not-submitted rows', async () => {
    const assignmentId = 'assign_1';
    const instructorId = 'instructor_1';

    vi.mocked(getAuth).mockReturnValue({
      userId: instructorId,
      sessionClaims: { role: 'instructor' },
    } as ReturnType<typeof getAuth>);

    const mockDB = createMockD1();
    const env = makeEnv();
    env.DB = mockDB;

    let queryCount = 0;
    mockDB.prepare.mockImplementation(() => {
      queryCount++;
      if (queryCount === 1) {
        // ownership check
        return {
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue({
            instructor_id: instructorId,
            course_id: 'course_1',
          }),
          run: vi.fn().mockResolvedValue({ success: true }),
          all: vi.fn().mockResolvedValue({ results: [] }),
        };
      }
      // LEFT JOIN results
      return {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ success: true }),
        all: vi.fn().mockResolvedValue({
          results: [
            { student_id: 'student_1', submission_id: 'sub_1', submitted_at: 1000, grade: 85, feedback: null, graded_at: null, graded_by: null },
            { student_id: 'student_2', submission_id: null, submitted_at: null, grade: null, feedback: null, graded_at: null, graded_by: null }, // not submitted
          ],
        }),
      };
    });

    const res = await app.fetch(
      makeRequest('GET', `/api/assignments/${assignmentId}/submissions`),
      env
    );

    expect(res.status).toBe(200);
    const resBody = await res.json() as unknown[];
    expect(resBody).toHaveLength(2);
    expect(resBody[0]).toHaveProperty('student_id', 'student_1');
    expect(resBody[1]).toHaveProperty('student_id', 'student_2');
    expect(resBody[1].submission_id).toBeNull();

    // Verify the LEFT JOIN query was used
    expect(mockDB.prepare).toHaveBeenCalledWith(
      expect.stringContaining('LEFT JOIN submissions')
    );
  });
});
