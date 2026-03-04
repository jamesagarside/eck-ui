// APM Server Create Page
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
} from '@elastic/eui';
import type { EuiComboBoxOptionOption } from '@elastic/eui';
import {
  useCreateApm,
  useNamespaces,
  useElasticsearchList,
  useKibanaList,
} from '../../hooks/useResources';
import type { ApmServer, ElasticsearchCluster, KibanaInstance } from '../../types/resources';
import jsYaml from 'js-yaml';

// APM versions
const versionOptions = [
  { value: '8.17.0', text: '8.17.0 (Latest)' },
  { value: '8.16.0', text: '8.16.0' },
  { value: '8.15.0', text: '8.15.0' },
  { value: '8.14.0', text: '8.14.0' },
  { value: '8.13.0', text: '8.13.0' },
  { value: '8.12.0', text: '8.12.0' },
  { value: '7.17.0', text: '7.17.0 (7.x LTS)' },
];

interface FormData {
  name: string;
  namespace: string;
  version: string;
  count: number;
  elasticsearchRef: { name: string; namespace?: string } | null;
  kibanaRef: { name: string; namespace?: string } | null;
  enableRUM: boolean;
  enableTLS: boolean;
  enableHTTP: boolean;
}

interface ValidationErrors {
  [key: string]: string;
}

const initialFormData: FormData = {
  name: '',
  namespace: 'default',
  version: '8.17.0',
  count: 1,
  elasticsearchRef: null,
  kibanaRef: null,
  enableRUM: false,
  enableTLS: true,
  enableHTTP: true,
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

  if (data.count < 1) {
    errors.count = 'Count must be at least 1';
  }

  if (!data.elasticsearchRef) {
    errors.elasticsearchRef = 'Elasticsearch cluster is required';
  }

  return errors;
}

function buildSpec(data: FormData): ApmServer {
  const config: Record<string, unknown> = {};

  if (data.enableRUM) {
    config['apm-server.rum.enabled'] = true;
    config['apm-server.rum.allow_origins'] = ['*'];
  }

  const spec: ApmServer = {
    apiVersion: 'apm.k8s.elastic.co/v1',
    kind: 'ApmServer',
    metadata: {
      name: data.name,
      namespace: data.namespace,
    },
    spec: {
      version: data.version,
      count: data.count,
      elasticsearchRef: data.elasticsearchRef || undefined,
      kibanaRef: data.kibanaRef || undefined,
      config: Object.keys(config).length > 0 ? config : undefined,
      http: data.enableHTTP
        ? {
            tls: {
              selfSignedCertificate: {
                disabled: !data.enableTLS,
              },
            },
          }
        : undefined,
    },
  };

  return spec;
}

export function ApmCreatePage() {
  const navigate = useNavigate();
  const createMutation = useCreateApm();
  const { data: nsData } = useNamespaces();
  const { data: esData } = useElasticsearchList();
  const { data: kibanaData } = useKibanaList();

  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [selectedEs, setSelectedEs] = useState<EuiComboBoxOptionOption[]>([]);
  const [selectedKibana, setSelectedKibana] = useState<EuiComboBoxOptionOption[]>([]);
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

    const spec = buildSpec(formData);

    try {
      await createMutation.mutateAsync({
        namespace: formData.namespace,
        data: spec,
      });
      navigate(`/apm/${formData.namespace}/${formData.name}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create APM Server');
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
              <EuiCallOut title="Error creating APM Server" color="danger" iconType="error">
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
                  helpText="Unique name for the APM Server"
                  isInvalid={!!errors.name}
                  error={errors.name}
                >
                  <EuiFieldText
                    value={formData.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    isInvalid={!!errors.name}
                    placeholder="my-apm"
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
            </EuiFlexGroup>
          </EuiPanel>

          <EuiSpacer size="l" />

          {/* Configuration */}
          <EuiPanel>
            <EuiTitle size="xs">
              <h3>Configuration</h3>
            </EuiTitle>
            <EuiSpacer size="m" />

            <EuiFlexGroup>
              <EuiFlexItem>
                <EuiFormRow label="Version" helpText="APM Server version">
                  <EuiSelect
                    options={versionOptions}
                    value={formData.version}
                    onChange={(e) => updateField('version', e.target.value)}
                  />
                </EuiFormRow>
              </EuiFlexItem>
              <EuiFlexItem>
                <EuiFormRow
                  label="Replicas"
                  helpText="Number of APM Server pods"
                  isInvalid={!!errors.count}
                  error={errors.count}
                >
                  <EuiFieldNumber
                    value={formData.count}
                    min={1}
                    max={10}
                    onChange={(e) => updateField('count', parseInt(e.target.value) || 1)}
                    isInvalid={!!errors.count}
                  />
                </EuiFormRow>
              </EuiFlexItem>
            </EuiFlexGroup>
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
              helpText="APM Server will send data to this cluster"
              isInvalid={!!errors.elasticsearchRef}
              error={errors.elasticsearchRef}
            >
              <EuiComboBox
                placeholder="Select an Elasticsearch cluster"
                singleSelection={{ asPlainText: true }}
                options={esOptions}
                selectedOptions={selectedEs}
                onChange={handleEsChange}
                isInvalid={!!errors.elasticsearchRef}
              />
            </EuiFormRow>

            <EuiSpacer size="m" />

            <EuiFormRow
              label="Kibana Instance (Optional)"
              helpText="Link to Kibana for agent configuration"
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

          {/* RUM Configuration */}
          <EuiPanel>
            <EuiTitle size="xs">
              <h3>Real User Monitoring (RUM)</h3>
            </EuiTitle>
            <EuiSpacer size="m" />

            <EuiFormRow helpText="Enable RUM to collect browser performance data">
              <EuiSwitch
                label="Enable RUM"
                checked={formData.enableRUM}
                onChange={(e) => updateField('enableRUM', e.target.checked)}
              />
            </EuiFormRow>

            {formData.enableRUM && (
              <>
                <EuiSpacer size="m" />
                <EuiCallOut title="RUM Enabled" color="primary" iconType="globe">
                  <EuiText size="s">
                    <p>
                      RUM will be enabled with default settings allowing all origins. Configure CORS
                      origins in advanced settings if needed.
                    </p>
                  </EuiText>
                </EuiCallOut>
              </>
            )}
          </EuiPanel>

          <EuiSpacer size="l" />

          {/* HTTP & TLS */}
          <EuiPanel>
            <EuiTitle size="xs">
              <h3>HTTP & TLS Settings</h3>
            </EuiTitle>
            <EuiSpacer size="m" />

            <EuiFormRow helpText="Enable HTTP endpoint for APM agents">
              <EuiSwitch
                label="Enable HTTP"
                checked={formData.enableHTTP}
                onChange={(e) => updateField('enableHTTP', e.target.checked)}
              />
            </EuiFormRow>

            <EuiSpacer size="m" />

            <EuiFormRow helpText="Enable TLS encryption for HTTP endpoint">
              <EuiSwitch
                label="Enable TLS"
                checked={formData.enableTLS}
                onChange={(e) => updateField('enableTLS', e.target.checked)}
                disabled={!formData.enableHTTP}
              />
            </EuiFormRow>
          </EuiPanel>

          <EuiSpacer size="l" />

          <EuiFlexGroup justifyContent="flexEnd">
            <EuiFlexItem grow={false}>
              <EuiButtonEmpty onClick={() => navigate('/apm')}>Cancel</EuiButtonEmpty>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiButton
                type="submit"
                fill
                isLoading={createMutation.isPending}
                disabled={Object.keys(errors).length > 0}
              >
                Create APM Server
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
        pageTitle="Create APM Server"
        breadcrumbs={[
          {
            text: 'APM Servers',
            href: '#',
            onClick: (e) => {
              e.preventDefault();
              navigate('/apm');
            },
          },
          { text: 'Create' },
        ]}
        description="Deploy a new APM Server to collect application performance data"
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
