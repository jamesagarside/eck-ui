// APM Server List Page
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EuiPageTemplate,
  EuiPageHeader,
  EuiButton,
  EuiBasicTable,
  EuiHealth,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFilterGroup,
  EuiFilterButton,
  EuiBadge,
  EuiLink,
  EuiSpacer,
  EuiSearchBar,
  EuiToolTip,
  EuiIcon,
} from '@elastic/eui';
import type { EuiBasicTableColumn, Criteria } from '@elastic/eui';
import { useApmList } from '../../hooks/useResources';
import type { ApmServer } from '../../types/resources';
import { ListSkeleton } from '../../components/common/Skeletons';

// Health status colors
const healthColors: Record<string, string> = {
  green: 'success',
  yellow: 'warning',
  red: 'danger',
  unknown: 'subdued',
};

type SortableField = 'metadata.name' | 'metadata.namespace' | 'spec.version';

export function ApmListPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useApmList();

  const [filterHealth, setFilterHealth] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortableField>('metadata.name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const servers = (data?.data ?? []) as ApmServer[];

  const filteredServers = useMemo(() => {
    let result = servers;

    // Filter by health
    if (filterHealth) {
      result = result.filter((s) => s.status?.health === filterHealth);
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.metadata.name.toLowerCase().includes(query) ||
          s.metadata.namespace.toLowerCase().includes(query)
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      let aVal: string;
      let bVal: string;
      if (sortField === 'metadata.name') {
        aVal = a.metadata.name;
        bVal = b.metadata.name;
      } else if (sortField === 'metadata.namespace') {
        aVal = a.metadata.namespace;
        bVal = b.metadata.namespace;
      } else {
        aVal = a.spec.version;
        bVal = b.spec.version;
      }
      const cmp = aVal.localeCompare(bVal);
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [servers, filterHealth, searchQuery, sortField, sortDirection]);

  // Paginate
  const pageServers = useMemo(() => {
    const start = pageIndex * pageSize;
    return filteredServers.slice(start, start + pageSize);
  }, [filteredServers, pageIndex, pageSize]);

  // Health filter counts
  const healthCounts = useMemo(() => {
    const counts = { green: 0, yellow: 0, red: 0 };
    servers.forEach((s) => {
      const health = s.status?.health || 'unknown';
      if (health in counts) {
        counts[health as keyof typeof counts]++;
      }
    });
    return counts;
  }, [servers]);

  const columns: EuiBasicTableColumn<ApmServer>[] = [
    {
      field: 'metadata.name',
      name: 'Name',
      sortable: true,
      render: (name: string, server: ApmServer) => (
        <EuiLink
          onClick={() =>
            navigate(`/apm/${server.metadata.namespace}/${server.metadata.name}`)
          }
        >
          {name}
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
      field: 'status.health',
      name: 'Health',
      sortable: true,
      width: '100px',
      render: (_: unknown, server: ApmServer) => {
        const health = server.status?.health || 'unknown';
        return <EuiHealth color={healthColors[health]}>{health}</EuiHealth>;
      },
    },
    {
      field: 'status.phase',
      name: 'Phase',
      width: '120px',
      render: (_: unknown, server: ApmServer) => {
        const phase = server.status?.phase || 'Unknown';
        const isReady = phase === 'Ready';
        return (
          <EuiBadge color={isReady ? 'success' : 'warning'}>{phase}</EuiBadge>
        );
      },
    },
    {
      name: 'Elasticsearch',
      render: (server: ApmServer) => {
        const esRef = server.spec.elasticsearchRef;
        if (!esRef) {
          return <EuiBadge color="hollow">None</EuiBadge>;
        }
        const ns = esRef.namespace || server.metadata.namespace;
        return (
          <EuiToolTip content={`${ns}/${esRef.name}`}>
            <EuiLink
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                navigate(`/elasticsearch/${ns}/${esRef.name}`);
              }}
            >
              <EuiIcon type="logoElasticsearch" size="m" />{' '}
              {esRef.name}
            </EuiLink>
          </EuiToolTip>
        );
      },
    },
    {
      name: 'Kibana',
      render: (server: ApmServer) => {
        const kibanaRef = server.spec.kibanaRef;
        if (!kibanaRef) {
          return <EuiBadge color="hollow">None</EuiBadge>;
        }
        const ns = kibanaRef.namespace || server.metadata.namespace;
        return (
          <EuiToolTip content={`${ns}/${kibanaRef.name}`}>
            <EuiLink
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                navigate(`/kibana/${ns}/${kibanaRef.name}`);
              }}
            >
              <EuiIcon type="logoKibana" size="m" />{' '}
              {kibanaRef.name}
            </EuiLink>
          </EuiToolTip>
        );
      },
    },
    {
      field: 'spec.version',
      name: 'Version',
      sortable: true,
      width: '100px',
      render: (version: string) => <EuiBadge>{version}</EuiBadge>,
    },
    {
      field: 'spec.count',
      name: 'Replicas',
      width: '80px',
      align: 'right',
      render: (_: unknown, server: ApmServer) => server.spec.count || 1,
    },
  ];

  const onTableChange = ({ page, sort }: Criteria<ApmServer>) => {
    if (page) {
      setPageIndex(page.index);
      setPageSize(page.size);
    }
    if (sort) {
      setSortField(sort.field as SortableField);
      setSortDirection(sort.direction);
    }
  };

  if (error) {
    return (
      <EuiPageTemplate>
        <EuiPageHeader pageTitle="APM Servers" />
        <EuiPageTemplate.Section>
          <div>Error: {error instanceof Error ? error.message : 'Unknown error'}</div>
        </EuiPageTemplate.Section>
      </EuiPageTemplate>
    );
  }

  return (
    <EuiPageTemplate>
      <EuiPageHeader
        pageTitle="APM Servers"
        description="Application Performance Monitoring servers collect and process APM data"
        rightSideItems={[
          <EuiButton
            key="create"
            fill
            iconType="plusInCircle"
            onClick={() => navigate('/apm/create')}
          >
            Create APM Server
          </EuiButton>,
        ]}
      />

      <EuiPageTemplate.Section>
        <EuiFlexGroup alignItems="center">
          <EuiFlexItem grow={false}>
            <EuiFilterGroup>
              <EuiFilterButton
                hasActiveFilters={filterHealth === null}
                onClick={() => setFilterHealth(null)}
              >
                All ({servers.length})
              </EuiFilterButton>
              <EuiFilterButton
                hasActiveFilters={filterHealth === 'green'}
                onClick={() => setFilterHealth(filterHealth === 'green' ? null : 'green')}
                numFilters={healthCounts.green}
              >
                <EuiHealth color="success">Healthy</EuiHealth>
              </EuiFilterButton>
              <EuiFilterButton
                hasActiveFilters={filterHealth === 'yellow'}
                onClick={() =>
                  setFilterHealth(filterHealth === 'yellow' ? null : 'yellow')
                }
                numFilters={healthCounts.yellow}
              >
                <EuiHealth color="warning">Warning</EuiHealth>
              </EuiFilterButton>
              <EuiFilterButton
                hasActiveFilters={filterHealth === 'red'}
                onClick={() => setFilterHealth(filterHealth === 'red' ? null : 'red')}
                numFilters={healthCounts.red}
              >
                <EuiHealth color="danger">Critical</EuiHealth>
              </EuiFilterButton>
            </EuiFilterGroup>
          </EuiFlexItem>
          <EuiFlexItem>
            <EuiSearchBar
              box={{
                placeholder: 'Search by name or namespace...',
                incremental: true,
              }}
              onChange={({ queryText }) => setSearchQuery(queryText || '')}
            />
          </EuiFlexItem>
        </EuiFlexGroup>

        <EuiSpacer size="m" />

        {isLoading ? (
          <ListSkeleton />
        ) : (
          <EuiBasicTable
            items={pageServers}
            columns={columns}
            rowHeader="metadata.name"
            sorting={{
              sort: {
                field: sortField as keyof ApmServer,
                direction: sortDirection,
              },
            }}
            pagination={{
              pageIndex,
              pageSize,
              totalItemCount: filteredServers.length,
              pageSizeOptions: [10, 25, 50],
            }}
            onChange={onTableChange}
            noItemsMessage="No APM servers found"
          />
        )}
      </EuiPageTemplate.Section>
    </EuiPageTemplate>
  );
}
