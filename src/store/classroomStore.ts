import { create } from 'zustand';

export type ClassroomMode = 'student' | 'instructor' | null;

interface ClassroomState {
  activeCourseId: string | null;
  activeAssignmentId: string | null;
  activeSubmissionId: string | null;
  classroomMode: ClassroomMode;
  isSubmitting: boolean;

  enterStudentMode: (assignmentId: string) => void;
  enterInstructorMode: (submissionId: string) => void;
  setActiveCourse: (courseId: string | null) => void;
  setSubmitting: (value: boolean) => void;
  exitClassroomMode: () => void;
}

/**
 * Classroom mode slice (D-30).
 * Holds only the currently-active classroom entity IDs and the mode flag.
 * List data (courses, assignments, submissions) lives in TanStack Query cache.
 */
export const useClassroomStore = create<ClassroomState>()((set) => ({
  activeCourseId: null,
  activeAssignmentId: null,
  activeSubmissionId: null,
  classroomMode: null,
  isSubmitting: false,

  enterStudentMode: (assignmentId) =>
    set({
      activeAssignmentId: assignmentId,
      classroomMode: 'student',
    }),
  enterInstructorMode: (submissionId) =>
    set({
      activeSubmissionId: submissionId,
      classroomMode: 'instructor',
    }),
  setActiveCourse: (courseId) => set({ activeCourseId: courseId }),
  setSubmitting: (value) => set({ isSubmitting: value }),
  exitClassroomMode: () =>
    set({
      activeCourseId: null,
      activeAssignmentId: null,
      activeSubmissionId: null,
      classroomMode: null,
      isSubmitting: false,
    }),
}));
