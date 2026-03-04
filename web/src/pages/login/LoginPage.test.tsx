import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { render } from '../../test/utils';
import { LoginPage } from './LoginPage';
import { useAuthStore } from '../../stores/authStore';

describe('LoginPage', () => {
  beforeEach(() => {
    // Reset auth store to unauthenticated state
    useAuthStore.setState({
      user: null,
      activeOrg: null,
      orgs: [],
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  });

  it('renders token input and login button', () => {
    render(<LoginPage />);

    expect(
      screen.getByLabelText('Service account token'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /sign in/i }),
    ).toBeInTheDocument();
  });

  it('shows error when submitting with empty token', async () => {
    render(<LoginPage />);

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitButton);

    expect(await screen.findByText('Token is required')).toBeInTheDocument();
  });

  it('submit button displays "Sign in" text', () => {
    render(<LoginPage />);

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    expect(submitButton).toHaveTextContent('Sign in');
  });

  it('renders the page title and description', () => {
    render(<LoginPage />);

    expect(screen.getByText('ECK UI')).toBeInTheDocument();
    expect(
      screen.getByText('Enter your service account token to sign in.'),
    ).toBeInTheDocument();
  });
});
