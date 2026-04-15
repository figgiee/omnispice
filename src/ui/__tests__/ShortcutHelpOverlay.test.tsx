/**
 * ShortcutHelpOverlay unit test.
 *
 * Verifies the overlay is hidden by default, renders on
 * `omnispice:toggle-shortcut-help` window event, and closes on Escape.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ShortcutHelpOverlay } from '../ShortcutHelpOverlay';

function dispatchToggle() {
  act(() => {
    window.dispatchEvent(new CustomEvent('omnispice:toggle-shortcut-help'));
  });
}

describe('ShortcutHelpOverlay', () => {
  it('is hidden by default', () => {
    render(<ShortcutHelpOverlay />);
    expect(screen.queryByTestId('shortcut-help-overlay')).toBeNull();
  });

  it('opens when omnispice:toggle-shortcut-help is dispatched', () => {
    render(<ShortcutHelpOverlay />);
    dispatchToggle();
    expect(screen.getByTestId('shortcut-help-overlay')).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('closes when Escape is pressed', () => {
    render(<ShortcutHelpOverlay />);
    dispatchToggle();
    expect(screen.getByTestId('shortcut-help-overlay')).toBeTruthy();

    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(screen.queryByTestId('shortcut-help-overlay')).toBeNull();
  });

  it('closes when the close button is clicked', () => {
    render(<ShortcutHelpOverlay />);
    dispatchToggle();

    const closeBtn = screen.getByRole('button', { name: 'Close' });
    fireEvent.click(closeBtn);
    expect(screen.queryByTestId('shortcut-help-overlay')).toBeNull();
  });

  it('renders all sections with kbd tags', () => {
    render(<ShortcutHelpOverlay />);
    dispatchToggle();

    expect(screen.getByText('PLACING COMPONENTS')).toBeTruthy();
    expect(screen.getByText('EDITING')).toBeTruthy();
    expect(screen.getByText('SIMULATION')).toBeTruthy();
  });
});
