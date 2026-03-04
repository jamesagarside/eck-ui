// Elasticsearch List Page
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
  EuiText,
  EuiToolTip,
  EuiSpacer,
  EuiEmptyPrompt,
} from '@elastic/eui';
import type { EuiBasicTableColumn, Criteria, Pagination } from '@elastic/eui';
import { useElasticsearchList } from '../../hooks/useResources';
import { ListSkeleton } from '../../components/common/Skeletons';
import type { ElasticsearchCluster, HealthStatus, Phase } from '../../types/resources';

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

// Filter options
const healthFilters: HealthStatus[] = ['green', 'yellow', 'red'];
const phaseFilters: Phase[] = ['Ready', 'ApplyingChanges', 'MigratingData', 'Stalled'];

// Valid sort fields (matching column field paths)
type SortableField = 'metadata.name' | 'metadata.namespace' | 'spec.version';

export function ElasticsearchListPage() {
  const navigate = useNavigate();

  // State
  const [searchValue, setSearchValue] = useState('');
  const [selectedHealth, setSelectedHealth] = useState<HealthStatus[]>([]);
  const [selectedPhase, setSelectedPhase] = useState<Phase[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [sortField, setSortField] = useState<SortableField>('metadata.name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Build query params
  const queryParams = useMemo(
    () => ({
      page: pageIndex + 1,
      pageSize,
      sort: sortField.split('.').pop() || sortField,
      order: sortDirection,
      search: searchValue || undefined,
      health: selectedHealth.length === 1 ? selectedHealth[0] : undefined,
      phase: selectedPhase.length === 1 ? selectedPhase[0] : undefined,
    }),
    [pageIndex, pageSize, sortField, sortDirection, searchValue, selectedHealth, selectedPhase]
  );

  // Fetch data
  const { data, isLoading, error, refetch } = useElasticsearchList(queryParams);

  const clusters = (data?.data ?? []) as ElasticsearchCluster[];
  const totalItems = clusters.length;

  // Table columns
  const columns: EuiBasicTableColumn<ElasticsearchCluster>[] = [
    {
      field: 'metadata.name',
      name: 'Name',
      sortable: true,
      render: (name: string, item: ElasticsearchCluster) => (
        <EuiLink onClick={() => navigate(`/elasticsearch/${item.metadata.namespace}/${name}`)}>
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
      sortable: true,
      render: (health: HealthStatus) => (
        <EuiHealth color={healthColors[health] || 'subdued'}>{health}</EuiHealth>
      ),
    },
    {
      field: 'status.phase',
      name: 'Phase',
      sortable: true,
      render: (phase: Phase) => (
        <EuiBadge color={phaseColors[phase] || 'default'}>{phase}</EuiBadge>
      ),
    },
    {
      field: 'spec.version',
      name: 'Version',
      sortable: true,
    },
    {
      field: 'status',
      name: 'Nodes',
      render: (status: ElasticsearchCluster['status']) => {
        if (!status) return <span>-</span>;
        return (
          <EuiToolTip
            content={`${status.availableNodes ?? 0} of ${status.expectedNodes ?? 0} nodes available`}
          >
            <span>
              {status.availableNodes ?? 0}/{status.expectedNodes ?? 0}
            </span>
          </EuiToolTip>
        );
      },
    },
    {
      field: 'spec.nodeSets',
      name: 'Node Sets',
      render: (nodeSets: ElasticsearchCluster['spec']['nodeSets']) => (
        <span>{nodeSets?.length ?? 0}</span>
      ),
    },
    {
      field: 'metadata.creationTimestamp',
      name: 'Created',
      sortable: true,
      render: (timestamp: string) => {
        if (!timestamp) return <span>-</span>;
        const date = new Date(timestamp);
        return (
          <EuiToolTip content={date.toLocaleString()}>
            <span>{formatRelativeTime(date)}</span>
          </EuiToolTip>
        );
      },
    },
  ];

  // Pagination config
  const pagination: Pagination = {
    pageIndex,
    pageSize,
    totalItemCount: totalItems,
    pageSizeOptions: [10, 20, 50],
  };

  // Table change handler
  const onTableChange = ({ page, sort }: Criteria<ElasticsearchCluster>) => {
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
      prev.includes(health) ? prev.filter((h) => h !== health) : [...prev, health]
    );
    setPageIndex(0);
  };

  const togglePhaseFilter = (phase: Phase) => {
    setSelectedPhase((prev) =>
      prev.includes(phase) ? prev.filter((p) => p !== phase) : [...prev, phase]
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
        title={<h2>Failed to load clusters</h2>}
        body={<p>{error.message}</p>}
        actions={<EuiButton onClick={() => refetch()}>Retry</EuiButton>}
      />
    );
  }

  return (
    <>
      <EuiPageHeader
        pageTitle="Elasticsearch Clusters"
        rightSideItems={[
          <EuiButton
            key="create"
            fill
            iconType="plus"
            onClick={() => navigate('/elasticsearch/create')}
          >
            Create cluster
          </EuiButton>,
        ]}
      />

      <EuiSpacer size="l" />

      {/* Search and filters */}
      <EuiFlexGroup gutterSize="m">
        <EuiFlexItem grow={2}>
          <EuiFieldSearch
            placeholder="Search clusters..."
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
            {healthFilters.map((health) => (
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
        <EuiFlexItem grow={false}>
          <EuiFilterGroup>
            {phaseFilters.map((phase) => (
              <EuiFilterButton
                key={phase}
                hasActiveFilters={selectedPhase.includes(phase)}
                onClick={() => togglePhaseFilter(phase)}
              >
                {phase}
              </EuiFilterButton>
            ))}
          </EuiFilterGroup>
        </EuiFlexItem>
      </EuiFlexGroup>

      <EuiSpacer size="m" />

      {/* Table */}
      {clusters.length === 0 ? (
        <EuiEmptyPrompt
          iconType="logoElasticsearch"
          title={<h2>No Elasticsearch clusters</h2>}
          body={
            <EuiText>
              <p>
                {searchValue || selectedHealth.length || selectedPhase.length
                  ? 'No clusters match your filters.'
                  : 'Create your first Elasticsearch cluster to get started.'}
              </p>
            </EuiText>
          }
          actions={
            <EuiButton fill onClick={() => navigate('/elasticsearch/create')}>
              Create cluster
            </EuiButton>
          }
        />
      ) : (
        <EuiBasicTable
          items={clusters}
          columns={columns}
          pagination={pagination}
          sorting={{
            sort: {
              // Cast needed for nested field paths
              field: sortField as keyof ElasticsearchCluster,
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
