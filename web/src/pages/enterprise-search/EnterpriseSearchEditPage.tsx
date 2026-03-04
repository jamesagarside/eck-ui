import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  EuiPageHeader, EuiSpacer, EuiForm, EuiFormRow, EuiFieldText, EuiFieldNumber,
  EuiButton, EuiButtonEmpty, EuiFlexGroup, EuiFlexItem, EuiCallOut, EuiPanel, EuiTitle,
} from '@elastic/eui';
import { useResource, useUpdateResource } from '../../hooks/useResources';
import { DetailSkeleton } from '../../components/common/Skeletons';
import type { EnterpriseSearch } from '../../types/resources';

interface EditFormProps { resource: EnterpriseSearch; namespace: string; name: string; }

function EditForm({ resource, namespace, name }: EditFormProps) {
  const navigate = useNavigate();
  const updateMutation = useUpdateResource('enterprise-search');
  const [version, setVersion] = useState(resource.spec.version);
  const [count, setCount] = useState(resource.spec.count);
  const [esRef, setEsRef] = useState(resource.spec.elasticsearchRef?.name || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateMutation.mutateAsync({
      namespace, name,
      resource: { ...resource, spec: { ...resource.spec, version, count, elasticsearchRef: { name: esRef } } },
    });
    navigate(`/enterprise-search/${namespace}/${name}`);
  };

  return (
    <>
      <EuiPageHeader pageTitle={`Edit ${resource.metadata.name}`} iconType="logoEnterpriseSearch" description={`Namespace: ${resource.metadata.namespace}`} />
      <EuiSpacer size="l" />
      {updateMutation.isError && <><EuiCallOut title="Failed" color="danger" iconType="error">{updateMutation.error?.message}</EuiCallOut><EuiSpacer size="m" /></>}
      <EuiForm component="form" onSubmit={handleSubmit}>
        <EuiPanel>
          <EuiTitle size="xs"><h3>General</h3></EuiTitle><EuiSpacer size="m" />
          <EuiFormRow label="Name"><EuiFieldText value={resource.metadata.name} disabled /></EuiFormRow>
          <EuiFormRow label="Namespace"><EuiFieldText value={resource.metadata.namespace} disabled /></EuiFormRow>
          <EuiFormRow label="Version"><EuiFieldText value={version} onChange={(e) => setVersion(e.target.value)} /></EuiFormRow>
          <EuiFormRow label="Count"><EuiFieldNumber value={count} onChange={(e) => setCount(parseInt(e.target.value, 10) || 1)} min={1} /></EuiFormRow>
          <EuiFormRow label="Elasticsearch Reference"><EuiFieldText value={esRef} onChange={(e) => setEsRef(e.target.value)} /></EuiFormRow>
        </EuiPanel>
        <EuiSpacer size="l" />
        <EuiFlexGroup justifyContent="flexEnd">
          <EuiFlexItem grow={false}><EuiButtonEmpty onClick={() => navigate(`/enterprise-search/${namespace}/${name}`)}>Cancel</EuiButtonEmpty></EuiFlexItem>
          <EuiFlexItem grow={false}><EuiButton type="submit" fill isLoading={updateMutation.isPending}>Save Changes</EuiButton></EuiFlexItem>
        </EuiFlexGroup>
      </EuiForm>
    </>
  );
}

export function EnterpriseSearchEditPage() {
  const { namespace, name } = useParams<{ namespace: string; name: string }>();
  const { data: resource, isLoading, error: loadError } = useResource<EnterpriseSearch>('enterprise-search', namespace || '', name || '');
  if (isLoading) return <DetailSkeleton />;
  if (loadError || !resource) return <EuiCallOut title="Failed to load" color="danger" iconType="error">{loadError?.message || 'Not found'}</EuiCallOut>;
  return <EditForm key={resource.metadata.resourceVersion} resource={resource} namespace={namespace || ''} name={name || ''} />;
}
