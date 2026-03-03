// Logstash Create Page
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
  EuiTextArea,
  EuiButtonIcon,
  EuiAccordion,
  EuiBadge,
  EuiText,
} from '@elastic/eui';
import type { EuiComboBoxOptionOption } from '@elastic/eui';
import {
  useCreateLogstash,
  useNamespaces,
  useElasticsearchList,
} from '../../hooks/useResources';
import type {
  Logstash,
  ElasticsearchCluster,
} from '../../types/resources';
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

interface Pipeline {
  id: string;
  config: string;
}

interface FormData {
  name: string;
  namespace: string;
  version: string;
  count: number;
  elasticsearchRefs: Array<{ name: string; namespace?: string }>;
  pipelines: Pipeline[];
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

  if (data.count < 1) {
    errors.count = 'Count must be at least 1';
  }

  // Validate pipelines
  data.pipelines.forEach((pipeline, index) => {
    if (!pipeline.id) {
      errors[`pipeline_${index}_id`] = 'Pipeline ID is required';
    }
    if (!pipeline.config) {
      errors[`pipeline_${index}_config`] = 'Pipeline configuration is required';
    }
  });

  return errors;
}

function buildLogstashSpec(data: FormData): Logstash {
  const logstash: Logstash = {
    apiVersion: 'logstash.k8s.elastic.co/v1alpha1',
    kind: 'Logstash',
    metadata: {
      name: data.name,
      namespace: data.namespace,
    },
    spec: {
      version: data.version,
      count: data.count,
      elasticsearchRefs: data.elasticsearchRefs.length > 0 ? data.elasticsearchRefs : undefined,
      pipelines: data.pipelines.length > 0
        ? data.pipelines.map((p) => ({
            pipeline: {
              id: p.id,
              config: {
                string: p.config,
              },
            },
          }))
        : undefined,
    },
  };

  return logstash;
}

const defaultPipelineConfig = `input {
  beats {
    port => 5044
  }
}

filter {
  # Add your filters here
}

output {
  elasticsearch {
    hosts => ["\${ELASTICSEARCH_HOSTS}"]
    user => "\${ELASTICSEARCH_USER}"
    password => "\${ELASTICSEARCH_PASSWORD}"
    ssl_certificate_authorities => ["\${ELASTICSEARCH_CA}"]
  }
}`;

export function LogstashCreatePage() {
  const navigate = useNavigate();
  const { data: rawNamespaces } = useNamespaces();
  const { data: esData } = useElasticsearchList();
  const createMutation = useCreateLogstash();

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

  const [formData, setFormData] = useState<FormData>({
    name: '',
    namespace: 'default',
    version: '8.17.0',
    count: 1,
    elasticsearchRefs: [],
    pipelines: [],
  });

  const [selectedEs, setSelectedEs] = useState<EuiComboBoxOptionOption[]>([]);
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
    const refs = selected
      .filter((opt) => opt.key)
      .map((opt) => {
        const [ns, esName] = opt.key!.split('/');
        return { name: esName, namespace: ns };
      });
    updateField('elasticsearchRefs', refs);
  };

  const addPipeline = () => {
    setFormData((prev) => ({
      ...prev,
      pipelines: [
        ...prev.pipelines,
        { id: `pipeline-${prev.pipelines.length + 1}`, config: defaultPipelineConfig },
      ],
    }));
  };

  const removePipeline = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      pipelines: prev.pipelines.filter((_, i) => i !== index),
    }));
  };

  const updatePipeline = (index: number, field: keyof Pipeline, value: string) => {
    setFormData((prev) => ({
      ...prev,
      pipelines: prev.pipelines.map((p, i) =>
        i === index ? { ...p, [field]: value } : p
      ),
    }));
    // Clear pipeline-specific errors
    const errorKey = `pipeline_${index}_${field}`;
    if (errors[errorKey]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[errorKey];
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

    const logstashSpec = buildLogstashSpec(formData);

    try {
      await createMutation.mutateAsync({
        namespace: formData.namespace,
        data: logstashSpec,
      });
      navigate(`/logstash/${formData.namespace}/${formData.name}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create Logstash');
    }
  };

  const previewYaml = buildLogstashSpec(formData);

  const formTab = {
    id: 'form',
    name: 'Form',
    content: (
      <>
        <EuiSpacer size="m" />
        <EuiForm component="form" onSubmit={handleSubmit}>
          {submitError && (
            <>
              <EuiCallOut title="Error creating Logstash" color="danger" iconType="error">
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
                  helpText="Unique name for this Logstash instance"
                  isInvalid={!!errors.name}
                  error={errors.name}
                >
                  <EuiFieldText
                    placeholder="my-logstash"
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
                <EuiFormRow label="Version" helpText="Elastic Stack version">
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
          </EuiPanel>

          <EuiSpacer size="l" />

          <EuiPanel>
            <EuiTitle size="xs">
              <h3>Elasticsearch Outputs</h3>
            </EuiTitle>
            <EuiSpacer size="m" />

            <EuiFormRow
              label="Elasticsearch Clusters"
              helpText="Clusters to send processed data to (can select multiple)"
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

          <EuiSpacer size="l" />

          <EuiPanel>
            <EuiFlexGroup justifyContent="spaceBetween" alignItems="center">
              <EuiFlexItem grow={false}>
                <EuiTitle size="xs">
                  <h3>Pipelines</h3>
                </EuiTitle>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiButton
                  size="s"
                  iconType="plusInCircle"
                  onClick={addPipeline}
                >
                  Add Pipeline
                </EuiButton>
              </EuiFlexItem>
            </EuiFlexGroup>
            <EuiSpacer size="m" />

            {formData.pipelines.length === 0 ? (
              <EuiCallOut title="No pipelines" color="primary" iconType="iInCircle">
                <EuiText size="s">
                  <p>
                    Add at least one pipeline to process your data. Click "Add Pipeline" to get
                    started.
                  </p>
                </EuiText>
              </EuiCallOut>
            ) : (
              formData.pipelines.map((pipeline, index) => (
                <EuiAccordion
                  key={index}
                  id={`pipeline-${index}`}
                  buttonContent={
                    <EuiFlexGroup alignItems="center" gutterSize="s">
                      <EuiFlexItem grow={false}>
                        <EuiBadge color="hollow">{pipeline.id || `Pipeline ${index + 1}`}</EuiBadge>
                      </EuiFlexItem>
                    </EuiFlexGroup>
                  }
                  extraAction={
                    <EuiButtonIcon
                      iconType="trash"
                      color="danger"
                      onClick={() => removePipeline(index)}
                      aria-label="Remove pipeline"
                    />
                  }
                  paddingSize="m"
                  initialIsOpen={true}
                >
                  <EuiSpacer size="s" />
                  <EuiFormRow
                    label="Pipeline ID"
                    isInvalid={!!errors[`pipeline_${index}_id`]}
                    error={errors[`pipeline_${index}_id`]}
                  >
                    <EuiFieldText
                      value={pipeline.id}
                      onChange={(e) => updatePipeline(index, 'id', e.target.value)}
                      isInvalid={!!errors[`pipeline_${index}_id`]}
                    />
                  </EuiFormRow>
                  <EuiSpacer size="m" />
                  <EuiFormRow
                    label="Pipeline Configuration"
                    helpText="Logstash pipeline configuration (input, filter, output)"
                    isInvalid={!!errors[`pipeline_${index}_config`]}
                    error={errors[`pipeline_${index}_config`]}
                    fullWidth
                  >
                    <EuiTextArea
                      value={pipeline.config}
                      onChange={(e) => updatePipeline(index, 'config', e.target.value)}
                      rows={15}
                      fullWidth
                      isInvalid={!!errors[`pipeline_${index}_config`]}
                      style={{ fontFamily: 'monospace' }}
                    />
                  </EuiFormRow>
                </EuiAccordion>
              ))
            )}
          </EuiPanel>

          <EuiSpacer size="l" />

          <EuiFlexGroup justifyContent="flexEnd">
            <EuiFlexItem grow={false}>
              <EuiButtonEmpty onClick={() => navigate('/logstash')}>Cancel</EuiButtonEmpty>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiButton
                type="submit"
                fill
                isLoading={createMutation.isPending}
                disabled={Object.keys(errors).length > 0}
              >
                Create Logstash
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
        pageTitle="Create Logstash"
        breadcrumbs={[
          {
            text: 'Logstash',
            href: '#',
            onClick: (e: React.MouseEvent) => {
              e.preventDefault();
              navigate('/logstash');
            },
          },
          { text: 'Create' },
        ]}
        description="Deploy a new Logstash data processing pipeline"
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
