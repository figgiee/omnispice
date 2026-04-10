import type {
  Course,
  CourseDetail,
  AssignmentDetail,
  Submission,
  SubmissionListRow,
  CreateCourseInput,
  CreateCourseResponse,
  JoinCourseInput,
  JoinCourseResponse,
  CreateAssignmentInput,
  SubmitAssignmentResponse,
  SaveGradeInput,
} from './classroomTypes';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8787';

async function authedFetch(
  path: string,
  options: RequestInit,
  getToken: () => Promise<string | null>,
): Promise<Response> {
  const token = await getToken();
  const headers = new Headers((options.headers as HeadersInit | undefined) ?? {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${options.method ?? 'GET'} ${path} → ${res.status}: ${body}`);
  }
  return res;
}

type TokenFn = () => Promise<string | null>;

export async function listCourses(getToken: TokenFn): Promise<Course[]> {
  const res = await authedFetch('/api/courses', { method: 'GET' }, getToken);
  return res.json() as Promise<Course[]>;
}

export async function createCourse(
  input: CreateCourseInput,
  getToken: TokenFn,
): Promise<CreateCourseResponse> {
  const res = await authedFetch(
    '/api/courses',
    { method: 'POST', body: JSON.stringify(input) },
    getToken,
  );
  return res.json() as Promise<CreateCourseResponse>;
}

export async function getCourse(courseId: string, getToken: TokenFn): Promise<CourseDetail> {
  const res = await authedFetch(`/api/courses/${courseId}`, { method: 'GET' }, getToken);
  return res.json() as Promise<CourseDetail>;
}

export async function deleteCourse(courseId: string, getToken: TokenFn): Promise<void> {
  await authedFetch(`/api/courses/${courseId}`, { method: 'DELETE' }, getToken);
}

export async function joinCourse(
  input: JoinCourseInput,
  getToken: TokenFn,
): Promise<JoinCourseResponse> {
  const res = await authedFetch(
    '/api/courses/join',
    {
      method: 'POST',
      body: JSON.stringify({ code: input.code.trim().toUpperCase() }),
    },
    getToken,
  );
  return res.json() as Promise<JoinCourseResponse>;
}

export async function createAssignment(
  courseId: string,
  input: CreateAssignmentInput,
  getToken: TokenFn,
): Promise<{ id: string; title: string }> {
  const res = await authedFetch(
    `/api/courses/${courseId}/assignments`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
    getToken,
  );
  return res.json() as Promise<{ id: string; title: string }>;
}

export async function getAssignment(
  assignmentId: string,
  getToken: TokenFn,
): Promise<AssignmentDetail> {
  const res = await authedFetch(
    `/api/assignments/${assignmentId}`,
    { method: 'GET' },
    getToken,
  );
  return res.json() as Promise<AssignmentDetail>;
}

export async function updateAssignment(
  assignmentId: string,
  input: Partial<CreateAssignmentInput>,
  getToken: TokenFn,
): Promise<void> {
  await authedFetch(
    `/api/assignments/${assignmentId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
    getToken,
  );
}

export async function deleteAssignment(assignmentId: string, getToken: TokenFn): Promise<void> {
  await authedFetch(`/api/assignments/${assignmentId}`, { method: 'DELETE' }, getToken);
}

export async function loadStarterCircuit(
  assignmentId: string,
  getToken: TokenFn,
): Promise<string> {
  const res = await authedFetch(
    `/api/assignments/${assignmentId}/starter`,
    { method: 'GET' },
    getToken,
  );
  return res.text();
}

export async function submitAssignment(
  assignmentId: string,
  circuitJson: string,
  getToken: TokenFn,
): Promise<SubmitAssignmentResponse> {
  const res = await authedFetch(
    `/api/assignments/${assignmentId}/submit`,
    {
      method: 'POST',
      body: JSON.stringify({ circuit: circuitJson }),
    },
    getToken,
  );
  return res.json() as Promise<SubmitAssignmentResponse>;
}

export async function listSubmissions(
  assignmentId: string,
  getToken: TokenFn,
): Promise<SubmissionListRow[]> {
  const res = await authedFetch(
    `/api/assignments/${assignmentId}/submissions`,
    { method: 'GET' },
    getToken,
  );
  return res.json() as Promise<SubmissionListRow[]>;
}

export async function getMySubmission(
  assignmentId: string,
  getToken: TokenFn,
): Promise<Submission | null> {
  const res = await authedFetch(
    `/api/assignments/${assignmentId}/my-submission`,
    { method: 'GET' },
    getToken,
  );
  return res.json() as Promise<Submission | null>;
}

export async function getSubmission(submissionId: string, getToken: TokenFn): Promise<Submission> {
  const res = await authedFetch(`/api/submissions/${submissionId}`, { method: 'GET' }, getToken);
  return res.json() as Promise<Submission>;
}

export async function loadSubmissionCircuit(
  submissionId: string,
  getToken: TokenFn,
): Promise<string> {
  const res = await authedFetch(
    `/api/submissions/${submissionId}/circuit`,
    { method: 'GET' },
    getToken,
  );
  return res.text();
}

export async function saveGrade(
  submissionId: string,
  input: SaveGradeInput,
  getToken: TokenFn,
): Promise<Submission> {
  const res = await authedFetch(
    `/api/submissions/${submissionId}/grade`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
    getToken,
  );
  return res.json() as Promise<Submission>;
}
