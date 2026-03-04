import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EuiPageHeader, EuiSpacer, EuiForm, EuiFormRow, EuiFieldText, EuiSelect,
  EuiButton, EuiButtonEmpty, EuiFlexGroup, EuiFlexItem, EuiCallOut, EuiPanel, EuiTitle,
} from '@elastic/eui';
import { useCreateResource } from '../../hooks/useResources';

const BEAT_TYPES = [
  { value: 'filebeat', text: 'Filebeat' },
  { value: 'metricbeat', text: 'Metricbeat' },
  { value: 'heartbeat', text: 'Heartbeat' },
  { value: 'auditbeat', text: 'Auditbeat' },
  { value: 'packetbeat', text: 'Packetbeat' },
];

export function BeatCreatePage() {
  const navigate = useNavigate();
  const createMutation = useCreateResource('beat');
  const [name, setName] = useState('');
  const [namespace, setNamespace] = useState('default');
  const [version, setVersion] = useState('8.17.0');
  const [beatType, setBeatType] = useState('filebeat');
  const [esRef, setEsRef] = useState('');
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
      apiVersion: 'beat.k8s.elastic.co/v1beta1',
      kind: 'Beat',
      metadata: { name, namespace },
      spec: {
        type: beatType,
        version,
        elasticsearchRef: { name: esRef },
        daemonSet: {},
      },
    });
    navigate('/beats');
  };

  return (
    <>
      <EuiPageHeader pageTitle="Create Beat" iconType="logoBeats" />
      <EuiSpacer size="l" />
      {createMutation.isError && <><EuiCallOut title="Failed" color="danger" iconType="error">{createMutation.error?.message}</EuiCallOut><EuiSpacer size="m" /></>}
      <EuiForm component="form" onSubmit={handleSubmit}>
        <EuiPanel>
          <EuiTitle size="xs"><h3>General</h3></EuiTitle><EuiSpacer size="m" />
          <EuiFormRow label="Name" isInvalid={!!errors.name} error={errors.name}><EuiFieldText value={name} onChange={(e) => setName(e.target.value)} isInvalid={!!errors.name} placeholder="my-beat" /></EuiFormRow>
          <EuiFormRow label="Namespace" isInvalid={!!errors.namespace} error={errors.namespace}><EuiFieldText value={namespace} onChange={(e) => setNamespace(e.target.value)} isInvalid={!!errors.namespace} /></EuiFormRow>
          <EuiFormRow label="Type"><EuiSelect options={BEAT_TYPES} value={beatType} onChange={(e) => setBeatType(e.target.value)} /></EuiFormRow>
          <EuiFormRow label="Version" isInvalid={!!errors.version} error={errors.version}><EuiFieldText value={version} onChange={(e) => setVersion(e.target.value)} isInvalid={!!errors.version} /></EuiFormRow>
          <EuiFormRow label="Elasticsearch Reference" isInvalid={!!errors.esRef} error={errors.esRef}><EuiFieldText value={esRef} onChange={(e) => setEsRef(e.target.value)} isInvalid={!!errors.esRef} placeholder="my-elasticsearch" /></EuiFormRow>
        </EuiPanel>
        <EuiSpacer size="l" />
        <EuiFlexGroup justifyContent="flexEnd">
          <EuiFlexItem grow={false}><EuiButtonEmpty onClick={() => navigate('/beats')}>Cancel</EuiButtonEmpty></EuiFlexItem>
          <EuiFlexItem grow={false}><EuiButton type="submit" fill isLoading={createMutation.isPending}>Create Beat</EuiButton></EuiFlexItem>
        </EuiFlexGroup>
      </EuiForm>
    </>
  );
}
