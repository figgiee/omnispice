import { Layout } from './app/Layout';
import { SharedCircuitViewer } from './components/share/SharedCircuitViewer';
import { useOverlaySync } from './overlay/useOverlaySync';
import { AssignmentPage } from './pages/AssignmentPage';
import { CoursePage } from './pages/CoursePage';
import { Dashboard } from './pages/Dashboard';
import { JoinCoursePage } from './pages/JoinCoursePage';
import { SubmissionViewer } from './pages/SubmissionViewer';

function App() {
  useOverlaySync();
  const path = window.location.pathname;

  // /share/:token — Phase 2
  const shareMatch = path.match(/^\/share\/([a-zA-Z0-9_-]+)\/?$/);
  if (shareMatch?.[1]) {
    return <SharedCircuitViewer token={shareMatch[1]} />;
  }

  // /join/:code — Phase 3 D-28 (uppercase normalized)
  const joinMatch = path.match(/^\/join\/([A-Za-z0-9]+)\/?$/);
  if (joinMatch?.[1]) {
    return <JoinCoursePage code={joinMatch[1].toUpperCase()} />;
  }

  // /dashboard
  if (path === '/dashboard' || path === '/dashboard/') {
    return <Dashboard />;
  }

  // /courses/:id
  const courseMatch = path.match(/^\/courses\/([a-zA-Z0-9-]+)\/?$/);
  if (courseMatch?.[1]) {
    return <CoursePage courseId={courseMatch[1]} />;
  }

  // /assignments/:id
  const assignmentMatch = path.match(/^\/assignments\/([a-zA-Z0-9-]+)\/?$/);
  if (assignmentMatch?.[1]) {
    return <AssignmentPage assignmentId={assignmentMatch[1]} />;
  }

  // /submissions/:id
  const submissionMatch = path.match(/^\/submissions\/([a-zA-Z0-9-]+)\/?$/);
  if (submissionMatch?.[1]) {
    return <SubmissionViewer submissionId={submissionMatch[1]} />;
  }

  return <Layout />;
}

export default App;
