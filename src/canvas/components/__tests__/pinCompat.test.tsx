import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, cleanup } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { ResistorNode } from '../ResistorNode';
import { BjtNode } from '../BjtNode';
import { VoltageSourceNode } from '../VoltageSourceNode';
import { GroundNode } from '../GroundNode';
import { useWireDragStore } from '../../stores/wireDragStore';
import type { ComponentType } from '../../../circuit/types';

/**
 * Runtime tests for usePinClassName — make sure the wireDragStore actually
 * drives the className on rendered Handle elements.
 *
 * Approach: render a node, mutate the store via getState().start(),
 * re-read the container, assert the React Flow handle's className contains
 * the expected `pin-compat-*` or `pin-type-*` modifier.
 */
function Wrapper({ children }: { children: React.ReactNode }) {
  return <ReactFlowProvider>{children}</ReactFlowProvider>;
}

function makeNodeProps(type: ComponentType, id = 'test-node') {
  return {
    id,
    type,
    data: { type, refDesignator: 'X1', value: '', rotation: 0 },
    selected: false,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    zIndex: 0,
    dragging: false,
    deletable: true,
    selectable: true,
    connectable: true,
    focusable: true,
  } as const;
}

describe('usePinClassName + wireDragStore integration', () => {
  beforeEach(() => {
    // Reset store before every test
    useWireDragStore.getState().end();
    cleanup();
  });

  it('applies pin-type-signal class to resistor pins when idle', () => {
    const { container } = render(
      <Wrapper>
        <ResistorNode {...(makeNodeProps('resistor') as any)} />
      </Wrapper>,
    );
    const handles = container.querySelectorAll('.react-flow__handle');
    expect(handles.length).toBe(2);
    for (const handle of handles) {
      expect(handle.className).toContain('pin-type-signal');
      expect(handle.className).not.toContain('pin-compat-');
    }
  });

  it('applies pin-compat-error to resistor pins when a power drag is active', () => {
    const { container } = render(
      <Wrapper>
        <ResistorNode {...(makeNodeProps('resistor') as any)} />
      </Wrapper>,
    );

    act(() => {
      useWireDragStore.getState().start('other-source', 'power');
    });

    const handles = container.querySelectorAll('.react-flow__handle');
    for (const handle of handles) {
      // signal → power = error
      expect(handle.className).toContain('pin-compat-error');
    }
  });

  it('applies pin-compat-ok to resistor pins when another signal drag is active', () => {
    const { container } = render(
      <Wrapper>
        <ResistorNode {...(makeNodeProps('resistor') as any)} />
      </Wrapper>,
    );

    act(() => {
      useWireDragStore.getState().start('other-source', 'signal');
    });

    const handles = container.querySelectorAll('.react-flow__handle');
    for (const handle of handles) {
      expect(handle.className).toContain('pin-compat-ok');
    }
  });

  it('BJT collector pin shows pin-compat-neutral under a supply drag (locked D-01)', () => {
    const { container } = render(
      <Wrapper>
        <BjtNode {...(makeNodeProps('npn_bjt') as any)} />
      </Wrapper>,
    );

    act(() => {
      // Simulate dragging from a voltage-source + pin (supply)
      useWireDragStore.getState().start('v1:positive', 'supply');
    });

    const collectorHandle = container.querySelector(
      '.react-flow__handle[data-handleid="collector"]',
    );
    expect(collectorHandle).toBeTruthy();
    // signal → supply = neutral (not error) — this is the EE sanity case
    expect(collectorHandle?.className).toContain('pin-compat-neutral');
    expect(collectorHandle?.className).not.toContain('pin-compat-error');
  });

  it('voltage source positive pin shows pin-type-supply at rest', () => {
    const { container } = render(
      <Wrapper>
        <VoltageSourceNode {...(makeNodeProps('dc_voltage') as any)} />
      </Wrapper>,
    );
    const positive = container.querySelector(
      '.react-flow__handle[data-handleid="positive"]',
    );
    expect(positive?.className).toContain('pin-type-supply');
  });

  it('ground pin shows pin-type-ground at rest', () => {
    const { container } = render(
      <Wrapper>
        <GroundNode {...(makeNodeProps('ground') as any)} />
      </Wrapper>,
    );
    const gnd = container.querySelector('.react-flow__handle');
    expect(gnd?.className).toContain('pin-type-ground');
  });

  it('source pin itself does NOT get a compat class during drag', () => {
    const { container } = render(
      <Wrapper>
        <ResistorNode {...(makeNodeProps('resistor', 'r1') as any)} />
      </Wrapper>,
    );

    act(() => {
      // Drag starts from r1's pin1 — the composite id used in Canvas.tsx
      useWireDragStore.getState().start('r1:pin1', 'signal');
    });

    const sourceHandle = container.querySelector(
      '.react-flow__handle[data-handleid="pin1"]',
    );
    // Source pin keeps its base class, not a compat class
    expect(sourceHandle?.className).toContain('pin-type-signal');
    expect(sourceHandle?.className).not.toContain('pin-compat-');

    // Other pin still goes green (signal↔signal=ok)
    const otherHandle = container.querySelector(
      '.react-flow__handle[data-handleid="pin2"]',
    );
    expect(otherHandle?.className).toContain('pin-compat-ok');
  });

  it('store.end() clears all compat classes back to base', () => {
    const { container } = render(
      <Wrapper>
        <ResistorNode {...(makeNodeProps('resistor') as any)} />
      </Wrapper>,
    );

    act(() => {
      useWireDragStore.getState().start('other', 'power');
    });
    const handles = container.querySelectorAll('.react-flow__handle');
    expect(handles[0]?.className).toContain('pin-compat-error');

    act(() => {
      useWireDragStore.getState().end();
    });
    for (const handle of container.querySelectorAll('.react-flow__handle')) {
      expect(handle.className).toContain('pin-type-signal');
      expect(handle.className).not.toContain('pin-compat-');
    }
  });
});
