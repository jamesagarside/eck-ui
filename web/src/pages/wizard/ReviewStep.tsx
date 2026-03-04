import {
  EuiSpacer,
  EuiButton,
  EuiButtonEmpty,
  EuiFlexGroup,
  EuiFlexItem,
  EuiPanel,
  EuiTitle,
  EuiDescriptionList,
  EuiCallOut,
  EuiBadge,
  EuiText,
} from '@elastic/eui';
import { useNavigate } from 'react-router-dom';
import { useWizard } from './WizardContext';
import { useCreateResource } from '../../hooks/useResources';
import { nodeSetConfigsToSpec } from '../../components/elasticsearch/NodeSetEditor';

export function ReviewStep() {
  const navigate = useNavigate();
  const { state, prevStep, reset } = useWizard();
  const { elasticsearch, kibana, integrations } = state;

  const esCreate = useCreateResource('elasticsearch');
  const kibanaCreate = useCreateResource('kibana');
  const apmCreate = useCreateResource('apm');
  const agentCreate = useCreateResource('agent');

  const isDeploying =
    esCreate.isPending ||
    kibanaCreate.isPending ||
    apmCreate.isPending ||
    agentCreate.isPending;

  const hasError =
    esCreate.isError ||
    kibanaCreate.isError ||
    apmCreate.isError ||
    agentCreate.isError;

  const errorMessage = [
    esCreate.error?.message,
    kibanaCreate.error?.message,
    apmCreate.error?.message,
    agentCreate.error?.message,
  ]
    .filter(Boolean)
    .join('; ');

  const esItems = [
    { title: 'Name', description: elasticsearch.name },
    { title: 'Namespace', description: elasticsearch.namespace },
    { title: 'Version', description: elasticsearch.version },
    {
      title: 'NodeSets',
      description: elasticsearch.nodeSets
        .map((ns) => `${ns.name} (${ns.count} nodes)`)
        .join(', '),
    },
  ];

  const components: string[] = ['Elasticsearch'];
  if (kibana.enabled) components.push('Kibana');
  if (integrations.apm.enabled) components.push('APM Server');
  if (integrations.fleet.enabled) components.push('Fleet Server');

  const handleDeploy = async () => {
    const esResource = {
      apiVersion: 'elasticsearch.k8s.elastic.co/v1',
      kind: 'Elasticsearch',
      metadata: { name: elasticsearch.name, namespace: elasticsearch.namespace },
      spec: {
        version: elasticsearch.version,
        nodeSets: nodeSetConfigsToSpec(elasticsearch.nodeSets),
      },
    };

    await esCreate.mutateAsync(esResource);

    if (kibana.enabled) {
      const kbName = kibana.name || `${elasticsearch.name}-kb`;
      await kibanaCreate.mutateAsync({
        apiVersion: 'kibana.k8s.elastic.co/v1',
        kind: 'Kibana',
        metadata: { name: kbName, namespace: elasticsearch.namespace },
        spec: {
          version: elasticsearch.version,
          count: kibana.count,
          elasticsearchRef: { name: elasticsearch.name },
        },
      });
    }

    if (integrations.apm.enabled) {
      const apmName = integrations.apm.name || `${elasticsearch.name}-apm`;
      await apmCreate.mutateAsync({
        apiVersion: 'apm.k8s.elastic.co/v1',
        kind: 'ApmServer',
        metadata: { name: apmName, namespace: elasticsearch.namespace },
        spec: {
          version: elasticsearch.version,
          count: integrations.apm.count,
          elasticsearchRef: { name: elasticsearch.name },
          ...(kibana.enabled
            ? {
                kibanaRef: {
                  name: kibana.name || `${elasticsearch.name}-kb`,
                },
              }
            : {}),
        },
      });
    }

    if (integrations.fleet.enabled) {
      const fleetName =
        integrations.fleet.name || `${elasticsearch.name}-fleet`;
      await agentCreate.mutateAsync({
        apiVersion: 'agent.k8s.elastic.co/v1alpha1',
        kind: 'Agent',
        metadata: { name: fleetName, namespace: elasticsearch.namespace },
        spec: {
          version: elasticsearch.version,
          mode: 'fleet',
          elasticsearchRefs: [{ name: elasticsearch.name }],
          ...(kibana.enabled
            ? {
                kibanaRef: {
                  name: kibana.name || `${elasticsearch.name}-kb`,
                },
              }
            : {}),
          deployment: { replicas: 1 },
        },
      });
    }

    reset();
    navigate('/');
  };

  return (
    <>
      {hasError && (
        <>
          <EuiCallOut title="Deployment failed" color="danger" iconType="error">
            {errorMessage}
          </EuiCallOut>
          <EuiSpacer size="m" />
        </>
      )}

      <EuiPanel>
        <EuiTitle size="xs">
          <h3>Deployment Summary</h3>
        </EuiTitle>
        <EuiSpacer size="m" />
        <EuiFlexGroup gutterSize="s" wrap>
          {components.map((c) => (
            <EuiFlexItem grow={false} key={c}>
              <EuiBadge color="primary">{c}</EuiBadge>
            </EuiFlexItem>
          ))}
        </EuiFlexGroup>
      </EuiPanel>

      <EuiSpacer size="l" />

      <EuiPanel>
        <EuiTitle size="xs">
          <h3>Elasticsearch</h3>
        </EuiTitle>
        <EuiSpacer size="m" />
        <EuiDescriptionList type="column" listItems={esItems} compressed />
      </EuiPanel>

      {kibana.enabled && (
        <>
          <EuiSpacer size="l" />
          <EuiPanel>
            <EuiTitle size="xs">
              <h3>Kibana</h3>
            </EuiTitle>
            <EuiSpacer size="m" />
            <EuiDescriptionList
              type="column"
              compressed
              listItems={[
                {
                  title: 'Name',
                  description:
                    kibana.name || `${elasticsearch.name}-kb`,
                },
                { title: 'Count', description: String(kibana.count) },
              ]}
            />
          </EuiPanel>
        </>
      )}

      {integrations.apm.enabled && (
        <>
          <EuiSpacer size="l" />
          <EuiPanel>
            <EuiTitle size="xs">
              <h3>APM Server</h3>
            </EuiTitle>
            <EuiSpacer size="m" />
            <EuiDescriptionList
              type="column"
              compressed
              listItems={[
                {
                  title: 'Name',
                  description:
                    integrations.apm.name ||
                    `${elasticsearch.name}-apm`,
                },
                {
                  title: 'Count',
                  description: String(integrations.apm.count),
                },
              ]}
            />
          </EuiPanel>
        </>
      )}

      {integrations.fleet.enabled && (
        <>
          <EuiSpacer size="l" />
          <EuiPanel>
            <EuiTitle size="xs">
              <h3>Fleet Server</h3>
            </EuiTitle>
            <EuiSpacer size="m" />
            <EuiText size="s">
              Name:{' '}
              {integrations.fleet.name ||
                `${elasticsearch.name}-fleet`}
            </EuiText>
          </EuiPanel>
        </>
      )}

      <EuiSpacer size="l" />

      <EuiFlexGroup justifyContent="spaceBetween">
        <EuiFlexItem grow={false}>
          <EuiButtonEmpty onClick={prevStep}>
            Back: Integrations
          </EuiButtonEmpty>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiButton
            fill
            color="success"
            onClick={handleDeploy}
            isLoading={isDeploying}
            iconType="check"
          >
            Deploy Stack
          </EuiButton>
        </EuiFlexItem>
      </EuiFlexGroup>
    </>
  );
}
