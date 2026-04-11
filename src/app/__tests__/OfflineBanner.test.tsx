/**
 * Unit tests for OfflineBanner — Plan 05-10.
 *
 * Coverage:
 *   - banner hidden while navigator.onLine === true
 *   - banner appears when an `offline` event fires
 *   - dismiss button hides the banner without going back online
 *   - banner reappears on next offline event after dismissal
 *   - banner hides immediately when an `online` event fires
 *
 * Strategy: directly stub navigator.onLine via defineProperty and
 * dispatch window.Event('offline'|'online'), since jsdom does not
 * simulate true network state changes on its own.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OfflineBanner } from '../OfflineBanner';

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => value,
  });
}

describe('<OfflineBanner />', () => {
  beforeEach(() => {
    setOnline(true);
  });
  afterEach(() => {
    cleanup();
    setOnline(true);
  });

  it('renders nothing while online', () => {
    render(<OfflineBanner />);
    expect(screen.queryByTestId('offline-banner')).toBeNull();
  });

  it('appears when an offline event fires', () => {
    render(<OfflineBanner />);
    setOnline(false);
    fireEvent(window, new Event('offline'));
    expect(screen.getByTestId('offline-banner')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/working offline/i);
  });

  it('dismiss button hides the banner', () => {
    render(<OfflineBanner />);
    setOnline(false);
    fireEvent(window, new Event('offline'));
    fireEvent.click(screen.getByTestId('offline-banner-dismiss'));
    expect(screen.queryByTestId('offline-banner')).toBeNull();
  });

  it('banner reappears on next offline event after dismissal', () => {
    render(<OfflineBanner />);
    // First offline
    setOnline(false);
    fireEvent(window, new Event('offline'));
    fireEvent.click(screen.getByTestId('offline-banner-dismiss'));
    expect(screen.queryByTestId('offline-banner')).toBeNull();
    // Back online briefly...
    setOnline(true);
    fireEvent(window, new Event('online'));
    // ...then offline again
    setOnline(false);
    fireEvent(window, new Event('offline'));
    expect(screen.getByTestId('offline-banner')).toBeInTheDocument();
  });

  it('hides immediately when going back online', () => {
    render(<OfflineBanner />);
    setOnline(false);
    fireEvent(window, new Event('offline'));
    expect(screen.getByTestId('offline-banner')).toBeInTheDocument();
    setOnline(true);
    fireEvent(window, new Event('online'));
    expect(screen.queryByTestId('offline-banner')).toBeNull();
  });
});
