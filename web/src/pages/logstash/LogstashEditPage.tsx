// Logstash Edit Page
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
  useLogstashDetail,
  useUpdateLogstash,
  useElasticsearchList,
} from '../../hooks/useResources';
import type { Logstash, ElasticsearchCluster } from '../../types/resources';
import { DetailSkeleton } from '../../components/common/Skeletons';
import jsYaml from 'js-yaml';

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
  count: number;
  elasticsearchRefs: Array<{ name: string; namespace?: string }>;
}

interface ValidationErrors {
  [key: string]: string;
}

function validateForm(data: FormData): ValidationErrors {
  const errors: ValidationErrors = {};

  if (data.count < 1) {
    errors.count = 'Count must be at least 1';
  }

  return errors;
}

function buildUpdatedSpec(original: Logstash, data: FormData): Logstash {
  return {
    ...original,
    spec: {
      ...original.spec,
      version: data.version,
      count: data.count,
      elasticsearchRefs: data.elasticsearchRefs.length > 0 ? data.elasticsearchRefs : undefined,
    },
  };
}

function hasChanges(original: unknown, updated: unknown): boolean {
  return JSON.stringify(original) !== JSON.stringify(updated);
}

export function LogstashEditPage() {
  const { namespace = '', name = '' } = useParams();
  const navigate = useNavigate();

  const { data: rawLogstash, isLoading, error: loadError } = useLogstashDetail(namespace, name);
  const updateMutation = useUpdateLogstash();
  const { data: esData } = useElasticsearchList();

  const logstash = rawLogstash as Logstash | undefined;

  // Build options for combo boxes
  const esOptions = useMemo((): EuiComboBoxOptionOption[] => {
    const clusters = (esData?.data ?? []) as ElasticsearchCluster[];
    return clusters.map((cluster) => ({
      label: `${cluster.metadata.name} (${cluster.metadata.namespace})`,
      key: `${cluster.metadata.namespace}/${cluster.metadata.name}`,
    }));
  }, [esData]);

  const [formData, setFormData] = useState<FormData | null>(null);
  const [originalSpec, setOriginalSpec] = useState<Logstash | null>(null);
  const [selectedEs, setSelectedEs] = useState<EuiComboBoxOptionOption[]>([]);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Initialize form data when logstash loads
  useEffect(() => {
    if (logstash && !formData) {
      const esRefs = logstash.spec.elasticsearchRefs || [];

      setFormData({
        version: logstash.spec.version,
        count: logstash.spec.count || 1,
        elasticsearchRefs: esRefs,
      });
      setOriginalSpec(logstash);

      // Set selected ES
      const esSelections = esRefs.map((ref) => {
        const esNs = ref.namespace || namespace;
        return {
          label: `${ref.name} (${esNs})`,
          key: `${esNs}/${ref.name}`,
        };
      });
      setSelectedEs(esSelections);
    }
  }, [logstash, formData, namespace]);

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
    const refs = selected
      .filter((opt) => opt.key)
      .map((opt) => {
        const [ns, esName] = opt.key!.split('/');
        return { name: esName, namespace: ns };
      });
    updateField('elasticsearchRefs', refs);
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
      navigate(`/logstash/${namespace}/${name}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to update Logstash');
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
        <EuiCallOut title="Error loading Logstash" color="danger" iconType="error">
          <p>{loadError instanceof Error ? loadError.message : 'Unknown error'}</p>
          <EuiButton onClick={() => navigate('/logstash')}>Back to list</EuiButton>
        </EuiCallOut>
      </EuiPageTemplate>
    );
  }

  const updatedSpec = originalSpec ? buildUpdatedSpec(originalSpec, formData) : null;
  const isDirty = originalSpec && updatedSpec && hasChanges(originalSpec.spec, updatedSpec.spec);

  const originalYaml = originalSpec ? jsYaml.dump(originalSpec, { indent: 2, lineWidth: -1 }) : '';
  const updatedYaml = updatedSpec ? jsYaml.dump(updatedSpec, { indent: 2, lineWidth: -1 }) : '';

  const diffItems = [];
  if (originalSpec && formData) {
    if (originalSpec.spec.version !== formData.version) {
      diffItems.push({
        title: 'Version',
        description: (
          <>
            <EuiCode>{originalSpec.spec.version}</EuiCode> → <EuiCode>{formData.version}</EuiCode>
          </>
        ),
      });
    }
    if ((originalSpec.spec.count || 1) !== formData.count) {
      diffItems.push({
        title: 'Count',
        description: (
          <>
            <EuiCode>{originalSpec.spec.count || 1}</EuiCode> → <EuiCode>{formData.count}</EuiCode>
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
              <EuiCallOut title="Error updating Logstash" color="danger" iconType="error">
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
                    <EuiBadge color={logstash?.status?.health === 'green' ? 'success' : 'warning'}>
                      {logstash?.status?.health || 'unknown'}
                    </EuiBadge>
                  ),
                },
                {
                  title: 'Pipelines',
                  description: (
                    <EuiBadge color="hollow">
                      {logstash?.spec.pipelines?.length || 0} pipeline
                      {(logstash?.spec.pipelines?.length || 0) !== 1 ? 's' : ''}
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
                <EuiFormRow label="Version" helpText="Changing version will trigger an upgrade">
                  <EuiSelect
                    options={versionOptions}
                    value={formData.version}
                    onChange={(e) => updateField('version', e.target.value)}
                  />
                </EuiFormRow>
              </EuiFlexItem>
              <EuiFlexItem>
                <EuiFormRow
                  label="Count"
                  helpText="Number of Logstash pods"
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
              <h3>Elasticsearch Outputs</h3>
            </EuiTitle>
            <EuiSpacer size="m" />

            <EuiFormRow
              label="Elasticsearch Clusters"
              helpText="Clusters to send processed data to"
            >
              <EuiComboBox
                placeholder="Select Elasticsearch clusters"
                options={esOptions}
                selectedOptions={selectedEs}
                onChange={handleEsChange}
                isClearable
              />
            </EuiFormRow>
          </EuiPanel>

          <EuiSpacer size="m" />

          <EuiCallOut title="Pipeline Configuration" color="primary" iconType="iInCircle">
            <EuiText size="s">
              <p>
                To modify pipelines, edit the raw YAML or use kubectl to update the Logstash
                resource directly.
              </p>
            </EuiText>
          </EuiCallOut>

          <EuiSpacer size="l" />

          <EuiFlexGroup justifyContent="flexEnd">
            <EuiFlexItem grow={false}>
              <EuiButtonEmpty
                onClick={() => navigate(`/logstash/${namespace}/${name}`)}
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
            text: 'Logstash',
            href: '#',
            onClick: (e) => {
              e.preventDefault();
              navigate('/logstash');
            },
          },
          {
            text: name,
            href: '#',
            onClick: (e) => {
              e.preventDefault();
              navigate(`/logstash/${namespace}/${name}`);
            },
          },
          { text: 'Edit' },
        ]}
        description={`Modify the configuration of Logstash in namespace ${namespace}`}
        rightSideItems={[isDirty && <EuiBadge color="warning">Unsaved changes</EuiBadge>].filter(
          Boolean
        )}
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
