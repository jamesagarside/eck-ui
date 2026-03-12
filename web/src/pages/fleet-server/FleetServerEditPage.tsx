import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  EuiPageHeader, EuiSpacer, EuiForm, EuiFormRow, EuiFieldText, EuiFieldNumber,
  EuiButton, EuiButtonEmpty, EuiFlexGroup, EuiFlexItem, EuiCallOut, EuiPanel, EuiTitle,
} from '@elastic/eui';
import { useResource, useUpdateResource } from '../../hooks/useResources';
import { DetailSkeleton } from '../../components/common/Skeletons';
import { VersionSelect } from '../../components/form/VersionSelect';
import { useToast } from '../../context/ToastContext';
import type { Agent } from '../../types/resources';

interface EditFormProps { resource: Agent; namespace: string; name: string; }

function EditForm({ resource, namespace, name }: EditFormProps) {
  const navigate = useNavigate();
  const updateMutation = useUpdateResource('agent');
  const { addToast } = useToast();
  const [version, setVersion] = useState(resource.spec.version);
  const [replicas, setReplicas] = useState(resource.spec.deployment?.replicas || 1);
  const [esRef, setEsRef] = useState(resource.spec.elasticsearchRefs?.[0]?.name || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateMutation.mutateAsync({
        namespace, name,
        resource: {
          ...resource,
          spec: {
            ...resource.spec,
            version,
            mode: 'fleet',
            fleetServerEnabled: true,
            deployment: { ...resource.spec.deployment, replicas },
            ...(esRef ? { elasticsearchRefs: [{ name: esRef }] } : {}),
          },
        },
      });
      addToast({ title: `Fleet Server '${name}' updated`, color: 'success' });
      navigate(`/fleet-server/${namespace}/${name}`);
    } catch (err) {
      addToast({ title: 'Failed to update Fleet Server', color: 'danger', text: err instanceof Error ? err.message : 'An unexpected error occurred' });
    }
  };

  return (
    <>
      <EuiPageHeader pageTitle={`Edit ${resource.metadata.name}`} iconType="fleetApp" description={`Namespace: ${resource.metadata.namespace}`} />
      <EuiSpacer size="l" />
      <EuiForm component="form" onSubmit={handleSubmit}>
        <EuiPanel>
          <EuiTitle size="xs"><h3>General</h3></EuiTitle><EuiSpacer size="m" />
          <EuiFormRow label="Name"><EuiFieldText value={resource.metadata.name} disabled /></EuiFormRow>
          <EuiFormRow label="Namespace"><EuiFieldText value={resource.metadata.namespace} disabled /></EuiFormRow>
          <EuiFormRow label="Version"><VersionSelect value={version} onChange={setVersion} currentVersion={resource.spec.version} /></EuiFormRow>
          <EuiFormRow label="Replicas"><EuiFieldNumber value={replicas} onChange={(e) => setReplicas(parseInt(e.target.value, 10) || 1)} min={1} /></EuiFormRow>
          <EuiFormRow label="Elasticsearch Reference"><EuiFieldText value={esRef} onChange={(e) => setEsRef(e.target.value)} /></EuiFormRow>
        </EuiPanel>
        <EuiSpacer size="l" />
        <EuiFlexGroup justifyContent="flexEnd">
          <EuiFlexItem grow={false}><EuiButtonEmpty onClick={() => navigate(`/fleet-server/${namespace}/${name}`)}>Cancel</EuiButtonEmpty></EuiFlexItem>
          <EuiFlexItem grow={false}><EuiButton type="submit" fill isLoading={updateMutation.isPending}>Save Changes</EuiButton></EuiFlexItem>
        </EuiFlexGroup>
      </EuiForm>
    </>
  );
}

export function FleetServerEditPage() {
  const { namespace, name } = useParams<{ namespace: string; name: string }>();
  const { data: resource, isLoading, error: loadError } = useResource<Agent>('agent', namespace || '', name || '');
  if (isLoading) return <DetailSkeleton />;
  if (loadError || !resource) return <EuiCallOut title="Failed to load" color="danger" iconType="error">{loadError?.message || 'Not found'}</EuiCallOut>;
  return <EditForm key={resource.metadata.resourceVersion} resource={resource} namespace={namespace || ''} name={name || ''} />;
}
