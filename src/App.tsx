import { Layout } from './app/Layout';
import { SharedCircuitViewer } from './components/share/SharedCircuitViewer';
import { useOverlaySync } from './overlay/useOverlaySync';
import { AssignmentPage } from './pages/AssignmentPage';
import { CoursePage } from './pages/CoursePage';
import { Dashboard } from './pages/Dashboard';
import { DeepLinkPickerPage } from './pages/DeepLinkPickerPage';
import { JoinCoursePage } from './pages/JoinCoursePage';
import { LabEditorPage } from './pages/LabEditorPage';
import { LabLibraryPage } from './pages/LabLibraryPage';
import { LabRunnerPage } from './pages/LabRunnerPage';
import { LtiAdminPage } from './pages/LtiAdminPage';
import { LtiBootstrapPage } from './pages/LtiBootstrapPage';
import { ReportPreviewPage } from './pages/ReportPreviewPage';
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

  // /lti/bootstrap — Phase 4 LMS-01/LMS-02/LMS-03
  // Must match BEFORE /dashboard so LMS launches can't be shadowed.
  //
  // Flow:
  //   1. LMS POSTs to /lti/launch (worker) → worker redirects to
  //      /lti/bootstrap?ticket=...&mode=deeplink|resource&launch=...
  //   2. If `ticket` present → LtiBootstrapPage redeems the Clerk ticket.
  //      For mode=deeplink it then replaces history with
  //      /lti/bootstrap?mode=deeplink&launch=... (ticket stripped).
  //   3. Second render lands here with mode=deeplink and no ticket →
  //      DeepLinkPickerPage renders with a live Clerk session.
  //   4. For resource-link mode step 2 navigates away to target_link_uri.
  if (path === '/lti/bootstrap' || path === '/lti/bootstrap/') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'deeplink' && !params.get('ticket')) {
      return <DeepLinkPickerPage />;
    }
    return <LtiBootstrapPage />;
  }

  // /admin/lti — Phase 4 instructor-only LTI platform registry
  if (path === '/admin/lti' || path === '/admin/lti/') {
    return <LtiAdminPage />;
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

  // /labs — Phase 4 LAB-01 (lab library)
  if (path === '/labs' || path === '/labs/') {
    return <LabLibraryPage />;
  }

  // /labs/:id/edit — Phase 4 LAB-01 (instructor lab editor; `:id` may be `new`)
  const labEditMatch = path.match(/^\/labs\/([a-zA-Z0-9-]+)\/edit\/?$/);
  if (labEditMatch?.[1]) {
    return <LabEditorPage labId={labEditMatch[1]} />;
  }

  // /labs/:id/run — Phase 4 LAB-02 (student lab runner)
  const labRunMatch = path.match(/^\/labs\/([a-zA-Z0-9-]+)\/run\/?$/);
  if (labRunMatch?.[1]) {
    return <LabRunnerPage labId={labRunMatch[1]} />;
  }

  // /reports/:submissionId — Phase 4 RPT-01/RPT-02 (lab report export)
  const reportMatch = path.match(/^\/reports\/([a-zA-Z0-9_-]+)\/?$/);
  if (reportMatch?.[1]) {
    return <ReportPreviewPage submissionId={reportMatch[1]} />;
  }

  return <Layout />;
}

export default App;
