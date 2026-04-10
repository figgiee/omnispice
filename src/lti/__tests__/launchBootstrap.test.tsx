import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const createMock = vi.fn();
vi.mock('@clerk/react', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@clerk/react');
  return {
    ...actual,
    useSignIn: () => ({
      isLoaded: true,
      signIn: { create: createMock },
      setActive: vi.fn(),
    }),
  };
});

// RED — src/lti/LtiLaunchBootstrap lands in 04-02.
// @ts-expect-error — module does not exist yet (Wave 0 scaffold).
import { LtiLaunchBootstrap } from '../LtiLaunchBootstrap';

describe('lti/launchBootstrap — LMS-03 ticket redemption', () => {
  beforeEach(() => {
    createMock.mockReset();
    // Reset URL before each test
    window.history.replaceState({}, '', '/');
  });

  it('reads ?ticket=... from URL and calls signIn.create({strategy:"ticket"})', async () => {
    window.history.replaceState({}, '', '/lti/bootstrap?ticket=t-abc&target_link_uri=/editor');
    createMock.mockResolvedValue({ status: 'complete', createdSessionId: 'sess_1' });
    render(<LtiLaunchBootstrap />);
    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({ strategy: 'ticket', ticket: 't-abc' }),
      );
    });
  });

  it('renders an error page when the ticket param is missing', async () => {
    window.history.replaceState({}, '', '/lti/bootstrap');
    render(<LtiLaunchBootstrap />);
    await waitFor(() => {
      expect(screen.getByText(/missing ticket|error/i)).toBeInTheDocument();
    });
  });

  it('redirects to target_link_uri after successful ticket redemption', async () => {
    window.history.replaceState({}, '', '/lti/bootstrap?ticket=t-xyz&target_link_uri=%2Feditor');
    createMock.mockResolvedValue({ status: 'complete', createdSessionId: 'sess_2' });
    render(<LtiLaunchBootstrap />);
    await waitFor(() => {
      expect(window.location.pathname).toBe('/editor');
    });
  });
});
