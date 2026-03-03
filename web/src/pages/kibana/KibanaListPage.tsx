// Kibana List Page
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EuiPageHeader,
  EuiButton,
  EuiBasicTable,
  EuiFieldSearch,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFilterGroup,
  EuiFilterButton,
  EuiHealth,
  EuiBadge,
  EuiLink,
  EuiToolTip,
  EuiSpacer,
  EuiEmptyPrompt,
} from '@elastic/eui';
import type { EuiBasicTableColumn, Criteria, Pagination } from '@elastic/eui';
import { useKibanaList } from '../../hooks/useResources';
import { ListSkeleton } from '../../components/common/Skeletons';
import type { KibanaInstance, HealthStatus, Phase } from '../../types/resources';

// Health color mapping
const healthColors: Record<HealthStatus, string> = {
  green: 'success',
  yellow: 'warning',
  red: 'danger',
  unknown: 'subdued',
};

// Phase badge colors
const phaseColors: Record<Phase, 'primary' | 'warning' | 'danger' | 'default' | 'success'> = {
  Ready: 'success',
  ApplyingChanges: 'primary',
  MigratingData: 'warning',
  Stalled: 'danger',
  Invalid: 'danger',
};

// Association status colors
const associationColors: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  Established: 'success',
  Pending: 'warning',
  Failed: 'danger',
};

// Valid sort fields
type SortableField = 'metadata.name' | 'metadata.namespace' | 'spec.version';

export function KibanaListPage() {
  const navigate = useNavigate();
  
  // State
  const [searchValue, setSearchValue] = useState('');
  const [selectedHealth, setSelectedHealth] = useState<HealthStatus[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [sortField, setSortField] = useState<SortableField>('metadata.name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Build query params
  const queryParams = useMemo(() => ({
    page: pageIndex + 1,
    pageSize,
    sort: sortField.split('.').pop() || sortField,
    order: sortDirection,
    search: searchValue || undefined,
    health: selectedHealth.length === 1 ? selectedHealth[0] : undefined,
  }), [pageIndex, pageSize, sortField, sortDirection, searchValue, selectedHealth]);

  // Fetch data
  const { data, isLoading, error, refetch } = useKibanaList(queryParams);
  
  const instances = (data?.data ?? []) as KibanaInstance[];
  const totalItems = instances.length;

  // Table columns
  const columns: EuiBasicTableColumn<KibanaInstance>[] = [
    {
      field: 'metadata.name',
      name: 'Name',
      sortable: true,
      render: (name: string, item: KibanaInstance) => (
        <EuiLink onClick={() => navigate(`/kibana/${item.metadata.namespace}/${name}`)}>
          {name}
        </EuiLink>
      ),
    },
    {
      field: 'metadata.namespace',
      name: 'Namespace',
      sortable: true,
    },
    {
      field: 'status.health',
      name: 'Health',
      render: (health: HealthStatus = 'unknown') => (
        <EuiHealth color={healthColors[health]}>{health}</EuiHealth>
      ),
    },
    {
      field: 'status.phase',
      name: 'Phase',
      render: (phase: Phase = 'Ready') => (
        <EuiBadge color={phaseColors[phase]}>{phase}</EuiBadge>
      ),
    },
    {
      field: 'status.associationStatus',
      name: 'ES Association',
      render: (status: string = 'Unknown') => (
        <EuiBadge color={associationColors[status] || 'default'}>{status}</EuiBadge>
      ),
    },
    {
      field: 'spec.version',
      name: 'Version',
      sortable: true,
    },
    {
      field: 'spec.count',
      name: 'Replicas',
    },
    {
      field: 'spec.elasticsearchRef',
      name: 'Elasticsearch',
      render: (esRef: KibanaInstance['spec']['elasticsearchRef']) => {
        if (!esRef) return '-';
        return (
          <EuiLink onClick={() => navigate(`/elasticsearch/${esRef.namespace || 'default'}/${esRef.name}`)}>
            {esRef.name}
          </EuiLink>
        );
      },
    },
    {
      field: 'metadata.creationTimestamp',
      name: 'Created',
      sortable: true,
      render: (timestamp: string) => {
        if (!timestamp) return '-';
        const date = new Date(timestamp);
        return (
          <EuiToolTip content={date.toLocaleString()}>
            <span>{formatRelativeTime(date)}</span>
          </EuiToolTip>
        );
      },
    },
  ];

  // Pagination
  const pagination: Pagination = {
    pageIndex,
    pageSize,
    totalItemCount: totalItems,
    pageSizeOptions: [10, 20, 50],
  };

  // Handle table change
  const onTableChange = ({ page, sort }: Criteria<KibanaInstance>) => {
    if (page) {
      setPageIndex(page.index);
      setPageSize(page.size);
    }
    if (sort) {
      setSortField(sort.field as SortableField);
      setSortDirection(sort.direction);
    }
  };

  // Toggle filter
  const toggleHealthFilter = (health: HealthStatus) => {
    setSelectedHealth((prev) =>
      prev.includes(health)
        ? prev.filter((h) => h !== health)
        : [...prev, health]
    );
    setPageIndex(0);
  };

  // Loading state
  if (isLoading && !data) {
    return <ListSkeleton />;
  }

  // Error state
  if (error) {
    return (
      <EuiEmptyPrompt
        iconType="alert"
        iconColor="danger"
        title={<h2>Failed to load Kibana instances</h2>}
        body={<p>{error.message}</p>}
        actions={
          <EuiButton onClick={() => refetch()}>Retry</EuiButton>
        }
      />
    );
  }

  return (
    <>
      <EuiPageHeader
        pageTitle="Kibana Instances"
        rightSideItems={[
          <EuiButton
            key="create"
            fill
            iconType="plus"
            onClick={() => navigate('/kibana/create')}
          >
            Create Kibana
          </EuiButton>,
        ]}
      />

      <EuiSpacer size="l" />

      <EuiFlexGroup>
        <EuiFlexItem grow={3}>
          <EuiFieldSearch
            placeholder="Search by name..."
            value={searchValue}
            onChange={(e) => {
              setSearchValue(e.target.value);
              setPageIndex(0);
            }}
            isClearable
          />
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiFilterGroup>
            {(['green', 'yellow', 'red'] as HealthStatus[]).map((health) => (
              <EuiFilterButton
                key={health}
                hasActiveFilters={selectedHealth.includes(health)}
                onClick={() => toggleHealthFilter(health)}
              >
                <EuiHealth color={healthColors[health]}>{health}</EuiHealth>
              </EuiFilterButton>
            ))}
          </EuiFilterGroup>
        </EuiFlexItem>
      </EuiFlexGroup>

      <EuiSpacer size="m" />

      {instances.length === 0 ? (
        <EuiEmptyPrompt
          iconType="logoKibana"
          title={<h2>No Kibana instances</h2>}
          body={<p>Get started by creating your first Kibana instance.</p>}
          actions={
            <EuiButton fill onClick={() => navigate('/kibana/create')}>
              Create Kibana
            </EuiButton>
          }
        />
      ) : (
        <EuiBasicTable
          items={instances}
          columns={columns}
          pagination={pagination}
          sorting={{
            sort: {
              field: sortField as keyof KibanaInstance,
              direction: sortDirection,
            },
          }}
          onChange={onTableChange}
          loading={isLoading}
        />
      )}
    </>
  );
}

// Helper function for relative time
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return 'Just now';
}
