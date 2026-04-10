export interface Course {
  id: string;
  instructor_id: string;
  name: string;
  term: string | null;
  join_code: string;
  created_at: number;
  updated_at: number;
}

export interface Assignment {
  id: string;
  course_id: string;
  title: string;
  instructions: string | null;
  starter_r2_key: string;
  due_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface CourseDetail {
  course: Course;
  assignments: Assignment[];
  students: { student_id: string; joined_at: number }[];
  isInstructor: boolean;
}

export interface AssignmentDetail {
  assignment: Assignment;
  isInstructor: boolean;
}

export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  submitted_at: number;
  grade: number | null;
  feedback: string | null;
  graded_at: number | null;
  graded_by: string | null;
  course_id?: string;
  isInstructor?: boolean;
}

/** A row from GET /api/assignments/:id/submissions (LEFT JOIN over enrollments). */
export interface SubmissionListRow {
  student_id: string;
  submission_id: string | null;
  submitted_at: number | null;
  grade: number | null;
  feedback: string | null;
  graded_at: number | null;
  graded_by: string | null;
}

export interface CreateCourseInput {
  name: string;
  term?: string;
}

export interface CreateCourseResponse {
  id: string;
  joinCode: string;
  name: string;
  term: string | null;
}

export interface JoinCourseInput {
  code: string;
}

export interface JoinCourseResponse {
  courseId: string;
}

export interface CreateAssignmentInput {
  title: string;
  instructions?: string;
  starterCircuit: string; // output of serializeCircuit()
  due_at?: number | null;
}

export interface SubmitAssignmentResponse {
  id: string;
  submittedAt: number;
}

export interface SaveGradeInput {
  grade: number | null;
  feedback: string;
}
