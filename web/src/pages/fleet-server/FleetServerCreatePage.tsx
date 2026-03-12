import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EuiPageHeader, EuiSpacer, EuiForm, EuiFormRow, EuiFieldText, EuiFieldNumber,
  EuiButton, EuiButtonEmpty, EuiFlexGroup, EuiFlexItem, EuiCallOut, EuiPanel, EuiTitle,
} from '@elastic/eui';
import { useCreateResource } from '../../hooks/useResources';
import { useVersions } from '../../hooks/useVersions';
import { VersionSelect } from '../../components/form/VersionSelect';

export function FleetServerCreatePage() {
  const navigate = useNavigate();
  const createMutation = useCreateResource('agent');
  const { defaultVersion } = useVersions();
  const [name, setName] = useState('');
  const [namespace, setNamespace] = useState('default');
  const [version, setVersion] = useState(defaultVersion);
  const [replicas, setReplicas] = useState(1);
  const [esRef, setEsRef] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Required';
    else if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name)) e.name = 'Invalid Kubernetes name';
    if (!namespace.trim()) e.namespace = 'Required';
    if (!version.trim()) e.version = 'Required';
    if (replicas < 1) e.replicas = 'Must be at least 1';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    await createMutation.mutateAsync({
      apiVersion: 'agent.k8s.elastic.co/v1alpha1',
      kind: 'Agent',
      metadata: { name, namespace },
      spec: {
        version,
        mode: 'fleet',
        fleetServerEnabled: true,
        deployment: { replicas },
        ...(esRef ? { elasticsearchRefs: [{ name: esRef }] } : {}),
      },
    });
    navigate('/fleet-server');
  };

  return (
    <>
      <EuiPageHeader pageTitle="Create Fleet Server" iconType="fleetApp" />
      <EuiSpacer size="l" />
      {createMutation.isError && <><EuiCallOut title="Failed" color="danger" iconType="error">{createMutation.error?.message}</EuiCallOut><EuiSpacer size="m" /></>}
      <EuiForm component="form" onSubmit={handleSubmit}>
        <EuiPanel>
          <EuiTitle size="xs"><h3>General</h3></EuiTitle><EuiSpacer size="m" />
          <EuiFormRow label="Name" isInvalid={!!errors.name} error={errors.name}><EuiFieldText value={name} onChange={(e) => setName(e.target.value)} isInvalid={!!errors.name} placeholder="fleet-server" /></EuiFormRow>
          <EuiFormRow label="Namespace" isInvalid={!!errors.namespace} error={errors.namespace}><EuiFieldText value={namespace} onChange={(e) => setNamespace(e.target.value)} isInvalid={!!errors.namespace} /></EuiFormRow>
          <EuiFormRow label="Version" isInvalid={!!errors.version} error={errors.version}><VersionSelect value={version} onChange={setVersion} isInvalid={!!errors.version} /></EuiFormRow>
          <EuiFormRow label="Replicas" isInvalid={!!errors.replicas} error={errors.replicas}><EuiFieldNumber value={replicas} onChange={(e) => setReplicas(parseInt(e.target.value, 10) || 1)} min={1} isInvalid={!!errors.replicas} /></EuiFormRow>
          <EuiFormRow label="Elasticsearch Reference (optional)"><EuiFieldText value={esRef} onChange={(e) => setEsRef(e.target.value)} placeholder="my-elasticsearch" /></EuiFormRow>
        </EuiPanel>
        <EuiSpacer size="l" />
        <EuiFlexGroup justifyContent="flexEnd">
          <EuiFlexItem grow={false}><EuiButtonEmpty onClick={() => navigate('/fleet-server')}>Cancel</EuiButtonEmpty></EuiFlexItem>
          <EuiFlexItem grow={false}><EuiButton type="submit" fill isLoading={createMutation.isPending}>Create Fleet Server</EuiButton></EuiFlexItem>
        </EuiFlexGroup>
      </EuiForm>
    </>
  );
}
