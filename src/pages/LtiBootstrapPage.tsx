import { LtiLaunchBootstrap } from '../lti/LtiLaunchBootstrap';

/**
 * Route-level wrapper for the LTI launch bootstrap component.
 *
 * The page is mounted at `/lti/bootstrap?ticket=...` and renders the
 * same minimal splash as <LtiLaunchBootstrap />. Kept as a separate file
 * so App.tsx route matching stays symmetrical with the other pages.
 */
export function LtiBootstrapPage() {
  return <LtiLaunchBootstrap />;
}
