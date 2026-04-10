import { describe, it, expect, beforeEach } from 'vitest';
import { useClassroomStore } from './classroomStore';

describe('classroomStore', () => {
  beforeEach(() => {
    useClassroomStore.setState({
      activeCourseId: null,
      activeAssignmentId: null,
      activeSubmissionId: null,
      classroomMode: null,
      isSubmitting: false,
    });
  });

  it('starts with null active ids and no classroom mode', () => {
    const state = useClassroomStore.getState();
    expect(state.activeCourseId).toBeNull();
    expect(state.activeAssignmentId).toBeNull();
    expect(state.classroomMode).toBeNull();
  });

  it('enterStudentMode sets activeAssignmentId and classroomMode=student', () => {
    useClassroomStore.getState().enterStudentMode('a1');
    const state = useClassroomStore.getState();
    expect(state.activeAssignmentId).toBe('a1');
    expect(state.classroomMode).toBe('student');
  });

  it('exitClassroomMode clears all active ids', () => {
    useClassroomStore.getState().enterStudentMode('a1');
    useClassroomStore.getState().exitClassroomMode();
    const state = useClassroomStore.getState();
    expect(state.classroomMode).toBeNull();
    expect(state.activeAssignmentId).toBeNull();
  });

  it('setSubmitting toggles isSubmitting flag', () => {
    useClassroomStore.getState().setSubmitting(true);
    expect(useClassroomStore.getState().isSubmitting).toBe(true);
  });
});
