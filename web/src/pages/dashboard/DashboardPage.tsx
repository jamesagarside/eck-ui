import { useState, useCallback } from 'react';
import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiPanel,
  EuiStat,
  EuiSpacer,
  EuiTitle,
  EuiHealth,
  EuiBasicTable,
  EuiIcon,
  EuiBadge,
  EuiEmptyPrompt,
  EuiButton,
  EuiButtonEmpty,
  EuiLink,
  EuiSwitch,
  type EuiBasicTableColumn,
  type Criteria,
} from '@elastic/eui';
import { useNavigate } from 'react-router-dom';
import { useResourceList } from '../../hooks/useResources';
import { useResourceWatch } from '../../hooks/useResourceWatch';
import { useUserRole } from '../../hooks/useUserRole';
import { useDeployments } from '../../hooks/useDeployments';
import { DashboardSkeleton } from '../../components/common/Skeletons';
import { DeploymentCardGrid } from '../../components/deployment/DeploymentCardGrid';
import { routePath } from '../../utils/routePaths';
import type {
  Elasticsearch,
  Kibana,
  ResourceType,
  HealthStatus,
  BaseResource,
  ResourceStatus,
} from '../../types/resources';

const HEALTH_COLORS: Record<HealthStatus, string> = {
  green: 'success',
  yellow: 'warning',
  red: 'danger',
  unknown: 'subdued',
};

const PHASE_COLORS: Record<string, string> = {
  Ready: 'success',
  ApplyingChanges: 'primary',
  MigratingData: 'warning',
  Stalled: 'danger',
  Invalid: 'danger',
  Unknown: 'default',
};

interface ResourceSummaryRow {
  type: ResourceType;
  label: string;
  icon: string;
  total: number;
  healthy: number;
  warning: number;
  critical: number;
}

interface RecentResource {
  name: string;
  namespace: string;
  type: ResourceType;
  health: HealthStatus;
  phase: string;
  created: string;
}

interface ProblemResource {
  name: string;
  namespace: string;
  type: ResourceType;
  health: HealthStatus;
  phase: string;
  message: string;
}

function countByHealth(
  items: { status?: ResourceStatus }[],
): { healthy: number; warning: number; critical: number } {
  let healthy = 0;
  let warning = 0;
  let critical = 0;
  for (const item of items) {
    const health = item.status?.health || 'unknown';
    if (health === 'green') healthy++;
    else if (health === 'yellow') warning++;
    else if (health === 'red') critical++;
  }
  return { healthy, warning, critical };
}

function countByPhase(
  items: { status?: ResourceStatus }[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const phase = item.status?.phase || 'Unknown';
    counts[phase] = (counts[phase] || 0) + 1;
  }
  return counts;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const role = useUserRole();
  const deploymentsHook = useDeployments();
  const [autoRefresh, setAutoRefresh] = useState(true);

  // SSE live updates: auto-invalidate TanStack Query cache when resources change.
  // When SSE is connected, disable polling to avoid redundant network requests.
  const esWatch = useResourceWatch('elasticsearch', { enabled: autoRefresh });
  const kibanaWatch = useResourceWatch('kibana', { enabled: autoRefresh });
  const apmWatch = useResourceWatch('apm', { enabled: autoRefresh });
  const beatWatch = useResourceWatch('beat', { enabled: autoRefresh });
  const agentWatch = useResourceWatch('agent', { enabled: autoRefresh });
  const logstashWatch = useResourceWatch('logstash', { enabled: autoRefresh });
  const entSearchWatch = useResourceWatch('enterprise-search', { enabled: autoRefresh });
  const mapsWatch = useResourceWatch('maps', { enabled: autoRefresh });

  const esQuery = useResourceList<Elasticsearch>('elasticsearch', undefined, { refetchInterval: esWatch.isConnected ? false : 15000 });
  const kibanaQuery = useResourceList<Kibana>('kibana', undefined, { refetchInterval: kibanaWatch.isConnected ? false : 15000 });
  const apmQuery = useResourceList('apm', undefined, { refetchInterval: apmWatch.isConnected ? false : 15000 });
  const beatQuery = useResourceList('beat', undefined, { refetchInterval: beatWatch.isConnected ? false : 15000 });
  const agentQuery = useResourceList('agent', undefined, { refetchInterval: agentWatch.isConnected ? false : 15000 });
  const logstashQuery = useResourceList('logstash', undefined, { refetchInterval: logstashWatch.isConnected ? false : 15000 });
  const entSearchQuery = useResourceList('enterprise-search', undefined, { refetchInterval: entSearchWatch.isConnected ? false : 15000 });
  const mapsQuery = useResourceList('maps', undefined, { refetchInterval: mapsWatch.isConnected ? false : 15000 });

  const [recentSortField, setRecentSortField] = useState<keyof RecentResource>('created');
  const [recentSortDirection, setRecentSortDirection] = useState<'asc' | 'desc'>('desc');

  const isLoading =
    esQuery.isLoading ||
    kibanaQuery.isLoading ||
    apmQuery.isLoading ||
    beatQuery.isLoading ||
    agentQuery.isLoading ||
    logstashQuery.isLoading ||
    entSearchQuery.isLoading ||
    mapsQuery.isLoading;

  const onRecentTableChange = useCallback(({ sort }: Criteria<RecentResource>) => {
    if (sort) {
      setRecentSortField(sort.field);
      setRecentSortDirection(sort.direction);
    }
  }, []);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  // Viewer dashboard: deployment-centric card view
  if (role === 'viewer') {
    if (deploymentsHook.isLoading) return <DashboardSkeleton />;

    const viewerDeployments = deploymentsHook.deployments;

    if (viewerDeployments.length === 0) {
      return (
        <>
          <EuiTitle size="l">
            <h1>My Deployments</h1>
          </EuiTitle>
          <EuiSpacer size="xl" />
          <EuiEmptyPrompt
            iconType="layers"
            title={<h2>No deployments available</h2>}
            body={
              <p>
                Contact your platform administrator to set up deployments.
              </p>
            }
          />
        </>
      );
    }

    return (
      <>
        <EuiTitle size="l">
          <h1>My Deployments</h1>
        </EuiTitle>
        <EuiSpacer size="l" />
        <DeploymentCardGrid deployments={viewerDeployments} />
      </>
    );
  }

  const resources: {
    type: ResourceType;
    label: string;
    icon: string;
    items: (BaseResource & { status?: ResourceStatus })[];
  }[] = [
    {
      type: 'elasticsearch',
      label: 'Elasticsearch',
      icon: 'logoElasticsearch',
      items: (esQuery.data?.items || []) as (BaseResource & { status?: ResourceStatus })[],
    },
    {
      type: 'kibana',
      label: 'Kibana',
      icon: 'logoKibana',
      items: (kibanaQuery.data?.items || []) as (BaseResource & { status?: ResourceStatus })[],
    },
    {
      type: 'apm',
      label: 'APM Server',
      icon: 'logoAPM',
      items: (apmQuery.data?.items || []) as (BaseResource & { status?: ResourceStatus })[],
    },
    {
      type: 'beat',
      label: 'Beats',
      icon: 'logoBeats',
      items: (beatQuery.data?.items || []) as (BaseResource & { status?: ResourceStatus })[],
    },
    {
      type: 'agent',
      label: 'Elastic Agent',
      icon: 'logoSecurity',
      items: (agentQuery.data?.items || []) as (BaseResource & { status?: ResourceStatus })[],
    },
    {
      type: 'logstash',
      label: 'Logstash',
      icon: 'logoLogstash',
      items: (logstashQuery.data?.items || []) as (BaseResource & { status?: ResourceStatus })[],
    },
    {
      type: 'enterprise-search',
      label: 'Enterprise Search',
      icon: 'logoEnterpriseSearch',
      items: (entSearchQuery.data?.items || []) as (BaseResource & { status?: ResourceStatus })[],
    },
    {
      type: 'maps',
      label: 'Elastic Maps',
      icon: 'logoMaps',
      items: (mapsQuery.data?.items || []) as (BaseResource & { status?: ResourceStatus })[],
    },
  ];

  const summaryRows: ResourceSummaryRow[] = resources.map((r) => {
    const counts = countByHealth(r.items);
    return {
      type: r.type,
      label: r.label,
      icon: r.icon,
      total: r.items.length,
      ...counts,
    };
  });

  const totalResources = summaryRows.reduce((sum, r) => sum + r.total, 0);
  const totalHealthy = summaryRows.reduce((sum, r) => sum + r.healthy, 0);
  const totalWarning = summaryRows.reduce((sum, r) => sum + r.warning, 0);
  const totalCritical = summaryRows.reduce((sum, r) => sum + r.critical, 0);

  // First-run empty state: welcoming experience when no resources exist
  if (totalResources === 0) {
    return (
      <>
        <EuiTitle size="l">
          <h1>Dashboard</h1>
        </EuiTitle>
        <EuiSpacer size="xl" />
        <EuiPanel paddingSize="xl" hasBorder>
          <EuiEmptyPrompt
            iconType="logoElastic"
            title={<h2>Welcome to ECK UI</h2>}
            layout="vertical"
            body={
              <>
                <p>
                  Elastic Cloud on Kubernetes (ECK) lets you run the entire
                  Elastic Stack natively on Kubernetes. This dashboard will show
                  an overview of all your managed resources once they are
                  deployed.
                </p>
                <p>
                  Get started by creating a full-stack deployment or an
                  individual Elasticsearch cluster.
                </p>
              </>
            }
            actions={[
              <EuiButton
                key="deployment"
                fill
                iconType="plusInCircle"
                onClick={() => navigate('/deployments/create')}
              >
                Create Deployment
              </EuiButton>,
              <EuiButtonEmpty
                key="elasticsearch"
                iconType="logoElasticsearch"
                onClick={() => navigate('/elasticsearch/create')}
              >
                Create Elasticsearch Cluster
              </EuiButtonEmpty>,
            ]}
            footer={
              <EuiFlexGroup
                gutterSize="l"
                justifyContent="center"
                wrap
                responsive={false}
              >
                <EuiFlexItem grow={false}>
                  <EuiLink
                    href="https://www.elastic.co/guide/en/cloud-on-k8s/current/index.html"
                    target="_blank"
                    external
                  >
                    ECK Documentation
                  </EuiLink>
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiLink
                    onClick={() => navigate('/kibana/create')}
                  >
                    Create Kibana
                  </EuiLink>
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiLink
                    onClick={() => navigate('/agent/create')}
                  >
                    Create Elastic Agent
                  </EuiLink>
                </EuiFlexItem>
              </EuiFlexGroup>
            }
          />
        </EuiPanel>
      </>
    );
  }

  // Phase distribution across all resources
  const allItems = resources.flatMap((r) => r.items);
  const phaseCounts = countByPhase(allItems);

  // Recent resources with sorting
  const recentResources: RecentResource[] = resources
    .flatMap((r) =>
      r.items.map((item) => ({
        name: item.metadata.name,
        namespace: item.metadata.namespace,
        type: r.type,
        health: (item.status?.health || 'unknown') as HealthStatus,
        phase: item.status?.phase || 'Unknown',
        created: item.metadata.creationTimestamp,
      })),
    )
    .sort((a, b) => {
      const aVal = a[recentSortField];
      const bVal = b[recentSortField];
      if (recentSortField === 'created') {
        const diff = new Date(a.created).getTime() - new Date(b.created).getTime();
        return recentSortDirection === 'asc' ? diff : -diff;
      }
      const comparison = String(aVal).localeCompare(String(bVal));
      return recentSortDirection === 'asc' ? comparison : -comparison;
    })
    .slice(0, 10);

  // Problem resources: non-Ready phase (missing phase with green health is not a problem)
  const problemResources: ProblemResource[] = resources
    .flatMap((r) =>
      r.items
        .filter((item) => {
          const phase = item.status?.phase;
          if (!phase) {
            // Some CRDs (Kibana, Agent) don't set a phase field.
            // Only flag as problem if health isn't green.
            return item.status?.health != null && item.status.health !== 'green';
          }
          return phase !== 'Ready';
        })
        .map((item) => ({
          name: item.metadata.name,
          namespace: item.metadata.namespace,
          type: r.type,
          health: (item.status?.health || 'unknown') as HealthStatus,
          phase: item.status?.phase || 'Unknown',
          message: `Resource is in ${item.status?.phase || 'Unknown'} phase`,
        })),
    );

  const summaryColumns: EuiBasicTableColumn<ResourceSummaryRow>[] = [
    {
      field: 'label',
      name: 'Resource Type',
      render: (label: string, item: ResourceSummaryRow) => (
        <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
          <EuiFlexItem grow={false}>
            <EuiIcon type={item.icon} size="m" />
          </EuiFlexItem>
          <EuiFlexItem>{label}</EuiFlexItem>
        </EuiFlexGroup>
      ),
    },
    { field: 'total', name: 'Total', width: '80px', align: 'right' as const },
    {
      field: 'healthy',
      name: 'Healthy',
      width: '80px',
      align: 'right' as const,
      render: (val: number) => (
        <EuiHealth color="success">{val}</EuiHealth>
      ),
    },
    {
      field: 'warning',
      name: 'Warning',
      width: '80px',
      align: 'right' as const,
      render: (val: number) => (
        <EuiHealth color="warning">{val}</EuiHealth>
      ),
    },
    {
      field: 'critical',
      name: 'Critical',
      width: '80px',
      align: 'right' as const,
      render: (val: number) => (
        <EuiHealth color="danger">{val}</EuiHealth>
      ),
    },
  ];

  const recentColumns: EuiBasicTableColumn<RecentResource>[] = [
    { field: 'name', name: 'Name', truncateText: true, sortable: true },
    { field: 'namespace', name: 'Namespace', truncateText: true, sortable: true },
    { field: 'type', name: 'Type', sortable: true },
    {
      field: 'health',
      name: 'Health',
      sortable: true,
      render: (health: HealthStatus) => (
        <EuiHealth color={HEALTH_COLORS[health]}>{health}</EuiHealth>
      ),
    },
    {
      field: 'phase',
      name: 'Phase',
      sortable: true,
      render: (phase: string) => (
        <EuiBadge color={PHASE_COLORS[phase] || 'default'}>{phase}</EuiBadge>
      ),
    },
    {
      field: 'created',
      name: 'Created',
      sortable: true,
      render: (ts: string) => new Date(ts).toLocaleString(),
    },
  ];

  const problemColumns: EuiBasicTableColumn<ProblemResource>[] = [
    {
      field: 'name',
      name: 'Name',
      truncateText: true,
      render: (name: string, item: ProblemResource) => (
        <EuiLink
          onClick={() =>
            navigate(`${routePath(item.type)}/${item.namespace}/${name}`)
          }
        >
          {name}
        </EuiLink>
      ),
    },
    { field: 'namespace', name: 'Namespace', truncateText: true },
    { field: 'type', name: 'Type' },
    {
      field: 'health',
      name: 'Health',
      render: (health: HealthStatus) => (
        <EuiHealth color={HEALTH_COLORS[health]}>{health}</EuiHealth>
      ),
    },
    {
      field: 'phase',
      name: 'Phase',
      render: (phase: string) => (
        <EuiBadge color={PHASE_COLORS[phase] || 'default'}>{phase}</EuiBadge>
      ),
    },
    { field: 'message', name: 'Details', truncateText: true },
  ];

  return (
    <>
      <EuiFlexGroup justifyContent="spaceBetween" alignItems="center">
        <EuiFlexItem grow={false}>
          <EuiTitle size="l">
            <h1>Dashboard</h1>
          </EuiTitle>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiSwitch
            label="Auto-refresh"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            compressed
          />
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiSpacer size="l" />

      {/* Summary Stats */}
      <EuiFlexGroup>
        <EuiFlexItem>
          <EuiPanel>
            <EuiStat
              title={totalResources}
              description="Total Resources"
              titleColor="primary"
            />
          </EuiPanel>
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiPanel>
            <EuiStat
              title={totalHealthy}
              description="Healthy"
              titleColor="success"
            />
          </EuiPanel>
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiPanel>
            <EuiStat
              title={totalWarning}
              description="Warning"
              titleColor="warning"
            />
          </EuiPanel>
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiPanel>
            <EuiStat
              title={totalCritical}
              description="Critical"
              titleColor="danger"
            />
          </EuiPanel>
        </EuiFlexItem>
      </EuiFlexGroup>

      <EuiSpacer size="l" />

      {/* Phase Distribution */}
      <EuiPanel>
        <EuiTitle size="s">
          <h3>Phase Distribution</h3>
        </EuiTitle>
        <EuiSpacer size="m" />
        <EuiFlexGroup gutterSize="s" wrap responsive={false}>
          {Object.entries(phaseCounts).map(([phase, count]) => (
            <EuiFlexItem grow={false} key={phase}>
              <EuiBadge color={PHASE_COLORS[phase] || 'default'}>
                {phase}: {count}
              </EuiBadge>
            </EuiFlexItem>
          ))}
        </EuiFlexGroup>
      </EuiPanel>

      <EuiSpacer size="xl" />

      {/* Problem Resources */}
      {problemResources.length > 0 && (
        <>
          <EuiTitle size="m">
            <h2>Problem Resources</h2>
          </EuiTitle>
          <EuiSpacer size="m" />
          <EuiPanel color="danger" hasBorder>
            <EuiBasicTable
              items={problemResources}
              columns={problemColumns}
              noItemsMessage="All resources are healthy"
            />
          </EuiPanel>
          <EuiSpacer size="xl" />
        </>
      )}

      {/* Resource Summary */}
      <EuiTitle size="m">
        <h2>Resource Summary</h2>
      </EuiTitle>
      <EuiSpacer size="m" />
      <EuiBasicTable
        items={summaryRows.filter((r) => r.total > 0)}
        columns={summaryColumns}
        rowProps={(item: ResourceSummaryRow) => ({
          onClick: () => navigate(routePath(item.type)),
          style: { cursor: 'pointer' },
        })}
        noItemsMessage="No resources found"
      />

      <EuiSpacer size="xl" />

      {/* Recent Resources */}
      <EuiTitle size="m">
        <h2>Recent Resources</h2>
      </EuiTitle>
      <EuiSpacer size="m" />
      <EuiBasicTable
        items={recentResources}
        columns={recentColumns}
        sorting={{
          sort: {
            field: recentSortField,
            direction: recentSortDirection,
          },
        }}
        onChange={onRecentTableChange}
        rowProps={(item: RecentResource) => ({
          onClick: () =>
            navigate(
              `${routePath(item.type)}/${item.namespace}/${item.name}`,
            ),
          style: { cursor: 'pointer' },
        })}
        noItemsMessage="No resources found"
      />
    </>
  );
}
