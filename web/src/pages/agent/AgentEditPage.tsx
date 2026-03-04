import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  EuiPageHeader, EuiSpacer, EuiForm, EuiFormRow, EuiFieldText, EuiSelect,
  EuiButton, EuiButtonEmpty, EuiFlexGroup, EuiFlexItem, EuiCallOut, EuiPanel, EuiTitle,
} from '@elastic/eui';
import { useResource, useUpdateResource } from '../../hooks/useResources';
import { DetailSkeleton } from '../../components/common/Skeletons';
import type { Agent } from '../../types/resources';

interface EditFormProps { resource: Agent; namespace: string; name: string; }

function EditForm({ resource, namespace, name }: EditFormProps) {
  const navigate = useNavigate();
  const updateMutation = useUpdateResource('agent');
  const [version, setVersion] = useState(resource.spec.version);
  const [mode, setMode] = useState<'standalone' | 'fleet'>(resource.spec.mode || 'standalone');
  const [esRef, setEsRef] = useState(resource.spec.elasticsearchRefs?.[0]?.name || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateMutation.mutateAsync({
      namespace, name,
      resource: { ...resource, spec: { ...resource.spec, version, mode: mode as 'standalone' | 'fleet', ...(esRef ? { elasticsearchRefs: [{ name: esRef }] } : {}) } },
    });
    navigate(`/agent/${namespace}/${name}`);
  };

  return (
    <>
      <EuiPageHeader pageTitle={`Edit ${resource.metadata.name}`} iconType="logoSecurity" description={`Namespace: ${resource.metadata.namespace}`} />
      <EuiSpacer size="l" />
      {updateMutation.isError && <><EuiCallOut title="Failed" color="danger" iconType="error">{updateMutation.error?.message}</EuiCallOut><EuiSpacer size="m" /></>}
      <EuiForm component="form" onSubmit={handleSubmit}>
        <EuiPanel>
          <EuiTitle size="xs"><h3>General</h3></EuiTitle><EuiSpacer size="m" />
          <EuiFormRow label="Name"><EuiFieldText value={resource.metadata.name} disabled /></EuiFormRow>
          <EuiFormRow label="Namespace"><EuiFieldText value={resource.metadata.namespace} disabled /></EuiFormRow>
          <EuiFormRow label="Version"><EuiFieldText value={version} onChange={(e) => setVersion(e.target.value)} /></EuiFormRow>
          <EuiFormRow label="Mode"><EuiSelect options={[{ value: 'standalone', text: 'Standalone' }, { value: 'fleet', text: 'Fleet' }]} value={mode} onChange={(e) => setMode(e.target.value as 'standalone' | 'fleet')} /></EuiFormRow>
          <EuiFormRow label="Elasticsearch Reference"><EuiFieldText value={esRef} onChange={(e) => setEsRef(e.target.value)} /></EuiFormRow>
        </EuiPanel>
        <EuiSpacer size="l" />
        <EuiFlexGroup justifyContent="flexEnd">
          <EuiFlexItem grow={false}><EuiButtonEmpty onClick={() => navigate(`/agent/${namespace}/${name}`)}>Cancel</EuiButtonEmpty></EuiFlexItem>
          <EuiFlexItem grow={false}><EuiButton type="submit" fill isLoading={updateMutation.isPending}>Save Changes</EuiButton></EuiFlexItem>
        </EuiFlexGroup>
      </EuiForm>
    </>
  );
}

export function AgentEditPage() {
  const { namespace, name } = useParams<{ namespace: string; name: string }>();
  const { data: resource, isLoading, error: loadError } = useResource<Agent>('agent', namespace || '', name || '');
  if (isLoading) return <DetailSkeleton />;
  if (loadError || !resource) return <EuiCallOut title="Failed to load" color="danger" iconType="error">{loadError?.message || 'Not found'}</EuiCallOut>;
  return <EditForm key={resource.metadata.resourceVersion} resource={resource} namespace={namespace || ''} name={name || ''} />;
}
