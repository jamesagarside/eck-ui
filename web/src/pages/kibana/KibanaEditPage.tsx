// Kibana Edit Page
import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  EuiPageTemplate,
  EuiPageHeader,
  EuiButton,
  EuiButtonEmpty,
  EuiForm,
  EuiFormRow,
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
  EuiCode,
  EuiDescriptionList,
  EuiBadge,
  EuiComboBox,
} from '@elastic/eui';
import type { EuiComboBoxOptionOption } from '@elastic/eui';
import {
  useKibanaDetail,
  useUpdateKibana,
  useElasticsearchList,
} from '../../hooks/useResources';
import type { KibanaInstance, ElasticsearchCluster } from '../../types/resources';
import { DetailSkeleton } from '../../components/common/Skeletons';
import jsYaml from 'js-yaml';

// Kibana versions
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

  if (data.count < 1) {
    errors.count = 'Count must be at least 1';
  }

  if (!data.elasticsearchRef) {
    errors.elasticsearchRef = 'Elasticsearch cluster is required';
  }

  return errors;
}

function buildUpdatedSpec(
  original: KibanaInstance,
  data: FormData
): KibanaInstance {
  return {
    ...original,
    spec: {
      ...original.spec,
      version: data.version,
      count: data.count,
      elasticsearchRef: data.elasticsearchRef || undefined,
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

function hasChanges(original: unknown, updated: unknown): boolean {
  return JSON.stringify(original) !== JSON.stringify(updated);
}

export function KibanaEditPage() {
  const { namespace = '', name = '' } = useParams();
  const navigate = useNavigate();

  const {
    data: rawInstance,
    isLoading,
    error: loadError,
  } = useKibanaDetail(namespace, name);
  const updateMutation = useUpdateKibana();
  const { data: esData } = useElasticsearchList();

  const instance = rawInstance as KibanaInstance | undefined;

  // Get list of ES clusters for the combo box
  const esOptions = useMemo((): EuiComboBoxOptionOption[] => {
    const clusters = (esData?.data ?? []) as ElasticsearchCluster[];
    return clusters.map((cluster) => ({
      label: `${cluster.metadata.name} (${cluster.metadata.namespace})`,
      key: `${cluster.metadata.namespace}/${cluster.metadata.name}`,
    }));
  }, [esData]);

  const [formData, setFormData] = useState<FormData | null>(null);
  const [originalSpec, setOriginalSpec] = useState<KibanaInstance | null>(null);
  const [selectedEs, setSelectedEs] = useState<EuiComboBoxOptionOption[]>([]);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Initialize form data when instance loads
  useEffect(() => {
    if (instance && !formData) {
      const tlsDisabled =
        instance.spec.http?.tls?.selfSignedCertificate?.disabled ?? false;

      setFormData({
        version: instance.spec.version,
        count: instance.spec.count || 1,
        elasticsearchRef: instance.spec.elasticsearchRef || null,
        enableTLS: !tlsDisabled,
        enableHTTP: !!instance.spec.http,
      });
      setOriginalSpec(instance);

      // Set selected ES
      if (instance.spec.elasticsearchRef) {
        const esNs = instance.spec.elasticsearchRef.namespace || namespace;
        setSelectedEs([
          {
            label: `${instance.spec.elasticsearchRef.name} (${esNs})`,
            key: `${esNs}/${instance.spec.elasticsearchRef.name}`,
          },
        ]);
      }
    }
  }, [instance, formData, namespace]);

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    if (!formData) return;
    setFormData((prev) => (prev ? { ...prev, [field]: value } : null));
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
      navigate(`/kibana/${namespace}/${name}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to update Kibana instance');
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
        <EuiCallOut title="Error loading instance" color="danger" iconType="error">
          <p>{loadError instanceof Error ? loadError.message : 'Unknown error'}</p>
          <EuiButton onClick={() => navigate('/kibana')}>Back to list</EuiButton>
        </EuiCallOut>
      </EuiPageTemplate>
    );
  }

  const updatedSpec = originalSpec ? buildUpdatedSpec(originalSpec, formData) : null;
  const isDirty = originalSpec && updatedSpec && hasChanges(originalSpec.spec, updatedSpec.spec);

  const originalYaml = originalSpec
    ? jsYaml.dump(originalSpec, { indent: 2, lineWidth: -1 })
    : '';
  const updatedYaml = updatedSpec
    ? jsYaml.dump(updatedSpec, { indent: 2, lineWidth: -1 })
    : '';

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
    if (originalSpec.spec.count !== formData.count) {
      diffItems.push({
        title: 'Replicas',
        description: (
          <>
            <EuiCode>{originalSpec.spec.count || 1}</EuiCode> →{' '}
            <EuiCode>{formData.count}</EuiCode>
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
              <EuiCallOut title="Error updating instance" color="danger" iconType="error">
                <p>{submitError}</p>
              </EuiCallOut>
              <EuiSpacer size="m" />
            </>
          )}

          <EuiPanel>
            <EuiTitle size="xs">
              <h3>Instance Information</h3>
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
                    <EuiBadge color={instance?.status?.health === 'green' ? 'success' : 'warning'}>
                      {instance?.status?.health || 'unknown'}
                    </EuiBadge>
                  ),
                },
              ]}
            />
          </EuiPanel>

          <EuiSpacer size="l" />

          <EuiPanel>
            <EuiTitle size="xs">
              <h3>Configuration</h3>
            </EuiTitle>
            <EuiSpacer size="m" />

            <EuiFlexGroup>
              <EuiFlexItem>
                <EuiFormRow
                  label="Version"
                  helpText="Changing version will trigger an upgrade"
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
                    restart.
                  </EuiText>
                </EuiCallOut>
              </>
            )}
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
                onClick={() => navigate(`/kibana/${namespace}/${name}`)}
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
            text: 'Kibana',
            href: '#',
            onClick: (e) => {
              e.preventDefault();
              navigate('/kibana');
            },
          },
          {
            text: name,
            href: '#',
            onClick: (e) => {
              e.preventDefault();
              navigate(`/kibana/${namespace}/${name}`);
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
