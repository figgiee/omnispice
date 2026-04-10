/**
 * LTspice .asc file parser.
 *
 * Converts raw .asc text to an AscCircuit intermediate representation.
 *
 * Handles: VERSION, SHEET, WIRE, FLAG, SYMBOL, SYMATTR (InstName, Value, SpiceModel), TEXT
 * Skips: WINDOW, IOPIN, and all other keywords
 *
 * Known limitation: does not parse all LTspice symbol names — only those in the
 * SYMBOL_MAP in mapper.ts. Unknown symbols are included in AscCircuit.symbols
 * with their original name; the mapper filters them out.
 */

import type { AscCircuit, AscSymbol } from './types';

/**
 * Parse a LTspice .asc file text into the AscCircuit intermediate representation.
 */
export function parseAsc(text: string): AscCircuit {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const result: AscCircuit = { symbols: [], wires: [], flags: [], directives: [] };
  let currentSymbol: Partial<AscSymbol> | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const parts = line.split(/\s+/);
    const keyword = parts[0]?.toUpperCase();

    switch (keyword) {
      case 'WIRE': {
        const x1 = Number(parts[1]);
        const y1 = Number(parts[2]);
        const x2 = Number(parts[3]);
        const y2 = Number(parts[4]);
        if (!Number.isNaN(x1 + y1 + x2 + y2)) {
          result.wires.push({ x1, y1, x2, y2 });
        }
        break;
      }

      case 'FLAG': {
        const x = Number(parts[1]);
        const y = Number(parts[2]);
        const netName = parts[3] ?? '';
        if (!Number.isNaN(x + y)) {
          result.flags.push({ x, y, netName });
        }
        break;
      }

      case 'SYMBOL': {
        // Flush previous symbol
        if (currentSymbol?.name !== undefined) {
          result.symbols.push(currentSymbol as AscSymbol);
        }
        const name = (parts[1] ?? '').toLowerCase();
        const x = Number(parts[2]);
        const y = Number(parts[3]);
        const orientation = parts[4] ?? 'R0';
        currentSymbol = { name, x, y, orientation, instName: '', value: '' };
        break;
      }

      case 'SYMATTR': {
        if (!currentSymbol) break;
        const attrKey = parts[1]?.toUpperCase();
        const attrVal = parts.slice(2).join(' ');
        if (attrKey === 'INSTNAME') currentSymbol.instName = attrVal;
        else if (attrKey === 'VALUE') currentSymbol.value = attrVal;
        else if (attrKey === 'SPICEMODEL') currentSymbol.spiceModel = attrVal;
        break;
      }

      case 'TEXT': {
        // TEXT <x> <y> <justify> <size> <content>
        const content = parts.slice(5).join(' ');
        if (content.startsWith('!')) {
          result.directives.push(content.slice(1).trim());
        }
        break;
      }

      // WINDOW, IOPIN, VERSION, SHEET — intentionally skipped
      default:
        break;
    }
  }

  // Flush last symbol
  if (currentSymbol?.name !== undefined) {
    result.symbols.push(currentSymbol as AscSymbol);
  }

  return result;
}
