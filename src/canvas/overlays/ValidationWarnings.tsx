/**
 * Validation warning overlay for the canvas.
 *
 * Per D-23: renders yellow AlertTriangle icons at the top-right corner
 * of each component node that has validation errors/warnings.
 * Reads from simulationStore.validationErrors.
 * Rendered as a child of the ReactFlow component.
 */

import { useNodes } from '@xyflow/react';
import { AlertTriangle } from 'lucide-react';
import { useSimulationStore } from '@/store/simulationStore';
import styles from './ValidationWarnings.module.css';

export function ValidationWarnings() {
  const validationErrors = useSimulationStore((s) => s.validationErrors);
  const nodes = useNodes();

  if (validationErrors.length === 0) return null;

  // Build a map from componentId -> list of messages
  const warningsByComponent = new Map<string, string[]>();
  for (const err of validationErrors) {
    for (const id of err.componentIds) {
      const existing = warningsByComponent.get(id) ?? [];
      existing.push(err.message);
      warningsByComponent.set(id, existing);
    }
  }

  // Filter nodes that have warnings
  const warnedNodes = nodes.filter((node) => warningsByComponent.has(node.id));

  if (warnedNodes.length === 0) return null;

  return (
    <>
      {warnedNodes.map((node) => {
        const messages = warningsByComponent.get(node.id) ?? [];
        const tooltipText = messages.join('\n');

        // Node position is in flow coordinates -- React Flow renders
        // children of ReactFlow in an absolute container over the viewport.
        // We use the node's measured dimensions if available, fallback to 60x40.
        const width = (node.measured?.width ?? node.width) ?? 60;

        return (
          <div
            key={node.id}
            className={styles.warningIcon}
            style={{
              transform: `translate(${node.position.x + width - 8}px, ${node.position.y - 8}px)`,
            }}
            title={tooltipText}
            role="img"
            aria-label={`Warning: ${tooltipText}`}
          >
            <AlertTriangle
              size={16}
              style={{ color: 'var(--warning-icon)' }}
            />
          </div>
        );
      })}
    </>
  );
}
