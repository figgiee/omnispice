/**
 * Test user credentials for classroom E2E scenarios.
 * These users must exist in the Clerk test instance with matching publicMetadata.role.
 * Populate via Clerk dashboard before running E2E suite.
 */
export const INSTRUCTOR_USER = {
  email: 'instructor+e2e@omnispice.test',
  password: 'Test-Instructor-2026!',
  role: 'instructor' as const,
};

export const STUDENT_USER = {
  email: 'student+e2e@omnispice.test',
  password: 'Test-Student-2026!',
  role: 'student' as const,
};
