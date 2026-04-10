import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VectorData } from '@/simulation/protocol';

// Mock ResizeObserver (not available in jsdom)
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

// Mock uPlot since jsdom has no canvas
vi.mock('uplot', () => {
  function MockUPlot() {
    return {
      destroy: vi.fn(),
      setSize: vi.fn(),
      setSeries: vi.fn(),
      cursor: { idx: null },
    };
  }
  return { default: MockUPlot };
});

// Mock the CSS import
vi.mock('uplot/dist/uPlot.min.css', () => ({}));

// Mock simulation store with configurable results
const mockResults: VectorData[] = [];

vi.mock('@/store/simulationStore', () => ({
  useSimulationStore: (selector: (s: { results: VectorData[] }) => unknown) =>
    selector({ results: mockResults }),
}));

// Import after mocks
const { WaveformViewer } = await import('../WaveformViewer');

function setMockResults(results: VectorData[]) {
  mockResults.length = 0;
  mockResults.push(...results);
}

describe('WaveformViewer', () => {
  beforeEach(() => {
    setMockResults([]);
  });

  it('renders empty state message when no results', () => {
    render(<WaveformViewer />);

    expect(
      screen.getByText('No simulation data yet. Run a simulation to see waveforms here.'),
    ).toBeInTheDocument();
  });

  it('renders chart container when results are present', () => {
    setMockResults([
      {
        name: 'time',
        data: Float64Array.from([0, 0.001, 0.002]),
        unit: 's',
        isComplex: false,
      },
      {
        name: 'v(out)',
        data: Float64Array.from([0, 1, 0.5]),
        unit: 'V',
        isComplex: false,
      },
    ]);

    render(<WaveformViewer />);

    // Should not show empty state
    expect(
      screen.queryByText('No simulation data yet. Run a simulation to see waveforms here.'),
    ).not.toBeInTheDocument();

    // Chart container should be present
    expect(screen.getByTestId('waveform-chart')).toBeInTheDocument();
  });

  it('renders measurement buttons', () => {
    setMockResults([
      {
        name: 'time',
        data: Float64Array.from([0, 0.001, 0.002]),
        unit: 's',
        isComplex: false,
      },
      {
        name: 'v(out)',
        data: Float64Array.from([0, 1, 0.5]),
        unit: 'V',
        isComplex: false,
      },
    ]);

    render(<WaveformViewer />);

    expect(screen.getByTestId('measure-vpp')).toBeInTheDocument();
    expect(screen.getByTestId('measure-frequency')).toBeInTheDocument();
    expect(screen.getByTestId('measure-rms')).toBeInTheDocument();
    expect(screen.getByTestId('measure-riseTime')).toBeInTheDocument();

    expect(screen.getByText('Vpp')).toBeInTheDocument();
    expect(screen.getByText('Freq')).toBeInTheDocument();
    expect(screen.getByText('RMS')).toBeInTheDocument();
    expect(screen.getByText('Rise Time')).toBeInTheDocument();
  });

  it('renders legend items for each signal', () => {
    setMockResults([
      {
        name: 'time',
        data: Float64Array.from([0, 0.001, 0.002]),
        unit: 's',
        isComplex: false,
      },
      {
        name: 'v(out)',
        data: Float64Array.from([0, 1, 0.5]),
        unit: 'V',
        isComplex: false,
      },
      {
        name: 'v(in)',
        data: Float64Array.from([1, 1, 1]),
        unit: 'V',
        isComplex: false,
      },
    ]);

    render(<WaveformViewer />);

    const legend = screen.getByTestId('waveform-legend');
    expect(legend).toBeInTheDocument();
    expect(screen.getByTestId('legend-v(out)')).toBeInTheDocument();
    expect(screen.getByTestId('legend-v(in)')).toBeInTheDocument();
  });

  it('does not render legend for time axis vector', () => {
    setMockResults([
      {
        name: 'time',
        data: Float64Array.from([0, 0.001, 0.002]),
        unit: 's',
        isComplex: false,
      },
      {
        name: 'v(out)',
        data: Float64Array.from([0, 1, 0.5]),
        unit: 'V',
        isComplex: false,
      },
    ]);

    render(<WaveformViewer />);

    // Time axis should not appear in legend
    expect(screen.queryByTestId('legend-time')).not.toBeInTheDocument();
  });
});
