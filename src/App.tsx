import { Layout } from './app/Layout';
import { SharedCircuitViewer } from './components/share/SharedCircuitViewer';
import { useOverlaySync } from './overlay/useOverlaySync';

function App() {
  useOverlaySync();

  // Route /share/:token to the read-only shared circuit viewer.
  // Cloudflare Pages _redirects ensures this path is served by index.html.
  const shareMatch = window.location.pathname.match(/^\/share\/([a-zA-Z0-9_-]+)$/);
  if (shareMatch?.[1]) {
    return <SharedCircuitViewer token={shareMatch[1]} />;
  }

  return <Layout />;
}

export default App;
