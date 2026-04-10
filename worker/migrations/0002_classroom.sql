-- OmniSpice classroom schema (Phase 3)
-- Run via: pnpm exec wrangler d1 migrations apply omnispice-db --local
-- Per D-04..D-07, D-36 in .planning/phases/03-classroom-features/03-CONTEXT.md

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  instructor_id TEXT NOT NULL,
  name TEXT NOT NULL,
  term TEXT,
  join_code TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_courses_instructor_id ON courses(instructor_id);
CREATE INDEX IF NOT EXISTS idx_courses_join_code ON courses(join_code);

CREATE TABLE IF NOT EXISTS enrollments (
  course_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (course_id, student_id),
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON enrollments(student_id);

CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  title TEXT NOT NULL,
  instructions TEXT,
  starter_r2_key TEXT NOT NULL,
  due_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_assignments_course_id ON assignments(course_id);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  submitted_at INTEGER NOT NULL,
  grade INTEGER,
  feedback TEXT,
  graded_at INTEGER,
  graded_by TEXT,
  UNIQUE (assignment_id, student_id),
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment_id ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON submissions(student_id);
