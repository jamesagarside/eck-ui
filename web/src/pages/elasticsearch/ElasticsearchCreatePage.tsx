// Elasticsearch Create Page
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EuiPageTemplate,
  EuiPageHeader,
  EuiButton,
  EuiButtonEmpty,
  EuiForm,
  EuiFormRow,
  EuiFieldText,
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
} from '@elastic/eui';
import { useCreateElasticsearch, useNamespaces } from '../../hooks/useResources';
import {
  NodeSetEditor,
  createDefaultNodeSet,
  nodeSetFormToSpec,
} from '../../components/elasticsearch/NodeSetEditor';
import type { NodeSetFormData } from '../../components/elasticsearch/NodeSetEditor';
import type { ElasticsearchCluster } from '../../types/resources';
import jsYaml from 'js-yaml';

// Elasticsearch versions
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
  nodeSets: NodeSetFormData[];
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

  // Node sets validation
  if (data.nodeSets.length === 0) {
    errors.nodeSets = 'At least one node set is required';
  }

  // Check for duplicate node set names
  const nodeSetNames = data.nodeSets.map((ns) => ns.name);
  const duplicates = nodeSetNames.filter((name, index) => nodeSetNames.indexOf(name) !== index);
  if (duplicates.length > 0) {
    errors['nodeSets.duplicate'] = `Duplicate node set names: ${duplicates.join(', ')}`;
  }

  // Validate each node set
  data.nodeSets.forEach((ns, index) => {
    if (!ns.name) {
      errors[`nodeSets.${index}.name`] = 'Node set name is required';
    } else if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(ns.name)) {
      errors[`nodeSets.${index}.name`] = 'Invalid node set name';
    }

    if (ns.count < 1) {
      errors[`nodeSets.${index}.count`] = 'Count must be at least 1';
    }

    if (ns.roles.length === 0) {
      errors[`nodeSets.${index}.roles`] = 'At least one role is required';
    }
  });

  // Check for master-eligible nodes
  const hasMaster = data.nodeSets.some((ns) => ns.roles.includes('master'));
  if (!hasMaster) {
    errors['nodeSets.master'] = 'At least one node set must have the master role';
  }

  return errors;
}

function buildElasticsearchSpec(data: FormData): ElasticsearchCluster {
  return {
    apiVersion: 'elasticsearch.k8s.elastic.co/v1',
    kind: 'Elasticsearch',
    metadata: {
      name: data.name,
      namespace: data.namespace,
    },
    spec: {
      version: data.version,
      nodeSets: data.nodeSets.map(nodeSetFormToSpec),
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

export function ElasticsearchCreatePage() {
  const navigate = useNavigate();
  const createMutation = useCreateElasticsearch();
  const { data: namespaces = [] } = useNamespaces();

  const [formData, setFormData] = useState<FormData>({
    name: '',
    namespace: 'default',
    version: '8.17.0',
    nodeSets: [createDefaultNodeSet(0)],
    enableTLS: true,
    enableHTTP: true,
  });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const validationErrors = validateForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const spec = buildElasticsearchSpec(formData);

    try {
      await createMutation.mutateAsync({
        namespace: formData.namespace,
        data: spec,
      });
      navigate(`/elasticsearch/${formData.namespace}/${formData.name}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create Elasticsearch cluster');
    }
  };

  // Generate YAML preview
  const yamlPreview = jsYaml.dump(buildElasticsearchSpec(formData), {
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
              <EuiCallOut title="Error creating cluster" color="danger" iconType="error">
                <p>{submitError}</p>
              </EuiCallOut>
              <EuiSpacer size="m" />
            </>
          )}

          {Object.keys(errors).filter((k) => k.startsWith('nodeSets.') && !k.includes('.')).length >
            0 && (
            <>
              <EuiCallOut title="Node set configuration issues" color="warning" iconType="warning">
                {errors.nodeSets && <p>{errors.nodeSets}</p>}
                {errors['nodeSets.duplicate'] && <p>{errors['nodeSets.duplicate']}</p>}
                {errors['nodeSets.master'] && <p>{errors['nodeSets.master']}</p>}
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
                  helpText="A unique name for this Elasticsearch cluster"
                  isInvalid={!!errors.name}
                  error={errors.name}
                >
                  <EuiFieldText
                    value={formData.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    isInvalid={!!errors.name}
                    placeholder="my-elasticsearch"
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
                    prepend="Namespace"
                  />
                </EuiFormRow>
              </EuiFlexItem>
            </EuiFlexGroup>

            <EuiSpacer size="m" />

            <EuiFormRow label="Version" helpText="Elasticsearch version to deploy">
              <EuiSelect
                options={versionOptions}
                value={formData.version}
                onChange={(e) => updateField('version', e.target.value)}
              />
            </EuiFormRow>
          </EuiPanel>

          <EuiSpacer size="l" />

          <EuiPanel>
            <NodeSetEditor
              nodeSets={formData.nodeSets}
              onChange={(nodeSets) => updateField('nodeSets', nodeSets)}
              errors={errors}
            />
          </EuiPanel>

          <EuiSpacer size="l" />

          <EuiPanel>
            <EuiTitle size="xs">
              <h3>HTTP & TLS Settings</h3>
            </EuiTitle>
            <EuiSpacer size="m" />

            <EuiFormRow helpText="Enable HTTP endpoint for external access">
              <EuiSwitch
                label="Enable HTTP"
                checked={formData.enableHTTP}
                onChange={(e) => updateField('enableHTTP', e.target.checked)}
              />
            </EuiFormRow>

            <EuiSpacer size="m" />

            <EuiFormRow helpText="Enable TLS encryption for HTTP endpoint (recommended)">
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
                <EuiCallOut title="TLS Disabled" color="warning" iconType="warning">
                  <EuiText size="s">
                    Disabling TLS is not recommended for production environments. Traffic will be
                    unencrypted.
                  </EuiText>
                </EuiCallOut>
              </>
            )}
          </EuiPanel>

          <EuiSpacer size="l" />

          <EuiFlexGroup justifyContent="flexEnd">
            <EuiFlexItem grow={false}>
              <EuiButtonEmpty
                onClick={() => navigate('/elasticsearch')}
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
                Create Elasticsearch
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
        <EuiCallOut title="YAML Preview" iconType="document" color="primary">
          <EuiText size="s">This is the Kubernetes resource that will be created.</EuiText>
        </EuiCallOut>
        <EuiSpacer size="m" />
        <EuiCodeBlock language="yaml" fontSize="m" paddingSize="m" isCopyable>
          {yamlPreview}
        </EuiCodeBlock>
      </>
    ),
  };

  return (
    <EuiPageTemplate>
      <EuiPageHeader
        pageTitle="Create Elasticsearch Cluster"
        breadcrumbs={[
          {
            text: 'Elasticsearch',
            href: '#',
            onClick: (e) => {
              e.preventDefault();
              navigate('/elasticsearch');
            },
          },
          { text: 'Create' },
        ]}
        description="Deploy a new Elasticsearch cluster to your Kubernetes cluster"
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
