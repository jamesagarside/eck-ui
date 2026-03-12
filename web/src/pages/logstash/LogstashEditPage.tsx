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
import type { Logstash } from '../../types/resources';

interface LogstashEditFormValues {
  version: string;
  count: number;
}

interface EditFormProps { resource: Logstash; namespace: string; name: string; }

function EditForm({ resource, namespace, name }: EditFormProps) {
  const navigate = useNavigate();
  const updateMutation = useUpdateResource('logstash');
  const { addToast } = useToast();

  const form = useResourceForm<LogstashEditFormValues>({
    initialValues: {
      version: resource.spec.version,
      count: resource.spec.count,
    },
    onSubmit: async (values) => {
      try {
        await updateMutation.mutateAsync({
          namespace, name,
          resource: { ...resource, spec: { ...resource.spec, version: values.version, count: values.count } },
        });
        addToast({ title: `Logstash '${name}' updated`, color: 'success' });
        navigate(`/logstash/${namespace}/${name}`);
      } catch (err) {
        addToast({ title: 'Failed to update Logstash', color: 'danger', text: err instanceof Error ? err.message : 'An unexpected error occurred' });
      }
    },
  });

  return (
    <>
      <UnsavedChangesPrompt isDirty={form.isDirty} />
      <EuiPageHeader pageTitle={`Edit ${resource.metadata.name}`} iconType="logoLogstash" description={`Namespace: ${resource.metadata.namespace}`} />
      <EuiSpacer size="l" />
      <EuiForm component="form" onSubmit={form.handleSubmit}>
        <EuiPanel>
          <EuiTitle size="xs"><h3>General</h3></EuiTitle>
          <EuiSpacer size="m" />
          <EuiFormRow label="Name"><EuiFieldText value={resource.metadata.name} disabled /></EuiFormRow>
          <EuiFormRow label="Namespace"><EuiFieldText value={resource.metadata.namespace} disabled /></EuiFormRow>
          <EuiFormRow label="Version">
            <VersionSelect
              value={form.fields.version.value as string}
              onChange={(v) => form.fields.version.onChange(v)}
              currentVersion={resource.spec.version}
            />
          </EuiFormRow>
          <EuiFormRow label="Count">
            <EuiFieldNumber
              value={form.fields.count.value as number}
              onChange={(e) => form.fields.count.onChange(parseInt(e.target.value, 10) || 1)}
              min={1}
            />
          </EuiFormRow>
        </EuiPanel>
        <EuiSpacer size="l" />
        <EuiFlexGroup justifyContent="flexEnd">
          <EuiFlexItem grow={false}><EuiButtonEmpty onClick={() => navigate(`/logstash/${namespace}/${name}`)}>Cancel</EuiButtonEmpty></EuiFlexItem>
          <EuiFlexItem grow={false}><EuiButton type="submit" fill isLoading={form.isSubmitting}>Save Changes</EuiButton></EuiFlexItem>
        </EuiFlexGroup>
      </EuiForm>
    </>
  );
}

export function LogstashEditPage() {
  const { namespace, name } = useParams<{ namespace: string; name: string }>();
  const { data: resource, isLoading, error: loadError } = useResource<Logstash>('logstash', namespace || '', name || '');
  if (isLoading) return <DetailSkeleton />;
  if (loadError || !resource) return <EuiCallOut title="Failed to load" color="danger" iconType="error">{loadError?.message || 'Not found'}</EuiCallOut>;
  return <EditForm key={resource.metadata.resourceVersion} resource={resource} namespace={namespace || ''} name={name || ''} />;
}
