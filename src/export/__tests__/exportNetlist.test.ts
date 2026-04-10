import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportNetlist } from '../exportNetlist';

const mockClick = vi.fn();

beforeEach(() => {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(document, 'createElement').mockImplementation((tag) => {
    if (tag === 'a') return { click: mockClick, href: '', download: '' } as unknown as HTMLAnchorElement;
    return document.createElement(tag);
  });
});

afterEach(() => { vi.restoreAllMocks(); });

describe('exportNetlist', () => {
  it('triggers download with a string containing .end', () => {
    // exportNetlist accepts a pre-built netlist string (wrapper pattern)
    exportNetlist('* test\n.op\n.end', 'test.cir');
    expect(mockClick).toHaveBeenCalled();
  });
});
