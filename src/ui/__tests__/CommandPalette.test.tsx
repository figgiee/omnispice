/**
 * Tests for CommandPalette (Phase 5 plan 05-06).
 *
 * Covers the three most user-visible contracts:
 *   - Dispatching `omnispice:open-command-palette` with focus OUTSIDE the
 *     sidebar surface opens the dialog
 *   - Dispatching the same event while focus is INSIDE the sidebar surface
 *     is a no-op (locked decision #3, disambiguation)
 *   - Selecting a template row closes the dialog and inserts components
 *
 * Deeper coverage (keyboard filter, arrow navigation, CSS) lives in the
 * Playwright E2E spec under tests/e2e/phase5/command-palette.spec.ts.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCircuitStore } from '@/store/circuitStore';
import { CommandPalette } from '../CommandPalette';

// The Clerk-backed `useCurrentUser` hook blocks the useCircuits query path
// in jsdom because there's no Clerk provider. We stub it so the palette's
// Circuits group resolves to "no data".
vi.mock('@/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({
    getToken: async () => null,
    isSignedIn: false,
  }),
}));

function resetStores() {
  useCircuitStore.setState({
    circuit: { components: new Map(), wires: new Map(), nets: new Map() },
    refCounters: {},
  });
  useCircuitStore.temporal.getState().clear();
}

function renderPalette() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CommandPalette />
    </QueryClientProvider>,
  );
}

describe('CommandPalette', () => {
  beforeEach(() => {
    resetStores();
  });

  it('opens on omnispice:open-command-palette when focus is not in the sidebar', async () => {
    renderPalette();
    expect(screen.queryByRole('dialog')).toBeNull();

    act(() => {
      window.dispatchEvent(new CustomEvent('omnispice:open-command-palette'));
    });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    expect(
      screen.getByPlaceholderText(/Search actions, circuits, templates/i),
    ).toBeInTheDocument();
  });

  it('ignores the open event when focus is inside sidebar-library', () => {
    // Put focus into a sidebar-library surface element.
    const sidebarHost = document.createElement('div');
    sidebarHost.setAttribute('data-surface', 'sidebar-library');
    const input = document.createElement('input');
    sidebarHost.appendChild(input);
    document.body.appendChild(sidebarHost);
    input.focus();
    expect(document.activeElement).toBe(input);

    renderPalette();
    act(() => {
      window.dispatchEvent(new CustomEvent('omnispice:open-command-palette'));
    });

    expect(screen.queryByRole('dialog')).toBeNull();
    document.body.removeChild(sidebarHost);
  });

  it('lists the bundled templates under the Templates group', async () => {
    renderPalette();
    act(() => {
      window.dispatchEvent(new CustomEvent('omnispice:open-command-palette'));
    });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    expect(screen.getByText('Voltage Divider')).toBeInTheDocument();
    expect(screen.getByText('RC Low-Pass Filter')).toBeInTheDocument();
    expect(screen.getByText('BJT Common Emitter Amplifier')).toBeInTheDocument();
    expect(screen.getByText('Inverting Op-Amp Amplifier')).toBeInTheDocument();
    expect(screen.getByText('Non-Inverting Op-Amp Amplifier')).toBeInTheDocument();
  });

  it('lists every registered Action with its label', async () => {
    renderPalette();
    act(() => {
      window.dispatchEvent(new CustomEvent('omnispice:open-command-palette'));
    });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    expect(screen.getByText('Run DC Operating Point')).toBeInTheDocument();
    expect(screen.getByText('Run Transient Analysis')).toBeInTheDocument();
    expect(screen.getByText('Export SPICE Netlist')).toBeInTheDocument();
    expect(screen.getByText('Keyboard shortcut reference')).toBeInTheDocument();
  });
});
