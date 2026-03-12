import { EuiEmptyPrompt, EuiButton, EuiButtonEmpty } from '@elastic/eui';

interface ResourceEmptyStateProps {
  resourceType: string;
  resourceLabel: string;
  description?: string;
  onCreate: () => void;
  onCreateDeployment?: () => void;
}

interface NoResultsEmptyStateProps {
  onClearFilters: () => void;
}

const RESOURCE_DESCRIPTIONS: Record<string, string> = {
  elasticsearch:
    'Elasticsearch is a distributed search and analytics engine. Create a cluster to store, search, and analyze your data.',
  kibana:
    'Kibana is the visualization layer for Elasticsearch. Create an instance to explore and visualize your data.',
  apm: 'APM Server receives data from Elastic APM agents and transforms it for Elasticsearch.',
  beat: 'Beats are lightweight data shippers for forwarding data to Elasticsearch.',
  agent: 'Elastic Agent is a unified way to collect data from your infrastructure.',
  logstash:
    'Logstash is a server-side data processing pipeline that ingests data, transforms it, and sends it to Elasticsearch.',
  'enterprise-search':
    'Enterprise Search provides search experiences for your applications and workplace.',
  maps: 'Elastic Maps Server hosts map tiles for use with Kibana Maps.',
  'fleet-server':
    'Fleet Server is the central management server for Elastic Agents, enabling policy distribution and data routing.',
};

const RESOURCE_ICONS: Record<string, string> = {
  elasticsearch: 'logoElasticsearch',
  kibana: 'logoKibana',
  apm: 'apmApp',
  beat: 'logoBeats',
  agent: 'agentApp',
  logstash: 'logoLogstash',
  'enterprise-search': 'logoEnterpriseSearch',
  maps: 'logoMaps',
  'fleet-server': 'fleetApp',
};

const RESOURCE_TITLES: Record<string, string> = {
  elasticsearch: 'No Elasticsearch clusters',
};

export function ResourceEmptyState({
  resourceType,
  resourceLabel,
  description,
  onCreate,
  onCreateDeployment,
}: ResourceEmptyStateProps) {
  const iconType = RESOURCE_ICONS[resourceType] || 'logoElastic';
  const body = description || RESOURCE_DESCRIPTIONS[resourceType] || '';
  const title = RESOURCE_TITLES[resourceType] || `No ${resourceLabel} found`;

  return (
    <EuiEmptyPrompt
      iconType={iconType}
      title={<h2>{title}</h2>}
      body={body ? <p>{body}</p> : undefined}
      actions={
        onCreateDeployment
          ? [
              <EuiButton key="create" fill iconType="plusInCircle" onClick={onCreate}>
                Create {resourceLabel}
              </EuiButton>,
              <EuiButtonEmpty key="deployment" onClick={onCreateDeployment}>
                Create Deployment
              </EuiButtonEmpty>,
            ]
          : [
              <EuiButton key="create" fill iconType="plusInCircle" onClick={onCreate}>
                Create {resourceLabel}
              </EuiButton>,
            ]
      }
    />
  );
}

export function NoResultsEmptyState({ onClearFilters }: NoResultsEmptyStateProps) {
  return (
    <EuiEmptyPrompt
      iconType="search"
      title={<h2>No results found</h2>}
      body={<p>Try adjusting your search or filter criteria.</p>}
      actions={
        <EuiButtonEmpty onClick={onClearFilters}>Clear filters</EuiButtonEmpty>
      }
    />
  );
}
