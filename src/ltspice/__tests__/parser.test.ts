import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseAsc } from '../parser';

const rcFixture = readFileSync(
  resolve(__dirname, 'fixtures/rc-circuit.asc'),
  'utf-8'
);

describe('parseAsc', () => {
  it('parses 3 symbols from RC fixture', () => {
    const result = parseAsc(rcFixture);
    expect(result.symbols).toHaveLength(3);
  });

  it('parses at least 2 wires from RC fixture', () => {
    const result = parseAsc(rcFixture);
    expect(result.wires.length).toBeGreaterThanOrEqual(2);
  });

  it('parses 2 FLAG lines as flags', () => {
    const result = parseAsc(rcFixture);
    expect(result.flags).toHaveLength(2);
    expect(result.flags.every((f) => f.netName === '0')).toBe(true);
  });

  it('reads SYMATTR InstName and Value correctly', () => {
    const result = parseAsc(rcFixture);
    const r1 = result.symbols.find((s) => s.instName === 'R1');
    expect(r1).toBeDefined();
    expect(r1?.value).toBe('10k');
    expect(r1?.name).toBe('res');
  });

  it('extracts TEXT "!.op" as directive without the "!"', () => {
    const result = parseAsc(rcFixture);
    expect(result.directives).toContain('.op');
  });

  it('does not crash on empty input', () => {
    expect(() => parseAsc('')).not.toThrow();
    expect(parseAsc('').symbols).toHaveLength(0);
  });

  it('handles Windows line endings', () => {
    const crlf = rcFixture.replace(/\n/g, '\r\n');
    const result = parseAsc(crlf);
    expect(result.symbols).toHaveLength(3);
  });
});
