import { test, expect } from '@playwright/test';
import { INSTRUCTOR_USER, STUDENT_USER } from './fixtures/classroom-users';

test.describe('Phase 3 classroom E2E', () => {
  test.skip('CLASS-01: instructor creates course and shares join link', async ({ page }) => {
    // TODO(plan-07): implement after dashboard + course pages land
    expect(INSTRUCTOR_USER.role).toBe('instructor');
  });

  test.skip('CLASS-02: student joins course via /join/:code', async ({ page }) => {
    // TODO(plan-07): implement after JoinCoursePage lands
    expect(STUDENT_USER.role).toBe('student');
  });

  test.skip('CLASS-03: student opens assignment, modifies circuit, submits', async ({ page }) => {
    // TODO(plan-07): implement after AssignmentPage classroom mode lands
    expect(STUDENT_USER.role).toBe('student');
  });

  test.skip('CLASS-04: instructor sees all enrolled students in submission table', async ({ page }) => {
    // TODO(plan-07): implement after instructor submission table lands
    expect(INSTRUCTOR_USER.role).toBe('instructor');
  });

  test.skip('CLASS-05: instructor grades submission, student sees grade', async ({ page }) => {
    // TODO(plan-07): implement after SubmissionViewer + grading panel land
    expect(INSTRUCTOR_USER.role).toBe('instructor');
  });
});
