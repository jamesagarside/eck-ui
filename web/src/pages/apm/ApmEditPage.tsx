// APM Server Edit Page
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
  useApmDetail,
  useUpdateApm,
  useElasticsearchList,
  useKibanaList,
} from '../../hooks/useResources';
import type { ApmServer, ElasticsearchCluster, KibanaInstance } from '../../types/resources';
import { DetailSkeleton } from '../../components/common/Skeletons';
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

function buildUpdatedSpec(original: ApmServer, data: FormData): ApmServer {
  const config: Record<string, unknown> = { ...(original.spec.config || {}) };

  if (data.enableRUM) {
    config['apm-server.rum.enabled'] = true;
    config['apm-server.rum.allow_origins'] = config['apm-server.rum.allow_origins'] || ['*'];
  } else {
    delete config['apm-server.rum.enabled'];
    delete config['apm-server.rum.allow_origins'];
  }

  return {
    ...original,
    spec: {
      ...original.spec,
      version: data.version,
      count: data.count,
      elasticsearchRef: data.elasticsearchRef || undefined,
      kibanaRef: data.kibanaRef || undefined,
      config: Object.keys(config).length > 0 ? config : undefined,
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

export function ApmEditPage() {
  const { namespace = '', name = '' } = useParams();
  const navigate = useNavigate();

  const { data: rawServer, isLoading, error: loadError } = useApmDetail(namespace, name);
  const updateMutation = useUpdateApm();
  const { data: esData } = useElasticsearchList();
  const { data: kibanaData } = useKibanaList();

  const server = rawServer as ApmServer | undefined;

  // Build options for combo boxes
  const esOptions = useMemo((): EuiComboBoxOptionOption[] => {
    const clusters = (esData?.data ?? []) as ElasticsearchCluster[];
    return clusters.map((cluster) => ({
      label: `${cluster.metadata.name} (${cluster.metadata.namespace})`,
      key: `${cluster.metadata.namespace}/${cluster.metadata.name}`,
    }));
  }, [esData]);

  const kibanaOptions = useMemo((): EuiComboBoxOptionOption[] => {
    const instances = (kibanaData?.data ?? []) as KibanaInstance[];
    return instances.map((instance) => ({
      label: `${instance.metadata.name} (${instance.metadata.namespace})`,
      key: `${instance.metadata.namespace}/${instance.metadata.name}`,
    }));
  }, [kibanaData]);

  const [formData, setFormData] = useState<FormData | null>(null);
  const [originalSpec, setOriginalSpec] = useState<ApmServer | null>(null);
  const [selectedEs, setSelectedEs] = useState<EuiComboBoxOptionOption[]>([]);
  const [selectedKibana, setSelectedKibana] = useState<EuiComboBoxOptionOption[]>([]);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Initialize form data when server loads
  useEffect(() => {
    if (server && !formData) {
      const tlsDisabled =
        server.spec.http?.tls?.selfSignedCertificate?.disabled ?? false;
      const rumEnabled = !!server.spec.config?.['apm-server.rum.enabled'];

      setFormData({
        version: server.spec.version,
        count: server.spec.count || 1,
        elasticsearchRef: server.spec.elasticsearchRef || null,
        kibanaRef: server.spec.kibanaRef || null,
        enableRUM: rumEnabled,
        enableTLS: !tlsDisabled,
        enableHTTP: !!server.spec.http,
      });
      setOriginalSpec(server);

      // Set selected ES
      if (server.spec.elasticsearchRef) {
        const esNs = server.spec.elasticsearchRef.namespace || namespace;
        setSelectedEs([
          {
            label: `${server.spec.elasticsearchRef.name} (${esNs})`,
            key: `${esNs}/${server.spec.elasticsearchRef.name}`,
          },
        ]);
      }

      // Set selected Kibana
      if (server.spec.kibanaRef) {
        const kibNs = server.spec.kibanaRef.namespace || namespace;
        setSelectedKibana([
          {
            label: `${server.spec.kibanaRef.name} (${kibNs})`,
            key: `${kibNs}/${server.spec.kibanaRef.name}`,
          },
        ]);
      }
    }
  }, [server, formData, namespace]);

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
      navigate(`/apm/${namespace}/${name}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to update APM Server');
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
        <EuiCallOut title="Error loading APM Server" color="danger" iconType="error">
          <p>{loadError instanceof Error ? loadError.message : 'Unknown error'}</p>
          <EuiButton onClick={() => navigate('/apm')}>Back to list</EuiButton>
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
    if ((originalSpec.spec.count || 1) !== formData.count) {
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
              <EuiCallOut title="Error updating APM Server" color="danger" iconType="error">
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
                    <EuiBadge color={server?.status?.health === 'green' ? 'success' : 'warning'}>
                      {server?.status?.health || 'unknown'}
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

            {originalSpec && formData.version !== originalSpec.spec.version && (
              <>
                <EuiSpacer size="m" />
                <EuiCallOut title="Version Change" color="warning" iconType="warning">
                  <EuiText size="s">
                    Upgrading from <EuiCode>{originalSpec.spec.version}</EuiCode> to{' '}
                    <EuiCode>{formData.version}</EuiCode> will trigger a rolling restart.
                  </EuiText>
                </EuiCallOut>
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
              helpText="APM Server sends data to this cluster"
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
          </EuiPanel>

          <EuiSpacer size="l" />

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
              <EuiButtonEmpty
                onClick={() => navigate(`/apm/${namespace}/${name}`)}
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
            text: 'APM Servers',
            href: '#',
            onClick: (e) => {
              e.preventDefault();
              navigate('/apm');
            },
          },
          {
            text: name,
            href: '#',
            onClick: (e) => {
              e.preventDefault();
              navigate(`/apm/${namespace}/${name}`);
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
