import { useNavigate } from 'react-router-dom';
import {
  EuiPageHeader,
  EuiSpacer,
  EuiForm,
  EuiFormRow,
  EuiFieldText,
  EuiButton,
  EuiButtonEmpty,
  EuiFlexGroup,
  EuiFlexItem,
  EuiCallOut,
  EuiPanel,
  EuiTitle,
} from '@elastic/eui';
import {
  NodeSetEditor,
  nodeSetConfigsToSpec,
  type NodeSetConfig,
} from '../../components/elasticsearch/NodeSetEditor';
import { useCreateResource } from '../../hooks/useResources';
import { useToast } from '../../context/ToastContext';
import { useResourceForm } from '../../hooks/useResourceForm';
import { UnsavedChangesPrompt } from '../../hooks/useUnsavedChanges';
import { validateK8sName, validateRequired } from '../../utils/validators';

interface ElasticsearchCreateFormValues {
  name: string;
  namespace: string;
  version: string;
  nodeSets: NodeSetConfig[];
}

function validateElasticsearchCreateForm(
  values: ElasticsearchCreateFormValues,
): Partial<Record<keyof ElasticsearchCreateFormValues, string>> {
  const errors: Partial<Record<keyof ElasticsearchCreateFormValues, string>> = {};
  const nameError = validateK8sName(values.name);
  if (nameError) errors.name = nameError;
  const nsError = validateRequired(values.namespace, 'Namespace');
  if (nsError) errors.namespace = nsError;
  const versionError = validateRequired(values.version, 'Version');
  if (versionError) errors.version = versionError;
  if (values.nodeSets.length === 0) {
    errors.nodeSets = 'At least one NodeSet is required';
  } else {
    for (const ns of values.nodeSets) {
      if (!ns.name.trim()) {
        errors.nodeSets = 'All NodeSets must have a name';
        break;
      }
    }
  }
  return errors;
}

export function ElasticsearchCreatePage() {
  const navigate = useNavigate();
  const createMutation = useCreateResource('elasticsearch');
  const { addToast } = useToast();

  const form = useResourceForm<ElasticsearchCreateFormValues>({
    initialValues: {
      name: '',
      namespace: 'default',
      version: '8.17.0',
      nodeSets: [
        {
          name: 'default',
          count: 1,
          roles: ['master', 'data', 'ingest'],
          memoryRequest: '2Gi',
          cpuRequest: '1',
          memoryLimit: '2Gi',
          cpuLimit: '1',
          storageSize: '10Gi',
          storageClass: '',
        },
      ],
    },
    validate: validateElasticsearchCreateForm,
    onSubmit: async (values) => {
      const resource = {
        apiVersion: 'elasticsearch.k8s.elastic.co/v1',
        kind: 'Elasticsearch',
        metadata: { name: values.name, namespace: values.namespace },
        spec: {
          version: values.version,
          nodeSets: nodeSetConfigsToSpec(values.nodeSets),
        },
      };

      try {
        await createMutation.mutateAsync(resource);
        addToast({ title: `Elasticsearch cluster '${values.name}' created successfully`, color: 'success' });
        navigate('/elasticsearch');
      } catch (err) {
        addToast({ title: 'Failed to create Elasticsearch cluster', color: 'danger', text: err instanceof Error ? err.message : 'An unexpected error occurred' });
      }
    },
  });

  return (
    <>
      <UnsavedChangesPrompt isDirty={form.isDirty} />
      <EuiPageHeader
        pageTitle="Create Elasticsearch Cluster"
        iconType="logoElasticsearch"
      />
      <EuiSpacer size="l" />

      <EuiForm component="form" onSubmit={form.handleSubmit}>
        <EuiPanel>
          <EuiTitle size="xs">
            <h3>General</h3>
          </EuiTitle>
          <EuiSpacer size="m" />

          <EuiFormRow
            label="Name"
            isInvalid={form.fields.name.isInvalid}
            error={form.fields.name.error}
          >
            <EuiFieldText
              value={form.fields.name.value as string}
              onChange={(e) => form.fields.name.onChange(e.target.value)}
              onBlur={form.fields.name.onBlur}
              isInvalid={form.fields.name.isInvalid}
              placeholder="my-elasticsearch"
              aria-label="Cluster name"
            />
          </EuiFormRow>

          <EuiFormRow
            label="Namespace"
            isInvalid={form.fields.namespace.isInvalid}
            error={form.fields.namespace.error}
          >
            <EuiFieldText
              value={form.fields.namespace.value as string}
              onChange={(e) => form.fields.namespace.onChange(e.target.value)}
              onBlur={form.fields.namespace.onBlur}
              isInvalid={form.fields.namespace.isInvalid}
              aria-label="Namespace"
            />
          </EuiFormRow>

          <EuiFormRow
            label="Version"
            isInvalid={form.fields.version.isInvalid}
            error={form.fields.version.error}
          >
            <EuiFieldText
              value={form.fields.version.value as string}
              onChange={(e) => form.fields.version.onChange(e.target.value)}
              onBlur={form.fields.version.onBlur}
              isInvalid={form.fields.version.isInvalid}
              placeholder="8.17.0"
              aria-label="Elasticsearch version"
            />
          </EuiFormRow>
        </EuiPanel>

        <EuiSpacer size="l" />

        <EuiPanel>
          <EuiTitle size="xs">
            <h3>NodeSets</h3>
          </EuiTitle>
          <EuiSpacer size="m" />
          {form.fields.nodeSets.isInvalid && form.fields.nodeSets.error && (
            <>
              <EuiCallOut
                title={form.fields.nodeSets.error}
                color="danger"
                iconType="error"
                size="s"
              />
              <EuiSpacer size="m" />
            </>
          )}
          <NodeSetEditor
            nodeSets={form.fields.nodeSets.value as NodeSetConfig[]}
            onChange={(updated) => form.fields.nodeSets.onChange(updated)}
          />
        </EuiPanel>

        <EuiSpacer size="l" />

        <EuiFlexGroup justifyContent="flexEnd">
          <EuiFlexItem grow={false}>
            <EuiButtonEmpty onClick={() => navigate('/elasticsearch')}>
              Cancel
            </EuiButtonEmpty>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiButton
              type="submit"
              fill
              isLoading={form.isSubmitting}
            >
              Create Cluster
            </EuiButton>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiForm>
    </>
  );
}
