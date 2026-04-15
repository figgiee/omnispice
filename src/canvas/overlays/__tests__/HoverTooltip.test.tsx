/**
 * HoverTooltip — unit tests.
 *
 * Mounts <HoverTooltip/> directly (no React Flow) and simulates the
 * delegated `mouseover`/`mouseout` events on a fake `.react-flow__node`
 * element. Covers:
 *   - 300ms enter delay before showing
 *   - Ref designator + V/I/P rendering from overlayStore
 *   - Status line variants (live / computing / error / stale / not-run)
 *   - Hide after mouseout (100ms fade delay)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { HoverTooltip, HOVER_TOOLTIP_TEST_ID } from '../HoverTooltip';
import { useCircuitStore } from '@/store/circuitStore';
import { useOverlayStore } from '@/overlay/overlayStore';

/**
 * Helper: create a fake `.react-flow__node` DOM element with the given
 * data-id, append it to the document, and return it. React Flow always
 * sets `data-id` on its node wrappers so this faithfully mimics the real
 * DOM that HoverTooltip targets.
 */
function mountFakeNode(nodeId: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'react-flow__node';
  el.setAttribute('data-id', nodeId);
  // Stub getBoundingClientRect so the tooltip has coordinates to anchor to.
  el.getBoundingClientRect = () =>
    ({
      left: 10,
      top: 20,
      right: 60,
      bottom: 70,
      width: 50,
      height: 50,
      x: 10,
      y: 20,
      toJSON: () => ({}),
    }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

function fireMouseOver(target: Element) {
  target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
}

function fireMouseOut(target: Element, relatedTarget: Element | null = null) {
  const evt = new MouseEvent('mouseout', { bubbles: true });
  // jsdom doesn't let you pass relatedTarget via MouseEventInit reliably;
  // patch it after construction.
  Object.defineProperty(evt, 'relatedTarget', { value: relatedTarget });
  target.dispatchEvent(evt);
}

describe('HoverTooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useCircuitStore.getState().clearCircuit();
    useOverlayStore.getState().clear();
    useOverlayStore.getState().setSimStatus('not-run');
  });

  afterEach(() => {
    // Drain any pending timers the test component scheduled before the
    // store resets so the next test starts with a clean slate.
    try {
      vi.runOnlyPendingTimers();
    } catch {
      // ignore
    }
    vi.useRealTimers();
    cleanup();
    document.body.innerHTML = '';
  });

  it('does not render until a node has been hovered for 300ms', () => {
    render(<HoverTooltip />);
    const compId = useCircuitStore.getState().addComponent('resistor', { x: 0, y: 0 });
    const node = mountFakeNode(compId);

    // Initially hidden
    expect(screen.queryByTestId(HOVER_TOOLTIP_TEST_ID)).toBeNull();

    // Mouseover starts the 300ms timer — still hidden at 200ms
    act(() => {
      fireMouseOver(node);
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByTestId(HOVER_TOOLTIP_TEST_ID)).toBeNull();

    // Cross the 300ms threshold — now visible
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(screen.getByTestId(HOVER_TOOLTIP_TEST_ID)).toBeInTheDocument();
  });

  it('shows the component ref designator + V/I/P values from overlayStore', () => {
    render(<HoverTooltip />);
    const compId = useCircuitStore.getState().addComponent('resistor', { x: 0, y: 0 });
    const component = useCircuitStore.getState().circuit.components.get(compId);
    expect(component).toBeDefined();
    const refDesignator = component!.refDesignator;
    const firstPort = component!.ports[0]!;
    // Seed the first port with a net ID (normally set by computeNets)
    firstPort.netId = 'net_1';

    // Publish overlay data
    act(() => {
      useOverlayStore
        .getState()
        .setOverlay({ net_1: 3.3 }, { [refDesignator]: 0.002 }, {}, { net_1: 3.3 });
      useOverlayStore.getState().setSimStatus('live');
    });

    const node = mountFakeNode(compId);
    act(() => {
      fireMouseOver(node);
      vi.advanceTimersByTime(350);
    });

    const tip = screen.getByTestId(HOVER_TOOLTIP_TEST_ID);
    expect(tip).toBeInTheDocument();
    // Ref designator renders
    expect(tip.textContent).toContain(refDesignator);
    // V = 3.3V, I = 2 mA, P = V*I = 6.6 mW (rounded via formatValue)
    expect(tip.textContent).toMatch(/3\.30\s*V/);
    expect(tip.textContent).toMatch(/2\.00\s*mA/);
    expect(tip.textContent).toMatch(/6\.60\s*mW/);
  });

  it('renders the DC op: live status when overlay is live', () => {
    render(<HoverTooltip />);
    const compId = useCircuitStore.getState().addComponent('resistor', { x: 0, y: 0 });
    useOverlayStore.getState().setSimStatus('live');

    const node = mountFakeNode(compId);
    act(() => {
      fireMouseOver(node);
      vi.advanceTimersByTime(350);
    });

    expect(screen.getByTestId(HOVER_TOOLTIP_TEST_ID).textContent).toContain('DC op: live');
  });

  it('renders the DC op: no solution status when simStatus is error', () => {
    render(<HoverTooltip />);
    const compId = useCircuitStore.getState().addComponent('resistor', { x: 0, y: 0 });
    useOverlayStore.getState().setSimStatus('error');

    const node = mountFakeNode(compId);
    act(() => {
      fireMouseOver(node);
      vi.advanceTimersByTime(350);
    });

    expect(screen.getByTestId(HOVER_TOOLTIP_TEST_ID).textContent).toContain(
      'DC op: no solution',
    );
  });

  it('renders the Transient: last committed status when simStatus is stale', () => {
    render(<HoverTooltip />);
    const compId = useCircuitStore.getState().addComponent('resistor', { x: 0, y: 0 });
    useOverlayStore.getState().setSimStatus('stale');

    const node = mountFakeNode(compId);
    act(() => {
      fireMouseOver(node);
      vi.advanceTimersByTime(350);
    });

    expect(screen.getByTestId(HOVER_TOOLTIP_TEST_ID).textContent).toContain(
      'Transient: last committed',
    );
  });

  it('hides the tooltip after mouseout + fade delay', () => {
    render(<HoverTooltip />);
    const compId = useCircuitStore.getState().addComponent('resistor', { x: 0, y: 0 });
    useOverlayStore.getState().setSimStatus('live');
    const node = mountFakeNode(compId);

    act(() => {
      fireMouseOver(node);
      vi.advanceTimersByTime(350);
    });
    expect(screen.getByTestId(HOVER_TOOLTIP_TEST_ID)).toBeInTheDocument();

    act(() => {
      fireMouseOut(node, null);
      vi.advanceTimersByTime(150);
    });
    expect(screen.queryByTestId(HOVER_TOOLTIP_TEST_ID)).toBeNull();
  });

  it('does not show the tooltip if the mouse leaves before the 300ms delay', () => {
    render(<HoverTooltip />);
    const compId = useCircuitStore.getState().addComponent('resistor', { x: 0, y: 0 });
    const node = mountFakeNode(compId);

    act(() => {
      fireMouseOver(node);
      vi.advanceTimersByTime(100);
      fireMouseOut(node, null);
      vi.advanceTimersByTime(500);
    });

    expect(screen.queryByTestId(HOVER_TOOLTIP_TEST_ID)).toBeNull();
  });
});
