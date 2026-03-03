// Elasticsearch Edit Page
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  EuiPageTemplate,
  EuiPageHeader,
  EuiButton,
  EuiButtonEmpty,
  EuiForm,
  EuiFormRow,
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
  EuiCode,
  EuiDescriptionList,
  EuiBadge,
} from '@elastic/eui';
import {
  useElasticsearchDetail,
  useUpdateElasticsearch,
} from '../../hooks/useResources';
import {
  NodeSetEditor,
  nodeSetFormToSpec,
  specToNodeSetForm,
} from '../../components/elasticsearch/NodeSetEditor';
import type { NodeSetFormData } from '../../components/elasticsearch/NodeSetEditor';
import type { ElasticsearchCluster } from '../../types/resources';
import { DetailSkeleton } from '../../components/common/Skeletons';
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

  // Node sets validation
  if (data.nodeSets.length === 0) {
    errors.nodeSets = 'At least one node set is required';
  }

  // Check for duplicate node set names
  const nodeSetNames = data.nodeSets.map((ns) => ns.name);
  const duplicates = nodeSetNames.filter(
    (name, index) => nodeSetNames.indexOf(name) !== index
  );
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

function buildUpdatedSpec(
  original: ElasticsearchCluster,
  data: FormData
): ElasticsearchCluster {
  return {
    ...original,
    spec: {
      ...original.spec,
      version: data.version,
      nodeSets: data.nodeSets.map(nodeSetFormToSpec),
      http: data.enableHTTP
        ? {
            ...original.spec.http,
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

// Compare two objects for changes
function hasChanges(original: unknown, updated: unknown): boolean {
  return JSON.stringify(original) !== JSON.stringify(updated);
}

export function ElasticsearchEditPage() {
  const { namespace = '', name = '' } = useParams();
  const navigate = useNavigate();

  const {
    data: rawCluster,
    isLoading,
    error: loadError,
  } = useElasticsearchDetail(namespace, name);
  const updateMutation = useUpdateElasticsearch();
  
  // Cast to typed cluster
  const cluster = rawCluster as ElasticsearchCluster | undefined;

  const [formData, setFormData] = useState<FormData | null>(null);
  const [originalSpec, setOriginalSpec] = useState<ElasticsearchCluster | null>(null);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Initialize form data when cluster loads
  useEffect(() => {
    if (cluster && !formData) {
      const tlsDisabled =
        cluster.spec.http?.tls?.selfSignedCertificate?.disabled ?? false;

      setFormData({
        version: cluster.spec.version,
        nodeSets: (cluster.spec.nodeSets || []).map(specToNodeSetForm),
        enableTLS: !tlsDisabled,
        enableHTTP: !!cluster.spec.http,
      });
      setOriginalSpec(cluster);
    }
  }, [cluster, formData]);

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    if (!formData) return;
    setFormData((prev) => (prev ? { ...prev, [field]: value } : null));
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
    if (!formData || !originalSpec) return;

    setSubmitError(null);

    const validationErrors = validateForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const updatedSpec = buildUpdatedSpec(originalSpec, formData);

    try {
      await updateMutation.mutateAsync({
        namespace,
        name,
        data: updatedSpec,
      });
      navigate(`/elasticsearch/${namespace}/${name}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to update Elasticsearch cluster');
    }
  };

  if (isLoading || !formData) {
    return (
      <EuiPageTemplate>
        <DetailSkeleton />
      </EuiPageTemplate>
    );
  }

  if (loadError) {
    return (
      <EuiPageTemplate>
        <EuiCallOut title="Error loading cluster" color="danger" iconType="error">
          <p>{loadError instanceof Error ? loadError.message : 'Unknown error'}</p>
          <EuiButton onClick={() => navigate('/elasticsearch')}>Back to list</EuiButton>
        </EuiCallOut>
      </EuiPageTemplate>
    );
  }

  const updatedSpec = originalSpec ? buildUpdatedSpec(originalSpec, formData) : null;
  const isDirty = originalSpec && updatedSpec && hasChanges(originalSpec.spec, updatedSpec.spec);

  // Generate YAML preview
  const originalYaml = originalSpec
    ? jsYaml.dump(originalSpec, { indent: 2, lineWidth: -1 })
    : '';
  const updatedYaml = updatedSpec
    ? jsYaml.dump(updatedSpec, { indent: 2, lineWidth: -1 })
    : '';

  // Simple diff summary
  const diffItems = [];
  if (originalSpec && formData) {
    if (originalSpec.spec.version !== formData.version) {
      diffItems.push({
        title: 'Version',
        description: (
          <>
            <EuiCode>{originalSpec.spec.version}</EuiCode> →{' '}
            <EuiCode>{formData.version}</EuiCode>
          </>
        ),
      });
    }
    const originalNodes = (originalSpec.spec.nodeSets || []).reduce(
      (sum, ns) => sum + ns.count,
      0
    );
    const newNodes = formData.nodeSets.reduce((sum, ns) => sum + ns.count, 0);
    if (originalNodes !== newNodes) {
      diffItems.push({
        title: 'Total Nodes',
        description: (
          <>
            <EuiCode>{originalNodes}</EuiCode> → <EuiCode>{newNodes}</EuiCode>
          </>
        ),
      });
    }
  }

  const formTab = {
    id: 'form',
    name: 'Edit',
    content: (
      <>
        <EuiSpacer size="m" />
        <EuiForm component="form" onSubmit={handleSubmit}>
          {submitError && (
            <>
              <EuiCallOut title="Error updating cluster" color="danger" iconType="error">
                <p>{submitError}</p>
              </EuiCallOut>
              <EuiSpacer size="m" />
            </>
          )}

          {Object.keys(errors).filter((k) => k.startsWith('nodeSets.') && !k.includes('.')).length > 0 && (
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
              <h3>Cluster Information</h3>
            </EuiTitle>
            <EuiSpacer size="m" />
            <EuiDescriptionList
              type="column"
              columnWidths={[150, 'auto']}
              listItems={[
                { title: 'Name', description: name },
                { title: 'Namespace', description: namespace },
                {
                  title: 'Status',
                  description: (
                    <EuiBadge color={cluster?.status?.health === 'green' ? 'success' : 'warning'}>
                      {cluster?.status?.health || 'unknown'}
                    </EuiBadge>
                  ),
                },
              ]}
            />
          </EuiPanel>

          <EuiSpacer size="l" />

          <EuiPanel>
            <EuiTitle size="xs">
              <h3>Version</h3>
            </EuiTitle>
            <EuiSpacer size="m" />

            <EuiFormRow
              label="Elasticsearch Version"
              helpText="Changing version will trigger a rolling upgrade"
            >
              <EuiSelect
                options={versionOptions}
                value={formData.version}
                onChange={(e) => updateField('version', e.target.value)}
              />
            </EuiFormRow>

            {originalSpec && formData.version !== originalSpec.spec.version && (
              <>
                <EuiSpacer size="m" />
                <EuiCallOut
                  title="Version Change"
                  color="warning"
                  iconType="warning"
                >
                  <EuiText size="s">
                    Upgrading from{' '}
                    <EuiCode>{originalSpec.spec.version}</EuiCode> to{' '}
                    <EuiCode>{formData.version}</EuiCode> will trigger a rolling
                    restart of all nodes.
                  </EuiText>
                </EuiCallOut>
              </>
            )}
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
              <EuiButtonEmpty
                onClick={() => navigate(`/elasticsearch/${namespace}/${name}`)}
                disabled={updateMutation.isPending}
              >
                Cancel
              </EuiButtonEmpty>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiButton
                type="submit"
                fill
                isLoading={updateMutation.isPending}
                disabled={!isDirty || Object.keys(errors).length > 0}
              >
                Save Changes
              </EuiButton>
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiForm>
      </>
    ),
  };

  const diffTab = {
    id: 'diff',
    name: 'Changes',
    content: (
      <>
        <EuiSpacer size="m" />
        {isDirty ? (
          <>
            {diffItems.length > 0 && (
              <>
                <EuiCallOut title="Summary of Changes" iconType="diff" color="primary">
                  <EuiDescriptionList
                    type="column"
                    columnWidths={[150, 'auto']}
                    listItems={diffItems}
                  />
                </EuiCallOut>
                <EuiSpacer size="m" />
              </>
            )}
            <EuiFlexGroup>
              <EuiFlexItem>
                <EuiTitle size="xxs">
                  <h4>Current</h4>
                </EuiTitle>
                <EuiSpacer size="s" />
                <EuiCodeBlock language="yaml" fontSize="s" paddingSize="m">
                  {originalYaml}
                </EuiCodeBlock>
              </EuiFlexItem>
              <EuiFlexItem>
                <EuiTitle size="xxs">
                  <h4>Updated</h4>
                </EuiTitle>
                <EuiSpacer size="s" />
                <EuiCodeBlock language="yaml" fontSize="s" paddingSize="m">
                  {updatedYaml}
                </EuiCodeBlock>
              </EuiFlexItem>
            </EuiFlexGroup>
          </>
        ) : (
          <EuiCallOut title="No changes" iconType="check" color="success">
            <p>The configuration has not been modified.</p>
          </EuiCallOut>
        )}
      </>
    ),
  };

  return (
    <EuiPageTemplate>
      <EuiPageHeader
        pageTitle={`Edit ${name}`}
        breadcrumbs={[
          {
            text: 'Elasticsearch',
            href: '#',
            onClick: (e) => {
              e.preventDefault();
              navigate('/elasticsearch');
            },
          },
          {
            text: name,
            href: '#',
            onClick: (e) => {
              e.preventDefault();
              navigate(`/elasticsearch/${namespace}/${name}`);
            },
          },
          { text: 'Edit' },
        ]}
        description={`Modify the configuration of ${name} in namespace ${namespace}`}
        rightSideItems={[
          isDirty && <EuiBadge color="warning">Unsaved changes</EuiBadge>,
        ].filter(Boolean)}
      />

      <EuiPageTemplate.Section>
        <EuiTabbedContent
          tabs={[formTab, diffTab]}
          initialSelectedTab={formTab}
          autoFocus="selected"
        />
      </EuiPageTemplate.Section>
    </EuiPageTemplate>
  );
}
