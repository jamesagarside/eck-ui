import { useParams, useNavigate } from 'react-router-dom';
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
  specToNodeSetConfigs,
  type NodeSetConfig,
} from '../../components/elasticsearch/NodeSetEditor';
import { useResource, useUpdateResource } from '../../hooks/useResources';
import { DetailSkeleton } from '../../components/common/Skeletons';
import { useToast } from '../../context/ToastContext';
import { useResourceForm } from '../../hooks/useResourceForm';
import { UnsavedChangesPrompt } from '../../hooks/useUnsavedChanges';
import { validateRequired } from '../../utils/validators';
import type { Elasticsearch } from '../../types/resources';

interface ElasticsearchEditFormValues {
  version: string;
  nodeSets: NodeSetConfig[];
}

function validateElasticsearchEditForm(
  values: ElasticsearchEditFormValues,
): Partial<Record<keyof ElasticsearchEditFormValues, string>> {
  const errors: Partial<Record<keyof ElasticsearchEditFormValues, string>> = {};
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

interface EditFormProps {
  resource: Elasticsearch;
  namespace: string;
  name: string;
}

function EditForm({ resource, namespace, name }: EditFormProps) {
  const navigate = useNavigate();
  const updateMutation = useUpdateResource('elasticsearch');
  const { addToast } = useToast();

  const form = useResourceForm<ElasticsearchEditFormValues>({
    initialValues: {
      version: resource.spec.version,
      nodeSets: specToNodeSetConfigs(resource.spec.nodeSets),
    },
    validate: validateElasticsearchEditForm,
    onSubmit: async (values) => {
      const updated = {
        ...resource,
        spec: {
          ...resource.spec,
          version: values.version,
          nodeSets: nodeSetConfigsToSpec(values.nodeSets),
        },
      };

      try {
        await updateMutation.mutateAsync({
          namespace,
          name,
          resource: updated,
        });
        addToast({ title: `Elasticsearch '${name}' updated`, color: 'success' });
        navigate(`/elasticsearch/${namespace}/${name}`);
      } catch (err) {
        addToast({ title: 'Failed to update Elasticsearch', color: 'danger', text: err instanceof Error ? err.message : 'An unexpected error occurred' });
      }
    },
  });

  return (
    <>
      <UnsavedChangesPrompt isDirty={form.isDirty} />
      <EuiPageHeader
        pageTitle={`Edit ${resource.metadata.name}`}
        iconType="logoElasticsearch"
        description={`Namespace: ${resource.metadata.namespace}`}
      />
      <EuiSpacer size="l" />

      <EuiForm component="form" onSubmit={form.handleSubmit}>
        <EuiPanel>
          <EuiTitle size="xs">
            <h3>General</h3>
          </EuiTitle>
          <EuiSpacer size="m" />

          <EuiFormRow label="Name">
            <EuiFieldText
              value={resource.metadata.name}
              disabled
              aria-label="Cluster name (read-only)"
            />
          </EuiFormRow>

          <EuiFormRow label="Namespace">
            <EuiFieldText
              value={resource.metadata.namespace}
              disabled
              aria-label="Namespace (read-only)"
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
            <EuiButtonEmpty
              onClick={() =>
                navigate(`/elasticsearch/${namespace}/${name}`)
              }
            >
              Cancel
            </EuiButtonEmpty>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiButton
              type="submit"
              fill
              isLoading={form.isSubmitting}
            >
              Save Changes
            </EuiButton>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiForm>
    </>
  );
}

export function ElasticsearchEditPage() {
  const { namespace, name } = useParams<{
    namespace: string;
    name: string;
  }>();

  const {
    data: resource,
    isLoading,
    error: loadError,
  } = useResource<Elasticsearch>('elasticsearch', namespace || '', name || '');

  if (isLoading) return <DetailSkeleton />;

  if (loadError || !resource) {
    return (
      <EuiCallOut
        title="Failed to load Elasticsearch cluster"
        color="danger"
        iconType="error"
      >
        {loadError?.message || 'Resource not found'}
      </EuiCallOut>
    );
  }

  return (
    <EditForm
      key={resource.metadata.resourceVersion}
      resource={resource}
      namespace={namespace || ''}
      name={name || ''}
    />
  );
}
