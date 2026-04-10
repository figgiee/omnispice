/**
 * StepList — left-sidebar sortable list of lab steps for the editor.
 *
 * Behavior contract (from src/labs/__tests__/editor/StepList.test.tsx):
 *   - Renders every step's title.
 *   - Empty array → "Add your first step" empty-state hint.
 *   - Each step has a delete button with accessible name "Delete {title}".
 *   - Delete opens an inline confirmation with a "Confirm" button; on
 *     confirm, `onDelete(stepId)` fires.
 *   - Drag-reorder uses @dnd-kit and calls `onOrderChange(nextSteps)` on drop.
 *   - Clicking a step row calls `onSelect(stepId)`.
 *
 * Prop names (onOrderChange/onDelete/onSelect) follow the RED test exactly —
 * NOT the onReorder/onAdd names drafted in the plan.
 */
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import type { Step } from '@/labs/schema';

interface Props {
  steps: Pick<Step, 'id' | 'title' | 'checkpoints'>[];
  activeStepId?: string | null;
  onOrderChange: (nextSteps: Pick<Step, 'id' | 'title' | 'checkpoints'>[]) => void;
  onDelete: (stepId: string) => void;
  onSelect: (stepId: string) => void;
}

export function StepList({ steps, activeStepId, onOrderChange, onDelete, onSelect }: Props) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = steps.findIndex((s) => s.id === active.id);
    const newIndex = steps.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onOrderChange(arrayMove(steps, oldIndex, newIndex));
  }

  if (steps.length === 0) {
    return (
      <div data-testid="step-list-empty" style={{ padding: '1rem', color: '#888' }}>
        <p>Add your first step to begin authoring this lab.</p>
      </div>
    );
  }

  return (
    <div data-testid="step-list">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {steps.map((step) => (
              <SortableStepRow
                key={step.id}
                step={step}
                isActive={activeStepId === step.id}
                pendingDelete={pendingDeleteId === step.id}
                onSelect={() => onSelect(step.id)}
                onRequestDelete={() => setPendingDeleteId(step.id)}
                onConfirmDelete={() => {
                  onDelete(step.id);
                  setPendingDeleteId(null);
                }}
                onCancelDelete={() => setPendingDeleteId(null)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}

interface RowProps {
  step: Pick<Step, 'id' | 'title' | 'checkpoints'>;
  isActive: boolean;
  pendingDelete: boolean;
  onSelect: () => void;
  onRequestDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}

function SortableStepRow({
  step,
  isActive,
  pendingDelete,
  onSelect,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
}: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    padding: '0.5rem 0.75rem',
    marginBottom: '0.25rem',
    background: isActive ? '#e6f0ff' : isDragging ? '#f0f0f0' : '#fafafa',
    border: '1px solid #ddd',
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  };

  return (
    <li ref={setNodeRef} style={style}>
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Drag ${step.title}`}
        style={{
          cursor: 'grab',
          color: '#999',
          background: 'transparent',
          border: 'none',
          padding: 0,
          font: 'inherit',
        }}
      >
        ⋮⋮
      </button>
      <button
        type="button"
        onClick={onSelect}
        style={{
          flex: 1,
          textAlign: 'left',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          font: 'inherit',
        }}
      >
        <div style={{ fontWeight: 500 }}>{step.title}</div>
        <div style={{ fontSize: '0.75rem', color: '#666' }}>
          {step.checkpoints.length} checkpoint{step.checkpoints.length === 1 ? '' : 's'}
        </div>
      </button>
      {pendingDelete ? (
        <>
          <button
            type="button"
            onClick={onConfirmDelete}
            style={{
              background: '#c00',
              color: '#fff',
              border: 'none',
              padding: '0.25rem 0.5rem',
              borderRadius: 3,
            }}
          >
            Confirm
          </button>
          <button type="button" onClick={onCancelDelete}>
            Cancel
          </button>
        </>
      ) : (
        <button
          type="button"
          aria-label={`Delete ${step.title}`}
          onClick={onRequestDelete}
          style={{ background: 'transparent', border: 'none', color: '#c00', cursor: 'pointer' }}
        >
          ×
        </button>
      )}
    </li>
  );
}
