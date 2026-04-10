import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Hook for inline value editing on circuit component nodes.
 * Clicking the value label opens an input; Enter confirms, Escape cancels.
 */
export function useValueEdit(initialValue: string) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const startEditing = useCallback(() => {
    setEditValue(initialValue);
    setIsEditing(true);
  }, [initialValue]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setEditValue(initialValue);
  }, [initialValue]);

  const confirmEditing = useCallback(() => {
    setIsEditing(false);
    return editValue;
  }, [editValue]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmEditing();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelEditing();
      }
    },
    [confirmEditing, cancelEditing],
  );

  return {
    isEditing,
    editValue,
    setEditValue,
    inputRef,
    startEditing,
    cancelEditing,
    confirmEditing,
    handleKeyDown,
  };
}
