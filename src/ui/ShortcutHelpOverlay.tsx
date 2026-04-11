/**
 * ShortcutHelpOverlay — docked right-panel keyboard reference (UI-SPEC §7.6).
 *
 * Listens for the `omnispice:toggle-shortcut-help` window event (dispatched
 * by the `?` hotkey in useCanvasInteractions) and toggles visibility.
 * Esc closes the overlay. Phase 05-01 ships the chrome + listener; the
 * pillar-grouped content polish lives in Plan 05-11.
 */

import { useEffect, useState } from 'react';
import styles from './ShortcutHelpOverlay.module.css';

interface Shortcut {
  keys: string;
  action: string;
}
interface PillarSection {
  title: string;
  shortcuts: Shortcut[];
}

const SECTIONS: PillarSection[] = [
  {
    title: 'SCHEMATIC HONESTY',
    shortcuts: [
      { keys: 'Ctrl+G', action: 'Collapse to subcircuit' },
      { keys: 'Double-click', action: 'Descend into subcircuit' },
    ],
  },
  {
    title: 'MODELESSNESS',
    shortcuts: [
      { keys: 'Space+drag', action: 'Pan' },
      { keys: 'Shift+D', action: 'Duplicate selection' },
      { keys: 'R', action: 'Rotate (when selected)' },
    ],
  },
  {
    title: 'IMMEDIACY',
    shortcuts: [
      { keys: 'Click+drag value', action: 'Scrub parameter' },
      { keys: 'Shift+scrub', action: 'Sweep parameter' },
    ],
  },
  {
    title: 'LIVE FEEDBACK',
    shortcuts: [
      { keys: 'Ctrl+K', action: 'Command palette' },
      { keys: '?', action: 'This help' },
      { keys: 'F', action: 'Frame selection' },
      { keys: 'A or 0', action: 'Frame all' },
    ],
  },
  {
    title: 'PEDAGOGY',
    shortcuts: [{ keys: 'Click peak', action: 'Annotate waveform' }],
  },
];

export function ShortcutHelpOverlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const toggle = () => setOpen((o) => !o);
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('omnispice:toggle-shortcut-help', toggle);
    window.addEventListener('keydown', onKeydown);
    return () => {
      window.removeEventListener('omnispice:toggle-shortcut-help', toggle);
      window.removeEventListener('keydown', onKeydown);
    };
  }, []);

  if (!open) return null;

  return (
    <aside
      className={styles.overlay}
      role="dialog"
      aria-label="Keyboard reference"
      aria-modal="false"
      data-testid="shortcut-help-overlay"
    >
      <header className={styles.header}>
        <h2>Keyboard reference</h2>
        <button
          type="button"
          className={styles.closeBtn}
          aria-label="Close"
          onClick={() => setOpen(false)}
        >
          ×
        </button>
      </header>
      {SECTIONS.map((section) => (
        <section key={section.title} className={styles.section}>
          <h3>{section.title}</h3>
          <dl>
            {section.shortcuts.map((s) => (
              <div key={s.keys} className={styles.row}>
                <dt>
                  <kbd>{s.keys}</kbd>
                </dt>
                <dd>{s.action}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </aside>
  );
}
