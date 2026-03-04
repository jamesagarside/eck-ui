import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '../../test/utils';
import { PhaseBadge } from './PhaseBadge';

describe('PhaseBadge', () => {
  it('renders "Ready" badge', () => {
    render(<PhaseBadge phase="Ready" />);

    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByLabelText('Phase: Ready')).toBeInTheDocument();
  });

  it('renders "ApplyingChanges" badge', () => {
    render(<PhaseBadge phase="ApplyingChanges" />);

    expect(screen.getByText('ApplyingChanges')).toBeInTheDocument();
    expect(screen.getByLabelText('Phase: ApplyingChanges')).toBeInTheDocument();
  });

  it('renders "Stalled" badge', () => {
    render(<PhaseBadge phase="Stalled" />);

    expect(screen.getByText('Stalled')).toBeInTheDocument();
    expect(screen.getByLabelText('Phase: Stalled')).toBeInTheDocument();
  });

  it('renders unknown phase as "Unknown"', () => {
    render(<PhaseBadge phase="" />);

    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.getByLabelText('Phase: Unknown')).toBeInTheDocument();
  });
});
