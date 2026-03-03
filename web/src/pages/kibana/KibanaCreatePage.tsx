// Kibana Create Page
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
  EuiText,
  EuiTabbedContent,
  EuiCodeBlock,
  EuiComboBox,
} from '@elastic/eui';
import type { EuiComboBoxOptionOption } from '@elastic/eui';
import { useCreateKibana, useNamespaces, useElasticsearchList } from '../../hooks/useResources';
import type { KibanaInstance, ElasticsearchCluster } from '../../types/resources';
import jsYaml from 'js-yaml';

// Kibana versions (matching ES versions)
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
  enableTLS: boolean;
  enableHTTP: boolean;
}

interface ValidationErrors {
  [key: string]: string;
}

function validateForm(data: FormData): ValidationErrors {
  const errors: ValidationErrors = {};

  // Name validation
  if (!data.name) {
    errors.name = 'Name is required';
  } else if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(data.name)) {
    errors.name =
      'Name must consist of lowercase alphanumeric characters or "-", and must start and end with an alphanumeric character';
  } else if (data.name.length > 63) {
    errors.name = 'Name must be 63 characters or less';
  }

  // Namespace validation
  if (!data.namespace) {
    errors.namespace = 'Namespace is required';
  }

  // Count validation
  if (data.count < 1) {
    errors.count = 'Count must be at least 1';
  }

  // Elasticsearch ref validation
  if (!data.elasticsearchRef) {
    errors.elasticsearchRef = 'Elasticsearch cluster is required';
  }

  return errors;
}

function buildKibanaSpec(data: FormData): KibanaInstance {
  return {
    apiVersion: 'kibana.k8s.elastic.co/v1',
    kind: 'Kibana',
    metadata: {
      name: data.name,
      namespace: data.namespace,
    },
    spec: {
      version: data.version,
      count: data.count,
      elasticsearchRef: data.elasticsearchRef || undefined,
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
}

export function KibanaCreatePage() {
  const navigate = useNavigate();
  const createMutation = useCreateKibana();
  const { data: namespaces = [] } = useNamespaces();
  const { data: esData } = useElasticsearchList();

  // Get list of ES clusters for the combo box
  const esOptions = useMemo((): EuiComboBoxOptionOption[] => {
    const clusters = (esData?.data ?? []) as ElasticsearchCluster[];
    return clusters.map((cluster) => ({
      label: `${cluster.metadata.name} (${cluster.metadata.namespace})`,
      key: `${cluster.metadata.namespace}/${cluster.metadata.name}`,
    }));
  }, [esData]);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    namespace: 'default',
    version: '8.17.0',
    count: 1,
    elasticsearchRef: null,
    enableTLS: true,
    enableHTTP: true,
  });

  const [selectedEs, setSelectedEs] = useState<EuiComboBoxOptionOption[]>([]);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear field error on change
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
      const [namespace, name] = selected[0].key.split('/');
      updateField('elasticsearchRef', { name, namespace });
    } else {
      updateField('elasticsearchRef', null);
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

    const spec = buildKibanaSpec(formData);

    try {
      await createMutation.mutateAsync({
        namespace: formData.namespace,
        data: spec,
      });
      navigate(`/kibana/${formData.namespace}/${formData.name}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create Kibana instance');
    }
  };

  // Generate YAML preview
  const yamlPreview = jsYaml.dump(buildKibanaSpec(formData), {
    indent: 2,
    lineWidth: -1,
  });

  const formTab = {
    id: 'form',
    name: 'Form',
    content: (
      <>
        <EuiSpacer size="m" />
        <EuiForm component="form" onSubmit={handleSubmit}>
          {submitError && (
            <>
              <EuiCallOut title="Error creating instance" color="danger" iconType="error">
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
                  helpText="A unique name for this Kibana instance"
                  isInvalid={!!errors.name}
                  error={errors.name}
                >
                  <EuiFieldText
                    value={formData.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    isInvalid={!!errors.name}
                    placeholder="my-kibana"
                  />
                </EuiFormRow>
              </EuiFlexItem>
              <EuiFlexItem>
                <EuiFormRow
                  label="Namespace"
                  helpText="Kubernetes namespace for deployment"
                  isInvalid={!!errors.namespace}
                  error={errors.namespace}
                >
                  <EuiSelect
                    options={namespaces.map((ns) => ({
                      value: ns.metadata?.name || '',
                      text: ns.metadata?.name || '',
                    }))}
                    value={formData.namespace}
                    onChange={(e) => updateField('namespace', e.target.value)}
                    isInvalid={!!errors.namespace}
                    hasNoInitialSelection={namespaces.length === 0}
                  />
                </EuiFormRow>
              </EuiFlexItem>
            </EuiFlexGroup>

            <EuiSpacer size="m" />

            <EuiFlexGroup>
              <EuiFlexItem>
                <EuiFormRow
                  label="Version"
                  helpText="Kibana version to deploy"
                >
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
                  helpText="Number of Kibana pods"
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

          <EuiPanel>
            <EuiTitle size="xs">
              <h3>Elasticsearch Association</h3>
            </EuiTitle>
            <EuiSpacer size="m" />

            <EuiFormRow
              label="Elasticsearch Cluster"
              helpText="Select the Elasticsearch cluster to connect to"
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

            {esOptions.length === 0 && (
              <>
                <EuiSpacer size="m" />
                <EuiCallOut
                  title="No Elasticsearch clusters found"
                  color="warning"
                  iconType="warning"
                >
                  <EuiText size="s">
                    Create an Elasticsearch cluster first, or ensure you have access to existing clusters.
                  </EuiText>
                </EuiCallOut>
              </>
            )}
          </EuiPanel>

          <EuiSpacer size="l" />

          <EuiPanel>
            <EuiTitle size="xs">
              <h3>HTTP & TLS Settings</h3>
            </EuiTitle>
            <EuiSpacer size="m" />

            <EuiFormRow
              helpText="Enable HTTP endpoint for external access"
            >
              <EuiSwitch
                label="Enable HTTP"
                checked={formData.enableHTTP}
                onChange={(e) => updateField('enableHTTP', e.target.checked)}
              />
            </EuiFormRow>

            <EuiSpacer size="m" />

            <EuiFormRow
              helpText="Enable TLS encryption for HTTP endpoint (recommended)"
            >
              <EuiSwitch
                label="Enable TLS"
                checked={formData.enableTLS}
                onChange={(e) => updateField('enableTLS', e.target.checked)}
                disabled={!formData.enableHTTP}
              />
            </EuiFormRow>

            {!formData.enableTLS && formData.enableHTTP && (
              <>
                <EuiSpacer size="m" />
                <EuiCallOut
                  title="TLS Disabled"
                  color="warning"
                  iconType="warning"
                >
                  <EuiText size="s">
                    Disabling TLS is not recommended for production environments.
                    Traffic will be unencrypted.
                  </EuiText>
                </EuiCallOut>
              </>
            )}
          </EuiPanel>

          <EuiSpacer size="l" />

          <EuiFlexGroup justifyContent="flexEnd">
            <EuiFlexItem grow={false}>
              <EuiButtonEmpty
                onClick={() => navigate('/kibana')}
                disabled={createMutation.isPending}
              >
                Cancel
              </EuiButtonEmpty>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiButton
                type="submit"
                fill
                isLoading={createMutation.isPending}
                disabled={Object.keys(errors).length > 0}
              >
                Create Kibana
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
        <EuiCallOut
          title="YAML Preview"
          iconType="document"
          color="primary"
        >
          <EuiText size="s">
            This is the Kubernetes resource that will be created.
          </EuiText>
        </EuiCallOut>
        <EuiSpacer size="m" />
        <EuiCodeBlock
          language="yaml"
          fontSize="m"
          paddingSize="m"
          isCopyable
        >
          {yamlPreview}
        </EuiCodeBlock>
      </>
    ),
  };

  return (
    <EuiPageTemplate>
      <EuiPageHeader
        pageTitle="Create Kibana Instance"
        breadcrumbs={[
          { text: 'Kibana', href: '#', onClick: (e) => { e.preventDefault(); navigate('/kibana'); } },
          { text: 'Create' },
        ]}
        description="Deploy a new Kibana instance connected to an Elasticsearch cluster"
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
