import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '../../test/utils';
import { HealthBadge } from './HealthBadge';

describe('HealthBadge', () => {
  it('renders green health as "Healthy"', () => {
    render(<HealthBadge health="green" />);

    expect(screen.getByText('Healthy')).toBeInTheDocument();
    expect(screen.getByLabelText('Health status: Healthy')).toBeInTheDocument();
  });

  it('renders yellow health as "Warning"', () => {
    render(<HealthBadge health="yellow" />);

    expect(screen.getByText('Warning')).toBeInTheDocument();
    expect(screen.getByLabelText('Health status: Warning')).toBeInTheDocument();
  });

  it('renders red health as "Critical"', () => {
    render(<HealthBadge health="red" />);

    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByLabelText('Health status: Critical')).toBeInTheDocument();
  });

  it('renders unknown health as "Unknown"', () => {
    render(<HealthBadge health="unknown" />);

    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.getByLabelText('Health status: Unknown')).toBeInTheDocument();
  });
});
