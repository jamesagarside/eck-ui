import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EuiPageHeader,
  EuiSpacer,
  EuiForm,
  EuiFormRow,
  EuiFieldText,
  EuiFieldNumber,
  EuiButton,
  EuiButtonEmpty,
  EuiFlexGroup,
  EuiFlexItem,
  EuiCallOut,
  EuiPanel,
  EuiTitle,
} from '@elastic/eui';
import { useCreateResource } from '../../hooks/useResources';

interface FormErrors {
  name?: string;
  namespace?: string;
  version?: string;
  elasticsearchRef?: string;
}

export function KibanaCreatePage() {
  const navigate = useNavigate();
  const createMutation = useCreateResource('kibana');

  const [name, setName] = useState('');
  const [namespace, setNamespace] = useState('default');
  const [version, setVersion] = useState('8.17.0');
  const [count, setCount] = useState(1);
  const [esRef, setEsRef] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!name.trim()) e.name = 'Name is required';
    else if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name)) e.name = 'Invalid Kubernetes name';
    if (!namespace.trim()) e.namespace = 'Namespace is required';
    if (!version.trim()) e.version = 'Version is required';
    if (!esRef.trim()) e.elasticsearchRef = 'Elasticsearch reference is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    const resource = {
      apiVersion: 'kibana.k8s.elastic.co/v1',
      kind: 'Kibana',
      metadata: { name, namespace },
      spec: { version, count, elasticsearchRef: { name: esRef } },
    };
    await createMutation.mutateAsync(resource);
    navigate('/kibana');
  };

  return (
    <>
      <EuiPageHeader pageTitle="Create Kibana" iconType="logoKibana" />
      <EuiSpacer size="l" />
      {createMutation.isError && (
        <>
          <EuiCallOut title="Failed to create Kibana" color="danger" iconType="error">{createMutation.error?.message}</EuiCallOut>
          <EuiSpacer size="m" />
        </>
      )}
      <EuiForm component="form" onSubmit={handleSubmit}>
        <EuiPanel>
          <EuiTitle size="xs"><h3>General</h3></EuiTitle>
          <EuiSpacer size="m" />
          <EuiFormRow label="Name" isInvalid={!!errors.name} error={errors.name}>
            <EuiFieldText value={name} onChange={(e) => setName(e.target.value)} isInvalid={!!errors.name} placeholder="my-kibana" />
          </EuiFormRow>
          <EuiFormRow label="Namespace" isInvalid={!!errors.namespace} error={errors.namespace}>
            <EuiFieldText value={namespace} onChange={(e) => setNamespace(e.target.value)} isInvalid={!!errors.namespace} />
          </EuiFormRow>
          <EuiFormRow label="Version" isInvalid={!!errors.version} error={errors.version}>
            <EuiFieldText value={version} onChange={(e) => setVersion(e.target.value)} isInvalid={!!errors.version} />
          </EuiFormRow>
          <EuiFormRow label="Count">
            <EuiFieldNumber value={count} onChange={(e) => setCount(parseInt(e.target.value, 10) || 1)} min={1} />
          </EuiFormRow>
          <EuiFormRow label="Elasticsearch Reference" isInvalid={!!errors.elasticsearchRef} error={errors.elasticsearchRef} helpText="Name of the Elasticsearch cluster">
            <EuiFieldText value={esRef} onChange={(e) => setEsRef(e.target.value)} isInvalid={!!errors.elasticsearchRef} placeholder="my-elasticsearch" />
          </EuiFormRow>
        </EuiPanel>
        <EuiSpacer size="l" />
        <EuiFlexGroup justifyContent="flexEnd">
          <EuiFlexItem grow={false}>
            <EuiButtonEmpty onClick={() => navigate('/kibana')}>Cancel</EuiButtonEmpty>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiButton type="submit" fill isLoading={createMutation.isPending}>Create Kibana</EuiButton>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiForm>
    </>
  );
}
