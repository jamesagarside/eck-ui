// Dashboard Page - ECK Overview
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EuiPageTemplate,
  EuiPageHeader,
  EuiButton,
  EuiFlexGroup,
  EuiFlexItem,
  EuiPanel,
  EuiTitle,
  EuiText,
  EuiStat,
  EuiHealth,
  EuiSpacer,
  EuiCallOut,
  EuiIcon,
  EuiCard,
  EuiBasicTable,
  EuiLink,
  EuiBadge,
  EuiLoadingSpinner,
  EuiEmptyPrompt,
} from '@elastic/eui';
import type { EuiBasicTableColumn } from '@elastic/eui';
import {
  useElasticsearchList,
  useKibanaList,
  useApmList,
  useAgentList,
  useBeatList,
  useLogstashList,
} from '../../hooks/useResources';

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

interface ResourceSummary {
  name: string;
  namespace: string;
  health: HealthStatus;
  type: string;
  path: string;
}

export function DashboardPage() {
  const navigate = useNavigate();

  // Fetch all resources
  const { data: esData, isLoading: esLoading } = useElasticsearchList();
  const { data: kibanaData, isLoading: kibanaLoading } = useKibanaList();
  const { data: apmData, isLoading: apmLoading } = useApmList();
  const { data: agentData, isLoading: agentLoading } = useAgentList();
  const { data: beatData, isLoading: beatLoading } = useBeatList();
  const { data: logstashData, isLoading: logstashLoading } = useLogstashList();

  const isLoading =
    esLoading || kibanaLoading || apmLoading || agentLoading || beatLoading || logstashLoading;

  // Calculate health summaries
  const healthSummary = useMemo(() => {
    const summary = { green: 0, yellow: 0, red: 0, unknown: 0 };
    const allResources: Array<{ status?: { health?: string } }> = [
      ...((esData?.data as Array<{ status?: { health?: string } }>) || []),
      ...((kibanaData?.data as Array<{ status?: { health?: string } }>) || []),
      ...((apmData?.data as Array<{ status?: { health?: string } }>) || []),
      ...((agentData?.data as Array<{ status?: { health?: string } }>) || []),
      ...((beatData?.data as Array<{ status?: { health?: string } }>) || []),
      ...((logstashData?.data as Array<{ status?: { health?: string } }>) || []),
    ];

    allResources.forEach((r) => {
      const health = (r?.status?.health as HealthStatus) || 'unknown';
      summary[health]++;
    });

    return summary;
  }, [esData, kibanaData, apmData, agentData, beatData, logstashData]);

  // Resource counts by type
  const resourceCounts = useMemo(
    () => ({
      elasticsearch: (esData?.data || []).length,
      kibana: (kibanaData?.data || []).length,
      apm: (apmData?.data || []).length,
      agent: (agentData?.data || []).length,
      beat: (beatData?.data || []).length,
      logstash: (logstashData?.data || []).length,
    }),
    [esData, kibanaData, apmData, agentData, beatData, logstashData]
  );

  const totalResources = Object.values(resourceCounts).reduce((a, b) => a + b, 0);

  // Recent resources (last 5)
  const recentResources = useMemo((): ResourceSummary[] => {
    interface ResourceWithMeta {
      metadata: { name: string; namespace: string; creationTimestamp?: string };
      status?: { health?: string };
    }
    const allResources: Array<{ resource: ResourceWithMeta; type: string; path: string }> = [
      ...((esData?.data || []) as ResourceWithMeta[]).map((r) => ({
        resource: r,
        type: 'Elasticsearch',
        path: '/elasticsearch',
      })),
      ...((kibanaData?.data || []) as ResourceWithMeta[]).map((r) => ({
        resource: r,
        type: 'Kibana',
        path: '/kibana',
      })),
      ...((apmData?.data || []) as ResourceWithMeta[]).map((r) => ({
        resource: r,
        type: 'APM',
        path: '/apm',
      })),
      ...((agentData?.data || []) as ResourceWithMeta[]).map((r) => ({
        resource: r,
        type: 'Agent',
        path: '/agent',
      })),
      ...((beatData?.data || []) as ResourceWithMeta[]).map((r) => ({
        resource: r,
        type: 'Beat',
        path: '/beats',
      })),
      ...((logstashData?.data || []) as ResourceWithMeta[]).map((r) => ({
        resource: r,
        type: 'Logstash',
        path: '/logstash',
      })),
    ];

    return allResources
      .sort((a, b) => {
        const dateA = new Date(a.resource.metadata.creationTimestamp || 0);
        const dateB = new Date(b.resource.metadata.creationTimestamp || 0);
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 5)
      .map((item) => ({
        name: item.resource.metadata.name,
        namespace: item.resource.metadata.namespace,
        health: (item.resource.status?.health as HealthStatus) || 'unknown',
        type: item.type,
        path: item.path,
      }));
  }, [esData, kibanaData, apmData, agentData, beatData, logstashData]);

  // Unhealthy resources
  const unhealthyResources = useMemo((): ResourceSummary[] => {
    interface ResourceWithMeta {
      metadata: { name: string; namespace: string };
      status?: { health?: string };
    }
    const allResources: Array<{ resource: ResourceWithMeta; type: string; path: string }> = [
      ...((esData?.data || []) as ResourceWithMeta[]).map((r) => ({
        resource: r,
        type: 'Elasticsearch',
        path: '/elasticsearch',
      })),
      ...((kibanaData?.data || []) as ResourceWithMeta[]).map((r) => ({
        resource: r,
        type: 'Kibana',
        path: '/kibana',
      })),
      ...((apmData?.data || []) as ResourceWithMeta[]).map((r) => ({
        resource: r,
        type: 'APM',
        path: '/apm',
      })),
      ...((agentData?.data || []) as ResourceWithMeta[]).map((r) => ({
        resource: r,
        type: 'Agent',
        path: '/agent',
      })),
      ...((beatData?.data || []) as ResourceWithMeta[]).map((r) => ({
        resource: r,
        type: 'Beat',
        path: '/beats',
      })),
      ...((logstashData?.data || []) as ResourceWithMeta[]).map((r) => ({
        resource: r,
        type: 'Logstash',
        path: '/logstash',
      })),
    ];

    return allResources
      .filter((item) => {
        const health = item.resource.status?.health;
        return health === 'red' || health === 'yellow';
      })
      .map((item) => ({
        name: item.resource.metadata.name,
        namespace: item.resource.metadata.namespace,
        health: (item.resource.status?.health as HealthStatus) || 'unknown',
        type: item.type,
        path: item.path,
      }));
  }, [esData, kibanaData, apmData, agentData, beatData, logstashData]);

  const recentColumns: EuiBasicTableColumn<ResourceSummary>[] = [
    {
      field: 'name',
      name: 'Name',
      render: (name: string, item: ResourceSummary) => (
        <EuiLink onClick={() => navigate(`${item.path}/${item.namespace}/${name}`)}>{name}</EuiLink>
      ),
    },
    {
      field: 'type',
      name: 'Type',
      render: (type: string) => <EuiBadge color="hollow">{type}</EuiBadge>,
    },
    {
      field: 'namespace',
      name: 'Namespace',
    },
    {
      field: 'health',
      name: 'Health',
      render: (health: HealthStatus) => (
        <EuiHealth color={getHealthColor(health)}>{health}</EuiHealth>
      ),
    },
  ];

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

  // Empty state
  if (totalResources === 0) {
    return (
      <EuiPageTemplate>
        <EuiPageHeader
          pageTitle="ECK Dashboard"
          description="Overview of your Elastic Cloud on Kubernetes deployments"
        />
        <EuiPageTemplate.Section>
          <EuiEmptyPrompt
            iconType="logoElastic"
            title={<h2>Welcome to ECK UI</h2>}
            body={
              <p>
                Get started by deploying your first Elastic Stack. Use the wizard to configure
                Elasticsearch, Kibana, and optional integrations.
              </p>
            }
            actions={[
              <EuiButton key="wizard" fill iconType="plus" onClick={() => navigate('/wizard')}>
                Deploy Stack
              </EuiButton>,
              <EuiButton key="es" onClick={() => navigate('/elasticsearch/create')}>
                Create Elasticsearch
              </EuiButton>,
            ]}
          />
        </EuiPageTemplate.Section>
      </EuiPageTemplate>
    );
  }

  return (
    <EuiPageTemplate>
      <EuiPageHeader
        pageTitle="ECK Dashboard"
        description="Overview of your Elastic Cloud on Kubernetes deployments"
        rightSideItems={[
          <EuiButton key="wizard" fill iconType="plus" onClick={() => navigate('/wizard')}>
            Deploy Stack
          </EuiButton>,
        ]}
      />

      <EuiPageTemplate.Section>
        {/* Alerts */}
        {unhealthyResources.length > 0 && (
          <>
            <EuiCallOut
              title={`${unhealthyResources.length} resource(s) need attention`}
              color="warning"
              iconType="warning"
            >
              <p>Some resources are in a degraded state. Click below to view details.</p>
            </EuiCallOut>
            <EuiSpacer size="l" />
          </>
        )}

        {/* Health Overview */}
        <EuiFlexGroup>
          <EuiFlexItem>
            <EuiPanel hasBorder>
              <EuiFlexGroup alignItems="center" gutterSize="m">
                <EuiFlexItem grow={false}>
                  <EuiIcon type="heart" size="xl" color="success" />
                </EuiFlexItem>
                <EuiFlexItem>
                  <EuiTitle size="xs">
                    <h3>Health Overview</h3>
                  </EuiTitle>
                </EuiFlexItem>
              </EuiFlexGroup>
              <EuiSpacer size="m" />
              <EuiFlexGroup>
                <EuiFlexItem>
                  <EuiStat
                    title={healthSummary.green}
                    description="Healthy"
                    titleColor="success"
                    titleSize="m"
                  />
                </EuiFlexItem>
                <EuiFlexItem>
                  <EuiStat
                    title={healthSummary.yellow}
                    description="Degraded"
                    titleColor="warning"
                    titleSize="m"
                  />
                </EuiFlexItem>
                <EuiFlexItem>
                  <EuiStat
                    title={healthSummary.red}
                    description="Critical"
                    titleColor="danger"
                    titleSize="m"
                  />
                </EuiFlexItem>
                <EuiFlexItem>
                  <EuiStat
                    title={healthSummary.unknown}
                    description="Unknown"
                    titleColor="subdued"
                    titleSize="m"
                  />
                </EuiFlexItem>
              </EuiFlexGroup>
            </EuiPanel>
          </EuiFlexItem>
        </EuiFlexGroup>

        <EuiSpacer size="l" />

        {/* Resource Cards */}
        <EuiTitle size="xs">
          <h3>Resources by Type</h3>
        </EuiTitle>
        <EuiSpacer size="m" />
        <EuiFlexGroup wrap gutterSize="m">
          <EuiFlexItem grow={false} style={{ width: 180 }}>
            <EuiCard
              icon={<EuiIcon type="logoElasticsearch" size="xl" />}
              title={String(resourceCounts.elasticsearch)}
              description="Elasticsearch"
              onClick={() => navigate('/elasticsearch')}
              hasBorder
            />
          </EuiFlexItem>
          <EuiFlexItem grow={false} style={{ width: 180 }}>
            <EuiCard
              icon={<EuiIcon type="logoKibana" size="xl" />}
              title={String(resourceCounts.kibana)}
              description="Kibana"
              onClick={() => navigate('/kibana')}
              hasBorder
            />
          </EuiFlexItem>
          <EuiFlexItem grow={false} style={{ width: 180 }}>
            <EuiCard
              icon={<EuiIcon type="apmApp" size="xl" />}
              title={String(resourceCounts.apm)}
              description="APM Server"
              onClick={() => navigate('/apm')}
              hasBorder
            />
          </EuiFlexItem>
          <EuiFlexItem grow={false} style={{ width: 180 }}>
            <EuiCard
              icon={<EuiIcon type="fleetApp" size="xl" />}
              title={String(resourceCounts.agent)}
              description="Elastic Agent"
              onClick={() => navigate('/agent')}
              hasBorder
            />
          </EuiFlexItem>
          <EuiFlexItem grow={false} style={{ width: 180 }}>
            <EuiCard
              icon={<EuiIcon type="logoBeats" size="xl" />}
              title={String(resourceCounts.beat)}
              description="Beats"
              onClick={() => navigate('/beats')}
              hasBorder
            />
          </EuiFlexItem>
          <EuiFlexItem grow={false} style={{ width: 180 }}>
            <EuiCard
              icon={<EuiIcon type="logoLogstash" size="xl" />}
              title={String(resourceCounts.logstash)}
              description="Logstash"
              onClick={() => navigate('/logstash')}
              hasBorder
            />
          </EuiFlexItem>
        </EuiFlexGroup>

        <EuiSpacer size="l" />

        {/* Recent Resources */}
        <EuiFlexGroup>
          <EuiFlexItem>
            <EuiPanel hasBorder>
              <EuiTitle size="xs">
                <h3>Recent Resources</h3>
              </EuiTitle>
              <EuiSpacer size="m" />
              {recentResources.length > 0 ? (
                <EuiBasicTable items={recentResources} columns={recentColumns} />
              ) : (
                <EuiText size="s" color="subdued">
                  No recent resources
                </EuiText>
              )}
            </EuiPanel>
          </EuiFlexItem>

          {/* Unhealthy Resources */}
          {unhealthyResources.length > 0 && (
            <EuiFlexItem>
              <EuiPanel hasBorder color="warning">
                <EuiTitle size="xs">
                  <h3>Resources Needing Attention</h3>
                </EuiTitle>
                <EuiSpacer size="m" />
                <EuiBasicTable items={unhealthyResources} columns={recentColumns} />
              </EuiPanel>
            </EuiFlexItem>
          )}
        </EuiFlexGroup>

        <EuiSpacer size="l" />

        {/* Quick Actions */}
        <EuiPanel hasBorder color="subdued">
          <EuiTitle size="xs">
            <h3>Quick Actions</h3>
          </EuiTitle>
          <EuiSpacer size="m" />
          <EuiFlexGroup wrap gutterSize="m">
            <EuiFlexItem grow={false}>
              <EuiButton iconType="plus" onClick={() => navigate('/elasticsearch/create')}>
                Create Elasticsearch
              </EuiButton>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiButton iconType="plus" onClick={() => navigate('/kibana/create')}>
                Create Kibana
              </EuiButton>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiButton iconType="plus" onClick={() => navigate('/apm/create')}>
                Create APM Server
              </EuiButton>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiButton iconType="plus" onClick={() => navigate('/agent/create')}>
                Create Agent
              </EuiButton>
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiPanel>
      </EuiPageTemplate.Section>
    </EuiPageTemplate>
  );
}
