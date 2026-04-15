/**
 * QuickPlaceMenu — UE5-style "drag to empty space" component picker.
 *
 * Triggered in two ways:
 *   1. User drags a wire onto empty canvas → shows components ranked by
 *      pin compatibility; selecting one places it and auto-wires it.
 *   2. Right-click on empty canvas → shows all components; selecting one
 *      places it at the cursor position.
 *
 * Has a live-search input that auto-focuses on mount. Arrow keys + Enter
 * for keyboard navigation. Escape closes without placing.
 */

import { useEffect, useRef, useState } from 'react';
import { COMPONENT_LIBRARY } from '@/circuit/componentLibrary';
import { compatState } from '@/circuit/pinCompat';
import type { ComponentType, PinType } from '@/circuit/types';
import { useCircuitStore } from '@/store/circuitStore';
import { useWireDragStore } from './stores/wireDragStore';
import styles from './QuickPlaceMenu.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QuickPlaceMenuTarget {
  /** Screen position for the menu anchor */
  screenX: number;
  screenY: number;
  /** Canvas-space position where the new component will be placed */
  flowX: number;
  flowY: number;
  /**
   * If set, this was a wire-drop trigger. The source port ID is used to
   * auto-wire after placement. sourcePinType drives ranking.
   */
  sourcePortId?: string;
  sourcePinType?: PinType;
}

// ---------------------------------------------------------------------------
// Component ranking helpers
// ---------------------------------------------------------------------------

const ALL_TYPES = Object.keys(COMPONENT_LIBRARY).filter(
  (t) => t !== 'subcircuit' && t !== 'net_label',
) as ComponentType[];

interface RankedEntry {
  type: ComponentType;
  name: string;
  category: string;
  compat: 'ok' | 'neutral' | 'error' | 'any';
}

function rankComponents(sourcePinType: PinType | null | undefined, query: string): RankedEntry[] {
  const q = query.toLowerCase().trim();

  const entries: RankedEntry[] = ALL_TYPES.map((type) => {
    const def = COMPONENT_LIBRARY[type];
    let compat: RankedEntry['compat'] = 'any';

    if (sourcePinType) {
      // Find the best-compatible pin on this component
      const bestPin = def.ports.reduce<'ok' | 'neutral' | 'error' | null>((best, port) => {
        const c = compatState(sourcePinType, port.pinType as PinType);
        if (best === null) return c;
        if (c === 'ok') return 'ok';
        if (c === 'neutral' && best === 'error') return 'neutral';
        return best;
      }, null);
      compat = bestPin ?? 'any';
    }

    return { type, name: def.name, category: def.category, compat };
  });

  // Filter by search query
  const filtered = q
    ? entries.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.type.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q),
      )
    : entries;

  // Sort: ok → neutral → any → error, then alphabetically within groups
  const order = { ok: 0, neutral: 1, any: 2, error: 3 };
  return filtered.sort((a, b) => {
    const diff = order[a.compat] - order[b.compat];
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name);
  });
}

// ---------------------------------------------------------------------------
// Compat badge
// ---------------------------------------------------------------------------

const COMPAT_LABEL: Record<RankedEntry['compat'], string | null> = {
  ok: '✓',
  neutral: '~',
  error: '✗',
  any: null,
};
const COMPAT_CLASS: Record<RankedEntry['compat'], string> = {
  ok: styles.compatOk,
  neutral: styles.compatNeutral,
  error: styles.compatError,
  any: '',
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  target: QuickPlaceMenuTarget;
  onClose: () => void;
}

export function QuickPlaceMenu({ target, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = rankComponents(target.sourcePinType ?? null, query);

  // Reset active index when results change
  useEffect(() => setActiveIdx(0), [query]);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on outside click or Escape
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const menu = inputRef.current?.closest('[data-quick-place]');
      if (menu && !menu.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose]);

  const place = (type: ComponentType) => {
    const snap = (v: number) => Math.round(v / 10) * 10;
    const pos = { x: snap(target.flowX), y: snap(target.flowY) };

    const newId = useCircuitStore.getState().addComponent(type, pos);

    // Auto-wire if triggered from a wire drag
    if (target.sourcePortId) {
      const newComp = useCircuitStore.getState().circuit.components.get(newId);
      if (newComp && target.sourcePinType) {
        // Pick the best-compatible port on the new component
        let bestPort = newComp.ports[0];
        let bestCompat: 'ok' | 'neutral' | 'error' = 'error';
        for (const port of newComp.ports) {
          const c = compatState(target.sourcePinType, port.pinType as PinType);
          if (c === 'ok') { bestPort = port; break; }
          if (c === 'neutral' && bestCompat === 'error') { bestPort = port; bestCompat = 'neutral'; }
        }
        if (bestPort) {
          useCircuitStore.getState().addWire(target.sourcePortId, bestPort.id);
        }
      }
    }

    // Clear the wire drag state
    useWireDragStore.getState().end();
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[activeIdx]) {
      place(results[activeIdx]!.type);
    }
  };

  // Scroll active item into view
  useEffect(() => {
    const item = listRef.current?.children[activeIdx] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  // Clamp menu so it stays on screen
  const menuStyle: React.CSSProperties = {
    left: Math.min(target.screenX, window.innerWidth - 240),
    top: Math.min(target.screenY, window.innerHeight - 320),
  };

  return (
    <div className={styles.menu} style={menuStyle} data-quick-place>
      {target.sourcePinType && (
        <div className={styles.header}>
          Compatible with <strong>{target.sourcePinType}</strong> pin
        </div>
      )}
      <input
        ref={inputRef}
        className={styles.input}
        placeholder="Search components…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <ul ref={listRef} className={styles.list}>
        {results.length === 0 && (
          <li className={styles.empty}>No components match "{query}"</li>
        )}
        {results.map((entry, idx) => (
          <li
            key={entry.type}
            className={`${styles.item} ${idx === activeIdx ? styles.active : ''}`}
            onMouseEnter={() => setActiveIdx(idx)}
            onClick={() => place(entry.type)}
          >
            <span className={styles.name}>{entry.name}</span>
            <span className={styles.category}>{entry.category}</span>
            {COMPAT_LABEL[entry.compat] && (
              <span className={`${styles.compat} ${COMPAT_CLASS[entry.compat]}`}>
                {COMPAT_LABEL[entry.compat]}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
