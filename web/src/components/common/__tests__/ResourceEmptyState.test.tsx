import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../../test/utils';
import { ResourceEmptyState, NoResultsEmptyState } from '../ResourceEmptyState';

describe('ResourceEmptyState', () => {
  it('renders with resource-specific title and description', () => {
    render(
      <ResourceEmptyState
        resourceType="elasticsearch"
        resourceLabel="Elasticsearch Cluster"
        onCreate={vi.fn()}
      />,
    );
    expect(screen.getByText('No Elasticsearch clusters')).toBeInTheDocument();
    expect(screen.getByText(/distributed search and analytics/)).toBeInTheDocument();
  });

  it('renders fallback title for unknown resource types', () => {
    render(
      <ResourceEmptyState
        resourceType="custom"
        resourceLabel="Custom Resource"
        onCreate={vi.fn()}
      />,
    );
    expect(screen.getByText('No Custom Resource found')).toBeInTheDocument();
  });

  it('renders custom description when provided', () => {
    render(
      <ResourceEmptyState
        resourceType="elasticsearch"
        resourceLabel="Elasticsearch Cluster"
        description="Custom description text"
        onCreate={vi.fn()}
      />,
    );
    expect(screen.getByText('Custom description text')).toBeInTheDocument();
  });

  it('calls onCreate when create button is clicked', () => {
    const onCreate = vi.fn();
    render(
      <ResourceEmptyState
        resourceType="kibana"
        resourceLabel="Kibana"
        onCreate={onCreate}
      />,
    );
    fireEvent.click(screen.getByText('Create Kibana'));
    expect(onCreate).toHaveBeenCalledOnce();
  });

  it('shows deployment button when onCreateDeployment is provided', () => {
    const onCreate = vi.fn();
    const onCreateDeployment = vi.fn();
    render(
      <ResourceEmptyState
        resourceType="kibana"
        resourceLabel="Kibana"
        onCreate={onCreate}
        onCreateDeployment={onCreateDeployment}
      />,
    );
    expect(screen.getByText('Create Deployment')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Create Deployment'));
    expect(onCreateDeployment).toHaveBeenCalledOnce();
  });
});

describe('NoResultsEmptyState', () => {
  it('renders no results message', () => {
    render(<NoResultsEmptyState onClearFilters={vi.fn()} />);
    expect(screen.getByText('No results found')).toBeInTheDocument();
    expect(screen.getByText(/adjusting your search/)).toBeInTheDocument();
  });

  it('calls onClearFilters when clear button is clicked', () => {
    const onClearFilters = vi.fn();
    render(<NoResultsEmptyState onClearFilters={onClearFilters} />);
    fireEvent.click(screen.getByText('Clear filters'));
    expect(onClearFilters).toHaveBeenCalledOnce();
  });
});
