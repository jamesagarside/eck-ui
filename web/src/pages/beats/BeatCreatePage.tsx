// Beat Create Page
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
  EuiComboBox,
  EuiTabbedContent,
  EuiCodeBlock,
  EuiSuperSelect,
  EuiRadioGroup,
} from '@elastic/eui';
import type { EuiComboBoxOptionOption, EuiSuperSelectOption } from '@elastic/eui';
import {
  useCreateBeat,
  useNamespaces,
  useElasticsearchList,
  useKibanaList,
} from '../../hooks/useResources';
import type { Beat, ElasticsearchCluster, KibanaInstance } from '../../types/resources';
import jsYaml from 'js-yaml';

// Beat types
const beatTypeOptions: EuiSuperSelectOption<string>[] = [
  {
    value: 'filebeat',
    inputDisplay: 'Filebeat',
    dropdownDisplay: (
      <>
        <strong>Filebeat</strong>
        <EuiSpacer size="xs" />
        <small>Lightweight shipper for logs</small>
      </>
    ),
  },
  {
    value: 'metricbeat',
    inputDisplay: 'Metricbeat',
    dropdownDisplay: (
      <>
        <strong>Metricbeat</strong>
        <EuiSpacer size="xs" />
        <small>Lightweight shipper for metrics</small>
      </>
    ),
  },
  {
    value: 'heartbeat',
    inputDisplay: 'Heartbeat',
    dropdownDisplay: (
      <>
        <strong>Heartbeat</strong>
        <EuiSpacer size="xs" />
        <small>Lightweight daemon for uptime monitoring</small>
      </>
    ),
  },
  {
    value: 'packetbeat',
    inputDisplay: 'Packetbeat',
    dropdownDisplay: (
      <>
        <strong>Packetbeat</strong>
        <EuiSpacer size="xs" />
        <small>Lightweight network packet analyzer</small>
      </>
    ),
  },
  {
    value: 'auditbeat',
    inputDisplay: 'Auditbeat',
    dropdownDisplay: (
      <>
        <strong>Auditbeat</strong>
        <EuiSpacer size="xs" />
        <small>Lightweight audit log shipper</small>
      </>
    ),
  },
  {
    value: 'journalbeat',
    inputDisplay: 'Journalbeat',
    dropdownDisplay: (
      <>
        <strong>Journalbeat</strong>
        <EuiSpacer size="xs" />
        <small>Lightweight shipper for journald logs</small>
      </>
    ),
  },
];

// Version options
const versionOptions = [
  { value: '8.17.0', text: '8.17.0 (Latest)' },
  { value: '8.16.0', text: '8.16.0' },
  { value: '8.15.0', text: '8.15.0' },
  { value: '8.14.0', text: '8.14.0' },
  { value: '8.13.0', text: '8.13.0' },
  { value: '8.12.0', text: '8.12.0' },
  { value: '7.17.0', text: '7.17.0 (7.x LTS)' },
];

// Deployment type options
const deploymentTypeOptions = [
  { id: 'daemonset', label: 'DaemonSet (one pod per node)' },
  { id: 'deployment', label: 'Deployment (fixed replica count)' },
];

interface FormData {
  name: string;
  namespace: string;
  beatType: string;
  version: string;
  deploymentType: 'daemonset' | 'deployment';
  replicas: number;
  elasticsearchRef: { name: string; namespace?: string } | null;
  kibanaRef: { name: string; namespace?: string } | null;
}

interface ValidationErrors {
  [key: string]: string;
}

function validateForm(data: FormData): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!data.name) {
    errors.name = 'Name is required';
  } else if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(data.name)) {
    errors.name = 'Name must be lowercase alphanumeric with hyphens';
  }

  if (!data.namespace) {
    errors.namespace = 'Namespace is required';
  }

  if (!data.beatType) {
    errors.beatType = 'Beat type is required';
  }

  if (!data.elasticsearchRef) {
    errors.elasticsearchRef = 'Elasticsearch cluster is required';
  }

  if (data.deploymentType === 'deployment' && data.replicas < 1) {
    errors.replicas = 'Replicas must be at least 1';
  }

  return errors;
}

function buildBeatSpec(data: FormData): Beat {
  const beat: Beat = {
    apiVersion: 'beat.k8s.elastic.co/v1beta1',
    kind: 'Beat',
    metadata: {
      name: data.name,
      namespace: data.namespace,
    },
    spec: {
      type: data.beatType,
      version: data.version,
      elasticsearchRef: data.elasticsearchRef!,
      kibanaRef: data.kibanaRef || undefined,
    },
  };

  // Add deployment or daemonSet config
  if (data.deploymentType === 'deployment') {
    beat.spec.deployment = {
      replicas: data.replicas,
    };
  } else {
    beat.spec.daemonSet = {};
  }

  return beat;
}

export function BeatCreatePage() {
  const navigate = useNavigate();
  const { data: rawNamespaces } = useNamespaces();
  const { data: esData } = useElasticsearchList();
  const { data: kibanaData } = useKibanaList();
  const createMutation = useCreateBeat();

  // Build namespace options
  const namespaceOptions = useMemo(() => {
    const namespaces = (rawNamespaces || []) as Array<{ metadata: { name: string } }>;
    return [
      { value: '', text: 'Select namespace' },
      ...namespaces.map((ns) => ({ value: ns.metadata.name, text: ns.metadata.name })),
    ];
  }, [rawNamespaces]);

  // Elasticsearch options for ComboBox
  const esOptions = useMemo((): EuiComboBoxOptionOption[] => {
    const clusters = (esData?.data ?? []) as ElasticsearchCluster[];
    return clusters.map((cluster) => ({
      label: `${cluster.metadata.name} (${cluster.metadata.namespace})`,
      key: `${cluster.metadata.namespace}/${cluster.metadata.name}`,
    }));
  }, [esData]);

  // Kibana options for ComboBox
  const kibanaOptions = useMemo((): EuiComboBoxOptionOption[] => {
    const instances = (kibanaData?.data ?? []) as KibanaInstance[];
    return instances.map((instance) => ({
      label: `${instance.metadata.name} (${instance.metadata.namespace})`,
      key: `${instance.metadata.namespace}/${instance.metadata.name}`,
    }));
  }, [kibanaData]);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    namespace: 'default',
    beatType: 'filebeat',
    version: '8.17.0',
    deploymentType: 'daemonset',
    replicas: 1,
    elasticsearchRef: null,
    kibanaRef: null,
  });

  const [selectedEs, setSelectedEs] = useState<EuiComboBoxOptionOption[]>([]);
  const [selectedKibana, setSelectedKibana] = useState<EuiComboBoxOptionOption[]>([]);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const validationErrors = validateForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const beatSpec = buildBeatSpec(formData);

    try {
      await createMutation.mutateAsync({
        namespace: formData.namespace,
        data: beatSpec,
      });
      navigate(`/beats/${formData.namespace}/${formData.name}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create Beat');
    }
  };

  const previewYaml = buildBeatSpec(formData);

  const formTab = {
    id: 'form',
    name: 'Form',
    content: (
      <>
        <EuiSpacer size="m" />
        <EuiForm component="form" onSubmit={handleSubmit}>
          {submitError && (
            <>
              <EuiCallOut title="Error creating Beat" color="danger" iconType="error">
                <p>{submitError}</p>
              </EuiCallOut>
              <EuiSpacer size="m" />
            </>
          )}

          <EuiPanel>
            <EuiTitle size="xs">
              <h3>Basic Settings</h3>
            </EuiTitle>
            <EuiSpacer size="m" />

            <EuiFlexGroup>
              <EuiFlexItem>
                <EuiFormRow
                  label="Name"
                  helpText="Unique name for this Beat instance"
                  isInvalid={!!errors.name}
                  error={errors.name}
                >
                  <EuiFieldText
                    placeholder="my-filebeat"
                    value={formData.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    isInvalid={!!errors.name}
                  />
                </EuiFormRow>
              </EuiFlexItem>
              <EuiFlexItem>
                <EuiFormRow
                  label="Namespace"
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
            </EuiFlexGroup>

            <EuiSpacer size="m" />

            <EuiFlexGroup>
              <EuiFlexItem>
                <EuiFormRow
                  label="Beat Type"
                  helpText="Type of data to collect"
                  isInvalid={!!errors.beatType}
                  error={errors.beatType}
                >
                  <EuiSuperSelect
                    options={beatTypeOptions}
                    valueOfSelected={formData.beatType}
                    onChange={(value) => updateField('beatType', value)}
                    hasDividers
                  />
                </EuiFormRow>
              </EuiFlexItem>
              <EuiFlexItem>
                <EuiFormRow label="Version" helpText="Elastic Stack version">
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

          <EuiPanel>
            <EuiTitle size="xs">
              <h3>Deployment Configuration</h3>
            </EuiTitle>
            <EuiSpacer size="m" />

            <EuiFormRow
              label="Deployment Type"
              helpText="DaemonSet runs one pod per node; Deployment runs a fixed number of replicas"
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
                  helpText="Number of Beat pods to run"
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

          <EuiPanel>
            <EuiTitle size="xs">
              <h3>Associations</h3>
            </EuiTitle>
            <EuiSpacer size="m" />

            <EuiFormRow
              label="Elasticsearch Cluster"
              helpText="Cluster to send data to (required)"
              isInvalid={!!errors.elasticsearchRef}
              error={errors.elasticsearchRef}
            >
              <EuiComboBox
                placeholder="Select an Elasticsearch cluster"
                singleSelection={{ asPlainText: true }}
                options={esOptions}
                selectedOptions={selectedEs}
                onChange={handleEsChange}
                isClearable
                isInvalid={!!errors.elasticsearchRef}
              />
            </EuiFormRow>

            <EuiSpacer size="m" />

            <EuiFormRow
              label="Kibana Instance"
              helpText="Kibana for dashboards and setup (optional)"
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
          </EuiPanel>

          <EuiSpacer size="l" />

          <EuiFlexGroup justifyContent="flexEnd">
            <EuiFlexItem grow={false}>
              <EuiButtonEmpty onClick={() => navigate('/beats')}>Cancel</EuiButtonEmpty>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiButton
                type="submit"
                fill
                isLoading={createMutation.isPending}
                disabled={Object.keys(errors).length > 0}
              >
                Create Beat
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
        <EuiPanel>
          <EuiTitle size="xs">
            <h3>Generated YAML</h3>
          </EuiTitle>
          <EuiSpacer size="m" />
          <EuiCodeBlock language="yaml" fontSize="s" paddingSize="m" isCopyable>
            {jsYaml.dump(previewYaml, { indent: 2, lineWidth: -1 })}
          </EuiCodeBlock>
        </EuiPanel>
      </>
    ),
  };

  return (
    <EuiPageTemplate>
      <EuiPageHeader
        pageTitle="Create Beat"
        breadcrumbs={[
          {
            text: 'Beats',
            href: '#',
            onClick: (e: React.MouseEvent) => {
              e.preventDefault();
              navigate('/beats');
            },
          },
          { text: 'Create' },
        ]}
        description="Deploy a new Beat instance (Filebeat, Metricbeat, etc.)"
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
