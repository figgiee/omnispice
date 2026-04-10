import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VectorData } from '@/simulation/protocol';
import { exportWaveformAsCsv } from '../exportCsv';

// Mock DOM APIs used by download (not available in jsdom)
const mockClick = vi.fn();
const mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
const mockRevokeObjectURL = vi.fn();

beforeEach(() => {
  vi.spyOn(URL, 'createObjectURL').mockImplementation(mockCreateObjectURL);
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(mockRevokeObjectURL);
  vi.spyOn(document, 'createElement').mockImplementation((tag) => {
    if (tag === 'a')
      return { click: mockClick, href: '', download: '' } as unknown as HTMLAnchorElement;
    return document.createElement(tag);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('exportWaveformAsCsv', () => {
  const makeVectors = (): VectorData[] => [
    { name: 'time', data: new Float64Array([0, 0.001, 0.002]), unit: 's', isComplex: false },
    { name: 'v(out)', data: new Float64Array([0, 2.5, 5.0]), unit: 'V', isComplex: false },
  ];

  it('produces header row with vector names', async () => {
    const blobs: Blob[] = [];
    // Intercept Blob construction to capture the CSV content
    vi.stubGlobal(
      'Blob',
      class MockBlob extends Blob {
        constructor(parts?: BlobPart[], options?: BlobPropertyBag) {
          super(parts, options);
          blobs.push(this);
        }
      },
    );

    exportWaveformAsCsv(makeVectors(), 'test.csv');
    vi.unstubAllGlobals();

    expect(blobs).toHaveLength(1);
    const csv = (await blobs[0]?.text()) ?? '';
    const lines = csv.split('\n');
    expect(lines[0]).toBe('time,v(out)');
    expect(lines).toHaveLength(4); // 1 header + 3 data rows
  });

  it('does not throw on empty vector array', () => {
    expect(() => exportWaveformAsCsv([], 'empty.csv')).not.toThrow();
  });

  it('triggers a download click', () => {
    exportWaveformAsCsv(makeVectors(), 'test.csv');
    expect(mockClick).toHaveBeenCalled();
  });
});
