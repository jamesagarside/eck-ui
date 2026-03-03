// Enterprise Search Edit Page
import { useState, useMemo, useEffect } from 'react';
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
  EuiComboBox,
  EuiTabbedContent,
  EuiCodeBlock,
  EuiLoadingSpinner,
  EuiText,
} from '@elastic/eui';
import type { EuiComboBoxOptionOption } from '@elastic/eui';
import {
  useEnterpriseSearchDetail,
  useUpdateEnterpriseSearch,
  useElasticsearchList,
} from '../../hooks/useResources';
import type {
  EnterpriseSearch,
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

interface FormData {
  version: string;
  count: number;
  elasticsearchRef: { name: string; namespace?: string } | null;
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

function buildPatch(original: EnterpriseSearch, data: FormData): EnterpriseSearch {
  return {
    ...original,
    spec: {
      ...original.spec,
      version: data.version,
      count: data.count,
      elasticsearchRef: data.elasticsearchRef || undefined,
    },
  };
}

export function EnterpriseSearchEditPage() {
  const navigate = useNavigate();
  const { namespace, name } = useParams<{ namespace: string; name: string }>();

  const { data: entsearchData, isLoading, error: fetchError } = useEnterpriseSearchDetail(
    namespace!,
    name!
  );
  const { data: esData } = useElasticsearchList();
  const updateMutation = useUpdateEnterpriseSearch();

  // Elasticsearch options for ComboBox
  const esOptions = useMemo((): EuiComboBoxOptionOption[] => {
    const clusters = (esData?.data ?? []) as ElasticsearchCluster[];
    return clusters.map((cluster) => ({
      label: `${cluster.metadata.name} (${cluster.metadata.namespace})`,
      key: `${cluster.metadata.namespace}/${cluster.metadata.name}`,
    }));
  }, [esData]);

  const [formData, setFormData] = useState<FormData>({
    version: '',
    count: 1,
    elasticsearchRef: null,
  });

  const [selectedEs, setSelectedEs] = useState<EuiComboBoxOptionOption[]>([]);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Initialize form with existing data
  useEffect(() => {
    if (entsearchData && !initialized) {
      const entsearch = entsearchData as EnterpriseSearch;
      const newFormData: FormData = {
        version: entsearch.spec.version,
        count: entsearch.spec.count,
        elasticsearchRef: entsearch.spec.elasticsearchRef || null,
      };
      setFormData(newFormData);

      // Set selected ES cluster
      if (entsearch.spec.elasticsearchRef) {
        const esRef = entsearch.spec.elasticsearchRef;
        const key = esRef.namespace
          ? `${esRef.namespace}/${esRef.name}`
          : `${namespace}/${esRef.name}`;
        const label = esRef.namespace
          ? `${esRef.name} (${esRef.namespace})`
          : `${esRef.name} (${namespace})`;
        setSelectedEs([{ label, key }]);
      }

      setInitialized(true);
    }
  }, [entsearchData, initialized, namespace]);

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

    const patch = buildPatch(entsearchData as EnterpriseSearch, formData);

    try {
      await updateMutation.mutateAsync({
        namespace: namespace!,
        name: name!,
        data: patch,
      });
      navigate(`/enterprise-search/${namespace}/${name}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to update Enterprise Search');
    }
  };

  if (isLoading) {
    return (
      <EuiPageTemplate>
        <EuiPageTemplate.Section>
          <EuiFlexGroup justifyContent="center" alignItems="center" style={{ minHeight: 400 }}>
            <EuiFlexItem grow={false}>
              <EuiLoadingSpinner size="xl" />
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiPageTemplate.Section>
      </EuiPageTemplate>
    );
  }

  if (fetchError || !entsearchData) {
    return (
      <EuiPageTemplate>
        <EuiPageTemplate.Section>
          <EuiCallOut
            title="Error loading Enterprise Search"
            color="danger"
            iconType="error"
          >
            <p>{fetchError instanceof Error ? fetchError.message : 'Enterprise Search not found'}</p>
          </EuiCallOut>
        </EuiPageTemplate.Section>
      </EuiPageTemplate>
    );
  }

  const previewYaml = buildPatch(entsearchData as EnterpriseSearch, formData);
  const originalYaml = entsearchData as EnterpriseSearch;

  const formTab = {
    id: 'form',
    name: 'Form',
    content: (
      <>
        <EuiSpacer size="m" />
        <EuiForm component="form" onSubmit={handleSubmit}>
          {submitError && (
            <>
              <EuiCallOut title="Error updating Enterprise Search" color="danger" iconType="error">
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
              <EuiButtonEmpty
                onClick={() => navigate(`/enterprise-search/${namespace}/${name}`)}
              >
                Cancel
              </EuiButtonEmpty>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiButton
                type="submit"
                fill
                isLoading={updateMutation.isPending}
                disabled={Object.keys(errors).length > 0}
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
    name: 'Changes Preview',
    content: (
      <>
        <EuiSpacer size="m" />
        <EuiFlexGroup>
          <EuiFlexItem>
            <EuiPanel>
              <EuiTitle size="xs">
                <h3>Current</h3>
              </EuiTitle>
              <EuiSpacer size="m" />
              <EuiCodeBlock language="yaml" fontSize="s" paddingSize="m">
                {jsYaml.dump(originalYaml, { indent: 2, lineWidth: -1 })}
              </EuiCodeBlock>
            </EuiPanel>
          </EuiFlexItem>
          <EuiFlexItem>
            <EuiPanel>
              <EuiTitle size="xs">
                <h3>After Update</h3>
              </EuiTitle>
              <EuiSpacer size="m" />
              <EuiCodeBlock language="yaml" fontSize="s" paddingSize="m">
                {jsYaml.dump(previewYaml, { indent: 2, lineWidth: -1 })}
              </EuiCodeBlock>
            </EuiPanel>
          </EuiFlexItem>
        </EuiFlexGroup>
      </>
    ),
  };

  return (
    <EuiPageTemplate>
      <EuiPageHeader
        pageTitle={`Edit ${name}`}
        breadcrumbs={[
          {
            text: 'Enterprise Search',
            href: '#',
            onClick: (e: React.MouseEvent) => {
              e.preventDefault();
              navigate('/enterprise-search');
            },
          },
          {
            text: name || '',
            href: '#',
            onClick: (e: React.MouseEvent) => {
              e.preventDefault();
              navigate(`/enterprise-search/${namespace}/${name}`);
            },
          },
          { text: 'Edit' },
        ]}
        description={
          <EuiText size="s" color="subdued">
            Namespace: {namespace}
          </EuiText>
        }
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
