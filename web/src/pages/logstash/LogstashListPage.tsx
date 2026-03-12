import { useState, useCallback } from 'react';
import {
  EuiBasicTable,
  EuiButton,
  EuiHealth,
  EuiPageHeader,
  EuiSpacer,
  EuiBadge,
  EuiFieldSearch,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFilterGroup,
  EuiFilterButton,
  type EuiBasicTableColumn,
  type CriteriaWithPagination,
} from '@elastic/eui';
import { useNavigate } from 'react-router-dom';
import { useResourceList } from '../../hooks/useResources';
import { useResourceWatch } from '../../hooks/useResourceWatch';
import { ListSkeleton } from '../../components/common/Skeletons';
import { ErrorCallout } from '../../components/common/ErrorCallout';
import { ResourceEmptyState, NoResultsEmptyState } from '../../components/common/ResourceEmptyState';
import type { Logstash, HealthStatus } from '../../types/resources';

const HEALTH_COLORS: Record<HealthStatus, string> = {
  green: 'success',
  yellow: 'warning',
  red: 'danger',
  unknown: 'subdued',
};

function formatAge(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const d = Math.floor(diff / 86400000);
  if (d > 0) return `${d}d`;
  const h = Math.floor(diff / 3600000);
  if (h > 0) return `${h}h`;
  return `${Math.floor(diff / 60000)}m`;
}

export function LogstashListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [healthFilter, setHealthFilter] = useState<string[]>([]);
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const healthParam = healthFilter.length > 0 ? healthFilter.join(',') : undefined;

  const { isConnected } = useResourceWatch('logstash');

  const { data, isLoading, error, refetch } = useResourceList<Logstash>('logstash', {
    page: page + 1,
    pageSize,
    search: search || undefined,
    health: healthParam,
    sort: sortField,
    order: sortDirection,
  }, { refetchInterval: isConnected ? false : 15000 });

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    const timeout = setTimeout(() => {
      setSearch(value);
      setPage(0);
    }, 300);
    return () => clearTimeout(timeout);
  }, []);

  const toggleHealthFilter = (health: string) => {
    setHealthFilter((prev) =>
      prev.includes(health) ? prev.filter((h) => h !== health) : [...prev, health],
    );
    setPage(0);
  };

  if (isLoading && !data) return <ListSkeleton />;

  const items = data?.items || [];
  const totalItems = data?.total ?? 0;

  const columns: EuiBasicTableColumn<Logstash>[] = [
    { field: 'metadata.name', name: 'Name', truncateText: true, sortable: true },
    { field: 'metadata.namespace', name: 'Namespace', truncateText: true, sortable: true },
    { field: 'spec.version', name: 'Version', width: '100px' },
    {
      field: 'status.health',
      name: 'Health',
      width: '100px',
      render: (health: HealthStatus) => (
        <EuiHealth
          color={HEALTH_COLORS[health || 'unknown']}
          aria-label={`Health: ${health || 'unknown'}`}
        >
          {health || 'unknown'}
        </EuiHealth>
      ),
    },
    {
      field: 'status.phase',
      name: 'Phase',
      width: '140px',
      render: (phase: string) => (
        <EuiBadge color={phase === 'Ready' ? 'success' : 'default'}>{phase || 'Unknown'}</EuiBadge>
      ),
    },
    { field: 'spec.count', name: 'Count', width: '70px' },
    {
      field: 'metadata.creationTimestamp',
      name: 'Age',
      width: '80px',
      render: (ts: string) => formatAge(ts),
    },
  ];

  const pagination = {
    pageIndex: page,
    pageSize,
    totalItemCount: totalItems,
    pageSizeOptions: [10, 25, 50],
  };

  const onTableChange = ({ page: tablePage, sort }: CriteriaWithPagination<Logstash>) => {
    if (tablePage) {
      setPage(tablePage.index);
      setPageSize(tablePage.size);
    }
    if (sort) {
      const field = String(sort.field);
      const sortMap: Record<string, string> = {
        'metadata.name': 'name',
        'metadata.namespace': 'namespace',
        'spec.version': 'version',
        'status.health': 'health',
        'status.phase': 'phase',
        'metadata.creationTimestamp': 'age',
      };
      setSortField(sortMap[field] || field);
      setSortDirection(sort.direction);
    }
  };

  const hasFilters = search || healthFilter.length > 0;
  const showEmptyState = !isLoading && totalItems === 0 && !hasFilters;
  const showNoResults = !isLoading && totalItems === 0 && hasFilters;

  return (
    <>
      <EuiPageHeader
        pageTitle="Logstash"
        description={isConnected ? undefined : undefined}
        rightSideItems={[
          <EuiButton key="create" fill iconType="plusInCircle" onClick={() => navigate('/logstash/create')}>
            Create Logstash
          </EuiButton>,
        ]}
      />
      <EuiSpacer size="l" />

      {error && (
        <>
          <ErrorCallout error={error} onRetry={refetch} />
          <EuiSpacer size="m" />
        </>
      )}

      <EuiFlexGroup gutterSize="m" alignItems="center">
        <EuiFlexItem grow>
          <EuiFieldSearch
            placeholder="Search by name..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            isClearable
            aria-label="Search resources"
          />
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiFilterGroup>
            {(['green', 'yellow', 'red'] as const).map((health) => (
              <EuiFilterButton
                key={health}
                hasActiveFilters={healthFilter.includes(health)}
                onClick={() => toggleHealthFilter(health)}
                aria-label={`Filter by ${health} health`}
              >
                <EuiHealth color={HEALTH_COLORS[health]}>{health}</EuiHealth>
              </EuiFilterButton>
            ))}
          </EuiFilterGroup>
        </EuiFlexItem>
      </EuiFlexGroup>

      <EuiSpacer size="m" />

      {showEmptyState ? (
        <ResourceEmptyState
          resourceType="logstash"
          resourceLabel="Logstash"
          onCreate={() => navigate('/logstash/create')}
          onCreateDeployment={() => navigate('/deployments/create')}
        />
      ) : showNoResults ? (
        <NoResultsEmptyState
          onClearFilters={() => {
            setSearch('');
            setSearchInput('');
            setHealthFilter([]);
            setPage(0);
          }}
        />
      ) : (
        <EuiBasicTable
          items={items}
          columns={columns}
          pagination={pagination}
          sorting={{
            sort: {
              field: `metadata.${sortField}` as keyof Logstash,
              direction: sortDirection,
            },
          }}
          onChange={onTableChange}
          rowProps={(item: Logstash) => ({
            onClick: () => navigate(`/logstash/${item.metadata.namespace}/${item.metadata.name}`),
            style: { cursor: 'pointer' },
            role: 'link' as const,
            tabIndex: 0,
            'aria-label': `View ${item.metadata.name}`,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === 'Enter') {
                navigate(`/logstash/${item.metadata.namespace}/${item.metadata.name}`);
              }
            },
          })}
          noItemsMessage="No Logstash instances found"
        />
      )}
    </>
  );
}
