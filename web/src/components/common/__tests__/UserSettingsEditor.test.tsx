import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { render } from '../../../test/utils';
import { UserSettingsEditor } from '../UserSettingsEditor';

describe('UserSettingsEditor', () => {
  const defaultConfig = { thread_pool: { write: { queue_size: 200 } } };

  it('renders YAML editor with the current config', () => {
    render(<UserSettingsEditor config={defaultConfig} onSave={vi.fn()} />);

    const textarea = screen.getByLabelText('YAML editor');
    expect(textarea).toBeInTheDocument();
    const value = (textarea as HTMLTextAreaElement).value;
    expect(value).toContain('thread_pool');
    expect(value).toContain('queue_size');
  });

  it('renders with default title "User Settings"', () => {
    render(<UserSettingsEditor config={defaultConfig} onSave={vi.fn()} />);
    expect(screen.getByText('User Settings')).toBeInTheDocument();
  });

  it('renders with a custom title', () => {
    render(
      <UserSettingsEditor config={defaultConfig} onSave={vi.fn()} title="Elasticsearch Config" />,
    );
    expect(screen.getByText('Elasticsearch Config')).toBeInTheDocument();
  });

  it('disables the Save button when there are no changes', () => {
    render(<UserSettingsEditor config={defaultConfig} onSave={vi.fn()} />);

    const saveButton = screen.getByRole('button', { name: /save/i });
    expect(saveButton).toBeDisabled();
  });

  it('disables the Save button when YAML is invalid', () => {
    render(<UserSettingsEditor config={defaultConfig} onSave={vi.fn()} />);

    const textarea = screen.getByLabelText('YAML editor');
    fireEvent.change(textarea, { target: { value: 'invalid: yaml: : :' } });

    const saveButton = screen.getByRole('button', { name: /save/i });
    expect(saveButton).toBeDisabled();
  });

  it('enables the Save button when YAML is valid and dirty', () => {
    render(<UserSettingsEditor config={defaultConfig} onSave={vi.fn()} />);

    const textarea = screen.getByLabelText('YAML editor');
    fireEvent.change(textarea, { target: { value: 'key: newvalue' } });

    const saveButton = screen.getByRole('button', { name: /save/i });
    expect(saveButton).not.toBeDisabled();
  });

  it('reverts to the original value when Discard is clicked', () => {
    render(<UserSettingsEditor config={defaultConfig} onSave={vi.fn()} />);

    const textarea = screen.getByLabelText('YAML editor');
    const originalValue = (textarea as HTMLTextAreaElement).value;

    // Make a change
    fireEvent.change(textarea, { target: { value: 'modified: true' } });
    expect(textarea).toHaveValue('modified: true');

    // Discard
    const discardButton = screen.getByRole('button', { name: /discard/i });
    fireEvent.click(discardButton);

    expect(textarea).toHaveValue(originalValue);
  });

  it('calls onSave with the parsed config object', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<UserSettingsEditor config={defaultConfig} onSave={onSave} />);

    const textarea = screen.getByLabelText('YAML editor');
    fireEvent.change(textarea, { target: { value: 'cluster:\n  name: test' } });

    const saveButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({ cluster: { name: 'test' } });
    });
  });

  it('calls onSave with empty object when YAML is cleared', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<UserSettingsEditor config={defaultConfig} onSave={onSave} />);

    const textarea = screen.getByLabelText('YAML editor');
    fireEvent.change(textarea, { target: { value: '' } });

    const saveButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({});
    });
  });

  it('shows error callout when save fails', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Network error'));
    render(<UserSettingsEditor config={defaultConfig} onSave={onSave} />);

    const textarea = screen.getByLabelText('YAML editor');
    fireEvent.change(textarea, { target: { value: 'key: value' } });

    const saveButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Save failed')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('does not show error callout after saving successfully', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<UserSettingsEditor config={defaultConfig} onSave={onSave} />);

    const textarea = screen.getByLabelText('YAML editor');
    fireEvent.change(textarea, { target: { value: 'changed: true' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
    });

    // No error callout should be shown
    expect(screen.queryByText('Save failed')).not.toBeInTheDocument();
  });

  it('clears save error when editor content changes', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Network error'));
    render(<UserSettingsEditor config={defaultConfig} onSave={onSave} />);

    const textarea = screen.getByLabelText('YAML editor');
    fireEvent.change(textarea, { target: { value: 'key: value' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText('Save failed')).toBeInTheDocument();
    });

    // Editing the content should clear the save error
    fireEvent.change(textarea, { target: { value: 'key: different' } });
    expect(screen.queryByText('Save failed')).not.toBeInTheDocument();
  });

  it('renders empty editor when config is undefined', () => {
    render(<UserSettingsEditor config={undefined} onSave={vi.fn()} />);

    const textarea = screen.getByLabelText('YAML editor');
    expect(textarea).toHaveValue('');
  });

  it('renders empty editor when config is an empty object', () => {
    render(<UserSettingsEditor config={{}} onSave={vi.fn()} />);

    const textarea = screen.getByLabelText('YAML editor');
    expect(textarea).toHaveValue('');
  });

  it('disables Discard button when there are no changes', () => {
    render(<UserSettingsEditor config={defaultConfig} onSave={vi.fn()} />);

    const discardButton = screen.getByRole('button', { name: /discard/i });
    expect(discardButton).toBeDisabled();
  });
});
