// Step 4: Review and Deploy
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EuiButton,
  EuiSpacer,
  EuiPanel,
  EuiTitle,
  EuiText,
  EuiFlexGroup,
  EuiFlexItem,
  EuiDescriptionList,
  EuiCodeBlock,
  EuiAccordion,
  EuiIcon,
  EuiCallOut,
  EuiProgress,
  EuiHorizontalRule,
  EuiBadge,
  EuiStat,
} from '@elastic/eui';
import { useWizard } from './WizardContext';
import {
  useCreateElasticsearch,
  useCreateKibana,
  useCreateApmServer,
  useCreateAgent,
  useCreateBeat,
} from '../../hooks/useResources';
import jsYaml from 'js-yaml';

interface DeploymentStatus {
  resource: string;
  status: 'pending' | 'deploying' | 'success' | 'error';
  error?: string;
}

export function ReviewStep() {
  const navigate = useNavigate();
  const { state, reset } = useWizard();
  const { elasticsearch, kibana, apm, fleet, beats } = state;

  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentStatus, setDeploymentStatus] = useState<DeploymentStatus[]>([]);
  const [deploymentComplete, setDeploymentComplete] = useState(false);

  const createElasticsearch = useCreateElasticsearch();
  const createKibana = useCreateKibana();
  const createApmServer = useCreateApmServer();
  const createAgent = useCreateAgent();
  const createBeat = useCreateBeat();

  // Build resource specifications
  const esSpec = useMemo(() => ({
    apiVersion: 'elasticsearch.k8s.elastic.co/v1',
    kind: 'Elasticsearch',
    metadata: {
      name: elasticsearch.name || 'elasticsearch',
      namespace: elasticsearch.namespace,
    },
    spec: {
      version: elasticsearch.version,
      nodeSets: elasticsearch.nodes.map((node) => ({
        name: node.name,
        count: node.count,
        config: {
          'node.roles': node.roles,
        },
        volumeClaimTemplates: [
          {
            metadata: { name: 'elasticsearch-data' },
            spec: {
              accessModes: ['ReadWriteOnce'],
              resources: { requests: { storage: node.storage } },
            },
          },
        ],
        podTemplate: {
          spec: {
            containers: [
              {
                name: 'elasticsearch',
                resources: {
                  requests: { memory: node.memory, cpu: node.cpu },
                  limits: { memory: node.memory, cpu: node.cpu },
                },
              },
            ],
          },
        },
      })),
      http: elasticsearch.tls ? { tls: { selfSignedCertificate: { disabled: false } } } : { tls: { selfSignedCertificate: { disabled: true } } },
    },
  }), [elasticsearch]);

  const kibanaSpec = useMemo(() => {
    if (!kibana) return null;
    return {
      apiVersion: 'kibana.k8s.elastic.co/v1',
      kind: 'Kibana',
      metadata: {
        name: kibana.name || `${elasticsearch.name || 'elasticsearch'}-kb`,
        namespace: elasticsearch.namespace,
      },
      spec: {
        version: elasticsearch.version,
        count: kibana.count,
        elasticsearchRef: { name: elasticsearch.name || 'elasticsearch' },
      },
    };
  }, [kibana, elasticsearch]);

  const apmSpec = useMemo(() => {
    if (!apm) return null;
    return {
      apiVersion: 'apm.k8s.elastic.co/v1',
      kind: 'ApmServer',
      metadata: {
        name: apm.name || `${elasticsearch.name || 'elasticsearch'}-apm`,
        namespace: elasticsearch.namespace,
      },
      spec: {
        version: elasticsearch.version,
        count: apm.count,
        elasticsearchRef: { name: elasticsearch.name || 'elasticsearch' },
        kibanaRef: kibana ? { name: kibana.name || `${elasticsearch.name || 'elasticsearch'}-kb` } : undefined,
        config: apm.rum ? { 'apm-server.rum.enabled': true } : undefined,
      },
    };
  }, [apm, elasticsearch, kibana]);

  const fleetSpec = useMemo(() => {
    if (!fleet) return null;
    return {
      apiVersion: 'agent.k8s.elastic.co/v1alpha1',
      kind: 'Agent',
      metadata: {
        name: fleet.name || `${elasticsearch.name || 'elasticsearch'}-fleet`,
        namespace: elasticsearch.namespace,
      },
      spec: {
        version: elasticsearch.version,
        mode: fleet.mode,
        fleetServerEnabled: true,
        elasticsearchRefs: [{ name: elasticsearch.name || 'elasticsearch' }],
        kibanaRef: kibana ? { name: kibana.name || `${elasticsearch.name || 'elasticsearch'}-kb` } : undefined,
        deployment: { replicas: fleet.count },
      },
    };
  }, [fleet, elasticsearch, kibana]);

  const beatSpecs = useMemo(() => {
    if (!beats) return [];
    return beats.types
      .filter((t) => t.enabled)
      .map((beat) => ({
        apiVersion: 'beat.k8s.elastic.co/v1beta1',
        kind: 'Beat',
        metadata: {
          name: beat.name || `${elasticsearch.name || 'elasticsearch'}-${beat.type}`,
          namespace: elasticsearch.namespace,
        },
        spec: {
          type: beat.type,
          version: elasticsearch.version,
          elasticsearchRef: { name: elasticsearch.name || 'elasticsearch' },
          kibanaRef: kibana ? { name: kibana.name || `${elasticsearch.name || 'elasticsearch'}-kb` } : undefined,
          ...(beat.deployment === 'daemonset'
            ? { daemonSet: {} }
            : { deployment: { replicas: 1 } }),
        },
      }));
  }, [beats, elasticsearch, kibana]);

  // Resource counts and estimates
  const resourceSummary = useMemo(() => {
    let totalPods = 0;
    let totalStorage = '0Gi';
    let totalMemory = '0Gi';

    // Elasticsearch
    elasticsearch.nodes.forEach((node) => {
      totalPods += node.count;
    });
    const esStorage = elasticsearch.nodes.reduce((sum, n) => sum + parseInt(n.storage) * n.count, 0);
    const esMemory = elasticsearch.nodes.reduce((sum, n) => sum + parseInt(n.memory) * n.count, 0);
    totalStorage = `${esStorage}Gi`;
    totalMemory = `${esMemory}Gi`;

    // Kibana
    if (kibana) totalPods += kibana.count;

    // APM
    if (apm) totalPods += apm.count;

    // Fleet
    if (fleet) totalPods += fleet.count;

    // Beats - count DaemonSets as variable
    if (beats) {
      const enabledBeats = beats.types.filter((t) => t.enabled);
      totalPods += enabledBeats.filter((t) => t.deployment === 'deployment').length;
      // DaemonSets scale with nodes
    }

    return { totalPods, totalStorage, totalMemory };
  }, [elasticsearch, kibana, apm, fleet, beats]);

  // Deploy all resources
  const handleDeploy = async () => {
    setIsDeploying(true);
    setDeploymentComplete(false);

    const resources: { name: string; deploy: () => Promise<unknown> }[] = [];

    // Build deployment queue
    resources.push({
      name: 'Elasticsearch',
      deploy: () =>
        createElasticsearch.mutateAsync({
          namespace: elasticsearch.namespace,
          data: esSpec,
        }),
    });

    if (kibanaSpec) {
      resources.push({
        name: 'Kibana',
        deploy: () =>
          createKibana.mutateAsync({
            namespace: elasticsearch.namespace,
            data: kibanaSpec,
          }),
      });
    }

    if (apmSpec) {
      resources.push({
        name: 'APM Server',
        deploy: () =>
          createApmServer.mutateAsync({
            namespace: elasticsearch.namespace,
            data: apmSpec,
          }),
      });
    }

    if (fleetSpec) {
      resources.push({
        name: 'Fleet Server',
        deploy: () =>
          createAgent.mutateAsync({
            namespace: elasticsearch.namespace,
            data: fleetSpec,
          }),
      });
    }

    beatSpecs.forEach((spec, index) => {
      const beatType = beats?.types.find((t) => t.enabled)?.[index]?.type || spec.spec.type;
      resources.push({
        name: `Beat (${beatType})`,
        deploy: () =>
          createBeat.mutateAsync({
            namespace: elasticsearch.namespace,
            data: spec,
          }),
      });
    });

    // Initialize status
    setDeploymentStatus(
      resources.map((r) => ({ resource: r.name, status: 'pending' as const }))
    );

    // Deploy sequentially
    let hasErrors = false;
    for (let i = 0; i < resources.length; i++) {
      const resource = resources[i];

      setDeploymentStatus((prev) =>
        prev.map((s, idx) =>
          idx === i ? { ...s, status: 'deploying' as const } : s
        )
      );

      try {
        await resource.deploy();
        setDeploymentStatus((prev) =>
          prev.map((s, idx) =>
            idx === i ? { ...s, status: 'success' as const } : s
          )
        );
      } catch (error) {
        hasErrors = true;
        const message = error instanceof Error ? error.message : 'Unknown error';
        setDeploymentStatus((prev) =>
          prev.map((s, idx) =>
            idx === i ? { ...s, status: 'error' as const, error: message } : s
          )
        );
      }
    }

    setIsDeploying(false);
    setDeploymentComplete(true);

    if (!hasErrors) {
      // Success - could navigate or show success message
    }
  };

  const handleFinish = () => {
    reset();
    navigate(`/elasticsearch/${elasticsearch.namespace}/${elasticsearch.name || 'elasticsearch'}`);
  };

  const completedCount = deploymentStatus.filter((s) => s.status === 'success').length;
  const totalCount = deploymentStatus.length;

  return (
    <>
      <EuiFlexGroup>
        <EuiFlexItem>
          <EuiPanel>
            <EuiTitle size="xs">
              <h3>Resource Summary</h3>
            </EuiTitle>
            <EuiSpacer size="m" />
            <EuiFlexGroup>
              <EuiFlexItem>
                <EuiStat title={resourceSummary.totalPods} description="Total Pods" titleSize="m" />
              </EuiFlexItem>
              <EuiFlexItem>
                <EuiStat title={resourceSummary.totalStorage} description="Storage" titleSize="m" />
              </EuiFlexItem>
              <EuiFlexItem>
                <EuiStat title={resourceSummary.totalMemory} description="Memory" titleSize="m" />
              </EuiFlexItem>
            </EuiFlexGroup>
          </EuiPanel>
        </EuiFlexItem>
      </EuiFlexGroup>

      <EuiSpacer size="l" />

      <EuiPanel>
        <EuiTitle size="xs">
          <h3>Components to Deploy</h3>
        </EuiTitle>
        <EuiSpacer size="m" />
        <EuiDescriptionList>
          <EuiFlexGroup>
            <EuiFlexItem>
              <EuiIcon type="logoElasticsearch" size="l" />
            </EuiFlexItem>
            <EuiFlexItem grow={6}>
              <strong>Elasticsearch</strong>
              <EuiText size="xs" color="subdued">
                {elasticsearch.nodes.length} node set(s), {elasticsearch.nodes.reduce((s, n) => s + n.count, 0)} total nodes
              </EuiText>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiBadge color="primary">Required</EuiBadge>
            </EuiFlexItem>
          </EuiFlexGroup>

          {kibana && (
            <>
              <EuiHorizontalRule margin="s" />
              <EuiFlexGroup>
                <EuiFlexItem>
                  <EuiIcon type="logoKibana" size="l" />
                </EuiFlexItem>
                <EuiFlexItem grow={6}>
                  <strong>Kibana</strong>
                  <EuiText size="xs" color="subdued">
                    {kibana.count} instance(s)
                  </EuiText>
                </EuiFlexItem>
              </EuiFlexGroup>
            </>
          )}

          {apm && (
            <>
              <EuiHorizontalRule margin="s" />
              <EuiFlexGroup>
                <EuiFlexItem>
                  <EuiIcon type="apmApp" size="l" />
                </EuiFlexItem>
                <EuiFlexItem grow={6}>
                  <strong>APM Server</strong>
                  <EuiText size="xs" color="subdued">
                    {apm.count} instance(s){apm.rum ? ', RUM enabled' : ''}
                  </EuiText>
                </EuiFlexItem>
              </EuiFlexGroup>
            </>
          )}

          {fleet && (
            <>
              <EuiHorizontalRule margin="s" />
              <EuiFlexGroup>
                <EuiFlexItem>
                  <EuiIcon type="fleetApp" size="l" />
                </EuiFlexItem>
                <EuiFlexItem grow={6}>
                  <strong>Fleet Server</strong>
                  <EuiText size="xs" color="subdued">
                    {fleet.count} instance(s), {fleet.mode} mode
                  </EuiText>
                </EuiFlexItem>
              </EuiFlexGroup>
            </>
          )}

          {beats && beats.types.some((t) => t.enabled) && (
            <>
              <EuiHorizontalRule margin="s" />
              <EuiFlexGroup>
                <EuiFlexItem>
                  <EuiIcon type="logoBeats" size="l" />
                </EuiFlexItem>
                <EuiFlexItem grow={6}>
                  <strong>Beats</strong>
                  <EuiText size="xs" color="subdued">
                    {beats.types.filter((t) => t.enabled).map((t) => t.type).join(', ')}
                  </EuiText>
                </EuiFlexItem>
              </EuiFlexGroup>
            </>
          )}
        </EuiDescriptionList>
      </EuiPanel>

      <EuiSpacer size="l" />

      <EuiAccordion id="yaml-preview" buttonContent="View Generated YAML">
        <EuiSpacer size="m" />
        <EuiCodeBlock language="yaml" fontSize="s" paddingSize="m" isCopyable>
          {[
            esSpec,
            kibanaSpec,
            apmSpec,
            fleetSpec,
            ...beatSpecs,
          ]
            .filter(Boolean)
            .map((spec) => jsYaml.dump(spec, { indent: 2, lineWidth: -1 }))
            .join('---\n')}
        </EuiCodeBlock>
      </EuiAccordion>

      {deploymentStatus.length > 0 && (
        <>
          <EuiSpacer size="l" />
          <EuiPanel>
            <EuiTitle size="xs">
              <h3>Deployment Progress</h3>
            </EuiTitle>
            <EuiSpacer size="m" />
            {isDeploying && (
              <>
                <EuiProgress value={completedCount} max={totalCount} size="m" />
                <EuiSpacer size="s" />
              </>
            )}
            {deploymentStatus.map((status, idx) => (
              <EuiFlexGroup key={idx} alignItems="center" gutterSize="s">
                <EuiFlexItem grow={false}>
                  {status.status === 'pending' && <EuiIcon type="dot" color="subdued" />}
                  {status.status === 'deploying' && <EuiIcon type="clock" color="primary" />}
                  {status.status === 'success' && <EuiIcon type="check" color="success" />}
                  {status.status === 'error' && <EuiIcon type="cross" color="danger" />}
                </EuiFlexItem>
                <EuiFlexItem>
                  <EuiText size="s">
                    {status.resource}
                    {status.error && (
                      <EuiText size="xs" color="danger">
                        {status.error}
                      </EuiText>
                    )}
                  </EuiText>
                </EuiFlexItem>
              </EuiFlexGroup>
            ))}
          </EuiPanel>
        </>
      )}

      <EuiSpacer size="l" />

      {deploymentComplete ? (
        <EuiFlexGroup justifyContent="flexEnd">
          <EuiFlexItem grow={false}>
            <EuiButton fill onClick={handleFinish}>
              View Elasticsearch Cluster
            </EuiButton>
          </EuiFlexItem>
        </EuiFlexGroup>
      ) : (
        <EuiCallOut title="Ready to Deploy" iconType="rocket" color="success">
          <p>
            Review the configuration above. When ready, click Deploy to create all resources in
            namespace <strong>{elasticsearch.namespace}</strong>.
          </p>
          <EuiSpacer size="m" />
          <EuiButton
            fill
            onClick={handleDeploy}
            isLoading={isDeploying}
            disabled={isDeploying || !elasticsearch.name}
          >
            {isDeploying ? 'Deploying...' : 'Deploy Stack'}
          </EuiButton>
        </EuiCallOut>
      )}
    </>
  );
}
