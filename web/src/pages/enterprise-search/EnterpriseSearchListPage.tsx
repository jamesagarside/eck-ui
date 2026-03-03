// Enterprise Search List Page
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EuiPageTemplate,
  EuiPageHeader,
  EuiButton,
  EuiBasicTable,
  EuiHealth,
  EuiBadge,
  EuiFieldSearch,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFilterGroup,
  EuiFilterButton,
  EuiLink,
} from '@elastic/eui';
import type { EuiBasicTableColumn, Criteria } from '@elastic/eui';
import { useEnterpriseSearchList } from '../../hooks/useResources';
import type { EnterpriseSearch, HealthStatus } from '../../types/resources';
import { ListSkeleton } from '../../components/common/Skeletons';

function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

interface EnterpriseSearchRow {
  id: string;
  name: string;
  namespace: string;
  version: string;
  health: HealthStatus;
  phase: string;
  count: number;
  nodes: string;
  esRef: string;
  createdAt?: string;
}

function getHealthColor(health: HealthStatus): 'success' | 'warning' | 'danger' | 'subdued' {
  switch (health) {
    case 'green':
      return 'success';
    case 'yellow':
      return 'warning';
    case 'red':
      return 'danger';
    default:
      return 'subdued';
  }
}

export function EnterpriseSearchListPage() {
  const navigate = useNavigate();
  const { data: rawData, isLoading, error } = useEnterpriseSearchList();

  const dataList = rawData as { data: EnterpriseSearch[] } | undefined;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHealth, setSelectedHealth] = useState<HealthStatus[]>([]);
  const [sortField, setSortField] = useState<keyof EnterpriseSearchRow>('name');
  const [sortDirection, setDirection] = useState<'asc' | 'desc'>('asc');

  const instances = useMemo((): EnterpriseSearchRow[] => {
    if (!dataList?.data) return [];

    return dataList.data.map((instance: EnterpriseSearch) => ({
      id: `${instance.metadata.namespace}/${instance.metadata.name}`,
      name: instance.metadata.name,
      namespace: instance.metadata.namespace,
      version: instance.spec.version,
      health: instance.status?.health || 'unknown',
      phase: instance.status?.phase || 'Unknown',
      count: instance.spec.count || 1,
      nodes: instance.status?.availableNodes !== undefined && instance.status?.expectedNodes !== undefined
        ? `${instance.status.availableNodes}/${instance.status.expectedNodes}`
        : '-',
      esRef: instance.spec.elasticsearchRef?.name || 'Not configured',
      createdAt: instance.metadata.creationTimestamp,
    }));
  }, [dataList]);

  const filteredInstances = useMemo(() => {
    let filtered = instances;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (instance) =>
          instance.name.toLowerCase().includes(query) ||
          instance.namespace.toLowerCase().includes(query)
      );
    }

    if (selectedHealth.length > 0) {
      filtered = filtered.filter((instance) => selectedHealth.includes(instance.health));
    }

    return filtered.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      if (aValue === undefined || bValue === undefined) return 0;
      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [instances, searchQuery, selectedHealth, sortField, sortDirection]);

  const columns: EuiBasicTableColumn<EnterpriseSearchRow>[] = [
    {
      field: 'name',
      name: 'Name',
      sortable: true,
      render: (name: string, item: EnterpriseSearchRow) => (
        <EuiLink onClick={() => navigate(`/enterprise-search/${item.namespace}/${name}`)}>
          {name}
        </EuiLink>
      ),
    },
    {
      field: 'namespace',
      name: 'Namespace',
      sortable: true,
    },
    {
      field: 'version',
      name: 'Version',
      sortable: true,
    },
    {
      field: 'health',
      name: 'Health',
      sortable: true,
      render: (health: HealthStatus) => (
        <EuiHealth color={getHealthColor(health)}>{health}</EuiHealth>
      ),
    },
    {
      field: 'phase',
      name: 'Phase',
      sortable: true,
      render: (phase: string) => {
        let color: 'success' | 'warning' | 'danger' | 'default' = 'default';
        if (phase === 'Ready') color = 'success';
        else if (phase === 'Pending' || phase === 'ApplyingChanges') color = 'warning';
        return <EuiBadge color={color}>{phase}</EuiBadge>;
      },
    },
    {
      field: 'count',
      name: 'Count',
      sortable: true,
    },
    {
      field: 'nodes',
      name: 'Nodes',
    },
    {
      field: 'esRef',
      name: 'Elasticsearch',
      sortable: true,
      render: (esRef: string) => (
        esRef !== 'Not configured' ? (
          <EuiLink onClick={() => navigate(`/elasticsearch?search=${esRef}`)}>
            {esRef}
          </EuiLink>
        ) : (
          <span style={{ color: '#999' }}>{esRef}</span>
        )
      ),
    },
    {
      field: 'createdAt',
      name: 'Created',
      sortable: true,
      render: (timestamp: string | undefined) => timestamp ? formatRelativeTime(timestamp) : '-',
    },
  ];

  const onTableChange = ({ sort }: Criteria<EnterpriseSearchRow>) => {
    if (sort) {
      setSortField(sort.field as keyof EnterpriseSearchRow);
      setDirection(sort.direction);
    }
  };

  const toggleHealth = (health: HealthStatus) => {
    setSelectedHealth((prev) =>
      prev.includes(health)
        ? prev.filter((h) => h !== health)
        : [...prev, health]
    );
  };

  if (isLoading) {
    return (
      <EuiPageTemplate>
        <ListSkeleton />
      </EuiPageTemplate>
    );
  }

  if (error) {
    return (
      <EuiPageTemplate>
        <EuiPageHeader
          pageTitle="Enterprise Search"
          description="Error loading Enterprise Search instances"
        />
      </EuiPageTemplate>
    );
  }

  return (
    <EuiPageTemplate>
      <EuiPageHeader
        pageTitle="Enterprise Search"
        description="Manage Elastic Enterprise Search instances"
        rightSideItems={[
          <EuiButton
            key="create"
            fill
            iconType="plusInCircle"
            onClick={() => navigate('/enterprise-search/create')}
          >
            Create Enterprise Search
          </EuiButton>,
        ]}
      />

      <EuiPageTemplate.Section>
        <EuiFlexGroup gutterSize="m" alignItems="center">
          <EuiFlexItem grow={false} style={{ width: 300 }}>
            <EuiFieldSearch
              placeholder="Search instances..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              isClearable
              aria-label="Search Enterprise Search"
            />
          </EuiFlexItem>

          <EuiFlexItem grow={false}>
            <EuiFilterGroup>
              <EuiFilterButton
                hasActiveFilters={selectedHealth.includes('green')}
                onClick={() => toggleHealth('green')}
              >
                Healthy
              </EuiFilterButton>
              <EuiFilterButton
                hasActiveFilters={selectedHealth.includes('yellow')}
                onClick={() => toggleHealth('yellow')}
              >
                Warning
              </EuiFilterButton>
              <EuiFilterButton
                hasActiveFilters={selectedHealth.includes('red')}
                onClick={() => toggleHealth('red')}
              >
                Critical
              </EuiFilterButton>
            </EuiFilterGroup>
          </EuiFlexItem>
        </EuiFlexGroup>

        <EuiBasicTable
          items={filteredInstances}
          columns={columns}
          sorting={{
            sort: {
              field: sortField,
              direction: sortDirection,
            },
          }}
          onChange={onTableChange}
          tableLayout="auto"
          rowProps={(item: EnterpriseSearchRow) => ({
            onClick: () => navigate(`/enterprise-search/${item.namespace}/${item.name}`),
            style: { cursor: 'pointer' },
          })}
        />
      </EuiPageTemplate.Section>
    </EuiPageTemplate>
  );
}
