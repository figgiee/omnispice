import { describe, it, expect } from 'vitest';
import { useCourses, useCourse, useAssignment, useSubmissions, useMySubmission, useSubmission, useCreateCourse, useJoinCourse, useCreateAssignment, useSubmitAssignment, useSaveGrade } from './classroomHooks';

describe('classroom TanStack Query hooks', () => {
  it('exports all required hooks from the module', () => {
    expect(typeof useCourses).toBe('function');
    expect(typeof useCourse).toBe('function');
    expect(typeof useAssignment).toBe('function');
    expect(typeof useSubmissions).toBe('function');
    expect(typeof useMySubmission).toBe('function');
    expect(typeof useSubmission).toBe('function');
    expect(typeof useCreateCourse).toBe('function');
    expect(typeof useJoinCourse).toBe('function');
    expect(typeof useCreateAssignment).toBe('function');
    expect(typeof useSubmitAssignment).toBe('function');
    expect(typeof useSaveGrade).toBe('function');
  });
});
