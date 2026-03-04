// Elastic Maps Server List Page
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EuiPageTemplate,
  EuiPageHeader,
  EuiButton,
  EuiBasicTable,
  EuiLink,
  EuiHealth,
  EuiBadge,
  EuiSpacer,
  EuiEmptyPrompt,
  EuiLoadingSpinner,
  EuiCallOut,
  EuiFieldSearch,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFilterGroup,
  EuiFilterButton,
  EuiPopover,
  EuiFilterSelectItem,
} from '@elastic/eui';
import type { EuiBasicTableColumn, EuiTableSortingType, Criteria } from '@elastic/eui';
import { useElasticMapsServerList } from '../../hooks/useResources';
import type { ElasticMapsServer } from '../../types/resources';

type HealthStatus = 'green' | 'yellow' | 'red' | 'unknown';

function getHealthColor(health: HealthStatus): string {
  const colors: Record<HealthStatus, string> = {
    green: 'success',
    yellow: 'warning',
    red: 'danger',
    unknown: 'subdued',
  };
  return colors[health];
}

function formatRelativeTime(dateString?: string): string {
  if (!dateString) return '-';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

interface SortField {
  field: keyof ElasticMapsServer['metadata'] | 'health' | 'version' | 'count';
  direction: 'asc' | 'desc';
}

export function MapsListPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useElasticMapsServerList();

  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>({ field: 'name', direction: 'asc' });
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // Health filter state
  const [isHealthFilterOpen, setIsHealthFilterOpen] = useState(false);
  const [healthFilters, setHealthFilters] = useState<Set<HealthStatus>>(new Set());

  const mapsList = useMemo(() => {
    return (data?.data ?? []) as ElasticMapsServer[];
  }, [data]);

  // Apply filters
  const filteredMaps = useMemo(() => {
    let result = mapsList;

    // Text search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.metadata.name.toLowerCase().includes(query) ||
          m.metadata.namespace.toLowerCase().includes(query) ||
          m.spec.version?.toLowerCase().includes(query)
      );
    }

    // Health filter
    if (healthFilters.size > 0) {
      result = result.filter((m) => {
        const health = (m.status?.health as HealthStatus) || 'unknown';
        return healthFilters.has(health);
      });
    }

    return result;
  }, [mapsList, searchQuery, healthFilters]);

  // Sort items
  const sortedMaps = useMemo(() => {
    const sorted = [...filteredMaps];
    sorted.sort((a, b) => {
      let aValue: string | number = '';
      let bValue: string | number = '';

      switch (sortField.field) {
        case 'name':
          aValue = a.metadata.name;
          bValue = b.metadata.name;
          break;
        case 'namespace':
          aValue = a.metadata.namespace;
          bValue = b.metadata.namespace;
          break;
        case 'health':
          aValue = a.status?.health || 'unknown';
          bValue = b.status?.health || 'unknown';
          break;
        case 'version':
          aValue = a.spec.version || '';
          bValue = b.spec.version || '';
          break;
        case 'count':
          aValue = a.spec.count || 0;
          bValue = b.spec.count || 0;
          break;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortField.direction === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      return sortField.direction === 'asc'
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });
    return sorted;
  }, [filteredMaps, sortField]);

  // Paginate
  const paginatedMaps = useMemo(() => {
    const start = pageIndex * pageSize;
    return sortedMaps.slice(start, start + pageSize);
  }, [sortedMaps, pageIndex, pageSize]);

  const toggleHealthFilter = (health: HealthStatus) => {
    const newFilters = new Set(healthFilters);
    if (newFilters.has(health)) {
      newFilters.delete(health);
    } else {
      newFilters.add(health);
    }
    setHealthFilters(newFilters);
    setPageIndex(0);
  };

  const columns: EuiBasicTableColumn<ElasticMapsServer>[] = [
    {
      field: 'metadata.name',
      name: 'Name',
      sortable: true,
      render: (_: unknown, item: ElasticMapsServer) => (
        <EuiLink onClick={() => navigate(`/maps/${item.metadata.namespace}/${item.metadata.name}`)}>
          {item.metadata.name}
        </EuiLink>
      ),
    },
    {
      field: 'metadata.namespace',
      name: 'Namespace',
      sortable: true,
      render: (namespace: string) => <EuiBadge color="hollow">{namespace}</EuiBadge>,
    },
    {
      name: 'Health',
      field: 'status.health',
      sortable: true,
      render: (_: unknown, item: ElasticMapsServer) => {
        const health = (item.status?.health as HealthStatus) || 'unknown';
        return <EuiHealth color={getHealthColor(health)}>{health}</EuiHealth>;
      },
    },
    {
      field: 'spec.version',
      name: 'Version',
      sortable: true,
    },
    {
      field: 'spec.count',
      name: 'Count',
      sortable: true,
      render: (count: number) => count || 1,
    },
    {
      name: 'Elasticsearch',
      render: (item: ElasticMapsServer) => {
        const esRef = item.spec.elasticsearchRef;
        if (!esRef) return '-';
        const ns = esRef.namespace || item.metadata.namespace;
        return (
          <EuiLink onClick={() => navigate(`/elasticsearch/${ns}/${esRef.name}`)}>
            {esRef.name}
          </EuiLink>
        );
      },
    },
    {
      name: 'Created',
      render: (item: ElasticMapsServer) => formatRelativeTime(item.metadata.creationTimestamp),
    },
  ];

  const sorting: EuiTableSortingType<ElasticMapsServer> = {
    sort: {
      field: `metadata.${sortField.field}` as keyof ElasticMapsServer,
      direction: sortField.direction,
    },
  };

  const onTableChange = ({ sort, page }: Criteria<ElasticMapsServer>) => {
    if (sort) {
      const field = sort.field?.toString().replace('metadata.', '') || 'name';
      setSortField({ field: field as SortField['field'], direction: sort.direction });
    }
    if (page) {
      setPageIndex(page.index);
      setPageSize(page.size);
    }
  };

  const pagination = {
    pageIndex,
    pageSize,
    totalItemCount: sortedMaps.length,
    pageSizeOptions: [10, 25, 50],
  };

  if (isLoading) {
    return (
      <EuiPageTemplate>
        <EuiPageTemplate.Section>
          <EuiFlexGroup justifyContent="center" alignItems="center" style={{ minHeight: 400 }}>
            <EuiFlexItem grow={false}>
              <EuiLoadingSpinner size="xl" />
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiPageTemplate.Section>
      </EuiPageTemplate>
    );
  }

  if (error) {
    return (
      <EuiPageTemplate>
        <EuiPageTemplate.Section>
          <EuiCallOut title="Error loading Elastic Maps Servers" color="danger" iconType="error">
            <p>{error instanceof Error ? error.message : 'An unknown error occurred'}</p>
          </EuiCallOut>
        </EuiPageTemplate.Section>
      </EuiPageTemplate>
    );
  }

  return (
    <EuiPageTemplate>
      <EuiPageHeader
        pageTitle="Elastic Maps Server"
        description="Manage Elastic Maps Server instances for map visualizations"
        rightSideItems={[
          <EuiButton key="create" fill iconType="plus" onClick={() => navigate('/maps/create')}>
            Create Maps Server
          </EuiButton>,
        ]}
      />

      <EuiPageTemplate.Section>
        <EuiFlexGroup alignItems="center">
          <EuiFlexItem grow={true}>
            <EuiFieldSearch
              placeholder="Search maps servers..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPageIndex(0);
              }}
              isClearable
              aria-label="Search maps servers"
            />
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiFilterGroup>
              <EuiPopover
                button={
                  <EuiFilterButton
                    iconType="arrowDown"
                    onClick={() => setIsHealthFilterOpen(!isHealthFilterOpen)}
                    isSelected={isHealthFilterOpen}
                    numFilters={healthFilters.size}
                    hasActiveFilters={healthFilters.size > 0}
                    numActiveFilters={healthFilters.size}
                  >
                    Health
                  </EuiFilterButton>
                }
                isOpen={isHealthFilterOpen}
                closePopover={() => setIsHealthFilterOpen(false)}
                panelPaddingSize="none"
              >
                <div style={{ width: 200 }}>
                  {(['green', 'yellow', 'red', 'unknown'] as HealthStatus[]).map((health) => (
                    <EuiFilterSelectItem
                      key={health}
                      checked={healthFilters.has(health) ? ('on' as const) : undefined}
                      onClick={() => toggleHealthFilter(health)}
                    >
                      <EuiHealth color={getHealthColor(health)}>{health}</EuiHealth>
                    </EuiFilterSelectItem>
                  ))}
                </div>
              </EuiPopover>
            </EuiFilterGroup>
          </EuiFlexItem>
        </EuiFlexGroup>

        <EuiSpacer size="m" />

        {mapsList.length === 0 ? (
          <EuiEmptyPrompt
            iconType="globe"
            title={<h2>No Elastic Maps Servers</h2>}
            body={<p>Create your first Elastic Maps Server to enable map visualizations.</p>}
            actions={
              <EuiButton fill iconType="plus" onClick={() => navigate('/maps/create')}>
                Create Maps Server
              </EuiButton>
            }
          />
        ) : filteredMaps.length === 0 ? (
          <EuiEmptyPrompt
            iconType="search"
            title={<h2>No Results</h2>}
            body={<p>No maps servers match your current filters.</p>}
            actions={
              <EuiButton
                onClick={() => {
                  setSearchQuery('');
                  setHealthFilters(new Set());
                }}
              >
                Clear Filters
              </EuiButton>
            }
          />
        ) : (
          <EuiBasicTable
            items={paginatedMaps}
            columns={columns}
            sorting={sorting}
            pagination={pagination}
            onChange={onTableChange}
          />
        )}
      </EuiPageTemplate.Section>
    </EuiPageTemplate>
  );
}
