import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { render } from '../../test/utils';
import { setupServer } from 'msw/node';
import { handlers } from '../../test/mocks';
import { FleetServerCreatePage } from './FleetServerCreatePage';

const server = setupServer(...handlers);
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('FleetServerCreatePage', () => {
  it('renders the page header "Create Fleet Server"', () => {
    render(<FleetServerCreatePage />);
    expect(screen.getByRole('heading', { name: /Create Fleet Server/i, level: 1 })).toBeInTheDocument();
  });

  it('shows name and namespace input fields', () => {
    render(<FleetServerCreatePage />);
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Namespace')).toBeInTheDocument();
  });

  it('shows a version select that loads versions from the API', async () => {
    render(<FleetServerCreatePage />);
    const versionRow = screen.getByText('Version');
    expect(versionRow).toBeInTheDocument();

    await waitFor(() => {
      const select = versionRow.closest('.euiFormRow')?.querySelector('select');
      expect(select).toBeInTheDocument();
    });
  });

  it('has a submit button labelled "Create Fleet Server"', () => {
    render(<FleetServerCreatePage />);
    const submitButton = screen.getByRole('button', { name: /Create Fleet Server/i });
    expect(submitButton).toBeInTheDocument();
    expect(submitButton).toHaveAttribute('type', 'submit');
  });

  it('has a cancel button', () => {
    render(<FleetServerCreatePage />);
    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    expect(cancelButton).toBeInTheDocument();
  });

  it('shows a replicas field for deployment workload', () => {
    render(<FleetServerCreatePage />);
    expect(screen.getByLabelText('Replicas')).toBeInTheDocument();

    const replicasInput = screen.getByLabelText('Replicas') as HTMLInputElement;
    expect(replicasInput.type).toBe('number');
    expect(replicasInput.value).toBe('1');
  });
});
