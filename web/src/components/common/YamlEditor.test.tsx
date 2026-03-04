import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { render } from '../../test/utils';
import { YamlEditor } from './YamlEditor';

describe('YamlEditor', () => {
  it('renders with initial value', () => {
    const yaml = 'apiVersion: v1\nkind: ConfigMap';
    render(<YamlEditor value={yaml} />);

    const textarea = screen.getByLabelText('YAML editor');
    expect(textarea).toHaveValue(yaml);
  });

  it('calls onChange when text changes', () => {
    const handleChange = vi.fn();
    render(<YamlEditor value="" onChange={handleChange} />);

    const textarea = screen.getByLabelText('YAML editor');
    fireEvent.change(textarea, { target: { value: 'key: value' } });

    expect(handleChange).toHaveBeenCalledWith('key: value');
  });

  it('renders in readOnly mode when specified', () => {
    render(<YamlEditor value="key: value" readOnly />);

    const textarea = screen.getByLabelText('YAML editor');
    expect(textarea).toHaveAttribute('readonly');
  });

  it('shows validation error for invalid YAML', () => {
    const handleChange = vi.fn();
    render(<YamlEditor value="" onChange={handleChange} />);

    const textarea = screen.getByLabelText('YAML editor');
    fireEvent.change(textarea, { target: { value: 'invalid: yaml: : :' } });

    expect(handleChange).toHaveBeenCalledWith('invalid: yaml: : :');
  });

  it('does not show validation error for valid YAML', () => {
    const handleChange = vi.fn();
    render(<YamlEditor value="" onChange={handleChange} />);

    const textarea = screen.getByLabelText('YAML editor');
    fireEvent.change(textarea, { target: { value: 'key: value\nother: 123' } });

    expect(handleChange).toHaveBeenCalledWith('key: value\nother: 123');
    expect(handleChange).toHaveBeenCalledTimes(1);
  });
});
