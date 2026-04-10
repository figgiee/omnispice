/**
 * Validation warning overlay for the canvas.
 *
 * Per D-23: renders yellow AlertTriangle icons at the top-right corner
 * of each component node that has validation errors/warnings.
 * Reads from simulationStore.validationErrors.
 * Rendered as a child of the ReactFlow component.
 *
 * Node positions from useNodes() are in flow coordinates.
 * Children of <ReactFlow> render in the container's absolute space,
 * outside the viewport transform. We use useViewport() to convert
 * flow coords -> screen coords: screenX = flowX * zoom + vpX
 */

import { useNodes, useViewport } from '@xyflow/react';
import { AlertTriangle } from 'lucide-react';
import { useSimulationStore } from '@/store/simulationStore';
import styles from './ValidationWarnings.module.css';

export function ValidationWarnings() {
  const validationErrors = useSimulationStore((s) => s.validationErrors);
  const nodes = useNodes();
  const { x: vpX, y: vpY, zoom } = useViewport();

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

        // Node dimensions in flow space
        const nodeWidth = (node.measured?.width ?? node.width) ?? 60;

        // Convert flow coordinates to screen coordinates
        // screenX = flowX * zoom + vpX
        const screenX = (node.position.x + nodeWidth) * zoom + vpX - 8;
        const screenY = node.position.y * zoom + vpY - 8;

        return (
          <div
            key={node.id}
            className={styles.warningIcon}
            style={{
              transform: `translate(${screenX}px, ${screenY}px)`,
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
