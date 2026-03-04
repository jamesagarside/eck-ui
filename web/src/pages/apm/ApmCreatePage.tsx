import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EuiPageHeader, EuiSpacer, EuiForm, EuiFormRow, EuiFieldText, EuiFieldNumber,
  EuiButton, EuiButtonEmpty, EuiFlexGroup, EuiFlexItem, EuiCallOut, EuiPanel, EuiTitle,
} from '@elastic/eui';
import { useCreateResource } from '../../hooks/useResources';

export function ApmCreatePage() {
  const navigate = useNavigate();
  const createMutation = useCreateResource('apm');
  const [name, setName] = useState('');
  const [namespace, setNamespace] = useState('default');
  const [version, setVersion] = useState('8.17.0');
  const [count, setCount] = useState(1);
  const [esRef, setEsRef] = useState('');
  const [kibanaRef, setKibanaRef] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Required';
    else if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name)) e.name = 'Invalid Kubernetes name';
    if (!namespace.trim()) e.namespace = 'Required';
    if (!version.trim()) e.version = 'Required';
    if (!esRef.trim()) e.esRef = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    await createMutation.mutateAsync({
      apiVersion: 'apm.k8s.elastic.co/v1',
      kind: 'ApmServer',
      metadata: { name, namespace },
      spec: {
        version, count,
        elasticsearchRef: { name: esRef },
        ...(kibanaRef ? { kibanaRef: { name: kibanaRef } } : {}),
      },
    });
    navigate('/apm');
  };

  return (
    <>
      <EuiPageHeader pageTitle="Create APM Server" iconType="logoAPM" />
      <EuiSpacer size="l" />
      {createMutation.isError && <><EuiCallOut title="Failed" color="danger" iconType="error">{createMutation.error?.message}</EuiCallOut><EuiSpacer size="m" /></>}
      <EuiForm component="form" onSubmit={handleSubmit}>
        <EuiPanel>
          <EuiTitle size="xs"><h3>General</h3></EuiTitle><EuiSpacer size="m" />
          <EuiFormRow label="Name" isInvalid={!!errors.name} error={errors.name}><EuiFieldText value={name} onChange={(e) => setName(e.target.value)} isInvalid={!!errors.name} placeholder="my-apm" /></EuiFormRow>
          <EuiFormRow label="Namespace" isInvalid={!!errors.namespace} error={errors.namespace}><EuiFieldText value={namespace} onChange={(e) => setNamespace(e.target.value)} isInvalid={!!errors.namespace} /></EuiFormRow>
          <EuiFormRow label="Version" isInvalid={!!errors.version} error={errors.version}><EuiFieldText value={version} onChange={(e) => setVersion(e.target.value)} isInvalid={!!errors.version} /></EuiFormRow>
          <EuiFormRow label="Count"><EuiFieldNumber value={count} onChange={(e) => setCount(parseInt(e.target.value, 10) || 1)} min={1} /></EuiFormRow>
          <EuiFormRow label="Elasticsearch Reference" isInvalid={!!errors.esRef} error={errors.esRef}><EuiFieldText value={esRef} onChange={(e) => setEsRef(e.target.value)} isInvalid={!!errors.esRef} placeholder="my-elasticsearch" /></EuiFormRow>
          <EuiFormRow label="Kibana Reference (optional)"><EuiFieldText value={kibanaRef} onChange={(e) => setKibanaRef(e.target.value)} placeholder="my-kibana" /></EuiFormRow>
        </EuiPanel>
        <EuiSpacer size="l" />
        <EuiFlexGroup justifyContent="flexEnd">
          <EuiFlexItem grow={false}><EuiButtonEmpty onClick={() => navigate('/apm')}>Cancel</EuiButtonEmpty></EuiFlexItem>
          <EuiFlexItem grow={false}><EuiButton type="submit" fill isLoading={createMutation.isPending}>Create APM Server</EuiButton></EuiFlexItem>
        </EuiFlexGroup>
      </EuiForm>
    </>
  );
}
