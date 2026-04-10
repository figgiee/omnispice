import type { Node } from '@xyflow/react';
import { getNodesBounds, getViewportForBounds } from '@xyflow/react';
import { toPng } from 'html-to-image';

const IMAGE_WIDTH = 2048;
const IMAGE_HEIGHT = 1536;

/**
 * Export the schematic canvas as a PNG file.
 *
 * CRITICAL: capture the '.react-flow' container, NOT '.react-flow__viewport'.
 * The viewport only contains nodes; edges render in a sibling SVG layer.
 * Capturing '.react-flow' includes both layers.
 *
 * html-to-image MUST be pinned to 1.11.13 — newer versions break React Flow export.
 * See: .planning/phases/02-cloud-and-compatibility/02-CONTEXT.md D-15, D-16
 */
export async function exportSchematicAsPng(nodes: Node[], filename = 'circuit.png'): Promise<void> {
  const viewportElement = document.querySelector('.react-flow') as HTMLElement | null;
  if (!viewportElement) {
    throw new Error('React Flow container not found in DOM');
  }

  const nodesBounds = getNodesBounds(nodes);
  const viewport = getViewportForBounds(nodesBounds, IMAGE_WIDTH, IMAGE_HEIGHT, 0.5, 2, 0);

  const dataUrl = await toPng(viewportElement, {
    backgroundColor: '#1a1a2e',
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    style: {
      width: String(IMAGE_WIDTH),
      height: String(IMAGE_HEIGHT),
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
    filter: (node) => {
      if (node instanceof Element) {
        return (
          !node.classList.contains('react-flow__minimap') &&
          !node.classList.contains('react-flow__controls') &&
          !node.classList.contains('react-flow__panel')
        );
      }
      return true;
    },
  });

  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}
