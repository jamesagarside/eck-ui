import { useParams, useNavigate } from 'react-router-dom';
import {
  EuiPageHeader, EuiSpacer, EuiForm, EuiFormRow, EuiFieldText, EuiFieldNumber,
  EuiButton, EuiButtonEmpty, EuiFlexGroup, EuiFlexItem, EuiCallOut, EuiPanel, EuiTitle,
} from '@elastic/eui';
import { useResource, useUpdateResource } from '../../hooks/useResources';
import { DetailSkeleton } from '../../components/common/Skeletons';
import { VersionSelect } from '../../components/form/VersionSelect';
import { useToast } from '../../context/ToastContext';
import { useResourceForm } from '../../hooks/useResourceForm';
import { UnsavedChangesPrompt } from '../../hooks/useUnsavedChanges';
import type { ElasticMapsServer } from '../../types/resources';

interface MapsEditFormValues {
  version: string;
  count: number;
  elasticsearchRef: string;
}

interface EditFormProps { resource: ElasticMapsServer; namespace: string; name: string; }

function EditForm({ resource, namespace, name }: EditFormProps) {
  const navigate = useNavigate();
  const updateMutation = useUpdateResource('maps');
  const { addToast } = useToast();

  const form = useResourceForm<MapsEditFormValues>({
    initialValues: {
      version: resource.spec.version,
      count: resource.spec.count,
      elasticsearchRef: resource.spec.elasticsearchRef?.name || '',
    },
    onSubmit: async (values) => {
      try {
        await updateMutation.mutateAsync({
          namespace, name,
          resource: {
            ...resource,
            spec: {
              ...resource.spec,
              version: values.version,
              count: values.count,
              elasticsearchRef: { name: values.elasticsearchRef },
            },
          },
        });
        addToast({ title: `Elastic Maps Server '${name}' updated`, color: 'success' });
        navigate(`/maps/${namespace}/${name}`);
      } catch (err) {
        addToast({ title: 'Failed to update Elastic Maps Server', color: 'danger', text: err instanceof Error ? err.message : 'An unexpected error occurred' });
      }
    },
  });

  return (
    <>
      <UnsavedChangesPrompt isDirty={form.isDirty} />
      <EuiPageHeader pageTitle={`Edit ${resource.metadata.name}`} iconType="logoMaps" description={`Namespace: ${resource.metadata.namespace}`} />
      <EuiSpacer size="l" />
      <EuiForm component="form" onSubmit={form.handleSubmit}>
        <EuiPanel>
          <EuiTitle size="xs"><h3>General</h3></EuiTitle><EuiSpacer size="m" />
          <EuiFormRow label="Name"><EuiFieldText value={resource.metadata.name} disabled /></EuiFormRow>
          <EuiFormRow label="Namespace"><EuiFieldText value={resource.metadata.namespace} disabled /></EuiFormRow>
          <EuiFormRow label="Version">
            <VersionSelect value={form.fields.version.value as string} onChange={(v) => form.fields.version.onChange(v)} currentVersion={resource.spec.version} />
          </EuiFormRow>
          <EuiFormRow label="Count">
            <EuiFieldNumber value={form.fields.count.value as number} onChange={(e) => form.fields.count.onChange(parseInt(e.target.value, 10) || 1)} min={1} />
          </EuiFormRow>
          <EuiFormRow label="Elasticsearch Reference">
            <EuiFieldText value={form.fields.elasticsearchRef.value as string} onChange={(e) => form.fields.elasticsearchRef.onChange(e.target.value)} />
          </EuiFormRow>
        </EuiPanel>
        <EuiSpacer size="l" />
        <EuiFlexGroup justifyContent="flexEnd">
          <EuiFlexItem grow={false}><EuiButtonEmpty onClick={() => navigate(`/maps/${namespace}/${name}`)}>Cancel</EuiButtonEmpty></EuiFlexItem>
          <EuiFlexItem grow={false}><EuiButton type="submit" fill isLoading={form.isSubmitting}>Save Changes</EuiButton></EuiFlexItem>
        </EuiFlexGroup>
      </EuiForm>
    </>
  );
}

export function MapsEditPage() {
  const { namespace, name } = useParams<{ namespace: string; name: string }>();
  const { data: resource, isLoading, error: loadError } = useResource<ElasticMapsServer>('maps', namespace || '', name || '');
  if (isLoading) return <DetailSkeleton />;
  if (loadError || !resource) return <EuiCallOut title="Failed to load" color="danger" iconType="error">{loadError?.message || 'Not found'}</EuiCallOut>;
  return <EditForm key={resource.metadata.resourceVersion} resource={resource} namespace={namespace || ''} name={name || ''} />;
}
