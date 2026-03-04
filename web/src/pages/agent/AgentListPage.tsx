// Elastic Agent List Page
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
import { useAgentList } from '../../hooks/useResources';
import type { ElasticAgent } from '../../types/resources';
import { ListSkeleton } from '../../components/common/Skeletons';

// Health status colors
const healthColors: Record<string, string> = {
  green: 'success',
  yellow: 'warning',
  red: 'danger',
  unknown: 'subdued',
};

// Mode colors
const modeColors: Record<string, string> = {
  fleet: 'primary',
  standalone: 'default',
};

type SortableField = 'metadata.name' | 'metadata.namespace' | 'spec.version';

export function AgentListPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useAgentList();

  const [filterHealth, setFilterHealth] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortableField>('metadata.name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const agents = (data?.data ?? []) as ElasticAgent[];

  const filteredAgents = useMemo(() => {
    let result = agents;

    // Filter by health
    if (filterHealth) {
      result = result.filter((a) => a.status?.health === filterHealth);
    }

    // Filter by mode
    if (filterMode) {
      result = result.filter((a) => a.spec.mode === filterMode);
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.metadata.name.toLowerCase().includes(query) ||
          a.metadata.namespace.toLowerCase().includes(query)
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
  }, [agents, filterHealth, filterMode, searchQuery, sortField, sortDirection]);

  // Paginate
  const pageAgents = useMemo(() => {
    const start = pageIndex * pageSize;
    return filteredAgents.slice(start, start + pageSize);
  }, [filteredAgents, pageIndex, pageSize]);

  // Filter counts
  const healthCounts = useMemo(() => {
    const counts = { green: 0, yellow: 0, red: 0 };
    agents.forEach((a) => {
      const health = a.status?.health || 'unknown';
      if (health in counts) {
        counts[health as keyof typeof counts]++;
      }
    });
    return counts;
  }, [agents]);

  const modeCounts = useMemo(() => {
    const counts = { fleet: 0, standalone: 0 };
    agents.forEach((a) => {
      const mode = a.spec.mode || 'standalone';
      if (mode in counts) {
        counts[mode as keyof typeof counts]++;
      }
    });
    return counts;
  }, [agents]);

  const columns: EuiBasicTableColumn<ElasticAgent>[] = [
    {
      field: 'metadata.name',
      name: 'Name',
      sortable: true,
      render: (name: string, agent: ElasticAgent) => (
        <EuiLink
          onClick={() => navigate(`/agent/${agent.metadata.namespace}/${agent.metadata.name}`)}
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
      render: (_: unknown, agent: ElasticAgent) => {
        const health = agent.status?.health || 'unknown';
        return <EuiHealth color={healthColors[health]}>{health}</EuiHealth>;
      },
    },
    {
      field: 'spec.mode',
      name: 'Mode',
      width: '120px',
      render: (_: unknown, agent: ElasticAgent) => {
        const mode = agent.spec.mode || 'standalone';
        return (
          <EuiBadge color={modeColors[mode]}>
            {mode === 'fleet' ? 'Fleet Managed' : 'Standalone'}
          </EuiBadge>
        );
      },
    },
    {
      field: 'status.phase',
      name: 'Phase',
      width: '120px',
      render: (_: unknown, agent: ElasticAgent) => {
        const phase = agent.status?.phase || 'Unknown';
        const isReady = phase === 'Ready';
        return <EuiBadge color={isReady ? 'success' : 'warning'}>{phase}</EuiBadge>;
      },
    },
    {
      name: 'Fleet Server',
      render: (agent: ElasticAgent) => {
        const fleetRef = agent.spec.fleetServerRef;
        if (!fleetRef) {
          return agent.spec.mode === 'fleet' ? (
            <EuiBadge color="warning">Self</EuiBadge>
          ) : (
            <EuiBadge color="hollow">N/A</EuiBadge>
          );
        }
        const ns = fleetRef.namespace || agent.metadata.namespace;
        return (
          <EuiToolTip content={`${ns}/${fleetRef.name}`}>
            <EuiLink
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                navigate(`/agent/${ns}/${fleetRef.name}`);
              }}
            >
              <EuiIcon type="fleetApp" size="m" /> {fleetRef.name}
            </EuiLink>
          </EuiToolTip>
        );
      },
    },
    {
      name: 'Elasticsearch',
      render: (agent: ElasticAgent) => {
        const esRefs = agent.spec.elasticsearchRefs;
        if (!esRefs || esRefs.length === 0) {
          return <EuiBadge color="hollow">None</EuiBadge>;
        }
        const firstRef = esRefs[0];
        const ns = firstRef.namespace || agent.metadata.namespace;
        const extra = esRefs.length > 1 ? ` +${esRefs.length - 1}` : '';
        return (
          <EuiToolTip content={`${ns}/${firstRef.name}${extra}`}>
            <EuiLink
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                navigate(`/elasticsearch/${ns}/${firstRef.name}`);
              }}
            >
              <EuiIcon type="logoElasticsearch" size="m" /> {firstRef.name}
              {extra}
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
      name: 'Deployment',
      width: '100px',
      render: (agent: ElasticAgent) => {
        if (agent.spec.daemonSet) {
          return <EuiBadge color="hollow">DaemonSet</EuiBadge>;
        }
        if (agent.spec.deployment) {
          return (
            <EuiBadge color="hollow">Deployment ({agent.spec.deployment.replicas || 1})</EuiBadge>
          );
        }
        return <EuiBadge color="hollow">Unknown</EuiBadge>;
      },
    },
  ];

  const onTableChange = ({ page, sort }: Criteria<ElasticAgent>) => {
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
        <EuiPageHeader pageTitle="Elastic Agents" />
        <EuiPageTemplate.Section>
          <div>Error: {error instanceof Error ? error.message : 'Unknown error'}</div>
        </EuiPageTemplate.Section>
      </EuiPageTemplate>
    );
  }

  return (
    <EuiPageTemplate>
      <EuiPageHeader
        pageTitle="Elastic Agents"
        description="Elastic Agent provides a unified way to add monitoring for logs, metrics, and other types of data"
        rightSideItems={[
          <EuiButton
            key="create"
            fill
            iconType="plusInCircle"
            onClick={() => navigate('/agent/create')}
          >
            Create Agent
          </EuiButton>,
        ]}
      />

      <EuiPageTemplate.Section>
        <EuiFlexGroup alignItems="center">
          <EuiFlexItem grow={false}>
            <EuiFilterGroup>
              <EuiFilterButton
                hasActiveFilters={filterHealth === null && filterMode === null}
                onClick={() => {
                  setFilterHealth(null);
                  setFilterMode(null);
                }}
              >
                All ({agents.length})
              </EuiFilterButton>
              <EuiFilterButton
                hasActiveFilters={filterHealth === 'green'}
                onClick={() => setFilterHealth(filterHealth === 'green' ? null : 'green')}
                numFilters={healthCounts.green}
              >
                <EuiHealth color="success">Healthy</EuiHealth>
              </EuiFilterButton>
              <EuiFilterButton
                hasActiveFilters={filterHealth === 'red'}
                onClick={() => setFilterHealth(filterHealth === 'red' ? null : 'red')}
                numFilters={healthCounts.red}
              >
                <EuiHealth color="danger">Critical</EuiHealth>
              </EuiFilterButton>
              <EuiFilterButton
                hasActiveFilters={filterMode === 'fleet'}
                onClick={() => setFilterMode(filterMode === 'fleet' ? null : 'fleet')}
                numFilters={modeCounts.fleet}
              >
                Fleet
              </EuiFilterButton>
              <EuiFilterButton
                hasActiveFilters={filterMode === 'standalone'}
                onClick={() => setFilterMode(filterMode === 'standalone' ? null : 'standalone')}
                numFilters={modeCounts.standalone}
              >
                Standalone
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
            items={pageAgents}
            columns={columns}
            rowHeader="metadata.name"
            sorting={{
              sort: {
                field: sortField as keyof ElasticAgent,
                direction: sortDirection,
              },
            }}
            pagination={{
              pageIndex,
              pageSize,
              totalItemCount: filteredAgents.length,
              pageSizeOptions: [10, 25, 50],
            }}
            onChange={onTableChange}
            noItemsMessage="No Elastic Agents found"
          />
        )}
      </EuiPageTemplate.Section>
    </EuiPageTemplate>
  );
}
