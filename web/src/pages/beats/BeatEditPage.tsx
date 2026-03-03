// Beat Edit Page
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
  useBeatDetail,
  useUpdateBeat,
  useElasticsearchList,
  useKibanaList,
} from '../../hooks/useResources';
import type { Beat, ElasticsearchCluster, KibanaInstance } from '../../types/resources';
import { DetailSkeleton } from '../../components/common/Skeletons';
import jsYaml from 'js-yaml';

// Beat type labels
const beatTypeLabels: Record<string, string> = {
  filebeat: 'Filebeat',
  metricbeat: 'Metricbeat',
  heartbeat: 'Heartbeat',
  packetbeat: 'Packetbeat',
  auditbeat: 'Auditbeat',
  journalbeat: 'Journalbeat',
};

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

interface FormData {
  version: string;
  replicas: number;
  elasticsearchRef: { name: string; namespace?: string } | null;
  kibanaRef: { name: string; namespace?: string } | null;
}

interface ValidationErrors {
  [key: string]: string;
}

function validateForm(data: FormData, isDeployment: boolean): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!data.elasticsearchRef) {
    errors.elasticsearchRef = 'Elasticsearch cluster is required';
  }

  if (isDeployment && data.replicas < 1) {
    errors.replicas = 'Replicas must be at least 1';
  }

  return errors;
}

function buildUpdatedSpec(original: Beat, data: FormData): Beat {
  const updated: Beat = {
    ...original,
    spec: {
      ...original.spec,
      version: data.version,
      elasticsearchRef: data.elasticsearchRef!,
      kibanaRef: data.kibanaRef || undefined,
    },
  };

  if (updated.spec.deployment) {
    updated.spec.deployment = {
      ...updated.spec.deployment,
      replicas: data.replicas,
    };
  }

  return updated;
}

function hasChanges(original: unknown, updated: unknown): boolean {
  return JSON.stringify(original) !== JSON.stringify(updated);
}

export function BeatEditPage() {
  const { namespace = '', name = '' } = useParams();
  const navigate = useNavigate();

  const { data: rawBeat, isLoading, error: loadError } = useBeatDetail(namespace, name);
  const updateMutation = useUpdateBeat();
  const { data: esData } = useElasticsearchList();
  const { data: kibanaData } = useKibanaList();

  const beat = rawBeat as Beat | undefined;

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
  const [originalSpec, setOriginalSpec] = useState<Beat | null>(null);
  const [selectedEs, setSelectedEs] = useState<EuiComboBoxOptionOption[]>([]);
  const [selectedKibana, setSelectedKibana] = useState<EuiComboBoxOptionOption[]>([]);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Initialize form data when beat loads
  useEffect(() => {
    if (beat && !formData) {
      const esRef = beat.spec.elasticsearchRef || null;

      setFormData({
        version: beat.spec.version,
        replicas: beat.spec.deployment?.replicas || 1,
        elasticsearchRef: esRef,
        kibanaRef: beat.spec.kibanaRef || null,
      });
      setOriginalSpec(beat);

      // Set selected ES
      if (esRef) {
        const esNs = esRef.namespace || namespace;
        setSelectedEs([
          {
            label: `${esRef.name} (${esNs})`,
            key: `${esNs}/${esRef.name}`,
          },
        ]);
      }

      // Set selected Kibana
      if (beat.spec.kibanaRef) {
        const kibNs = beat.spec.kibanaRef.namespace || namespace;
        setSelectedKibana([
          {
            label: `${beat.spec.kibanaRef.name} (${kibNs})`,
            key: `${kibNs}/${beat.spec.kibanaRef.name}`,
          },
        ]);
      }
    }
  }, [beat, formData, namespace]);

  const isDeployment = !!beat?.spec.deployment;

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

    const validationErrors = validateForm(formData, isDeployment);
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
      navigate(`/beats/${namespace}/${name}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to update Beat');
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
        <EuiCallOut title="Error loading Beat" color="danger" iconType="error">
          <p>{loadError instanceof Error ? loadError.message : 'Unknown error'}</p>
          <EuiButton onClick={() => navigate('/beats')}>Back to list</EuiButton>
        </EuiCallOut>
      </EuiPageTemplate>
    );
  }

  const beatType = beat?.spec.type || 'unknown';
  const beatTypeLabel = beatTypeLabels[beatType] || beatType;

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
    if (isDeployment && (originalSpec.spec.deployment?.replicas || 1) !== formData.replicas) {
      diffItems.push({
        title: 'Replicas',
        description: (
          <>
            <EuiCode>{originalSpec.spec.deployment?.replicas || 1}</EuiCode> →{' '}
            <EuiCode>{formData.replicas}</EuiCode>
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
              <EuiCallOut title="Error updating Beat" color="danger" iconType="error">
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
                  title: 'Type',
                  description: <EuiBadge color="hollow">{beatTypeLabel}</EuiBadge>,
                },
                {
                  title: 'Deployment',
                  description: (
                    <EuiBadge color="hollow">
                      {isDeployment ? 'Deployment' : 'DaemonSet'}
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
              {isDeployment && (
                <EuiFlexItem>
                  <EuiFormRow
                    label="Replicas"
                    helpText="Number of Beat pods"
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
                </EuiFlexItem>
              )}
            </EuiFlexGroup>

            {!isDeployment && (
              <>
                <EuiSpacer size="m" />
                <EuiCallOut title="DaemonSet Mode" color="primary" iconType="cluster">
                  <EuiText size="s">
                    <p>This Beat runs as a DaemonSet. Replica count is managed automatically.</p>
                  </EuiText>
                </EuiCallOut>
              </>
            )}

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
              helpText="Kibana for dashboards and setup"
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
              <EuiButtonEmpty
                onClick={() => navigate(`/beats/${namespace}/${name}`)}
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
            text: 'Beats',
            href: '#',
            onClick: (e) => {
              e.preventDefault();
              navigate('/beats');
            },
          },
          {
            text: name,
            href: '#',
            onClick: (e) => {
              e.preventDefault();
              navigate(`/beats/${namespace}/${name}`);
            },
          },
          { text: 'Edit' },
        ]}
        description={`Modify the configuration of ${beatTypeLabel} in namespace ${namespace}`}
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
