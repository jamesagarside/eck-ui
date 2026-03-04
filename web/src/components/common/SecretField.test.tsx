import { describe, it, expect } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { render } from '../../test/utils';
import { SecretField } from './SecretField';

const MASK = '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022';

describe('SecretField', () => {
  it('initially shows masked value', () => {
    render(<SecretField value="my-secret-token" />);

    const input = screen.getByLabelText('Secret value');
    expect(input).toHaveValue(MASK);
  });

  it('reveals value when toggle is clicked', () => {
    render(<SecretField value="my-secret-token" />);

    const toggleButton = screen.getByLabelText('Reveal secret value');
    fireEvent.click(toggleButton);

    const input = screen.getByLabelText('Secret value');
    expect(input).toHaveValue('my-secret-token');
  });

  it('hides value again when toggle is clicked twice', () => {
    render(<SecretField value="my-secret-token" />);

    const toggleButton = screen.getByLabelText('Reveal secret value');
    fireEvent.click(toggleButton);

    const hideButton = screen.getByLabelText('Hide secret value');
    fireEvent.click(hideButton);

    const input = screen.getByLabelText('Secret value');
    expect(input).toHaveValue(MASK);
  });

  it('has a copy button', () => {
    render(<SecretField value="my-secret-token" />);

    const copyButton = screen.getByLabelText('Copy secret value to clipboard');
    expect(copyButton).toBeInTheDocument();
  });
});
