import { render } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import type { ComponentType } from '../../../circuit/types';
import { BjtNode } from '../BjtNode';
import { CapacitorNode } from '../CapacitorNode';
import { CurrentSourceNode } from '../CurrentSourceNode';
import { DiodeNode } from '../DiodeNode';
import { GroundNode } from '../GroundNode';
import { InductorNode } from '../InductorNode';
import { MosfetNode } from '../MosfetNode';
import { nodeTypes } from '../nodeTypes';
import { OpAmpNode } from '../OpAmpNode';
import { ResistorNode } from '../ResistorNode';
import { TransformerNode } from '../TransformerNode';
import { VoltageSourceNode } from '../VoltageSourceNode';

/**
 * Wrapper that provides ReactFlowProvider context needed by Handle components.
 */
function Wrapper({ children }: { children: React.ReactNode }) {
  return <ReactFlowProvider>{children}</ReactFlowProvider>;
}

/** Standard node props for testing. */
function makeNodeProps(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-node',
    type: 'resistor',
    data: {
      type: 'resistor' as ComponentType,
      refDesignator: 'R1',
      value: '10k',
      rotation: 0,
      ...overrides,
    },
    selected: false,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    zIndex: 0,
    dragging: false,
    dragHandle: undefined,
    parentId: undefined,
    sourcePosition: undefined,
    targetPosition: undefined,
    width: undefined,
    height: undefined,
    deletable: true,
    selectable: true,
    connectable: true,
    focusable: true,
  } as const;
}

describe('Circuit component nodes', () => {
  describe('ResistorNode', () => {
    it('renders an SVG with correct viewBox', () => {
      const { container } = render(
        <Wrapper>
          <ResistorNode {...(makeNodeProps() as any)} />
        </Wrapper>,
      );
      const svg = container.querySelector('svg');
      expect(svg).toBeTruthy();
      expect(svg?.getAttribute('viewBox')).toBe('0 0 60 24');
    });

    it('has 2 Handle components (pin1, pin2)', () => {
      const { container } = render(
        <Wrapper>
          <ResistorNode {...(makeNodeProps() as any)} />
        </Wrapper>,
      );
      const handles = container.querySelectorAll('.react-flow__handle');
      expect(handles.length).toBe(2);
    });

    it('shows the ref designator label', () => {
      const { container } = render(
        <Wrapper>
          <ResistorNode {...(makeNodeProps() as any)} />
        </Wrapper>,
      );
      expect(container.textContent).toContain('R1');
    });

    it('shows the value label', () => {
      const { container } = render(
        <Wrapper>
          <ResistorNode {...(makeNodeProps() as any)} />
        </Wrapper>,
      );
      expect(container.textContent).toContain('10k');
    });
  });

  describe('CapacitorNode', () => {
    it('renders without errors and has 2 handles', () => {
      const { container } = render(
        <Wrapper>
          <CapacitorNode
            {...(makeNodeProps({ type: 'capacitor', refDesignator: 'C1', value: '100n' }) as any)}
          />
        </Wrapper>,
      );
      const svg = container.querySelector('svg');
      expect(svg).toBeTruthy();
      expect(svg?.getAttribute('viewBox')).toBe('0 0 40 32');
      expect(container.querySelectorAll('.react-flow__handle').length).toBe(2);
    });
  });

  describe('InductorNode', () => {
    it('renders without errors and has 2 handles', () => {
      const { container } = render(
        <Wrapper>
          <InductorNode
            {...(makeNodeProps({ type: 'inductor', refDesignator: 'L1', value: '1m' }) as any)}
          />
        </Wrapper>,
      );
      const svg = container.querySelector('svg');
      expect(svg).toBeTruthy();
      expect(svg?.getAttribute('viewBox')).toBe('0 0 60 24');
      expect(container.querySelectorAll('.react-flow__handle').length).toBe(2);
    });
  });

  describe('DiodeNode', () => {
    it('renders standard diode with 2 handles', () => {
      const { container } = render(
        <Wrapper>
          <DiodeNode
            {...(makeNodeProps({ type: 'diode', refDesignator: 'D1', value: '1N4148' }) as any)}
          />
        </Wrapper>,
      );
      expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 40 32');
      expect(container.querySelectorAll('.react-flow__handle').length).toBe(2);
    });

    it('renders zener diode variant', () => {
      const { container } = render(
        <Wrapper>
          <DiodeNode
            {...(makeNodeProps({ type: 'zener_diode', refDesignator: 'D2', value: '5.1V' }) as any)}
          />
        </Wrapper>,
      );
      expect(container.querySelector('svg')).toBeTruthy();
    });

    it('renders schottky diode variant', () => {
      const { container } = render(
        <Wrapper>
          <DiodeNode
            {...(makeNodeProps({
              type: 'schottky_diode',
              refDesignator: 'D3',
              value: '1N5819',
            }) as any)}
          />
        </Wrapper>,
      );
      expect(container.querySelector('svg')).toBeTruthy();
    });
  });

  describe('BjtNode', () => {
    it('renders NPN BJT with 3 handles (base, collector, emitter)', () => {
      const { container } = render(
        <Wrapper>
          <BjtNode
            {...(makeNodeProps({ type: 'npn_bjt', refDesignator: 'Q1', value: '2N2222' }) as any)}
          />
        </Wrapper>,
      );
      expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 48 48');
      expect(container.querySelectorAll('.react-flow__handle').length).toBe(3);
    });

    it('renders PNP BJT variant', () => {
      const { container } = render(
        <Wrapper>
          <BjtNode
            {...(makeNodeProps({ type: 'pnp_bjt', refDesignator: 'Q2', value: '2N2907' }) as any)}
          />
        </Wrapper>,
      );
      expect(container.querySelector('svg')).toBeTruthy();
      expect(container.querySelectorAll('.react-flow__handle').length).toBe(3);
    });
  });

  describe('MosfetNode', () => {
    it('renders NMOS with 3 handles (gate, drain, source)', () => {
      const { container } = render(
        <Wrapper>
          <MosfetNode
            {...(makeNodeProps({ type: 'nmos', refDesignator: 'M1', value: 'NMOS' }) as any)}
          />
        </Wrapper>,
      );
      expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 48 48');
      expect(container.querySelectorAll('.react-flow__handle').length).toBe(3);
    });

    it('renders PMOS variant with inversion bubble', () => {
      const { container } = render(
        <Wrapper>
          <MosfetNode
            {...(makeNodeProps({ type: 'pmos', refDesignator: 'M2', value: 'PMOS' }) as any)}
          />
        </Wrapper>,
      );
      // PMOS should have a circle element for the inversion bubble
      const circles = container.querySelectorAll('svg circle');
      expect(circles.length).toBeGreaterThan(0);
    });
  });

  describe('OpAmpNode', () => {
    it('renders with 3 handles (non_inv, inv, output)', () => {
      const { container } = render(
        <Wrapper>
          <OpAmpNode
            {...(makeNodeProps({
              type: 'ideal_opamp',
              refDesignator: 'U1',
              value: 'Ideal',
            }) as any)}
          />
        </Wrapper>,
      );
      expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 56 48');
      expect(container.querySelectorAll('.react-flow__handle').length).toBe(3);
    });
  });

  describe('VoltageSourceNode', () => {
    it('renders with 2 handles (positive, negative)', () => {
      const { container } = render(
        <Wrapper>
          <VoltageSourceNode
            {...(makeNodeProps({ type: 'dc_voltage', refDesignator: 'V1', value: '5V' }) as any)}
          />
        </Wrapper>,
      );
      expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 36 36');
      expect(container.querySelectorAll('.react-flow__handle').length).toBe(2);
    });
  });

  describe('CurrentSourceNode', () => {
    it('renders with 2 handles (in, out)', () => {
      const { container } = render(
        <Wrapper>
          <CurrentSourceNode
            {...(makeNodeProps({ type: 'dc_current', refDesignator: 'I1', value: '1m' }) as any)}
          />
        </Wrapper>,
      );
      expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 36 36');
      expect(container.querySelectorAll('.react-flow__handle').length).toBe(2);
    });
  });

  describe('GroundNode', () => {
    it('renders with exactly 1 handle', () => {
      const { container } = render(
        <Wrapper>
          <GroundNode
            {...(makeNodeProps({ type: 'ground', refDesignator: 'GND', value: '' }) as any)}
          />
        </Wrapper>,
      );
      expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(container.querySelectorAll('.react-flow__handle').length).toBe(1);
    });
  });

  describe('TransformerNode', () => {
    it('renders with 4 handles (pri_plus, pri_minus, sec_plus, sec_minus)', () => {
      const { container } = render(
        <Wrapper>
          <TransformerNode
            {...(makeNodeProps({
              type: 'transformer',
              refDesignator: 'T1',
              value: '1:1',
            }) as any)}
          />
        </Wrapper>,
      );
      expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 60 48');
      expect(container.querySelectorAll('.react-flow__handle').length).toBe(4);
    });
  });
});

describe('nodeTypes registry', () => {
  const allComponentTypes: ComponentType[] = [
    'resistor',
    'capacitor',
    'inductor',
    'transformer',
    'diode',
    'zener_diode',
    'schottky_diode',
    'npn_bjt',
    'pnp_bjt',
    'nmos',
    'pmos',
    'ideal_opamp',
    'ua741',
    'lm741',
    'dc_voltage',
    'ac_voltage',
    'pulse_voltage',
    'sin_voltage',
    'pwl_voltage',
    'dc_current',
    'ac_current',
    'ground',
    // Phase 5 Pillar 1 — net label pseudo-component
    'net_label',
    // Phase 5 Pillar 1 Part 2 (Plan 05-03) — collapsed subcircuit block
    'subcircuit',
  ];

  it('has entries for all ComponentType values', () => {
    for (const ct of allComponentTypes) {
      expect(nodeTypes).toHaveProperty(ct);
      expect(typeof nodeTypes[ct]).toBe('function');
    }
  });

  it('has exactly 24 entries (22 real components + net label + subcircuit)', () => {
    expect(Object.keys(nodeTypes).length).toBe(24);
  });
});
