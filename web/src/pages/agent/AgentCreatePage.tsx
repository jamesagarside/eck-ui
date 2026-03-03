// Elastic Agent Create Page
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EuiPageTemplate,
  EuiPageHeader,
  EuiButton,
  EuiButtonEmpty,
  EuiForm,
  EuiFormRow,
  EuiFieldText,
  EuiFieldNumber,
  EuiSelect,
  EuiSpacer,
  EuiPanel,
  EuiTitle,
  EuiCallOut,
  EuiFlexGroup,
  EuiFlexItem,
  EuiSwitch,
  EuiTabbedContent,
  EuiCodeBlock,
  EuiComboBox,
  EuiText,
  EuiRadioGroup,
} from '@elastic/eui';
import type { EuiComboBoxOptionOption } from '@elastic/eui';
import {
  useCreateAgent,
  useNamespaces,
  useElasticsearchList,
  useKibanaList,
} from '../../hooks/useResources';
import type { ElasticAgent, ElasticsearchCluster, KibanaInstance } from '../../types/resources';
import jsYaml from 'js-yaml';

// Agent versions
const versionOptions = [
  { value: '8.17.0', text: '8.17.0 (Latest)' },
  { value: '8.16.0', text: '8.16.0' },
  { value: '8.15.0', text: '8.15.0' },
  { value: '8.14.0', text: '8.14.0' },
  { value: '8.13.0', text: '8.13.0' },
  { value: '8.12.0', text: '8.12.0' },
  { value: '7.17.0', text: '7.17.0 (7.x LTS)' },
];

// Mode options
const modeOptions = [
  {
    id: 'fleet',
    label: 'Fleet Managed',
  },
  {
    id: 'standalone',
    label: 'Standalone',
  },
];

// Deployment type options
const deploymentTypeOptions = [
  {
    id: 'daemonset',
    label: 'DaemonSet (one per node)',
  },
  {
    id: 'deployment',
    label: 'Deployment (fixed replicas)',
  },
];

interface FormData {
  name: string;
  namespace: string;
  version: string;
  mode: 'fleet' | 'standalone';
  deploymentType: 'daemonset' | 'deployment';
  replicas: number;
  elasticsearchRef: { name: string; namespace?: string } | null;
  kibanaRef: { name: string; namespace?: string } | null;
  fleetServerRef: { name: string; namespace?: string } | null;
  isFleetServer: boolean;
}

interface ValidationErrors {
  [key: string]: string;
}

const initialFormData: FormData = {
  name: '',
  namespace: 'default',
  version: '8.17.0',
  mode: 'standalone',
  deploymentType: 'daemonset',
  replicas: 1,
  elasticsearchRef: null,
  kibanaRef: null,
  fleetServerRef: null,
  isFleetServer: false,
};

function validateForm(data: FormData): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!data.name) {
    errors.name = 'Name is required';
  } else if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(data.name) && data.name.length > 1) {
    errors.name = 'Name must be lowercase alphanumeric with hyphens';
  } else if (data.name.length === 1 && !/^[a-z0-9]$/.test(data.name)) {
    errors.name = 'Name must be lowercase alphanumeric';
  }

  if (!data.namespace) {
    errors.namespace = 'Namespace is required';
  }

  if (data.deploymentType === 'deployment' && data.replicas < 1) {
    errors.replicas = 'Replicas must be at least 1';
  }

  if (data.mode === 'fleet' && !data.isFleetServer && !data.fleetServerRef) {
    errors.fleetServerRef = 'Fleet Server is required for Fleet managed agents';
  }

  return errors;
}

function buildSpec(data: FormData): ElasticAgent {
  const spec: ElasticAgent = {
    apiVersion: 'agent.k8s.elastic.co/v1alpha1',
    kind: 'Agent',
    metadata: {
      name: data.name,
      namespace: data.namespace,
    },
    spec: {
      version: data.version,
      mode: data.mode,
      elasticsearchRefs: data.elasticsearchRef ? [data.elasticsearchRef] : undefined,
      kibanaRef: data.kibanaRef || undefined,
      fleetServerRef: data.mode === 'fleet' && !data.isFleetServer ? data.fleetServerRef || undefined : undefined,
    },
  };

  if (data.deploymentType === 'daemonset') {
    spec.spec.daemonSet = {};
  } else {
    spec.spec.deployment = {
      replicas: data.replicas,
    };
  }

  return spec;
}

export function AgentCreatePage() {
  const navigate = useNavigate();
  const createMutation = useCreateAgent();
  const { data: nsData } = useNamespaces();
  const { data: esData } = useElasticsearchList();
  const { data: kibanaData } = useKibanaList();

  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [selectedEs, setSelectedEs] = useState<EuiComboBoxOptionOption[]>([]);
  const [selectedKibana, setSelectedKibana] = useState<EuiComboBoxOptionOption[]>([]);
  const [selectedFleetServer, setSelectedFleetServer] = useState<EuiComboBoxOptionOption[]>([]);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Build namespace options
  const namespaceOptions = useMemo(() => {
    const namespaces = nsData ?? [];
    return namespaces
      .filter((ns) => ns.metadata?.name)
      .map((ns) => ({ value: ns.metadata!.name, text: ns.metadata!.name }));
  }, [nsData]);

  // Build ES options
  const esOptions = useMemo((): EuiComboBoxOptionOption[] => {
    const clusters = (esData?.data ?? []) as ElasticsearchCluster[];
    return clusters.map((cluster) => ({
      label: `${cluster.metadata.name} (${cluster.metadata.namespace})`,
      key: `${cluster.metadata.namespace}/${cluster.metadata.name}`,
    }));
  }, [esData]);

  // Build Kibana options
  const kibanaOptions = useMemo((): EuiComboBoxOptionOption[] => {
    const instances = (kibanaData?.data ?? []) as KibanaInstance[];
    return instances.map((instance) => ({
      label: `${instance.metadata.name} (${instance.metadata.namespace})`,
      key: `${instance.metadata.namespace}/${instance.metadata.name}`,
    }));
  }, [kibanaData]);

  // For Fleet Server reference, we'd list existing Fleet Server agents
  // For now, use same structure as ES
  const fleetServerOptions = useMemo((): EuiComboBoxOptionOption[] => {
    // In a real implementation, this would filter to agents that are Fleet Servers
    return esOptions.map((opt) => ({
      ...opt,
      label: opt.label.replace('elasticsearch', 'fleet-server'),
    }));
  }, [esOptions]);

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleEsChange = (selected: EuiComboBoxOptionOption[]) => {
    setSelectedEs(selected);
    if (selected.length > 0 && selected[0].key) {
      const [ns, esName] = selected[0].key.split('/');
      updateField('elasticsearchRef', { name: esName, namespace: ns });
    } else {
      updateField('elasticsearchRef', null);
    }
  };

  const handleKibanaChange = (selected: EuiComboBoxOptionOption[]) => {
    setSelectedKibana(selected);
    if (selected.length > 0 && selected[0].key) {
      const [ns, kibanaName] = selected[0].key.split('/');
      updateField('kibanaRef', { name: kibanaName, namespace: ns });
    } else {
      updateField('kibanaRef', null);
    }
  };

  const handleFleetServerChange = (selected: EuiComboBoxOptionOption[]) => {
    setSelectedFleetServer(selected);
    if (selected.length > 0 && selected[0].key) {
      const [ns, fleetName] = selected[0].key.split('/');
      updateField('fleetServerRef', { name: fleetName, namespace: ns });
    } else {
      updateField('fleetServerRef', null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const validationErrors = validateForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const spec = buildSpec(formData);

    try {
      await createMutation.mutateAsync({
        namespace: formData.namespace,
        data: spec,
      });
      navigate(`/agent/${formData.namespace}/${formData.name}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create Agent');
    }
  };

  const previewYaml = jsYaml.dump(buildSpec(formData), { indent: 2, lineWidth: -1 });

  const formTab = {
    id: 'form',
    name: 'Form',
    content: (
      <>
        <EuiSpacer size="m" />
        <EuiForm component="form" onSubmit={handleSubmit}>
          {submitError && (
            <>
              <EuiCallOut title="Error creating Agent" color="danger" iconType="error">
                <p>{submitError}</p>
              </EuiCallOut>
              <EuiSpacer size="m" />
            </>
          )}

          {/* Basic Info */}
          <EuiPanel>
            <EuiTitle size="xs">
              <h3>Basic Information</h3>
            </EuiTitle>
            <EuiSpacer size="m" />

            <EuiFlexGroup>
              <EuiFlexItem>
                <EuiFormRow
                  label="Name"
                  helpText="Unique name for the Agent"
                  isInvalid={!!errors.name}
                  error={errors.name}
                >
                  <EuiFieldText
                    value={formData.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    isInvalid={!!errors.name}
                    placeholder="my-agent"
                  />
                </EuiFormRow>
              </EuiFlexItem>
              <EuiFlexItem>
                <EuiFormRow
                  label="Namespace"
                  helpText="Kubernetes namespace"
                  isInvalid={!!errors.namespace}
                  error={errors.namespace}
                >
                  <EuiSelect
                    options={namespaceOptions}
                    value={formData.namespace}
                    onChange={(e) => updateField('namespace', e.target.value)}
                    isInvalid={!!errors.namespace}
                  />
                </EuiFormRow>
              </EuiFlexItem>
              <EuiFlexItem>
                <EuiFormRow
                  label="Version"
                  helpText="Elastic Agent version"
                >
                  <EuiSelect
                    options={versionOptions}
                    value={formData.version}
                    onChange={(e) => updateField('version', e.target.value)}
                  />
                </EuiFormRow>
              </EuiFlexItem>
            </EuiFlexGroup>
          </EuiPanel>

          <EuiSpacer size="l" />

          {/* Mode Selection */}
          <EuiPanel>
            <EuiTitle size="xs">
              <h3>Agent Mode</h3>
            </EuiTitle>
            <EuiSpacer size="m" />

            <EuiFormRow
              helpText="Fleet managed agents are controlled through Kibana Fleet"
            >
              <EuiRadioGroup
                options={modeOptions}
                idSelected={formData.mode}
                onChange={(id) => updateField('mode', id as 'fleet' | 'standalone')}
              />
            </EuiFormRow>

            {formData.mode === 'fleet' && (
              <>
                <EuiSpacer size="m" />
                <EuiFormRow helpText="Check this if this agent will act as a Fleet Server">
                  <EuiSwitch
                    label="This is a Fleet Server"
                    checked={formData.isFleetServer}
                    onChange={(e) => updateField('isFleetServer', e.target.checked)}
                  />
                </EuiFormRow>

                {!formData.isFleetServer && (
                  <>
                    <EuiSpacer size="m" />
                    <EuiFormRow
                      label="Fleet Server"
                      helpText="Select the Fleet Server this agent will connect to"
                      isInvalid={!!errors.fleetServerRef}
                      error={errors.fleetServerRef}
                    >
                      <EuiComboBox
                        placeholder="Select a Fleet Server"
                        singleSelection={{ asPlainText: true }}
                        options={fleetServerOptions}
                        selectedOptions={selectedFleetServer}
                        onChange={handleFleetServerChange}
                        isInvalid={!!errors.fleetServerRef}
                      />
                    </EuiFormRow>
                  </>
                )}
              </>
            )}
          </EuiPanel>

          <EuiSpacer size="l" />

          {/* Deployment Configuration */}
          <EuiPanel>
            <EuiTitle size="xs">
              <h3>Deployment</h3>
            </EuiTitle>
            <EuiSpacer size="m" />

            <EuiFormRow
              helpText="Choose how the agent pods are deployed"
            >
              <EuiRadioGroup
                options={deploymentTypeOptions}
                idSelected={formData.deploymentType}
                onChange={(id) => updateField('deploymentType', id as 'daemonset' | 'deployment')}
              />
            </EuiFormRow>

            {formData.deploymentType === 'deployment' && (
              <>
                <EuiSpacer size="m" />
                <EuiFormRow
                  label="Replicas"
                  helpText="Number of agent pods"
                  isInvalid={!!errors.replicas}
                  error={errors.replicas}
                >
                  <EuiFieldNumber
                    value={formData.replicas}
                    min={1}
                    max={10}
                    onChange={(e) => updateField('replicas', parseInt(e.target.value) || 1)}
                    isInvalid={!!errors.replicas}
                  />
                </EuiFormRow>
              </>
            )}
          </EuiPanel>

          <EuiSpacer size="l" />

          {/* Associations */}
          <EuiPanel>
            <EuiTitle size="xs">
              <h3>Associations</h3>
            </EuiTitle>
            <EuiSpacer size="m" />

            <EuiFormRow
              label="Elasticsearch Cluster"
              helpText="Cluster to send data to (for standalone mode)"
            >
              <EuiComboBox
                placeholder="Select an Elasticsearch cluster"
                singleSelection={{ asPlainText: true }}
                options={esOptions}
                selectedOptions={selectedEs}
                onChange={handleEsChange}
                isClearable
              />
            </EuiFormRow>

            <EuiSpacer size="m" />

            <EuiFormRow
              label="Kibana Instance"
              helpText="Required for Fleet mode setup"
            >
              <EuiComboBox
                placeholder="Select a Kibana instance"
                singleSelection={{ asPlainText: true }}
                options={kibanaOptions}
                selectedOptions={selectedKibana}
                onChange={handleKibanaChange}
                isClearable
              />
            </EuiFormRow>

            {formData.mode === 'fleet' && formData.isFleetServer && (
              <>
                <EuiSpacer size="m" />
                <EuiCallOut title="Fleet Server Setup" color="primary" iconType="fleetApp">
                  <EuiText size="s">
                    <p>
                      This agent will be configured as a Fleet Server. After deployment,
                      you can enroll other agents to this Fleet Server through Kibana Fleet.
                    </p>
                  </EuiText>
                </EuiCallOut>
              </>
            )}
          </EuiPanel>

          <EuiSpacer size="l" />

          <EuiFlexGroup justifyContent="flexEnd">
            <EuiFlexItem grow={false}>
              <EuiButtonEmpty onClick={() => navigate('/agent')}>Cancel</EuiButtonEmpty>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiButton
                type="submit"
                fill
                isLoading={createMutation.isPending}
                disabled={Object.keys(errors).length > 0}
              >
                Create Agent
              </EuiButton>
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiForm>
      </>
    ),
  };

  const yamlTab = {
    id: 'yaml',
    name: 'YAML Preview',
    content: (
      <>
        <EuiSpacer size="m" />
        <EuiCodeBlock language="yaml" fontSize="s" paddingSize="m" isCopyable>
          {previewYaml}
        </EuiCodeBlock>
      </>
    ),
  };

  return (
    <EuiPageTemplate>
      <EuiPageHeader
        pageTitle="Create Elastic Agent"
        breadcrumbs={[
          {
            text: 'Elastic Agents',
            href: '#',
            onClick: (e) => {
              e.preventDefault();
              navigate('/agent');
            },
          },
          { text: 'Create' },
        ]}
        description="Deploy a new Elastic Agent to collect data"
      />

      <EuiPageTemplate.Section>
        <EuiTabbedContent
          tabs={[formTab, yamlTab]}
          initialSelectedTab={formTab}
          autoFocus="selected"
        />
      </EuiPageTemplate.Section>
    </EuiPageTemplate>
  );
}
