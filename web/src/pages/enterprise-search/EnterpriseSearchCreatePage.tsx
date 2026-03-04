// Enterprise Search Create Page
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
} from '@elastic/eui';
import type { EuiComboBoxOptionOption } from '@elastic/eui';
import {
  useCreateEnterpriseSearch,
  useNamespaces,
  useElasticsearchList,
} from '../../hooks/useResources';
import type { EnterpriseSearch, ElasticsearchCluster } from '../../types/resources';
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
  name: string;
  namespace: string;
  version: string;
  count: number;
  elasticsearchRef: { name: string; namespace?: string } | null;
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

  if (!data.elasticsearchRef) {
    errors.elasticsearchRef = 'Elasticsearch cluster is required';
  }

  return errors;
}

function buildSpec(data: FormData): EnterpriseSearch {
  return {
    apiVersion: 'enterprisesearch.k8s.elastic.co/v1',
    kind: 'EnterpriseSearch',
    metadata: {
      name: data.name,
      namespace: data.namespace,
    },
    spec: {
      version: data.version,
      count: data.count,
      elasticsearchRef: data.elasticsearchRef || undefined,
    },
  };
}

export function EnterpriseSearchCreatePage() {
  const navigate = useNavigate();
  const { data: rawNamespaces } = useNamespaces();
  const { data: esData } = useElasticsearchList();
  const createMutation = useCreateEnterpriseSearch();

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
    elasticsearchRef: null,
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
    if (selected.length > 0 && selected[0].key) {
      const [ns, esName] = selected[0].key.split('/');
      updateField('elasticsearchRef', { name: esName, namespace: ns });
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

    const spec = buildSpec(formData);

    try {
      await createMutation.mutateAsync({
        namespace: formData.namespace,
        data: spec,
      });
      navigate(`/enterprise-search/${formData.namespace}/${formData.name}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create Enterprise Search');
    }
  };

  const previewYaml = buildSpec(formData);

  const formTab = {
    id: 'form',
    name: 'Form',
    content: (
      <>
        <EuiSpacer size="m" />
        <EuiForm component="form" onSubmit={handleSubmit}>
          {submitError && (
            <>
              <EuiCallOut title="Error creating Enterprise Search" color="danger" iconType="error">
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
                  helpText="Unique name for this Enterprise Search instance"
                  isInvalid={!!errors.name}
                  error={errors.name}
                >
                  <EuiFieldText
                    placeholder="my-enterprise-search"
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
                  helpText="Number of Enterprise Search pods"
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
              helpText="Enterprise Search requires an Elasticsearch cluster"
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
          </EuiPanel>

          <EuiSpacer size="l" />

          <EuiFlexGroup justifyContent="flexEnd">
            <EuiFlexItem grow={false}>
              <EuiButtonEmpty onClick={() => navigate('/enterprise-search')}>Cancel</EuiButtonEmpty>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiButton
                type="submit"
                fill
                isLoading={createMutation.isPending}
                disabled={Object.keys(errors).length > 0}
              >
                Create Enterprise Search
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
        pageTitle="Create Enterprise Search"
        breadcrumbs={[
          {
            text: 'Enterprise Search',
            href: '#',
            onClick: (e: React.MouseEvent) => {
              e.preventDefault();
              navigate('/enterprise-search');
            },
          },
          { text: 'Create' },
        ]}
        description="Deploy a new Enterprise Search instance"
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
