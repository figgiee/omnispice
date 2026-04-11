/**
 * Global command palette (Ctrl+K, locked decision #3).
 *
 * Front door for every discoverable action in the editor: simulation runs,
 * exports, circuit templates, recent circuits, and docs. Uses cmdk's
 * `Command.Dialog` for the dialog shell, focus trap, and built-in fuzzy
 * filtering.
 *
 * Focus-based disambiguation:
 *   - When focus is inside `[data-surface="sidebar-library"]`, Sidebar.tsx
 *     handles the `omnispice:open-command-palette` event by focusing the
 *     library search. This palette returns early so the two cmdk instances
 *     don't fight over Ctrl+K.
 *   - Otherwise the palette opens centered over the canvas.
 *
 * All hotkey + event wiring lives in `useCanvasInteractions.ts`. This
 * component only listens for `omnispice:open-command-palette` and surfaces
 * the UI.
 */

import { Command } from 'cmdk';
import { useEffect, useState } from 'react';
import { useCircuits } from '@/cloud/hooks';
import { TEMPLATES } from '@/templates';
import { insertTemplate } from '@/templates/insertTemplate';
import styles from './CommandPalette.module.css';
import { ACTIONS, runAction } from './commandPaletteActions';

/**
 * Format a unix-ms timestamp as a short "today" / "Nd ago" label.
 */
function relativeTime(msSinceEpoch: number): string {
  const ms = Date.now() - msSinceEpoch;
  if (ms < 0) return 'now';
  const day = 24 * 60 * 60 * 1000;
  const d = Math.floor(ms / day);
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w === 1) return '1w ago';
  if (w < 5) return `${w}w ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const circuitsQuery = useCircuits();
  const circuits = circuitsQuery.data ?? [];

  useEffect(() => {
    const handler = () => {
      // Locked decision #3: sidebar library search owns Ctrl+K when focus
      // is already inside the sidebar surface. Let Sidebar.tsx handle it.
      const active = document.activeElement;
      if (active?.closest('[data-surface="sidebar-library"]')) return;
      setQuery('');
      setOpen(true);
    };
    window.addEventListener('omnispice:open-command-palette', handler);
    return () => window.removeEventListener('omnispice:open-command-palette', handler);
  }, []);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      overlayClassName={styles.overlay}
      contentClassName={styles.content}
    >
      <Command.Input
        value={query}
        onValueChange={setQuery}
        placeholder="Search actions, circuits, templates, docs…"
        className={styles.input}
      />
      <Command.List className={styles.list}>
        <Command.Empty className={styles.empty}>
          No matches for &ldquo;{query}&rdquo;. Try a command or template name.
        </Command.Empty>

        <Command.Group heading="Actions" className={styles.group}>
          {ACTIONS.map((action) => (
            <Command.Item
              key={action.id}
              value={`${action.label} ${action.id}`}
              onSelect={() => {
                runAction(action.id);
                setOpen(false);
              }}
              className={styles.item}
            >
              <span>{action.label}</span>
              {action.shortcut ? <span className={styles.shortcut}>{action.shortcut}</span> : null}
            </Command.Item>
          ))}
        </Command.Group>

        {circuits.length > 0 ? (
          <Command.Group heading="Circuits" className={styles.group}>
            {circuits.slice(0, 8).map((circuit) => (
              <Command.Item
                key={circuit.id}
                value={`${circuit.name} ${circuit.id}`}
                onSelect={() => {
                  window.location.assign(`/circuit/${circuit.id}`);
                  setOpen(false);
                }}
                className={styles.item}
              >
                <span>{circuit.name}</span>
                <span className={styles.meta}>{relativeTime(circuit.updated_at)}</span>
              </Command.Item>
            ))}
          </Command.Group>
        ) : null}

        <Command.Group heading="Templates" className={styles.group}>
          {Object.values(TEMPLATES).map((template) => (
            <Command.Item
              key={template.id}
              value={`${template.name} ${template.tags.join(' ')}`}
              onSelect={() => {
                insertTemplate(template.id);
                setOpen(false);
              }}
              className={styles.item}
            >
              <span>{template.name}</span>
              <span className={styles.meta}>{template.components.length} parts</span>
            </Command.Item>
          ))}
        </Command.Group>

        <Command.Group heading="Docs" className={styles.group}>
          <Command.Item
            value="keyboard shortcuts reference help"
            onSelect={() => {
              window.dispatchEvent(new CustomEvent('omnispice:toggle-shortcut-help'));
              setOpen(false);
            }}
            className={styles.item}
          >
            <span>Keyboard shortcut reference</span>
            <span className={styles.shortcut}>?</span>
          </Command.Item>
        </Command.Group>
      </Command.List>
      <footer className={styles.footer}>↑↓ navigate · ↵ select · Esc close</footer>
    </Command.Dialog>
  );
}
