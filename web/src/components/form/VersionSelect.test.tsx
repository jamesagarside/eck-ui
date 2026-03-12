import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { handlers } from '../../test/mocks';
import { render } from '../../test/utils';
import { VersionSelect } from './VersionSelect';

const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('VersionSelect', () => {
  it('renders a select with version options when versions are loaded', async () => {
    render(<VersionSelect value="9.3.1" onChange={() => {}} />);

    await waitFor(() => {
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      const values = Array.from(select.options).map((o) => o.value);
      expect(values).toContain('9.3.0');
    });

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);

    expect(values).toContain('9.3.1');
    expect(values).toContain('9.3.0');
    expect(values).toContain('8.18.0');
    expect(values).toContain('7.17.27');
  });

  it('shows loading state while versions are fetching', () => {
    const { container } = render(<VersionSelect value="9.3.1" onChange={() => {}} />);

    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();

    // EuiSelect renders a loading spinner icon when isLoading is true
    const loadingIcon = container.querySelector('.euiFormControlLayoutIcons .euiLoadingSpinner');
    expect(loadingIcon).toBeInTheDocument();
  });

  it('falls back to text input when no versions are available', async () => {
    server.use(
      http.get('/api/v1/versions', () => {
        return HttpResponse.json({
          operatorVersion: '3.3.1',
          defaultVersion: '8.17.0',
          source: 'artifacts-api',
          versions: [],
        });
      }),
    );

    render(<VersionSelect value="8.17.0" onChange={() => {}} />);

    await waitFor(() => {
      const textInput = screen.getByRole('textbox');
      expect(textInput).toBeInTheDocument();
    });

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

    const textInput = screen.getByRole('textbox') as HTMLInputElement;
    expect(textInput.value).toBe('8.17.0');
  });

  it('includes currentVersion in options when it is not in the version list', async () => {
    render(
      <VersionSelect value="7.10.0" onChange={() => {}} currentVersion="7.10.0" />,
    );

    await waitFor(() => {
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      const options = Array.from(select.options);
      const values = options.map((o) => o.value);
      expect(values).toContain('7.10.0');
    });

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    const options = Array.from(select.options);
    const currentOption = options.find((o) => o.value === '7.10.0');

    expect(currentOption).toBeDefined();
    expect(currentOption!.text).toBe('7.10.0 (current)');

    // The current version should be first in the list
    expect(options[0].value).toBe('7.10.0');
  });

  it('calls onChange when a different version is selected', async () => {
    const onChange = vi.fn();

    render(<VersionSelect value="9.3.1" onChange={onChange} />);

    await waitFor(() => {
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.options.length).toBeGreaterThan(1);
    });

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '9.3.0' } });

    expect(onChange).toHaveBeenCalledWith('9.3.0');
  });
});
