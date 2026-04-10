import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/auth/useCurrentUser';
import {
  listCourses,
  createCourse,
  getCourse,
  deleteCourse,
  joinCourse,
  createAssignment,
  getAssignment,
  updateAssignment,
  deleteAssignment,
  loadStarterCircuit,
  submitAssignment,
  listSubmissions,
  getMySubmission,
  getSubmission,
  loadSubmissionCircuit,
  saveGrade,
} from './classroomApi';
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
  SaveGradeInput,
} from './classroomTypes';

/** List the current user's courses (instructor: my courses; student: enrolled courses) */
export function useCourses() {
  const { getToken, isSignedIn } = useCurrentUser();
  return useQuery({
    queryKey: ['courses'],
    queryFn: () => listCourses(getToken),
    enabled: isSignedIn,
    staleTime: 30_000,
  });
}

/** Get a single course with assignments and students */
export function useCourse(id: string | null) {
  const { getToken, isSignedIn } = useCurrentUser();
  return useQuery({
    queryKey: ['course', id],
    queryFn: () => getCourse(id!, getToken),
    enabled: isSignedIn && !!id,
    staleTime: 30_000,
  });
}

/** Get assignment details */
export function useAssignment(id: string | null) {
  const { getToken, isSignedIn } = useCurrentUser();
  return useQuery({
    queryKey: ['assignment', id],
    queryFn: () => getAssignment(id!, getToken),
    enabled: isSignedIn && !!id,
    staleTime: 30_000,
  });
}

/** List all submissions for an assignment (instructor only) */
export function useSubmissions(assignmentId: string | null) {
  const { getToken, isSignedIn } = useCurrentUser();
  return useQuery({
    queryKey: ['assignment', assignmentId, 'submissions'],
    queryFn: () => listSubmissions(assignmentId!, getToken),
    enabled: isSignedIn && !!assignmentId,
    staleTime: 10_000,
  });
}

/** Get the current student's submission for an assignment */
export function useMySubmission(assignmentId: string | null) {
  const { getToken, isSignedIn } = useCurrentUser();
  return useQuery({
    queryKey: ['mySubmission', assignmentId],
    queryFn: () => getMySubmission(assignmentId!, getToken),
    enabled: isSignedIn && !!assignmentId,
    staleTime: 10_000,
  });
}

/** Get a single submission with circuit */
export function useSubmission(id: string | null) {
  const { getToken, isSignedIn } = useCurrentUser();
  return useQuery({
    queryKey: ['submission', id],
    queryFn: () => getSubmission(id!, getToken),
    enabled: isSignedIn && !!id,
    staleTime: 10_000,
  });
}

/** Create a new course */
export function useCreateCourse() {
  const { getToken } = useCurrentUser();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCourseInput) => createCourse(input, getToken),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
  });
}

/** Join a course via join code */
export function useJoinCourse() {
  const { getToken } = useCurrentUser();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: JoinCourseInput) => joinCourse(input, getToken),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
  });
}

/** Delete a course */
export function useDeleteCourse() {
  const { getToken } = useCurrentUser();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (courseId: string) => deleteCourse(courseId, getToken),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
  });
}

/** Create a new assignment */
export function useCreateAssignment() {
  const { getToken } = useCurrentUser();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, input }: { courseId: string; input: CreateAssignmentInput }) =>
      createAssignment(courseId, input, getToken),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
  });
}

/** Submit a student assignment (creates or updates submission) */
export function useSubmitAssignment() {
  const { getToken } = useCurrentUser();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assignmentId, circuitJson }: { assignmentId: string; circuitJson: string }) =>
      submitAssignment(assignmentId, circuitJson, getToken),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['mySubmission'] });
      void queryClient.invalidateQueries({ queryKey: ['assignment'] });
    },
  });
}

/** Save a grade for a submission (optimistic update per D-32) */
export function useSaveGrade() {
  const { getToken } = useCurrentUser();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ submissionId, input }: { submissionId: string; input: SaveGradeInput }) =>
      saveGrade(submissionId, input, getToken),
    onMutate: async ({ submissionId, input }) => {
      // Cancel any in-flight refetches
      await queryClient.cancelQueries({ queryKey: ['submission', submissionId] });

      // Snapshot the previous submission for rollback
      const previousSubmission = queryClient.getQueryData<Submission>([
        'submission',
        submissionId,
      ]);

      // Optimistically update the cache
      queryClient.setQueryData(['submission', submissionId], (old: Submission | undefined) => {
        if (!old) return old;
        return {
          ...old,
          grade: input.grade,
          feedback: input.feedback,
          graded_at: Date.now(),
        };
      });

      // Invalidate submissions list to refresh counts
      void queryClient.invalidateQueries({ queryKey: ['assignment', undefined, 'submissions'] });

      return { previousSubmission };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousSubmission) {
        queryClient.setQueryData(['submission', variables.submissionId], context.previousSubmission);
      }
    },
    onSuccess: () => {
      // Ensure fresh data
      void queryClient.invalidateQueries({ queryKey: ['submission'] });
    },
  });
}
