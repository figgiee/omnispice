import { expect, test } from '@playwright/test';
import { INSTRUCTOR_USER, STUDENT_USER } from './fixtures/classroom-users';

test.describe('Phase 3 classroom E2E — smoke', () => {
  test('CLASS-01 fixtures: instructor test user is configured', async () => {
    expect(INSTRUCTOR_USER.email).toContain('@');
    expect(INSTRUCTOR_USER.role).toBe('instructor');
  });

  test('CLASS-02 fixtures: student test user is configured', async () => {
    expect(STUDENT_USER.email).toContain('@');
    expect(STUDENT_USER.role).toBe('student');
  });

  test('CLASS-01: dashboard renders at /dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    // Unauthenticated landing page should render the "Sign in" prompt or course view
    await expect(
      page.locator('text=/Sign in to see your classroom|My Courses|Enrolled Courses/i'),
    ).toBeVisible({ timeout: 10000 });
  });

  test('CLASS-02: /join/:code route renders JoinCoursePage', async ({ page }) => {
    await page.goto('/join/ABCD23');
    // Either sign-in prompt (unauthenticated) or "Joining course" state
    await expect(page.locator('text=/Join a course|Joining course|Join Course/i')).toBeVisible({
      timeout: 10000,
    });
  });

  test.skip('CLASS-03: student submits assignment end-to-end', async ({ page }) => {
    // TODO(verify-work): authenticate as STUDENT_USER, navigate to an assignment,
    // modify the circuit, click Submit, assert confirmation toast appears.
    // Requires live Clerk test instance + seeded course.
  });

  test.skip('CLASS-04: instructor sees submission table with all enrolled students', async ({
    page,
  }) => {
    // TODO(verify-work): authenticate as INSTRUCTOR_USER, open assignment,
    // assert page.locator('[data-testid="submission-table"]') exists.
  });

  test.skip('CLASS-05: instructor grades submission, student sees grade on reload', async ({
    page,
  }) => {
    // TODO(verify-work): authenticate as INSTRUCTOR_USER, open /submissions/:id,
    // fill grade input, click save, reload as STUDENT_USER and assert grade visible.
  });
});
