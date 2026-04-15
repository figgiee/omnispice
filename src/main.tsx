import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthProvider } from './auth/AuthProvider';
import './styles/global.css';
import './canvas/components/pinStates.css';
import { generateNetlist } from './circuit/netlister';
import { useCircuitStore } from './store/circuitStore';
import { useUiStore } from './store/uiStore';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

// Expose stores + netlister on window for E2E specs (Playwright). Dev
// builds and the Phase 5 Playwright server both run in DEV mode, so the
// stores are available to specs without shipping anything to production.
if (import.meta.env.DEV) {
  const w = window as unknown as {
    useCircuitStore?: typeof useCircuitStore;
    useUiStore?: typeof useUiStore;
    __omnispiceGenerateNetlist?: typeof generateNetlist;
  };
  w.useCircuitStore = useCircuitStore;
  w.useUiStore = useUiStore;
  w.__omnispiceGenerateNetlist = generateNetlist;
}

createRoot(rootElement).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
